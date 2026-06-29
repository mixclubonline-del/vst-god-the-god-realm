/**
 * PedalChain — the Pedal Realm's global effects rack.
 *
 * Builds eight pedals as a single Web-Audio chain and splices it into the
 * master path via audioEngine.insertGlobalFx(), so when the rack is switched ON
 * it processes the ENTIRE plugin (any tab / preset). Switched OFF it is removed
 * and the master path returns to a clean dry passthrough.
 *
 * Signal order (classic board left→right):
 *   in → OVERTONE → LOFREQ → CH-0RU5 → TREM-010 → TIME WARP → BACKTRACK →
 *        ECHOFLUX → RETRO VERB → out
 *
 * Each pedal exposes a bypass (enabled) and a small set of params. DSP is
 * original (WaveShaper / Delay / filters / convolver) — no third-party code.
 */

import { audioEngine } from '../services/audioEngine';

export type PedalId =
  | 'overtone' | 'lofreq' | 'chorus' | 'trem'
  | 'timewarp' | 'backtrack' | 'echoflux' | 'retroverb';

export const PEDAL_ORDER: PedalId[] = [
  'overtone', 'lofreq', 'chorus', 'trem',
  'timewarp', 'backtrack', 'echoflux', 'retroverb',
];

interface Pedal {
  input: GainNode;
  output: GainNode;
  setEnabled(on: boolean): void;
  setParam(key: string, value: number): void;
}

// ── Curve helpers ────────────────────────────────────────────────────────────
function driveCurve(amount: number, samples = 1024): Float32Array {
  const k = Math.max(0.0001, amount);
  const c = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    c[i] = (1 + k) * x / (1 + k * Math.abs(x)); // soft saturation
  }
  return c;
}

function bitCrushCurve(bits: number, samples = 2048): Float32Array {
  const steps = Math.pow(2, Math.max(1, Math.min(16, bits)));
  const c = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    c[i] = Math.round(x * steps) / steps;
  }
  return c;
}

function buildReverbIR(ctx: BaseAudioContext, seconds: number, decay: number, bright: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    const a = Math.min(0.99, 0.2 + bright * 0.008); // brightness → LP coeff
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, decay);
      const white = (Math.random() * 2 - 1) * env;
      lp += a * (white - lp);
      d[i] = lp * (ch === 0 ? 1 : 0.92);
    }
  }
  return buf;
}

import { nativeAudio } from '../native/bridge';

const PEDAL_ID_MAP: Record<PedalId, number> = {
  overtone: 0,
  lofreq: 1,
  chorus: 2,
  trem: 3,
  timewarp: 4,
  backtrack: 5,
  echoflux: 6,
  retroverb: 7,
};

export class PedalChain {
  readonly ctx: AudioContext;
  readonly input: GainNode;
  readonly output: GainNode;
  private pedals: Record<PedalId, Pedal>;
  private _active = false;

  constructor() {
    this.ctx = audioEngine.ctx;
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();

    this.pedals = {
      overtone:  this.buildOvertone(),
      lofreq:    this.buildLoFreq(),
      chorus:    this.buildChorus(),
      trem:      this.buildTrem(),
      timewarp:  this.buildTimeWarp(),
      backtrack: this.buildBacktrack(),
      echoflux:  this.buildEchoflux(),
      retroverb: this.buildRetroVerb(),
    };

    // Wire pedals in series.
    let prev: AudioNode = this.input;
    for (const id of PEDAL_ORDER) {
      prev.connect(this.pedals[id].input);
      prev = this.pedals[id].output;
    }
    prev.connect(this.output);
  }

  get active() { return this._active; }

  /** Switch the whole rack on/off (global, affects every tab/preset). */
  setActive(on: boolean) {
    if (on === this._active) return;
    if (on) audioEngine.insertGlobalFx(this.input, this.output);
    else    audioEngine.removeGlobalFx(this.output);
    this._active = on;
    nativeAudio.setPedalMasterActive(on);
  }

  setPedalEnabled(id: PedalId, on: boolean) { 
    this.pedals[id].setEnabled(on); 
    const idx = PEDAL_ID_MAP[id];
    if (idx !== undefined) {
      nativeAudio.setPedalEnabled(idx, on);
    }
  }
  
