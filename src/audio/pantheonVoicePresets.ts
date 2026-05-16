/**
 * pantheonVoicePresets.ts — Per-God Synthesis Parameters
 * Defines the FM synthesis, filter, ADSR, and FX configuration for each deity.
 */

export type VoiceMode = 'POLY' | 'MONO' | 'LEGATO';

export interface GodVoicePreset {
  id: string;
  carrier: OscillatorType;
  modRatio: number;
  modIndex: number;
  bodyType: OscillatorType;
  bodyGain: number;
  detuneCents: number;
  filterType: BiquadFilterType;
  filterFreq: number;
  filterQ: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  reverbDecay: number;
  reverbMix: number;
  chorusRate: number;
  chorusDepth: number;
  chorusMix: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  satDrive: number;
  satMix: number;
  subOscGain: number;
  vibratoRate: number;
  vibratoDepth: number;
}

export const GOD_VOICE_PRESETS: Record<string, GodVoicePreset> = {
  olympus: {
    id: 'olympus',
    carrier: 'sine', modRatio: 2.0, modIndex: 1.2,
    bodyType: 'sine', bodyGain: 0.3, detuneCents: 6,
    filterType: 'lowpass', filterFreq: 6000, filterQ: 0.7,
    attack: 0.008, decay: 0.6, sustain: 0.5, release: 0.8,
    reverbDecay: 2.5, reverbMix: 0.35,
    chorusRate: 0.8, chorusDepth: 0.003, chorusMix: 0.25,
    delayTime: 0.375, delayFeedback: 0.3, delayMix: 0.15,
    satDrive: 1.2, satMix: 0.2,
    subOscGain: 0.15, vibratoRate: 5.0, vibratoDepth: 3,
  },
  hades: {
    id: 'hades',
    carrier: 'sawtooth', modRatio: 3.0, modIndex: 4.0,
    bodyType: 'square', bodyGain: 0.2, detuneCents: 15,
    filterType: 'lowpass', filterFreq: 2800, filterQ: 2.0,
    attack: 0.005, decay: 0.4, sustain: 0.6, release: 0.5,
    reverbDecay: 3.5, reverbMix: 0.4,
    chorusRate: 0.3, chorusDepth: 0.008, chorusMix: 0.3,
    delayTime: 0.5, delayFeedback: 0.45, delayMix: 0.2,
    satDrive: 3.5, satMix: 0.5,
    subOscGain: 0.25, vibratoRate: 4.0, vibratoDepth: 8,
  },
  zeus: {
    id: 'zeus',
    carrier: 'square', modRatio: 7.0, modIndex: 2.5,
    bodyType: 'sawtooth', bodyGain: 0.15, detuneCents: 3,
    filterType: 'highpass', filterFreq: 400, filterQ: 1.0,
    attack: 0.001, decay: 0.2, sustain: 0.4, release: 0.3,
    reverbDecay: 1.5, reverbMix: 0.2,
    chorusRate: 2.0, chorusDepth: 0.002, chorusMix: 0.15,
    delayTime: 0.188, delayFeedback: 0.35, delayMix: 0.25,
    satDrive: 2.0, satMix: 0.3,
    subOscGain: 0.1, vibratoRate: 6.5, vibratoDepth: 2,
  },
  athena: {
    id: 'athena',
    carrier: 'sine', modRatio: 1.0, modIndex: 0.8,
    bodyType: 'sine', bodyGain: 0.4, detuneCents: 4,
    filterType: 'lowpass', filterFreq: 5000, filterQ: 0.5,
    attack: 0.012, decay: 0.8, sustain: 0.6, release: 1.0,
    reverbDecay: 2.0, reverbMix: 0.3,
    chorusRate: 0.6, chorusDepth: 0.004, chorusMix: 0.3,
    delayTime: 0.25, delayFeedback: 0.2, delayMix: 0.1,
    satDrive: 1.0, satMix: 0.1,
    subOscGain: 0.2, vibratoRate: 4.5, vibratoDepth: 4,
  },
  poseidon: {
    id: 'poseidon',
    carrier: 'triangle', modRatio: 0.5, modIndex: 1.5,
    bodyType: 'sine', bodyGain: 0.35, detuneCents: 8,
    filterType: 'lowpass', filterFreq: 3500, filterQ: 1.5,
    attack: 0.05, decay: 1.0, sustain: 0.7, release: 2.0,
    reverbDecay: 4.0, reverbMix: 0.5,
    chorusRate: 0.3, chorusDepth: 0.006, chorusMix: 0.4,
    delayTime: 0.666, delayFeedback: 0.5, delayMix: 0.3,
    satDrive: 1.0, satMix: 0.1,
    subOscGain: 0.3, vibratoRate: 3.0, vibratoDepth: 6,
  },
  titan: {
    id: 'titan',
    carrier: 'sine', modRatio: 4.0, modIndex: 2.0,
    bodyType: 'sawtooth', bodyGain: 0.25, detuneCents: 10,
    filterType: 'lowpass', filterFreq: 4000, filterQ: 0.8,
    attack: 0.02, decay: 0.5, sustain: 0.7, release: 1.5,
    reverbDecay: 5.0, reverbMix: 0.45,
    chorusRate: 0.4, chorusDepth: 0.005, chorusMix: 0.2,
    delayTime: 0.5, delayFeedback: 0.3, delayMix: 0.15,
    satDrive: 1.8, satMix: 0.3,
    subOscGain: 0.4, vibratoRate: 3.5, vibratoDepth: 5,
  },
  apollo: {
    id: 'apollo',
    carrier: 'sine', modRatio: 5.0, modIndex: 1.8,
    bodyType: 'sine', bodyGain: 0.2, detuneCents: 2,
    filterType: 'lowpass', filterFreq: 8000, filterQ: 0.3,
    attack: 0.003, decay: 1.2, sustain: 0.3, release: 1.5,
    reverbDecay: 3.0, reverbMix: 0.4,
    chorusRate: 1.2, chorusDepth: 0.002, chorusMix: 0.2,
    delayTime: 0.333, delayFeedback: 0.25, delayMix: 0.2,
    satDrive: 1.0, satMix: 0.1,
    subOscGain: 0.1, vibratoRate: 5.5, vibratoDepth: 2,
  },
  chronos: {
    id: 'chronos',
    carrier: 'sine', modRatio: 3.5, modIndex: 3.0,
    bodyType: 'triangle', bodyGain: 0.2, detuneCents: 20,
    filterType: 'bandpass', filterFreq: 2000, filterQ: 3.0,
    attack: 0.03, decay: 0.3, sustain: 0.5, release: 2.5,
    reverbDecay: 4.5, reverbMix: 0.5,
    chorusRate: 0.2, chorusDepth: 0.01, chorusMix: 0.35,
    delayTime: 0.75, delayFeedback: 0.6, delayMix: 0.35,
    satDrive: 1.5, satMix: 0.2,
    subOscGain: 0.15, vibratoRate: 2.0, vibratoDepth: 12,
  },
};
