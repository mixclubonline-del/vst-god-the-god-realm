/**
 * VST God Forge — WebAudio Live Preview Engine
 * Mirrors the DSP routing chain using Web Audio API nodes for real-time
 * in-browser auditioning before exporting to JUCE C++.
 *
 * Module Mapping:
 *   EQ         → BiquadFilterNode (lowpass)
 *   Compressor → DynamicsCompressorNode
 *   Distortion → WaveShaperNode (tanh curve)
 *   Chorus     → LFO-modulated DelayNode
 *   Delay      → DelayNode + GainNode feedback loop
 *   Reverb     → ConvolverNode (synthetic IR)
 *   Limiter    → DynamicsCompressorNode (ratio=20, knee=0)
 *   Gain       → GainNode
 *   Phaser     → Cascaded allpass BiquadFilterNodes
 */

import type { DSPChainModule, DSPModuleType } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TestToneType = 'sine' | 'pink_noise' | 'white_noise' | 'file';

interface ModuleNode {
  instanceId: string;
  type: DSPModuleType;
  inputNode: AudioNode;
  outputNode: AudioNode;
  bypassed: boolean;
  /** Internal gain for the processed path */
  wetGain: GainNode;
  /** Internal gain for the bypass path */
  dryGain: GainNode;
  /** Reference to all internal nodes for parameter control */
  internals: Record<string, AudioNode | AudioParam>;
}

export interface PreviewState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLooping: boolean;
}

// ─── Synthetic Impulse Response ─────────────────────────────────────────────

function generateSyntheticIR(ctx: AudioContext, duration = 2.0, decay = 3.0): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      // Exponentially decaying noise with slight stereo variation
      data[i] = (Math.random() * 2 - 1) * Math.exp(-decay * t) * (ch === 0 ? 1.0 : 0.95);
    }
  }

  return buffer;
}

// ─── WaveShaper Curve ───────────────────────────────────────────────────────

function makeTanhCurve(amount: number = 1.0, samples: number = 4096): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

// ─── Test Tone Generators ───────────────────────────────────────────────────

function createTestToneBuffer(ctx: AudioContext, type: TestToneType, duration = 4.0): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);

    switch (type) {
      case 'sine': {
        // 440Hz sine wave with gentle amplitude envelope
        const freq = 440;
        for (let i = 0; i < length; i++) {
          const t = i / ctx.sampleRate;
          const env = Math.min(1, t * 20) * Math.min(1, (duration - t) * 20);
          data[i] = Math.sin(2 * Math.PI * freq * t) * 0.5 * env;
        }
        break;
      }
      case 'white_noise': {
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }
        break;
      }
      case 'pink_noise': {
        // Paul Kellet's pink noise algorithm
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
          b6 = white * 0.115926;
        }
        break;
      }
      default:
        break;
    }
  }

  return buffer;
}

// ─── Chain Preview Engine ───────────────────────────────────────────────────

