/**
 * VaultReborn.tsx — Rebuilt Preset Vault
 *
 * Three-panel layout:
 *   LEFT  (220 px) — Banks: Factory Library tree, My Presets, Sound Designs, Expansions
 *   CENTER (flex)  — Category chips (prominent, horizontal) + searchable/sortable item list
 *   RIGHT (300 px) — Tabbed: DETAIL/PREVIEW · SOUND FORGE (OSC/ADSR/LFO/Filter) · IMPORT ONESHOTS
 */

import React, {
  useState, useMemo, useCallback, useRef, useEffect,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, Heart, Plus, Package, Download, Loader2,
  ChevronRight, ChevronDown, Folder, Upload,
  Play, Square, Sliders, Activity, Layers, Star,
  Check, Copy, Zap, Database, Settings, Globe,
  Music, FileAudio, Eye, Scissors,
} from 'lucide-react';
import {
  FACTORY_ONESHOT_LIBRARY,
  FACTORY_ONESHOT_CATEGORIES,
  CATEGORY_DISPLAY,
  getFactoryItemPath,
  type FactoryOneshotItem,
} from '../data/factoryOneshotLibrary';
import { presetService, type UnifiedPreset } from '../services/presetService';
import { neuralInputBus } from '../services/neuralInputBus';

// ─── Types ───────────────────────────────────────────────────────────────────

type BankId = 'factory' | 'user' | 'forge-designs' | 'expansion' | 'chopped-samples' | 'multi-presets';
type RightTab = 'detail' | 'forge' | 'import';

/** Unified item — wraps either a synth preset or a factory sample */
interface VaultItem {
  itemId: string;
  label: string;
  category: string;
  author: string;
  tags: string[];
  kind: 'preset' | 'factory';
  preset?: UnifiedPreset;
  factory?: FactoryOneshotItem;
  rating?: number;
  isFav?: boolean;
}

interface ForgeParams {
  waveform: 'sine' | 'sawtooth' | 'square' | 'triangle';
  pitch: number;        // -24 to +24 semitones
  detune: number;       // 0-100
  attack: number;       // 0-100
  decay: number;        // 0-100
  sustain: number;      // 0-100
  release: number;      // 0-100
  filterCutoff: number; // 0-100
  filterRes: number;    // 0-100
  lfoRate: number;      // 0-100
  lfoDepth: number;     // 0-100
  lfoTarget: 'pitch' | 'filter' | 'amp';
  reverbMix: number;
  delayMix: number;
  chorusMix: number;
  satDrive: number;
  morphBlend: number;   // 0-100 (maps waveform+blend to pantheon)
  bodyGain: number;
  subOscGain: number;
}

const DEFAULT_FORGE: ForgeParams = {
  waveform: 'sawtooth', pitch: 0, detune: 10,
  attack: 5, decay: 30, sustain: 60, release: 40,
  filterCutoff: 60, filterRes: 20,
  lfoRate: 30, lfoDepth: 20, lfoTarget: 'filter',
  reverbMix: 35, delayMix: 20, chorusMix: 15, satDrive: 10,
  morphBlend: 50, bodyGain: 65, subOscGain: 25,
};

// ─── UI constants ────────────────────────────────────────────────────────────

const ALL_CHIP_CATEGORIES = [
  'ALL', 'Leads', 'Pads', 'Keys', 'Bass', 'Bells', 'Vox',
  'Strings', 'Ambient', 'Wind', 'Brass', 'Ethnic', 'FX',
  'Analog', 'Modulated', 'Organ', 'Synth', 'Guitar', 'Pluck',
  'Synth Brass', 'Accents', '808s', 'Arps', 'Kits',
];

// Map preset .type values → chip category
const PRESET_TYPE_TO_CHIP: Record<string, string> = {
  'Lead': 'Leads', 'Pad': 'Pads', 'Pads': 'Pads',
  'Keys': 'Keys', 'Bass': 'Bass', 'Bell': 'Bells', 'Bells': 'Bells',
  'Vox': 'Vox', 'Strings': 'Strings', 'Texture': 'Ambient', 'Textures': 'Ambient',
  'Wind': 'Wind', 'Real Brass': 'Brass', 'Brass': 'Brass',
  'Ethnic': 'Ethnic', 'FX': 'FX', 'Analog': 'Analog',
  'Modulated': 'Modulated', 'Organ': 'Organ', 'Synth': 'Synth',
  'Arp': 'Arps', 'Multi-Realm': 'Kits', 'Multi-Preset': 'Kits', 'Chopped Sample': 'Kits',
  'Pluck': 'Pluck', 'Guitar': 'Guitar', 'Leads': 'Leads',
  'Accents': 'Accents', 'Synth Brass': 'Synth Brass',
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface VaultRebornProps {
  presets: UnifiedPreset[];
  selectedPresetIndex: number;
  onSelectPreset: (idx: number) => void;
  onToggleFavorite: (idx: number) => void;
  onLoadPreset: () => void;
  onSavePreset: () => void;
  onSaveAsPreset: () => void;
  onDeletePreset: () => void;
  onCloudSync?: () => void;
  isSyncing?: boolean;
  kitExporter?: React.ReactNode;
  onSharePreset?: (preset: UnifiedPreset) => Promise<void>;
  activeSettings?: Record<string, any>;
  showMessage?: (msg: string) => void;
  update?: (id: string, val: any) => void;
  parameterValues?: Record<string, any>;
  /** Whether this tab is the currently visible one — gates MIDI keyboard playback */
  isActiveTab?: boolean;
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function chipFromItem(item: VaultItem): string {
  if (item.kind === 'factory') {
    return CATEGORY_DISPLAY[item.factory!.category] ?? item.category;
  }
  return PRESET_TYPE_TO_CHIP[item.preset!.type] ?? item.category;
}

/** Web-audio preview for the Sound Forge */
function previewForge(p: ForgeParams): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = p.waveform;
    osc.detune.value = p.pitch * 100 + p.detune;
    filter.type = 'lowpass';
    filter.frequency.value = 200 + (p.filterCutoff / 100) * 18000;
    filter.Q.value = (p.filterRes / 100) * 20;

    const now = ctx.currentTime;
    const atk = p.attack / 100 * 2;
    const dec = p.decay / 100 * 1;
    const sus = p.sustain / 100;
    const rel = p.release / 100 * 2;
    const hold = 0.4;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.7, now + atk);
    gain.gain.linearRampToValueAtTime(sus * 0.7, now + atk + dec);
    gain.gain.setValueAtTime(sus * 0.7, now + atk + dec + hold);
    gain.gain.linearRampToValueAtTime(0, now + atk + dec + hold + rel);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + atk + dec + hold + rel + 0.05);
    osc.onended = () => ctx.close();
  } catch (_) {}
}