  setPedalParam(id: PedalId, key: string, value: number) { 
    this.pedals[id].setParam(key, value); 
    const idx = PEDAL_ID_MAP[id];
    if (idx !== undefined) {
      nativeAudio.setPedalParam(idx, key, value);
    }
  }

  // ── Generic insert pedal: in → [wet processing] → out, with dry/wet bypass ──
  private makeShell() {
    const input = this.ctx.createGain();
    const output = this.ctx.createGain();
    const dry = this.ctx.createGain();
    const wet = this.ctx.createGain();
    input.connect(dry); dry.connect(output);
    wet.connect(output);
    return { input, output, dry, wet };
  }

  // ── OVERTONE — overdrive / saturation ──────────────────────────────────────
  private buildOvertone(): Pedal {
    const { input, output, dry, wet } = this.makeShell();
    const pre = this.ctx.createGain();
    const shaper = this.ctx.createWaveShaper();
    shaper.oversample = '4x';
    const tone = this.ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 8000;
    input.connect(pre); pre.connect(shaper); shaper.connect(tone); tone.connect(wet);
    let drive = 8, mix = 1;
    shaper.curve = driveCurve(drive);
    dry.gain.value = 0; wet.gain.value = mix;
    const apply = () => { dry.gain.value = 1 - mix; wet.gain.value = mix; };
    return {
      input, output,
      setEnabled(on) { dry.gain.value = on ? 1 - mix : 1; wet.gain.value = on ? mix : 0; },
      setParam: (k, v) => {
        if (k === 'drive') { drive = v; pre.gain.value = 0.5 + v / 20; shaper.curve = driveCurve(v); }
        else if (k === 'mix') { mix = v / 100; apply(); }
        else if (k === 'tone') tone.frequency.value = 400 + (v / 100) * 11000;
        else if (k === 'freq') tone.frequency.value = 400 + (v / 100) * 11000;
      },
    };
  }

  // ── LOFREQ — lo-fi: bitcrush + sample-rate-ish low-pass ─────────────────────
  private buildLoFreq(): Pedal {
    const { input, output, dry, wet } = this.makeShell();
    const crush = this.ctx.createWaveShaper(); crush.curve = bitCrushCurve(8);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 12000;
    input.connect(crush); crush.connect(lp); lp.connect(wet);
    let mix = 1;
    dry.gain.value = 0; wet.gain.value = mix;
    return {
      input, output,
      setEnabled(on) { dry.gain.value = on ? 1 - mix : 1; wet.gain.value = on ? mix : 0; },
      setParam: (k, v) => {
        if (k === 'bits' || k === 'drive') crush.curve = bitCrushCurve(Math.max(1, 16 - (v / 100) * 14));
        else if (k === 'frequency') lp.frequency.value = 500 + (v / 100) * 16000;
        else if (k === 'jitter' || k === 'unstable') lp.Q.value = (v / 100) * 6;
        else if (k === 'mix') { mix = v / 100; dry.gain.value = 1 - mix; wet.gain.value = mix; }
      },
    };
  }

  // ── CH-0RU5 — chorus ────────────────────────────────────────────────────────
  private buildChorus(): Pedal {
    const { input, output, dry, wet } = this.makeShell();
    const d1 = this.ctx.createDelay(0.05); d1.delayTime.value = 0.018;
    const d2 = this.ctx.createDelay(0.05); d2.delayTime.value = 0.025;
    const lfo1 = this.ctx.createOscillator(); lfo1.frequency.value = 1.2;
    const lfo2 = this.ctx.createOscillator(); lfo2.frequency.value = 1.6;
    const g1 = this.ctx.createGain(); g1.gain.value = 0.004;
    const g2 = this.ctx.createGain(); g2.gain.value = 0.004;
    lfo1.connect(g1); g1.connect(d1.delayTime);
    lfo2.connect(g2); g2.connect(d2.delayTime);
    lfo1.start(); lfo2.start();
    input.connect(d1); input.connect(d2); d1.connect(wet); d2.connect(wet);
    let mix = 0.5;
    dry.gain.value = 1; wet.gain.value = mix;
    return {
      input, output,
      setEnabled(on) { wet.gain.value = on ? mix : 0; dry.gain.value = 1; },
      setParam: (k, v) => {
        if (k === 'rate') { lfo1.frequency.value = 0.1 + (v / 100) * 6; lfo2.frequency.value = 0.15 + (v / 100) * 7; }
        else if (k === 'depth') { g1.gain.value = (v / 100) * 0.01; g2.gain.value = (v / 100) * 0.01; }
        else if (k === 'mix') { mix = v / 100; wet.gain.value = mix; }
        else if (k === 'vibrato') { d1.delayTime.value = 0.005 + (v / 100) * 0.03; }
        else if (k === 'analog') lfo2.frequency.value = 0.15 + (v / 100) * 7;
      },
    };
  }