export class ChainPreviewEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private moduleNodes: ModuleNode[] = [];
  private analyserNode: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private irBuffer: AudioBuffer | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private _detuneCents = 0;
  private _masterVolume = 0.8;

  private _isPlaying = false;
  private _isLooping = true;
  private _chain: DSPChainModule[] = [];

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.ctx) {
      console.log('[ChainPreview] init() — already initialized, ctx.state:', this.ctx.state);
      // Resume if suspended (browser autoplay policy)
      if (this.ctx.state === 'suspended') {
        console.log('[ChainPreview] Resuming suspended AudioContext...');
        await this.ctx.resume();
        console.log('[ChainPreview] AudioContext resumed, state:', this.ctx.state);
      }
      return;
    }
    this.ctx = new AudioContext();
    console.log('[ChainPreview] init() — new AudioContext created, state:', this.ctx.state, 'sampleRate:', this.ctx.sampleRate);
    
    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      console.log('[ChainPreview] Resuming suspended AudioContext...');
      await this.ctx.resume();
      console.log('[ChainPreview] AudioContext resumed, state:', this.ctx.state);
    }
    
    this.irBuffer = generateSyntheticIR(this.ctx, 2.5, 2.8);
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._masterVolume;
    console.log('[ChainPreview] masterGain value:', this._masterVolume);
    this.masterGain.connect(this.analyserNode);
    this.analyserNode.connect(this.ctx.destination);
    console.log('[ChainPreview] Signal chain: masterGain → analyser → destination ✓');
  }

  dispose(): void {
    this.stop();
    this.teardownGraph();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  // ── Analyser Access ───────────────────────────────────────────────────────

  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(data);
    return data;
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  // ── Chain Management ──────────────────────────────────────────────────────

  buildGraph(chain: DSPChainModule[]): void {
    if (!this.ctx || !this.masterGain) {
      console.warn('[ChainPreview] buildGraph() — ctx or masterGain missing!', { ctx: !!this.ctx, masterGain: !!this.masterGain });
      return;
    }
    this.teardownGraph();
    this._chain = chain;

    console.log(`[ChainPreview] buildGraph() — building ${chain.length} modules:`, chain.map(m => `${m.type}(${m.instanceId}, bypassed=${m.bypassed})`));

    // Build nodes for each module
    for (const mod of chain) {
      const moduleNode = this.createModuleNode(mod);
      if (moduleNode) {
        this.moduleNodes.push(moduleNode);
      }
    }

    // Wire nodes in series: node[0].output → node[1].input → ... → masterGain
    for (let i = 0; i < this.moduleNodes.length - 1; i++) {
      this.moduleNodes[i].outputNode.connect(this.moduleNodes[i + 1].inputNode);
    }

    // Last node → master gain
    if (this.moduleNodes.length > 0) {
      this.moduleNodes[this.moduleNodes.length - 1].outputNode.connect(this.masterGain);
      console.log('[ChainPreview] Graph wired: source → [modules] → masterGain → analyser → destination ✓');
    } else {
      console.log('[ChainPreview] No modules — source will connect directly to masterGain');
    }
  }

  private teardownGraph(): void {
    for (const mn of this.moduleNodes) {
      try {
        mn.inputNode.disconnect();
        mn.outputNode.disconnect();
        mn.wetGain.disconnect();
        mn.dryGain.disconnect();
        
        // Disconnect processor internal nodes
        for (const internal of Object.values(mn.internals)) {
          if (internal instanceof AudioNode) {
            try { internal.disconnect(); } catch (_e) { /* ok */ }
          }
        }
      } catch (_e) { /* ignore already disconnected */ }
    }
    this.moduleNodes = [];
  }

  private getChainInput(): AudioNode | null {
    if (this.moduleNodes.length > 0) return this.moduleNodes[0].inputNode;
    return this.masterGain;
  }

  // ─── Module Node Factory ──────────────────────────────────────────────────

  private createModuleNode(mod: DSPChainModule): ModuleNode | null {
    if (!this.ctx) return null;
    const ctx = this.ctx;

    // Standard Bypass Wrapper Nodes
    const inputNode = ctx.createGain(); // Splitter
    const outputNode = ctx.createGain(); // Merger
    const wetGain = ctx.createGain();
    const dryGain = ctx.createGain();

    // Initial state based on bypass
    wetGain.gain.value = mod.bypassed ? 0.0 : 1.0;
    dryGain.gain.value = mod.bypassed ? 1.0 : 0.0;

    inputNode.connect(wetGain);
    inputNode.connect(dryGain);
    dryGain.connect(outputNode);

    const internals: Record<string, AudioNode | AudioParam> = {};
    let processorInput: AudioNode | null = null;
    let processorOutput: AudioNode | null = null;

    switch (mod.type) {
      case 'eq': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 4000;
        filter.Q.value = 0.707;
        processorInput = filter;
        processorOutput = filter;
        internals['filter'] = filter;
        internals['frequency'] = filter.frequency;
        internals['resonance'] = filter.Q;
        internals['Q'] = filter.Q;
        break;
      }

      case 'compressor': {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.ratio.value = 4;
        comp.attack.value = 0.005;
        comp.release.value = 0.05;
        processorInput = comp;
        processorOutput = comp;
        internals['compressor'] = comp;
        internals['threshold'] = comp.threshold;
        internals['ratio'] = comp.ratio;
        internals['attack'] = comp.attack;
        internals['release'] = comp.release;
        break;
      }

      case 'distortion': {
        const preGain = ctx.createGain();
        preGain.gain.value = 1.0;
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeTanhCurve(2.0);
        shaper.oversample = '4x';
        const postGain = ctx.createGain();
        postGain.gain.value = 0.7;
        preGain.connect(shaper);
        shaper.connect(postGain);
        processorInput = preGain;
        processorOutput = postGain;
        internals['preGain'] = preGain;
        internals['shaper'] = shaper;
        internals['postGain'] = postGain;
        internals['drive'] = preGain.gain;
        break;
      }

      case 'chorus': {
        const chorusDelay = ctx.createDelay(0.1);
        chorusDelay.delayTime.value = 0.015;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 1.0;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.005;
        lfo.connect(lfoGain);
        lfoGain.connect(chorusDelay.delayTime);
        lfo.start();

        processorInput = chorusDelay;
        processorOutput = chorusDelay;
        internals['lfo'] = lfo;
        internals['lfoRate'] = lfo.frequency;
        internals['lfoGain'] = lfoGain;
        internals['delay'] = chorusDelay;
        break;
      }

      case 'delay': {
        const delay = ctx.createDelay(2.0);
        delay.delayTime.value = 0.35;
        const feedbackGain = ctx.createGain();
        feedbackGain.gain.value = 0.3;

        const delayInput = ctx.createGain();
        delayInput.connect(delay);
        delay.connect(feedbackGain);
        feedbackGain.connect(delay);

        processorInput = delayInput;
        processorOutput = delay;
        internals['delay'] = delay;
        internals['delayTime'] = delay.delayTime;
        internals['feedback'] = feedbackGain.gain;
        break;
      }

      case 'reverb': {
        if (this.irBuffer) {
          const convolver = ctx.createConvolver();
          convolver.buffer = this.irBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 12000;
          convolver.connect(filter);
          processorInput = convolver;
          processorOutput = filter;
          internals['convolver'] = convolver;
          internals['filter'] = filter;
          internals['frequency'] = filter.frequency;
        } else {
          processorInput = ctx.createGain();
          processorOutput = processorInput;
        }
        break;
      }

      case 'limiter': {
        const lim = ctx.createDynamicsCompressor();
        lim.threshold.value = -1;
        lim.ratio.value = 20;
        lim.knee.value = 0;
        lim.attack.value = 0.001;
        lim.release.value = 0.1;
        processorInput = lim;
        processorOutput = lim;
        internals['limiter'] = lim;
        internals['threshold'] = lim.threshold;
        break;
      }

      case 'gain': {
        const g = ctx.createGain();
        g.gain.value = 1.0;
        processorInput = g;
        processorOutput = g;
        internals['gain'] = g.gain;
        break;
      }

      case 'phaser': {
        const ap1 = ctx.createBiquadFilter(); ap1.type = 'allpass';
        const ap2 = ctx.createBiquadFilter(); ap2.type = 'allpass';
        const ap3 = ctx.createBiquadFilter(); ap3.type = 'allpass';
        const ap4 = ctx.createBiquadFilter(); ap4.type = 'allpass';
        
        ap1.connect(ap2); ap2.connect(ap3); ap3.connect(ap4);
        
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.5;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 500;
        lfo.connect(lfoGain);
        lfoGain.connect(ap1.frequency);
        lfoGain.connect(ap2.frequency);
        lfoGain.connect(ap3.frequency);
        lfoGain.connect(ap4.frequency);
        lfo.start();

        processorInput = ap1;
        processorOutput = ap4;
        internals['lfo'] = lfo;
        internals['lfoRate'] = lfo.frequency;
        break;
      }

      default: {
        processorInput = ctx.createGain();
        processorOutput = processorInput;
      }
    }

    // Connect standard wrapper to processor
    if (processorInput && processorOutput) {
      wetGain.connect(processorInput);
      processorOutput.connect(outputNode);
    }

    // Expose wrapper gains to internals for mix control
    internals['wetGain'] = wetGain.gain;
    internals['dryGain'] = dryGain.gain;

    return {
      instanceId: mod.instanceId,
      type: mod.type,
      inputNode,
      outputNode,
      wetGain,
      dryGain,
      bypassed: mod.bypassed,
      internals,
    };
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  async loadTestTone(type: TestToneType): Promise<void> {
    console.log('[ChainPreview] loadTestTone():', type);
    await this.init();
    if (!this.ctx) return;
    this.currentBuffer = createTestToneBuffer(this.ctx, type, 6.0);
    console.log('[ChainPreview] Test tone buffer created:', {
      duration: this.currentBuffer.duration.toFixed(2) + 's',
      channels: this.currentBuffer.numberOfChannels,
      sampleRate: this.currentBuffer.sampleRate,
      length: this.currentBuffer.length
    });
  }

  async loadAudioFile(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    await this.loadAudioBuffer(arrayBuffer);
  }

  async loadAudioBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
    await this.init();
    if (!this.ctx) return;
    this.currentBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0)); // slice to avoid transfer issues
  }

  play(): void {
    console.log('[ChainPreview] play() called', {
      hasCtx: !!this.ctx,
      ctxState: this.ctx?.state,
      hasBuffer: !!this.currentBuffer,
      bufferDuration: this.currentBuffer?.duration,
      isPlaying: this._isPlaying,
      moduleCount: this.moduleNodes.length,
      masterGainValue: this.masterGain?.gain.value
    });

    if (!this.ctx || !this.currentBuffer || this._isPlaying) {
      console.warn('[ChainPreview] play() ABORTED —', 
        !this.ctx ? 'no AudioContext' : 
        !this.currentBuffer ? 'no buffer loaded' : 
        'already playing');
      return;
    }

    // Ensure context is running
    if (this.ctx.state === 'suspended') {
      console.log('[ChainPreview] Resuming suspended context before play...');
      this.ctx.resume();
    }

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.currentBuffer;
    this.sourceNode.loop = this._isLooping;
    this.sourceNode.detune.value = this._detuneCents;

    const chainInput = this.getChainInput();
    if (chainInput) {
      this.sourceNode.connect(chainInput);
      console.log('[ChainPreview] ✓ Source connected to chain input');
    } else {
      console.error('[ChainPreview] ✗ NO chain input available — audio will not be routed!');
    }

    this.sourceNode.onended = () => {
      console.log('[ChainPreview] Source playback ended');
      this._isPlaying = false;
    };

    this.sourceNode.start();
    this._isPlaying = true;
    console.log('[ChainPreview] ▶ Playback started! Context state:', this.ctx.state);
  }

  stop(): void {
    if (this.sourceNode) {
      try {
        // Null out onended BEFORE stopping to prevent stale callbacks
        // from clobbering _isPlaying after a new source starts
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (_e) { /* may already be stopped */ }
      this.sourceNode = null;
    }
    this._isPlaying = false;
    console.log('[ChainPreview] ⏹ Stopped');
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  set loop(val: boolean) {
    this._isLooping = val;
    if (this.sourceNode) {
      this.sourceNode.loop = val;
    }
  }

  get loop(): boolean {
    return this._isLooping;
  }

  // ─── Per-Module Bypass ────────────────────────────────────────────────────

  setModuleBypass(instanceId: string, bypassed: boolean): void {
    const mn = this.moduleNodes.find(m => m.instanceId === instanceId);
    if (!mn || !this.ctx) return;

    mn.bypassed = bypassed;
    
    // Smooth crossfade bypass to prevent clicks
    const now = this.ctx.currentTime;
    const fadeTime = 0.02; // 20ms fade
    
    if (bypassed) {
      mn.wetGain.gain.setTargetAtTime(0, now, fadeTime);
      mn.dryGain.gain.setTargetAtTime(1, now, fadeTime);
    } else {
      // If we're un-bypassing, we default to 100% wet
      // (Unless it's a mix-based module, but that's handled by subsequent parameter updates)
      mn.wetGain.gain.setTargetAtTime(1, now, fadeTime);
      mn.dryGain.gain.setTargetAtTime(0, now, fadeTime);
    }
  }



  // ─── Parameter Control ────────────────────────────────────────────────────

  // ─── Parameter Control ────────────────────────────────────────────────────

  setParameter(instanceId: string, paramName: string, value: number): void {
    const mn = this.moduleNodes.find(m => m.instanceId === instanceId);
    if (!mn || !this.ctx) return;

    const param = mn.internals[paramName];
    const now = this.ctx.currentTime;
    const timeConstant = 0.05; // 50ms smoothing for parameter changes

    if (param instanceof AudioParam) {
      param.setTargetAtTime(value, now, timeConstant);
    } else if (param instanceof GainNode) {
      param.gain.setTargetAtTime(value, now, timeConstant);
    }
  }

  /** Update distortion drive amount by regenerating the curve */
  setDistortionDrive(instanceId: string, driveDb: number): void {
    const mn = this.moduleNodes.find(m => m.instanceId === instanceId);
    if (!mn || !this.ctx) return;

    const shaper = mn.internals['shaper'];
    if (shaper instanceof WaveShaperNode) {
      const amount = Math.pow(10, driveDb / 20);
      shaper.curve = makeTanhCurve(amount);
    }

    const preGain = mn.internals['drive'];
    if (preGain instanceof AudioParam) {
      preGain.setTargetAtTime(Math.pow(10, driveDb / 40), this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Batch update parameters from a values object (e.g. from plugin store)
   * Maps VST parameter IDs to WebAudio node parameters.
   */
  updateFromParameters(params: Record<string, any>): void {
    if (!this.ctx) return;

    for (const [id, value] of Object.entries(params)) {
      if (typeof value !== 'number') continue;

      // God Realm Specific Mappings
      // Format: fx_[module]_[param]
      
      // EQ
      if (id === 'fx_eq_cutoff') {
        // Logarithmic frequency mapping: 20Hz - 20,000Hz
        const minFreq = 20;
        const maxFreq = 20000;
        const freq = minFreq * Math.pow(maxFreq / minFreq, value / 100);
        this.setParameterByModuleType('eq', 'frequency', freq);
      }
      if (id === 'fx_eq_resonance') {
        // Q factor mapping: 0.1 - 10 (standard range)
        const q = 0.1 + (value / 100) * 9.9;
        this.setParameterByModuleType('eq', 'Q', q);
      }

      // Compressor
      if (id === 'fx_compressor_threshold') {
        const thresh = -60 + (value / 100) * 60; // -60 to 0dB
        this.setParameterByModuleType('compressor', 'threshold', thresh);
      }
      if (id === 'fx_compressor_ratio') {
        const ratio = 1 + (value / 100) * 19; // 1 to 20
        this.setParameterByModuleType('compressor', 'ratio', ratio);
      }
      if (id === 'fx_compressor_attack') {
        const attack = 0.001 + (value / 100) * 0.199; // 1ms to 200ms
        this.setParameterByModuleType('compressor', 'attack', attack);
      }
      if (id === 'fx_compressor_release') {
        const release = 0.01 + (value / 100) * 0.99; // 10ms to 1s
        this.setParameterByModuleType('compressor', 'release', release);
      }

      // Distortion
      if (id === 'fx_distortion_drive') {
        this.setDistortionDriveByModuleType('distortion', value * 0.4); // 0-40dB drive
      }
      if (id === 'fx_distortion_mix') {
        const wet = value / 100;
        this.setParameterByModuleType('distortion', 'wetGain', wet);
        this.setParameterByModuleType('distortion', 'dryGain', 1 - wet);
      }

      // Chorus
      if (id === 'fx_chorus_rate') {
        const rate = 0.1 + (value / 100) * 9.9; // 0.1Hz - 10Hz
        this.setParameterByModuleType('chorus', 'lfoRate', rate);
      }
      if (id === 'fx_chorus_depth') {
        const depth = 0.0005 + (value / 100) * 0.0095; // Small delay modulation
        this.setParameterByModuleType('chorus', 'lfoGain', depth);
      }

      // Delay
      if (id === 'fx_delay_time') {
        const time = 0.05 + (value / 100) * 1.45; // 50ms - 1.5s
        this.setParameterByModuleType('delay', 'delayTime', time);
      }
      if (id === 'fx_delay_feedback') {
        const fb = (value / 100) * 0.9; // 0 - 0.9
        this.setParameterByModuleType('delay', 'feedback', fb);
      }
      if (id === 'fx_delay_mix') {
        const wet = value / 100;
        this.setParameterByModuleType('delay', 'wetGain', wet);
        this.setParameterByModuleType('delay', 'dryGain', 1 - wet);
      }

      // Reverb
      if (id === 'fx_reverb_mix') {
        const wet = value / 100;
        this.setParameterByModuleType('reverb', 'wetGain', wet);
        this.setParameterByModuleType('reverb', 'dryGain', 1 - wet);
      }
      if (id === 'fx_reverb_damping') {
        const freq = 1000 + (1 - value / 100) * 19000; // 1kHz - 20kHz inverse
        this.setParameterByModuleType('reverb', 'frequency', freq);
      }
      if (id === 'fx_reverb_size') {
        // Size approximation: adjust wet gain slightly and IR damping
        const sizeMod = 0.5 + (value / 100) * 1.5;
        // (We don't have a clean way to stretch IR live, but we can fake intensity)
      }

      // Limiter
      if (id === 'fx_limiter_ceiling') {
        const ceiling = -12 + (value / 100) * 12; // -12 to 0dB
        this.setParameterByModuleType('limiter', 'threshold', ceiling);
      }

      // Master — value is in dB (matching the knob's -60 to +6 range)
      if (id === 'masterVolume') {
        const db = value; // Value IS already in dB from the GodKnob
        const gain = db <= -60 ? 0 : Math.pow(10, db / 20);
        this._masterVolume = gain;
        if (this.masterGain) {
          // Smooth transition to prevent pops
          this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
        }
      }
      if (id === 'tuneSemitones') {
        this._detuneCents = value * 100;
        if (this.sourceNode) {
          this.sourceNode.detune.setValueAtTime(this._detuneCents, this.ctx.currentTime);
        }
      }
    }
  }

  private setParameterByModuleType(type: DSPModuleType, paramName: string, value: number): void {
    const mn = this.moduleNodes.find(m => m.type === type);
    if (mn) {
      this.setParameter(mn.instanceId, paramName, value);
    }
  }

  private setDistortionDriveByModuleType(type: DSPModuleType, driveDb: number): void {
    const mn = this.moduleNodes.find(m => m.type === type);
    if (mn) {
      this.setDistortionDrive(mn.instanceId, driveDb);
    }
  }

  // ── Debug: probe signal at each stage ────────────────────────────────────

  async debugSignalChain(): Promise<Record<string, unknown>> {
    if (!this.ctx || !this.analyserNode || !this.masterGain) {
      return { error: 'Engine not initialized' };
    }

    const report: Record<string, unknown> = {
      ctxState: this.ctx.state,
      sampleRate: this.ctx.sampleRate,
      isPlaying: this._isPlaying,
      sourceExists: !!this.sourceNode,
      sourceLoop: this.sourceNode?.loop,
      bufferDuration: this.currentBuffer?.duration,
      masterGainValue: this.masterGain.gain.value,
      moduleCount: this.moduleNodes.length,
    };

    // Helper: measure RMS via a temp AnalyserNode connected for 200ms
    const measureRMS = (node: AudioNode, label: string): Promise<{ rms: number; db: string }> => {
      return new Promise(resolve => {
        const a = this.ctx!.createAnalyser();
        a.fftSize = 2048;
        node.connect(a);
        setTimeout(() => {
          const td = new Uint8Array(a.frequencyBinCount);
          a.getByteTimeDomainData(td);
          let sq = 0;
          for (let i = 0; i < td.length; i++) {
            const s = (td[i] - 128) / 128;
            sq += s * s;
          }
          const rms = Math.sqrt(sq / td.length);
          try { node.disconnect(a); } catch (_e) { /* ok */ }
          resolve({
            rms: +rms.toFixed(6),
            db: rms > 0.001 ? (20 * Math.log10(rms)).toFixed(1) + ' dB' : '-∞ dB',
          });
        }, 250);
      });
    };

    // Probe each stage
    const stages: { label: string; node: AudioNode }[] = [];

    // Source output
    if (this.sourceNode) {
      stages.push({ label: 'source_output', node: this.sourceNode });
    }

    // Each module input & output
    for (const mn of this.moduleNodes) {
      stages.push({ label: `${mn.type}_[${mn.instanceId}]_input`, node: mn.inputNode });
      stages.push({ label: `${mn.type}_[${mn.instanceId}]_wetGain`, node: mn.wetGain });
      stages.push({ label: `${mn.type}_[${mn.instanceId}]_output`, node: mn.outputNode });
    }

    // Master gain output
    stages.push({ label: 'masterGain_output', node: this.masterGain });

    // Analyser output (final)
    stages.push({ label: 'analyser_output', node: this.analyserNode });

    const probes: Record<string, { rms: number; db: string }> = {};
    // Measure sequentially to avoid overloading
    for (const stage of stages) {
      probes[stage.label] = await measureRMS(stage.node, stage.label);
    }

    report.signalProbes = probes;
    console.log('[ChainPreview] 🔬 Signal Chain Debug Report:', report);
    return report;
  }
}
