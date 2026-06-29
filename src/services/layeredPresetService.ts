/**
 * layeredPresetService.ts
 * Manages multi-layer presets: CRUD, search, bank support, encryption stubs.
 */

import { useState, useEffect } from 'react';
import {
  LayeredPreset,
  ExpansionBank,
  createDefaultPreset,
  defaultLayer,
  defaultGlobalFX,
  defaultMacro,
} from '../types/layeredPreset';

const STORAGE_KEY = 'vst-god-layered-presets-v1';
const BANKS_KEY = 'vst-god-expansion-banks-v1';

// ─── Factory presets ────────────────────────────────────────────────────────

function makeFactory(): LayeredPreset[] {
  const base = (name: string, type: string, tags: string[], energyLevel: number): LayeredPreset => ({
    ...createDefaultPreset(name),
    id: `factory-lp-${name.replace(/\s/g, '-').toLowerCase()}`,
    type,
    author: 'VST GOD',
    rating: 5,
    tags,
    energyLevel,
    lastModified: '2025-01-01T00:00:00.000Z',
  });

  return [
    {
      ...base('Olympus Domain', 'Keys', ['Keys', 'Warm', 'Classic', 'Divine'], 65),
      layers: [
        {
          ...defaultLayer(0), name: 'Low Body', type: 'oscillator',
          osc: { waveform: 'saw', octave: -1, semitone: 0, detune: 5, pulseWidth: 0.5, phase: 0, unisonVoices: 3, unisonDetune: 18, unisonWidth: 75 },
          adsr: { attack: 8, decay: 40, sustain: 65, release: 50 },
          filter: { type: 'lowpass', frequency: 3500, resonance: 20, drive: 5, envAmount: 15, lfoAmount: 0, keytrack: 50 },
          volume: 85, color: '#f59e0b',
        },
        {
          ...defaultLayer(1), name: 'Air Shimmer', type: 'oscillator',
          osc: { waveform: 'sine', octave: 1, semitone: 7, detune: -8, pulseWidth: 0.5, phase: 180, unisonVoices: 1, unisonDetune: 0, unisonWidth: 0 },
          adsr: { attack: 20, decay: 30, sustain: 50, release: 60 },
          filter: { type: 'highpass', frequency: 2000, resonance: 10, drive: 0, envAmount: 0, lfoAmount: 0, keytrack: 30 },
          volume: 45, color: '#818cf8',
        },
      ],
      globalFX: {
        ...defaultGlobalFX(),
        reverb: { enabled: true, mix: 40, size: 65, damping: 35, predelay: 15 },
        chorus: { enabled: true, mix: 25, rate: 20, depth: 35, voices: 3 },
      },
    },
    {
      ...base("Zeus' Thunder", 'Bass', ['Bass', 'Power', 'God', '808'], 90),
      layers: [
        {
          ...defaultLayer(0), name: 'Sub Core', type: 'oscillator',
          osc: { waveform: 'sine', octave: -2, semitone: 0, detune: 0, pulseWidth: 0.5, phase: 0, unisonVoices: 1, unisonDetune: 0, unisonWidth: 0 },
          adsr: { attack: 2, decay: 80, sustain: 60, release: 35 },
          filter: { type: 'lowpass', frequency: 300, resonance: 5, drive: 0, envAmount: 0, lfoAmount: 0, keytrack: 100 },
          volume: 100, color: '#f59e0b',
        },
        {
          ...defaultLayer(1), name: 'Distorted Top', type: 'oscillator',
          osc: { waveform: 'square', octave: -1, semitone: 0, detune: 3, pulseWidth: 0.4, phase: 0, unisonVoices: 2, unisonDetune: 8, unisonWidth: 60 },
          adsr: { attack: 1, decay: 25, sustain: 30, release: 20 },
          filter: { type: 'lowpass', frequency: 1200, resonance: 40, drive: 30, envAmount: 60, lfoAmount: 0, keytrack: 40 },
          volume: 60, color: '#f87171',
        },
      ],
      globalFX: {
        ...defaultGlobalFX(),
        distortion: { enabled: true, drive: 35, tone: 40, mix: 20, type: 'tube' },
        compressor: { enabled: true, threshold: -8, ratio: 6, attack: 5, release: 30, makeupGain: 4 },
      },
    },
    {
      ...base('Celestial Drift', 'Pad', ['Pad', 'Ambient', 'Wide', 'Divine'], 45),
      layers: [
        {
          ...defaultLayer(0), name: 'Wash Layer', type: 'oscillator',
          osc: { waveform: 'saw', octave: 0, semitone: 0, detune: 12, pulseWidth: 0.5, phase: 0, unisonVoices: 7, unisonDetune: 22, unisonWidth: 90 },
          adsr: { attack: 75, decay: 60, sustain: 85, release: 90 },
          filter: { type: 'lowpass', frequency: 2500, resonance: 8, drive: 0, envAmount: 0, lfoAmount: 25, keytrack: 20 },
          volume: 80, color: '#818cf8',
        },
        {
          ...defaultLayer(1), name: 'Ghost Bell', type: 'oscillator',
          osc: { waveform: 'sine', octave: 2, semitone: 5, detune: 0, pulseWidth: 0.5, phase: 90, unisonVoices: 1, unisonDetune: 0, unisonWidth: 0 },
          adsr: { attack: 30, decay: 80, sustain: 20, release: 120 },
          filter: { type: 'bandpass', frequency: 5000, resonance: 25, drive: 0, envAmount: 0, lfoAmount: 0, keytrack: 60 },
          volume: 35, color: '#38bdf8',
        },
      ],
      globalFX: {
        ...defaultGlobalFX(),
        reverb: { enabled: true, mix: 70, size: 90, damping: 25, predelay: 30 },
        delay: { enabled: true, mix: 30, time: 75, feedback: 45, sync: true, pingpong: true },
        chorus: { enabled: true, mix: 40, rate: 8, depth: 60, voices: 4 },
      },
    },
    {
      ...base('Divine Pluck', 'Pluck', ['Pluck', 'Attack', 'Bright', 'God'], 70),
      layers: [
        {
          ...defaultLayer(0), name: 'Pluck Body', type: 'oscillator',
          osc: { waveform: 'triangle', octave: 0, semitone: 0, detune: 0, pulseWidth: 0.5, phase: 0, unisonVoices: 2, unisonDetune: 10, unisonWidth: 50 },
          adsr: { attack: 1, decay: 30, sustain: 10, release: 25 },
          filter: { type: 'lowpass', frequency: 6000, resonance: 45, drive: 10, envAmount: 80, lfoAmount: 0, keytrack: 70 },
          volume: 90, color: '#34d399',
        },
      ],
      globalFX: {
        ...defaultGlobalFX(),
        reverb: { enabled: true, mix: 35, size: 50, damping: 50, predelay: 5 },
        delay: { enabled: true, mix: 25, time: 50, feedback: 25, sync: true, pingpong: false },
      },
    },
    {
      ...base('Hades Lead', 'Lead', ['Lead', 'Dark', 'Aggressive', 'Underworld'], 85),
      layers: [
        {
          ...defaultLayer(0), name: 'Dirty Saw', type: 'oscillator',
          osc: { waveform: 'saw', octave: 0, semitone: 0, detune: 0, pulseWidth: 0.5, phase: 0, unisonVoices: 3, unisonDetune: 15, unisonWidth: 40 },
          adsr: { attack: 3, decay: 20, sustain: 80, release: 15 },
          filter: { type: 'lowpass', frequency: 4000, resonance: 55, drive: 50, envAmount: -30, lfoAmount: 15, keytrack: 80 },
          volume: 95, color: '#a78bfa',
        },
        {
          ...defaultLayer(1), name: 'Sub Reinforce', type: 'oscillator',
          osc: { waveform: 'square', octave: -1, semitone: 0, detune: -5, pulseWidth: 0.4, phase: 0, unisonVoices: 1, unisonDetune: 0, unisonWidth: 0 },
          adsr: { attack: 1, decay: 15, sustain: 75, release: 10 },
          filter: { type: 'lowpass', frequency: 800, resonance: 10, drive: 0, envAmount: 0, lfoAmount: 0, keytrack: 60 },
          volume: 50, color: '#f87171',
        },
      ],
      globalFX: {
        ...defaultGlobalFX(),
        distortion: { enabled: true, drive: 60, tone: 55, mix: 35, type: 'hard' },
        compressor: { enabled: true, threshold: -12, ratio: 8, attack: 3, release: 20, makeupGain: 5 },
        reverb: { enabled: true, mix: 20, size: 40, damping: 60, predelay: 8 },
      },
    },
  ];
}