// ─── Category → synth parameter mapping (makes factory items playable) ──────

const CATEGORY_SYNTH_PARAMS: Record<string, Partial<ForgeParams>> = {
  'Pads':     { waveform: 'sawtooth', attack: 45, decay: 50, sustain: 75, release: 65, filterCutoff: 35, filterRes: 12 },
  'Keys':     { waveform: 'triangle', attack: 3,  decay: 35, sustain: 55, release: 25, filterCutoff: 72, filterRes: 10 },
  'Bass':     { waveform: 'sawtooth', attack: 2,  decay: 15, sustain: 65, release: 12, filterCutoff: 25, filterRes: 20 },
  'Bells':    { waveform: 'triangle', attack: 2,  decay: 75, sustain: 15, release: 55, filterCutoff: 85, filterRes: 8  },
  'Bell':     { waveform: 'triangle', attack: 2,  decay: 75, sustain: 15, release: 55, filterCutoff: 85, filterRes: 8  },
  'Strings':  { waveform: 'sawtooth', attack: 30, decay: 40, sustain: 70, release: 50, filterCutoff: 45, filterRes: 16 },
  'Vox':      { waveform: 'sine',     attack: 15, decay: 30, sustain: 60, release: 35, filterCutoff: 55, filterRes: 10 },
  'Wind':     { waveform: 'triangle', attack: 10, decay: 25, sustain: 65, release: 30, filterCutoff: 68, filterRes: 14 },
  'Brass':    { waveform: 'sawtooth', attack: 8,  decay: 25, sustain: 70, release: 20, filterCutoff: 60, filterRes: 16 },
  'Analog':   { waveform: 'sawtooth', attack: 5,  decay: 30, sustain: 65, release: 25, filterCutoff: 50, filterRes: 22 },
  'Leads':    { waveform: 'sawtooth', attack: 2,  decay: 20, sustain: 70, release: 15, filterCutoff: 65, filterRes: 18 },
  'FX':       { waveform: 'square',   attack: 5,  decay: 40, sustain: 40, release: 45, filterCutoff: 50, filterRes: 30 },
  'Ambient':  { waveform: 'sine',     attack: 60, decay: 70, sustain: 80, release: 80, filterCutoff: 30, filterRes: 8  },
  'Ethnic':   { waveform: 'triangle', attack: 5,  decay: 45, sustain: 40, release: 35, filterCutoff: 62, filterRes: 12 },
  'Modulated':{ waveform: 'square',   attack: 5,  decay: 30, sustain: 55, release: 30, filterCutoff: 45, filterRes: 28 },
  'Organ':    { waveform: 'square',   attack: 2,  decay: 10, sustain: 80, release: 15, filterCutoff: 70, filterRes: 10 },
  'Synth':    { waveform: 'sawtooth', attack: 3,  decay: 25, sustain: 60, release: 20, filterCutoff: 55, filterRes: 20 },
};

// ─── VaultSynth — polyphonic Web Audio synth for keyboard-driven preset preview ──

class VaultSynth {
  ctx: AudioContext;
  private masterGain: GainNode;
  private comp: DynamicsCompressorNode;
  private voices = new Map<number, { osc: OscillatorNode; env: GainNode }>();
  params: ForgeParams = { ...DEFAULT_FORGE };
  private closed = false;

  constructor() {
    this.ctx = new AudioContext();
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -12; this.comp.ratio.value = 4;
    this.comp.attack.value = 0.005; this.comp.release.value = 0.1;
    this.comp.connect(this.ctx.destination);
    this.masterGain = this.ctx.createGain(); this.masterGain.gain.value = 0.82;
    this.masterGain.connect(this.comp);
  }

