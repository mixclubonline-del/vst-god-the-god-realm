/**
 * SoundRealm.tsx — God Realm Polyphonic Synthesizer
 *
 * 2 Oscillators, Filter (LP/HP/BP/NT), ADSR, LFO (Pitch/Filter/Amp),
 * FX chain (Reverb, Delay, Phaser, Chorus, Saturation, Ring Mod),
 * Master Limiter, Tab-isolation gain (silenced when not active).
 *
 * Isolated MIDI: responds to neuralInputBus ONLY when isActiveTab is true.
 * State persists to localStorage so patches survive tab switches.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { neuralInputBus } from '../services/neuralInputBus';
import { audioEngine } from '../services/audioEngine';
import './SoundRealm.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type WaveType    = 'sine' | 'triangle' | 'sawtooth' | 'square';
type FilterType  = 'lowpass' | 'highpass' | 'bandpass' | 'notch';
type LFOTarget   = 'pitch' | 'filter' | 'amp';

interface SRParams {
  // Oscillator 1
  osc1Wave: WaveType;
  osc1Oct:  number;
  osc1Semi: number;
  osc1Vol:  number;
  // Oscillator 2
  osc2On:   boolean;
  osc2Wave: WaveType;
  osc2Oct:  number;
  osc2Semi: number;
  osc2Vol:  number;
  // Filter
  fltType:   FilterType;
  fltCutoff: number;
  fltRes:    number;
  fltEnv:    number;
  // Envelope (ADSR) in seconds
  attack:   number;
  decay:    number;
  sustain:  number;
  release:  number;
  // LFO
  lfoRate:   number;
  lfoDepth:  number;
  lfoWave:   WaveType;
  lfoTarget: LFOTarget;
  // FX
  revMix: number;
  delMix: number;
  delTime: number;
  delFB:   number;
  // Extended FX (God Realm FX Suite)
  phasEnabled: boolean;
  phasRate:    number;
  phasDepth:   number;
  chorEnabled: boolean;
  chorRate:    number;
  chorDepth:   number;
  chorMix:     number;
  satEnabled:  boolean;
  satDrive:    number;
  satMix:      number;
  ringEnabled: boolean;
  ringFreq:    number;
  ringMix:     number;
  // ── PEDAL FX (TONEFLX + HZE + Portal) ──────────────────────────────────────
  // Tape (TONEFLX Tape · HZE Heatwave)
  tapeEnabled: boolean; tapeWow: number; tapeFlutter: number; tapeNoise: number; tapeDrive: number; tapeMix: number;
  // Lo-Fi / Bitstream (TONEFLX Resampler · HZE Bitstream)
  lofiEnabled: boolean; lofiBits: number; lofiNoise: number; lofiMix: number;
  // Tremolo (HZE Cycles)
  tremEnabled: boolean; tremRate: number; tremDepth: number;
  // Shimmer Reverb (HZE SpectraVerb)
  shimEnabled: boolean; shimMix: number; shimSize: number; shimBrightness: number;
  // Dark Void (HZE DarkVoid)
  darkVoidEnabled: boolean; darkVoidMix: number; darkVoidFreeze: number;
  // Stereo Width (TONEFLX Width)
  widthEnabled: boolean; widthAmt: number;
  // Warp / Portal pitch swell (Output Portal)
  warpEnabled: boolean; warpRate: number; warpDepth: number;
  // Pitch offset (TONEFLX Pitch · HZE Stepshifter)
  pitchSemi: number; pitchCents: number;
  // Halftime (0.5x playback rate, pitch drops an octave)
  halftimeEnabled: boolean;
  // Poly/Mono
  playMode: 'poly' | 'mono';
  // Master
  vol: number;
  limiterEnabled: boolean;
}

const DEFAULT_PARAMS: SRParams = {
  osc1Wave: 'sawtooth', osc1Oct: 0, osc1Semi: 0, osc1Vol: 0.55,
  osc2On: false, osc2Wave: 'square', osc2Oct: 0, osc2Semi: 7, osc2Vol: 0.35,
  fltType: 'lowpass', fltCutoff: 3000, fltRes: 2, fltEnv: 800,
  attack: 0.01, decay: 0.25, sustain: 0.65, release: 0.5,
  lfoRate: 3, lfoDepth: 0, lfoWave: 'sine', lfoTarget: 'pitch',
  revMix: 0.15, delMix: 0, delTime: 0.375, delFB: 0.35,
  phasEnabled: false, phasRate: 0.5, phasDepth: 0.7,
  chorEnabled: false, chorRate: 1.2, chorDepth: 0.35, chorMix: 0.4,
  satEnabled: false, satDrive: 3, satMix: 0.5,
  ringEnabled: false, ringFreq: 120, ringMix: 0.3,
  tapeEnabled: false, tapeWow: 0.4, tapeFlutter: 0.3, tapeNoise: 0.02, tapeDrive: 2, tapeMix: 0.5,
  lofiEnabled: false, lofiBits: 8, lofiNoise: 0.01, lofiMix: 0.5,
  tremEnabled: false, tremRate: 4, tremDepth: 0.5,
  shimEnabled: false, shimMix: 0.3, shimSize: 3, shimBrightness: 60,
  darkVoidEnabled: false, darkVoidMix: 0.3, darkVoidFreeze: 0.5,
  widthEnabled: false, widthAmt: 15,
  warpEnabled: false, warpRate: 0.25, warpDepth: 200,
  pitchSemi: 0, pitchCents: 0,
  halftimeEnabled: false,
  playMode: 'poly',
  vol: 0.5,
  limiterEnabled: true,
};

const STORAGE_KEY = 'vst-god-sound-realm-params-v1';

// ─── Piano key definitions (5 octaves: C2–B6) ────────────────────────────────

const PIANO_KEYS = (() => {
  const keys: { midi: number; name: string; octave: number; isBlack: boolean }[] = [];
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  for (let octave = 2; octave <= 6; octave++) {
    for (let n = 0; n < 12; n++) {
      const midi = (octave + 1) * 12 + n;
      keys.push({ midi, name: names[n], octave, isBlack: names[n].includes('#') });
    }
  }
  return keys;
})();

// ─── Curve helpers ────────────────────────────────────────────────────────────

function makeSaturationCurve(drive: number, samples = 256): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.atan(x * drive) / Math.atan(drive);
  }
  return curve;
}

function makeLoFiCurve(bits: number): Float32Array {
  const N = 512; const curve = new Float32Array(N);
  const steps = Math.pow(2, Math.max(2, Math.round(bits)));
  for (let i = 0; i < N; i++) {
    const x = (i * 2) / N - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

function makeShimmerIR(ctx: AudioContext, size: number, brightness: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * size));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp(-t * (2.5 / size));
      const hi = Math.sin(i * brightness * 0.0025) * 0.45;
      d[i] = ((Math.random() * 2 - 1) * 0.55 + hi) * env * (ch === 0 ? 1 : -0.97);
    }
    for (let i = 1; i < len; i++) d[i] = d[i] * 0.65 + d[i - 1] * 0.35;
  }
  return buf;
}

function makeDarkVoidIR(ctx: AudioContext, freeze: number): AudioBuffer {
  const duration = 4 + freeze * 14;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const decayRate = 0.6 / Math.max(0.1, 1 + freeze * 5);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * decayRate) * 0.45;
    }
    for (let i = 1; i < len; i++) d[i] = d[i] * 0.04 + d[i - 1] * 0.96;
  }
  return buf;
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ─── WebAudio Voice ───────────────────────────────────────────────────────────

class SRVoice {
  readonly filter:  BiquadFilterNode;
  readonly envGain: GainNode;
  private osc1: OscillatorNode;
  private osc2: OscillatorNode | null = null;
  private lfoSubs: GainNode[] = [];

  constructor(
    ctx: AudioContext,
    note: number,
    vel: number,
    p: SRParams,
    lfoGain: GainNode,
    dest: AudioNode,
    warpGain?: GainNode | null,
  ) {
    const now     = ctx.currentTime;
    const pitchOffset = (p.pitchSemi + p.pitchCents / 100) / 12;
    const halftimeFactor = p.halftimeEnabled ? 0.5 : 1;
    const baseHz  = 440 * Math.pow(2, (note - 69) / 12) * halftimeFactor;

    this.osc1 = ctx.createOscillator();
    this.osc1.type = p.osc1Wave;
    this.osc1.frequency.value = baseHz * Math.pow(2, p.osc1Oct + p.osc1Semi / 12 + pitchOffset);
    const g1 = ctx.createGain();
    g1.gain.value = p.osc1Vol;
    this.osc1.connect(g1);

    const mix = ctx.createGain();
    mix.gain.value = 1;
    g1.connect(mix);

    if (p.osc2On && p.osc2Vol > 0) {
      this.osc2 = ctx.createOscillator();
      this.osc2.type = p.osc2Wave;
      this.osc2.frequency.value = baseHz * Math.pow(2, p.osc2Oct + p.osc2Semi / 12 + pitchOffset);
      const g2 = ctx.createGain();
      g2.gain.value = p.osc2Vol;
      this.osc2.connect(g2);
      g2.connect(mix);
    }

    this.filter = ctx.createBiquadFilter();
    this.filter.type = p.fltType;
    const clampHz = (h: number) => Math.max(20, Math.min(20000, h));
    this.filter.frequency.value = clampHz(p.fltCutoff);
    this.filter.Q.value = Math.max(0, p.fltRes);
    mix.connect(this.filter);

    this.envGain = ctx.createGain();
    const peak = (vel / 127) * 0.85;
    const sus  = peak * Math.max(0, Math.min(1, p.sustain));
    const atk  = Math.max(0.001, p.attack);
    const dec  = Math.max(0.001, p.decay);
    this.envGain.gain.setValueAtTime(0, now);
    this.envGain.gain.linearRampToValueAtTime(peak, now + atk);
    this.envGain.gain.linearRampToValueAtTime(sus, now + atk + dec);
    this.filter.connect(this.envGain);
    this.envGain.connect(dest);

    if (Math.abs(p.fltEnv) > 1) {
      const peakF = clampHz(p.fltCutoff + p.fltEnv);
      this.filter.frequency.setValueAtTime(clampHz(p.fltCutoff), now);
      this.filter.frequency.linearRampToValueAtTime(peakF, now + atk);
      this.filter.frequency.linearRampToValueAtTime(clampHz(p.fltCutoff), now + atk + dec);
    }

    if (p.lfoDepth > 0.005) {
      const sc = ctx.createGain();
      this.lfoSubs.push(sc);
      lfoGain.connect(sc);
      if (p.lfoTarget === 'pitch') {
        sc.gain.value = 300 * p.lfoDepth;
        sc.connect(this.osc1.detune);
        if (this.osc2) sc.connect(this.osc2.detune);
      } else if (p.lfoTarget === 'filter') {
        sc.gain.value = 3000 * p.lfoDepth;
        sc.connect(this.filter.frequency);
      } else {
        sc.gain.value = 0.5 * p.lfoDepth;
        sc.connect(this.envGain.gain);
      }
    }

    // Warp LFO (Output Portal pitch swell)
    if (p.warpEnabled && warpGain) {
      const warpSub = ctx.createGain();
      warpGain.connect(warpSub);
      warpSub.gain.value = 1;
      warpSub.connect(this.osc1.detune);
      if (this.osc2) warpSub.connect(this.osc2.detune);
      this.lfoSubs.push(warpSub);
    }

    this.osc1.start(now);
    if (this.osc2) this.osc2.start(now);
  }

  release(rel: number) {
    const ctx = this.osc1.context as AudioContext;
    const now = ctx.currentTime;
    this.envGain.gain.cancelScheduledValues(now);
    this.envGain.gain.setValueAtTime(this.envGain.gain.value, now);
    this.envGain.gain.linearRampToValueAtTime(0, now + rel);
    const stop = now + rel + 0.06;
    try { this.osc1.stop(stop); } catch {}
    try { this.osc2?.stop(stop); } catch {}
    setTimeout(() => {
      this.lfoSubs.forEach(sc => { try { sc.disconnect(); } catch {} });
    }, (rel + 0.1) * 1000);
  }
}

// ─── Full Audio Engine ────────────────────────────────────────────────────────

class SoundRealmSynth {
  readonly ctx: AudioContext;
  private voices = new Map<number, SRVoice>();
  private lfoOsc:    OscillatorNode;
  readonly lfoGain:  GainNode;

  // Master bus
  private masterGain: GainNode;
  private tabGain:    GainNode;   // 0 when tab inactive
  private limiter:    DynamicsCompressorNode;

  // Send FX
  private revDelay: DelayNode;
  private revFB:    GainNode;
  private revWet:   GainNode;
  private delNode:  DelayNode;
  private delFBG:   GainNode;
  private delWet:   GainNode;

  // Insert FX — Phaser (4 all-pass stages)
  private phasIn:    GainNode;
  private phasOut:   GainNode;
  private phasStages: BiquadFilterNode[];
  private phasLfo:   OscillatorNode;
  private phasLfoG:  GainNode;

  // Insert FX — Chorus (stereo modulated delays)
  private chorDryG:  GainNode;
  private chorWetG:  GainNode;
  private chorDelL:  DelayNode;
  private chorDelR:  DelayNode;
  private chorLfoL:  OscillatorNode;
  private chorLfoR:  OscillatorNode;
  private chorGainL: GainNode;
  private chorGainR: GainNode;
  private chorSplit:  ChannelSplitterNode;
  private chorMerge:  ChannelMergerNode;

  // Insert FX — Saturation (WaveShaper)
  private satShaper: WaveShaperNode;
  private satDryG:   GainNode;
  private satWetG:   GainNode;

  // Insert FX — Ring Mod
  private ringMod:   OscillatorNode;
  private ringGainM: GainNode;
  private ringDryG:  GainNode;
  private ringWetG:  GainNode;

  // Post-FX bus (junction between existing and pedal FX)
  private postFXBus: GainNode;

  // Tape (TONEFLX Tape · HZE Heatwave)
  private tapeDelay:       DelayNode;
  private tapeWowLfo:      OscillatorNode;
  private tapeWowGain:     GainNode;
  private tapeFlutterLfo:  OscillatorNode;
  private tapeFlutterGain: GainNode;
  private tapeSat:         WaveShaperNode;
  private tapeDryG:        GainNode;
  private tapeWetG:        GainNode;
  private noiseSource:     AudioBufferSourceNode;
  private noiseGain:       GainNode;

  // Lo-Fi / Bitstream (TONEFLX Resampler · HZE Bitstream)
  private lofiShaper:    WaveShaperNode;
  private lofiDryG:      GainNode;
  private lofiWetG:      GainNode;
  private lofiNoiseSrc:  AudioBufferSourceNode;
  private lofiNoiseGain: GainNode;

  // Tremolo (HZE Cycles)
  private tremGain:    GainNode;
  private tremLfo:     OscillatorNode;
  private tremLfoGain: GainNode;

  // Shimmer Reverb (HZE SpectraVerb)
  private shimConv: ConvolverNode;
  private shimSend: GainNode;

  // Dark Void (HZE DarkVoid)
  private darkConv: ConvolverNode;
  private darkSend: GainNode;

  // Stereo Width (TONEFLX Width)
  private widthSplit: ChannelSplitterNode;
  private widthMerge: ChannelMergerNode;
  private widthDelay: DelayNode;
  private widthDryG:  GainNode;

  // Warp LFO (Output Portal pitch swell)
  private warpLfo:     OscillatorNode;
  readonly warpGainNode: GainNode;

  params: SRParams;

  constructor(p: SRParams) {
    this.params = { ...p };
    const ctx = audioEngine.ctx;
    this.ctx = ctx;
    audioEngine.resume();

    // ── Limiter (brick wall at -1 dBFS) ─────────────────────────────────────
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.08;
    this.limiter.connect(audioEngine.masterBus);

    // ── Tab isolation gain ──────────────────────────────────────────────────
    this.tabGain = ctx.createGain();
    this.tabGain.gain.value = 0; // silent until React activates this tab
    this.tabGain.connect(this.limiter);

    // ── Master volume ───────────────────────────────────────────────────────
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = p.vol;
    // masterGain → sends & inserts → tabGain

    // ── Send FX ────────────────────────────────────────────────────────────
    this.revDelay = ctx.createDelay(3.0);
    this.revFB    = ctx.createGain();
    this.revWet   = ctx.createGain();
    this.revDelay.delayTime.value = 0.08;
    this.revFB.gain.value  = Math.min(0.9, p.revMix * 0.8 + 0.15);
    this.revWet.gain.value = p.revMix;
    this.revDelay.connect(this.revFB);
    this.revFB.connect(this.revDelay);
    this.revDelay.connect(this.revWet);
    this.revWet.connect(this.tabGain);

    this.delNode = ctx.createDelay(2.0);
    this.delFBG  = ctx.createGain();
    this.delWet  = ctx.createGain();
    this.delNode.delayTime.value = p.delTime;
    this.delFBG.gain.value  = p.delFB;
    this.delWet.gain.value  = p.delMix;
    this.delNode.connect(this.delFBG);
    this.delFBG.connect(this.delNode);
    this.delNode.connect(this.delWet);
    this.delWet.connect(this.tabGain);

    // ── Ring Modulator ──────────────────────────────────────────────────────
    this.ringMod   = ctx.createOscillator();
    this.ringGainM = ctx.createGain();
    this.ringDryG  = ctx.createGain();
    this.ringWetG  = ctx.createGain();
    this.ringMod.frequency.value = p.ringFreq;
    this.ringMod.start();
    // Base gain = 0 so the carrier (connected to the AudioParam) drives it ±1.
    // This makes it a TRUE ring multiplier: output = audio × carrier.
    // Previously the carrier was an additive signal in the audio path, causing
    // it to bleed into masterBus at -10 dB even without notes playing.
    this.ringGainM.gain.value = 0;
    this.ringDryG.gain.value = p.ringEnabled ? 1 - p.ringMix : 1;
    this.ringWetG.gain.value = p.ringEnabled ? p.ringMix : 0;

    // ── Saturation ──────────────────────────────────────────────────────────
    this.satShaper = ctx.createWaveShaper();
    this.satShaper.curve = makeSaturationCurve(p.satDrive);
    this.satShaper.oversample = '4x';
    this.satDryG = ctx.createGain();
    this.satWetG = ctx.createGain();
    this.satDryG.gain.value = p.satEnabled ? 1 - p.satMix : 1;
    this.satWetG.gain.value = p.satEnabled ? p.satMix : 0;

    // ── Phaser ──────────────────────────────────────────────────────────────
    this.phasStages = [];
    this.phasIn  = ctx.createGain();
    this.phasOut = ctx.createGain();
    let phasChain: AudioNode = this.phasIn;
    for (let i = 0; i < 4; i++) {
      const ap = ctx.createBiquadFilter();
      ap.type = 'allpass';
      ap.frequency.value = 1000 + i * 500;
      ap.Q.value = 0.5;
      phasChain.connect(ap);
      phasChain = ap;
      this.phasStages.push(ap);
    }
    phasChain.connect(this.phasOut);

    this.phasLfo = ctx.createOscillator();
    this.phasLfoG = ctx.createGain();
    this.phasLfo.frequency.value = p.phasRate;
    this.phasLfoG.gain.value = p.phasEnabled ? p.phasDepth * 2000 : 0;
    this.phasLfo.connect(this.phasLfoG);
    this.phasStages.forEach(ap => this.phasLfoG.connect(ap.frequency));
    this.phasLfo.start();

    // ── Chorus ──────────────────────────────────────────────────────────────
    this.chorDryG  = ctx.createGain();
    this.chorWetG  = ctx.createGain();
    this.chorDelL  = ctx.createDelay(0.1);
    this.chorDelR  = ctx.createDelay(0.1);
    this.chorDelL.delayTime.value = 0.015;
    this.chorDelR.delayTime.value = 0.020;
    this.chorLfoL  = ctx.createOscillator();
    this.chorLfoR  = ctx.createOscillator();
    this.chorGainL = ctx.createGain();
    this.chorGainR = ctx.createGain();
    this.chorLfoL.frequency.value = p.chorRate;
    this.chorLfoR.frequency.value = p.chorRate * 1.1;
    this.chorGainL.gain.value = p.chorEnabled ? p.chorDepth * 0.01 : 0;
    this.chorGainR.gain.value = p.chorEnabled ? p.chorDepth * 0.01 : 0;
    this.chorLfoL.connect(this.chorGainL);
    this.chorLfoR.connect(this.chorGainR);
    this.chorGainL.connect(this.chorDelL.delayTime);
    this.chorGainR.connect(this.chorDelR.delayTime);
    this.chorLfoL.start();
    this.chorLfoR.start();
    this.chorSplit  = ctx.createChannelSplitter(2);
    this.chorMerge  = ctx.createChannelMerger(2);
    this.chorDryG.gain.value = 1;
    this.chorWetG.gain.value = p.chorEnabled ? p.chorMix : 0;
    this.chorSplit.connect(this.chorDelL, 0);
    this.chorSplit.connect(this.chorDelR, 1);
    this.chorDelL.connect(this.chorMerge, 0, 0);
    this.chorDelR.connect(this.chorMerge, 0, 1);

    // ── FX Insert chain: masterGain → ringDry/ringWet → satDry/satWet → phasIn → chorDry/chorWet → tabGain ──
    // Ring mod: master → ringDry (bypass) + [master → ringGainM (ring modulation)]
    // Ring mod modulates by multiplying: we use the oscillator as a gain modulator
    this.masterGain.connect(this.ringDryG);
    this.masterGain.connect(this.ringGainM);       // audio → ring multiplier input
    this.ringMod.connect(this.ringGainM.gain);     // carrier → AudioParam (multiplies audio)
    this.ringGainM.connect(this.ringWetG);
    // Both dry and wet ring paths → saturation input
    this.ringDryG.connect(this.satDryG);
    this.ringWetG.connect(this.satShaper);
    this.satShaper.connect(this.satWetG);
    this.satDryG.connect(this.phasIn);
    this.satWetG.connect(this.phasIn);
    // Phaser → chorus
    this.phasIn.connect(this.chorDryG);
    this.phasOut.connect(this.chorDryG);  // also add phased signal to chorus input
    this.chorDryG.connect(this.chorSplit);
    this.chorMerge.connect(this.chorWetG);
    // Both chorus paths → postFXBus (new pedal FX chain entry point)
    this.postFXBus = ctx.createGain(); this.postFXBus.gain.value = 1;
    this.chorDryG.connect(this.postFXBus);
    this.chorWetG.connect(this.postFXBus);
    // Send FX from master
    this.masterGain.connect(this.revDelay);
    this.masterGain.connect(this.delNode);

    // ── TAPE (TONEFLX Tape · HZE Heatwave) ───────────────────────────────────
    const noiseBuf = makeNoiseBuffer(ctx);
    this.tapeDelay = ctx.createDelay(0.06);
    this.tapeDelay.delayTime.value = 0.015;
    this.tapeWowLfo    = ctx.createOscillator(); this.tapeWowLfo.frequency.value = 0.5; this.tapeWowLfo.type = 'sine';
    this.tapeWowGain   = ctx.createGain(); this.tapeWowGain.gain.value = p.tapeEnabled ? p.tapeWow * 0.01 : 0;
    this.tapeFlutterLfo  = ctx.createOscillator(); this.tapeFlutterLfo.frequency.value = 12; this.tapeFlutterLfo.type = 'sine';
    this.tapeFlutterGain = ctx.createGain(); this.tapeFlutterGain.gain.value = p.tapeEnabled ? p.tapeFlutter * 0.0008 : 0;
    this.tapeWowLfo.connect(this.tapeWowGain); this.tapeWowGain.connect(this.tapeDelay.delayTime);
    this.tapeFlutterLfo.connect(this.tapeFlutterGain); this.tapeFlutterGain.connect(this.tapeDelay.delayTime);
    this.tapeSat = ctx.createWaveShaper(); this.tapeSat.curve = makeSaturationCurve(p.tapeDrive); this.tapeSat.oversample = '4x';
    this.tapeDryG = ctx.createGain(); this.tapeDryG.gain.value = p.tapeEnabled ? 1 - p.tapeMix : 1;
    this.tapeWetG = ctx.createGain(); this.tapeWetG.gain.value = p.tapeEnabled ? p.tapeMix : 0;
    // Tape noise
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuf; this.noiseSource.loop = true;
    this.noiseGain = ctx.createGain(); this.noiseGain.gain.value = p.tapeEnabled ? p.tapeNoise * 0.05 : 0;
    this.noiseSource.connect(this.noiseGain);
    this.tapeWowLfo.start(); this.tapeFlutterLfo.start(); this.noiseSource.start();
    const tapeOut = ctx.createGain();
    this.postFXBus.connect(this.tapeDelay); this.tapeDelay.connect(this.tapeSat); this.tapeSat.connect(this.tapeWetG); this.tapeWetG.connect(tapeOut);
    this.postFXBus.connect(this.tapeDryG); this.tapeDryG.connect(tapeOut);
    this.noiseGain.connect(tapeOut);

    // ── LO-FI / BITSTREAM (TONEFLX Resampler · HZE Bitstream) ───────────────
    this.lofiShaper = ctx.createWaveShaper(); this.lofiShaper.curve = makeLoFiCurve(p.lofiBits);
    this.lofiDryG = ctx.createGain(); this.lofiDryG.gain.value = p.lofiEnabled ? 1 - p.lofiMix : 1;
    this.lofiWetG = ctx.createGain(); this.lofiWetG.gain.value = p.lofiEnabled ? p.lofiMix : 0;
    this.lofiNoiseSrc = ctx.createBufferSource();
    this.lofiNoiseSrc.buffer = noiseBuf; this.lofiNoiseSrc.loop = true; this.lofiNoiseSrc.start();
    this.lofiNoiseGain = ctx.createGain(); this.lofiNoiseGain.gain.value = p.lofiEnabled ? p.lofiNoise * 0.04 : 0;
    this.lofiNoiseSrc.connect(this.lofiNoiseGain);
    const lofiOut = ctx.createGain();
    tapeOut.connect(this.lofiShaper); this.lofiShaper.connect(this.lofiWetG); this.lofiWetG.connect(lofiOut);
    tapeOut.connect(this.lofiDryG); this.lofiDryG.connect(lofiOut);
    this.lofiNoiseGain.connect(lofiOut);

    // ── TREMOLO (HZE Cycles) ─────────────────────────────────────────────────
    // tremGain base must be 1 when disabled; LFO modulates it down to 0 at full depth when enabled
    this.tremGain = ctx.createGain(); this.tremGain.gain.value = p.tremEnabled ? 0.5 : 1;
    this.tremLfo = ctx.createOscillator(); this.tremLfo.frequency.value = p.tremRate; this.tremLfo.type = 'sine';
    this.tremLfoGain = ctx.createGain(); this.tremLfoGain.gain.value = p.tremEnabled ? p.tremDepth * 0.5 : 0;
    this.tremLfo.connect(this.tremLfoGain); this.tremLfoGain.connect(this.tremGain.gain);
    this.tremLfo.start();
    lofiOut.connect(this.tremGain);

    // ── STEREO WIDTH (TONEFLX Width) ─────────────────────────────────────────
    this.widthSplit = ctx.createChannelSplitter(2);
    this.widthMerge = ctx.createChannelMerger(2);
    this.widthDelay = ctx.createDelay(0.05); this.widthDelay.delayTime.value = p.widthEnabled ? p.widthAmt / 1000 : 0;
    this.widthDryG  = ctx.createGain(); this.widthDryG.gain.value = 1;
    this.tremGain.connect(this.widthSplit);
    this.widthSplit.connect(this.widthMerge, 0, 0);        // L straight through
    this.widthSplit.connect(this.widthDelay, 1);            // R through delay
    this.widthDelay.connect(this.widthMerge, 0, 1);
    this.widthMerge.connect(this.tabGain);

    // ── SHIMMER REVERB (HZE SpectraVerb) ─────────────────────────────────────
    // IR is built lazily the first time shimmer is enabled to avoid blocking main thread on mount
    this.shimConv = ctx.createConvolver();
    this.shimSend = ctx.createGain(); this.shimSend.gain.value = 0;
    this.masterGain.connect(this.shimSend); this.shimSend.connect(this.shimConv); this.shimConv.connect(this.tabGain);

    // ── DARK VOID (HZE DarkVoid) ─────────────────────────────────────────────
    this.darkConv = ctx.createConvolver();
    this.darkSend = ctx.createGain(); this.darkSend.gain.value = 0;
    this.masterGain.connect(this.darkSend); this.darkSend.connect(this.darkConv); this.darkConv.connect(this.tabGain);

    // ── WARP LFO (Output Portal pitch swell) ─────────────────────────────────
    this.warpLfo = ctx.createOscillator(); this.warpLfo.frequency.value = p.warpRate; this.warpLfo.type = 'sine';
    this.warpGainNode = ctx.createGain(); this.warpGainNode.gain.value = p.warpEnabled ? p.warpDepth : 0;
    this.warpLfo.connect(this.warpGainNode);
    this.warpLfo.start();

    // ── LFO ─────────────────────────────────────────────────────────────────
    this.lfoOsc  = ctx.createOscillator();
    this.lfoGain = ctx.createGain();
    this.lfoOsc.type = p.lfoWave;
    this.lfoOsc.frequency.value = p.lfoRate;
    this.lfoGain.gain.value = 1;
    this.lfoOsc.connect(this.lfoGain);
    this.lfoOsc.start();
  }

  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }

  setTabActive(active: boolean) {
    const t = this.ctx.currentTime;
    if (!active) {
      this.noteOffAll();
      this.tabGain.gain.setTargetAtTime(0, t, 0.05);
    } else {
      this.tabGain.gain.setTargetAtTime(1, t, 0.05);
      this.resume();
    }
  }

  noteOn(note: number, vel = 100) {
    this.resume();
    if (this.params.playMode === 'mono') {
      this.noteOffAll();
    } else {
      const existing = this.voices.get(note);
      if (existing) { existing.release(0.02); this.voices.delete(note); }
    }
    const voice = new SRVoice(this.ctx, note, vel, this.params, this.lfoGain, this.masterGain, this.warpGainNode);
    this.voices.set(note, voice);
  }

  noteOff(note: number) {
    const v = this.voices.get(note);
    if (v) { v.release(this.params.release); this.voices.delete(note); }
  }

  noteOffAll() {
    this.voices.forEach(v => { try { v.release(0.05); } catch {} });
    this.voices.clear();
  }

  updateParams(p: SRParams) {
    this.params = { ...p };
    const t = this.ctx.currentTime;

    this.masterGain.gain.setTargetAtTime(p.vol, t, 0.01);

    // Limiter on/off: ratio 20 = brick wall, ratio 1 = bypassed
    this.limiter.ratio.setTargetAtTime(p.limiterEnabled !== false ? 20 : 1, t, 0.01);
    this.limiter.threshold.setTargetAtTime(p.limiterEnabled !== false ? -3 : 0, t, 0.01);
    this.revWet.gain.setTargetAtTime(p.revMix, t, 0.01);
    this.revFB.gain.setTargetAtTime(Math.min(0.9, p.revMix * 0.8 + 0.15), t, 0.01);
    this.delNode.delayTime.setTargetAtTime(p.delTime, t, 0.05);
    this.delFBG.gain.setTargetAtTime(p.delFB, t, 0.01);
    this.delWet.gain.setTargetAtTime(p.delMix, t, 0.01);
    this.lfoOsc.frequency.setTargetAtTime(p.lfoRate, t, 0.01);
    if (this.lfoOsc.type !== p.lfoWave) this.lfoOsc.type = p.lfoWave;

    // Phaser
    this.phasLfo.frequency.setTargetAtTime(p.phasRate, t, 0.05);
    this.phasLfoG.gain.setTargetAtTime(p.phasEnabled ? p.phasDepth * 2000 : 0, t, 0.05);

    // Chorus
    this.chorLfoL.frequency.setTargetAtTime(p.chorRate, t, 0.05);
    this.chorLfoR.frequency.setTargetAtTime(p.chorRate * 1.1, t, 0.05);
    this.chorGainL.gain.setTargetAtTime(p.chorEnabled ? p.chorDepth * 0.01 : 0, t, 0.05);
    this.chorGainR.gain.setTargetAtTime(p.chorEnabled ? p.chorDepth * 0.01 : 0, t, 0.05);
    this.chorWetG.gain.setTargetAtTime(p.chorEnabled ? p.chorMix : 0, t, 0.05);

    // Saturation
    this.satShaper.curve = makeSaturationCurve(p.satDrive);
    this.satWetG.gain.setTargetAtTime(p.satEnabled ? p.satMix : 0, t, 0.05);
    this.satDryG.gain.setTargetAtTime(p.satEnabled ? (1 - p.satMix) : 1, t, 0.05);

    // Ring mod
    this.ringMod.frequency.setTargetAtTime(p.ringFreq, t, 0.05);
    this.ringWetG.gain.setTargetAtTime(p.ringEnabled ? p.ringMix : 0, t, 0.05);
    this.ringDryG.gain.setTargetAtTime(p.ringEnabled ? (1 - p.ringMix) : 1, t, 0.05);

    this.voices.forEach(v => {
      v.filter.frequency.setTargetAtTime(Math.max(20, Math.min(20000, p.fltCutoff)), t, 0.05);
      v.filter.Q.setTargetAtTime(Math.max(0, p.fltRes), t, 0.05);
      if (v.filter.type !== p.fltType) v.filter.type = p.fltType;
    });

    // ── Tape ─────────────────────────────────────────────────────────────────
    this.tapeWowGain.gain.setTargetAtTime(p.tapeEnabled ? p.tapeWow * 0.01 : 0, t, 0.05);
    this.tapeFlutterGain.gain.setTargetAtTime(p.tapeEnabled ? p.tapeFlutter * 0.0008 : 0, t, 0.05);
    this.tapeSat.curve = makeSaturationCurve(p.tapeDrive);
    this.tapeDryG.gain.setTargetAtTime(p.tapeEnabled ? 1 - p.tapeMix : 1, t, 0.05);
    this.tapeWetG.gain.setTargetAtTime(p.tapeEnabled ? p.tapeMix : 0, t, 0.05);
    this.noiseGain.gain.setTargetAtTime(p.tapeEnabled ? p.tapeNoise * 0.05 : 0, t, 0.05);

    // ── Lo-Fi ────────────────────────────────────────────────────────────────
    this.lofiShaper.curve = makeLoFiCurve(p.lofiBits);
    this.lofiDryG.gain.setTargetAtTime(p.lofiEnabled ? 1 - p.lofiMix : 1, t, 0.05);
    this.lofiWetG.gain.setTargetAtTime(p.lofiEnabled ? p.lofiMix : 0, t, 0.05);
    this.lofiNoiseGain.gain.setTargetAtTime(p.lofiEnabled ? p.lofiNoise * 0.04 : 0, t, 0.05);

    // ── Tremolo ──────────────────────────────────────────────────────────────
    this.tremLfo.frequency.setTargetAtTime(p.tremRate, t, 0.05);
    // When enabled: base=0.5, LFO modulates ±0.5*depth giving 0..1 range
    // When disabled: base=1, LFO=0 so signal passes through at full volume
    this.tremGain.gain.setTargetAtTime(p.tremEnabled ? 0.5 : 1, t, 0.05);
    this.tremLfoGain.gain.setTargetAtTime(p.tremEnabled ? p.tremDepth * 0.5 : 0, t, 0.05);

    // ── Width ─────────────────────────────────────────────────────────────────
    this.widthDelay.delayTime.setTargetAtTime(p.widthEnabled ? p.widthAmt / 1000 : 0, t, 0.05);

    // ── Shimmer (lazy IR build) ───────────────────────────────────────────────
    if (p.shimEnabled && !this.shimConv.buffer) {
      setTimeout(() => { try { this.shimConv.buffer = makeShimmerIR(this.ctx, p.shimSize, p.shimBrightness); } catch {} }, 0);
    }
    this.shimSend.gain.setTargetAtTime(p.shimEnabled ? p.shimMix : 0, t, 0.05);

    // ── Dark Void (lazy IR build) ─────────────────────────────────────────────
    if (p.darkVoidEnabled && !this.darkConv.buffer) {
      setTimeout(() => { try { this.darkConv.buffer = makeDarkVoidIR(this.ctx, p.darkVoidFreeze); } catch {} }, 0);
    }
    this.darkSend.gain.setTargetAtTime(p.darkVoidEnabled ? p.darkVoidMix : 0, t, 0.05);

    // ── Warp ──────────────────────────────────────────────────────────────────
    this.warpLfo.frequency.setTargetAtTime(p.warpRate, t, 0.05);
    this.warpGainNode.gain.setTargetAtTime(p.warpEnabled ? p.warpDepth : 0, t, 0.05);
  }

  dispose() {
    this.noteOffAll();
    const stopAll = [
      this.lfoOsc, this.phasLfo, this.chorLfoL, this.chorLfoR, this.ringMod,
      this.tapeWowLfo, this.tapeFlutterLfo, this.tremLfo, this.warpLfo,
    ];
    stopAll.forEach(o => { try { o.stop(); } catch {} });
    try { this.noiseSource.stop(); } catch {}
    try { this.lofiNoiseSrc.stop(); } catch {}
    // Do NOT close this.ctx — it is the shared audioEngine.ctx singleton.
    // Closing it would destroy the capture worklet and every other instrument.
  }
}

// ─── Knob component ──────────────────────────────────────────────────────────

interface KnobProps {
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  step?:    number;
  onChange: (v: number) => void;
  color?:   string;
  unit?:    string;
  display?: (v: number) => string;
}

// God sigils — a small glyph engraved in the centre of each knob.
const GOD_SIGILS: Record<string, string> = {
  // Zeus — lightning bolt
  zeus: 'M13 3 L6 13 L11 13 L9 21 L18 10 L12.5 10 L15 3 Z',
  // Poseidon — trident (stroked)
  poseidon: 'M12 21 V8 M7 9 Q7 4 12 4 Q17 4 17 9 M7 9 V6 M17 9 V6 M12 8 L9.5 5 M12 8 L14.5 5',
  // Hades — flame
  hades: 'M12 3 C15 8 17 9 15.5 14 C14.8 17 13 17.5 12 21 C11 17.5 9.2 17 8.5 14 C7 9 11 9 12 3 Z',
  // Apollo — sun rays
  apollo: 'M12 7 A5 5 0 1 0 12 17 A5 5 0 1 0 12 7 M12 1 V4 M12 20 V23 M1 12 H4 M20 12 H23 M4 4 L6 6 M18 18 L20 20 M20 4 L18 6 M6 18 L4 20',
};

let _srKnobIdSeq = 0;

interface GodKnobProps extends KnobProps { god?: keyof typeof GOD_SIGILS; size?: number; }

function SRKnob({ label, value, min, max, step = 0, onChange, color = '#a855f7', unit = '', display, god = 'zeus', size = 62 }: GodKnobProps) {
  const pct      = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const rotation = -135 + pct * 270; // 0 = pointing up
  const dragRef  = useRef({ startY: 0, startVal: 0 });
  const [hover, setHover] = useState(false);
  const uid = useRef(`srk${++_srKnobIdSeq}`).current;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startVal: value };
    const onMove = (me: MouseEvent) => {
      const delta = (dragRef.current.startY - me.clientY) / 150 * (max - min);
      let next    = dragRef.current.startVal + delta;
      if (step > 0) next = Math.round(next / step) * step;
      onChange(Math.max(min, Math.min(max, next)));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [value, min, max, step, onChange]);

  const shown = display
    ? display(value)
    : Math.abs(max - min) >= 100
      ? Math.round(value).toString()
      : value.toFixed(2);

  // Geometry — 270° arc with the gap centred at the bottom.
  const C = 36, R = 26;                       // centre, radius for the value arc
  const circ = 2 * Math.PI * R;
  const trackLen = circ * 0.75;               // 270°
  const sigilStroked = god !== 'zeus' && god !== 'hades'; // trident & apollo render as strokes

  // 24 laurel ticks around the rim
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (-135 + (i / 23) * 270) * Math.PI / 180; // along the active sweep
    const inner = R + 4, outer = R + 7.5;
    const sx = C + Math.sin(a) * inner, sy = C - Math.cos(a) * inner;
    const ex = C + Math.sin(a) * outer, ey = C - Math.cos(a) * outer;
    const lit = (i / 23) <= pct;
    return <line key={i} x1={sx} y1={sy} x2={ex} y2={ey} stroke={lit ? color : 'rgba(212,175,55,0.28)'} strokeWidth={1.1} strokeLinecap="round" opacity={lit ? 0.9 : 0.6} />;
  });

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'ns-resize', userSelect: 'none', width: size + 6 }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${label}: ${shown}${unit}`}
    >
      <svg width={size} height={size} viewBox="0 0 72 72" style={{ overflow: 'visible', transition: 'filter .2s', filter: hover ? `drop-shadow(0 0 6px ${color})` : 'none' }}>
        <defs>
          <radialGradient id={`${uid}-face`} cx="42%" cy="36%" r="70%">
            <stop offset="0%" stopColor="#2a2740" />
            <stop offset="55%" stopColor="#15131f" />
            <stop offset="100%" stopColor="#070610" />
          </radialGradient>
          <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7e7a3" />
            <stop offset="45%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#7d5a16" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* laurel ticks */}
        <g>{ticks}</g>

        {/* outer gold rim */}
        <circle cx={C} cy={C} r={R + 1.5} fill="none" stroke={`url(#${uid}-gold)`} strokeWidth={2.4} />

        {/* dark inset track */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={4}
          strokeDasharray={`${trackLen} ${circ}`} strokeLinecap="round"
          transform={`rotate(135 ${C} ${C})`} />

        {/* glowing value arc */}
        <circle cx={C} cy={C} r={R} fill="none" stroke={color} strokeWidth={3.4}
          strokeDasharray={`${pct * trackLen} ${circ}`} strokeLinecap="round"
          transform={`rotate(135 ${C} ${C})`} filter={`url(#${uid}-glow)`} />

        {/* obsidian face */}
        <circle cx={C} cy={C} r={R - 4} fill={`url(#${uid}-face)`} stroke="rgba(212,175,55,0.35)" strokeWidth={0.8} />

        {/* god sigil */}
        <g transform={`translate(${C - 12} ${C - 12}) scale(1)`} opacity={0.92}>
          <path d={GOD_SIGILS[god]} fill={sigilStroked ? 'none' : color}
            stroke={color} strokeWidth={sigilStroked ? 1.6 : 0.5}
            strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 3px ${color}aa)` }} />
        </g>

        {/* pointer */}
        <g transform={`rotate(${rotation} ${C} ${C})`}>
          <line x1={C} y1={C - 6} x2={C} y2={C - (R - 6)} stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.9} filter={`url(#${uid}-glow)`} />
          <circle cx={C} cy={C - (R - 6)} r={2} fill="#fff" filter={`url(#${uid}-glow)`} />
        </g>
      </svg>
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color, textShadow: `0 0 6px ${color}66` }}>{shown}{unit}</div>
    </div>
  );
}

