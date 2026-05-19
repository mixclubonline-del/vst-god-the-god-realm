/**
 * PantheonSynthEngine.ts — Polyphonic FM Synth for the Electric Pantheon
 * 8-voice poly with per-god timbres, FX chain, macro control, Divine Morph,
 * and real-time analysis for visual synchronization.
 */

import { PantheonVoice } from './PantheonVoice';
import { GOD_VOICE_PRESETS, type GodVoicePreset, type VoiceMode } from './pantheonVoicePresets';

/** Real-time analysis snapshot exposed to the UI layer */
export interface PantheonAnalysisData {
  rms: number;           // 0–1 overall signal level
  peak: number;          // 0–1 instantaneous peak
  spectralBands: {
    body: number;        // 20–200 Hz
    soul: number;        // 200 Hz–2 kHz
    air: number;         // 2 kHz–8 kHz
    silk: number;        // 8 kHz–20 kHz
  };
  isActive: boolean;     // any voice currently gated
  activeVoiceCount: number;
}

export class PantheonSynthEngine {
  private ctx: BaseAudioContext | null = null;
  private voices: PantheonVoice[] = [];
  private voiceMixer!: GainNode;
  private masterGain!: GainNode;

  // FX nodes
  private reverbConvolver!: ConvolverNode;
  private reverbSend!: GainNode;
  private reverbReturn!: GainNode;
  private chorusDelayL!: DelayNode;
  private chorusDelayR!: DelayNode;
  private chorusLfo!: OscillatorNode;
  private chorusLfoGainL!: GainNode;
  private chorusLfoGainR!: GainNode;
  private chorusSend!: GainNode;
  private chorusReturn!: GainNode;
  private delayNode!: DelayNode;
  private delayFeedback!: GainNode;
  private delaySend!: GainNode;
  private delayReturn!: GainNode;
  private satShaper!: WaveShaperNode;
  private satDry!: GainNode;
  private satWet!: GainNode;

  // Analysis
  private analyser!: AnalyserNode;
  private analyserFreqData!: Uint8Array;
  private analyserTimeData!: Uint8Array;

  // Macro processing
  private macroFilter!: BiquadFilterNode;
  private widthSplitter!: ChannelSplitterNode;
  private widthMerger!: ChannelMergerNode;
  private widthMidGain!: GainNode;
  private widthSideGain!: GainNode;

  // State
  private currentGodId = 'olympus';
  private voiceMode: VoiceMode = 'POLY';
  private pitchBend = 0;
  private modWheel = 0;
  private vibratoLfo!: OscillatorNode;
  private vibratoGain!: GainNode;
  private macroState = { energy: 50, divinity: 50, width: 50, realm: 50 };

  // Morph state
  private morphVoices: PantheonVoice[] = [];
  private morphMixer: GainNode | null = null;
  private morphBlend = 0;
  private morphFromGod = '';
  private morphToGod = '';

  private readonly VOICE_COUNT = 8;
  private readonly PORTA_TIME = 0.05;

  get preset(): GodVoicePreset {
    return GOD_VOICE_PRESETS[this.currentGodId] || GOD_VOICE_PRESETS.olympus;
  }

