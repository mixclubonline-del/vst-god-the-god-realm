// ─── Multi-Layer Preset Engine Types ────────────────────────────────────────

export type OscWaveform = 'sine' | 'saw' | 'square' | 'triangle' | 'noise' | 'pulse';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'peak';
export type LayerType = 'oscillator' | 'sample';

export interface OscParams {
  waveform: OscWaveform;
  octave: number;       // -2 to +2
  semitone: number;     // -12 to +12
  detune: number;       // -100 to +100 cents
  pulseWidth: number;   // 0–1, only applies to 'pulse' waveform
  phase: number;        // 0–360 degrees
  unisonVoices: number; // 1–8
  unisonDetune: number; // 0–100
  unisonWidth: number;  // 0–100
}

export interface SampleParams {
  path: string;
  name: string;
  startPoint: number;   // 0–1
  endPoint: number;     // 0–1
  loopEnabled: boolean;
  loopStart: number;    // 0–1
  loopEnd: number;      // 0–1
  reverse: boolean;
  pitchTrack: boolean;  // if true, pitch follows MIDI note; if false, plays at original pitch
}

export interface AdsrParams {
  attack: number;   // 0–100 (ms scaling applied downstream)
  decay: number;    // 0–100
  sustain: number;  // 0–100 (level)
  release: number;  // 0–100
}

export interface FilterParams {
  type: FilterType;
  frequency: number;  // 20–20000 Hz
  resonance: number;  // 0–100
  drive: number;      // 0–100
  envAmount: number;  // -100 to +100 (filter envelope depth)
  lfoAmount: number;  // -100 to +100 (LFO → filter)
  keytrack: number;   // 0–100 (keyboard tracking amount)
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  enabled: boolean;
  solo: boolean;
  volume: number;     // 0–100
  pan: number;        // -100 to +100
  pitch: number;      // -24 to +24 semitones (coarse)
  finePitch: number;  // -100 to +100 cents
  osc: OscParams;
  sample: SampleParams;
  adsr: AdsrParams;
  filterAdsr: AdsrParams;
  filter: FilterParams;
  color: string;      // hex color for UI theming
}

export interface GlobalFX {
  reverb: {
    enabled: boolean;
    mix: number;    // 0–100
    size: number;   // 0–100
    damping: number; // 0–100
    predelay: number; // 0–100
  };
  delay: {
    enabled: boolean;
    mix: number;
    time: number;   // 0–100 (synced or free)
    feedback: number;
    sync: boolean;
    pingpong: boolean;
  };
  chorus: {
    enabled: boolean;
    mix: number;
    rate: number;
    depth: number;
    voices: number; // 2 | 3 | 4
  };
  distortion: {
    enabled: boolean;
    drive: number;
    tone: number;
    mix: number;
    type: 'soft' | 'hard' | 'tube' | 'fuzz';
  };
  eq: {
    enabled: boolean;
    low: number;    // -12 to +12 dB
    lowMid: number;
    highMid: number;
    high: number;
    lowFreq: number;
    highFreq: number;
  };
  compressor: {
    enabled: boolean;
    threshold: number; // -60 to 0 dB
    ratio: number;     // 1–20
    attack: number;    // 0–100
    release: number;   // 0–100
    makeupGain: number; // 0–30 dB
  };
}

export interface MacroTarget {
  layerId: string;    // '' = global FX
  param: string;      // dot-notation path, e.g. 'adsr.attack' or 'fx.reverb.mix'
  min: number;
  max: number;
  curve: 'linear' | 'log' | 'exp';
}

export interface Macro {
  id: string;
  name: string;       // e.g., "DIVINE FIRE"
  value: number;      // 0–100 current position
  color: string;      // hex
  targets: MacroTarget[];
}

