/**
 * FXRack.ts — Real-Time WebAudio FX Send/Return Rack for the Sacred Sequencer.
 * 
 * Architecture: FL Studio-style per-track send routing.
 * Each track creates its own set of send GainNodes that feed into 4 global FX buses:
 *   1. Reverb  (ConvolverNode with synthetic IR)
 *   2. Chorus  (Stereo LFO-modulated delay)
 *   3. Delay   (Tempo-synced feedback delay with LP filter)
 *   4. Saturation (WaveShaperNode with tanh curve, 2x oversample)
 *
 * Usage:
 *   const rack = new FXRack(ctx, masterChain.input);
 *   const sends = rack.createTrackSends();
 *   source.connect(sends.dry);        // dry signal → master
 *   source.connect(sends.reverb);     // reverb send
 *   sends.reverb.gain.value = 0.5;    // 50% reverb send
 *   ...
 *   rack.updateBPM(140);              // sync delay time
 *   rack.dispose();
 */

/* ═══ Types ═══ */

/** Per-track send node set — one dry + four effect sends + metering */
export interface TrackSendNodes {
  /** Direct path to master (no FX processing) */
  dry: GainNode;
  /** Send to reverb bus */
  reverb: GainNode;
  /** Send to chorus bus */
  chorus: GainNode;
  /** Send to delay bus */
  delay: GainNode;
  /** Send to saturation bus */
  saturation: GainNode;
  /** Per-track metering analyser */
  analyser: AnalyserNode;
  /** 3-band EQ input — connect sources here instead of dry */
  eqInput: GainNode;
  /** EQ nodes for parameter control */
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  /** Sidechain compressor (inserted after EQ) */
  compressor: DynamicsCompressorNode;
  /** Compressor bypass — when true, signal goes direct from EQ to sends */
  compressorBypass: boolean;
  /** Post-EQ node — EQ output merges here before dry/sends */
  postEQ: GainNode;
}

/** Track level data from analyser */
export interface TrackLevel {
  peak: number;  // 0–1 normalized
  rms: number;   // 0–1 normalized
}

/** Snapshot of all tweakable FX rack parameters */
export interface FXRackParams {
  reverbDecay: number;
  reverbReturn: number;
  chorusRate: number;
  chorusDepth: number;
  chorusReturn: number;
  delayFeedback: number;
  delayFilterFreq: number;
  delayReturn: number;
  satDrive: number;
  satMix: number;
  satReturn: number;
}

/* ═══ FXRack Class ═══ */

export class FXRack {
  private ctx: BaseAudioContext;
  
  // ─── Global FX Bus Inputs (tracks connect sends here) ───
  private reverbBus: GainNode;
  private chorusBus: GainNode;
  private delayBus: GainNode;
  private satBus: GainNode;

  // ─── Reverb ───
  private reverbConvolver: ConvolverNode;
  private reverbReturn: GainNode;
  private reverbDecayTime: number = 2.5;

  // ─── Chorus ───
  private chorusDelayL: DelayNode;
  private chorusDelayR: DelayNode;
  private chorusLfo: OscillatorNode;
  private chorusLfoGainL: GainNode;
  private chorusLfoGainR: GainNode;
  private chorusReturn: GainNode;

  // ─── Delay ───
  private delayNode: DelayNode;
  private delayFeedback: GainNode;
  private delayReturn: GainNode;
  private delayFilter: BiquadFilterNode;

  // ─── Saturation ───
  private satShaper: WaveShaperNode;
  private satDry: GainNode;
  private satWet: GainNode;
  private satReturn: GainNode;
  private satDriveAmount: number = 2.0;

  // ─── I/O ───
  /** Master dry bus — tracks connect their dry path here */
  public readonly dryBus: GainNode;
  /** Final output — connect this to MasterChain.input */
  public readonly output: GainNode;
  /** Track send node sets — keyed by a unique id (typically trackIndex) */
  private trackSends: Map<number, TrackSendNodes> = new Map();
  /** Reusable buffer for analyser readings */
  private _analyserBuf: Uint8Array | null = null;

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
    this.ctx = ctx;

