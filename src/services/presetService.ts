/**
 * presetService.ts — Unified Preset Management Service
 *
 * Centralizes ALL preset logic: CRUD, navigation, search, filtering,
 * import/export, persistence, and Pantheon integration.
 *
 * Singleton pattern with reactive listeners for React integration.
 */

import { useState, useEffect } from 'react';
import { vstGodPresets } from '@/data/vstGodElectricPantheonLibrary';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PresetSource = 'vault' | 'pantheon' | 'user';

export interface PadAssignment {
  slotIndex: number;
  path: string;
  name: string;
  isFileDrop: boolean;
}

export interface SkinPresetState {
  glowColor: string;
  blurAmount: number;
  opacity: number;
  activeSkinProfile: string;
  selectedAssetPath?: string;
  selectedAssetName?: string;
}

export interface PresetState {
  params: Record<string, any>;
  padAssignments?: PadAssignment[];
  sequencerState?: any;
  midiMap?: Record<number, number>;
  pantheonGod?: string;
  pantheonMacros?: Record<string, number>;
  skinSettings?: SkinPresetState;
}

export interface UnifiedPreset {
  id: string;
  name: string;
  type: string;
  author: string;
  rating: number;
  fav: boolean;
  tags: string[];
  lastModified: string;
  energyLevel: number;
  source: PresetSource;
  pantheonId?: string;
  godId?: string;
  state: PresetState | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vst-god-realm-presets-v2';

const FACTORY_PRESETS: Omit<UnifiedPreset, 'id' | 'lastModified' | 'energyLevel'>[] = [
  { name: 'Olympus Domain', type: 'Multi-Realm', author: 'VST GOD', rating: 5, fav: true, tags: ['Multi-Realm', 'Sacred', 'Ancient'], source: 'vault',
    state: { params: { energy: 65, divinity: 70, width: 60, realm: 80, filterFreq: 55, filterQ: 30, attack: 15, decay: 40, sustain: 65, release: 50, reverbMix: 55, chorusMix: 40, delayMix: 30, modIndex: 40, bodyGain: 60, subOscGain: 45, satDrive: 25, satMix: 20, detuneCents: 15, morphBlend: 50, masterGain: 75 } } },
  { name: "Zeus' Thunder", type: 'Bass', author: 'VST GOD', rating: 5, fav: true, tags: ['Bass', 'Sacred', 'Power'], source: 'vault',
    state: { params: { energy: 85, divinity: 40, width: 30, realm: 60, filterFreq: 35, filterQ: 50, attack: 3, decay: 45, sustain: 70, release: 20, reverbMix: 15, chorusMix: 10, delayMix: 5, modIndex: 30, bodyGain: 80, subOscGain: 90, satDrive: 65, satMix: 45, detuneCents: 8, morphBlend: 25, masterGain: 80 } } },
  { name: 'Godspeed', type: 'Lead', author: 'VST GOD', rating: 5, fav: true, tags: ['Lead', 'Sacred', 'Fast'], source: 'vault',
    state: { params: { energy: 80, divinity: 50, width: 45, realm: 55, filterFreq: 75, filterQ: 45, attack: 2, decay: 25, sustain: 55, release: 15, reverbMix: 25, chorusMix: 20, delayMix: 35, modIndex: 55, bodyGain: 65, subOscGain: 20, satDrive: 40, satMix: 30, detuneCents: 25, morphBlend: 40, masterGain: 75 } } },
  { name: 'Heavenly Gates', type: 'Pad', author: 'VST GOD', rating: 5, fav: false, tags: ['Pad', 'Sacred', 'Ethereal'], source: 'vault',
    state: { params: { energy: 45, divinity: 80, width: 90, realm: 70, filterFreq: 50, filterQ: 20, attack: 75, decay: 50, sustain: 80, release: 85, reverbMix: 80, chorusMix: 65, delayMix: 40, modIndex: 25, bodyGain: 55, subOscGain: 35, satDrive: 10, satMix: 8, detuneCents: 20, morphBlend: 60, masterGain: 70 } } },
  { name: 'Divine Touch', type: 'Pluck', author: 'VST GOD', rating: 5, fav: false, tags: ['Pluck', 'Sacred', 'Delicate'], source: 'vault',
    state: { params: { energy: 55, divinity: 60, width: 50, realm: 45, filterFreq: 70, filterQ: 40, attack: 2, decay: 35, sustain: 15, release: 40, reverbMix: 55, chorusMix: 30, delayMix: 20, modIndex: 60, bodyGain: 50, subOscGain: 25, satDrive: 15, satMix: 12, detuneCents: 10, morphBlend: 35, masterGain: 72 } } },
  { name: 'Eternal Choir', type: 'Pad', author: 'VST GOD', rating: 4, fav: false, tags: ['Pad', 'Sacred', 'Choir'], source: 'vault',
    state: { params: { energy: 40, divinity: 85, width: 80, realm: 75, filterFreq: 45, filterQ: 25, attack: 65, decay: 55, sustain: 75, release: 80, reverbMix: 85, chorusMix: 70, delayMix: 45, modIndex: 20, bodyGain: 50, subOscGain: 30, satDrive: 8, satMix: 5, detuneCents: 18, morphBlend: 55, masterGain: 68 } } },
  { name: 'Titan Rise', type: 'Arp', author: 'VST GOD', rating: 4, fav: false, tags: ['Arp', 'Sacred', 'Rising'], source: 'vault',
    state: { params: { energy: 75, divinity: 45, width: 55, realm: 50, filterFreq: 60, filterQ: 55, attack: 5, decay: 30, sustain: 40, release: 20, reverbMix: 30, chorusMix: 25, delayMix: 50, modIndex: 45, bodyGain: 65, subOscGain: 40, satDrive: 35, satMix: 25, detuneCents: 12, morphBlend: 30, masterGain: 75 } } },
  { name: 'Celestial Keys', type: 'Keys', author: 'VST GOD', rating: 5, fav: false, tags: ['Keys', 'Sacred', 'Bright'], source: 'vault',
    state: { params: { energy: 55, divinity: 55, width: 60, realm: 50, filterFreq: 65, filterQ: 30, attack: 5, decay: 40, sustain: 50, release: 35, reverbMix: 40, chorusMix: 35, delayMix: 15, modIndex: 35, bodyGain: 60, subOscGain: 30, satDrive: 20, satMix: 15, detuneCents: 8, morphBlend: 45, masterGain: 72 } } },
  { name: 'Wrath of Zeus', type: 'FX', author: 'VST GOD', rating: 4, fav: false, tags: ['FX', 'Sacred', 'Thunder'], source: 'vault',
    state: { params: { energy: 90, divinity: 30, width: 70, realm: 85, filterFreq: 40, filterQ: 75, attack: 1, decay: 20, sustain: 30, release: 60, reverbMix: 45, chorusMix: 55, delayMix: 70, modIndex: 80, bodyGain: 45, subOscGain: 55, satDrive: 80, satMix: 65, detuneCents: 40, morphBlend: 70, masterGain: 65 } } },
  { name: 'Mount Olympus', type: 'Textures', author: 'VST GOD', rating: 5, fav: false, tags: ['Textures', 'Sacred', 'Epic'], source: 'vault',
    state: { params: { energy: 60, divinity: 75, width: 85, realm: 90, filterFreq: 50, filterQ: 35, attack: 50, decay: 60, sustain: 65, release: 70, reverbMix: 75, chorusMix: 60, delayMix: 55, modIndex: 50, bodyGain: 55, subOscGain: 40, satDrive: 20, satMix: 15, detuneCents: 22, morphBlend: 65, masterGain: 70 } } },
  { name: 'Golden Era', type: 'Pad', author: 'VST GOD', rating: 4, fav: false, tags: ['Pad', 'Sacred', 'Warm'], source: 'vault',
    state: { params: { energy: 50, divinity: 65, width: 70, realm: 60, filterFreq: 40, filterQ: 20, attack: 55, decay: 45, sustain: 70, release: 65, reverbMix: 65, chorusMix: 50, delayMix: 35, modIndex: 30, bodyGain: 65, subOscGain: 40, satDrive: 15, satMix: 10, detuneCents: 15, morphBlend: 50, masterGain: 72 } } },
  { name: 'Lightning Strike', type: 'Lead', author: 'VST GOD', rating: 5, fav: false, tags: ['Lead', 'Sacred', 'Aggressive'], source: 'vault',
    state: { params: { energy: 85, divinity: 35, width: 40, realm: 50, filterFreq: 80, filterQ: 60, attack: 1, decay: 20, sustain: 45, release: 10, reverbMix: 15, chorusMix: 15, delayMix: 25, modIndex: 65, bodyGain: 70, subOscGain: 25, satDrive: 55, satMix: 40, detuneCents: 30, morphBlend: 35, masterGain: 78 } } },
  { name: 'Sacred Bass', type: 'Bass', author: 'VST GOD', rating: 4, fav: false, tags: ['Bass', 'Sacred', 'Deep'], source: 'vault',
    state: { params: { energy: 70, divinity: 50, width: 35, realm: 55, filterFreq: 30, filterQ: 35, attack: 5, decay: 50, sustain: 75, release: 25, reverbMix: 20, chorusMix: 15, delayMix: 10, modIndex: 25, bodyGain: 75, subOscGain: 85, satDrive: 40, satMix: 30, detuneCents: 5, morphBlend: 30, masterGain: 78 } } },
  { name: 'Astral Drift', type: 'Pad', author: 'VST GOD', rating: 3, fav: false, tags: ['Pad', 'Sacred', 'Ambient'], source: 'vault',
    state: { params: { energy: 30, divinity: 70, width: 85, realm: 65, filterFreq: 55, filterQ: 15, attack: 80, decay: 60, sustain: 60, release: 90, reverbMix: 90, chorusMix: 55, delayMix: 60, modIndex: 15, bodyGain: 40, subOscGain: 20, satDrive: 5, satMix: 3, detuneCents: 25, morphBlend: 55, masterGain: 65 } } },
  { name: 'Hades Pluck', type: 'Pluck', author: 'VST GOD', rating: 4, fav: false, tags: ['Pluck', 'Sacred', 'Dark'], source: 'vault',
    state: { params: { energy: 65, divinity: 40, width: 45, realm: 55, filterFreq: 35, filterQ: 50, attack: 1, decay: 25, sustain: 10, release: 30, reverbMix: 35, chorusMix: 20, delayMix: 15, modIndex: 70, bodyGain: 60, subOscGain: 45, satDrive: 45, satMix: 35, detuneCents: 15, morphBlend: 40, masterGain: 74 } } },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Service ────────────────────────────────────────────────────────────────

class PresetService {
  private presets: UnifiedPreset[] = [];
  private pantheonPresets: UnifiedPreset[] = [];
  private _listeners: (() => void)[] = [];

  constructor() {
    this.pantheonPresets = this.loadPantheonPresets();
    this.loadFromStorage();
  }

  // ── Reactive subscriptions ──

  onChange(callback: () => void): () => void {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  private notify(): void {
    this._listeners.forEach(l => l());
  }

  // ── Queries ──

  /** All presets: vault + user + pantheon */
  getAll(): UnifiedPreset[] {
    return [...this.presets, ...this.pantheonPresets];
  }

  /** Only vault + user presets (mutable) */
  getVaultPresets(): UnifiedPreset[] {
    return this.presets;
  }

  getById(id: string): UnifiedPreset | undefined {
    return this.presets.find(p => p.id === id)
      || this.pantheonPresets.find(p => p.id === id);
  }

  getByCategory(category: string): UnifiedPreset[] {
    const lower = category.toLowerCase();
    return this.getAll().filter(p => p.type.toLowerCase() === lower);
  }

  getFavorites(): UnifiedPreset[] {
    return this.getAll().filter(p => p.fav);
  }

  search(query: string): UnifiedPreset[] {
    if (!query.trim()) return this.getAll();
    const q = query.toLowerCase();
    return this.getAll().filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.author.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  /**
   * Combined filter: search query + category + source.
   * Category 'ALL' / '' = no category filter.
   * Category 'FAVS' = favorites only.
   * Category 'PANTHEON' / 'USER' = source filter.
   */
  getFiltered(query: string, category: string, source?: PresetSource): UnifiedPreset[] {
    let results = this.getAll();

    // Source filter
    if (source) {
      results = results.filter(p => p.source === source);
    }

    // Category filter
    const cat = category.toUpperCase();
    if (cat && cat !== 'ALL') {
      if (cat === 'FAVS' || cat === '★ FAVS') {
        results = results.filter(p => p.fav);
      } else if (cat === 'PANTHEON') {
        results = results.filter(p => p.source === 'pantheon');
      } else if (cat === 'USER') {
        results = results.filter(p => p.source === 'user');
      } else {
        results = results.filter(p => p.type.toUpperCase() === cat);
      }
    }

    // Search filter
    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return results;
  }

  // ── Navigation ──

  getNext(currentId: string): UnifiedPreset {
    const all = this.getAll();
    const idx = all.findIndex(p => p.id === currentId);
    return all[(idx + 1) % all.length] || all[0];
  }

  getPrev(currentId: string): UnifiedPreset {
    const all = this.getAll();
    const idx = all.findIndex(p => p.id === currentId);
    return all[(idx - 1 + all.length) % all.length] || all[0];
  }

  // ── Mutations ──

  save(preset: UnifiedPreset): void {
    if (preset.source === 'pantheon') return; // Can't modify pantheon presets
    const idx = this.presets.findIndex(p => p.id === preset.id);
    if (idx >= 0) {
      this.presets[idx] = { ...preset, lastModified: new Date().toISOString() };
    } else {
      this.presets.push({ ...preset, lastModified: new Date().toISOString() });
    }
    this.saveToStorage();
    this.notify();
  }

  delete(id: string): void {
    const preset = this.presets.find(p => p.id === id);
    if (!preset || preset.source === 'pantheon') return;
    this.presets = this.presets.filter(p => p.id !== id);
    this.saveToStorage();
    this.notify();
  }

  duplicate(id: string): UnifiedPreset | undefined {
    const original = this.getById(id);
    if (!original) return undefined;
    const copy: UnifiedPreset = {
      ...original,
      id: generateId(),
      name: `Copy of ${original.name}`,
      source: 'user',
      fav: false,
      lastModified: new Date().toISOString(),
    };
    this.presets.push(copy);
    this.saveToStorage();
    this.notify();
    return copy;
  }

  toggleFavorite(id: string): void {
    // Vault/user presets: mutate in place
    const vaultPreset = this.presets.find(p => p.id === id);
    if (vaultPreset) {
      vaultPreset.fav = !vaultPreset.fav;
      this.saveToStorage();
      this.notify();
      return;
    }
    // Pantheon presets: toggle in memory (not persisted)
    const epPreset = this.pantheonPresets.find(p => p.id === id);
    if (epPreset) {
      epPreset.fav = !epPreset.fav;
      this.notify();
    }
  }

  setRating(id: string, rating: number): void {
    const preset = this.presets.find(p => p.id === id);
    if (preset) {
      preset.rating = Math.max(1, Math.min(5, rating));
      this.saveToStorage();
      this.notify();
    }
  }

  /**
   * For factory presets with state === null, capture the current
   * parameterValues as their default state. Called once on app init.
   */
  captureFactoryDefaults(parameterValues: Record<string, any>): void {
    let changed = false;
    for (const preset of this.presets) {
      if (preset.state === null && preset.source === 'vault') {
        preset.state = { params: { ...parameterValues } };
        changed = true;
      }
    }
    if (changed) {
      this.saveToStorage();
      // Don't notify — this is a silent background operation
    }
  }

  // ── Import / Export ──

  exportPreset(id: string): string | null {
    const preset = this.getById(id);
    if (!preset) return null;
    return JSON.stringify(preset, null, 2);
  }

  exportAll(): string {
    const exportable = this.presets; // Only vault + user, not pantheon
    return JSON.stringify(exportable, null, 2);
  }

  importPreset(json: string): UnifiedPreset | null {
    try {
      const data = JSON.parse(json);
      if (!data.name) return null;
      const preset: UnifiedPreset = {
        ...data,
        id: generateId(),
        source: 'user',
        lastModified: new Date().toISOString(),
        energyLevel: data.energyLevel ?? (40 + Math.random() * 60),
        fav: data.fav ?? false,
        rating: data.rating ?? 3,
        tags: data.tags ?? [],
      };
      this.presets.push(preset);
      this.saveToStorage();
      this.notify();
      return preset;
    } catch {
      console.error('[PresetService] Failed to import preset');
      return null;
    }
  }

  importVault(json: string): UnifiedPreset[] | null {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data)) return null;
      const imported = data.map((d: any) => ({
        ...d,
        id: d.id || generateId(),
        source: d.source || 'user',
        lastModified: d.lastModified || new Date().toISOString(),
        energyLevel: d.energyLevel ?? (40 + Math.random() * 60),
        fav: d.fav ?? false,
        rating: d.rating ?? 3,
        tags: d.tags ?? [],
        state: d.state ?? null,
      })) as UnifiedPreset[];
      this.presets = imported;
      this.saveToStorage();
      this.notify();
      return imported;
    } catch {
      console.error('[PresetService] Failed to import vault');
      return null;
    }
  }

  // ── Persistence ──

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.presets));
    } catch (e) {
      console.warn('[PresetService] Failed to save to localStorage', e);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.presets = JSON.parse(stored);
        return;
      }
    } catch {
      console.warn('[PresetService] Failed to load from localStorage, using factory defaults');
    }

    // No stored data — initialize with factory presets
    this.presets = FACTORY_PRESETS.map((p, i) => ({
      ...p,
      id: `factory-${i}`,
      lastModified: new Date().toISOString(),
      energyLevel: 40 + Math.random() * 60,
    }));
    this.saveToStorage();
  }

  /**
   * Convert Electric Pantheon presets into UnifiedPreset format.
   * These are read-only (source: 'pantheon') and never persisted.
   */
  private loadPantheonPresets(): UnifiedPreset[] {
    return vstGodPresets.map(ep => ({
      id: `ep-${ep.id}`,
      name: ep.displayName,
      type: capitalize(ep.category),
      author: capitalize(ep.god),
      rating: 5,
      fav: false,
      tags: [...ep.tags, 'Pantheon', capitalize(ep.god)],
      lastModified: '',
      energyLevel: 75,
      source: 'pantheon' as PresetSource,
      pantheonId: ep.id,
      godId: ep.godId,
      state: null,
    }));
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const presetService = new PresetService();

// ─── React Hook ─────────────────────────────────────────────────────────────

/**
 * React hook that subscribes to preset changes.
 * Re-renders the component whenever the preset service notifies.
 */
export function usePresetService(): PresetService {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    return presetService.onChange(() => forceUpdate(n => n + 1));
  }, []);
  return presetService;
}
