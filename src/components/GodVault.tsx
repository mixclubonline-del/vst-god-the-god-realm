/**
 * GodVault.tsx — The God Realm Preset Vault
 *
 * Clean, working preset vault. Starts empty; every save/load/delete
 * goes through presetService which persists to localStorage.
 *
 * Features:
 *  • Save current plugin state as a named preset (type + tags)
 *  • Instant search / filter by type
 *  • Click to preview details, click Load to apply
 *  • Star to favourite
 *  • Delete with one click (undo via toast)
 *  • Drag-and-drop reorder (within vault)
 *  • Import / Export entire vault as JSON
 *  • Drag audio file onto the vault to create a "Oneshot" sample preset
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { presetService, UnifiedPreset } from '../services/presetService';
import { neuralInputBus } from '../services/neuralInputBus';
import { GodRealmPresetEngine } from './GodRealmPresetEngine';
import { audioEngine } from '../services/audioEngine';
import { CORE_LIBRARY, CORE_LIBRARY_ROOT, CORE_LIBRARY_ROOTS, CoreSample } from '../services/coreLibraryData';
import { coreLibraryFS } from '../services/coreLibraryFS';
import { presetVaultFS } from '../services/presetVaultFS';
import { nativeAudio } from '../native/bridge';
import './GodVault.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GodVaultProps {
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  onLoadPreset: (preset: UnifiedPreset) => void;
  showMessage?: (msg: string) => void;
  isActiveTab?: boolean;
  onNavigate?: (tab: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_TYPES = [
  'All', 'Multi-Realm', 'Chopper', 'Bass', 'Lead', 'Pad', 'Pluck', 'Keys',
  'Arp', 'FX', 'Textures', 'Drum', 'Oneshot', 'Other',
];

// ─── Piano Key Definition ─────────────────────────────────────────────────────

const PIANO_KEYS = (() => {
  const keys = [];
  for (let octave = 3; octave <= 6; octave++) {
    const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    for (let n = 0; n < 12; n++) {
      const midi = (octave + 1) * 12 + n;
      keys.push({ midi, name: noteNames[n], octave, isBlack: noteNames[n].includes('#') });
    }
  }
  return keys;
})();

// ─── IndexedDB audio cache (persists decoded ArrayBuffers by preset ID) ───────

const AudioDB = (() => {
  const DB = 'vstgod-vault-audio-v1';
  const STORE = 'samples';
  let _db: IDBDatabase | null = null;

  function open(): Promise<IDBDatabase> {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = e => (e.target as IDBOpenDBRequest).result.createObjectStore(STORE);
      req.onsuccess = e => { _db = (e.target as IDBOpenDBRequest).result; res(_db!); };
      req.onerror   = () => rej(req.error);
    });
  }

  return {
    async set(id: string, buf: ArrayBuffer) {
      const db = await open();
      return new Promise<void>((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(buf, id);
        tx.oncomplete = () => res();
        tx.onerror    = () => rej(tx.error);
      });
    },
    async get(id: string): Promise<ArrayBuffer | null> {
      const db = await open();
      return new Promise((res, rej) => {
        const req = db.transaction(STORE).objectStore(STORE).get(id);
        req.onsuccess = () => res((req.result as ArrayBuffer) ?? null);
        req.onerror   = () => rej(req.error);
      });
    },
    async delete(id: string) {
      const db = await open();
      return new Promise<void>((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => res();
        tx.onerror    = () => rej(tx.error);
      });
    },
  };
})();

// ─── Vault FX State ───────────────────────────────────────────────────────────

export type ReverbType  = 'room'|'studio'|'hall'|'plate'|'stadium'|'cathedral'|'spring'|'chamber'|'ambience';
export type DelayType   = 'mono'|'stereo'|'ping-pong'|'tape';
export type DistType    = 'soft'|'hard'|'tube'|'fuzz'|'bitcrush';
export type LFOWave     = 'sine'|'triangle'|'square'|'sawtooth'|'random';
export type LFOTarget   = 'pitch'|'filter'|'amplitude'|'pan'|'reverb-send'|'delay-send';
export type OscMode     = 'sub'|'unison'|'fifth'|'octave'|'off';
export type FilterType2 = 'lowpass'|'highpass'|'bandpass'|'notch'|'peaking';
export type PlayMode    = 'poly'|'mono'|'legato';

export interface VaultFXState {
  playMode: PlayMode;
  // Filter
  filterEnabled: boolean; filterType: FilterType2; filterCutoff: number; filterRes: number; filterEnv: number;
  // Reverb
  reverbEnabled: boolean; reverbType: ReverbType; reverbSend: number; reverbDecay: number; reverbPreDelay: number; reverbDamping: number; reverbWidth: number;
  // Delay
  delayEnabled: boolean; delayType: DelayType; delaySend: number; delayTime: number; delayFeedback: number; delayDamping: number;
  // Chorus
  chorusEnabled: boolean; chorusSend: number; chorusRate: number; chorusDepth: number; chorusVoices: number;
  // Distortion
  distEnabled: boolean; distType: DistType; distDrive: number; distTone: number; distMix: number;
  // EQ (4-band parametric)
  eqEnabled: boolean;
  eqLow: number; eqLowFreq: number;
  eqMid: number; eqMidFreq: number; eqMidQ: number;
  eqHighMid: number; eqHighMidFreq: number; eqHighMidQ: number;
  eqHigh: number; eqHighFreq: number;
  // Compressor
  compEnabled: boolean; compThreshold: number; compRatio: number; compAttack: number; compRelease: number; compMakeup: number;
  // LFO
  lfoEnabled: boolean; lfoWave: LFOWave; lfoRate: number; lfoDepth: number; lfoTarget: LFOTarget;
  // OSC
  oscEnabled: boolean; oscMode: OscMode; oscWave: OscillatorType; oscDetune: number; oscVolume: number;
  // Halftime
  halftimeEnabled: boolean;
  // Tremolo
  tremoloEnabled: boolean; tremoloRate: number; tremoloDepth: number;
  // Shimmer
  shimmerEnabled: boolean; shimmerSend: number;
  // Dark Void
  darkVoidEnabled: boolean; darkVoidDecay: number;
  // Master
  masterVol: number;
}

export const DEFAULT_VAULT_FX: VaultFXState = {
  playMode: 'poly',
  filterEnabled: false, filterType: 'lowpass', filterCutoff: 8000, filterRes: 0.5, filterEnv: 0,
  reverbEnabled: true,  reverbType: 'hall',    reverbSend: 25, reverbDecay: 60, reverbPreDelay: 15, reverbDamping: 40, reverbWidth: 80,
  delayEnabled: false,  delayType: 'stereo',   delaySend: 25, delayTime: 375,  delayFeedback: 35,  delayDamping: 40,
  chorusEnabled: false, chorusSend: 30, chorusRate: 0.6, chorusDepth: 30, chorusVoices: 2,
  distEnabled: false,   distType: 'soft', distDrive: 20, distTone: 50, distMix: 50,
  eqEnabled: false,
  eqLow: 0, eqLowFreq: 120,
  eqMid: 0, eqMidFreq: 500, eqMidQ: 1,
  eqHighMid: 0, eqHighMidFreq: 3000, eqHighMidQ: 1,
  eqHigh: 0, eqHighFreq: 8000,
  compEnabled: false,   compThreshold: -18, compRatio: 4, compAttack: 10, compRelease: 80, compMakeup: 3,
  lfoEnabled: false,    lfoWave: 'sine', lfoRate: 2, lfoDepth: 20, lfoTarget: 'filter',
  oscEnabled: false,    oscMode: 'sub', oscWave: 'sine', oscDetune: 0, oscVolume: 30,
  halftimeEnabled: false,
  tremoloEnabled: false, tremoloRate: 5, tremoloDepth: 60,
  shimmerEnabled: false, shimmerSend: 40,
  darkVoidEnabled: false, darkVoidDecay: 80,
  masterVol: 85,
};

// ─── IR synthesis for reverb types ───────────────────────────────────────────

const REVERB_PARAMS: Record<ReverbType, { dur: number; decay: number; pre: number; damp: number; diff: number }> = {
  room:      { dur: 0.6,  decay: 1.2,  pre: 0.005, damp: 0.5, diff: 0.7 },
  studio:    { dur: 0.4,  decay: 0.8,  pre: 0.002, damp: 0.6, diff: 0.6 },
  chamber:   { dur: 0.8,  decay: 1.8,  pre: 0.010, damp: 0.45, diff: 0.75 },
  ambience:  { dur: 1.0,  decay: 2.2,  pre: 0.015, damp: 0.4, diff: 0.8 },
  hall:      { dur: 2.0,  decay: 4.5,  pre: 0.025, damp: 0.3, diff: 0.88 },
  plate:     { dur: 1.2,  decay: 2.8,  pre: 0.008, damp: 0.2, diff: 0.92 },
  stadium:   { dur: 4.0,  decay: 9.0,  pre: 0.050, damp: 0.15, diff: 0.95 },
  cathedral: { dur: 5.5,  decay: 12.0, pre: 0.070, damp: 0.1, diff: 0.98 },
  spring:    { dur: 0.35, decay: 1.0,  pre: 0.001, damp: 0.75, diff: 0.35 },
};

function buildIR(ctx: AudioContext, type: ReverbType, decayMult = 1): AudioBuffer {
  const p  = REVERB_PARAMS[type];
  const dur = p.dur * decayMult;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const preLen = Math.floor(ctx.sampleRate * p.pre);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = preLen; i < len; i++) {
      const t = (i - preLen) / ctx.sampleRate;
      const env = Math.pow(10, -3 * t / (p.decay * decayMult));
      // spring gets a comb-filter character
      const noise = type === 'spring'
        ? Math.sin(i * 0.07) * (Math.random() * 2 - 1)
        : (Math.random() * 2 - 1) * p.diff;
      d[i] = env * noise * (ch === 0 ? 1 : -1 + ch * 0.05);
    }
    // damping via simple single-pole LP
    const alpha = p.damp * 0.6;
    for (let i = 1; i < len; i++) d[i] = d[i] * (1 - alpha) + d[i - 1] * alpha;
  }
  return buf;
}

function distCurve(drive: number, type: DistType): Float32Array {
  const N = 512; const curve = new Float32Array(N);
  const k = drive * 0.04 + 0.01;
  for (let i = 0; i < N; i++) {
    const x = (i * 2) / N - 1;
    switch (type) {
      case 'soft':  curve[i] = Math.tanh(x * (k * 100 + 1)); break;
      case 'hard':  curve[i] = Math.max(-1, Math.min(1, x * (k * 80 + 1) * 3)); break;
      case 'tube':  curve[i] = (Math.atan(x * (k * 60 + 2)) / Math.atan(k * 60 + 2)); break;
      case 'fuzz':  curve[i] = x > 0 ? 1 - Math.exp(-x * k * 100) : -1 + Math.exp(x * k * 100); break;
      case 'bitcrush': { const bits = Math.max(2, Math.round(8 - drive * 0.06)); const step = 2 / Math.pow(2, bits); curve[i] = Math.round(x / step) * step; break; }
    }
  }
  return curve;
}

// ─── Vault Sample Player — full FX chain + poly/mono + LFO ───────────────────

class VaultPreviewEngine {
  readonly ctx: AudioContext;
  private buffer: AudioBuffer | null = null;
  rootNote = 60;
  private fx: VaultFXState = { ...DEFAULT_VAULT_FX };

  // FX nodes
  private tabGain!:    GainNode;
  private limiter!:    DynamicsCompressorNode;
  private masterGain!: GainNode;
  private filter!:     BiquadFilterNode;
  private dist!:       WaveShaperNode;
  private distDry!:    GainNode;
  private distWet!:    GainNode;
  private eqLow!:      BiquadFilterNode;
  private eqMid!:      BiquadFilterNode;
  private eqHighMid!:  BiquadFilterNode;
  private eqHigh!:     BiquadFilterNode;
  private comp!:       DynamicsCompressorNode;
  private reverbConv!: ConvolverNode;
  private reverbSend!: GainNode;
  private delayL!:     DelayNode;
  private delayR!:     DelayNode;
  private delayFBL!:   GainNode;
  private delayFBR!:   GainNode;
  private delaySend!:  GainNode;
  private delaySendR!: GainNode;
  private chorSplit!:  ChannelSplitterNode;
  private chorMerge!:  ChannelMergerNode;
  private chorDelL!:   DelayNode;
  private chorDelR!:   DelayNode;
  private chorLfoL!:   OscillatorNode;
  private chorLfoR!:   OscillatorNode;
  private chorLfoGainL!: GainNode;
  private chorLfoGainR!: GainNode;
  private chorSendGain!: GainNode;
  private lfoOsc!:     OscillatorNode;
  private lfoGain!:    GainNode;
  private panner!:     StereoPannerNode;
  // Tremolo
  private tremLfo!:    OscillatorNode;
  private tremGain!:   GainNode;
  private tremMaster!: GainNode;
  // Shimmer reverb
  private shimmerConv!: ConvolverNode;
  private shimmerSendG!: GainNode;
  // Dark Void
  private darkConv!:   ConvolverNode;
  private darkSendG!:  GainNode;
  private activeNotes = new Map<number, { src: AudioScheduledSourceNode; env: GainNode; oscSrc?: OscillatorNode; isSynth?: boolean }>();
  private lastNote = -1; // for mono mode
  private heldOrder: number[] = []; // physically-held notes, for legato

  constructor() {
    this.ctx = audioEngine.ctx;
    audioEngine.resume();
    this._buildChain();
    this._startLFO();
    this.updateFX(DEFAULT_VAULT_FX);
  }

  private _buildChain() {
    const c = this.ctx;

    // Output chain: masterGain → filter → dist → EQ → comp → reverbSend/delaySend/dry → tabGain → limiter
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -3; this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20; this.limiter.attack.value = 0.001; this.limiter.release.value = 0.08;
    this.limiter.connect(audioEngine.masterBus);

    this.tabGain = c.createGain(); this.tabGain.gain.value = 0; // silent until React activates this tab
    this.tabGain.connect(this.limiter);

    this.panner = c.createStereoPanner(); this.panner.pan.value = 0;
    this.panner.connect(this.tabGain);

    // Comp
    this.comp = c.createDynamicsCompressor();
    this.comp.connect(this.panner);

    // EQ: 4-band parametric (low shelf → low-mid peak → high-mid peak → high shelf)
    this.eqHigh    = c.createBiquadFilter(); this.eqHigh.type    = 'highshelf'; this.eqHigh.frequency.value    = 8000;
    this.eqHigh.connect(this.comp);
    this.eqHighMid = c.createBiquadFilter(); this.eqHighMid.type = 'peaking';   this.eqHighMid.frequency.value = 3000; this.eqHighMid.Q.value = 1;
    this.eqHighMid.connect(this.eqHigh);
    this.eqMid     = c.createBiquadFilter(); this.eqMid.type     = 'peaking';   this.eqMid.frequency.value     = 500;  this.eqMid.Q.value = 1;
    this.eqMid.connect(this.eqHighMid);
    this.eqLow     = c.createBiquadFilter(); this.eqLow.type     = 'lowshelf';  this.eqLow.frequency.value     = 120;
    this.eqLow.connect(this.eqMid);

    // Distortion (dry/wet parallel)
    this.dist = c.createWaveShaper(); this.dist.oversample = '4x';
    this.distDry = c.createGain(); this.distDry.gain.value = 1;
    this.distWet = c.createGain(); this.distWet.gain.value = 0;
    this.distDry.connect(this.eqLow);
    this.distWet.connect(this.eqLow);

    // Filter
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 20000;
    this.filter.connect(this.distDry);
    this.filter.connect(this.dist);
    this.dist.connect(this.distWet);

    // Chorus (sends from comp output)
    this.chorSplit  = c.createChannelSplitter(2);
    this.chorMerge  = c.createChannelMerger(2);
    this.chorDelL   = c.createDelay(0.05); this.chorDelL.delayTime.value = 0.02;
    this.chorDelR   = c.createDelay(0.05); this.chorDelR.delayTime.value = 0.025;
    this.chorLfoL   = c.createOscillator(); this.chorLfoL.frequency.value = 0.6; this.chorLfoL.type = 'sine';
    this.chorLfoR   = c.createOscillator(); this.chorLfoR.frequency.value = 0.7; this.chorLfoR.type = 'sine';
    this.chorLfoGainL = c.createGain(); this.chorLfoGainL.gain.value = 0.003;
    this.chorLfoGainR = c.createGain(); this.chorLfoGainR.gain.value = 0.003;
    this.chorLfoL.connect(this.chorLfoGainL); this.chorLfoGainL.connect(this.chorDelL.delayTime);
    this.chorLfoR.connect(this.chorLfoGainR); this.chorLfoGainR.connect(this.chorDelR.delayTime);
    this.chorLfoL.start(); this.chorLfoR.start();
    this.chorSendGain = c.createGain(); this.chorSendGain.gain.value = 0;
    this.comp.connect(this.chorSendGain);
    this.chorSendGain.connect(this.chorSplit);
    this.chorSplit.connect(this.chorDelL, 0); this.chorSplit.connect(this.chorDelR, 1);
    this.chorDelL.connect(this.chorMerge, 0, 0); this.chorDelR.connect(this.chorMerge, 0, 1);
    this.chorMerge.connect(this.panner);

    // Reverb
    this.reverbConv = c.createConvolver();
    this.reverbSend = c.createGain(); this.reverbSend.gain.value = 0;
    this.comp.connect(this.reverbSend);
    this.reverbSend.connect(this.reverbConv);
    this.reverbConv.connect(this.panner);

    // Delay (ping-pong capable)
    this.delaySend  = c.createGain(); this.delaySend.gain.value = 0;
    this.delaySendR = c.createGain(); this.delaySendR.gain.value = 0;
    this.delayL     = c.createDelay(4); this.delayL.delayTime.value = 0.375;
    this.delayR     = c.createDelay(4); this.delayR.delayTime.value = 0.375;
    this.delayFBL   = c.createGain(); this.delayFBL.gain.value = 0.35;
    this.delayFBR   = c.createGain(); this.delayFBR.gain.value = 0.35;
    this.comp.connect(this.delaySend);
    this.comp.connect(this.delaySendR);
    this.delaySend.connect(this.delayL);
    this.delaySendR.connect(this.delayR);
    this.delayL.connect(this.delayFBL); this.delayFBL.connect(this.delayR);
    this.delayR.connect(this.delayFBR); this.delayFBR.connect(this.delayL);
    this.delayL.connect(this.panner);
    this.delayR.connect(this.panner);

    // Master gain → filter (entry point for voices)
    this.masterGain = c.createGain(); this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.filter);
    // Also send dry signal to panner
    this.comp.connect(this.panner);

    // Tremolo — LFO modulates tremMaster before the filter
    this.tremMaster = c.createGain(); this.tremMaster.gain.value = 1;
    this.tremLfo    = c.createOscillator(); this.tremLfo.type = 'sine'; this.tremLfo.frequency.value = 5;
    this.tremGain   = c.createGain(); this.tremGain.gain.value = 0;
    this.tremLfo.connect(this.tremGain);
    this.tremGain.connect(this.tremMaster.gain);
    this.tremMaster.connect(this.filter);
    this.tremLfo.start();

    // Shimmer reverb — bright cathedral-like reverb
    this.shimmerConv  = c.createConvolver();
    this.shimmerConv.buffer = buildIR(c, 'cathedral', 1.5);
    this.shimmerSendG = c.createGain(); this.shimmerSendG.gain.value = 0;
    this.comp.connect(this.shimmerSendG);
    this.shimmerSendG.connect(this.shimmerConv);
    this.shimmerConv.connect(this.panner);

    // Dark Void — very long dark reverb
    this.darkConv  = c.createConvolver();
    this.darkConv.buffer = buildIR(c, 'stadium', 1.0);
    this.darkSendG = c.createGain(); this.darkSendG.gain.value = 0;
    this.comp.connect(this.darkSendG);
    this.darkSendG.connect(this.darkConv);
    this.darkConv.connect(this.panner);

    // Rewire masterGain through tremMaster
    this.masterGain.disconnect(this.filter);
    this.masterGain.connect(this.tremMaster);
  }

  private _startLFO() {
    const c = this.ctx;
    this.lfoOsc  = c.createOscillator(); this.lfoOsc.type = 'sine'; this.lfoOsc.frequency.value = 2;
    this.lfoGain = c.createGain(); this.lfoGain.gain.value = 0;
    this.lfoOsc.connect(this.lfoGain);
    this.lfoOsc.start();
  }

  private _irCache = new Map<string, AudioBuffer>();

  private _getIR(type: ReverbType, decay: number): AudioBuffer {
    const key = `${type}-${Math.round(decay)}`;
    if (!this._irCache.has(key)) {
      this._irCache.set(key, buildIR(this.ctx, type, 0.5 + (decay / 100) * 1.5));
    }
    return this._irCache.get(key)!;
  }

  updateFX(state: VaultFXState) {
    this.fx = { ...state };
    const c = this.ctx;
    const now = c.currentTime;

    // Master
    this.masterGain.gain.setTargetAtTime(state.masterVol / 100, now, 0.02);

    // Filter
    this.filter.type      = (state.filterEnabled ? state.filterType : 'lowpass') as BiquadFilterType;
    this.filter.frequency.setTargetAtTime(state.filterEnabled ? state.filterCutoff : 20000, now, 0.02);
    this.filter.Q.setTargetAtTime(state.filterRes * 20, now, 0.02);

    // Reverb
    if (state.reverbEnabled) {
      try { this.reverbConv.buffer = this._getIR(state.reverbType, state.reverbDecay); } catch {}
      this.reverbSend.gain.setTargetAtTime(state.reverbSend / 100, now, 0.02);
    } else {
      this.reverbSend.gain.setTargetAtTime(0, now, 0.02);
    }

    // Delay
    const delMs = state.delayTime / 1000;
    this.delayL.delayTime.setTargetAtTime(delMs, now, 0.02);
    this.delayR.delayTime.setTargetAtTime(
      state.delayType === 'ping-pong' ? delMs * 0.667 : delMs * (state.delayType === 'stereo' ? 1.07 : 1),
      now, 0.02
    );
    this.delayFBL.gain.setTargetAtTime(state.delayFeedback / 100 * 0.9, now, 0.02);
    this.delayFBR.gain.setTargetAtTime(state.delayFeedback / 100 * 0.9, now, 0.02);
    const ds = state.delayEnabled ? state.delaySend / 100 : 0;
    this.delaySend.gain.setTargetAtTime(ds, now, 0.02);
    this.delaySendR.gain.setTargetAtTime(state.delayType === 'ping-pong' ? ds : 0, now, 0.02);

    // Chorus
    this.chorSendGain.gain.setTargetAtTime(state.chorusEnabled ? state.chorusSend / 100 : 0, now, 0.02);
    this.chorLfoL.frequency.setTargetAtTime(state.chorusRate, now, 0.02);
    this.chorLfoR.frequency.setTargetAtTime(state.chorusRate * 1.1, now, 0.02);
    const chorD = state.chorusDepth / 100 * 0.015;
    this.chorLfoGainL.gain.setTargetAtTime(chorD, now, 0.02);
    this.chorLfoGainR.gain.setTargetAtTime(chorD * 1.1, now, 0.02);

    // Dist
    const dMix = state.distEnabled ? state.distMix / 100 : 0;
    this.dist.curve = distCurve(state.distEnabled ? state.distDrive : 0, state.distType);
    this.distWet.gain.setTargetAtTime(dMix, now, 0.02);
    this.distDry.gain.setTargetAtTime(1 - dMix, now, 0.02);

    // EQ (4-band parametric)
    this.eqLow.gain.setTargetAtTime(state.eqEnabled ? state.eqLow : 0, now, 0.02);
    this.eqLow.frequency.setTargetAtTime(state.eqLowFreq, now, 0.02);
    this.eqMid.gain.setTargetAtTime(state.eqEnabled ? state.eqMid : 0, now, 0.02);
    this.eqMid.frequency.setTargetAtTime(state.eqMidFreq, now, 0.02);
    this.eqMid.Q.setTargetAtTime(Math.max(0.1, state.eqMidQ ?? 1), now, 0.02);
    this.eqHighMid.gain.setTargetAtTime(state.eqEnabled ? (state.eqHighMid ?? 0) : 0, now, 0.02);
    this.eqHighMid.frequency.setTargetAtTime(state.eqHighMidFreq ?? 3000, now, 0.02);
    this.eqHighMid.Q.setTargetAtTime(Math.max(0.1, state.eqHighMidQ ?? 1), now, 0.02);
    this.eqHigh.gain.setTargetAtTime(state.eqEnabled ? state.eqHigh : 0, now, 0.02);
    this.eqHigh.frequency.setTargetAtTime(state.eqHighFreq, now, 0.02);

    // Comp
    if (state.compEnabled) {
      this.comp.threshold.setTargetAtTime(state.compThreshold, now, 0.02);
      this.comp.ratio.setTargetAtTime(state.compRatio, now, 0.02);
      this.comp.attack.setTargetAtTime(state.compAttack / 1000, now, 0.02);
      this.comp.release.setTargetAtTime(state.compRelease / 1000, now, 0.02);
    } else {
      this.comp.threshold.setTargetAtTime(0, now, 0.02);
      this.comp.ratio.setTargetAtTime(1, now, 0.02);
    }

    // Tremolo
    this.tremLfo.frequency.setTargetAtTime(state.tremoloRate, now, 0.02);
    if (state.tremoloEnabled) {
      const depth = (state.tremoloDepth / 100) * 0.5;
      this.tremMaster.gain.setTargetAtTime(1 - depth, now, 0.02);
      this.tremGain.gain.setTargetAtTime(depth, now, 0.02);
    } else {
      this.tremMaster.gain.setTargetAtTime(1, now, 0.02);
      this.tremGain.gain.setTargetAtTime(0, now, 0.02);
    }

    // Shimmer
    this.shimmerSendG.gain.setTargetAtTime(state.shimmerEnabled ? state.shimmerSend / 100 : 0, now, 0.02);

    // Dark Void
    this.darkSendG.gain.setTargetAtTime(state.darkVoidEnabled ? state.darkVoidDecay / 100 * 0.7 : 0, now, 0.02);

    // LFO
    this.lfoOsc.frequency.setTargetAtTime(state.lfoRate, now, 0.02);
    // Disconnect LFO from everywhere first
    try { this.lfoGain.disconnect(); } catch {}
    if (state.lfoEnabled) {
      const depth = state.lfoDepth / 100;
      this.lfoGain.gain.setTargetAtTime(depth, now, 0.02);
      switch (state.lfoTarget) {
        case 'filter':    this.lfoGain.gain.setTargetAtTime(depth * 4000, now, 0.02); this.lfoGain.connect(this.filter.frequency); break;
        case 'amplitude': this.lfoGain.gain.setTargetAtTime(depth * 0.5, now, 0.02);  this.lfoGain.connect(this.masterGain.gain); break;
        case 'pan':       this.lfoGain.gain.setTargetAtTime(depth, now, 0.02);         this.lfoGain.connect(this.panner.pan); break;
        case 'reverb-send': this.lfoGain.gain.setTargetAtTime(depth * 0.5, now, 0.02); this.lfoGain.connect(this.reverbSend.gain); break;
        case 'delay-send':  this.lfoGain.gain.setTargetAtTime(depth * 0.5, now, 0.02); this.lfoGain.connect(this.delaySend.gain); break;
      }
    }
  }

  hasBuffer() { return this.buffer !== null; }

  loadBuffer(buffer: AudioBuffer, rootNote = 60) {
    this.noteOffAll();
    this.buffer = buffer;
    this.rootNote = rootNote;
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  clearBuffer() { this.noteOffAll(); this.buffer = null; }

  noteOn(note: number, _preset?: UnifiedPreset | null) {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const useSynth = !this.buffer; // no sample loaded → built-in synth voice

    // Legato: one voice; gliding pitch into the existing voice without
    // re-triggering the envelope when a note is already sounding.
    if (this.fx.playMode === 'legato') {
      this.heldOrder = this.heldOrder.filter(n => n !== note);
      this.heldOrder.push(note);
      const entry = this.activeNotes.size > 0 ? [...this.activeNotes.entries()][0] : null;
      if (entry) {
        const [oldNote, v] = entry;
        this.glideVoice(v, note);
        this.activeNotes.delete(oldNote);
        this.activeNotes.set(note, v);
        this.lastNote = note;
        return;
      }
      // nothing sounding yet — fall through to create the first voice
    } else if (this.fx.playMode === 'mono') {
      this.noteOffAll();
    } else {
      this.noteOff(note);
    }
    this.lastNote = note;

    const now  = this.ctx.currentTime;
    const halftimeFactor = this.fx.halftimeEnabled ? 0.5 : 1;
    const rate = Math.pow(2, (note - this.rootNote) / 12) * halftimeFactor;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(this.fx.masterVol / 100, now + (useSynth ? 0.012 : 0.004));
    env.connect(this.masterGain);

    let src: AudioScheduledSourceNode;
    let oscSrc: OscillatorNode | undefined;

    if (useSynth) {
      // ── Built-in synth voice (saw + sub-sine) so synth presets PLAY without a
      // loaded sample, like Multi-Realm's oscillator slots. Runs through the
      // existing Vault FX chain (filter/reverb/delay/etc.).
      const freq = 440 * Math.pow(2, (note - 69) / 12) * halftimeFactor;
      const main = this.ctx.createOscillator(); main.type = 'sawtooth'; main.frequency.value = freq;
      const sub  = this.ctx.createOscillator(); sub.type  = 'sine';     sub.frequency.value  = freq * 0.5;
      const subG = this.ctx.createGain(); subG.gain.value = 0.45;
      main.connect(env); sub.connect(subG); subG.connect(env);
      main.start(now); sub.start(now);
      src = main; oscSrc = sub;
    } else {
      const bsrc = this.ctx.createBufferSource();
      bsrc.buffer = this.buffer;
      bsrc.playbackRate.value = rate;
      bsrc.loop = false; // play once — noteOff stops it early if held shorter than sample
      bsrc.connect(env);
      bsrc.start(now);
      src = bsrc;

      // Secondary OSC (sample layering)
      if (this.fx.oscEnabled && this.fx.oscMode !== 'off') {
        oscSrc = this.ctx.createOscillator();
        oscSrc.type = this.fx.oscWave;
        const baseFreq = 440 * Math.pow(2, (note - 69) / 12);
        const intervals: Record<OscMode, number> = { sub: 0.5, unison: 1, fifth: 1.5, octave: 2, off: 0 };
        oscSrc.frequency.value = baseFreq * (intervals[this.fx.oscMode] || 1);
        if (this.fx.oscDetune) oscSrc.detune.value = this.fx.oscDetune;
        const oscEnv = this.ctx.createGain();
        oscEnv.gain.value = (this.fx.oscVolume / 100) * 0.3;
        oscSrc.connect(oscEnv);
        oscEnv.connect(this.masterGain);
        oscSrc.start(now);
      }
    }

    this.activeNotes.set(note, { src, env, oscSrc, isSynth: useSynth });
  }

  // Glide an active legato voice's pitch to a new note. Handles both sample
  // voices (playbackRate) and the built-in synth voice (oscillator frequency).
  private glideVoice(v: { src: AudioScheduledSourceNode; oscSrc?: OscillatorNode; isSynth?: boolean }, toNote: number) {
    const now = this.ctx.currentTime;
    const glide = 0.06;
    const halftime = this.fx.halftimeEnabled ? 0.5 : 1;
    if (v.isSynth) {
      const freq = 440 * Math.pow(2, (toNote - 69) / 12) * halftime;
      const main = v.src as OscillatorNode;
      main.frequency.cancelScheduledValues(now);
      main.frequency.setValueAtTime(main.frequency.value, now);
      main.frequency.linearRampToValueAtTime(freq, now + glide);
      if (v.oscSrc) {
        v.oscSrc.frequency.cancelScheduledValues(now);
        v.oscSrc.frequency.setValueAtTime(v.oscSrc.frequency.value, now);
        v.oscSrc.frequency.linearRampToValueAtTime(freq * 0.5, now + glide);
      }
      return;
    }
    const bs = v.src as AudioBufferSourceNode;
    const newRate = Math.pow(2, (toNote - this.rootNote) / 12) * halftime;
    bs.playbackRate.cancelScheduledValues(now);
    bs.playbackRate.setValueAtTime(bs.playbackRate.value, now);
    bs.playbackRate.linearRampToValueAtTime(newRate, now + glide);
    if (v.oscSrc) {
      const baseFreq = 440 * Math.pow(2, (toNote - 69) / 12);
      const intervals: Record<OscMode, number> = { sub: 0.5, unison: 1, fifth: 1.5, octave: 2, off: 0 };
      const f = baseFreq * (intervals[this.fx.oscMode] || 1);
      v.oscSrc.frequency.cancelScheduledValues(now);
      v.oscSrc.frequency.setValueAtTime(v.oscSrc.frequency.value, now);
      v.oscSrc.frequency.linearRampToValueAtTime(f, now + glide);
    }
  }

  noteOff(note: number) {
    // Legato: if other keys are still held, glide back to the latest held note
    // instead of releasing; only release once all keys are up.
    if (this.fx.playMode === 'legato') {
      this.heldOrder = this.heldOrder.filter(n => n !== note);
      const cur = this.activeNotes.get(note);
      if (cur && this.heldOrder.length > 0) {
        const target = this.heldOrder[this.heldOrder.length - 1];
        this.glideVoice(cur, target);
        this.activeNotes.delete(note);
        this.activeNotes.set(target, cur);
        this.lastNote = target;
        return;
      }
    }
    const v = this.activeNotes.get(note);
    if (!v) return;
    const now = this.ctx.currentTime;
    // Synth voices get a short release so they don't click; samples cut fast.
    const rel = v.isSynth ? 0.12 : 0.012;
    v.env.gain.cancelScheduledValues(now);
    v.env.gain.setValueAtTime(v.env.gain.value, now);
    v.env.gain.linearRampToValueAtTime(0, now + rel);
    try { v.src.stop(now + rel + 0.02); } catch {}
    if (v.oscSrc) { try { v.oscSrc.stop(now + rel + 0.02); } catch {} }
    this.activeNotes.delete(note);
  }

  noteOffAll() { this.activeNotes.forEach((_, n) => this.noteOff(n)); }

  setTabActive(active: boolean) {
    const t = this.ctx.currentTime;
    if (!active) { this.noteOffAll(); this.tabGain.gain.setTargetAtTime(0, t, 0.05); }
    else { this.tabGain.gain.setTargetAtTime(1, t, 0.05); if (this.ctx.state === 'suspended') this.ctx.resume(); }
  }

  dispose() {
    this.noteOffAll();
    try { this.lfoOsc.stop(); } catch {}
    try { this.chorLfoL.stop(); this.chorLfoR.stop(); } catch {}
    try { this.tremLfo.stop(); } catch {}
    // Do NOT close this.ctx — it is audioEngine.ctx (shared global), closing it kills all audio
  }
}

// ─── Library Sampler — maps a single audio file across MIDI keyboard ─────────

const LIBRARY_ROOT = CORE_LIBRARY_ROOT;

const LIBRARY_CATEGORIES: Record<string, { icon: string; type: string }> = {
  Keys:         { icon: '🎹', type: 'Keys' },
  Pads:         { icon: '☁', type: 'Pad' },
  Bass:         { icon: '🔱', type: 'Bass' },
  Leads:        { icon: '⚔', type: 'Lead' },
  Pluck:        { icon: '🌿', type: 'Pluck' },
  Synth:        { icon: '💎', type: 'Synth' },
  'Synth Brass':{ icon: '📯', type: 'Synth Brass' },
  Texture:      { icon: '🌌', type: 'Texture' },
  FX:           { icon: '🌀', type: 'FX' },
  Strings:      { icon: '🎻', type: 'Strings' },
  Organ:        { icon: '⛪', type: 'Organ' },
  Accents:      { icon: '✦', type: 'Accents' },
  Analog:       { icon: '⚡', type: 'Analog' },
  Bell:         { icon: '🔔', type: 'Bell' },
  Ethnic:       { icon: '🏛', type: 'Ethnic' },
  Guitar:       { icon: '🎸', type: 'Guitar' },
  Modulated:    { icon: '🌊', type: 'Modulated' },
  'Real Brass': { icon: '🏆', type: 'Real Brass' },
  Vox:          { icon: '🗣', type: 'Vox' },
  Wind:         { icon: '🌬', type: 'Wind' },
};

interface LibraryItem {
  name: string;
  path: string;        // full file system path
  category: string;
  rootNote: number;    // MIDI note the sample is tuned to (default 60 = C4)
}

class LibrarySampler {
  readonly ctx: AudioContext;
  private buffer: AudioBuffer | null = null;
  private tabGain: GainNode;
  private limiter: DynamicsCompressorNode;
  private masterGain: GainNode;
  private activeNotes = new Map<number, { src: AudioBufferSourceNode; env: GainNode }>();
  rootNote = 60;

  constructor() {
    this.ctx = audioEngine.ctx;
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.08;
    this.limiter.connect(audioEngine.masterBus);
    this.tabGain = this.ctx.createGain();
    this.tabGain.gain.value = 0; // silent until React activates this tab
    this.tabGain.connect(this.limiter);
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.tabGain);
  }

  setTabActive(active: boolean) {
    const t = this.ctx.currentTime;
    if (!active) {
      this.noteOffAll();
      this.tabGain.gain.setTargetAtTime(0, t, 0.05);
    } else {
      this.tabGain.gain.setTargetAtTime(1, t, 0.05);
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
  }

  /** Decode raw audio bytes (e.g. from the File System Access API) into the sampler. */
  async loadArrayBuffer(arr: ArrayBuffer, rootNote = 60): Promise<boolean> {
    this.rootNote = rootNote;
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      nativeAudio.loadSampleBytes(6, arr.slice(0));
      // decodeAudioData detaches the buffer; pass a copy so the caller's bytes survive.
      this.buffer = await this.ctx.decodeAudioData(arr.slice(0));
      return true;
    } catch {
      this.buffer = null;
      return false;
    }
  }

  async loadFile(path: string, rootNote = 60, timeoutMs = 3000): Promise<boolean> {
    this.buffer = null;
    this.rootNote = rootNote;
    // Try via JUCE file reader first, then file:// fallback
    return new Promise<boolean>((resolve) => {
      const id = `lib-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const done = (success: boolean) => {
        clearTimeout(timer);
        delete (window as any).__godRealmPendingFiles[id];
        resolve(success);
      };
      const timer = setTimeout(() => {
        delete (window as any).__godRealmPendingFiles[id];
        // Fallback: try file:// URL
        const url = 'file:///' + path.replace(/\\/g, '/');
        fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject())
          .then(arr => this.ctx.decodeAudioData(arr))
          .then(buf => { this.buffer = buf; resolve(true); })
          .catch(() => resolve(false));
      }, timeoutMs);

      if (!(window as any).__godRealmPendingFiles) (window as any).__godRealmPendingFiles = {};
      (window as any).__godRealmPendingFiles[id] = async (b64: string) => {
        try {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          if (this.ctx.state === 'suspended') await this.ctx.resume();
          nativeAudio.loadSampleBytes(6, bytes.buffer.slice(0));
          this.buffer = await this.ctx.decodeAudioData(bytes.buffer);
          done(true);
        } catch { done(false); }
      };

      try {
        (window as any).chrome?.webview?.postMessage(JSON.stringify({ type: 'LOAD_FILE_PATH', payload: { path, id } }));
      } catch {
        done(false);
      }
    });
  }

  async loadFileMultiRoot(category: string, filename: string, roots: string[], rootNote = 60): Promise<boolean> {
    for (const root of roots) {
      const path = `${root}\\${category}\\${filename}`;
      const ok = await this.loadFile(path, rootNote, 2000);
      if (ok) return true;
    }
    return false;
  }

  loadBuffer(buffer: AudioBuffer, rootNote = 60) {
    this.buffer = buffer;
    this.rootNote = rootNote;
  }

  noteOn(note: number, velocity = 100) {
    if (!this.buffer) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.noteOff(note);

    const now = this.ctx.currentTime;
    const rate = Math.pow(2, (note - this.rootNote) / 12);

    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = rate;

    const env = this.ctx.createGain();
    const vol = (velocity / 127) * 0.85;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vol, now + 0.005);

    src.connect(env);
    env.connect(this.masterGain);
    src.start(now);
    src.onended = () => { this.activeNotes.delete(note); };

    this.activeNotes.set(note, { src, env });
  }

  noteOff(note: number) {
    const v = this.activeNotes.get(note);
    if (!v) return;
    const now = this.ctx.currentTime;
    v.env.gain.cancelScheduledValues(now);
    v.env.gain.setValueAtTime(v.env.gain.value, now);
    v.env.gain.linearRampToValueAtTime(0, now + 0.3);
    try { v.src.stop(now + 0.32); } catch {}
    this.activeNotes.delete(note);
  }

  noteOffAll() {
    const now = this.ctx.currentTime;
    this.activeNotes.forEach(v => {
      v.env.gain.cancelScheduledValues(now);
      v.env.gain.setValueAtTime(v.env.gain.value, now);
      v.env.gain.linearRampToValueAtTime(0, now + 0.1);
      try { v.src.stop(now + 0.12); } catch {}
    });
    this.activeNotes.clear();
  }

  dispose() {
    this.noteOffAll();
    this.ctx.close();
  }
}

// ─── 3D Waveform Visualizer ───────────────────────────────────────────────────

interface WaveformVisualizerProps { buffer: AudioBuffer | null; isPlaying: boolean; }

const WaveformVisualizer3D: React.FC<WaveformVisualizerProps> = ({ buffer, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const phaseRef  = useRef(0);
  const glowRef   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width; const H = canvas.height;
    const ROWS = 20;
    const samples = buffer ? buffer.getChannelData(0) : null;
    const sLen = samples?.length ?? 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // Dark gradient background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, 'rgba(5,0,15,0.95)');
      bg.addColorStop(1, 'rgba(15,5,30,0.95)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      if (isPlaying && glowRef.current < 1) glowRef.current = Math.min(1, glowRef.current + 0.08);
      else if (!isPlaying && glowRef.current > 0) glowRef.current = Math.max(0, glowRef.current - 0.04);

      const glow = glowRef.current;
      phaseRef.current += isPlaying ? 0.04 : 0.008;
      const phase = phaseRef.current;

      // Perspective 3D grid of waveform rows
      const perspH = H * 0.85;
      const perspTop = H * 0.05;
      const vanishX = W / 2;
      const vanishY = perspTop;

      for (let row = 0; row < ROWS; row++) {
        const t = row / (ROWS - 1);
        const y = vanishY + t * perspH;
        const scale = 0.2 + t * 0.8;
        const rowW = W * scale;
        const rowX = vanishX - rowW / 2;
        const rowAmp = (40 + t * 60) * scale;
        const sampleOffset = Math.floor((row / ROWS + phase * 0.02) * sLen) % Math.max(1, sLen);
        const alpha = 0.15 + t * 0.6 + glow * 0.3;
        const hue = 240 + t * 80 + glow * 40;
        const brightness = 40 + t * 30 + glow * 30;

        ctx.beginPath();
        const pts = 64;
        for (let i = 0; i <= pts; i++) {
          const ix = i / pts;
          let amp = 0;
          if (samples && sLen > 0) {
            const si = (Math.floor(ix * sLen * 0.25) + sampleOffset) % sLen;
            amp = samples[si] * rowAmp;
          } else {
            amp = Math.sin(ix * Math.PI * 6 + phase + row * 0.4) * 15 * scale;
          }
          // Add glow pulse when playing
          if (isPlaying) amp *= 1 + glow * Math.sin(phase * 3 + row * 0.5) * 0.4;
          const px = rowX + ix * rowW;
          const py = y + amp;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `hsla(${hue},80%,${brightness}%,${alpha})`;
        ctx.lineWidth = 1 + t * 1.5;
        ctx.stroke();

        // Glow effect when playing
        if (glow > 0.1) {
          ctx.shadowColor = `hsla(${hue},100%,70%,${glow * 0.5})`;
          ctx.shadowBlur = 8 * glow;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Center glow when playing
      if (glow > 0) {
        const cg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.4);
        cg.addColorStop(0, `rgba(160,100,255,${glow * 0.15})`);
        cg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    canvas.width  = canvas.parentElement?.offsetWidth  ?? 300;
    canvas.height = canvas.parentElement?.offsetHeight ?? 90;
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [buffer, isPlaying]);

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
  );
};

// ─── Fire Background ─────────────────────────────────────────────────────────

const FireBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    interface Ember { x: number; y: number; vx: number; vy: number; r: number; life: number; maxLife: number; hue: number; }
    const embers: Ember[] = [];
    let animId: number;

    const spawn = () => {
      const x = Math.random() * canvas.width;
      const y = canvas.height * (0.6 + Math.random() * 0.4);
      embers.push({
        x, y,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(0.4 + Math.random() * 1.8),
        r: 1 + Math.random() * 2.5,
        life: 0,
        maxLife: 80 + Math.random() * 120,
        hue: 10 + Math.random() * 35,
      });
    };

    // Crack glow lines (static)
    const cracks: { x1: number; y1: number; x2: number; y2: number; w: number }[] = Array.from({ length: 12 }, () => ({
      x1: Math.random() * 300, y1: 100 + Math.random() * 300,
      x2: Math.random() * 300, y2: 100 + Math.random() * 300,
      w: 0.5 + Math.random() * 1.5,
    }));

    const render = () => {
      const W = canvas.width; const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Base dark gradient
      const bg = ctx.createRadialGradient(W / 2, H, 0, W / 2, H / 2, H);
      bg.addColorStop(0, 'rgba(80,20,0,0.55)');
      bg.addColorStop(0.5, 'rgba(30,8,0,0.35)');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Lava cracks
      cracks.forEach(c => {
        const glow = ctx.createLinearGradient(c.x1, c.y1, c.x2, c.y2);
        glow.addColorStop(0, 'rgba(255,80,0,0)');
        glow.addColorStop(0.5, `rgba(255,${100 + Math.random() * 60},0,0.35)`);
        glow.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2);
        ctx.strokeStyle = glow; ctx.lineWidth = c.w + Math.random() * 0.5;
        ctx.stroke();
      });

      // Spawn embers
      if (Math.random() < 0.35) spawn();

      // Draw embers
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.x += e.vx + Math.sin(e.life * 0.05) * 0.3;
        e.y += e.vy;
        e.life++;
        const alpha = Math.sin((e.life / e.maxLife) * Math.PI) * 0.9;
        const gr = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3);
        gr.addColorStop(0, `hsla(${e.hue},100%,70%,${alpha})`);
        gr.addColorStop(0.4, `hsla(${e.hue},90%,45%,${alpha * 0.5})`);
        gr.addColorStop(1, `hsla(${e.hue},80%,20%,0)`);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = gr; ctx.fill();
        if (e.life >= e.maxLife) embers.splice(i, 1);
      }
      animId = requestAnimationFrame(render);
    };

    const resize = () => {
      const p = canvas.parentElement;
      if (p) { canvas.width = p.offsetWidth; canvas.height = p.offsetHeight; }
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    animId = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.65 }}
    />
  );
};

// ─── FX control style constants ───────────────────────────────────────────────
const fxLabelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 3,
  color: 'rgba(255,160,80,0.8)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
};
const fxSliderStyle: React.CSSProperties = { width: '100%', accentColor: '#ff6400', cursor: 'pointer' };
const fxSelectStyle: React.CSSProperties = {
  background: 'rgba(255,100,0,0.1)', border: '1px solid rgba(255,100,0,0.25)',
  color: '#ff9040', borderRadius: 3, padding: '2px 4px', fontSize: 9, cursor: 'pointer', width: '100%',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const GodVault: React.FC<GodVaultProps> = ({
  parameterValues, update, onLoadPreset, showMessage, isActiveTab, onNavigate,
}) => {
  const [vaultMode, setVaultMode] = useState<'vault' | 'forge'>('vault');

  // Library sampler state
  const libSamplerRef = useRef<LibrarySampler | null>(null);
  const [libCategory, setLibCategory]     = useState<string | null>(null);
  const [libItem, setLibItem]             = useState<LibraryItem | null>(null);
  const [libLoading, setLibLoading]       = useState(false);
  const [libPressedKeys, setLibPressedKeys] = useState<Set<number>>(new Set());
  const [libSearch, setLibSearch]         = useState('');
  const [vizBuffer, setVizBuffer]         = useState<AudioBuffer | null>(null);
  const [isVizPlaying, setIsVizPlaying]   = useState(false);
  const [vaultSubTab, setVaultSubTab]     = useState<'presets' | 'library'>('presets');

  const getLibSampler = useCallback(() => {
    if (!libSamplerRef.current) libSamplerRef.current = new LibrarySampler();
    return libSamplerRef.current;
  }, []);

  useEffect(() => () => { libSamplerRef.current?.dispose(); libSamplerRef.current = null; }, []);

  // ── State (must come before audio engine hooks that reference selected) ────
  // Only show user-created presets; factory presets are intentionally excluded
  // so the vault starts empty and the user builds their own collection.
  const getUserPresets = useCallback(() => presetService.getVaultPresets().filter(p => p.source === 'user'), []);

  const [presets, setPresets]           = useState<UnifiedPreset[]>(() => getUserPresets());
  const [search, setSearch]             = useState('');
  const [typeFilter, setTypeFilter]     = useState('All');
  const [selected, setSelected]         = useState<UnifiedPreset | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName]         = useState('');
  const [saveType, setSaveType]         = useState('Multi-Realm');
  const [saveTags, setSaveTags]         = useState('');
  const [dragOverId, setDragOverId]     = useState<string | null>(null);
  const [dragSrcId, setDragSrcId]       = useState<string | null>(null);
  const [typeOrder, setTypeOrder]       = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vst-god-vault-type-order');
      const custom = localStorage.getItem('vst-god-vault-custom-types');
      const customArr: string[] = custom ? JSON.parse(custom) : [];
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        // Merge any custom types not already in the saved order
        const merged = [...parsed];
        for (const c of customArr) { if (!merged.includes(c)) merged.push(c); }
        // Also fold in any built-in types added in newer versions (e.g. Chopper)
        // so existing users still get the new category chips.
        for (const t of PRESET_TYPES) {
          if (!merged.includes(t)) {
            const insertAt = t === 'All' ? 0 : merged.length;
            merged.splice(insertAt, 0, t);
          }
        }
        return merged;
      }
      return [...PRESET_TYPES, ...customArr];
    } catch {}
    return PRESET_TYPES;
  });
  const [chipDragSrc, setChipDragSrc]   = useState<string | null>(null);
  const [chipDragOver, setChipDragOver] = useState<string | null>(null);
  const [isDragFile, setIsDragFile]     = useState(false);
  // Custom user-created tabs
  const [customTypes, setCustomTypes]   = useState<string[]>(() => {
    try { const s = localStorage.getItem('vst-god-vault-custom-types'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [showAddTab, setShowAddTab]     = useState(false);
  const [newTabName, setNewTabName]     = useState('');
  // FX preset save/load
  const [fxPresets, setFxPresets]       = useState<Record<string, VaultFXState>>(() => {
    try { const s = localStorage.getItem('vst-god-vault-fx-presets'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [fxPresetName, setFxPresetName] = useState('');
  const [showFXPresetMenu, setShowFXPresetMenu] = useState(false);
  const importRef                       = useRef<HTMLInputElement>(null);
  const [autoPreview, setAutoPreview]   = useState(() => {
    try { return localStorage.getItem('vst-god-vault-auto-preview') !== 'false'; } catch { return true; }
  });
  const autoPreviewRef = useRef(autoPreview);
  useEffect(() => { autoPreviewRef.current = autoPreview; localStorage.setItem('vst-god-vault-auto-preview', String(autoPreview)); }, [autoPreview]);
  const autoPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadedSampleName, setLoadedSampleName] = useState<string | null>(null);
  // User-located library root (persisted to localStorage)
  const [customLibraryRoot, setCustomLibraryRoot] = useState<string | null>(() => {
    try { return localStorage.getItem('vst-god-library-root') || null; } catch { return null; }
  });

  // Core Library folder located via the File System Access API (standalone + WebView2).
  const [fsLibName, setFsLibName] = useState<string | null>(null);
  useEffect(() => {
    const unsub = coreLibraryFS.subscribe((_located, name) => setFsLibName(name));
    void coreLibraryFS.restore();
    return unsub;
  }, []);

  // Preset Vault disk-sync folder (File System Access API, read/write).
  const [vaultFolderName, setVaultFolderName] = useState<string | null>(null);
  useEffect(() => {
    const unsub = presetVaultFS.subscribe((_located, name) => setVaultFolderName(name));
    (async () => {
      const granted = await presetVaultFS.restore();
      if (granted) await presetService.hydrateFromDisk();
    })();
    return unsub;
  }, []);

  const handleSyncFolder = useCallback(async () => {
    if (!presetVaultFS.supported) {
      showMessage?.('Folder sync needs a Chromium browser / the plugin');
      return;
    }
    const ok = await presetVaultFS.locate();
    if (!ok) return;
    // Pull in any presets already in the folder, then push everything back so
    // the folder is a complete, current backup.
    await presetService.hydrateFromDisk();
    await presetService.syncAllToDisk();
    showMessage?.(`PRESETS SYNCING TO: ${presetVaultFS.rootName}`);
  }, [showMessage]);

  const handleLocateLibrary = useCallback(async () => {
    if (coreLibraryFS.supported) {
      const ok = await coreLibraryFS.locate();
      if (ok) showMessage?.(`CORE LIBRARY LOCATED: ${coreLibraryFS.rootName}`);
      return;
    }
    // Fallback for non-Chromium hosts: ask JUCE to open a native folder browser.
    try {
      (window as any).chrome?.webview?.postMessage(JSON.stringify({ type: 'OPEN_FOLDER_BROWSER' }));
    } catch {}
  }, [showMessage]);

  // ── Vault FX state ────────────────────────────────────────────────────────
  const [vaultFX, setVaultFX] = useState<VaultFXState>(() => {
    try {
      const saved = localStorage.getItem('vst-god-vault-fx-v1');
      return saved ? { ...DEFAULT_VAULT_FX, ...JSON.parse(saved) } : { ...DEFAULT_VAULT_FX };
    } catch { return { ...DEFAULT_VAULT_FX }; }
  });
  const [fxTab, setFxTab] = useState<'filter'|'reverb'|'delay'|'chorus'|'dist'|'eq'|'comp'|'lfo'|'osc'>('reverb');
  const [showFXPanel, setShowFXPanel] = useState(false);

  const updateFX = useCallback(<K extends keyof VaultFXState>(key: K, val: VaultFXState[K]) => {
    setVaultFX(prev => {
      const next = { ...prev, [key]: val };
      try { localStorage.setItem('vst-god-vault-fx-v1', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Sync FX state to engine on every change
  useEffect(() => { engineRef.current?.updateFX(vaultFX); }, [vaultFX]);

  // ── Audio Preview Engine ───────────────────────────────────────────────────
  const engineRef = useRef<VaultPreviewEngine | null>(null);
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  const selectedRef = useRef<UnifiedPreset | null>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const vaultFXRef = useRef<VaultFXState>(vaultFX);
  useEffect(() => { vaultFXRef.current = vaultFX; }, [vaultFX]);

  // Track isActiveTab in a ref so getEngine() can apply it at lazy-init time.
  // Without this, setTabActive(true) runs while engineRef.current is still null
  // (no-op), and the newly-created engine's tabGain stays at 0 forever — silence.
  const isActiveTabRef = useRef(!!isActiveTab);
  useEffect(() => { isActiveTabRef.current = !!isActiveTab; }, [isActiveTab]);

  const getEngine = useCallback((): VaultPreviewEngine => {
    if (!engineRef.current) {
      engineRef.current = new VaultPreviewEngine();
      engineRef.current.updateFX(vaultFXRef.current);
      // Apply the current tab state immediately so tabGain is correct from
      // the first note. If the tab-activation effect already fired while the
      // engine didn't exist yet, this catch-up call opens the gain to 1.
      engineRef.current.setTabActive(isActiveTabRef.current);
    }
    return engineRef.current;
  }, []);

  // Dispose engine on unmount
  useEffect(() => () => { engineRef.current?.dispose(); engineRef.current = null; }, []);

  // Wire global JUCE file-loaded callback
  useEffect(() => {
    (window as any).__godRealmFileLoaded = (id: string, b64: string) => {
      const pending = (window as any).__godRealmPendingFiles;
      if (pending && pending[id]) pending[id](b64);
    };
    // Wire library locate callback
    (window as any).__godRealmLibraryLocated = (path: string) => {
      setCustomLibraryRoot(path);
      try { localStorage.setItem('vst-god-library-root', path); } catch {}
      showMessage?.(`LIBRARY LOCATED: ${path}`);
    };
    return () => {
      delete (window as any).__godRealmFileLoaded;
      delete (window as any).__godRealmLibraryLocated;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load audio for a preset from IndexedDB cache, then play C4 as preview
  const loadPresetAudio = useCallback(async (p: UnifiedPreset) => {
    const engine = getEngine();
    try {
      const arr = await AudioDB.get(p.id);
      if (!arr) { engine.clearBuffer(); setLoadedSampleName(null); return; }
      nativeAudio.loadSampleBytes(6, arr.slice(0));
      const buffer = await engine.ctx.decodeAudioData(arr.slice(0));
      engine.loadBuffer(buffer, 60);
      setVizBuffer(buffer);
      const name = p.state?.params?.sampleName ?? p.name;
      setLoadedSampleName(name);
      if (autoPreviewRef.current) {
        if (autoPreviewTimerRef.current) clearTimeout(autoPreviewTimerRef.current);
        engine.noteOn(60);
        setPressedKeys(prev => new Set(prev).add(60));
        setIsVizPlaying(true);
        autoPreviewTimerRef.current = setTimeout(() => {
          engine.noteOff(60);
          setPressedKeys(prev => { const s = new Set(prev); s.delete(60); return s; });
          setIsVizPlaying(false);
        }, 1500);
      }
    } catch {
      engine.clearBuffer();
      setLoadedSampleName(null);
    }
  }, [getEngine]);

  const pianoNoteOn = useCallback((note: number) => {
    getEngine().noteOn(note);
    setPressedKeys(prev => new Set(prev).add(note));
    setIsVizPlaying(true);
  }, [getEngine]);

  const pianoNoteOff = useCallback((note: number) => {
    setIsVizPlaying(false);
    getEngine().noteOff(note);
    setPressedKeys(prev => { const s = new Set(prev); s.delete(note); return s; });
  }, [getEngine]);

  // Tab isolation — silence all audio when not active
  useEffect(() => {
    engineRef.current?.setTabActive(!!isActiveTab);
    libSamplerRef.current?.setTabActive(!!isActiveTab);
  }, [isActiveTab]);

  // ── Sync Vault synth mode to native JUCE sampler (slot 6) ─────────────────
  // When no sample is loaded, Vault uses a built-in saw+sub-sine synth voice.
  // Upload a sawtooth single-cycle to slot 6 so MIDI from the DAW also plays
  // natively without going through the web audio bridge.
  useEffect(() => {
    if (!loadedSampleName) {
      // No sample loaded → synth mode: feed sawtooth as the looping waveform
      nativeAudio.loadOscWaveform(6, 'sawtooth');
    }
    // When a sample IS loaded, loadSampleBytes() is called during load — no extra action needed.
  }, [loadedSampleName]);

  // Preset Vault MIDI listener — only active when this tab is displayed
  // Only respond to notes on the displayed piano (C3=48 to B6=95).
  // This excludes low keys like D3 in FL Studio tuning (MIDI 38) that accidentally trigger.
  const VAULT_MIDI_MIN = 48;
  const VAULT_MIDI_MAX = 95;
  useEffect(() => {
    if (!isActiveTab) return;
    const unsub = neuralInputBus.addListener(ev => {
      if (ev.type === 'midi_note_on' && ev.note !== undefined) {
        const note = ev.note;
        if (note < VAULT_MIDI_MIN || note > VAULT_MIDI_MAX) return;
        if (vaultSubTab === 'library' && libItem) {
          getLibSampler().noteOn(note, ev.velocity ?? 100);
          setLibPressedKeys(prev => new Set(prev).add(note));
        } else {
          pianoNoteOn(note);
        }
      } else if (ev.type === 'midi_note_off' && ev.note !== undefined) {
        const note = ev.note;
        if (note < VAULT_MIDI_MIN || note > VAULT_MIDI_MAX) return;
        if (vaultSubTab === 'library' && libItem) {
          getLibSampler().noteOff(note);
          setLibPressedKeys(prev => { const s = new Set(prev); s.delete(note); return s; });
        } else {
          pianoNoteOff(note);
        }
      }
    });
    return () => {
      unsub();
      engineRef.current?.noteOffAll();
      libSamplerRef.current?.noteOffAll();
    };
  }, [isActiveTab, vaultSubTab, libItem, pianoNoteOn, pianoNoteOff, getLibSampler]);

  // Stop all notes when selected preset changes (avoid hanging notes)
  useEffect(() => { engineRef.current?.noteOffAll(); setPressedKeys(new Set()); }, [selected]);

  // ── Reactive sync from presetService ──────────────────────────────────────
  useEffect(() => {
    return presetService.onChange(() => {
      setPresets(getUserPresets());
    });
  }, [getUserPresets]);

  // ── Filtered view ──────────────────────────────────────────────────────────
  const visible = presets.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchType = typeFilter === 'All' || p.type === typeFilter;
    return matchSearch && matchType;
  });

  // ── Save preset ────────────────────────────────────────────────────────────
  const openSaveModal = useCallback(() => {
    setSaveName(`My Preset ${presets.length + 1}`);
    setSaveType('Multi-Realm');
    setSaveTags('');
    setShowSaveModal(true);
  }, [presets.length]);

  const commitSave = useCallback(() => {
    if (!saveName.trim()) return;
    const tags = saveTags.split(',').map(t => t.trim()).filter(Boolean);
    const saved = presetService.saveAs({
      name: saveName.trim(),
      type: saveType,
      tags,
      state: { params: { ...parameterValues } },
    });
    showMessage?.(`SAVED: ${saved.name}`);
    setShowSaveModal(false);
    setSelected(saved);
  }, [saveName, saveType, saveTags, parameterValues, showMessage]);

  // ── Load preset ────────────────────────────────────────────────────────────
  const loadPreset = useCallback((p: UnifiedPreset) => {
    onLoadPreset(p);
    showMessage?.(`LOADED: ${p.name}`);
  }, [onLoadPreset, showMessage]);

  // ── Delete preset ──────────────────────────────────────────────────────────
  const deletePreset = useCallback((id: string) => {
    presetService.delete(id);
    if (selected?.id === id) setSelected(null);
    showMessage?.('PRESET DELETED');
  }, [selected]);

  // ── Toggle favourite ───────────────────────────────────────────────────────
  const toggleFav = useCallback((p: UnifiedPreset) => {
    presetService.save({ ...p, fav: !p.fav });
  }, []);

  // ── Drag-and-drop reorder ──────────────────────────────────────────────────
  const onDragStart = useCallback((id: string) => setDragSrcId(id), []);
  const onDragOver  = useCallback((id: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(id);
  }, []);
  const onDrop = useCallback((targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragSrcId || dragSrcId === targetId) { setDragSrcId(null); return; }
    const all = [...presets];
    const srcIdx = all.findIndex(p => p.id === dragSrcId);
    const tgtIdx = all.findIndex(p => p.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) { setDragSrcId(null); return; }
    const [item] = all.splice(srcIdx, 1);
    all.splice(tgtIdx, 0, item);
    presetService.importVault(JSON.stringify(all));
    setDragSrcId(null);
  }, [presets, dragSrcId]);

  // ── Drop audio file to create Oneshot preset ───────────────────────────────
  const onFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragFile(false);
    if (vaultSubTab === 'library') return;
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('audio/') || /\.(wav|mp3|flac|aiff|aif|ogg|sf2)$/i.test(f.name)
    );
    if (!files.length) return;

    const engine = getEngine();
    let lastPreset: UnifiedPreset | null = null;

    for (const file of files) {
      const name = file.name.replace(/\.[^.]+$/, '');
      // Save preset entry first to get an ID
      const saved = presetService.saveAs({
        name,
        type: typeFilter !== 'All' ? typeFilter : 'Oneshot',
        tags: ['sample', 'oneshot'],
        state: { params: { sampleName: name, sampleFile: file.name } },
      });
      lastPreset = saved;
      // Decode and cache the audio in IndexedDB keyed by preset ID
      try {
        const arr: ArrayBuffer = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = ev => res(ev.target!.result as ArrayBuffer);
          reader.onerror = () => rej(reader.error);
          reader.readAsArrayBuffer(file);
        });
        await AudioDB.set(saved.id, arr);
        // Load the last file into the engine
        if (file === files[files.length - 1]) {
          nativeAudio.loadSampleBytes(6, arr.slice(0));
          const buffer = await engine.ctx.decodeAudioData(arr.slice(0));
          engine.loadBuffer(buffer, 60);
          setLoadedSampleName(name);
          setSelected(saved);
          // Auto-preview C4
          engine.noteOn(60);
          setPressedKeys(prev => new Set(prev).add(60));
          setTimeout(() => {
            engine.noteOff(60);
            setPressedKeys(prev => { const s = new Set(prev); s.delete(60); return s; });
          }, 1500);
        }
      } catch { /* decode failed — preset entry still saved */ }
    }
    showMessage?.(`${files.length} SAMPLE${files.length > 1 ? 'S' : ''} SAVED TO VAULT — play on keyboard!`);
    void lastPreset;
  }, [showMessage, vaultSubTab, getEngine]);

  // ── Import / Export ────────────────────────────────────────────────────────
  const exportVault = useCallback(() => {
    const json = presetService.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'god-vault-presets.json'; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importVault = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const result = presetService.importVault(text);
      if (result) showMessage?.(`IMPORTED ${result.length} PRESETS`);
      else showMessage?.('IMPORT FAILED — invalid file');
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [showMessage]);

  // ── Library: load a core sample by path ─────────────────────────────────
  const loadCoreSample = useCallback(async (category: string, sample: CoreSample) => {
    const item: LibraryItem = { name: sample.name, path: `${CORE_LIBRARY_ROOT}\\${category}\\${sample.file}`, category, rootNote: 60 };
    setLibLoading(true);
    setLibItem(item);
    const sampler = getLibSampler();

    // Preferred path: read directly from the user-located Core Library folder via
    // the File System Access API (works in standalone Chrome and WebView2 alike).
    let ok = false;
    if (coreLibraryFS.isLocated) {
      const buf = await coreLibraryFS.getFileBuffer(category, sample.file);
      if (buf) ok = await sampler.loadArrayBuffer(buf, 60);
    }

    // Fallback: the legacy JUCE file-reader / file:// bridge by absolute path.
    if (!ok) {
      const roots = customLibraryRoot
        ? [customLibraryRoot, ...CORE_LIBRARY_ROOTS.filter(r => r !== customLibraryRoot)]
        : CORE_LIBRARY_ROOTS;
      ok = await sampler.loadFileMultiRoot(category, sample.file, roots, 60);
    }
    setLibLoading(false);
    if (ok) {
      setVizBuffer((sampler as any)['buffer'] as AudioBuffer | null);
      showMessage?.(`LOADED: ${sample.name}`);
      setTimeout(() => {
        sampler.setTabActive(true);
        sampler.noteOn(60, 100);
        setTimeout(() => sampler.noteOff(60), 2000);
      }, 120);
    } else {
      showMessage?.(`Could not load "${sample.file}" — drag it from Explorer`);
    }
  }, [getLibSampler, showMessage, customLibraryRoot]);

  // ── Library: load a file into the sampler ─────────────────────────────────
  const loadLibraryItem = useCallback(async (item: LibraryItem) => {
    setLibLoading(true);
    setLibItem(item);
    const sampler = getLibSampler();
    const ok = await sampler.loadFile(item.path, item.rootNote);
    setLibLoading(false);
    if (ok) {
      showMessage?.(`LOADED: ${item.name} — play on keyboard`);
    } else {
      showMessage?.(`DRAG "${item.name}" onto the keyboard or drop it here`);
    }
  }, [getLibSampler, showMessage]);

  // ── Library: drag file onto keyboard to load ───────────────────────────────
  // ── Date formatting ────────────────────────────────────────────────────────
  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(); } catch { return ''; }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="god-vault"
      style={{ position: 'relative' }}
      onDragEnter={e => { if (vaultSubTab !== 'library' && e.dataTransfer.types.includes('Files')) setIsDragFile(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragFile(false); }}
      onDragOver={e => { if (vaultSubTab !== 'library' && e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={onFileDrop}
    >
      {vaultMode === 'vault' && vaultSubTab !== 'library' && <FireBackground />}
      {/* ── Preset Vault ── */}
      {<>

      {/* ── File-drop overlay ── */}
      {isDragFile && (
        <div className="god-vault__drop-overlay">
          <div className="god-vault__drop-message">
            DROP AUDIO FILE<br />
            <span>Creates an Oneshot preset in the vault</span>
          </div>
        </div>
      )}

      {/* ── Vault sub-tabs: God Presets | Core Library ── */}
      <div style={{
        display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.28)',
        background: 'rgba(0,0,0,0.25)', flexShrink: 0,
      }}>
        {([
          { id: 'presets' as const, label: '⚡ God Presets' },
          { id: 'library' as const, label: '🎵 Core Library' },
        ]).map(t => (
          <button key={t.id} onClick={() => setVaultSubTab(t.id)} style={{
            flex: 1, padding: '7px 0', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
            textTransform: 'uppercase', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: vaultSubTab === t.id ? 'rgba(245,158,11,0.08)' : 'transparent',
            color: vaultSubTab === t.id ? '#f59e0b' : 'rgba(255, 255, 255, 0.47)',
            borderBottom: vaultSubTab === t.id ? '2px solid #f59e0b' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── LIBRARY MODE ── */}
      {vaultSubTab === 'library' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Locate Library banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.04)', flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: (fsLibName || customLibraryRoot) ? '#4ade80' : 'rgba(245,158,11,0.7)', flex: 1, letterSpacing: '0.06em' }}>
              {fsLibName
                ? `CORE LIBRARY: ${fsLibName}`
                : customLibraryRoot
                  ? `LIBRARY: ${customLibraryRoot.split(/[\\/]/).pop()}`
                  : 'Core Library not located — click LOCATE to choose the folder'}
            </span>
            <button
              onClick={handleLocateLibrary}
              style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 9, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >{fsLibName ? 'RELOCATE' : 'LOCATE LIBRARY'}</button>
          </div>

          {/* Category grid */}
          {!libCategory ? (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                VSTGOD Core Library — select a category
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                {Object.entries(LIBRARY_CATEGORIES).map(([cat, { icon }]) => (
                  <button key={cat} onClick={() => setLibCategory(cat)} style={{
                    background: 'rgba(255, 255, 255, 0.26)', border: '1px solid rgba(255, 255, 255, 0.30)',
                    borderRadius: 8, padding: '10px 6px', cursor: 'pointer', display: 'flex',
                    flexDirection: 'column', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(245,158,11,0.4)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255, 255, 255, 0.30)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.26)'; }}
                  >
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{cat}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Category header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.28)', flexShrink: 0 }}>
                <button onClick={() => { setLibCategory(null); setLibItem(null); }} style={{
                  background: 'rgba(255, 255, 255, 0.27)', border: '1px solid rgba(255, 255, 255, 0.32)',
                  borderRadius: 4, padding: '3px 8px', color: 'rgba(255,255,255,0.5)', fontSize: 9, cursor: 'pointer', letterSpacing: '0.1em',
                }}>← BACK</button>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {LIBRARY_CATEGORIES[libCategory]?.icon} {libCategory}
                </span>
                {libItem && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                    {libLoading ? '⏳ LOADING...' : `▶ ${libItem.name}`}
                  </span>
                )}
              </div>

              {/* Search + sample list */}
              <div style={{ padding: '6px 12px 4px', flexShrink: 0 }}>
                <input
                  value={libSearch}
                  onChange={e => setLibSearch(e.target.value)}
                  placeholder="Search sounds..."
                  style={{
                    width: '100%', boxSizing: 'border-box', background: 'rgba(255, 255, 255, 0.27)',
                    border: '1px solid rgba(255, 255, 255, 0.32)', borderRadius: 5, padding: '5px 10px',
                    color: '#fff', fontSize: 10, outline: 'none',
                  }}
                />
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '4px 12px 8px' }}>
                {(() => {
                  const samples = (CORE_LIBRARY[libCategory!] ?? []).filter(s =>
                    !libSearch || s.name.toLowerCase().includes(libSearch.toLowerCase())
                  );
                  if (!samples.length) return (
                    <div style={{ padding: 16, textAlign: 'center', color: 'rgba(255, 255, 255, 0.52)', fontSize: 10 }}>
                      No samples match "{libSearch}"
                    </div>
                  );
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {samples.map(s => {
                        const isActive = libItem?.name === s.name && libItem?.category === libCategory;
                        return (
                          <button
                            key={s.file}
                            onClick={() => loadCoreSample(libCategory!, s)}
                            style={{
                              background: isActive ? 'rgba(245,158,11,0.15)' : 'rgba(255, 255, 255, 0.25)',
                              border: `1px solid ${isActive ? 'rgba(245,158,11,0.4)' : 'rgba(255, 255, 255, 0.28)'}`,
                              borderRadius: 5, padding: '6px 10px', cursor: 'pointer', textAlign: 'left',
                              color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.7)',
                              fontSize: 10, fontWeight: isActive ? 700 : 400,
                              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.12s',
                            }}
                          >
                            <span style={{ fontSize: 8, opacity: 0.5, minWidth: 10 }}>{isActive && libLoading ? '⏳' : isActive ? '▶' : '▷'}</span>
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Library keyboard — always visible when a sample is loaded */}
          {libItem && (
            <div className="god-vault__keyboard" style={{ background: '#050508', borderTop: '1px solid rgba(245,158,11,0.2)', display: 'flex', flexDirection: 'column' }}>
              {/* 3D Waveform for library */}
              <div style={{ height: 70, overflow: 'hidden', flexShrink: 0 }}>
                <WaveformVisualizer3D buffer={vizBuffer} isPlaying={libPressedKeys.size > 0} />
              </div>
              <div style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {libLoading ? '⏳ LOADING SAMPLE...' : `🎹 ${libItem.name}`}
                </span>
                <span style={{ fontSize: 8, color: 'rgba(255, 255, 255, 0.52)' }}>C4 = ROOT · pitch-shifted via playbackRate</span>
                {isActiveTab && <span style={{ marginLeft: 'auto', fontSize: 8, color: '#34d399' }}>● MIDI ACTIVE</span>}
              </div>
              <div style={{ display: 'flex', height: 52, padding: '0 4px 4px' }}>
                {PIANO_KEYS.filter(k => !k.isBlack).map(wk => {
                  const blackAfter = PIANO_KEYS.find(k => k.isBlack && k.midi === wk.midi + 1 && ['C#','D#','F#','G#','A#'].includes(k.name));
                  const isOn = libPressedKeys.has(wk.midi);
                  return (
                    <div key={wk.midi} style={{ position: 'relative', flex: 1, height: '100%' }}>
                      <div
                        style={{
                          position: 'absolute', inset: 0,
                          background: isOn ? '#f59e0b' : 'rgba(228,215,248,0.88)',
                          border: '1px solid rgba(120,80,200,0.3)', borderTop: 'none',
                          borderRadius: '0 0 3px 3px', cursor: 'pointer', transition: 'background 0.04s',
                          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2,
                        }}
                        onMouseDown={e => {
                          e.preventDefault();
                          if (!libLoading) { getLibSampler().noteOn(wk.midi); setLibPressedKeys(prev => new Set(prev).add(wk.midi)); }
                        }}
                        onMouseUp={() => { getLibSampler().noteOff(wk.midi); setLibPressedKeys(prev => { const s = new Set(prev); s.delete(wk.midi); return s; }); }}
                        onMouseLeave={() => { if (libPressedKeys.has(wk.midi)) { getLibSampler().noteOff(wk.midi); setLibPressedKeys(prev => { const s = new Set(prev); s.delete(wk.midi); return s; }); } }}
                      >
                        {wk.name === 'C' && <span style={{ fontSize: 6, color: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }}>{wk.name}{wk.octave}</span>}
                      </div>
                      {blackAfter && (
                        <div
                          style={{
                            position: 'absolute', top: 0, right: '-28%', width: '56%', height: '60%',
                            background: libPressedKeys.has(blackAfter.midi) ? '#f59e0b' : '#1a0d2e',
                            border: '1px solid rgba(168,85,247,0.4)', borderTop: 'none',
                            borderRadius: '0 0 3px 3px', cursor: 'pointer', zIndex: 2, transition: 'background 0.04s',
                          }}
                          onMouseDown={e => {
                            e.preventDefault();
                            if (!libLoading) { getLibSampler().noteOn(blackAfter.midi); setLibPressedKeys(prev => new Set(prev).add(blackAfter.midi)); }
                          }}
                          onMouseUp={() => { getLibSampler().noteOff(blackAfter.midi); setLibPressedKeys(prev => { const s = new Set(prev); s.delete(blackAfter.midi); return s; }); }}
                          onMouseLeave={() => { if (libPressedKeys.has(blackAfter.midi)) { getLibSampler().noteOff(blackAfter.midi); setLibPressedKeys(prev => { const s = new Set(prev); s.delete(blackAfter.midi); return s; }); } }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PRESETS MODE — only show when on presets sub-tab ── */}
      {vaultSubTab !== 'library' && <>

      {/* ── Header ── */}
      <div className="god-vault__header">
        <div className="god-vault__title-row">
          <h2 className="god-vault__title">PRESET VAULT</h2>
          <span className="god-vault__count">{presets.length} PRESETS</span>
        </div>

        <div className="god-vault__toolbar">
          <button className="god-vault__btn god-vault__btn--save" onClick={openSaveModal}>
            + SAVE CURRENT STATE
          </button>
          <button
            onClick={() => setAutoPreview(p => !p)}
            title={autoPreview ? 'Auto-Preview ON — click to disable' : 'Auto-Preview OFF — click to enable'}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
              border: autoPreview ? '1px solid rgba(52,211,153,0.5)' : '1px solid rgba(255, 255, 255, 0.32)',
              background: autoPreview ? 'rgba(52,211,153,0.12)' : 'rgba(255, 255, 255, 0.26)',
              color: autoPreview ? '#34d399' : 'rgba(255, 255, 255, 0.52)',
            }}
          >{autoPreview ? '▶ AUTO' : '▶ OFF'}</button>
          <input
            className="god-vault__search"
            placeholder="Search presets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="god-vault__actions">
            <button
              className="god-vault__btn god-vault__btn--sm"
              onClick={handleSyncFolder}
              title={vaultFolderName
                ? `Presets auto-save to: ${vaultFolderName}. Click to change folder.`
                : 'Choose a folder on your computer to keep your presets safe forever'}
              style={vaultFolderName ? { borderColor: 'rgba(74,222,128,0.5)', color: '#4ade80' } : undefined}
            >
              {vaultFolderName ? `📁 ${vaultFolderName}` : '📁 SYNC FOLDER'}
            </button>
            <button className="god-vault__btn god-vault__btn--sm" onClick={exportVault} title="Export vault to JSON">
              EXPORT
            </button>
            <button className="god-vault__btn god-vault__btn--sm" onClick={() => importRef.current?.click()} title="Import vault from JSON">
              IMPORT
            </button>
            <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importVault} />
          </div>
        </div>

        {/* Type filter chips — draggable to reorder; drop a preset ON a chip to reclassify */}
        <div className="god-vault__chips">
          {typeOrder.map(t => (
            <button
              key={t}
              draggable
              className={`god-vault__chip ${typeFilter === t ? 'god-vault__chip--active' : ''} ${chipDragOver === t && chipDragSrc !== t ? 'god-vault__chip--dragover' : ''}`}
              onClick={() => setTypeFilter(t)}
              onDragStart={() => setChipDragSrc(t)}
              onDragOver={e => { e.preventDefault(); setChipDragOver(t); }}
              onDragLeave={() => setChipDragOver(null)}
              onDrop={e => {
                e.preventDefault();
                setChipDragOver(null);
                // Case 1: A preset item is being dragged → reclassify it
                if (dragSrcId && t !== 'All') {
                  const target = presets.find(p => p.id === dragSrcId);
                  if (target) {
                    presetService.save({ ...target, type: t });
                    showMessage?.(`MOVED TO ${t.toUpperCase()}`);
                  }
                  setDragSrcId(null);
                  return;
                }
                // Case 2: A chip is being dragged → reorder chips
                if (!chipDragSrc || chipDragSrc === t) { setChipDragSrc(null); return; }
                setTypeOrder(prev => {
                  const next = prev.filter(x => x !== chipDragSrc);
                  const idx = next.indexOf(t);
                  next.splice(idx, 0, chipDragSrc);
                  try { localStorage.setItem('vst-god-vault-type-order', JSON.stringify(next)); } catch {}
                  return next;
                });
                setChipDragSrc(null);
              }}
              onDragEnd={() => { setChipDragSrc(null); setChipDragOver(null); }}
            >
              {t}
              {customTypes.includes(t) && (
                <span
                  style={{ marginLeft: 4, opacity: 0.6, fontSize: 9, cursor: 'pointer' }}
                  onClick={ev => {
                    ev.stopPropagation();
                    const next = customTypes.filter(c => c !== t);
                    setCustomTypes(next);
                    setTypeOrder(prev => prev.filter(x => x !== t));
                    try { localStorage.setItem('vst-god-vault-custom-types', JSON.stringify(next)); } catch {}
                    if (typeFilter === t) setTypeFilter('All');
                  }}
                >✕</span>
              )}
            </button>
          ))}
          {/* Add custom tab */}
          {showAddTab ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                autoFocus
                value={newTabName}
                onChange={e => setNewTabName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newTabName.trim()) {
                    const name = newTabName.trim();
                    if (!typeOrder.includes(name)) {
                      const nextCustom = [...customTypes, name];
                      const nextOrder = [...typeOrder, name];
                      setCustomTypes(nextCustom);
                      setTypeOrder(nextOrder);
                      try {
                        localStorage.setItem('vst-god-vault-custom-types', JSON.stringify(nextCustom));
                        localStorage.setItem('vst-god-vault-type-order', JSON.stringify(nextOrder));
                      } catch {}
                    }
                    setNewTabName('');
                    setShowAddTab(false);
                  } else if (e.key === 'Escape') {
                    setNewTabName('');
                    setShowAddTab(false);
                  }
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.32)', border: '1px solid rgba(168,85,247,0.5)',
                  borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 11, width: 90, outline: 'none',
                }}
                placeholder="Tab name…"
              />
              <button className="god-vault__chip" onClick={() => setShowAddTab(false)} style={{ padding: '2px 6px' }}>✕</button>
            </div>
          ) : (
            <button className="god-vault__chip" style={{ opacity: 0.6 }} onClick={() => setShowAddTab(true)} title="Add custom tab">+</button>
          )}
        </div>
      </div>

      {/* ── Split layout: list + detail ── */}
      <div className="god-vault__body">
        {/* ── Preset list ── */}
        <div className="god-vault__list">
          {visible.length === 0 ? (
            <div className="god-vault__empty">
              {presets.length === 0 ? (
                <>
                  <div className="god-vault__empty-icon">⬡</div>
                  <div className="god-vault__empty-title">VAULT IS EMPTY</div>
                  <div className="god-vault__empty-sub">
                    Click <strong>+ SAVE CURRENT STATE</strong> to add your first preset,<br />
                    or drop an audio file here to create an Oneshot preset.
                  </div>
                </>
              ) : (
                <div className="god-vault__empty-title">NO RESULTS</div>
              )}
            </div>
          ) : (
            visible.map(p => (
              <div
                key={p.id}
                className={[
                  'god-vault__item',
                  selected?.id === p.id ? 'god-vault__item--selected' : '',
                  dragOverId === p.id ? 'god-vault__item--dragover' : '',
                ].join(' ')}
                draggable
                onDragStart={() => onDragStart(p.id)}
                onDragOver={e => onDragOver(p.id, e)}
                onDrop={e => onDrop(p.id, e)}
                onDragEnd={() => setDragOverId(null)}
                onClick={() => {
                  setSelected(p);
                  loadPreset(p);
                  loadPresetAudio(p);
                }}
                onDoubleClick={() => {
                  // Chopper presets: load the chop params and jump to the Chopper.
                  if (p.type === 'Chopper') {
                    loadPreset(p);
                    onNavigate?.('Sample Chopper');
                    return;
                  }
                  if ((p.state as any)?.source === 'sound-realm') {
                    onNavigate?.('Sound Realm');
                  }
                }}
              >
                <div className="god-vault__item-type-dot" data-type={p.type} />
                <div className="god-vault__item-info">
                  <span className="god-vault__item-name">{p.name}</span>
                  <span className="god-vault__item-meta">{p.type} · {fmtDate(p.lastModified)}</span>
                </div>
                <div className="god-vault__item-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className={`god-vault__fav ${p.fav ? 'god-vault__fav--on' : ''}`}
                    onClick={() => toggleFav(p)}
                    title={p.fav ? 'Unfavourite' : 'Favourite'}
                  >★</button>
                  <button
                    className="god-vault__load-btn"
                    onClick={() => loadPreset(p)}
                    title="Load preset"
                  >▶ LOAD</button>
                  <button
                    className="god-vault__del-btn"
                    onClick={() => deletePreset(p.id)}
                    title="Delete preset"
                  >✕</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Detail panel ── */}
        <div className="god-vault__detail">
          {selected ? (
            <>
              <div className="god-vault__detail-name">{selected.name}</div>
              <div className="god-vault__detail-type">{selected.type}</div>
              {(selected.tags ?? []).length > 0 && (
                <div className="god-vault__detail-tags">
                  {(selected.tags ?? []).map(t => (
                    <span key={t} className="god-vault__tag">{t}</span>
                  ))}
                </div>
              )}
              <div className="god-vault__detail-meta">
                <span>Author: {selected.author}</span>
                <span>Saved: {fmtDate(selected.lastModified)}</span>
                <span>Energy: {Math.round(selected.energyLevel)}%</span>
              </div>
              <div className="god-vault__detail-btns">
                <button
                  className="god-vault__btn god-vault__btn--load"
                  onClick={() => loadPreset(selected)}
                >
                  ▶ LOAD PRESET
                </button>
                <button
                  className="god-vault__btn god-vault__btn--overwrite"
                  onClick={() => {
                    presetService.save({ ...selected, state: { params: { ...parameterValues } } });
                    showMessage?.(`OVERWRITTEN: ${selected.name}`);
                  }}
                >
                  ↺ OVERWRITE
                </button>
                <button
                  className="god-vault__btn god-vault__btn--delete"
                  onClick={() => deletePreset(selected.id)}
                >
                  ✕ DELETE
                </button>
              </div>
            </>
          ) : (
            <div className="god-vault__detail-placeholder">
              Select a preset to see details
            </div>
          )}
        </div>
      </div>

      {/* ── Save Modal ── */}
      {showSaveModal && (
        <div className="god-vault__modal-backdrop" onClick={() => setShowSaveModal(false)}>
          <div className="god-vault__modal" onClick={e => e.stopPropagation()}>
            <h3 className="god-vault__modal-title">SAVE PRESET</h3>

            <label className="god-vault__label">NAME</label>
            <input
              className="god-vault__input"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitSave(); if (e.key === 'Escape') setShowSaveModal(false); }}
              autoFocus
            />

            <label className="god-vault__label">TYPE</label>
            <select className="god-vault__select" value={saveType} onChange={e => setSaveType(e.target.value)}>
              {PRESET_TYPES.filter(t => t !== 'All').map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <label className="god-vault__label">TAGS (comma separated)</label>
            <input
              className="god-vault__input"
              value={saveTags}
              onChange={e => setSaveTags(e.target.value)}
              placeholder="e.g. dark, trap, 808"
            />

            <div className="god-vault__modal-btns">
              <button className="god-vault__btn god-vault__btn--save" onClick={commitSave}>
                SAVE
              </button>
              <button className="god-vault__btn god-vault__btn--cancel" onClick={() => setShowSaveModal(false)}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FX Panel ── */}
      {showFXPanel && (
        <div style={{
          background: 'rgba(5,2,0,0.97)', borderTop: '1px solid rgba(255,100,0,0.25)',
          padding: '10px 12px', flexShrink: 0, zIndex: 2, position: 'relative',
          maxHeight: 260, overflowY: 'auto',
        }}>
          {/* Pedal Effects Row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {/* HALFTIME */}
            <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.25)', border: `1px solid ${vaultFX.halftimeEnabled ? 'rgba(245,158,11,0.4)' : 'rgba(255, 255, 255, 0.30)'}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>HALFTIME</div>
                <div style={{ fontSize: 8, color: 'rgba(255, 255, 255, 0.57)' }}>0.5× · chopped &amp; screwed</div>
              </div>
              <button onClick={() => updateFX('halftimeEnabled', !vaultFX.halftimeEnabled)} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', background: vaultFX.halftimeEnabled ? 'rgba(245,158,11,0.3)' : 'rgba(255, 255, 255, 0.28)', color: vaultFX.halftimeEnabled ? '#f59e0b' : 'rgba(255, 255, 255, 0.47)' }}>
                {vaultFX.halftimeEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {/* TREMOLO */}
            <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.25)', border: `1px solid ${vaultFX.tremoloEnabled ? 'rgba(52,211,153,0.4)' : 'rgba(255, 255, 255, 0.30)'}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>TREMOLO</div>
                <input type="range" min={0.5} max={15} step={0.1} value={vaultFX.tremoloRate} onChange={e => updateFX('tremoloRate', +e.target.value)} style={{ width: '100%', accentColor: '#34d399' }} title={`Rate: ${vaultFX.tremoloRate.toFixed(1)}Hz`}/>
              </div>
              <button onClick={() => updateFX('tremoloEnabled', !vaultFX.tremoloEnabled)} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', background: vaultFX.tremoloEnabled ? 'rgba(52,211,153,0.25)' : 'rgba(255, 255, 255, 0.28)', color: vaultFX.tremoloEnabled ? '#34d399' : 'rgba(255, 255, 255, 0.47)' }}>
                {vaultFX.tremoloEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {/* SHIMMER */}
            <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.25)', border: `1px solid ${vaultFX.shimmerEnabled ? 'rgba(168,85,247,0.4)' : 'rgba(255, 255, 255, 0.30)'}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.08em' }}>SHIMMER</div>
                <input type="range" min={0} max={100} value={vaultFX.shimmerSend} onChange={e => updateFX('shimmerSend', +e.target.value)} style={{ width: '100%', accentColor: '#a855f7' }} title={`Send: ${vaultFX.shimmerSend}%`}/>
              </div>
              <button onClick={() => updateFX('shimmerEnabled', !vaultFX.shimmerEnabled)} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', background: vaultFX.shimmerEnabled ? 'rgba(168,85,247,0.25)' : 'rgba(255, 255, 255, 0.28)', color: vaultFX.shimmerEnabled ? '#a855f7' : 'rgba(255, 255, 255, 0.47)' }}>
                {vaultFX.shimmerEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {/* DARK VOID */}
            <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.25)', border: `1px solid ${vaultFX.darkVoidEnabled ? 'rgba(99,102,241,0.4)' : 'rgba(255, 255, 255, 0.30)'}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>DARK VOID</div>
                <input type="range" min={0} max={100} value={vaultFX.darkVoidDecay} onChange={e => updateFX('darkVoidDecay', +e.target.value)} style={{ width: '100%', accentColor: '#6366f1' }} title={`Decay: ${vaultFX.darkVoidDecay}%`}/>
              </div>
              <button onClick={() => updateFX('darkVoidEnabled', !vaultFX.darkVoidEnabled)} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', background: vaultFX.darkVoidEnabled ? 'rgba(99,102,241,0.25)' : 'rgba(255, 255, 255, 0.28)', color: vaultFX.darkVoidEnabled ? '#6366f1' : 'rgba(255, 255, 255, 0.47)' }}>
                {vaultFX.darkVoidEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* FX Tab Bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {(['filter','reverb','delay','chorus','dist','eq','comp','lfo','osc'] as const).map(t => (
              <button key={t} onClick={() => setFxTab(t)} style={{
                padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.08em', border: 'none',
                background: fxTab === t ? 'rgba(255,100,0,0.35)' : 'rgba(255, 255, 255, 0.26)',
                color: fxTab === t ? '#ff6400' : 'rgba(255,255,255,0.4)',
              }}>{t === 'dist' ? 'DISTORT' : t === 'comp' ? 'COMPRESS' : t.toUpperCase()}</button>
            ))}
            {/* FX preset save / load */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}>
              <button
                onClick={() => setShowFXPresetMenu(v => !v)}
                style={{ padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800, border: 'none', cursor: 'pointer', background: 'rgba(255,165,0,0.15)', color: '#ffa500', textTransform: 'uppercase' }}
              >FX PRESETS</button>
              {showFXPresetMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#111', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 6, zIndex: 999, minWidth: 180, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    <input
                      value={fxPresetName}
                      onChange={e => setFxPresetName(e.target.value)}
                      placeholder="Preset name…"
                      style={{ flex: 1, background: 'rgba(255, 255, 255, 0.30)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 3, color: '#fff', fontSize: 9, padding: '2px 5px', outline: 'none' }}
                    />
                    <button
                      onClick={() => {
                        const name = fxPresetName.trim() || `FX Preset ${Object.keys(fxPresets).length + 1}`;
                        const next = { ...fxPresets, [name]: { ...vaultFX } };
                        setFxPresets(next);
                        try { localStorage.setItem('vst-god-vault-fx-presets', JSON.stringify(next)); } catch {}
                        setFxPresetName('');
                        showMessage?.(`FX PRESET SAVED: ${name}`);
                      }}
                      style={{ padding: '2px 7px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 9, background: 'rgba(255,165,0,0.25)', color: '#ffa500' }}
                    >SAVE</button>
                  </div>
                  {Object.keys(fxPresets).length === 0 && <div style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.52)', textAlign: 'center', padding: 4 }}>No saved FX presets</div>}
                  {Object.entries(fxPresets).map(([name, state]) => (
                    <div key={name} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
                      <button
                        onClick={() => { const next = { ...DEFAULT_VAULT_FX, ...state }; setVaultFX(next); try { localStorage.setItem('vst-god-vault-fx-v1', JSON.stringify(next)); } catch {} showMessage?.(`FX LOADED: ${name}`); setShowFXPresetMenu(false); }}
                        style={{ flex: 1, textAlign: 'left', padding: '3px 6px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 9, background: 'rgba(255, 255, 255, 0.28)', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >{name}</button>
                      <button
                        onClick={() => {
                          const next = { ...fxPresets };
                          delete next[name];
                          setFxPresets(next);
                          try { localStorage.setItem('vst-god-vault-fx-presets', JSON.stringify(next)); } catch {}
                        }}
                        style={{ padding: '2px 5px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 9, background: 'rgba(255,60,60,0.2)', color: '#ff6060' }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* FX Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px 12px', fontSize: 9 }}>

            {fxTab === 'filter' && (<>
              <label style={fxLabelStyle}>ENABLED
                <input type="checkbox" checked={vaultFX.filterEnabled} onChange={e => updateFX('filterEnabled', e.target.checked)} style={{ marginLeft: 6 }} />
              </label>
              <label style={fxLabelStyle}>TYPE
                <select value={vaultFX.filterType} onChange={e => updateFX('filterType', e.target.value as any)} style={fxSelectStyle}>
                  {(['lowpass','highpass','bandpass','notch','peaking'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={fxLabelStyle}>CUTOFF ({Math.round(vaultFX.filterCutoff)}Hz)
                <input type="range" min={20} max={20000} step={10} value={vaultFX.filterCutoff} onChange={e => updateFX('filterCutoff', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>RESONANCE ({vaultFX.filterRes.toFixed(2)})
                <input type="range" min={0} max={1} step={0.01} value={vaultFX.filterRes} onChange={e => updateFX('filterRes', +e.target.value)} style={fxSliderStyle} />
              </label>
            </>)}

            {fxTab === 'reverb' && (<>
              <label style={fxLabelStyle}>ENABLED
                <input type="checkbox" checked={vaultFX.reverbEnabled} onChange={e => updateFX('reverbEnabled', e.target.checked)} style={{ marginLeft: 6 }} />
              </label>
              <label style={fxLabelStyle}>TYPE
                <select value={vaultFX.reverbType} onChange={e => updateFX('reverbType', e.target.value as any)} style={fxSelectStyle}>
                  {(['room','studio','chamber','ambience','hall','plate','stadium','cathedral','spring'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={fxLabelStyle}>SEND ({vaultFX.reverbSend}%)
                <input type="range" min={0} max={100} value={vaultFX.reverbSend} onChange={e => updateFX('reverbSend', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>DECAY ({vaultFX.reverbDecay}%)
                <input type="range" min={0} max={100} value={vaultFX.reverbDecay} onChange={e => updateFX('reverbDecay', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>PRE-DELAY ({vaultFX.reverbPreDelay}ms)
                <input type="range" min={0} max={100} value={vaultFX.reverbPreDelay} onChange={e => updateFX('reverbPreDelay', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>DAMPING ({vaultFX.reverbDamping}%)
                <input type="range" min={0} max={100} value={vaultFX.reverbDamping} onChange={e => updateFX('reverbDamping', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>WIDTH ({vaultFX.reverbWidth}%)
                <input type="range" min={0} max={100} value={vaultFX.reverbWidth} onChange={e => updateFX('reverbWidth', +e.target.value)} style={fxSliderStyle} />
              </label>
            </>)}

            {fxTab === 'delay' && (<>
              <label style={fxLabelStyle}>ENABLED
                <input type="checkbox" checked={vaultFX.delayEnabled} onChange={e => updateFX('delayEnabled', e.target.checked)} style={{ marginLeft: 6 }} />
              </label>
              <label style={fxLabelStyle}>TYPE
                <select value={vaultFX.delayType} onChange={e => updateFX('delayType', e.target.value as any)} style={fxSelectStyle}>
                  {(['mono','stereo','ping-pong','tape'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={fxLabelStyle}>SEND ({vaultFX.delaySend}%)
                <input type="range" min={0} max={100} value={vaultFX.delaySend} onChange={e => updateFX('delaySend', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>TIME ({vaultFX.delayTime}ms)
                <input type="range" min={10} max={2000} value={vaultFX.delayTime} onChange={e => updateFX('delayTime', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>FEEDBACK ({vaultFX.delayFeedback}%)
                <input type="range" min={0} max={95} value={vaultFX.delayFeedback} onChange={e => updateFX('delayFeedback', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>DAMPING ({vaultFX.delayDamping}%)
                <input type="range" min={0} max={100} value={vaultFX.delayDamping} onChange={e => updateFX('delayDamping', +e.target.value)} style={fxSliderStyle} />
              </label>
            </>)}

            {fxTab === 'chorus' && (<>
              <label style={fxLabelStyle}>ENABLED
                <input type="checkbox" checked={vaultFX.chorusEnabled} onChange={e => updateFX('chorusEnabled', e.target.checked)} style={{ marginLeft: 6 }} />
              </label>
              <label style={fxLabelStyle}>SEND ({vaultFX.chorusSend}%)
                <input type="range" min={0} max={100} value={vaultFX.chorusSend} onChange={e => updateFX('chorusSend', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>RATE ({vaultFX.chorusRate.toFixed(1)}Hz)
                <input type="range" min={0.1} max={8} step={0.1} value={vaultFX.chorusRate} onChange={e => updateFX('chorusRate', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>DEPTH ({vaultFX.chorusDepth}%)
                <input type="range" min={0} max={100} value={vaultFX.chorusDepth} onChange={e => updateFX('chorusDepth', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>VOICES ({vaultFX.chorusVoices})
                <input type="range" min={1} max={4} step={1} value={vaultFX.chorusVoices} onChange={e => updateFX('chorusVoices', +e.target.value)} style={fxSliderStyle} />
              </label>
            </>)}

            {fxTab === 'dist' && (<>
              <label style={fxLabelStyle}>ENABLED
                <input type="checkbox" checked={vaultFX.distEnabled} onChange={e => updateFX('distEnabled', e.target.checked)} style={{ marginLeft: 6 }} />
              </label>
              <label style={fxLabelStyle}>TYPE
                <select value={vaultFX.distType} onChange={e => updateFX('distType', e.target.value as any)} style={fxSelectStyle}>
                  {(['soft','hard','tube','fuzz','bitcrush'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={fxLabelStyle}>DRIVE ({vaultFX.distDrive}%)
                <input type="range" min={0} max={100} value={vaultFX.distDrive} onChange={e => updateFX('distDrive', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>TONE ({vaultFX.distTone}%)
                <input type="range" min={0} max={100} value={vaultFX.distTone} onChange={e => updateFX('distTone', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>MIX ({vaultFX.distMix}%)
                <input type="range" min={0} max={100} value={vaultFX.distMix} onChange={e => updateFX('distMix', +e.target.value)} style={fxSliderStyle} />
              </label>
            </>)}

            {fxTab === 'eq' && (<>
              <label style={fxLabelStyle}>ENABLED
                <input type="checkbox" checked={vaultFX.eqEnabled} onChange={e => updateFX('eqEnabled', e.target.checked)} style={{ marginLeft: 6 }} />
              </label>
              <label style={{ ...fxLabelStyle, color: '#60a5fa' }}>LOW SHELF ({vaultFX.eqLow > 0 ? '+' : ''}{vaultFX.eqLow}dB)
                <input type="range" min={-24} max={24} step={0.5} value={vaultFX.eqLow} onChange={e => updateFX('eqLow', +e.target.value)} style={{ ...fxSliderStyle, accentColor: '#60a5fa' }} />
              </label>
              <label style={{ ...fxLabelStyle, color: '#60a5fa' }}>LOW FREQ ({vaultFX.eqLowFreq}Hz)
                <input type="range" min={20} max={500} value={vaultFX.eqLowFreq} onChange={e => updateFX('eqLowFreq', +e.target.value)} style={{ ...fxSliderStyle, accentColor: '#60a5fa' }} />
              </label>
              <label style={{ ...fxLabelStyle, color: '#4ade80' }}>LO-MID ({vaultFX.eqMid > 0 ? '+' : ''}{vaultFX.eqMid}dB)
                <input type="range" min={-24} max={24} step={0.5} value={vaultFX.eqMid} onChange={e => updateFX('eqMid', +e.target.value)} style={{ ...fxSliderStyle, accentColor: '#4ade80' }} />
              </label>
              <label style={{ ...fxLabelStyle, color: '#4ade80' }}>LO-MID FREQ ({vaultFX.eqMidFreq}Hz)
                <input type="range" min={100} max={2000} value={vaultFX.eqMidFreq} onChange={e => updateFX('eqMidFreq', +e.target.value)} style={{ ...fxSliderStyle, accentColor: '#4ade80' }} />
              </label>
              <label style={{ ...fxLabelStyle, color: '#4ade80' }}>LO-MID Q ({(vaultFX.eqMidQ ?? 1).toFixed(1)})
                <input type="range" min={0.1} max={10} step={0.1} value={vaultFX.eqMidQ ?? 1} onChange={e => updateFX('eqMidQ', +e.target.value)} style={{ ...fxSliderStyle, accentColor: '#4ade80' }} />
              </label>
              <label style={{ ...fxLabelStyle, color: '#fb923c' }}>HI-MID ({(vaultFX.eqHighMid ?? 0) > 0 ? '+' : ''}{vaultFX.eqHighMid ?? 0}dB)
                <input type="range" min={-24} max={24} step={0.5} value={vaultFX.eqHighMid ?? 0} onChange={e => updateFX('eqHighMid', +e.target.value)} style={{ ...fxSliderStyle, accentColor: '#fb923c' }} />
              </label>
              <label style={{ ...fxLabelStyle, color: '#fb923c' }}>HI-MID FREQ ({vaultFX.eqHighMidFreq ?? 3000}Hz)
                <input type="range" min={500} max={10000} value={vaultFX.eqHighMidFreq ?? 3000} onChange={e => updateFX('eqHighMidFreq', +e.target.value)} style={{ ...fxSliderStyle, accentColor: '#fb923c' }} />
              </label>
              <label style={{ ...fxLabelStyle, color: '#fb923c' }}>HI-MID Q ({(vaultFX.eqHighMidQ ?? 1).toFixed(1)})
                <input type="range" min={0.1} max={10} step={0.1} value={vaultFX.eqHighMidQ ?? 1} onChange={e => updateFX('eqHighMidQ', +e.target.value)} style={{ ...fxSliderStyle, accentColor: '#fb923c' }} />
              </label>
              <label style={{ ...fxLabelStyle, color: '#f87171' }}>HIGH SHELF ({vaultFX.eqHigh > 0 ? '+' : ''}{vaultFX.eqHigh}dB)
                <input type="range" min={-24} max={24} step={0.5} value={vaultFX.eqHigh} onChange={e => updateFX('eqHigh', +e.target.value)} style={{ ...fxSliderStyle, accentColor: '#f87171' }} />
              </label>
              <label style={{ ...fxLabelStyle, color: '#f87171' }}>HIGH FREQ ({vaultFX.eqHighFreq}Hz)
                <input type="range" min={2000} max={20000} value={vaultFX.eqHighFreq} onChange={e => updateFX('eqHighFreq', +e.target.value)} style={{ ...fxSliderStyle, accentColor: '#f87171' }} />
              </label>
            </>)}

            {fxTab === 'comp' && (<>
              <label style={fxLabelStyle}>ENABLED
                <input type="checkbox" checked={vaultFX.compEnabled} onChange={e => updateFX('compEnabled', e.target.checked)} style={{ marginLeft: 6 }} />
              </label>
              <label style={fxLabelStyle}>THRESHOLD ({vaultFX.compThreshold}dB)
                <input type="range" min={-60} max={0} value={vaultFX.compThreshold} onChange={e => updateFX('compThreshold', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>RATIO ({vaultFX.compRatio}:1)
                <input type="range" min={1} max={20} step={0.5} value={vaultFX.compRatio} onChange={e => updateFX('compRatio', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>ATTACK ({vaultFX.compAttack}ms)
                <input type="range" min={0} max={300} value={vaultFX.compAttack} onChange={e => updateFX('compAttack', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>RELEASE ({vaultFX.compRelease}ms)
                <input type="range" min={10} max={1000} value={vaultFX.compRelease} onChange={e => updateFX('compRelease', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>MAKEUP ({vaultFX.compMakeup}dB)
                <input type="range" min={0} max={24} value={vaultFX.compMakeup} onChange={e => updateFX('compMakeup', +e.target.value)} style={fxSliderStyle} />
              </label>
            </>)}

            {fxTab === 'lfo' && (<>
              <label style={fxLabelStyle}>ENABLED
                <input type="checkbox" checked={vaultFX.lfoEnabled} onChange={e => updateFX('lfoEnabled', e.target.checked)} style={{ marginLeft: 6 }} />
              </label>
              <label style={fxLabelStyle}>WAVEFORM
                <select value={vaultFX.lfoWave} onChange={e => updateFX('lfoWave', e.target.value as any)} style={fxSelectStyle}>
                  {(['sine','triangle','square','sawtooth','random'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={fxLabelStyle}>TARGET
                <select value={vaultFX.lfoTarget} onChange={e => updateFX('lfoTarget', e.target.value as any)} style={fxSelectStyle}>
                  {(['pitch','filter','amplitude','pan','reverb-send','delay-send'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={fxLabelStyle}>RATE ({vaultFX.lfoRate.toFixed(1)}Hz)
                <input type="range" min={0.01} max={20} step={0.01} value={vaultFX.lfoRate} onChange={e => updateFX('lfoRate', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>DEPTH ({vaultFX.lfoDepth}%)
                <input type="range" min={0} max={100} value={vaultFX.lfoDepth} onChange={e => updateFX('lfoDepth', +e.target.value)} style={fxSliderStyle} />
              </label>
            </>)}

            {fxTab === 'osc' && (<>
              <label style={fxLabelStyle}>ENABLED
                <input type="checkbox" checked={vaultFX.oscEnabled} onChange={e => updateFX('oscEnabled', e.target.checked)} style={{ marginLeft: 6 }} />
              </label>
              <label style={fxLabelStyle}>MODE
                <select value={vaultFX.oscMode} onChange={e => updateFX('oscMode', e.target.value as any)} style={fxSelectStyle}>
                  {(['off','sub','unison','fifth','octave'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={fxLabelStyle}>WAVEFORM
                <select value={vaultFX.oscWave} onChange={e => updateFX('oscWave', e.target.value as OscillatorType)} style={fxSelectStyle}>
                  {(['sine','triangle','square','sawtooth'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={fxLabelStyle}>DETUNE ({vaultFX.oscDetune} cents)
                <input type="range" min={-100} max={100} value={vaultFX.oscDetune} onChange={e => updateFX('oscDetune', +e.target.value)} style={fxSliderStyle} />
              </label>
              <label style={fxLabelStyle}>VOLUME ({vaultFX.oscVolume}%)
                <input type="range" min={0} max={100} value={vaultFX.oscVolume} onChange={e => updateFX('oscVolume', +e.target.value)} style={fxSliderStyle} />
              </label>
            </>)}

          </div>

          {/* Master volume */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,100,0,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,150,50,0.7)', letterSpacing: '0.1em' }}>MASTER VOL</span>
            <input type="range" min={0} max={100} value={vaultFX.masterVol} onChange={e => updateFX('masterVol', +e.target.value)} style={{ ...fxSliderStyle, flex: 1 }} />
            <span style={{ fontSize: 9, color: '#ff6400', minWidth: 28 }}>{vaultFX.masterVol}%</span>
            <button onClick={() => { const d = { ...DEFAULT_VAULT_FX }; setVaultFX(d); try { localStorage.setItem('vst-god-vault-fx-v1', JSON.stringify(d)); } catch {} }} style={{
              padding: '2px 8px', background: 'rgba(255,100,0,0.08)', border: '1px solid rgba(255,100,0,0.2)',
              borderRadius: 4, cursor: 'pointer', color: 'rgba(255,150,80,0.7)', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
            }}>RESET ALL</button>
          </div>
        </div>
      )}

      {/* ── 3D Waveform Visualizer ── */}
      <div style={{ height: 90, background: '#050508', borderTop: '1px solid rgba(150,80,255,0.2)', flexShrink: 0, overflow: 'hidden' }}>
        <WaveformVisualizer3D buffer={vizBuffer} isPlaying={isVizPlaying} />
      </div>

      {/* ── Piano Keyboard Preview ── */}
      <div className="god-vault__piano">
        <div className="god-vault__piano-label" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
          {loadedSampleName
            ? <span>🎹 <strong style={{ color: '#34d399' }}>{loadedSampleName}</strong> — mapped across keyboard</span>
            : selected
              ? <span style={{ color: 'rgba(255, 255, 255, 0.57)' }}>Drop a sample file onto this preset to make it playable</span>
              : <span style={{ color: 'rgba(255, 255, 255, 0.42)' }}>Select a preset · Drop audio files here to load them</span>
          }
          </div>
          {/* Poly / Mono / Legato selector */}
          <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.35)', borderRadius: 5, padding: 2, flexShrink: 0 }}>
            {(['poly', 'mono', 'legato'] as const).map(m => {
              const on = vaultFX.playMode === m;
              const col = m === 'poly' ? '#64c8ff' : m === 'mono' ? '#ff6400' : '#a78bfa';
              return (
                <button key={m} onClick={() => updateFX('playMode', m)} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 8, fontWeight: 900, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.08em', border: 'none',
                  background: on ? `${col}33` : 'transparent', color: on ? col : 'rgba(255,255,255,0.35)',
                }}>{m}</button>
              );
            })}
          </div>
          {/* FX toggle */}
          <button onClick={() => setShowFXPanel(p => !p)} style={{
            padding: '2px 10px', borderRadius: 4, fontSize: 9, fontWeight: 900, cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none', flexShrink: 0,
            background: showFXPanel ? 'rgba(255,100,0,0.25)' : 'rgba(255, 255, 255, 0.27)',
            color: showFXPanel ? '#ff8040' : 'rgba(255,255,255,0.4)',
          }}>⚙ FX</button>
        </div>
        <div className="god-vault__piano-keys">
          {PIANO_KEYS.filter(k => !k.isBlack).map(whiteKey => {
            const blackAfter = PIANO_KEYS.find(k => k.isBlack && k.midi === whiteKey.midi + 1 &&
              ['C#','D#','F#','G#','A#'].includes(k.name));
            const canPlay = true; // always playable — built-in synth when no sample is loaded
            return (
              <div key={whiteKey.midi} className="god-vault__piano-white-group">
                <div
                  className={`god-vault__piano-key god-vault__piano-key--white ${pressedKeys.has(whiteKey.midi) ? 'god-vault__piano-key--pressed' : ''}`}
                  onMouseDown={e => { e.preventDefault(); if (canPlay) pianoNoteOn(whiteKey.midi); }}
                  onMouseUp={() => pianoNoteOff(whiteKey.midi)}
                  onMouseLeave={() => pianoNoteOff(whiteKey.midi)}
                  title={`${whiteKey.name}${whiteKey.octave} (MIDI ${whiteKey.midi})`}
                >
                  {whiteKey.name === 'C' && <span className="god-vault__piano-note-label">{whiteKey.name}{whiteKey.octave}</span>}
                </div>
                {blackAfter && (
                  <div
                    className={`god-vault__piano-key god-vault__piano-key--black ${pressedKeys.has(blackAfter.midi) ? 'god-vault__piano-key--pressed' : ''}`}
                    onMouseDown={e => { e.preventDefault(); if (canPlay) pianoNoteOn(blackAfter.midi); }}
                    onMouseUp={() => pianoNoteOff(blackAfter.midi)}
                    onMouseLeave={() => pianoNoteOff(blackAfter.midi)}
                    title={`${blackAfter.name}${blackAfter.octave} (MIDI ${blackAfter.midi})`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      </> /* end presets sub-tab */}

      </> /* end vault mode */}
    </div>
  );
};

export default GodVault;