  resume() {
    if (!this.closed && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  noteOn(note: number, velocity: number) {
    if (this.closed) return;
    this.noteOff(note); // kill any existing voice on this pitch

    const schedule = () => {
      if (this.closed) return;
      const freq = 440 * Math.pow(2, (note - 69) / 12);
      const now = this.ctx.currentTime;
      const vel = Math.min(1, Math.max(0.01, velocity / 65535));
      const p = this.params;
      const osc = this.ctx.createOscillator();
      const flt = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();
      const pan = this.ctx.createStereoPanner();
      osc.type = p.waveform;
      osc.frequency.value = freq;
      osc.detune.value = p.pitch * 100 + p.detune;
      flt.type = 'lowpass';
      flt.frequency.value = 200 + (p.filterCutoff / 100) * 18000;
      flt.Q.value = (p.filterRes / 100) * 20;
      const atk = Math.max((p.attack / 100) * 2, 0.003);
      const dec = p.decay / 100;
      const sus = (p.sustain / 100) * vel;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(vel * 0.85, now + atk);
      env.gain.linearRampToValueAtTime(sus, now + atk + dec);
      osc.connect(flt).connect(env).connect(pan).connect(this.masterGain);
      osc.start(now);
      this.voices.set(note, { osc, env });
    };

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(schedule).catch(() => {});
    } else {
      schedule();
    }
  }

  noteOff(note: number) {
    if (this.closed) return;
    const v = this.voices.get(note);
    if (!v) return;
    const now = this.ctx.currentTime;
    const rel = Math.max((this.params.release / 100) * 2, 0.06);
    v.env.gain.cancelScheduledValues(now);
    v.env.gain.setValueAtTime(v.env.gain.value, now);
    v.env.gain.linearRampToValueAtTime(0, now + rel);
    const oscCopy = v.osc;
    setTimeout(() => { try { oscCopy.stop(); } catch (_) {} }, (rel + 0.15) * 1000);
    this.voices.delete(note);
  }

  allNotesOff() {
    [...this.voices.keys()].forEach(n => this.noteOff(n));
  }

  dispose() {
    this.closed = true;
    this.allNotesOff();
    setTimeout(() => { try { this.ctx.close(); } catch (_) {} }, 600);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export const VaultReborn: React.FC<VaultRebornProps> = ({
  presets,
  selectedPresetIndex,
  onSelectPreset,
  onToggleFavorite,
  onLoadPreset,
  onSavePreset,
  onSaveAsPreset,
  onDeletePreset,
  onCloudSync,
  isSyncing,
  activeSettings,
  showMessage,
  update,
  parameterValues,
  isActiveTab = false,
}) => {
  const sampleLibraryPath: string =
    activeSettings?.sampleLibraryPath ??
    parameterValues?.sampleLibraryPath ??
    'I:\\kits\\new kits\\2024-2025\\VSTGOD- God Of Oneshots';

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeBank, setActiveBank] = useState<BankId>('factory');
  const [expandedFactoryCategories, setExpandedFactoryCategories] = useState<Set<string>>(
    new Set(['Pads', 'Keys', 'Vox']),
  );
  const [activeChip, setActiveChip] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('detail');
  const [isForgePlaying, setIsForgePlaying] = useState(false);

  // ── VaultSynth — polyphonic keyboard preview (Analog Lab style) ───────────
  const vaultSynthRef = useRef<VaultSynth | null>(null);
  const isActiveTabRef = useRef(isActiveTab);
  useEffect(() => { isActiveTabRef.current = isActiveTab; }, [isActiveTab]);

  // Create synth once on mount; destroy on unmount
  useEffect(() => {
    const synth = new VaultSynth();
    vaultSynthRef.current = synth;
    const unsub = neuralInputBus.addListener(ev => {
      if (!isActiveTabRef.current) return; // only respond when Vault tab is active
      const s = vaultSynthRef.current;
      if (!s) return;
      if (ev.type === 'midi_note_on' && ev.note !== undefined) {
        s.noteOn(ev.note, ev.velocity ?? 32768);
      } else if (ev.type === 'midi_note_off' && ev.note !== undefined) {
        s.noteOff(ev.note);
      }
    });
    return () => { unsub(); vaultSynthRef.current?.dispose(); vaultSynthRef.current = null; };
  }, []); // mount / unmount only

  // Update synth params whenever the selected preset changes
  useEffect(() => {
    const synth = vaultSynthRef.current;
    if (!synth) return;
    if (!selectedItem) { synth.params = { ...DEFAULT_FORGE }; return; }

    if (selectedItem.kind === 'factory') {
      // Map factory category to synth params so the item is immediately playable
      const cat = selectedItem.factory?.displayCategory ?? selectedItem.category;
      const catParams = CATEGORY_SYNTH_PARAMS[cat] ?? {};
      synth.params = { ...DEFAULT_FORGE, ...catParams };
      return;
    }

    const p = selectedItem.preset?.state?.params ?? {};
    synth.params = {
      ...DEFAULT_FORGE,
      waveform: (p.waveform ?? DEFAULT_FORGE.waveform) as ForgeParams['waveform'],
      attack:      p.attack       ?? DEFAULT_FORGE.attack,
      decay:       p.decay        ?? DEFAULT_FORGE.decay,
      sustain:     p.sustain      ?? DEFAULT_FORGE.sustain,
      release:     p.release      ?? DEFAULT_FORGE.release,
      filterCutoff: p.filterFreq  ?? p.filterCutoff ?? DEFAULT_FORGE.filterCutoff,
      filterRes:   p.filterQ      ?? p.filterRes    ?? DEFAULT_FORGE.filterRes,
      pitch:       p.pitch        ?? DEFAULT_FORGE.pitch,
      detune:      p.detune       ?? DEFAULT_FORGE.detune,
    };
  }, [selectedItem]);

  // Sound Forge state
  const [forge, setForge] = useState<ForgeParams>(DEFAULT_FORGE);
  const [forgeName, setForgeName] = useState('');
  const [showForgeSaveInput, setShowForgeSaveInput] = useState(false);

  // Import state
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importPresetName, setImportPresetName] = useState('');
  const [importSaved, setImportSaved] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio preview for imported files
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);

  // ── Piano keyboard state (Kontakt-style) ──────────────────────────────────
  const [pianoActiveNotes, setPianoActiveNotes] = useState<Set<number>>(new Set());

  const pianoKeyDown = useCallback((note: number) => {
    const synth = vaultSynthRef.current;
    if (synth) {
      if (synth.ctx.state === 'suspended') {
        synth.ctx.resume().then(() => synth.noteOn(note, 50000)).catch(() => {});
      } else {
        synth.noteOn(note, 50000);
      }
    }
    setPianoActiveNotes(prev => new Set([...prev, note]));
  }, []);

  const pianoKeyUp = useCallback((note: number) => {
    vaultSynthRef.current?.noteOff(note);
    setPianoActiveNotes(prev => { const n = new Set(prev); n.delete(note); return n; });
  }, []);