// ─── Service ────────────────────────────────────────────────────────────────

class LayeredPresetService {
  private presets: LayeredPreset[] = [];
  private banks: ExpansionBank[] = [];
  private _listeners: (() => void)[] = [];

  constructor() {
    this.load();
  }

  onChange(cb: () => void) {
    this._listeners.push(cb);
    return () => { this._listeners = this._listeners.filter(l => l !== cb); };
  }

  private notify() { this._listeners.forEach(l => l()); }

  // ── Queries ──────────────────────────────────────────────────────────────

  getAll(): LayeredPreset[] { return this.presets; }
  getBanks(): ExpansionBank[] { return this.banks; }

  getById(id: string): LayeredPreset | undefined {
    return this.presets.find(p => p.id === id);
  }

  search(query: string, type?: string, favOnly = false, bankId?: string): LayeredPreset[] {
    const q = query.trim().toLowerCase();
    return this.presets.filter(p => {
      if (favOnly && !p.fav) return false;
      if (type && type !== 'ALL' && p.type !== type) return false;
      if (bankId && p.bankId !== bankId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    });
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  save(preset: LayeredPreset): void {
    const idx = this.presets.findIndex(p => p.id === preset.id);
    const updated = { ...preset, lastModified: new Date().toISOString() };
    if (idx >= 0) {
      this.presets[idx] = updated;
    } else {
      this.presets.unshift(updated);
    }
    this.persist();
    this.notify();
  }

  delete(id: string): void {
    if (this.presets.find(p => p.id === id)?.author === 'VST GOD') return;
    this.presets = this.presets.filter(p => p.id !== id);
    this.persist();
    this.notify();
  }

  duplicate(id: string): LayeredPreset | null {
    const src = this.getById(id);
    if (!src) return null;
    const copy: LayeredPreset = {
      ...JSON.parse(JSON.stringify(src)),
      id: `lp-${Date.now()}`,
      name: `${src.name} (Copy)`,
      author: 'User',
      fav: false,
      lastModified: new Date().toISOString(),
    };
    this.presets.unshift(copy);
    this.persist();
    this.notify();
    return copy;
  }

  toggleFav(id: string): void {
    const p = this.presets.find(p => p.id === id);
    if (!p) return;
    p.fav = !p.fav;
    this.persist();
    this.notify();
  }

  createNew(name?: string): LayeredPreset {
    const p = createDefaultPreset(name);
    p.macros = Array.from({ length: 8 }, (_, i) => defaultMacro(i));
    this.presets.unshift(p);
    this.persist();
    this.notify();
    return p;
  }

  // ── Bank support ─────────────────────────────────────────────────────────

  installBank(bank: ExpansionBank, presets: LayeredPreset[]): void {
    const updated = { ...bank, installed: true };
    const idx = this.banks.findIndex(b => b.id === bank.id);
    if (idx >= 0) this.banks[idx] = updated;
    else this.banks.push(updated);

    presets.forEach(p => {
      p.bankId = bank.id;
      if (!this.presets.find(e => e.id === p.id)) this.presets.push(p);
    });

    this.persistBanks();
    this.persist();
    this.notify();
  }

  // ── Export / Import ───────────────────────────────────────────────────────

  export(id: string): string | null {
    const p = this.getById(id);
    return p ? JSON.stringify(p, null, 2) : null;
  }

  exportAll(): string {
    return JSON.stringify(this.presets.filter(p => p.author !== 'VST GOD'), null, 2);
  }

  import(json: string): LayeredPreset | null {
    try {
      const data = JSON.parse(json) as LayeredPreset;
      if (!data.name || !data.layers) return null;
      const p: LayeredPreset = {
        ...createDefaultPreset(data.name),
        ...data,
        id: `lp-${Date.now()}`,
        author: data.author || 'User',
        lastModified: new Date().toISOString(),
      };
      this.presets.unshift(p);
      this.persist();
      this.notify();
      return p;
    } catch {
      return null;
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.presets = JSON.parse(raw);
        this.banks = JSON.parse(localStorage.getItem(BANKS_KEY) || '[]');
        return;
      }
    } catch { /* fall through */ }
    this.presets = makeFactory();
    this.persist();
  }

  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.presets)); } catch { /* */ }
  }

  private persistBanks(): void {
    try { localStorage.setItem(BANKS_KEY, JSON.stringify(this.banks)); } catch { /* */ }
  }
}

export const layeredPresetService = new LayeredPresetService();

export function useLayeredPresets(): LayeredPresetService {
  const [, forceUpdate] = useState(0);
  useEffect(() => layeredPresetService.onChange(() => forceUpdate(n => n + 1)), []);
  return layeredPresetService;
}
