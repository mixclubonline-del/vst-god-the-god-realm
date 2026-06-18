/**
 * InsertFXEngine.ts — Per-Track Insert Effects DSP Engine
 * 
 * Creates and manages WebAudio node chains for each insert effect slot.
 * This bridges the gap between the existing state-only InsertEffect system
 * and actual audio processing.
 * 
 * Architecture:
 *   eqInput → [Insert 0] → [Insert 1] → [Insert 2] → [Insert 3] → postEQ/dry
 * 
 * Each insert slot can host one of the Anunnaki plugin types, creating the
 * appropriate WebAudio nodes for real-time DSP processing.
 */

import type { InsertEffectType, InsertEffect } from '../components/sequencer/useSequencerEngine';

/* ═══ Types ═══ */

export interface InsertFXNodeChain {
  input: GainNode;
  output: GainNode;
  bypass: GainNode;
  wetGain: GainNode;
  dryGain: GainNode;
  nodes: AudioNode[];       // effect-specific nodes for cleanup
  type: InsertEffectType;
  params: Record<string, number>;
  analyserIn: AnalyserNode;
  analyserOut: AnalyserNode;
}

/* ═══ Filter Node Builder ═══ */

function buildFilterChain(ctx: BaseAudioContext): { nodes: AudioNode[]; input: AudioNode; output: AudioNode; setParam: (key: string, value: number) => void } {
  // Multi-mode filter using BiquadFilterNode
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1000;
  filter.Q.value = 1.0;

  // Internal saturation/drive on the resonance feedback
  const driveNode = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = Math.tanh(x * 1.5);
  }
  driveNode.curve = curve;
  driveNode.oversample = '2x';

  // Signal path: input → filter → drive → output
  filter.connect(driveNode);

  const filterTypes: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch', 'allpass', 'peaking'];

  const setParam = (key: string, value: number) => {
    switch (key) {
      case 'cutoff':
        // Exponential mapping: 20Hz – 20kHz
        const freq = 20 * Math.pow(1000, value / 100);
        filter.frequency.setTargetAtTime(Math.min(freq, 20000), ctx.currentTime, 0.01);
        break;
      case 'resonance':
        // Q: 0.5 – 18
        const q = 0.5 + (value / 100) * 17.5;
        filter.Q.setTargetAtTime(q, ctx.currentTime, 0.01);
        break;
      case 'type':
        // 0–5 mapped to filter types
        const typeIdx = Math.round(Math.max(0, Math.min(5, value)));
        filter.type = filterTypes[typeIdx];
        break;
      case 'drive':
        // Regenerate drive curve with new amount
        const driveAmount = 1.0 + (value / 100) * 4.0;
        const newCurve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i / 128) - 1;
          newCurve[i] = Math.tanh(x * driveAmount);
        }
        driveNode.curve = newCurve;
        break;
      case 'envAmount':
        // Envelope follower amount — stored for UI, actual modulation done in the plugin component
        break;
      case 'lfoRate':
        // LFO rate — stored for UI, actual modulation done in the plugin component
        break;
      case 'lfoDepth':
        // LFO depth — stored for UI
        break;
    }
  };

  return {
    nodes: [filter, driveNode],
    input: filter,
    output: driveNode,
    setParam,
  };
}

/* ═══ Compressor Node Builder ═══ */