// ─── Wave selector ────────────────────────────────────────────────────────────

const WAVE_ICONS: Record<WaveType, string> = { sine: '∿', triangle: '△', sawtooth: '⊿', square: '⊓' };

function WaveRow({ value, onChange }: { value: WaveType; onChange: (w: WaveType) => void }) {
  return (
    <div className="sr-wave-row">
      {(['sine', 'triangle', 'sawtooth', 'square'] as WaveType[]).map(w => (
        <button key={w} className={`sr-wave-btn ${value === w ? 'sr-wave-btn--active' : ''}`} onClick={() => onChange(w)} title={w}>
          {WAVE_ICONS[w]}
        </button>
      ))}
    </div>
  );
}

// ─── Segment button bar ───────────────────────────────────────────────────────

function SegBtns<T extends string>({ value, options, labels, onChange }: { value: T; options: T[]; labels?: string[]; onChange: (v: T) => void }) {
  return (
    <div className="sr-seg-btns">
      {options.map((opt, i) => (
        <button key={opt} className={`sr-seg-btn ${value === opt ? 'sr-seg-btn--active' : ''}`} onClick={() => onChange(opt)}>
          {labels ? labels[i] : opt}
        </button>
      ))}
    </div>
  );
}

// ─── FX Toggle ───────────────────────────────────────────────────────────────

