/**
 * audioEngine — shared singleton AudioContext for all instruments.
 *
 * All instruments (SoundRealm, GodVault, MultiRealm, Chopper) connect their
 * output to `audioEngine.masterBus`. An AudioWorkletNode captures the mixed
 * audio on the dedicated audio-rendering thread and forwards it to JUCE via
 * sendToJuce so the DAW receives the audio on its normal bus. In standalone
 * mode the audio also plays through the system speakers; in plugin mode the
 * local output is muted so you only hear it through the DAW.
 *
 * Why AudioWorklet (not ScriptProcessorNode): ScriptProcessor runs on the main
 * thread, so React re-renders (e.g. clicking a preset) would starve it and
 * produce clicks/buzz. The worklet runs on the audio thread and is immune to
 * UI-thread jank — this is what makes note/preset clicks glitch-free.
 */

// Samples per message sent to JUCE. Larger chunks = fewer IPC calls per second
// (base64 + WebView2 marshalling), which means less main-thread work competing
// with React and steadier delivery to the native ring buffer. 2048 ≈ 23 msg/s
// at 48 kHz (vs 47 at 1024). The native side buffers ~120 ms so this added
// granularity costs no extra reliability.
const CHUNK = 2048;

/** Encode a Float32Array as a compact base64 string. */
function f32ToB64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let bin = '';
  const STEP = 4096;
  for (let i = 0; i < bytes.length; i += STEP) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + STEP, bytes.length)));
  }
  return btoa(bin);
}

// The worklet processor source. It accumulates the audio-thread input into
// CHUNK-sized blocks and transfers them to the main thread, which relays them
// to JUCE. Running here (audio thread) means UI jank can never drop a buffer.
const WORKLET_SRC = `
class GodRealmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunk = ${CHUNK};
    this._l = new Float32Array(this._chunk);
    this._r = new Float32Array(this._chunk);
    this._w = 0;
    // Idle gate (on the AUDIO thread): only post chunks to the main thread when
    // there is signal, plus a release tail. During silence we send nothing, so
    // the main thread does no base64/IPC work — this is what stops the constant
    // static/jank that continuous streaming caused.
    this._holdChunks = 0;
    this._chunkPeak = 0;
    // Startup warmup: discard the first N chunks so Web Audio graph init
    // transients (IIR oversamplers, tab-gain ramps at 50ms τ) never reach JUCE.
    // Tab-gain ramps settle in ~150ms (3τ); 10 chunks ≈ 430ms covers that plus
    // any ConvolverNode IR construction. JUCE side primes webAudioLastMs for
    // 600ms to stay in sync — keeps the native sampler silent during this window.
    this._warmupChunks = 10; // ~0.43 s @ 48 kHz / ~0.46 s @ 44.1 kHz
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const l = input[0];
    const r = input.length > 1 ? input[1] : input[0];
    const n = l.length;
    for (let i = 0; i < n; i++) {
      const a = l[i] < 0 ? -l[i] : l[i];
      const b = r[i] < 0 ? -r[i] : r[i];
      if (a > this._chunkPeak) this._chunkPeak = a;
      if (b > this._chunkPeak) this._chunkPeak = b;
      this._l[this._w] = l[i];
      this._r[this._w] = r[i];
      this._w++;
      if (this._w >= this._chunk) {
        this._w = 0;
        this._chunkPeak = 0;
        // Warmup: silently drop chunk — graph still settling after context resume.
        if (this._warmupChunks > 0) { this._warmupChunks--; continue; }
        // ~-80dB threshold; ~1s release tail (HOLD chunks * CHUNK/sr). Keep the
        // gate OPEN for ~1s after the last signal so gaps between notes during a
        // performance never close it (closing it drains the native buffer and
        // costs a re-prime/attack delay on the next note). At CHUNK=2048, 22
        // chunks ≈ 1s.
        const SIGNAL = 5e-3; // −46 dB; blocks tape hiss/reverb tails, passes all real notes
        const HOLD = 22;
        if (this._chunkPeak > SIGNAL) this._holdChunks = HOLD;
        if (this._holdChunks > 0) {
          this._holdChunks--;
          this.port.postMessage({ l: this._l, r: this._r }, [this._l.buffer, this._r.buffer]);
          this._l = new Float32Array(this._chunk);
          this._r = new Float32Array(this._chunk);
        }
        // else: idle — drop the chunk, send nothing.
      }
    }
    return true;
  }
}
registerProcessor('godrealm-capture', GodRealmCaptureProcessor);
`;