function buildCompressorChain(ctx: BaseAudioContext): { nodes: AudioNode[]; input: AudioNode; output: AudioNode; setParam: (key: string, value: number) => void } {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 4;
  comp.attack.value = 0.01;
  comp.release.value = 0.1;
  comp.knee.value = 6;

  // Makeup gain
  const makeup = ctx.createGain();
  makeup.gain.value = 1.0;
  comp.connect(makeup);

  const setParam = (key: string, value: number) => {
    switch (key) {
      case 'threshold':
        comp.threshold.setTargetAtTime(value, ctx.currentTime, 0.01);
        break;
      case 'ratio':
        comp.ratio.setTargetAtTime(Math.max(1, value), ctx.currentTime, 0.01);
        break;
      case 'attack':
        comp.attack.setTargetAtTime(Math.max(0.001, value / 1000), ctx.currentTime, 0.01);
        break;
      case 'release':
        comp.release.setTargetAtTime(Math.max(0.01, value / 1000), ctx.currentTime, 0.01);
        break;
      case 'knee':
        comp.knee.setTargetAtTime(value, ctx.currentTime, 0.01);
        break;
      case 'makeup':
        const gain = Math.pow(10, value / 20); // dB to linear
        makeup.gain.setTargetAtTime(gain, ctx.currentTime, 0.01);
        break;
    }
  };

  return { nodes: [comp, makeup], input: comp, output: makeup, setParam };
}

/* ═══ Distortion/Saturation Node Builder ═══ */

function buildDistortionChain(ctx: BaseAudioContext): { nodes: AudioNode[]; input: AudioNode; output: AudioNode; setParam: (key: string, value: number) => void } {
  const inputGain = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.oversample = '4x';
  const toneFilter = ctx.createBiquadFilter();
  toneFilter.type = 'lowpass';
  toneFilter.frequency.value = 8000;
  const outputGain = ctx.createGain();
  outputGain.gain.value = 0.7;

  inputGain.connect(shaper);
  shaper.connect(toneFilter);
  toneFilter.connect(outputGain);

  // Generate initial tube-style curve
  const generateCurve = (drive: number, mode: number) => {
    const samples = 512;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i / (samples / 2)) - 1;
      switch (mode) {
        case 0: // Tube
          curve[i] = Math.tanh(x * drive);
          break;
        case 1: // Tape
          curve[i] = (2 / Math.PI) * Math.atan(x * drive);
          break;
        case 2: // Digital (hard clip)
          curve[i] = Math.max(-1, Math.min(1, x * drive));
          break;
        default:
          curve[i] = Math.tanh(x * drive);
      }
    }
    return curve;
  };

  let currentDrive = 2.0;
  let currentMode = 0;
  shaper.curve = generateCurve(currentDrive, currentMode);

  const setParam = (key: string, value: number) => {
    switch (key) {
      case 'drive':
        currentDrive = 1.0 + (value / 100) * 9.0;
        shaper.curve = generateCurve(currentDrive, currentMode);
        break;
      case 'tone':
        const freq = 500 + (value / 100) * 19500;
        toneFilter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.01);
        break;
      case 'mode':
        currentMode = Math.round(value);
        shaper.curve = generateCurve(currentDrive, currentMode);
        break;
      case 'body':
        // Add low shelf boost for body
        break;
    }
  };

  return { nodes: [inputGain, shaper, toneFilter, outputGain], input: inputGain, output: outputGain, setParam };
}

/* ═══ Bitcrusher Node Builder ═══ */

function buildBitcrusherChain(ctx: BaseAudioContext): { nodes: AudioNode[]; input: AudioNode; output: AudioNode; setParam: (key: string, value: number) => void } {
  // WebAudio doesn't have a native bitcrusher, so we use a ScriptProcessor/AudioWorklet approach
  // For now, we use a WaveShaper to approximate bit reduction
  const inputGain = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const outputGain = ctx.createGain();
  outputGain.gain.value = 0.8;

  inputGain.connect(shaper);
  shaper.connect(outputGain);

  const generateBitCrushCurve = (bits: number) => {
    const samples = 65536;
    const curve = new Float32Array(samples);
    const levels = Math.pow(2, bits);
    for (let i = 0; i < samples; i++) {
      const x = (i / (samples / 2)) - 1;
      curve[i] = Math.round(x * levels) / levels;
    }
    return curve;
  };

  shaper.curve = generateBitCrushCurve(8);

  const setParam = (key: string, value: number) => {
    switch (key) {
      case 'bits':
        shaper.curve = generateBitCrushCurve(Math.max(1, Math.min(16, value)));
        break;
      case 'downsample':
        // Would need AudioWorklet for true sample rate reduction
        break;
    }
  };

  return { nodes: [inputGain, shaper, outputGain], input: inputGain, output: outputGain, setParam };
}