function FXToggle({ active, label, color, onClick }: { active: boolean; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`sr-fx-toggle ${active ? 'sr-fx-toggle--on' : ''}`}
      style={{ ['--fx-color' as any]: color }}
    >
      <span className="sr-fx-toggle__dot" />
      {label}
    </button>
  );
}

// ─── Multi-Effect 3D Waveform Visualizer ─────────────────────────────────────

// Each visualizer "effect" is now an ancient god whose glowing face reacts to
// what you play. Cycle through the pantheon with the selector below the synth.
const VIZ_EFFECTS = ['ZEUS', 'POSEIDON', 'HADES', 'APOLLO', 'ATHENA'];

type GodFace = { name: string; col: [number, number, number]; crown: 'bolts' | 'trident' | 'flames' | 'sun' | 'helmet'; beard: boolean };
const GOD_FACES: GodFace[] = [
  { name: 'ZEUS',     col: [150, 200, 255], crown: 'bolts',   beard: true  },
  { name: 'POSEIDON', col: [64, 224, 208],  crown: 'trident', beard: true  },
  { name: 'HADES',    col: [220, 70, 90],   crown: 'flames',  beard: true  },
  { name: 'APOLLO',   col: [255, 200, 90],  crown: 'sun',     beard: false },
  { name: 'ATHENA',   col: [120, 230, 170], crown: 'helmet',  beard: false },
];