  init(ctx: BaseAudioContext, destination?: AudioNode): void {
    this.ctx = ctx;

    // Master output
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(destination ?? ctx.destination);

    // Macro filter (mid-chain EQ)
    this.macroFilter = ctx.createBiquadFilter();
    this.macroFilter.type = 'peaking';
    this.macroFilter.frequency.value = 2000;
    this.macroFilter.Q.value = 0.7;
    this.macroFilter.gain.value = 0;

    // Analysis node (tapped post-EQ, pre-width for true signal metering)
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyserFreqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyserTimeData = new Uint8Array(this.analyser.fftSize);

    // Width processing (simple M/S)
    this.buildWidthChain();

    // Voice mixer
    this.voiceMixer = ctx.createGain();
    this.voiceMixer.gain.value = 0.8;

    // Build FX chain
    this.buildReverbFX();
    this.buildChorusFX();
    this.buildDelayFX();
    this.buildSaturationFX();

    // Vibrato LFO (mod wheel target)
    this.vibratoLfo = ctx.createOscillator();
    this.vibratoLfo.type = 'sine';
    this.vibratoLfo.frequency.value = 5.0;
    this.vibratoGain = ctx.createGain();
    this.vibratoGain.gain.value = 0;
    this.vibratoLfo.connect(this.vibratoGain);
    this.vibratoLfo.start();

    // Signal chain: voiceMixer → sat → reverb/chorus/delay → macroFilter → width → master
    this.voiceMixer.connect(this.satDry);
    this.voiceMixer.connect(this.satShaper);
    this.satShaper.connect(this.satWet);

    const satMerge = ctx.createGain();
    this.satDry.connect(satMerge);
    this.satWet.connect(satMerge);

    satMerge.connect(this.reverbSend);
    satMerge.connect(this.chorusSend);
    satMerge.connect(this.delaySend);
    satMerge.connect(this.macroFilter);

    this.reverbReturn.connect(this.macroFilter);
    this.chorusReturn.connect(this.macroFilter);
    this.delayReturn.connect(this.macroFilter);

    this.macroFilter.connect(this.analyser);
    this.analyser.connect(this.widthSplitter);
    this.widthMerger.connect(this.masterGain);

    // Create voices
    for (let i = 0; i < this.VOICE_COUNT; i++) {
      const v = new PantheonVoice(ctx);
      v.connect(this.voiceMixer);
      this.voices.push(v);
    }

    // Connect vibrato to all voice carrier frequencies
    // (handled per-note via setPitchBend integration)

    // Apply default god preset
    this.setGod('olympus');
  }

  // ─── FX Builders ─────────────────────────────────────────