/* ═══ Reverb Node Builder ═══ */

function buildReverbChain(ctx: BaseAudioContext): { nodes: AudioNode[]; input: AudioNode; output: AudioNode; setParam: (key: string, value: number) => void } {
  const convolver = ctx.createConvolver();
  const preDelay = ctx.createDelay(0.1);
  preDelay.delayTime.value = 0.02;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.5;
  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.5;
  const output = ctx.createGain();

  // Generate synthetic IR
  const generateIR = (decay: number, size: number) => {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * (decay / 100) * 5;
    const ir = ctx.createBuffer(2, Math.max(1, Math.floor(length)), sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const decayFactor = Math.exp(-t * (6 - (size / 100) * 5));
        data[i] = (Math.random() * 2 - 1) * decayFactor;
      }
    }
    return ir;
  };

  convolver.buffer = generateIR(50, 50);

  // Parallel dry/wet
  preDelay.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(output);

  const setParam = (key: string, value: number) => {
    switch (key) {
      case 'size':
      case 'mix':
        if (key === 'mix') {
          const wet = value / 100;
          wetGain.gain.setTargetAtTime(wet, ctx.currentTime, 0.02);
          dryGain.gain.setTargetAtTime(1 - wet, ctx.currentTime, 0.02);
        }
        break;
      case 'decay':
        // Regenerate IR (expensive, do sparingly)
        break;
      case 'preDelay':
        preDelay.delayTime.setTargetAtTime(value / 1000, ctx.currentTime, 0.01);
        break;
    }
  };

  return { nodes: [preDelay, convolver, wetGain, dryGain, output], input: preDelay, output, setParam };
}

/* ═══ Delay Node Builder ═══ */

function buildDelayChain(ctx: BaseAudioContext): { nodes: AudioNode[]; input: AudioNode; output: AudioNode; setParam: (key: string, value: number) => void } {
  const delay = ctx.createDelay(2.0);
  delay.delayTime.value = 0.375;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.35;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 4000;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.5;
  const output = ctx.createGain();

  delay.connect(filter);
  filter.connect(feedback);
  feedback.connect(delay);
  filter.connect(wetGain);
  wetGain.connect(output);

  const setParam = (key: string, value: number) => {
    switch (key) {
      case 'time':
        delay.delayTime.setTargetAtTime(value / 1000, ctx.currentTime, 0.02);
        break;
      case 'feedback':
        feedback.gain.setTargetAtTime(Math.min(0.95, value / 100), ctx.currentTime, 0.01);
        break;
      case 'mix':
        wetGain.gain.setTargetAtTime(value / 100, ctx.currentTime, 0.01);
        break;
      case 'filter':
        filter.frequency.setTargetAtTime(200 + (value / 100) * 19800, ctx.currentTime, 0.01);
        break;
    }
  };

  return { nodes: [delay, feedback, filter, wetGain, output], input: delay, output, setParam };
}

/* ═══ Chorus Node Builder ═══ */