    // ─── Output ───
    this.output = ctx.createGain();
    this.output.gain.value = 1.0;
    this.output.connect(destination);

    // ─── Dry Bus (all tracks' dry signals merge here) ───
    this.dryBus = ctx.createGain();
    this.dryBus.gain.value = 1.0;
    this.dryBus.connect(this.output);

    // ─── Global FX Bus Inputs ───
    this.reverbBus = ctx.createGain();
    this.reverbBus.gain.value = 1.0;
    this.chorusBus = ctx.createGain();
    this.chorusBus.gain.value = 1.0;
    this.delayBus = ctx.createGain();
    this.delayBus.gain.value = 1.0;
    this.satBus = ctx.createGain();
    this.satBus.gain.value = 1.0;

    // ═══ Build FX Chains ═══

    // ─── Reverb ───
    this.reverbConvolver = this.buildReverb();
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.7;
    this.reverbBus.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbReturn);
    this.reverbReturn.connect(this.output);

    // ─── Chorus ───
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

    const chorusMerger = ctx.createChannelMerger(2);
    this.chorusBus.connect(this.chorusDelayL);
    this.chorusBus.connect(this.chorusDelayR);
    this.chorusDelayL.connect(chorusMerger, 0, 0);
    this.chorusDelayR.connect(chorusMerger, 0, 1);

    this.chorusReturn = ctx.createGain();
    this.chorusReturn.gain.value = 0.6;
    chorusMerger.connect(this.chorusReturn);
    this.chorusReturn.connect(this.output);

    // Start LFO
    if (ctx instanceof AudioContext) {
      this.chorusLfo.start();
    } else {
      // OfflineAudioContext — start at t=0
      this.chorusLfo.start(0);
    }

    // ─── Delay ───
    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.375; // dotted eighth at 120 BPM default

    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.35;

    // Feedback filter (darken repeats like analog)
    this.delayFilter = ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.value = 4000;
    this.delayFilter.Q.value = 0.5;

    this.delayReturn = ctx.createGain();
    this.delayReturn.gain.value = 0.6;

    this.delayBus.connect(this.delayNode);
    this.delayNode.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode); // feedback loop
    this.delayNode.connect(this.delayReturn);
    this.delayReturn.connect(this.output);

    // ─── Saturation ───
    this.satShaper = ctx.createWaveShaper();
    this.satShaper.oversample = '2x';
    this.setSatCurve(2.0);

    this.satDry = ctx.createGain();
    this.satDry.gain.value = 0.7;
    this.satWet = ctx.createGain();
    this.satWet.gain.value = 0.3;

    this.satReturn = ctx.createGain();
    this.satReturn.gain.value = 0.5;

    this.satBus.connect(this.satShaper);
    this.satShaper.connect(this.satWet);
    this.satBus.connect(this.satDry);

    const satMerge = ctx.createGain();
    this.satDry.connect(satMerge);
    this.satWet.connect(satMerge);
    satMerge.connect(this.satReturn);
    this.satReturn.connect(this.output);
  }

  // ═══ Per-Track Send Factory ═══

  /**
   * Creates a set of per-track send GainNodes.
   * Each track gets its own dry, reverb, chorus, delay, and saturation sends.
   * The send levels are controlled independently per track.
   *
   * @param trackId Unique track identifier (typically the track index)
   * @param initialSends Initial send levels (0-100 scale)
   */
  createTrackSends(
    trackId: number,
    initialSends?: { reverb?: number; chorus?: number; delay?: number; saturation?: number }
  ): TrackSendNodes {
    // Reuse existing sends if already created
    const existing = this.trackSends.get(trackId);
    if (existing) return existing;

    const ctx = this.ctx;

    // ── 3-Band EQ Chain (input → lowshelf → peaking → highshelf → dry/sends) ──
    const eqInput = ctx.createGain();
    eqInput.gain.value = 1.0;

    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;
    eqLow.gain.value = 0; // ±12 dB range

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 0.7;
    eqMid.gain.value = 0;

    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;
    eqHigh.gain.value = 0;

    // Chain: eqInput → eqLow → eqMid → eqHigh → (dry, reverb, chorus, delay, sat, analyser)
    eqInput.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);

    // Compressor (after EQ, before sends)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 10;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    // postEQ is the final routing point before sends
    const postEQ = ctx.createGain();
    postEQ.gain.value = 1.0;

    // Default: bypassed (EQ → postEQ directly)
    eqHigh.connect(postEQ);

    const dry = ctx.createGain();
    dry.gain.value = 1.0;
    postEQ.connect(dry);
    dry.connect(this.dryBus);

    const reverb = ctx.createGain();
    reverb.gain.value = ((initialSends?.reverb ?? 0) / 100) * 0.6;
    postEQ.connect(reverb);
    reverb.connect(this.reverbBus);

    const chorus = ctx.createGain();
    chorus.gain.value = ((initialSends?.chorus ?? 0) / 100) * 0.5;
    postEQ.connect(chorus);
    chorus.connect(this.chorusBus);

    const delay = ctx.createGain();
    delay.gain.value = ((initialSends?.delay ?? 0) / 100) * 0.5;
    postEQ.connect(delay);
    delay.connect(this.delayBus);

    const saturation = ctx.createGain();
    saturation.gain.value = ((initialSends?.saturation ?? 0) / 100) * 0.5;
    postEQ.connect(saturation);
    saturation.connect(this.satBus);

    // Per-track metering analyser (small FFT for peak detection)
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.4;
    dry.connect(analyser);

    const sends: TrackSendNodes = {
      dry, reverb, chorus, delay, saturation, analyser,
      eqInput, eqLow, eqMid, eqHigh,
      compressor, compressorBypass: true, postEQ,
    };
    this.trackSends.set(trackId, sends);
    return sends;
  }

  /**
   * Update a specific track's send levels (0-100 scale).
   * Uses exponential ramping for smooth transitions.
   */
  updateTrackSends(
    trackId: number,
    levels: { reverb: number; chorus: number; delay: number; saturation: number }
  ): void {
    const sends = this.trackSends.get(trackId);
    if (!sends) return;

    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    const ramp = 0.05;

    sends.reverb.gain.setTargetAtTime((levels.reverb / 100) * 0.6, t, ramp);
    sends.chorus.gain.setTargetAtTime((levels.chorus / 100) * 0.5, t, ramp);
    sends.delay.gain.setTargetAtTime((levels.delay / 100) * 0.5, t, ramp);
    sends.saturation.gain.setTargetAtTime((levels.saturation / 100) * 0.5, t, ramp);
  }

  /**
   * Update a track's 3-band EQ gains (in dB, -12 to +12).
   */
  updateTrackEQ(
    trackId: number,
    eq: { low: number; mid: number; high: number }
  ): void {
    const sends = this.trackSends.get(trackId);
    if (!sends) return;

    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    const ramp = 0.03;

    sends.eqLow.gain.setTargetAtTime(Math.max(-12, Math.min(12, eq.low)), t, ramp);
    sends.eqMid.gain.setTargetAtTime(Math.max(-12, Math.min(12, eq.mid)), t, ramp);
    sends.eqHigh.gain.setTargetAtTime(Math.max(-12, Math.min(12, eq.high)), t, ramp);
  }

  /**
   * Remove a track's send nodes (on track deletion).
   */
  removeTrackSends(trackId: number): void {
    const sends = this.trackSends.get(trackId);
    if (!sends) return;

    [sends.dry, sends.reverb, sends.chorus, sends.delay, sends.saturation, sends.analyser,
     sends.eqInput, sends.eqLow, sends.eqMid, sends.eqHigh,
     sends.compressor, sends.postEQ].forEach(n => {
      try { n.disconnect(); } catch { /* ok */ }
    });
    this.trackSends.delete(trackId);
  }

  /**
   * Enable/disable the compressor for a track.
   * When enabled: eqHigh → compressor → postEQ
   * When bypassed: eqHigh → postEQ (direct)
   */
  setCompressorEnabled(trackId: number, enabled: boolean): void {
    const sends = this.trackSends.get(trackId);
    if (!sends) return;
    if (sends.compressorBypass === !enabled) return; // no change

    try { sends.eqHigh.disconnect(sends.postEQ); } catch { /* ok */ }
    try { sends.eqHigh.disconnect(sends.compressor); } catch { /* ok */ }
    try { sends.compressor.disconnect(sends.postEQ); } catch { /* ok */ }

    if (enabled) {
      // Route through compressor
      sends.eqHigh.connect(sends.compressor);
      sends.compressor.connect(sends.postEQ);
    } else {
      // Bypass: direct from EQ to postEQ
      sends.eqHigh.connect(sends.postEQ);
    }
    sends.compressorBypass = !enabled;
  }

  /**
   * Update compressor parameters for a track.
   */
  updateTrackCompressor(
    trackId: number,
    params: { threshold?: number; ratio?: number; attack?: number; release?: number }
  ): void {
    const sends = this.trackSends.get(trackId);
    if (!sends) return;

    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    const ramp = 0.03;

    if (params.threshold !== undefined)
      sends.compressor.threshold.setTargetAtTime(params.threshold, t, ramp);
    if (params.ratio !== undefined)
      sends.compressor.ratio.setTargetAtTime(params.ratio, t, ramp);
    if (params.attack !== undefined)
      sends.compressor.attack.setTargetAtTime(params.attack, t, ramp);
    if (params.release !== undefined)
      sends.compressor.release.setTargetAtTime(params.release, t, ramp);
  }

  /**
   * Get current compressor gain reduction (in dB) for metering.
   */
  getCompressorReduction(trackId: number): number {
    const sends = this.trackSends.get(trackId);
    if (!sends || sends.compressorBypass) return 0;
    return sends.compressor.reduction; // negative dB
  }

  // ═══ Metering ═══

  /**
   * Get peak and RMS levels for a single track.
   */
  getTrackLevel(trackId: number): TrackLevel {
    const sends = this.trackSends.get(trackId);
    if (!sends) return { peak: 0, rms: 0 };

    const analyser = sends.analyser;
    const bufLen = analyser.frequencyBinCount;
    if (!this._analyserBuf || this._analyserBuf.length < bufLen) {
      this._analyserBuf = new Uint8Array(bufLen);
    }
    analyser.getByteTimeDomainData(this._analyserBuf);

    let peak = 0;
    let sumSq = 0;
    for (let i = 0; i < bufLen; i++) {
      const sample = (this._analyserBuf[i] - 128) / 128; // normalize to -1..1
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
      sumSq += sample * sample;
    }
    const rms = Math.sqrt(sumSq / bufLen);
    return { peak: Math.min(1, peak), rms: Math.min(1, rms) };
  }

  /**
   * Get levels for all tracks in a single call (avoids per-track map lookups).
   */
  getAllTrackLevels(): Map<number, TrackLevel> {
    const result = new Map<number, TrackLevel>();
    this.trackSends.forEach((_, trackId) => {
      result.set(trackId, this.getTrackLevel(trackId));
    });
    return result;
  }

  // ═══ Global Controls ═══

  /**
   * Update tempo-synced delay time.
   */
  updateBPM(bpm: number): void {
    if (bpm <= 0) return;
    const dottedEighth = (60 / bpm) * 0.75;
    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    this.delayNode.delayTime.setTargetAtTime(Math.min(dottedEighth, 1.5), t, 0.05);
  }

  // ═══ FX Parameter Controls ═══

  /** Rebuild reverb IR with new decay time (0.5–8s) */
  setReverbDecay(seconds: number): void {
    this.reverbDecayTime = Math.max(0.5, Math.min(8, seconds));
    this.reverbConvolver.buffer = this.createIR(this.reverbDecayTime);
  }

  /** Set reverb return level (0–1) */
  setReverbReturn(level: number): void {
    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    this.reverbReturn.gain.setTargetAtTime(Math.max(0, Math.min(1, level)), t, 0.05);
  }

  /** Set chorus LFO rate in Hz (0.1–5) */
  setChorusRate(hz: number): void {
    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    this.chorusLfo.frequency.setTargetAtTime(Math.max(0.1, Math.min(5, hz)), t, 0.05);
  }

  /** Set chorus modulation depth in seconds (0.001–0.015) */
  setChorusDepth(depthMs: number): void {
    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    const depthSec = Math.max(0.001, Math.min(0.015, depthMs / 1000));
    this.chorusLfoGainL.gain.setTargetAtTime(depthSec, t, 0.05);
    this.chorusLfoGainR.gain.setTargetAtTime(depthSec, t, 0.05);
  }

  /** Set chorus return level (0–1) */
  setChorusReturn(level: number): void {
    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    this.chorusReturn.gain.setTargetAtTime(Math.max(0, Math.min(1, level)), t, 0.05);
  }

  /** Set delay feedback amount (0–0.9) */
  setDelayFeedback(amount: number): void {
    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    this.delayFeedback.gain.setTargetAtTime(Math.max(0, Math.min(0.9, amount)), t, 0.05);
  }

  /** Set delay LP filter cutoff frequency (500–12000 Hz) */
  setDelayFilterFreq(hz: number): void {
    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    this.delayFilter.frequency.setTargetAtTime(Math.max(500, Math.min(12000, hz)), t, 0.05);
  }

  /** Set delay return level (0–1) */
  setDelayReturn(level: number): void {
    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    this.delayReturn.gain.setTargetAtTime(Math.max(0, Math.min(1, level)), t, 0.05);
  }

  /** Set saturation drive amount (0.5–8) and regenerate curve */
  setSatDrive(drive: number): void {
    this.satDriveAmount = Math.max(0.5, Math.min(8, drive));
    this.setSatCurve(this.satDriveAmount);
  }

  /** Set saturation dry/wet mix (0–1, where 1 = fully wet) */
  setSatMix(mix: number): void {
    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    const wet = Math.max(0, Math.min(1, mix));
    this.satWet.gain.setTargetAtTime(wet, t, 0.05);
    this.satDry.gain.setTargetAtTime(1 - wet, t, 0.05);
  }

  /** Set saturation return level (0–1) */
  setSatReturn(level: number): void {
    const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
    this.satReturn.gain.setTargetAtTime(Math.max(0, Math.min(1, level)), t, 0.05);
  }

  /** Get current FX parameter snapshot */
  getParams(): FXRackParams {
    return {
      reverbDecay: this.reverbDecayTime,
      reverbReturn: this.reverbReturn.gain.value,
      chorusRate: this.chorusLfo.frequency.value,
      chorusDepth: this.chorusLfoGainL.gain.value * 1000, // to ms
      chorusReturn: this.chorusReturn.gain.value,
      delayFeedback: this.delayFeedback.gain.value,
      delayFilterFreq: this.delayFilter.frequency.value,
      delayReturn: this.delayReturn.gain.value,
      satDrive: this.satDriveAmount,
      satMix: this.satWet.gain.value,
      satReturn: this.satReturn.gain.value,
    };
  }

  // ═══ Internal Builders ═══

  private buildReverb(): ConvolverNode {
    const conv = this.ctx.createConvolver();
    conv.buffer = this.createIR(2.5);
    return conv;
  }

  private createIR(decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * decay);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
      }
    }
    return buf;
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

  // ═══ Cleanup ═══

  dispose(): void {
    try { this.chorusLfo.stop(); } catch { /* already stopped */ }

    // Disconnect all track sends
    this.trackSends.forEach((sends) => {
      [sends.dry, sends.reverb, sends.chorus, sends.delay, sends.saturation, sends.analyser].forEach(n => {
        try { n.disconnect(); } catch { /* ok */ }
      });
    });
    this.trackSends.clear();

    // Disconnect all internal nodes
    [
      this.output, this.dryBus,
      this.reverbBus, this.reverbReturn, this.reverbConvolver,
      this.chorusBus, this.chorusReturn, this.chorusDelayL, this.chorusDelayR,
      this.chorusLfoGainL, this.chorusLfoGainR,
      this.delayBus, this.delayReturn, this.delayNode, this.delayFeedback, this.delayFilter,
      this.satBus, this.satReturn, this.satShaper, this.satDry, this.satWet,
    ].forEach(node => {
      try { node.disconnect(); } catch { /* ok */ }
    });
  }
}