// Draw a stylized, glowing ancient-god face that pulses with playing energy.
// g = energy 0..1, ph = animation phase. Symmetric line-art so it reads clearly.
function drawGodFace(ctx: CanvasRenderingContext2D, W: number, H: number, godIdx: number, ph: number, g: number) {
  const god = GOD_FACES[godIdx % GOD_FACES.length];
  const [r, gg, b] = god.col;
  const rgba = (a: number) => `rgba(${r},${gg},${b},${a})`;
  const cx = W / 2, cy = H * 0.58;
  const pulse = 1 + Math.sin(ph * 2) * 0.015 + g * 0.05;
  const fH = H * 0.6 * pulse, fW = fH * 0.6;

  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const glowOn  = (blur: number, a = 0.8) => { ctx.shadowColor = rgba(a); ctx.shadowBlur = blur * (0.45 + g); };
  const glowOff = () => { ctx.shadowBlur = 0; };

  // Halo
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, fH);
  halo.addColorStop(0, rgba(0.16 + g * 0.32));
  halo.addColorStop(0.55, rgba(0.04 + g * 0.10));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);

  // ── Crown / headpiece (behind the face) ──
  const topY = cy - fH * 0.5;
  ctx.save();
  if (god.crown === 'sun') {
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + ph * 0.2;
      const r1 = fW * 0.52, r2 = fW * (0.7 + (i % 2 ? 0.22 : 0.1)) * (0.85 + g * 0.3);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 1.05);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 1.05);
      ctx.strokeStyle = rgba(0.25 + g * 0.5); ctx.lineWidth = i % 2 ? 2 : 1; glowOn(8); ctx.stroke();
    }
    glowOff();
  } else if (god.crown === 'bolts') {
    for (let i = -2; i <= 2; i++) {
      const bx = cx + i * fW * 0.22;
      let x = bx, y = topY + 4;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += (Math.random() - 0.5) * 10; y -= fH * 0.11; ctx.lineTo(x, y); }
      ctx.strokeStyle = rgba(0.55 + g * 0.45); ctx.lineWidth = 2; glowOn(12); ctx.stroke();
    }
    glowOff();
  } else if (god.crown === 'trident') {
    const ty = topY - fH * 0.18;
    for (const sx of [-1, 0, 1]) {
      const px = cx + sx * fW * 0.26;
      ctx.beginPath(); ctx.moveTo(px, topY + 6); ctx.lineTo(px, ty);
      ctx.strokeStyle = rgba(0.5 + g * 0.4); ctx.lineWidth = 2.4; glowOn(9); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx - fW * 0.26, topY + 6); ctx.lineTo(cx + fW * 0.26, topY + 6);
    ctx.stroke(); glowOff();
  } else if (god.crown === 'flames') {
    for (let i = -2; i <= 2; i++) {
      const fx = cx + i * fW * 0.2;
      const fhh = fH * (0.22 + Math.abs(Math.sin(ph * 3 + i)) * 0.12) * (0.6 + g * 0.6);
      ctx.beginPath();
      ctx.moveTo(fx - 6, topY + 6);
      ctx.quadraticCurveTo(fx + Math.sin(ph * 4 + i) * 8, topY - fhh * 0.5, fx, topY - fhh);
      ctx.quadraticCurveTo(fx - Math.sin(ph * 4 + i) * 8, topY - fhh * 0.5, fx + 6, topY + 6);
      ctx.strokeStyle = rgba(0.45 + g * 0.5); ctx.lineWidth = 2; glowOn(12); ctx.stroke();
    }
    glowOff();
  } else if (god.crown === 'helmet') {
    ctx.beginPath();
    ctx.arc(cx, cy - fH * 0.12, fW * 0.56, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = rgba(0.5 + g * 0.35); ctx.lineWidth = 3; glowOn(8); ctx.stroke();
    // crest plume
    ctx.beginPath(); ctx.moveTo(cx, topY - fH * 0.16);
    ctx.quadraticCurveTo(cx + fW * 0.3, topY - fH * 0.05, cx + fW * 0.12, topY + fH * 0.08);
    ctx.strokeStyle = rgba(0.4 + g * 0.4); ctx.lineWidth = 4; ctx.stroke(); glowOff();
  }
  ctx.restore();

  // ── Face outline ──
  ctx.beginPath();
  ctx.ellipse(cx, cy, fW * 0.5, fH * 0.5, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(0.5 + g * 0.4); ctx.lineWidth = 2; glowOn(7); ctx.stroke(); glowOff();

  // ── Eyes ──
  const eyeY = cy - fH * 0.04, eyeDX = fW * 0.2, eyeW = fW * 0.15, eyeH = fH * 0.055;
  for (const sx of [-1, 1]) {
    const ex = cx + sx * eyeDX;
    ctx.beginPath(); ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(0.55); ctx.lineWidth = 1.4; ctx.stroke();
    const pg = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, eyeW);
    pg.addColorStop(0, rgba(0.55 + g * 0.45)); pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg; glowOn(10);
    ctx.beginPath(); ctx.arc(ex, eyeY, eyeW * (0.5 + g * 0.15), 0, Math.PI * 2); ctx.fill(); glowOff();
  }
  // Brow
  ctx.beginPath();
  ctx.moveTo(cx - eyeDX - eyeW, eyeY - eyeH - 3);
  ctx.quadraticCurveTo(cx, eyeY - eyeH - 9, cx + eyeDX + eyeW, eyeY - eyeH - 3);
  ctx.strokeStyle = rgba(0.4); ctx.lineWidth = 2; ctx.stroke();

  // ── Nose ──
  ctx.beginPath();
  ctx.moveTo(cx, eyeY - 2);
  ctx.lineTo(cx - fW * 0.07, cy + fH * 0.14);
  ctx.lineTo(cx + fW * 0.07, cy + fH * 0.14);
  ctx.strokeStyle = rgba(0.38); ctx.lineWidth = 1.4; ctx.stroke();

  // ── Mouth ──
  ctx.beginPath();
  ctx.moveTo(cx - fW * 0.12, cy + fH * 0.24);
  ctx.quadraticCurveTo(cx, cy + fH * 0.27, cx + fW * 0.12, cy + fH * 0.24);
  ctx.strokeStyle = rgba(0.38); ctx.lineWidth = 1.4; ctx.stroke();

  // ── Beard ──
  if (god.beard) {
    const by = cy + fH * 0.28;
    for (let i = 0; i < 9; i++) {
      const t = i / 8, bx = cx + (t - 0.5) * fW * 0.85;
      const wob = Math.sin(ph * 2 + i) * 4 * (0.5 + g);
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + wob, by + fH * 0.2, cx + (t - 0.5) * fW * 0.35, by + fH * 0.36 - Math.abs(t - 0.5) * fH * 0.3);
      ctx.strokeStyle = rgba(0.28 + g * 0.32); ctx.lineWidth = 1.4; glowOn(5, 0.5); ctx.stroke();
    }
    glowOff();
  }
}