function buildChorusChain(ctx: BaseAudioContext): { nodes: AudioNode[]; input: AudioNode; output: AudioNode; setParam: (key: string, value: number) => void } {
  const delayL = ctx.createDelay(0.05);
  const delayR = ctx.createDelay(0.05);
  delayL.delayTime.value = 0.006;
  delayR.delayTime.value = 0.008;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.8;

  const lfoGainL = ctx.createGain();
  lfoGainL.gain.value = 0.003;
  const lfoGainR = ctx.createGain();
  lfoGainR.gain.value = 0.003;

  lfo.connect(lfoGainL);
  lfo.connect(lfoGainR);
  lfoGainL.connect(delayL.delayTime);
  lfoGainR.connect(delayR.delayTime);

  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  const output = ctx.createGain();

  // Mono input → split to L/R delays → merge
  const input = ctx.createGain();
  input.connect(delayL);
  input.connect(delayR);
  delayL.connect(merger, 0, 0);
  delayR.connect(merger, 0, 1);
  merger.connect(output);

  if (ctx instanceof AudioContext) {
    lfo.start();
  } else {
    lfo.start(0);
  }

  const setParam = (key: string, value: number) => {
    switch (key) {
      case 'rate':
        lfo.frequency.setTargetAtTime(0.1 + (value / 100) * 4.9, ctx.currentTime, 0.02);
        break;
      case 'depth':
        const depth = 0.001 + (value / 100) * 0.009;
        lfoGainL.gain.setTargetAtTime(depth, ctx.currentTime, 0.01);
        lfoGainR.gain.setTargetAtTime(depth, ctx.currentTime, 0.01);
        break;
      case 'mix':
        output.gain.setTargetAtTime(value / 100, ctx.currentTime, 0.01);
        break;
    }
  };

  return { nodes: [input, delayL, delayR, lfo, lfoGainL, lfoGainR, merger, output], input, output, setParam };
}

/* ═══ Saturation Node Builder ═══ */

function buildSaturationChain(ctx: BaseAudioContext): { nodes: AudioNode[]; input: AudioNode; output: AudioNode; setParam: (key: string, value: number) => void } {
  const shaper = ctx.createWaveShaper();
  shaper.oversample = '2x';
  const output = ctx.createGain();
  output.gain.value = 0.85;
  shaper.connect(output);

  const generateSatCurve = (drive: number) => {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i / (samples / 2)) - 1;
      curve[i] = Math.tanh(x * (1 + drive * 3));
    }
    return curve;
  };

  shaper.curve = generateSatCurve(0.5);

  const setParam = (key: string, value: number) => {
    switch (key) {
      case 'drive':
        shaper.curve = generateSatCurve(value / 100);
        break;
      case 'mix':
        output.gain.setTargetAtTime(value / 100, ctx.currentTime, 0.01);
        break;
    }
  };

  return { nodes: [shaper, output], input: shaper, output, setParam };
}


/* ═══ Factory Map ═══ */

const BUILDERS: Record<InsertEffectType, (ctx: BaseAudioContext) => ReturnType<typeof buildFilterChain>> = {
  filter: buildFilterChain,
  compressor: buildCompressorChain,
  distortion: buildDistortionChain,
  bitcrusher: buildBitcrusherChain,
  reverb: buildReverbChain,
  delay: buildDelayChain,
  chorus: buildChorusChain,
  saturation: buildSaturationChain,
};


/* ═══ InsertFXEngine Class ═══ */