  // Piano key geometry (C2=36 to C7=96)
  const pianoKeys = useMemo(() => {
    const W = 22; // white key width
    // white key index within octave (-1 = black key)
    const NOTE_WHITE = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6];
    // x-offset within octave for black keys (0 for white key positions)
    const BLACK_X = [0, 14, 0, 36, 0, 0, 80, 0, 102, 0, 124, 0];
    const whites: { note: number; x: number }[] = [];
    const blacks: { note: number; x: number }[] = [];
    for (let note = 36; note <= 96; note++) {
      const pos = note % 12;
      const oct = Math.floor((note - 36) / 12);
      const ox = oct * 7 * W;
      if (NOTE_WHITE[pos] >= 0) whites.push({ note, x: ox + NOTE_WHITE[pos] * W });
      else blacks.push({ note, x: ox + BLACK_X[pos] });
    }
    return { whites, blacks, totalWidth: 36 * W };
  }, []);

  // ── Derived lists ──────────────────────────────────────────────────────────

  const factoryItems = useMemo<VaultItem[]>(() =>
    FACTORY_ONESHOT_LIBRARY.map(f => ({
      itemId: f.id,
      label: f.name,
      category: CATEGORY_DISPLAY[f.category] ?? f.category,
      author: 'VSTGOD',
      tags: f.tags,
      kind: 'factory' as const,
      factory: f,
    })),
  []);

  const presetItems = useMemo<VaultItem[]>(() =>
    presets.map((p, idx) => ({
      itemId: p.id,
      label: p.name,
      category: PRESET_TYPE_TO_CHIP[p.type] ?? p.type,
      author: p.author,
      tags: p.tags ?? [],
      kind: 'preset' as const,
      preset: p,
      rating: p.rating,
      isFav: p.fav,
      _idx: idx,
    })) as VaultItem[],
  [presets]);

  const activeItems = useMemo<VaultItem[]>(() => {
    let pool: VaultItem[];
    if (activeBank === 'factory') pool = factoryItems;
    else if (activeBank === 'user') pool = presetItems.filter(p => p.preset!.author !== 'VST GOD');
    else if (activeBank === 'forge-designs') pool = presetItems.filter(p => p.preset!.type === 'Forge Design');
    else if (activeBank === 'chopped-samples') pool = presetItems.filter(p => p.preset!.type === 'Chopped Sample');
    else if (activeBank === 'multi-presets') pool = presetItems.filter(p => p.preset!.type === 'Multi-Preset' || p.preset!.type === 'Multi-Realm' || p.preset!.state?.params?.multiRealmSlots != null);
    else pool = presetItems; // expansion — show all

    // category chip filter
    if (activeChip !== 'ALL') {
      pool = pool.filter(item => chipFromItem(item) === activeChip);
    }

    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      pool = pool.filter(item =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q)),
      );
    }

    return pool;
  }, [activeBank, factoryItems, presetItems, activeChip, search]);

  const categoryCountsForBank = useMemo(() => {
    const pool = activeBank === 'factory' ? factoryItems : presetItems;
    const counts: Record<string, number> = { ALL: pool.length };
    pool.forEach(item => {
      const chip = chipFromItem(item);
      counts[chip] = (counts[chip] ?? 0) + 1;
    });
    return counts;
  }, [activeBank, factoryItems, presetItems]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectItem = useCallback((item: VaultItem) => {
    setSelectedItem(item);
    setRightTab('detail');
    if (item.kind === 'preset' && item.preset) {
      const idx = presets.findIndex(p => p.id === item.preset!.id);
      if (idx !== -1) {
        onSelectPreset(idx);
        // Auto-load: immediately apply preset to the engine so it's playable via MIDI/DAW
        onLoadPreset();
        showMessage?.(`LOADED: ${item.label}`);
      }
    }
  }, [presets, onSelectPreset, onLoadPreset, showMessage]);

  const handleToggleFactoryCat = useCallback((cat: string) => {
    setExpandedFactoryCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

  const handleLoadSelected = useCallback(() => {
    if (!selectedItem) return;
    if (selectedItem.kind === 'preset') {
      onLoadPreset();
      showMessage?.(`LOADED: ${selectedItem.label}`);
    } else if (selectedItem.kind === 'factory') {
      const fullPath = getFactoryItemPath(selectedItem.factory!, sampleLibraryPath);
      showMessage?.(`PATH COPIED — Load via BROWSE LIBRARY in plugin: ${fullPath}`);
    }
  }, [selectedItem, onLoadPreset, showMessage, sampleLibraryPath]);

  const handlePreviewItem = useCallback(async (item: VaultItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.kind === 'factory') {
      showMessage?.('🎧 Preview factory samples inside the plugin (file access required)');
      return;
    }
    // For forge-based presets we can synthesize
    if (item.preset?.type === 'Forge Design' && item.preset.state?.params) {
      const p = item.preset.state.params;
      previewForge({
        ...DEFAULT_FORGE,
        attack: p.attack ?? 5,
        decay: p.decay ?? 30,
        sustain: p.sustain ?? 60,
        release: p.release ?? 40,
        filterCutoff: p.filterFreq ?? 60,
        filterRes: p.filterQ ?? 20,
        reverbMix: p.reverbMix ?? 35,
        delayMix: p.delayMix ?? 20,
        morphBlend: p.morphBlend ?? 50,
        waveform: 'sawtooth',
      });
      setPreviewPlayingId(item.itemId);
      setTimeout(() => setPreviewPlayingId(null), 3000);
    }
  }, [showMessage]);

  // ── Forge ──────────────────────────────────────────────────────────────────

  const updateForgeParam = useCallback((key: keyof ForgeParams, val: number | string) => {
    setForge(prev => ({ ...prev, [key]: val }));
    // Live-push to plugin parameters if update is available
    const paramMap: Partial<Record<keyof ForgeParams, string>> = {
      attack: 'attack', decay: 'decay', sustain: 'sustain', release: 'release',
      filterCutoff: 'filterFreq', filterRes: 'filterQ',
      reverbMix: 'reverbMix', delayMix: 'delayMix', chorusMix: 'chorusMix',
      satDrive: 'satDrive', morphBlend: 'morphBlend',
      bodyGain: 'bodyGain', subOscGain: 'subOscGain',
    };
    const pId = paramMap[key];
    if (pId && update) update(pId, val);
  }, [update]);

  const handleForgePreview = useCallback(() => {
    setIsForgePlaying(true);
    previewForge(forge);
    const dur = (forge.attack + forge.decay + 400 + forge.release) / 100 * 2 * 1000 + 200;
    setTimeout(() => setIsForgePlaying(false), Math.max(dur, 1500));
  }, [forge]);

  const handleForgeSave = useCallback(() => {
    const name = forgeName.trim() || 'My Forge Design';
    const newPreset = presetService.saveAs({
      name,
      type: 'Forge Design',
      tags: ['Forge', forge.waveform, 'Sound Design'],
      state: {
        params: {
          energy: 60, divinity: 55, width: 50, realm: 45,
          filterFreq: forge.filterCutoff,
          filterQ: forge.filterRes,
          attack: forge.attack,
          decay: forge.decay,
          sustain: forge.sustain,
          release: forge.release,
          reverbMix: forge.reverbMix,
          delayMix: forge.delayMix,
          chorusMix: forge.chorusMix,
          satDrive: forge.satDrive,
          satMix: Math.floor(forge.satDrive / 2),
          morphBlend: forge.morphBlend,
          bodyGain: forge.bodyGain,
          subOscGain: forge.subOscGain,
          detuneCents: forge.detune,
          masterGain: 75,
        },
      },
    });
    setShowForgeSaveInput(false);
    setForgeName('');
    showMessage?.(`FORGE DESIGN SAVED: "${name}"`);
  }, [forge, forgeName, showMessage]);

  // ── Import Oneshots ────────────────────────────────────────────────────────

  const ACCEPTED = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/flac',
    'audio/x-wav', 'audio/aiff', 'audio/x-aiff'];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      ACCEPTED.includes(f.type) || /\.(wav|mp3|ogg|flac|aiff?)$/i.test(f.name)
    ).slice(0, 16);
    if (files.length) setImportFiles(prev => [...prev, ...files].slice(0, 16));
  }, []);

  const handleImportPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 16);
    if (files.length) setImportFiles(prev => [...prev, ...files].slice(0, 16));
    e.target.value = '';
  }, []);

  const handleRemoveImportFile = useCallback((idx: number) => {
    setImportFiles(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSaveImportPreset = useCallback(() => {
    if (!importFiles.length) return;
    const name = importPresetName.trim() || 'Imported Kit';
    const padAssignments = importFiles.map((f, i) => ({
      slotIndex: i,
      path: `file://${f.name}`,
      name: f.name.replace(/\.[^.]+$/, ''),
      isFileDrop: true,
    }));
    const midiMap = importFiles.map((_, i) => 36 + i); // C1 chromatic
    presetService.saveAs({
      name,
      type: 'Kits',
      tags: ['Import', 'Kit', 'Custom'],
      state: { params: {}, padAssignments, midiMap },
    });
    setImportSaved(true);
    showMessage?.(`KIT PRESET SAVED: "${name}" (${importFiles.length} samples mapped from C1)`);
    setTimeout(() => setImportSaved(false), 3000);
  }, [importFiles, importPresetName, showMessage]);

  // ── Clipboard ─────────────────────────────────────────────────────────────

  const handleCopyPath = useCallback(() => {
    if (selectedItem?.kind !== 'factory') return;
    const path = getFactoryItemPath(selectedItem.factory!, sampleLibraryPath);
    navigator.clipboard.writeText(path).catch(() => {});
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  }, [selectedItem, sampleLibraryPath]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full h-full overflow-hidden select-none text-white">

      {/* ── Main 3-panel area ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ════════════════════════════════════════════════════
          LEFT PANEL — BANKS
      ════════════════════════════════════════════════════ */}
      <aside className="w-[220px] shrink-0 flex flex-col border-r border-white/5 bg-black/50 overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-yellow-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Vault Banks</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
          {/* ── Factory Library ── */}
          <div>
            <button
              onClick={() => setActiveBank('factory')}
              className={`w-full flex items-center gap-2 px-4 py-2.5 transition-all text-left ${
                activeBank === 'factory'
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <Package size={13} />
              <span className="text-[11px] font-bold flex-1">Factory Library</span>
              <span className="text-[9px] font-mono opacity-50">{FACTORY_ONESHOT_LIBRARY.length}</span>
            </button>

            {/* Category tree (only visible when factory bank active) */}
            <AnimatePresence>
              {activeBank === 'factory' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {FACTORY_ONESHOT_CATEGORIES.map(cat => {
                    const count = FACTORY_ONESHOT_LIBRARY.filter(f => f.category === cat).length;
                    if (count === 0) return null;
                    const isOpen = expandedFactoryCategories.has(cat);
                    const displayCat = CATEGORY_DISPLAY[cat] ?? cat;
                    return (
                      <div key={cat}>
                        <button
                          onClick={() => {
                            handleToggleFactoryCat(cat);
                            setActiveChip(displayCat);
                          }}
                          className={`w-full flex items-center gap-1.5 pl-8 pr-3 py-1.5 transition-all text-left ${
                            activeChip === displayCat
                              ? 'text-yellow-400 bg-yellow-500/5'
                              : 'text-white/35 hover:text-white/65 hover:bg-white/[0.03]'
                          }`}
                        >
                          {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          <Folder size={10} className="opacity-60" />
                          <span className="text-[10px] font-semibold flex-1 truncate">{displayCat}</span>
                          <span className="text-[8px] font-mono opacity-40">{count}</span>
                        </button>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              {FACTORY_ONESHOT_LIBRARY.filter(f => f.category === cat).map(f => (
                                <button
                                  key={f.id}
                                  onClick={() => handleSelectItem({
                                    itemId: f.id, label: f.name,
                                    category: displayCat, author: 'VSTGOD',
                                    tags: f.tags, kind: 'factory', factory: f,
                                  })}
                                  className={`w-full flex items-center gap-1.5 pl-12 pr-3 py-1 transition-all text-left ${
                                    selectedItem?.itemId === f.id
                                      ? 'text-yellow-300 bg-yellow-500/10'
                                      : 'text-white/25 hover:text-white/55 hover:bg-white/[0.02]'
                                  }`}
                                >
                                  <FileAudio size={9} className="opacity-50 shrink-0" />
                                  <span className="text-[9px] truncate">{f.name}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── My Presets ── */}
          <button
            onClick={() => { setActiveBank('user'); setActiveChip('ALL'); }}
            className={`w-full flex items-center gap-2 px-4 py-2.5 transition-all text-left ${
              activeBank === 'user'
                ? 'bg-yellow-500/10 text-yellow-500'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            }`}
          >
            <Layers size={13} />
            <span className="text-[11px] font-bold flex-1">My Presets</span>
            <span className="text-[9px] font-mono opacity-50">
              {presets.filter(p => p.author !== 'VST GOD').length}
            </span>
          </button>

          {/* ── Sound Designs (Forge) ── */}
          <button
            onClick={() => { setActiveBank('forge-designs'); setActiveChip('ALL'); }}
            className={`w-full flex items-center gap-2 px-4 py-2.5 transition-all text-left ${
              activeBank === 'forge-designs'
                ? 'bg-yellow-500/10 text-yellow-500'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            }`}
          >
            <Settings size={13} />
            <span className="text-[11px] font-bold flex-1">Sound Designs</span>
            <span className="text-[9px] font-mono opacity-50">
              {presets.filter(p => p.type === 'Forge Design').length}
            </span>
          </button>

          {/* ── All Presets ── */}
          <button
            onClick={() => { setActiveBank('expansion'); setActiveChip('ALL'); }}
            className={`w-full flex items-center gap-2 px-4 py-2.5 transition-all text-left ${
              activeBank === 'expansion'
                ? 'bg-yellow-500/10 text-yellow-500'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            }`}
          >
            <Globe size={13} />
            <span className="text-[11px] font-bold flex-1">All Presets</span>
            <span className="text-[9px] font-mono opacity-50">{presets.length}</span>
          </button>

          {/* ── Chopped Samples ── */}
          <button
            onClick={() => { setActiveBank('chopped-samples'); setActiveChip('ALL'); }}
            className={`w-full flex items-center gap-2 px-4 py-2.5 transition-all text-left ${
              activeBank === 'chopped-samples'
                ? 'bg-purple-500/15 text-purple-300'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            }`}
          >
            <Scissors size={13} />
            <span className="text-[11px] font-bold flex-1">Chopped Samples</span>
            <span className="text-[9px] font-mono opacity-50">
              {presets.filter(p => p.type === 'Chopped Sample').length}
            </span>
          </button>

          {/* ── Multi-Presets ── */}
          <button
            onClick={() => { setActiveBank('multi-presets'); setActiveChip('ALL'); }}
            className={`w-full flex items-center gap-2 px-4 py-2.5 transition-all text-left ${
              activeBank === 'multi-presets'
                ? 'bg-amber-500/15 text-amber-300'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            }`}
          >
            <Layers size={13} />
            <span className="text-[11px] font-bold flex-1">Multi-Presets</span>
            <span className="text-[9px] font-mono opacity-50">
              {presets.filter(p => p.type === 'Multi-Preset' || p.type === 'Multi-Realm' || p.state?.params?.multiRealmSlots != null).length}
            </span>
          </button>
        </div>

        {/* ── Bottom actions ── */}
        <div className="p-3 border-t border-white/5 space-y-2">
          <button
            onClick={() => { setRightTab('import'); setActiveBank('user'); }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all text-yellow-500"
          >
            <Upload size={12} />
            <span className="text-[9px] font-black uppercase tracking-wider">Import Oneshots</span>
          </button>
          <button
            onClick={() => { setRightTab('forge'); }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all text-purple-400"
          >
            <Sliders size={12} />
            <span className="text-[9px] font-black uppercase tracking-wider">Sound Forge</span>
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════
          CENTER PANEL — CATEGORY CHIPS + PRESET LIST
      ════════════════════════════════════════════════════ */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-black/20">

        {/* ── Category chips ─────────────────────────────── */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/5 bg-gradient-to-b from-black/40 to-transparent">
          <div className="flex flex-wrap gap-1.5">
            {ALL_CHIP_CATEGORIES.map(chip => {
              const count = categoryCountsForBank[chip] ?? 0;
              const active = activeChip === chip;
              if (chip !== 'ALL' && count === 0) return null;
              return (
                <button
                  key={chip}
                  onClick={() => setActiveChip(chip)}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${
                    active
                      ? 'bg-yellow-500 text-black shadow-[0_0_12px_rgba(255,215,0,0.35)]'
                      : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70 border border-white/5'
                  }`}
                >
                  {chip}
                  {count > 0 && (
                    <span className={`ml-1.5 text-[8px] font-mono ${active ? 'text-black/60' : 'opacity-50'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Search bar ─────────────────────────────────── */}
        <div className="shrink-0 px-4 py-2 border-b border-white/5">
          <div className="relative group max-w-sm">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-yellow-500 transition-colors" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search presets, tags, author…"
              className="w-full bg-black/40 border border-white/8 rounded-full pl-8 pr-4 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-yellow-500/40 outline-none transition-all"
            />
          </div>
        </div>

        {/* ── Preset list ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-white/20">
              <Music size={28} className="mb-3 opacity-30" />
              <p className="text-xs font-bold uppercase tracking-wider">No items found</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {activeItems.map(item => {
                const isSelected = selectedItem?.itemId === item.itemId;
                const isPreviewPlaying = previewPlayingId === item.itemId;
                return (
                  <motion.div
                    key={item.itemId}
                    layout
                    onClick={() => handleSelectItem(item)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-yellow-500/10 border-l-2 border-yellow-500'
                        : 'hover:bg-white/[0.03] border-l-2 border-transparent'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                      item.kind === 'factory'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {item.kind === 'factory' ? <FileAudio size={11} /> : <Layers size={11} />}
                    </div>

                    {/* Name + tags */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${
                        isSelected ? 'text-yellow-400' : 'text-white/90'
                      }`}>{item.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-white/45 uppercase font-bold">{item.category}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-white/15" />
                        <span className="text-[9px] text-white/35">{item.author}</span>
                        {item.tags.slice(2, 4).map(t => (
                          <span key={t} className="text-[8px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    </div>

                    {/* Rating (presets only) */}
                    {item.rating !== undefined && (
                      <div className="flex gap-0.5 shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={7} className={i < item.rating! ? 'text-yellow-500' : 'text-white/10'} fill={i < item.rating! ? 'currentColor' : 'none'} />
                        ))}
                      </div>
                    )}

                    {/* Preview + fav buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={e => handlePreviewItem(item, e)}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                          isPreviewPlaying
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/70'
                        }`}
                        title="Preview"
                      >
                        {isPreviewPlaying ? <Square size={9} /> : <Play size={9} />}
                      </button>
                      {item.kind === 'preset' && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            const idx = presets.findIndex(p => p.id === item.preset!.id);
                            if (idx !== -1) onToggleFavorite(idx);
                          }}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                            item.isFav ? 'text-yellow-500' : 'text-white/20 hover:text-white/50'
                          }`}
                          title="Favourite"
                        >
                          <Heart size={9} fill={item.isFav ? 'currentColor' : 'none'} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ════════════════════════════════════════════════════
          RIGHT PANEL — DETAIL / FORGE / IMPORT
      ════════════════════════════════════════════════════ */}
      <aside className="w-[300px] shrink-0 flex flex-col border-l border-white/5 bg-black/40 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-white/5 shrink-0">
          {([
            { id: 'detail', icon: Eye,     label: 'DETAIL'  },
            { id: 'forge',  icon: Sliders, label: 'FORGE'   },
            { id: 'import', icon: Upload,  label: 'IMPORT'  },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setRightTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[8px] font-black uppercase tracking-wider transition-all ${
                rightTab === tab.id
                  ? 'text-yellow-500 bg-yellow-500/5 border-b-2 border-yellow-500'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/[0.02]'
              }`}
            >
              <tab.icon size={11} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ──────────────────────────────────────────────────
            DETAIL TAB
        ────────────────────────────────────────────────── */}
        {rightTab === 'detail' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {!selectedItem ? (
              <div className="flex flex-col items-center justify-center h-48 text-white/20">
                <Eye size={28} className="mb-3 opacity-30" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-center">
                  Select a preset<br />to see details
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div>
                  <span className={`text-[8px] font-black uppercase tracking-[0.3em] px-2 py-0.5 rounded ${
                    selectedItem.kind === 'factory'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                  }`}>
                    {selectedItem.kind === 'factory' ? 'Factory Sample' : 'Preset'} — {selectedItem.category}
                  </span>
                  <h3 className="text-2xl font-black text-white mt-2 leading-tight">{selectedItem.label}</h3>
                  <p className="text-[11px] text-white/45 font-semibold mt-1">By {selectedItem.author}</p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {selectedItem.tags.map(t => (
                    <span key={t} className="text-[9px] bg-white/5 text-white/50 border border-white/8 px-2 py-0.5 rounded font-bold uppercase">{t}</span>
                  ))}
                </div>

                {/* Rating (presets only) */}
                {selectedItem.kind === 'preset' && selectedItem.rating !== undefined && (
                  <div>
                    <p className="text-[9px] text-white/40 uppercase font-black mb-1.5">Rating</p>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} className={i < selectedItem.rating! ? 'text-yellow-500' : 'text-white/10'} fill={i < selectedItem.rating! ? 'currentColor' : 'none'} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Factory: path info */}
                {selectedItem.kind === 'factory' && (
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 space-y-2">
                    <p className="text-[8px] text-white/30 uppercase font-black">File Path</p>
                    <p className="text-[9px] text-white/50 font-mono break-all leading-relaxed">
                      {getFactoryItemPath(selectedItem.factory!, sampleLibraryPath)}
                    </p>
                    <button
                      onClick={handleCopyPath}
                      className="flex items-center gap-1.5 text-[9px] font-black uppercase text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {copiedPath ? <Check size={10} /> : <Copy size={10} />}
                      {copiedPath ? 'Copied!' : 'Copy path'}
                    </button>
                  </div>
                )}

                {/* Preset params mini-view */}
                {selectedItem.kind === 'preset' && selectedItem.preset?.state?.params && (
                  <div className="space-y-1.5">
                    <p className="text-[8px] text-white/30 uppercase font-black">Parameters</p>
                    {['energy', 'divinity', 'width', 'realm'].map(k => {
                      const v = selectedItem.preset!.state!.params[k] ?? 0;
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-[8px] text-white/30 w-14 uppercase font-bold">{k}</span>
                          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500/60 rounded-full" style={{ width: `${v}%` }} />
                          </div>
                          <span className="text-[8px] font-mono text-white/30 w-6 text-right">{v}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Action buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleLoadSelected}
                    className="w-full py-2.5 rounded-lg bg-yellow-500 text-black text-xs font-black uppercase tracking-wider hover:bg-yellow-400 transition-all shadow-[0_0_14px_rgba(255,215,0,0.2)] flex items-center justify-center gap-2"
                  >
                    <Zap size={12} />
                    {selectedItem.kind === 'factory' ? 'Copy Path' : 'Load Preset'}
                  </button>
                  {selectedItem.kind === 'preset' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const idx = presets.findIndex(p => p.id === selectedItem.preset!.id);
                          if (idx !== -1) onToggleFavorite(idx);
                        }}
                        className="flex-1 py-2 rounded-lg bg-white/5 border border-white/8 text-[9px] font-black uppercase text-white/50 hover:text-yellow-400 hover:border-yellow-500/30 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Heart size={10} />
                        {selectedItem.isFav ? 'Unfave' : 'Favourite'}
                      </button>
                      <button
                        onClick={onDeletePreset}
                        className="flex-1 py-2 rounded-lg bg-red-500/5 border border-red-500/15 text-[9px] font-black uppercase text-red-400/60 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center gap-1.5"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────
            SOUND FORGE TAB
        ────────────────────────────────────────────────── */}
        {rightTab === 'forge' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <div>
              <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Sound Forge</p>
              <p className="text-[8px] text-white/25">Design a sound, preview it, then save as a preset.</p>
            </div>

            {/* Waveform type */}
            <div>
              <p className="text-[8px] text-white/30 uppercase font-black mb-2">Waveform</p>
              <div className="grid grid-cols-4 gap-1">
                {(['sine', 'sawtooth', 'square', 'triangle'] as const).map(w => (
                  <button
                    key={w}
                    onClick={() => {
                      setForge(p => ({ ...p, waveform: w }));
                      const morphMap = { sine: 0, triangle: 25, sawtooth: 50, square: 75 };
                      updateForgeParam('morphBlend', morphMap[w]);
                    }}
                    className={`py-1.5 rounded text-[8px] font-black uppercase transition-all ${
                      forge.waveform === w
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-white/30 hover:bg-white/10'
                    }`}
                  >
                    {w === 'sawtooth' ? 'SAW' : w.slice(0, 3).toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* ADSR */}
            <ForgeSliderGroup
              label="Envelope (ADSR)"
              params={[
                { key: 'attack',  label: 'ATK', val: forge.attack },
                { key: 'decay',   label: 'DEC', val: forge.decay },
                { key: 'sustain', label: 'SUS', val: forge.sustain },
                { key: 'release', label: 'REL', val: forge.release },
              ]}
              onChange={updateForgeParam}
            />

            {/* Filter */}
            <ForgeSliderGroup
              label="Filter"
              params={[
                { key: 'filterCutoff', label: 'CUT', val: forge.filterCutoff },
                { key: 'filterRes',    label: 'RES', val: forge.filterRes },
              ]}
              onChange={updateForgeParam}
            />

            {/* LFO */}
            <div>
              <p className="text-[8px] text-white/30 uppercase font-black mb-2">LFO</p>
              <div className="grid grid-cols-3 gap-1 mb-2">
                {(['pitch', 'filter', 'amp'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForge(p => ({ ...p, lfoTarget: t }))}
                    className={`py-1 rounded text-[8px] font-black uppercase transition-all ${
                      forge.lfoTarget === t
                        ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
                        : 'bg-white/5 text-white/30 hover:bg-white/10'
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <ForgeSliderGroup
                label=""
                params={[
                  { key: 'lfoRate',  label: 'RATE',  val: forge.lfoRate },
                  { key: 'lfoDepth', label: 'DEPTH', val: forge.lfoDepth },
                ]}
                onChange={updateForgeParam}
              />
            </div>

            {/* FX */}
            <ForgeSliderGroup
              label="FX"
              params={[
                { key: 'reverbMix', label: 'VERB', val: forge.reverbMix },
                { key: 'delayMix',  label: 'DLY',  val: forge.delayMix },
                { key: 'chorusMix', label: 'CHR',  val: forge.chorusMix },
                { key: 'satDrive',  label: 'SAT',  val: forge.satDrive },
              ]}
              onChange={updateForgeParam}
            />

            {/* Preview + Save */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleForgePreview}
                disabled={isForgePlaying}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  isForgePlaying
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30'
                }`}
              >
                {isForgePlaying ? <Activity size={12} className="animate-pulse" /> : <Play size={12} />}
                {isForgePlaying ? 'Playing…' : 'Preview Sound'}
              </button>

              {showForgeSaveInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={forgeName}
                    onChange={e => setForgeName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleForgeSave(); if (e.key === 'Escape') setShowForgeSaveInput(false); }}
                    placeholder="Preset name…"
                    autoFocus
                    className="flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-[10px] text-white placeholder:text-white/20 outline-none focus:border-yellow-500/40"
                  />
                  <button
                    onClick={handleForgeSave}
                    className="px-3 py-2 bg-yellow-500 text-black rounded-lg text-[9px] font-black uppercase"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowForgeSaveInput(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-yellow-500/15 text-yellow-500 border border-yellow-500/25 hover:bg-yellow-500/25 transition-all text-[10px] font-black uppercase tracking-wider"
                >
                  <Plus size={12} />
                  Save as Preset
                </button>
              )}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────
            IMPORT ONESHOTS TAB
        ────────────────────────────────────────────────── */}
        {rightTab === 'import' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <div>
              <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Import Oneshots</p>
              <p className="text-[8px] text-white/25 leading-relaxed">
                Drop up to 16 audio files. They'll be auto-mapped chromatically from C1 (MIDI 36) across the keyboard and saved as a kit preset.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragEnter={e => { e.preventDefault(); dragCounter.current++; setIsDragOver(true); }}
              onDragOver={e => e.preventDefault()}
              onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false); }}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed transition-all p-6 flex flex-col items-center justify-center gap-3 cursor-pointer min-h-[100px] ${
                isDragOver
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : 'border-white/15 hover:border-white/30 bg-white/[0.02]'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={22} className={isDragOver ? 'text-yellow-500' : 'text-white/25'} />
              <p className="text-[9px] font-bold text-center text-white/40">
                {isDragOver ? 'Drop to add' : 'Drop WAV / MP3 / AIFF here or click to browse'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={handleImportPick}
              />
            </div>

            {/* Mapped files list */}
            {importFiles.length > 0 && (
              <div className="space-y-1">
                <p className="text-[8px] text-white/30 uppercase font-black mb-2">
                  {importFiles.length}/16 files — chromatic from C1
                </p>
                {importFiles.map((f, i) => {
                  const note = 36 + i;
                  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
                  const noteName = `${noteNames[note % 12]}${Math.floor(note / 12) - 1}`;
                  return (
                    <div key={i} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/5">
                      <span className="text-[8px] font-mono text-yellow-500/80 w-8 shrink-0">{noteName}</span>
                      <span className="text-[9px] text-white/60 flex-1 truncate">{f.name.replace(/\.[^.]+$/, '')}</span>
                      <button
                        onClick={() => handleRemoveImportFile(i)}
                        className="text-white/20 hover:text-red-400 transition-colors text-[10px] shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Save as preset */}
            {importFiles.length > 0 && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={importPresetName}
                  onChange={e => setImportPresetName(e.target.value)}
                  placeholder="Kit preset name…"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-[10px] text-white placeholder:text-white/20 outline-none focus:border-yellow-500/40"
                />
                <button
                  onClick={handleSaveImportPreset}
                  disabled={importSaved}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    importSaved
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-[0_0_14px_rgba(255,215,0,0.2)]'
                  }`}
                >
                  {importSaved ? <><Check size={12} /> Saved!</> : <><Package size={12} /> Save as Kit Preset</>}
                </button>
                {!importSaved && (
                  <button
                    onClick={() => setImportFiles([])}
                    className="w-full py-1.5 text-[8px] font-bold uppercase text-white/20 hover:text-white/50 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
      </div>{/* end 3-panel area */}

      {/* ════════════════════════════════════════════════════
          KONTAKT-STYLE PIANO KEYBOARD
      ════════════════════════════════════════════════════ */}
      <div
        className="shrink-0 border-t border-white/10 overflow-x-auto overflow-y-hidden bg-gradient-to-b from-[#111] to-[#080808]"
        style={{ height: 92 }}
      >
        <div className="flex items-end px-2 h-full">
          <div
            className="relative"
            style={{ width: pianoKeys.totalWidth, height: 80, flexShrink: 0 }}
          >
            {/* White keys */}
            {pianoKeys.whites.map(({ note, x }) => (
              <div
                key={note}
                onPointerDown={e => { e.preventDefault(); pianoKeyDown(note); }}
                onPointerUp={() => pianoKeyUp(note)}
                onPointerLeave={() => { if (pianoActiveNotes.has(note)) pianoKeyUp(note); }}
                style={{
                  position: 'absolute', left: x, top: 0, width: 21, height: 80,
                  background: pianoActiveNotes.has(note)
                    ? 'linear-gradient(to bottom,#fde68a,#f59e0b)'
                    : 'linear-gradient(to bottom,#ddd,#bbb)',
                  border: '1px solid rgba(0,0,0,0.4)',
                  borderRadius: '0 0 3px 3px',
                  cursor: 'pointer', zIndex: 1, userSelect: 'none',
                  boxShadow: pianoActiveNotes.has(note) ? 'inset 0 -2px 4px rgba(245,158,11,0.4)' : 'none',
                }}
              />
            ))}
            {/* Black keys */}
            {pianoKeys.blacks.map(({ note, x }) => (
              <div
                key={note}
                onPointerDown={e => { e.preventDefault(); e.stopPropagation(); pianoKeyDown(note); }}
                onPointerUp={e => { e.stopPropagation(); pianoKeyUp(note); }}
                onPointerLeave={() => { if (pianoActiveNotes.has(note)) pianoKeyUp(note); }}
                style={{
                  position: 'absolute', left: x, top: 0, width: 14, height: 52,
                  background: pianoActiveNotes.has(note)
                    ? '#f59e0b'
                    : 'linear-gradient(to bottom,#222,#000)',
                  borderRadius: '0 0 3px 3px',
                  cursor: 'pointer', zIndex: 2, userSelect: 'none',
                  boxShadow: '1px 3px 5px rgba(0,0,0,0.9)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ForgeSliderGroup — reusable row of named knob-sliders ────────────────────

interface SliderParam {
  key: keyof ForgeParams;
  label: string;
  val: number;
}

const ForgeSliderGroup: React.FC<{
  label: string;
  params: SliderParam[];
  onChange: (key: keyof ForgeParams, val: number) => void;
}> = ({ label, params, onChange }) => (
  <div>
    {label && <p className="text-[8px] text-white/30 uppercase font-black mb-2">{label}</p>}
    <div className="space-y-2">
      {params.map(p => (
        <div key={p.key} className="flex items-center gap-2">
          <span className="text-[8px] text-white/35 w-8 uppercase font-bold shrink-0">{p.label}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={p.val}
            onChange={e => onChange(p.key, Number(e.target.value))}
            className="flex-1 h-1 accent-purple-500 cursor-pointer"
          />
          <span className="text-[8px] font-mono text-white/30 w-6 text-right shrink-0">{p.val}</span>
        </div>
      ))}
    </div>
  </div>
);

export default VaultReborn;