interface RealmVizProps { isPlaying: boolean; effectIndex: number; }

const RealmVisualizer3D: React.FC<RealmVizProps> = ({ isPlaying, effectIndex }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const phaseRef  = useRef(0);
  const glowRef   = useRef(0);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; hue: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    const draw = () => {
      if (isPlaying && glowRef.current < 1) glowRef.current = Math.min(1, glowRef.current + 0.06);
      else if (!isPlaying && glowRef.current > 0) glowRef.current = Math.max(0, glowRef.current - 0.03);
      phaseRef.current += isPlaying ? 0.05 : 0.01;
      const g = glowRef.current, ph = phaseRef.current;

      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, 'rgba(3,0,12,0.97)'); bg.addColorStop(1, 'rgba(8,3,20,0.97)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      const eff = effectIndex % VIZ_EFFECTS.length;

      // Ancient god face — the living visualizer.
      drawGodFace(ctx, W, H, eff, ph, g);

      // Rising divine embers when energy flows.
      if (g > 0.05) {
        const parts = particlesRef.current;
        if (parts.length < 60 && Math.random() < g) {
          parts.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: H, vx: (Math.random() - 0.5) * 0.4, vy: -(0.5 + Math.random() * 1.2), life: 1, hue: 0 });
        }
        const [cr, cgc, cb] = GOD_FACES[eff % GOD_FACES.length].col;
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.x += p.vx; p.y += p.vy; p.life -= 0.012;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.4 * p.life + 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr},${cgc},${cb},${p.life * 0.6 * g})`;
          ctx.fill();
        }
      }


      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, effectIndex]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={140}
      style={{ width: '100%', height: 140, display: 'block', borderRadius: 6 }}
    />
  );
};

// HSL to RGB helper for plasma effect
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [Math.round(hue2rgb(h + 1/3) * 255), Math.round(hue2rgb(h) * 255), Math.round(hue2rgb(h - 1/3) * 255)];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SoundRealmProps {
  isActiveTab?: boolean;
  showMessage?: (msg: string) => void;
  onSaveToVault?: (preset: { name: string; type: string; state: Record<string, any> }) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SoundRealm: React.FC<SoundRealmProps> = ({ isActiveTab, showMessage, onSaveToVault }) => {
  const [params, setParams] = useState<SRParams>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const saved = JSON.parse(s) as Partial<SRParams>;
        // Volume cap migration: clamp saved volumes to sane defaults
        if (typeof saved.vol === 'number' && saved.vol > 0.35) saved.vol = 0.35;
        if (typeof saved.osc1Vol === 'number' && saved.osc1Vol > 0.55) saved.osc1Vol = 0.55;
        return { ...DEFAULT_PARAMS, ...saved };
      }
    } catch {}
    return DEFAULT_PARAMS;
  });

  const synthRef    = useRef<SoundRealmSynth | null>(null);
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  const [fxTab, setFxTab]             = useState<'std' | 'god' | 'pedal'>('std');
  const [vizEffect, setVizEffect]     = useState<number>(() => {
    try { return parseInt(localStorage.getItem('sr-viz-effect') ?? '0', 10) || 0; } catch { return 0; }
  });

  // Sample drag-drop
  const sampleCtxRef    = useRef<AudioContext | null>(null);
  const sampleBufferRef = useRef<AudioBuffer | null>(null);
  const sampleActiveRef = useRef<Map<number, { src: AudioBufferSourceNode; env: GainNode }>>(new Map());
  const [sampleName, setSampleName]   = useState<string | null>(null);
  const [isDragOver, setIsDragOver]   = useState(false);
  const [saveName, setSaveName]       = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Create synth on mount
  useEffect(() => {
    synthRef.current = new SoundRealmSynth(params);
    return () => { synthRef.current?.dispose(); synthRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist params
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(params)); } catch {}
  }, [params]);

  // ── Tab isolation: mute/unmute audio when tab switches ──────────────────────
  useEffect(() => {
    synthRef.current?.setTabActive(!!isActiveTab);
  }, [isActiveTab]);

  // Update param
  const setParam = useCallback(<K extends keyof SRParams>(key: K, val: SRParams[K]) => {
    setParams(prev => {
      const next = { ...prev, [key]: val };
      synthRef.current?.updateParams(next);
      return next;
    });
  }, []);

  // Sample mode noteOn/noteOff — declared first so noteOn/noteOff can reference them
  const sampleNoteOn = useCallback((note: number, velocity = 100) => {
    const buf = sampleBufferRef.current;
    if (!buf) return;
    const ctx = audioEngine.ctx;
    audioEngine.resume();
    if (!sampleCtxRef.current) sampleCtxRef.current = ctx;
    const old = sampleActiveRef.current.get(note);
    if (old) {
      const t = ctx.currentTime;
      old.env.gain.setTargetAtTime(0, t, 0.02);
      try { old.src.stop(t + 0.1); } catch {}
      sampleActiveRef.current.delete(note);
    }
    const srParams = synthRef.current?.params;
    const halftimeFactor = srParams?.halftimeEnabled ? 0.5 : 1;
    const rate = Math.pow(2, (note - 60) / 12) * halftimeFactor;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const env = ctx.createGain();
    const vol = (velocity / 127) * 0.8;
    const now = ctx.currentTime;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vol, now + 0.005);
    src.connect(env);
    env.connect(audioEngine.masterBus);
    src.start(now);
    src.onended = () => sampleActiveRef.current.delete(note);
    sampleActiveRef.current.set(note, { src, env });
    setPressedKeys(prev => new Set(prev).add(note));
  }, []);

  const sampleNoteOff = useCallback((note: number) => {
    const ctx = sampleCtxRef.current;
    const v = sampleActiveRef.current.get(note);
    if (!v || !ctx) return;
    const now = ctx.currentTime;
    v.env.gain.setTargetAtTime(0, now, 0.1);
    try { v.src.stop(now + 0.5); } catch {}
    sampleActiveRef.current.delete(note);
    setPressedKeys(prev => { const s = new Set(prev); s.delete(note); return s; });
  }, []);

  // Piano / MIDI
  const noteOn  = useCallback((note: number, vel = 100) => {
    if (sampleBufferRef.current) { sampleNoteOn(note, vel); return; }
    synthRef.current?.noteOn(note, vel);
    setPressedKeys(prev => new Set(prev).add(note));
  }, [sampleNoteOn]);

  const noteOff = useCallback((note: number) => {
    if (sampleBufferRef.current) { sampleNoteOff(note); return; }
    synthRef.current?.noteOff(note);
    setPressedKeys(prev => { const s = new Set(prev); s.delete(note); return s; });
  }, [sampleNoteOff]);

  // MIDI listener — ONLY active when this tab is displayed
  useEffect(() => {
    if (!isActiveTab) return;
    const unsub = neuralInputBus.addListener(ev => {
      if (ev.type === 'midi_note_on'  && ev.note !== undefined) noteOn(ev.note, ev.velocity ?? 100);
      if (ev.type === 'midi_note_off' && ev.note !== undefined) noteOff(ev.note);
    });
    return () => { unsub(); synthRef.current?.noteOffAll(); setPressedKeys(new Set()); };
  }, [isActiveTab, noteOn, noteOff]);

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    synthRef.current?.updateParams(DEFAULT_PARAMS);
    showMessage?.('SOUND REALM: RESET TO DEFAULTS');
  }, [showMessage]);

  // Drag-drop handler for audio files
  const handleAudioDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|aiff|aif|sf2)$/i.test(f.name)
    );
    if (!files.length) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async ev => {
      const arr = ev.target?.result as ArrayBuffer;
      if (!arr) return;
      const ctx = audioEngine.ctx;
      sampleCtxRef.current = ctx;
      await audioEngine.ctx.resume().catch(() => {});
      try {
        const buffer = await ctx.decodeAudioData(arr.slice(0));
        sampleBufferRef.current = buffer;
        const name = file.name.replace(/\.[^.]+$/, '');
        setSampleName(name);
        setSaveName(name);
        showMessage?.(`SAMPLE LOADED: ${name} — play on keyboard`);
      } catch {
        if (/\.sf2$/i.test(file.name)) {
          showMessage?.('SF2 SoundFont files need a full SF2 player — use WAV/MP3/OGG/FLAC for drag-drop');
        } else {
          showMessage?.('Could not decode audio file');
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }, [showMessage]);

  // Save Sound Realm patch to Preset Vault
  const handleSaveToVault = useCallback((name: string) => {
    if (!name.trim()) return;
    onSaveToVault?.({
      name: name.trim(),
      type: 'Sound Realm',
      state: { source: 'sound-realm', params, sampleName },
    });
    setShowSaveModal(false);
    showMessage?.(`SAVED TO VAULT: "${name.trim()}"`);
  }, [params, sampleName, onSaveToVault, showMessage]);

  const msOrS  = (v: number) => v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`;
  const signFn = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}`;
  const kHz    = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;

  return (
    <div
      className="sound-realm"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setIsDragOver(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
      onDrop={handleAudioDrop}
      style={{ position: 'relative' }}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(168,85,247,0.12)', border: '2px dashed rgba(168,85,247,0.6)', borderRadius: 12, backdropFilter: 'blur(2px)',
        }}>
          <div style={{ textAlign: 'center', color: '#c084fc' }}>
            <div style={{ fontSize: 32 }}>🎵</div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.1em' }}>DROP AUDIO FILE</div>
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>WAV · MP3 · OGG · FLAC · AIFF · SF2</div>
          </div>
        </div>
      )}

      {/* Save to Vault modal */}
      {showSaveModal && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#0c0c1a', border: '1px solid rgba(168,85,247,0.5)', borderRadius: 12,
            padding: '24px 28px', width: 320,
          }}>
            <p style={{ margin: '0 0 12px', fontWeight: 800, fontSize: 13, color: '#c084fc', letterSpacing: '0.1em' }}>
              SAVE TO PRESET VAULT
            </p>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveToVault(saveName); if (e.key === 'Escape') setShowSaveModal(false); }}
              placeholder="Preset name..."
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6,
                border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(0,0,0,0.5)', color: '#fff',
                fontSize: 12, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => handleSaveToVault(saveName)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer', fontWeight: 800,
                  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                  border: '1px solid rgba(168,85,247,0.5)', background: 'rgba(168,85,247,0.2)', color: '#c084fc',
                }}
              >SAVE</button>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{
                  padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 700,
                  fontSize: 11, border: '1px solid rgba(255, 255, 255, 0.32)', background: 'transparent', color: 'rgba(255,255,255,0.4)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="sound-realm__header">
        <span className="sound-realm__title">SOUND REALM</span>
        <span className="sound-realm__subtitle">
          {sampleName ? `SAMPLE: ${sampleName}` : 'Polyphonic Synthesizer · God Realm Edition'}
        </span>
        {sampleName && (
          <button
            onClick={() => { sampleBufferRef.current = null; setSampleName(null); showMessage?.('Sample cleared — back to synth mode'); }}
            style={{
              padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)',
              color: '#f87171', fontSize: 9, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase',
            }}
          >✕ CLEAR SAMPLE</button>
        )}
        <button
          onClick={() => { setSaveName(sampleName ?? 'Sound Realm Patch'); setShowSaveModal(true); }}
          style={{
            padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.1)',
            color: '#c084fc', fontSize: 9, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >💾 SAVE TO VAULT</button>
        <button className="sound-realm__reset-btn" onClick={handleReset}>RESET</button>
      </div>

      {/* ── Control Surface ── */}
      <div className="sound-realm__surface">

        {/* ── Row 1: OSC1 | OSC2 | FILTER ── */}
        <div className="sound-realm__row">

          {/* OSC 1 */}
          <div className="sound-realm__panel">
            <div className="sound-realm__panel-hdr">
              <span className="sound-realm__panel-title">OSC 1</span>
            </div>
            <WaveRow value={params.osc1Wave} onChange={v => setParam('osc1Wave', v)} />
            <div className="sound-realm__knobs">
              <SRKnob label="OCT"  value={params.osc1Oct}  min={-2} max={2}  step={1} onChange={v => setParam('osc1Oct', v)}  color="#a855f7" display={signFn} />
              <SRKnob label="SEMI" value={params.osc1Semi} min={-12} max={12} step={1} onChange={v => setParam('osc1Semi', v)} color="#a855f7" display={signFn} />
              <SRKnob label="VOL"  value={params.osc1Vol}  min={0}  max={1}  onChange={v => setParam('osc1Vol', v)}  color="#a855f7" />
            </div>
          </div>

          {/* OSC 2 */}
          <div className={`sound-realm__panel${params.osc2On ? '' : ' sound-realm__panel--off'}`}>
            <div className="sound-realm__panel-hdr">
              <span className="sound-realm__panel-title">OSC 2</span>
              <button
                className={`sound-realm__toggle${params.osc2On ? ' sound-realm__toggle--on' : ''}`}
                onClick={() => setParam('osc2On', !params.osc2On)}
              >
                {params.osc2On ? 'ON' : 'OFF'}
              </button>
            </div>
            <WaveRow value={params.osc2Wave} onChange={v => setParam('osc2Wave', v)} />
            <div className="sound-realm__knobs">
              <SRKnob label="OCT"  value={params.osc2Oct}  min={-2} max={2}  step={1} onChange={v => setParam('osc2Oct', v)}  color="#818cf8" display={signFn} />
              <SRKnob label="SEMI" value={params.osc2Semi} min={-12} max={12} step={1} onChange={v => setParam('osc2Semi', v)} color="#818cf8" display={signFn} />
              <SRKnob label="VOL"  value={params.osc2Vol}  min={0}  max={1}  onChange={v => setParam('osc2Vol', v)}  color="#818cf8" />
            </div>
          </div>

          {/* Filter */}
          <div className="sound-realm__panel">
            <div className="sound-realm__panel-hdr">
              <span className="sound-realm__panel-title">FILTER</span>
              <SegBtns
                value={params.fltType}
                options={['lowpass', 'highpass', 'bandpass', 'notch'] as FilterType[]}
                labels={['LP','HP','BP','NT']}
                onChange={v => setParam('fltType', v)}
              />
            </div>
            <div className="sound-realm__knobs">
              <SRKnob label="CUTOFF" value={params.fltCutoff} min={20} max={20000} onChange={v => setParam('fltCutoff', v)} color="#ec4899" god="hades" display={kHz} unit="Hz" />
              <SRKnob label="RES"    value={params.fltRes}    min={0}  max={25}    onChange={v => setParam('fltRes', v)}    color="#ec4899" god="hades" />
              <SRKnob label="ENV"    value={params.fltEnv}    min={-5000} max={5000} onChange={v => setParam('fltEnv', v)} color="#ec4899" god="hades" display={signFn} />
            </div>
          </div>

          {/* Master / Vol */}
          <div className="sound-realm__panel">
            <div className="sound-realm__panel-hdr">
              <span className="sound-realm__panel-title">MASTER</span>
            </div>
            <div className="sound-realm__knobs">
              <SRKnob label="VOL" value={params.vol} min={0} max={1} onChange={v => setParam('vol', v)} color="#c084fc" god="athena" />
            </div>
            <button
              onClick={() => setParam('limiterEnabled', !params.limiterEnabled)}
              style={{
                padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 900,
                textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none', marginTop: 6,
                background: params.limiterEnabled ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.08)',
                color: params.limiterEnabled ? '#c084fc' : 'rgba(255,255,255,0.38)',
              }}
            >
              {params.limiterEnabled ? '🔒 LIMITER ON' : '🔓 LIMITER OFF'}
            </button>
          </div>
        </div>

        {/* ── Row 2: ENVELOPE | LFO ── */}
        <div className="sound-realm__row">
          {/* Envelope */}
          <div className="sound-realm__panel sound-realm__panel--wide">
            <div className="sound-realm__panel-hdr">
              <span className="sound-realm__panel-title">ENVELOPE</span>
            </div>
            <div className="sound-realm__knobs">
              <SRKnob label="ATK" value={params.attack}  min={0.001} max={4} onChange={v => setParam('attack', v)}  color="#f59e0b" god="apollo" display={msOrS} />
              <SRKnob label="DEC" value={params.decay}   min={0.001} max={4} onChange={v => setParam('decay', v)}   color="#f59e0b" god="apollo" display={msOrS} />
              <SRKnob label="SUS" value={params.sustain} min={0}     max={1} onChange={v => setParam('sustain', v)} color="#f59e0b" god="apollo" />
              <SRKnob label="REL" value={params.release} min={0.001} max={8} onChange={v => setParam('release', v)} color="#f59e0b" god="apollo" display={msOrS} />
            </div>
          </div>

          {/* LFO */}
          <div className="sound-realm__panel sound-realm__panel--wide">
            <div className="sound-realm__panel-hdr">
              <span className="sound-realm__panel-title">LFO</span>
              <SegBtns
                value={params.lfoTarget}
                options={['pitch','filter','amp'] as LFOTarget[]}
                labels={['PCH','FLT','AMP']}
                onChange={v => setParam('lfoTarget', v)}
              />
            </div>
            <WaveRow value={params.lfoWave} onChange={v => setParam('lfoWave', v)} />
            <div className="sound-realm__knobs">
              <SRKnob label="RATE"  value={params.lfoRate}  min={0.1} max={20} onChange={v => setParam('lfoRate', v)}  color="#22d3ee" god="poseidon" display={v => v.toFixed(1)} unit="Hz" />
              <SRKnob label="DEPTH" value={params.lfoDepth} min={0}   max={1}  onChange={v => setParam('lfoDepth', v)} color="#22d3ee" god="poseidon" />
            </div>
          </div>
        </div>

        {/* ── Row 3: FX SUITE ── */}
        <div className="sound-realm__row">
          <div className="sound-realm__panel sound-realm__panel--full-width">
            <div className="sound-realm__panel-hdr">
              <span className="sound-realm__panel-title">EFFECTS SUITE</span>
              <div className="sr-seg-btns">
                <button className={`sr-seg-btn ${fxTab === 'std' ? 'sr-seg-btn--active' : ''}`} onClick={() => setFxTab('std')}>REV · DLY</button>
                <button className={`sr-seg-btn ${fxTab === 'god' ? 'sr-seg-btn--active' : ''}`} onClick={() => setFxTab('god')}>⚡ GOD FX</button>
                <button className={`sr-seg-btn ${fxTab === 'pedal' ? 'sr-seg-btn--active' : ''}`} onClick={() => setFxTab('pedal')}>🎸 PEDAL</button>
              </div>
            </div>

            {fxTab === 'std' && (
              <div className="sound-realm__fx-section">
                <div className="sound-realm__fx-row">
                  <span className="sound-realm__fx-label">REVERB</span>
                  <SRKnob label="MIX" value={params.revMix} min={0} max={1} onChange={v => setParam('revMix', v)} color="#14b8a6" />
                </div>
                <div className="sound-realm__fx-row">
                  <span className="sound-realm__fx-label">DELAY</span>
                  <SRKnob label="MIX"  value={params.delMix}  min={0}    max={1}   onChange={v => setParam('delMix', v)}  color="#14b8a6" />
                  <SRKnob label="TIME" value={params.delTime} min={0.05} max={1}   onChange={v => setParam('delTime', v)} color="#14b8a6" display={v => v.toFixed(2)} unit="s" />
                  <SRKnob label="FB"   value={params.delFB}   min={0}    max={0.9} onChange={v => setParam('delFB', v)}   color="#14b8a6" />
                </div>
              </div>
            )}

            {fxTab === 'god' && (
              <div className="sound-realm__god-fx">

                {/* DREAMPHASE (Phaser) */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.phasEnabled} label="DREAMPHASE" color="#818cf8"
                      onClick={() => setParam('phasEnabled', !params.phasEnabled)} />
                    <span className="sound-realm__god-fx-hint">Phaser · 4-stage all-pass</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="RATE"  value={params.phasRate}  min={0.1} max={10} onChange={v => setParam('phasRate', v)}  color="#818cf8" display={v => v.toFixed(1)} unit="Hz" />
                    <SRKnob label="DEPTH" value={params.phasDepth} min={0}   max={1}  onChange={v => setParam('phasDepth', v)} color="#818cf8" />
                  </div>
                </div>

                {/* STACKS (Chorus) */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.chorEnabled} label="STACKS" color="#34d399"
                      onClick={() => setParam('chorEnabled', !params.chorEnabled)} />
                    <span className="sound-realm__god-fx-hint">Stereo chorus · modulated delay</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="RATE"  value={params.chorRate}  min={0.1} max={8}  onChange={v => setParam('chorRate', v)}  color="#34d399" display={v => v.toFixed(1)} unit="Hz" />
                    <SRKnob label="DEPTH" value={params.chorDepth} min={0}   max={1}  onChange={v => setParam('chorDepth', v)} color="#34d399" />
                    <SRKnob label="MIX"   value={params.chorMix}   min={0}   max={1}  onChange={v => setParam('chorMix', v)}   color="#34d399" />
                  </div>
                </div>

                {/* ANALOG WARMTH (Saturation) — inspired by SpectraVerb harmonic richness */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.satEnabled} label="ANALOG WARMTH" color="#f59e0b"
                      onClick={() => setParam('satEnabled', !params.satEnabled)} />
                    <span className="sound-realm__god-fx-hint">Tube saturation · harmonic drive</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="DRIVE" value={params.satDrive} min={1}   max={10} onChange={v => setParam('satDrive', v)} color="#f59e0b" display={v => v.toFixed(1)} />
                    <SRKnob label="MIX"   value={params.satMix}   min={0}   max={1}  onChange={v => setParam('satMix', v)}   color="#f59e0b" />
                  </div>
                </div>

                {/* CHAOS PATTERNS (Ring Mod) */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.ringEnabled} label="CHAOS PATTERNS" color="#f87171"
                      onClick={() => setParam('ringEnabled', !params.ringEnabled)} />
                    <span className="sound-realm__god-fx-hint">Ring modulation · metallic chaos</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="FREQ" value={params.ringFreq} min={20}  max={2000} onChange={v => setParam('ringFreq', v)} color="#f87171" display={v => Math.round(v).toString()} unit="Hz" />
                    <SRKnob label="MIX"  value={params.ringMix}  min={0}   max={1}   onChange={v => setParam('ringMix', v)}  color="#f87171" />
                  </div>
                </div>

              </div>
            )}

            {/* ── PEDAL FX (TONEFLX + HZE + Portal) ── */}
            {fxTab === 'pedal' && (
              <div className="sound-realm__god-fx">

                {/* PITCH — TONEFLX Pitch / HZE Stepshifter */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <span className="sr-fx-toggle" style={{ color: '#c4b5fd' }}>STEPSHIFTER</span>
                    <span className="sound-realm__god-fx-hint">Pitch offset · semitones + cents</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="SEMI"  value={params.pitchSemi}  min={-24} max={24} step={1} onChange={v => setParam('pitchSemi', v)}  color="#c4b5fd" display={v => (v >= 0 ? '+' : '') + v} />
                    <SRKnob label="CENTS" value={params.pitchCents} min={-100} max={100} step={1} onChange={v => setParam('pitchCents', v)} color="#c4b5fd" display={v => (v >= 0 ? '+' : '') + v} />
                  </div>
                </div>

                {/* TAPE — TONEFLX Tape / HZE Heatwave */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.tapeEnabled} label="HEATWAVE TAPE" color="#fbbf24"
                      onClick={() => setParam('tapeEnabled', !params.tapeEnabled)} />
                    <span className="sound-realm__god-fx-hint">Wow · flutter · noise · warmth</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="WOW"     value={params.tapeWow}     min={0} max={1}  onChange={v => setParam('tapeWow', v)}     color="#fbbf24" />
                    <SRKnob label="FLUTTER" value={params.tapeFlutter} min={0} max={1}  onChange={v => setParam('tapeFlutter', v)} color="#fbbf24" />
                    <SRKnob label="NOISE"   value={params.tapeNoise}   min={0} max={1}  onChange={v => setParam('tapeNoise', v)}   color="#fbbf24" />
                    <SRKnob label="DRIVE"   value={params.tapeDrive}   min={1} max={12} onChange={v => setParam('tapeDrive', v)}   color="#fbbf24" display={v => v.toFixed(1)} />
                    <SRKnob label="MIX"     value={params.tapeMix}     min={0} max={1}  onChange={v => setParam('tapeMix', v)}     color="#fbbf24" />
                  </div>
                </div>

                {/* LO-FI / BITSTREAM — TONEFLX Resampler / HZE Bitstream */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.lofiEnabled} label="BITSTREAM" color="#6ee7b7"
                      onClick={() => setParam('lofiEnabled', !params.lofiEnabled)} />
                    <span className="sound-realm__god-fx-hint">Bit crush · sample rate reduce · noise</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="BITS"  value={params.lofiBits}  min={2} max={16} step={0.5} onChange={v => setParam('lofiBits', v)}  color="#6ee7b7" display={v => v.toFixed(1)} />
                    <SRKnob label="NOISE" value={params.lofiNoise} min={0} max={1}             onChange={v => setParam('lofiNoise', v)} color="#6ee7b7" />
                    <SRKnob label="MIX"   value={params.lofiMix}   min={0} max={1}             onChange={v => setParam('lofiMix', v)}   color="#6ee7b7" />
                  </div>
                </div>

                {/* CYCLES / TREMOLO — HZE Cycles */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.tremEnabled} label="CYCLES TREMOLO" color="#38bdf8"
                      onClick={() => setParam('tremEnabled', !params.tremEnabled)} />
                    <span className="sound-realm__god-fx-hint">Amplitude tremolo · LFO modulated</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="RATE"  value={params.tremRate}  min={0.1} max={20} onChange={v => setParam('tremRate', v)}  color="#38bdf8" display={v => v.toFixed(1)} unit="Hz" />
                    <SRKnob label="DEPTH" value={params.tremDepth} min={0}   max={1}  onChange={v => setParam('tremDepth', v)} color="#38bdf8" />
                  </div>
                </div>

                {/* SPECTRAVERB / SHIMMER — HZE SpectraVerb */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.shimEnabled} label="SPECTRAVERB" color="#e879f9"
                      onClick={() => setParam('shimEnabled', !params.shimEnabled)} />
                    <span className="sound-realm__god-fx-hint">Shimmer reverb · bright harmonic wash</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="MIX"        value={params.shimMix}        min={0} max={1}   onChange={v => setParam('shimMix', v)}        color="#e879f9" />
                    <SRKnob label="SIZE"        value={params.shimSize}       min={0.5} max={8} onChange={v => setParam('shimSize', v)}       color="#e879f9" display={v => v.toFixed(1)} unit="s" />
                    <SRKnob label="BRIGHTNESS"  value={params.shimBrightness} min={10} max={120} onChange={v => setParam('shimBrightness', v)} color="#e879f9" display={v => Math.round(v).toString()} />
                  </div>
                </div>

                {/* DARK VOID — HZE DarkVoid */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.darkVoidEnabled} label="DARK VOID" color="#475569"
                      onClick={() => setParam('darkVoidEnabled', !params.darkVoidEnabled)} />
                    <span className="sound-realm__god-fx-hint">Infinite dark reverb · freeze mode</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="MIX"    value={params.darkVoidMix}    min={0} max={1} onChange={v => setParam('darkVoidMix', v)}    color="#94a3b8" />
                    <SRKnob label="FREEZE" value={params.darkVoidFreeze} min={0} max={1} onChange={v => setParam('darkVoidFreeze', v)} color="#94a3b8" />
                  </div>
                </div>

                {/* HALFTIME — slowed, chopped & screwed */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.halftimeEnabled} label="HALFTIME" color="#f59e0b"
                      onClick={() => setParam('halftimeEnabled', !params.halftimeEnabled)} />
                    <span className="sound-realm__god-fx-hint">0.5× speed · pitch drops one octave</span>
                  </div>
                </div>

                {/* WIDTH — TONEFLX Width */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.widthEnabled} label="STEREO WIDTH" color="#34d399"
                      onClick={() => setParam('widthEnabled', !params.widthEnabled)} />
                    <span className="sound-realm__god-fx-hint">Haas stereo widening</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="AMOUNT" value={params.widthAmt} min={1} max={50} onChange={v => setParam('widthAmt', v)} color="#34d399" display={v => Math.round(v).toString()} unit="ms" />
                  </div>
                </div>

                {/* WARP — Output Portal pitch swell */}
                <div className="sound-realm__god-fx-block">
                  <div className="sound-realm__god-fx-hdr">
                    <FXToggle active={params.warpEnabled} label="PORTAL WARP" color="#f97316"
                      onClick={() => setParam('warpEnabled', !params.warpEnabled)} />
                    <span className="sound-realm__god-fx-hint">Pitch swell LFO · Output Portal style</span>
                  </div>
                  <div className="sound-realm__knobs">
                    <SRKnob label="RATE"  value={params.warpRate}  min={0.01} max={4} onChange={v => setParam('warpRate', v)}  color="#f97316" display={v => v.toFixed(2)} unit="Hz" />
                    <SRKnob label="DEPTH" value={params.warpDepth} min={0}  max={600} onChange={v => setParam('warpDepth', v)} color="#f97316" display={v => Math.round(v).toString()} unit="¢" />
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Piano Keyboard ── */}
      {/* 3D Waveform Visualizer */}
      <div style={{ padding: '6px 10px 0', flexShrink: 0 }}>
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(168,85,247,0.18)', position: 'relative' }}>
          <RealmVisualizer3D isPlaying={pressedKeys.size > 0} effectIndex={vizEffect} />
          {/* Effect selector overlay */}
          <div style={{
            position: 'absolute', top: 4, right: 4, display: 'flex', gap: 3, flexWrap: 'wrap',
            justifyContent: 'flex-end', maxWidth: '60%',
          }}>
            {VIZ_EFFECTS.map((name, i) => (
              <button key={i} onClick={() => {
                setVizEffect(i);
                try { localStorage.setItem('sr-viz-effect', String(i)); } catch {}
              }} style={{
                padding: '2px 5px', fontSize: 7, fontWeight: 900, letterSpacing: '0.06em',
                border: 'none', borderRadius: 3, cursor: 'pointer', textTransform: 'uppercase',
                background: vizEffect === i ? 'rgba(168,85,247,0.7)' : 'rgba(0,0,0,0.55)',
                color: vizEffect === i ? '#fff' : 'rgba(255, 255, 255, 0.57)',
                backdropFilter: 'blur(4px)',
              }}>{name}</button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default SoundRealm;