export class InsertFXEngine {
  private ctx: BaseAudioContext;
  private chains: Map<string, { chain: InsertFXNodeChain; setParam: (key: string, value: number) => void }> = new Map();

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
  }

  /**
   * Create an insert effect chain for a specific track slot.
   * Returns the chain's input and output nodes for wiring into the audio graph.
   */
  createInsert(trackIndex: number, slotIndex: number, effect: InsertEffect): InsertFXNodeChain {
    const key = `${trackIndex}-${slotIndex}`;
    
    // Cleanup existing chain in this slot
    this.removeInsert(trackIndex, slotIndex);

    const builder = BUILDERS[effect.type];
    if (!builder) {
      throw new Error(`Unknown insert effect type: ${effect.type}`);
    }

    const built = builder(this.ctx);

    // Create wrapper nodes for bypass and wet/dry
    const input = this.ctx.createGain();
    const output = this.ctx.createGain();
    const bypass = this.ctx.createGain();
    const wetGain = this.ctx.createGain();
    const dryGain = this.ctx.createGain();
    
    // Analysers for metering
    const analyserIn = this.ctx.createAnalyser();
    analyserIn.fftSize = 256;
    const analyserOut = this.ctx.createAnalyser();
    analyserOut.fftSize = 2048; // Higher resolution for spectrum display

    // Signal routing:
    // input → analyserIn → [effect chain] → wetGain → output → analyserOut
    // input → dryGain → output (bypass path)
    input.connect(analyserIn);
    analyserIn.connect(built.input);
    (built.output as AudioNode).connect(wetGain);
    wetGain.connect(output);
    input.connect(dryGain);
    dryGain.connect(output);
    output.connect(analyserOut);

    // Set initial bypass state
    if (effect.enabled) {
      wetGain.gain.value = 1.0;
      dryGain.gain.value = 0.0;
    } else {
      wetGain.gain.value = 0.0;
      dryGain.gain.value = 1.0;
    }

    // Apply initial params
    for (const [param, value] of Object.entries(effect.params)) {
      built.setParam(param, value);
    }

    const chain: InsertFXNodeChain = {
      input,
      output,
      bypass,
      wetGain,
      dryGain,
      nodes: built.nodes,
      type: effect.type,
      params: { ...effect.params },
      analyserIn,
      analyserOut,
    };

    this.chains.set(key, { chain, setParam: built.setParam });
    return chain;
  }

  /** Update a single parameter on an existing insert */
  setParam(trackIndex: number, slotIndex: number, param: string, value: number): void {
    const key = `${trackIndex}-${slotIndex}`;
    const entry = this.chains.get(key);
    if (entry) {
      entry.setParam(param, value);
      entry.chain.params[param] = value;
    }
  }

  /** Toggle bypass state */
  setBypass(trackIndex: number, slotIndex: number, bypassed: boolean): void {
    const key = `${trackIndex}-${slotIndex}`;
    const entry = this.chains.get(key);
    if (entry) {
      const t = this.ctx.currentTime;
      if (bypassed) {
        entry.chain.wetGain.gain.setTargetAtTime(0, t, 0.01);
        entry.chain.dryGain.gain.setTargetAtTime(1, t, 0.01);
      } else {
        entry.chain.wetGain.gain.setTargetAtTime(1, t, 0.01);
        entry.chain.dryGain.gain.setTargetAtTime(0, t, 0.01);
      }
    }
  }

  /** Get analyser nodes for a specific insert (for UI visualizations) */
  getAnalysers(trackIndex: number, slotIndex: number): { in: AnalyserNode; out: AnalyserNode } | null {
    const key = `${trackIndex}-${slotIndex}`;
    const entry = this.chains.get(key);
    if (entry) {
      return { in: entry.chain.analyserIn, out: entry.chain.analyserOut };
    }
    return null;
  }

  /** Remove an insert effect, disconnecting all nodes */
  removeInsert(trackIndex: number, slotIndex: number): void {
    const key = `${trackIndex}-${slotIndex}`;
    const entry = this.chains.get(key);
    if (entry) {
      try {
        entry.chain.input.disconnect();
        entry.chain.output.disconnect();
        entry.chain.wetGain.disconnect();
        entry.chain.dryGain.disconnect();
        entry.chain.analyserIn.disconnect();
        entry.chain.analyserOut.disconnect();
        for (const node of entry.chain.nodes) {
          try { node.disconnect(); } catch {}
        }
      } catch {}
      this.chains.delete(key);
    }
  }

  /** Get a chain for a specific track/slot */
  getChain(trackIndex: number, slotIndex: number): InsertFXNodeChain | null {
    const key = `${trackIndex}-${slotIndex}`;
    return this.chains.get(key)?.chain ?? null;
  }

  /** Dispose all chains */
  dispose(): void {
    for (const [key, entry] of this.chains) {
      try {
        entry.chain.input.disconnect();
        entry.chain.output.disconnect();
        for (const node of entry.chain.nodes) {
          try { node.disconnect(); } catch {}
        }
      } catch {}
    }
    this.chains.clear();
  }
}