class AudioEngineClass {
  readonly ctx: AudioContext;
  readonly masterBus: GainNode;
  private localGain: GainNode;
  // Global FX insert point (Pedal Realm). Instruments → masterBus → fxInput →
  // [chain] → fxOutput → output/capture.
  readonly fxInput: GainNode;
  readonly fxOutput: GainNode;
  private _fxActive = false;
  private workletNode: AudioWorkletNode | null = null;
  private _isPlugin = false;
  // Diagnostics surfaced by the on-screen status panel
  private _workletReady = false;
  private _usingFallback = false;
  private _chunksSent = 0;
  private _lastPeak = 0;

  constructor() {
    // Use the system sample rate (don't force 48k). JUCE resamples to the DAW
    // rate, so the only requirement is that we report ctx.sampleRate accurately.
    this.ctx = new AudioContext({ latencyHint: 'playback' });
    this.masterBus = this.ctx.createGain();
    this.masterBus.gain.value = 1.0;

    // In plugin mode (WebView2) the ONLY audio path is the JUCE capture bridge.
    // Pre-mute localGain immediately so there is never a window where web audio
    // leaks to system speakers while the bridge is also feeding the DAW — that
    // two-path scenario produces ~50–120 ms comb filtering ("phasing") on every
    // note. The bridge still runs in parallel so the DAW receives the audio.
    // In standalone / browser mode localGain stays at 1.0 (normal speaker output).
    const isWebView2 = !!(window as any).chrome?.webview;
    this._isPlugin = isWebView2;

    // ── Global FX insert (Pedal Realm) ──────────────────────────────────────
    // Every instrument feeds masterBus. We splice a global insert point right
    // after it so the Pedal Realm can process the ENTIRE plugin (any tab/preset)
    // when switched on. Signal: masterBus → fxInput → [pedal chain | dry] →
    // fxOutput → localGain/worklet. Capture happens POST-FX so the DAW hears the
    // pedals too. Default is a dry passthrough (fxInput → fxOutput).
    this.fxInput  = this.ctx.createGain();
    this.fxOutput = this.ctx.createGain();
    this.masterBus.connect(this.fxInput);
    this.fxInput.connect(this.fxOutput); // dry passthrough until a chain is inserted

    this.localGain = this.ctx.createGain();
    this.localGain.gain.value = isWebView2 ? 0.0 : 1.0;
    this.fxOutput.connect(this.localGain);
    this.localGain.connect(this.ctx.destination);

    // Expose the AudioContext so bridge.ts and injected user scripts can call
    // resume() from a user-gesture handler (WebView2 blocks programmatic resume
    // from evaluateJavascript() because it has no user-activation status).
    (window as any).__godRealmAudioCtx = this.ctx;
    (window as any).__godRealmEngine = this; // debug hook for audio-path inspection

    // Visible status dot in bottom-left corner of plugin window.
    // GREEN = AudioContext running (web audio is flowing to JUCE).
    // RED   = AudioContext suspended (PantheonSynth fallback is active).
    // Click it to force a resume attempt from a real user gesture.
    if (isWebView2) this._attachStatusDot();

    // Set up the capture worklet asynchronously. Until it's ready there's a
    // brief window with no capture, which is fine (no audio is playing yet).
    void this.initWorklet();
  }