  private buildReverbFX(): void {
    const ctx = this.ctx!;
    this.reverbConvolver = ctx.createConvolver();
    this.reverbSend = ctx.createGain();
    this.reverbReturn = ctx.createGain();
    this.reverbSend.gain.value = 0.3;
    this.reverbReturn.gain.value = 0.3;

    // Synthetic IR
    this.reverbConvolver.buffer = this.createReverbIR(2.5);
    this.reverbSend.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbReturn);
  }

  private createReverbIR(decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = rate * decay;
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      }
    }
    return buf;
  }

  private buildChorusFX(): void {
    const ctx = this.ctx!;
    this.chorusSend = ctx.createGain();
    this.chorusReturn = ctx.createGain();
    this.chorusSend.gain.value = 0.2;
    this.chorusReturn.gain.value = 0.2;

    this.chorusDelayL = ctx.createDelay(0.05);
    this.chorusDelayR = ctx.createDelay(0.05);
    this.chorusDelayL.delayTime.value = 0.005;
    this.chorusDelayR.delayTime.value = 0.007;

    this.chorusLfo = ctx.createOscillator();
    this.chorusLfo.type = 'sine';
    this.chorusLfo.frequency.value = 0.8;

    this.chorusLfoGainL = ctx.createGain();
    this.chorusLfoGainL.gain.value = 0.003;
    this.chorusLfoGainR = ctx.createGain();
    this.chorusLfoGainR.gain.value = 0.003;

    this.chorusLfo.connect(this.chorusLfoGainL);
    this.chorusLfo.connect(this.chorusLfoGainR);
    this.chorusLfoGainL.connect(this.chorusDelayL.delayTime);
    this.chorusLfoGainR.connect(this.chorusDelayR.delayTime);

    const merger = ctx.createChannelMerger(2);
    this.chorusSend.connect(this.chorusDelayL);
    this.chorusSend.connect(this.chorusDelayR);
    this.chorusDelayL.connect(merger, 0, 0);
    this.chorusDelayR.connect(merger, 0, 1);
    merger.connect(this.chorusReturn);

    this.chorusLfo.start();
  }

  private buildDelayFX(): void {
    const ctx = this.ctx!;
    this.delaySend = ctx.createGain();
    this.delayReturn = ctx.createGain();
    this.delaySend.gain.value = 0.15;
    this.delayReturn.gain.value = 0.15;

    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.375;

    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.3;

    this.delaySend.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayReturn);
  }

  private buildSaturationFX(): void {
    const ctx = this.ctx!;
    this.satShaper = ctx.createWaveShaper();
    this.satShaper.oversample = '2x';
    this.satDry = ctx.createGain();
    this.satWet = ctx.createGain();
    this.satDry.gain.value = 0.8;
    this.satWet.gain.value = 0.2;
    this.setSatCurve(1.2);
  }

  private setSatCurve(drive: number): void {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * drive);
    }
    this.satShaper.curve = curve;
  }

  private buildWidthChain(): void {
    const ctx = this.ctx!;
    this.widthSplitter = ctx.createChannelSplitter(2);
    this.widthMerger = ctx.createChannelMerger(2);
    this.widthMidGain = ctx.createGain();
    this.widthSideGain = ctx.createGain();
    this.widthMidGain.gain.value = 1.0;
    this.widthSideGain.gain.value = 0.5;

    // Simple stereo width: L → merger 0, R → merger 1
    this.widthSplitter.connect(this.widthMidGain, 0);
    this.widthSplitter.connect(this.widthSideGain, 1);
    this.widthMidGain.connect(this.widthMerger, 0, 0);
    this.widthSideGain.connect(this.widthMerger, 0, 1);
  }

  // ─── God Selection ───────────────────────────────────────

  setGod(godId: string): void {
    const p = GOD_VOICE_PRESETS[godId];
    if (!p) return;
    this.currentGodId = godId;

    // Apply preset to all voices
    for (const v of this.voices) {
      v.applyPreset(p);
    }

    // Update FX chain
    this.applyFXPreset(p);

    // Rebuild reverb IR if decay changed
    if (this.ctx) {
      this.reverbConvolver.buffer = this.createReverbIR(p.reverbDecay);
    }
  }

  private applyFXPreset(p: GodVoicePreset): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.reverbSend.gain.setTargetAtTime(p.reverbMix, now, 0.05);
    this.reverbReturn.gain.setTargetAtTime(p.reverbMix, now, 0.05);
    this.chorusLfo.frequency.setTargetAtTime(p.chorusRate, now, 0.05);
    this.chorusLfoGainL.gain.setTargetAtTime(p.chorusDepth, now, 0.05);
    this.chorusLfoGainR.gain.setTargetAtTime(p.chorusDepth, now, 0.05);
    this.chorusSend.gain.setTargetAtTime(p.chorusMix, now, 0.05);
    this.chorusReturn.gain.setTargetAtTime(p.chorusMix, now, 0.05);
    this.delayNode.delayTime.setTargetAtTime(p.delayTime, now, 0.05);
    this.delayFeedback.gain.setTargetAtTime(p.delayFeedback, now, 0.05);
    this.delaySend.gain.setTargetAtTime(p.delayMix, now, 0.05);
    this.delayReturn.gain.setTargetAtTime(p.delayMix, now, 0.05);
    this.setSatCurve(p.satDrive);
    this.satWet.gain.setTargetAtTime(p.satMix, now, 0.05);
    this.satDry.gain.setTargetAtTime(1 - p.satMix, now, 0.05);
  }

  // ─── Voice Allocation ────────────────────────────────────

  noteOn(midi: number, velocity: number): void {
    if (!this.ctx) return;

    if (this.voiceMode === 'MONO' || this.voiceMode === 'LEGATO') {
      this.handleMonoNote(midi, velocity);
      return;
    }

    // POLY mode: find free voice or steal oldest
    let voice = this.voices.find(v => !v.active);
    if (!voice) {
      voice = this.voices.reduce((oldest, v) =>
        v.startTime < oldest.startTime ? v : oldest
      );
      voice.noteOff();
    }

    voice.noteOn(midi, velocity, this.pitchBend);

    // Also trigger morph voices if morph is active
    if (this.morphBlend > 0 && this.morphVoices.length > 0) {
      let mv = this.morphVoices.find(v => !v.active);
      if (!mv) {
        mv = this.morphVoices.reduce((o, v) => v.startTime < o.startTime ? v : o);
        mv.noteOff();
      }
      mv.noteOn(midi, velocity, this.pitchBend);
    }
  }

  noteOff(midi: number): void {
    for (const v of this.voices) {
      if (v.midi === midi && v.active) {
        v.noteOff();
      }
    }
    for (const v of this.morphVoices) {
      if (v.midi === midi && v.active) {
        v.noteOff();
      }
    }
  }

  private handleMonoNote(midi: number, velocity: number): void {
    const active = this.voices.find(v => v.active);
    if (active && this.voiceMode === 'LEGATO') {
      active.glide(midi, this.PORTA_TIME, this.pitchBend);
    } else {
      // Retrigger voice 0
      if (active) active.noteOff();
      this.voices[0].noteOn(midi, velocity, this.pitchBend);
    }
  }

  // ─── Performance Controls ────────────────────────────────

  setPitchBend(value: number): void {
    // value: -1 to +1 → ±2 semitones
    this.pitchBend = value * 2;
    for (const v of this.voices) {
      if (v.active) v.setPitchBend(this.pitchBend);
    }
  }

  setModWheel(value: number): void {
    // value: 0-127
    this.modWheel = value;
    if (!this.ctx) return;
    const depth = (value / 127) * (this.preset.vibratoDepth || 3);
    this.vibratoGain.gain.setTargetAtTime(depth, this.ctx.currentTime, 0.02);
  }

  setVoiceMode(mode: VoiceMode): void {
    this.voiceMode = mode;
    // Kill all active voices on mode change
    for (const v of this.voices) {
      if (v.active) v.noteOff();
    }
  }

  // ─── Macro Control ───────────────────────────────────────

  setMacro(id: string, value: number): void {
    if (!this.ctx) return;
    this.macroState[id as keyof typeof this.macroState] = value;
    const now = this.ctx.currentTime;
    const norm = value / 100;

    switch (id) {
      case 'energy': {
        // ── Target: drive, transient, ampAttack, velocityBloom, compression ──
        // Core: Drive + filter brightness
        const drive = 1.0 + norm * 4.0;
        this.setSatCurve(drive);
        this.satWet.gain.setTargetAtTime(norm * 0.6, now, 0.05);
        this.satDry.gain.setTargetAtTime(1 - norm * 0.4, now, 0.05);
        this.macroFilter.frequency.setTargetAtTime(
          1000 + norm * 7000, now, 0.05
        );
        // Enriched: Tighter amp attack at high energy (transient snap)
        // Modulate the waveshaper curve slope for sharper transients
        const transientDrive = 1.0 + norm * norm * 6.0; // quadratic for punch at high end
        this.setSatCurve(transientDrive);
        // Enriched: Filter Q boost for more presence/aggression
        this.macroFilter.Q.setTargetAtTime(0.5 + norm * 4.0, now, 0.05);
        break;
      }
      case 'divinity': {
        // ── Target: shimmer, chorusDepth, highAir, octaveLayer, harmonicExciter ──
        // Core: Reverb depth
        this.reverbSend.gain.setTargetAtTime(
          this.preset.reverbMix * (0.5 + norm), now, 0.05
        );
        // Core: High-frequency air boost
        this.macroFilter.gain.setTargetAtTime(norm * 6, now, 0.05);
        // Enriched: Shimmer via chorus depth modulation
        const shimmerDepth = this.preset.chorusDepth * (0.5 + norm * 1.5);
        this.chorusLfoGainL.gain.setTargetAtTime(shimmerDepth, now, 0.05);
        this.chorusLfoGainR.gain.setTargetAtTime(shimmerDepth * 1.15, now, 0.05);
        // Enriched: Chorus rate increase for sparkle at high divinity
        const shimmerRate = this.preset.chorusRate * (0.8 + norm * 0.8);
        this.chorusLfo.frequency.setTargetAtTime(shimmerRate, now, 0.08);
        // Enriched: Subtle chorus send increase for "halo layer" effect
        const hasSendNode = this.chorusSend?.gain;
        if (hasSendNode) {
          hasSendNode.setTargetAtTime(
            this.preset.chorusMix * (0.3 + norm * 0.7), now, 0.05
          );
        }
        break;
      }
      case 'width': {
        // ── Target: stereoWidth, microDelay, reverbWidth, chorusSpread, midside ──
        // Core: Stereo spread via mid/side balance
        this.widthSideGain.gain.setTargetAtTime(
          0.2 + norm * 0.8, now, 0.05
        );
        this.chorusSend.gain.setTargetAtTime(
          this.preset.chorusMix * (0.5 + norm), now, 0.05
        );
        // Enriched: Micro-delay spread on L/R for spatial depth
        const microDelayL = 0.003 + norm * 0.007; // 3ms → 10ms
        const microDelayR = 0.005 + norm * 0.009; // 5ms → 14ms (asymmetric for width)
        this.chorusDelayL.delayTime.setTargetAtTime(microDelayL, now, 0.08);
        this.chorusDelayR.delayTime.setTargetAtTime(microDelayR, now, 0.08);
        // Enriched: Mid-side rebalance — reduce mid, boost side at high width
        this.widthMidGain.gain.setTargetAtTime(1.0 - norm * 0.3, now, 0.05);
        break;
      }
      case 'realm': {
        // ── Target: realmFxBlend, textureLayer, fxChainMorph, visualState ──
        // Core: FM index deepening (character blend) — affects new notes via preset context
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const boostedIndex = this.preset.modIndex * (0.3 + norm * 1.5);
        // Enriched: Full FX chain blend — all sends scale proportionally
        const fxMix = 0.1 + norm * 0.5;
        this.reverbSend.gain.setTargetAtTime(
          this.preset.reverbMix * fxMix * 2, now, 0.08
        );
        this.delaySend.gain.setTargetAtTime(
          this.preset.delayMix * fxMix * 1.5, now, 0.08
        );
        this.chorusSend.gain.setTargetAtTime(
          this.preset.chorusMix * fxMix * 1.8, now, 0.08
        );
        // Enriched: Texture layer — saturation character shifts
        const textureAmt = norm * norm * 0.4; // quadratic for subtle → intense
        this.satWet.gain.setTargetAtTime(textureAmt, now, 0.08);
        this.satDry.gain.setTargetAtTime(1 - textureAmt * 0.5, now, 0.08);
        // Store realm intensity for UI visual state reactivity
        this._realmIntensity = norm;
        break;
      }
    }
  }

  /** Current realm intensity (0-1), exposed for UI visual reactivity */
  private _realmIntensity = 0;
  get realmIntensity(): number { return this._realmIntensity; }

  // ─── FX Slot Control ─────────────────────────────────────

  setFx(index: number, value: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const norm = value / 100;

    switch (index) {
      case 0: // Reverb
        this.reverbSend.gain.setTargetAtTime(norm * 0.6, now, 0.05);
        this.reverbReturn.gain.setTargetAtTime(norm * 0.6, now, 0.05);
        break;
      case 1: // Chorus
        this.chorusSend.gain.setTargetAtTime(norm * 0.5, now, 0.05);
        this.chorusReturn.gain.setTargetAtTime(norm * 0.5, now, 0.05);
        break;
      case 2: // Delay
        this.delaySend.gain.setTargetAtTime(norm * 0.5, now, 0.05);
        this.delayReturn.gain.setTargetAtTime(norm * 0.5, now, 0.05);
        break;
      case 3: // Saturation
        this.satWet.gain.setTargetAtTime(norm * 0.7, now, 0.05);
        this.satDry.gain.setTargetAtTime(1 - norm * 0.5, now, 0.05);
        break;
    }
  }

  // ─── Divine Morph ────────────────────────────────────────

  setMorph(fromGodId: string, toGodId: string, blend: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Initialize morph voices on first call or god change
    if (this.morphFromGod !== fromGodId || this.morphToGod !== toGodId) {
      this.disposeMorphVoices();
      this.morphFromGod = fromGodId;
      this.morphToGod = toGodId;

      this.morphMixer = this.ctx.createGain();
      this.morphMixer.gain.value = 0;
      this.morphMixer.connect(this.voiceMixer);

      const toPreset = GOD_VOICE_PRESETS[toGodId];
      if (toPreset) {
        for (let i = 0; i < this.VOICE_COUNT; i++) {
          const v = new PantheonVoice(this.ctx);
          v.applyPreset(toPreset);
          v.connect(this.morphMixer);
          this.morphVoices.push(v);
        }
      }
    }

    // Crossfade: blend 0 = all "from", 100 = all "to"
    this.morphBlend = blend / 100;
    this.voiceMixer.gain.setTargetAtTime(1 - this.morphBlend, now, 0.05);
    if (this.morphMixer) {
      this.morphMixer.gain.setTargetAtTime(this.morphBlend, now, 0.05);
    }
  }

  applyMorph(): void {
    // Finalize morph — make "to" god the active god
    if (this.morphToGod) {
      this.setGod(this.morphToGod);
    }
    this.disposeMorphVoices();
    this.voiceMixer.gain.value = 0.8;
    this.morphBlend = 0;
  }

  private disposeMorphVoices(): void {
    for (const v of this.morphVoices) {
      v.dispose();
    }
    this.morphVoices = [];
    if (this.morphMixer) {
      this.morphMixer.disconnect();
      this.morphMixer = null;
    }
    this.morphFromGod = '';
    this.morphToGod = '';
  }

  // ─── Analysis ───────────────────────────────────────────

  /**
   * Returns a snapshot of real-time audio analysis data.
   * Designed to be called from a requestAnimationFrame loop (~30fps).
   * CPU cost: negligible — reads pre-computed FFT data from the AnalyserNode.
   */
  getAnalysisData(): PantheonAnalysisData {
    const empty: PantheonAnalysisData = {
      rms: 0, peak: 0,
      spectralBands: { body: 0, soul: 0, air: 0, silk: 0 },
      isActive: false, activeVoiceCount: 0,
    };
    if (!this.ctx || !this.analyser) return empty;

    // Count active voices
    const activeVoiceCount = this.voices.filter(v => v.active).length;
    const isActive = activeVoiceCount > 0;

    // Time-domain → RMS + Peak
    this.analyser.getByteTimeDomainData(this.analyserTimeData);
    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < this.analyserTimeData.length; i++) {
      const sample = (this.analyserTimeData[i] - 128) / 128; // normalize to -1..1
      sumSq += sample * sample;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
    }
    const rms = Math.sqrt(sumSq / this.analyserTimeData.length);

    // Frequency-domain → Four Anchors spectral bands
    this.analyser.getByteFrequencyData(this.analyserFreqData);
    const sampleRate = this.ctx.sampleRate;
    const binCount = this.analyser.frequencyBinCount;
    const binHz = sampleRate / (binCount * 2);

    // Band boundaries in bin indices
    const bodyEnd = Math.min(Math.floor(200 / binHz), binCount);
    const soulEnd = Math.min(Math.floor(2000 / binHz), binCount);
    const airEnd = Math.min(Math.floor(8000 / binHz), binCount);
    const silkEnd = Math.min(Math.floor(20000 / binHz), binCount);

    const bandAvg = (start: number, end: number): number => {
      if (end <= start) return 0;
      let sum = 0;
      for (let i = start; i < end; i++) sum += this.analyserFreqData[i];
      return (sum / (end - start)) / 255; // normalize to 0..1
    };

    const spectralBands = {
      body: bandAvg(0, bodyEnd),
      soul: bandAvg(bodyEnd, soulEnd),
      air:  bandAvg(soulEnd, airEnd),
      silk: bandAvg(airEnd, silkEnd),
    };

    return {
      rms: Math.min(rms * 2.5, 1),  // scale up for visual presence
      peak: Math.min(peak * 2, 1),
      spectralBands,
      isActive,
      activeVoiceCount,
    };
  }

  /**
   * Returns raw time-domain waveform data for oscilloscope rendering.
   * Returns Float32Array of values in range -1..1.
   * Designed for direct canvas drawing at display refresh rate.
   */
  getTimeDomainData(): Float32Array {
    const empty = new Float32Array(0);
    if (!this.ctx || !this.analyser) return empty;

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    return buffer;
  }

  // ─── Lifecycle ───────────────────────────────────────────

  dispose(): void {
    for (const v of this.voices) v.dispose();
    this.disposeMorphVoices();
    this.voices = [];
    try {
      this.vibratoLfo?.stop();
      this.chorusLfo?.stop();
    } catch { /* ok */ }
    this.analyser?.disconnect();
    this.masterGain?.disconnect();
    this.ctx = null;
  }
}