export interface LayeredPreset {
  id: string;
  name: string;
  type: string;       // 'Keys' | 'Bass' | 'Lead' | 'Pad' | 'Pluck' | 'FX' | 'Arp' | 'Perc'
  author: string;
  rating: number;
  fav: boolean;
  tags: string[];
  lastModified: string;
  energyLevel: number;
  description?: string;
  bankId?: string;    // for expansion bank grouping
  layers: Layer[];
  globalFX: GlobalFX;
  macros: Macro[];
}

export interface ExpansionBank {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  presetCount: number;
  tags: string[];
  encrypted: boolean;
  installed: boolean;
  previewUrl?: string;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export function defaultOsc(): OscParams {
  return {
    waveform: 'saw',
    octave: 0,
    semitone: 0,
    detune: 0,
    pulseWidth: 0.5,
    phase: 0,
    unisonVoices: 1,
    unisonDetune: 15,
    unisonWidth: 70,
  };
}

export function defaultSample(): SampleParams {
  return {
    path: '',
    name: '',
    startPoint: 0,
    endPoint: 1,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: 1,
    reverse: false,
    pitchTrack: true,
  };
}

export function defaultAdsr(): AdsrParams {
  return { attack: 5, decay: 35, sustain: 70, release: 40 };
}

export function defaultFilter(): FilterParams {
  return {
    type: 'lowpass',
    frequency: 8000,
    resonance: 20,
    drive: 0,
    envAmount: 0,
    lfoAmount: 0,
    keytrack: 0,
  };
}

export function defaultGlobalFX(): GlobalFX {
  return {
    reverb: { enabled: false, mix: 25, size: 60, damping: 40, predelay: 10 },
    delay: { enabled: false, mix: 20, time: 50, feedback: 35, sync: true, pingpong: false },
    chorus: { enabled: false, mix: 30, rate: 30, depth: 40, voices: 3 },
    distortion: { enabled: false, drive: 40, tone: 60, mix: 50, type: 'soft' },
    eq: { enabled: false, low: 0, lowMid: 0, highMid: 0, high: 0, lowFreq: 200, highFreq: 8000 },
    compressor: { enabled: false, threshold: -12, ratio: 4, attack: 20, release: 40, makeupGain: 3 },
  };
}

export function defaultMacro(index: number): Macro {
  const names = ['DIVINE FIRE', 'CELESTIAL DRIFT', 'TITAN WEIGHT', 'OLYMPUS GLOW', 'ZEUS SPARK', 'HADES SHADOW', 'POSEIDON TIDE', 'CHRONOS WARP'];
  const colors = ['#f59e0b', '#818cf8', '#34d399', '#fbbf24', '#60a5fa', '#a78bfa', '#38bdf8', '#f87171'];
  return {
    id: `macro-${index}`,
    name: names[index % names.length],
    value: 50,
    color: colors[index % colors.length],
    targets: [],
  };
}

export function defaultLayer(index: number): Layer {
  const colors = ['#f59e0b', '#818cf8', '#34d399', '#60a5fa', '#a78bfa', '#f87171', '#fbbf24', '#38bdf8'];
  return {
    id: `layer-${Date.now()}-${index}`,
    name: `Layer ${index + 1}`,
    type: 'oscillator',
    enabled: true,
    solo: false,
    volume: 80,
    pan: 0,
    pitch: 0,
    finePitch: 0,
    osc: defaultOsc(),
    sample: defaultSample(),
    adsr: defaultAdsr(),
    filterAdsr: { attack: 0, decay: 50, sustain: 0, release: 30 },
    filter: defaultFilter(),
    color: colors[index % colors.length],
  };
}

export function createDefaultPreset(name = 'New Ritual'): LayeredPreset {
  return {
    id: `lp-${Date.now()}`,
    name,
    type: 'Keys',
    author: 'User',
    rating: 3,
    fav: false,
    tags: [],
    lastModified: new Date().toISOString(),
    energyLevel: 60,
    layers: [defaultLayer(0)],
    globalFX: defaultGlobalFX(),
    macros: Array.from({ length: 8 }, (_, i) => defaultMacro(i)),
  };
}