  private async initWorklet() {
    try {
      const blob = new Blob([WORKLET_SRC], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      const node = new AudioWorkletNode(this.ctx, 'godrealm-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      this.workletNode = node;
      this._workletReady = true;

      // fxOutput → worklet (capture POST global FX, so the DAW hears the Pedal
      // Realm too). A muted sink keeps the node pulled by the graph without
      // doubling audio to the speakers.
      this.fxOutput.connect(node);
      const sink = this.ctx.createGain();
      sink.gain.value = 0;
      node.connect(sink);
      sink.connect(this.ctx.destination);

      node.port.onmessage = (e: MessageEvent) => {
        if (!this._isPlugin) return;
        const { l, r } = e.data as { l: Float32Array; r: Float32Array };
        // Web Audio bridge is deprecated. Audio is synthesized natively by C++.
        // We keep the worklet graph connected to allow local browser testing,
        // but we no longer send AUDIO_DATA over the async bridge to JUCE.
        this._chunksSent++;
      };
    } catch (err) {
      console.error('[audioEngine] AudioWorklet init failed, falling back:', err);
      this.initScriptProcessorFallback();
    }
  }

  /** Legacy fallback if AudioWorklet is unavailable (very old WebView). */
  private initScriptProcessorFallback() {
    this._usingFallback = true;
    this._workletReady = true;
    // @ts-ignore deprecated but universally supported
    const node = this.ctx.createScriptProcessor(2048, 2, 2);
    this.fxOutput.connect(node);
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    node.connect(sink);
    sink.connect(this.ctx.destination);
    node.onaudioprocess = (e: AudioProcessingEvent) => {
      for (let ch = 0; ch < e.outputBuffer.numberOfChannels; ch++)
        e.outputBuffer.getChannelData(ch).fill(0);
      if (!this._isPlugin) return;
      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : left;
      // Web Audio bridge is deprecated. Audio is synthesized natively by C++.
      // We keep the worklet graph connected to allow local browser testing,
      // but we no longer send AUDIO_DATA over the async bridge to JUCE.
      this._chunksSent++;
    };
  }

  /** Call once when we know whether we're inside a DAW plugin or standalone. */
  setIsPlugin(v: boolean) {
    this._isPlugin = v;
    // Plugin mode: mute the local (system-speaker) output. The only audio path
    // is the JUCE capture bridge → DAW. Having both paths open causes comb
    // filtering: the local path is instant while the bridge path is delayed by
    // the FIFO prime (~50 ms), so every note is heard twice out-of-sync.
    // Standalone mode: unmute so audio plays through system speakers normally.
    this.setLocalMonitor(!v);
  }

  /** Toggle the local (system-output) monitor independently of the bridge. */
  setLocalMonitor(on: boolean) {
    this.localGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  get isPlugin() { return this._isPlugin; }

  /**
   * Splice a global FX chain into the master path (Pedal Realm). `input` and
   * `output` are the chain's ends. While inserted, the whole plugin's audio
   * (every tab/preset) flows through it; capture stays post-FX so the DAW hears
   * it too. Call removeGlobalFx() to return to a dry passthrough.
   */
  insertGlobalFx(input: AudioNode, output: AudioNode) {
    try { this.fxInput.disconnect(); } catch {}
    this.fxInput.connect(input);
    output.connect(this.fxOutput);
    this._fxActive = true;
  }

  removeGlobalFx(output?: AudioNode) {
    try { this.fxInput.disconnect(); } catch {}
    if (output) { try { output.disconnect(this.fxOutput); } catch {} }
    this.fxInput.connect(this.fxOutput); // restore dry passthrough
    this._fxActive = false;
  }

  get fxActive() { return this._fxActive; }

  /**
   * Play a short tone through the master bus. Because it goes through the exact
   * same path as every instrument (masterBus → fx → output/capture), hearing it
   * in the DAW proves the web→DAW bridge works; silence means the bridge/context
   * is the problem (not the individual tab).
   */
  testBeep() {
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 660;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.25, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(g); g.connect(this.masterBus);
      osc.start(now); osc.stop(now + 0.37);
    } catch { /* ignore */ }
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch((e) => {
        (window as any).__godRealmLastResumeError = String(e);
      });
    }
  }

  private _attachStatusDot() {
    // A compact diagnostic panel in the bottom-left corner of the plugin window.
    // Reads (left→right): AudioContext state, plugin-mode flag, worklet readiness,
    // and a running count of audio chunks delivered to JUCE. If the bridge is
    // healthy you'll see "running plug:Y wk:Y sent:####" climbing as audio plays.
    // Click the panel to force an AudioContext resume from a real user gesture.
    const panel = document.createElement('div');
    panel.id = '__gr_audioDot';
    panel.style.cssText = [
      'position:fixed', 'bottom:6px', 'left:6px', 'min-width:10px', 'height:16px',
      'padding:0 8px', 'border-radius:8px', 'background:#ef4444', 'color:#fff',
      'font:700 10px/16px monospace', 'white-space:nowrap', 'z-index:2147483647',
      'cursor:pointer', 'box-shadow:0 0 4px rgba(0,0,0,.6)', 'user-select:none',
      'transition:background .3s', 'opacity:.85',
    ].join(';');
    const mount = () => { if (document.body && !document.getElementById('__gr_audioDot')) document.body.appendChild(panel); };
    document.addEventListener('DOMContentLoaded', mount, { once: true });
    mount();

    const update = () => {
      const running = this.ctx.state === 'running';
      const err = (window as any).__godRealmLastResumeError;
      if (!running) {
        // Suspended → big, obvious, pulsing call-to-action. A direct click on
        // this button is a guaranteed user gesture that unblocks the context.
        panel.style.background = '#ef4444';
        panel.style.left = '50%';
        panel.style.bottom = '14px';
        panel.style.transform = 'translateX(-50%)';
        panel.style.height = '34px';
        panel.style.padding = '0 22px';
        panel.style.font = '800 13px/34px system-ui,sans-serif';
        panel.style.borderRadius = '17px';
        panel.style.opacity = '1';
        panel.style.boxShadow = '0 0 0 0 rgba(239,68,68,.6)';
        panel.style.animation = 'grPulse 1.2s infinite';
        panel.textContent = '🔊 CLICK TO ENABLE AUDIO';
      } else {
        // Running → shrink to the tiny corner diagnostic.
        panel.style.background = '#16a34a';
        panel.style.left = '6px';
        panel.style.bottom = '6px';
        panel.style.transform = 'none';
        panel.style.height = '16px';
        panel.style.padding = '0 8px';
        panel.style.font = '700 10px/16px monospace';
        panel.style.borderRadius = '8px';
        panel.style.opacity = '.85';
        panel.style.animation = 'none';
        panel.textContent =
          `${this.ctx.state} plug:${this._isPlugin ? 'Y' : 'N'} ` +
          `wk:${this._workletReady ? (this._usingFallback ? 'SP' : 'Y') : 'N'} ` +
          `sent:${this._chunksSent}` + (err ? ` ⚠${err}` : '');
      }
    };
    // Pulse keyframes (injected once).
    if (!document.getElementById('__gr_audioDotKf')) {
      const st = document.createElement('style'); st.id = '__gr_audioDotKf';
      st.textContent = '@keyframes grPulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.6)}70%{box-shadow:0 0 0 12px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}';
      document.head.appendChild(st);
    }
    update();
    setInterval(update, 400);

    const doResume = () => {
      this.ctx.resume().then(() => {
        update();
        this.testBeep(); // confirm the master→DAW bridge end-to-end
      }).catch((e) => {
        (window as any).__godRealmLastResumeError = String(e);
        update();
      });
    };
    panel.addEventListener('click', doResume);
    panel.addEventListener('pointerdown', doResume);
  }
}

export const audioEngine = new AudioEngineClass();