  // ── TREM-010 — tremolo (amplitude LFO) ──────────────────────────────────────
  private buildTrem(): Pedal {
    const input = this.ctx.createGain();
    const output = this.ctx.createGain();
    const vca = this.ctx.createGain(); vca.gain.value = 1;
    const lfo = this.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5;
    const depthGain = this.ctx.createGain(); depthGain.gain.value = 0; // 0..0.5
    lfo.connect(depthGain); depthGain.connect(vca.gain);
    lfo.start();
    input.connect(vca); vca.connect(output);
    let enabled = false, depth = 0.5;
    const apply = () => { vca.gain.value = enabled ? 1 - depth * 0.5 : 1; depthGain.gain.value = enabled ? depth * 0.5 : 0; };
    return {
      input, output,
      setEnabled(on) { enabled = on; apply(); },
      setParam: (k, v) => {
        if (k === 'rate') lfo.frequency.value = 0.1 + (v / 100) * 18;
        else if (k === 'depth') { depth = v / 100; apply(); }
        else if (k === 'shape') lfo.type = v > 50 ? 'square' : 'sine';
      },
    };
  }

  // ── TIME WARP — tape delay (wow/flutter + saturation feedback) ──────────────
  private buildTimeWarp(): Pedal {
    const { input, output, dry, wet } = this.makeShell();
    const delay = this.ctx.createDelay(2.0); delay.delayTime.value = 0.375;
    const fb = this.ctx.createGain(); fb.gain.value = 0.35;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500;
    const sat = this.ctx.createWaveShaper(); sat.curve = driveCurve(2);
    const wow = this.ctx.createOscillator(); wow.frequency.value = 0.6;
    const wowGain = this.ctx.createGain(); wowGain.gain.value = 0.0008;
    wow.connect(wowGain); wowGain.connect(delay.delayTime); wow.start();
    input.connect(delay); delay.connect(lp); lp.connect(sat); sat.connect(wet); sat.connect(fb); fb.connect(delay);
    let mix = 0.4; dry.gain.value = 1; wet.gain.value = mix;
    return {
      input, output,
      setEnabled(on) { wet.gain.value = on ? mix : 0; dry.gain.value = 1; },
      setParam: (k, v) => {
        if (k === 'time' || k === 'capture') delay.delayTime.value = 0.05 + (v / 100) * 1.2;
        else if (k === 'flux' || k === 'feedback') fb.gain.value = (v / 100) * 0.92;
        else if (k === 'flutter') { wowGain.gain.value = (v / 100) * 0.003; }
        else if (k === 'drift' || k === 'slower') wow.frequency.value = 0.1 + (v / 100) * 3;
        else if (k === 'mix') { mix = v / 100; wet.gain.value = mix; }
        else if (k === 'unstable') lp.frequency.value = 1500 + (v / 100) * 8000;
      },
    };
  }

  // ── BACKTRACK — reverse-style modulated delay (approximation) ───────────────
  private buildBacktrack(): Pedal {
    const { input, output, dry, wet } = this.makeShell();
    const delay = this.ctx.createDelay(1.0); delay.delayTime.value = 0.25;
    const fb = this.ctx.createGain(); fb.gain.value = 0.4;
    const swell = this.ctx.createGain(); swell.gain.value = 0; // amplitude swell to fake reverse attack
    const lfo = this.ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = 2;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 0.5;
    lfo.connect(lfoG); lfoG.connect(swell.gain); lfo.start();
    input.connect(delay); delay.connect(swell); swell.connect(wet); swell.connect(fb); fb.connect(delay);
    let mix = 0.5; dry.gain.value = 1; wet.gain.value = mix;
    return {
      input, output,
      setEnabled(on) { wet.gain.value = on ? mix : 0; dry.gain.value = 1; },
      setParam: (k, v) => {
        if (k === 'pitch' || k === 'speed') lfo.frequency.value = 0.5 + (v / 100) * 8;
        else if (k === 'forward' || k === 'feedback') fb.gain.value = (v / 100) * 0.9;
        else if (k === 'mix') { mix = v / 100; wet.gain.value = mix; }
        else if (k === 'width') lfoG.gain.value = 0.2 + (v / 100) * 0.8;
      },
    };
  }

  // ── ECHOFLUX — echo / delay with feedback + tone + freeze ───────────────────
  private buildEchoflux(): Pedal {
    const { input, output, dry, wet } = this.makeShell();
    const delay = this.ctx.createDelay(2.0); delay.delayTime.value = 0.3;
    const fb = this.ctx.createGain(); fb.gain.value = 0.4;
    const tone = this.ctx.createBiquadFilter(); tone.type = 'highpass'; tone.frequency.value = 120;
    input.connect(delay); delay.connect(tone); tone.connect(wet); tone.connect(fb); fb.connect(delay);
    let mix = 0.45, frozen = false, savedFb = 0.4;
    dry.gain.value = 1; wet.gain.value = mix;
    return {
      input, output,
      setEnabled(on) { wet.gain.value = on ? mix : 0; dry.gain.value = 1; },
      setParam: (k, v) => {
        if (k === 'time' || k === 'speed') delay.delayTime.value = 0.02 + (v / 100) * 1.5;
        else if (k === 'feedback') { savedFb = (v / 100) * 0.95; if (!frozen) fb.gain.value = savedFb; }
        else if (k === 'mix') { mix = v / 100; wet.gain.value = mix; }
        else if (k === 'detune' || k === 'unstable') tone.Q.value = (v / 100) * 8;
        else if (k === 'drive') tone.frequency.value = 40 + (v / 100) * 1200;
        else if (k === 'freeze') { frozen = v > 50; fb.gain.value = frozen ? 1.0 : savedFb; }
      },
    };
  }

  // ── RETRO VERB — reverb (convolver) ─────────────────────────────────────────
  private buildRetroVerb(): Pedal {
    const { input, output, dry, wet } = this.makeShell();
    const pre = this.ctx.createDelay(0.5); pre.delayTime.value = 0.0;
    const conv = this.ctx.createConvolver();
    let seconds = 2.5, decay = 2.2, bright = 50;
    conv.buffer = buildReverbIR(this.ctx, seconds, decay, bright);
    input.connect(pre); pre.connect(conv); conv.connect(wet);
    let mix = 0.35; dry.gain.value = 1; wet.gain.value = mix;
    const rebuild = () => { try { conv.buffer = buildReverbIR(this.ctx, seconds, decay, bright); } catch {} };
    return {
      input, output,
      setEnabled(on) { wet.gain.value = on ? mix : 0; dry.gain.value = 1; },
      setParam: (k, v) => {
        if (k === 'time') { seconds = 0.3 + (v / 100) * 5.5; rebuild(); }
        else if (k === 'predelay' || k === 'pre delay') pre.delayTime.value = (v / 100) * 0.2;
        else if (k === 'mix') { mix = v / 100; wet.gain.value = mix; }
        else if (k === 'drift') { decay = 1 + (v / 100) * 3; rebuild(); }
        else if (k === 'unstable') { bright = v; rebuild(); }
      },
    };
  }
}

// Lazy singleton — only constructed when the Pedal Realm first mounts.
let _chain: PedalChain | null = null;
export function getPedalChain(): PedalChain {
  if (!_chain) _chain = new PedalChain();
  return _chain;
}
