/**
 * MultiRealmForge.tsx — v2
 * Pigments-style layered instrument. Fixes:
 *  • Preset/oneshot drag-drop now actually synthesises audio
 *  • Full FX chain: reverb (convolver), stereo chorus, tape delay, distortion, compressor pedal
 *  • Load any Vault preset (OSC-based or sample-based) into a slot
 *  • Clear, readable typography
 */
import React, {
  useState, useCallback, useRef, useEffect, useMemo, memo,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus, FileAudio, Layers, Upload, Volume2, Shuffle,
  ArrowLeftRight, Trash2, ChevronDown, ChevronUp, Power,
  Copy, Save, Music, Zap, Package, Search,
} from 'lucide-react';
import { presetService, type UnifiedPreset } from '../services/presetService';
import { CORE_LIBRARY, CORE_LIBRARY_ROOTS } from '../services/coreLibraryData';
import { coreLibraryFS } from '../services/coreLibraryFS';
import { nativeAudio } from '../native/bridge';
import { cacheAudioBuffer, retrieveAudioBuffer, deleteCachedBuffer } from '../services/audioBufferCache';
import { neuralInputBus } from '../services/neuralInputBus';
import { audioEngine } from '../services/audioEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlotKind   = 'osc' | 'sample' | 'preset';
type PlayMode   = 'omni' | 'round-robin' | 'random';
type WaveType   = 'sine' | 'sawtooth' | 'square' | 'triangle';
type FxParamKey = 'reverbMix' | 'chorusMix' | 'delayMix' | 'distDrive' | 'compThreshold' | 'eqLow' | 'eqMid' | 'eqHigh' | 'phaserRate' | 'phaserDepth' | 'filterCutoff' | 'filterRes' | 'pitchSemi';
type FxBoolKey  = 'phaserEnabled' | 'filterEnabled' | 'halftimeEnabled';

interface OscConfig {
  waveform: WaveType;
  pitch: number;
  detune: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterCutoff: number;
  filterRes: number;
  volume: number;
  pan: number;
}

interface SampleConfig {
  file: File | null;
  buffer: AudioBuffer | null;
  fileName: string;    // persisted — used to reload from IndexedDB cache
  pitch: number;
  volume: number;
  pan: number;
  loop: boolean;
}

interface PresetConfig {
  presetId: string | null;
  presetName: string;
  volume: number;
  pan: number;
}

interface FxChain {
  reverbMix: number;
  chorusMix: number;
  delayMix: number;
  distDrive: number;
  compThreshold: number;
  // Extended FX
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  phaserEnabled: boolean;
  phaserRate: number;
  phaserDepth: number;
  filterCutoff: number;
  filterRes: number;
  filterEnabled: boolean;
  pitchSemi: number;
  halftimeEnabled: boolean;
}

interface RealmSlot {
  id: string;
  kind: SlotKind;
  enabled: boolean;
  label: string;
  color: string;
  osc: OscConfig;
  sample: SampleConfig;
  preset: PresetConfig;
  fx: FxChain;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_OSC: OscConfig = {
  waveform: 'sawtooth', pitch: 0, detune: 0,
  attack: 5, decay: 30, sustain: 65, release: 45,
  filterCutoff: 70, filterRes: 15, volume: 0.8, pan: 0,
};
const DEFAULT_SAMPLE: SampleConfig = { file: null, buffer: null, fileName: '', pitch: 0, volume: 0.8, pan: 0, loop: false };
const DEFAULT_PRESET: PresetConfig = { presetId: null, presetName: '', volume: 0.8, pan: 0 };
// ─── Piano key map (C3–B6) ────────────────────────────────────────────────────
const MR_PIANO_KEYS = (() => {
  const keys: { midi: number; name: string; octave: number; isBlack: boolean }[] = [];
  for (let oct = 3; oct <= 6; oct++) {
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    for (let n = 0; n < 12; n++) {
      keys.push({ midi: (oct + 1) * 12 + n, name: names[n], octave: oct, isBlack: names[n].includes('#') });
    }
  }
  return keys;
})();

const DEFAULT_FX: FxChain = {
  reverbMix: 15, chorusMix: 10, delayMix: 10, distDrive: 0, compThreshold: 100,
  eqLow: 0, eqMid: 0, eqHigh: 0,
  phaserEnabled: false, phaserRate: 0.5, phaserDepth: 0.5,
  filterCutoff: 100, filterRes: 0, filterEnabled: false,
  pitchSemi: 0, halftimeEnabled: false,
};

const SLOT_COLORS = ['#a855f7','#3b82f6','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16','#8b5cf6','#f97316'];

function makeSlot(index: number): RealmSlot {
  return {
    id: `slot-${Date.now()}-${index}`, kind: 'osc', enabled: true,
    label: `Layer ${index + 1}`, color: SLOT_COLORS[index % SLOT_COLORS.length],
    osc: { ...DEFAULT_OSC }, sample: { ...DEFAULT_SAMPLE },
    preset: { ...DEFAULT_PRESET }, fx: { ...DEFAULT_FX },
  };
}

// ─── Impulse response (convolution reverb) ───────────────────────────────────

function buildImpulse(ctx: AudioContext, secs = 2.5, decay = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow((len - i) / len, decay);
  }
  return buf;
}

// ─── Distortion curve ─────────────────────────────────────────────────────────

function distCurve(amount: number): Float32Array {
  const n = 256; const c = new Float32Array(n);
  const k = amount * 4;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = k > 0 ? (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x)) : x;
  }
  return c;
}

// ─── Per-slot Web Audio engine ────────────────────────────────────────────────

class SlotEngine {
  private ctx: AudioContext;
  private slotGain: GainNode;
  private convolver: ConvolverNode;
  private reverbSend: GainNode;
  private drySend: GainNode;
  private chorusDelay: DelayNode;
  private chorusMixGain: GainNode;
  private chorusLFO: OscillatorNode;
  private delayNode: DelayNode;
  private delayFB: GainNode;
  private delayMix: GainNode;
  private waveshaper: WaveShaperNode;
  private compressor: DynamicsCompressorNode;
  // EQ
  private eqLow: BiquadFilterNode;
  private eqMid: BiquadFilterNode;
  private eqHigh: BiquadFilterNode;
  // Phaser
  private phasStages: BiquadFilterNode[];
  private phasLfo: OscillatorNode;
  private phasLfoG: GainNode;
  private phasIn: GainNode;
  private phasOut: GainNode;
  // Pre-filter
  private preFilter: BiquadFilterNode;

  private activeOscs = new Map<number, { osc: OscillatorNode; gain: GainNode }>();
  private activeSamples = new Map<number, AudioBufferSourceNode>();

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;

    // Compressor → EQ → final output
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -12; this.compressor.knee.value = 6;
    this.compressor.ratio.value = 4; this.compressor.attack.value = 0.005; this.compressor.release.value = 0.1;

    this.eqLow  = ctx.createBiquadFilter(); this.eqLow.type  = 'lowshelf';  this.eqLow.frequency.value  = 120;  this.eqLow.gain.value  = 0;
    this.eqMid  = ctx.createBiquadFilter(); this.eqMid.type  = 'peaking';   this.eqMid.frequency.value  = 1000; this.eqMid.gain.value  = 0; this.eqMid.Q.value = 1;
    this.eqHigh = ctx.createBiquadFilter(); this.eqHigh.type = 'highshelf'; this.eqHigh.frequency.value = 8000; this.eqHigh.gain.value = 0;
    this.compressor.connect(this.eqLow); this.eqLow.connect(this.eqMid); this.eqMid.connect(this.eqHigh); this.eqHigh.connect(dest);

    // Convolution reverb (send)
    this.convolver  = ctx.createConvolver();
    this.convolver.buffer = buildImpulse(ctx);
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.15;
    this.convolver.connect(this.reverbSend); this.reverbSend.connect(this.compressor);

    // Dry path
    this.drySend = ctx.createGain(); this.drySend.gain.value = 1;
    this.drySend.connect(this.compressor);

    // Chorus (send)
    this.chorusDelay = ctx.createDelay(0.03); this.chorusDelay.delayTime.value = 0.015;
    this.chorusLFO   = ctx.createOscillator(); this.chorusLFO.type = 'sine'; this.chorusLFO.frequency.value = 0.5;
    const lfoDepth   = ctx.createGain(); lfoDepth.gain.value = 0.006;
    this.chorusLFO.connect(lfoDepth); lfoDepth.connect(this.chorusDelay.delayTime as unknown as AudioParam);
    this.chorusLFO.start();
    this.chorusMixGain = ctx.createGain(); this.chorusMixGain.gain.value = 0;
    this.chorusDelay.connect(this.chorusMixGain); this.chorusMixGain.connect(this.compressor);

    // Tape delay (send)
    this.delayNode = ctx.createDelay(1); this.delayNode.delayTime.value = 0.375;
    this.delayFB   = ctx.createGain(); this.delayFB.gain.value = 0.3;
    this.delayMix  = ctx.createGain(); this.delayMix.gain.value = 0;
    this.delayNode.connect(this.delayFB); this.delayFB.connect(this.delayNode);
    this.delayMix.connect(this.delayNode); this.delayMix.connect(this.compressor);

    // Waveshaper (dist, insert)
    this.waveshaper = ctx.createWaveShaper();
    this.waveshaper.curve = distCurve(0); this.waveshaper.oversample = '4x';
    this.waveshaper.connect(this.drySend);

    // Phaser (insert, 4 allpass stages)
    this.phasIn  = ctx.createGain();
    this.phasOut = ctx.createGain();
    this.phasStages = [];
    let pchain: AudioNode = this.phasIn;
    for (let i = 0; i < 4; i++) {
      const ap = ctx.createBiquadFilter(); ap.type = 'allpass';
      ap.frequency.value = 800 + i * 400; ap.Q.value = 0.5;
      pchain.connect(ap); pchain = ap; this.phasStages.push(ap);
    }
    pchain.connect(this.phasOut);
    this.phasLfo = ctx.createOscillator(); this.phasLfo.frequency.value = 0.5; this.phasLfo.type = 'sine';
    this.phasLfoG = ctx.createGain(); this.phasLfoG.gain.value = 0;
    this.phasLfo.connect(this.phasLfoG); this.phasStages.forEach(s => this.phasLfoG.connect(s.frequency));
    this.phasLfo.start();
    // phasIn + phasOut → waveshaper (so phaser is in the insert chain)
    this.phasIn.connect(this.waveshaper);
    this.phasOut.connect(this.waveshaper);

    // Pre-filter (before FX)
    this.preFilter = ctx.createBiquadFilter(); this.preFilter.type = 'lowpass'; this.preFilter.frequency.value = 20000;
    this.preFilter.connect(this.phasIn);

    // Slot gain → pre-filter → phaser → waveshaper → dry | reverb | chorus | delay
    this.slotGain = ctx.createGain(); this.slotGain.gain.value = 0.8;
    this.slotGain.connect(this.preFilter);
    this.slotGain.connect(this.convolver);
    this.slotGain.connect(this.chorusDelay);
    this.slotGain.connect(this.delayMix);
  }

  setFx(fx: FxChain): void {
    const t = this.ctx.currentTime;
    this.reverbSend.gain.setTargetAtTime(fx.reverbMix / 100 * 0.8, t, 0.05);
    this.chorusMixGain.gain.setTargetAtTime(fx.chorusMix / 100, t, 0.05);
    this.delayMix.gain.setTargetAtTime(fx.delayMix / 100 * 0.5, t, 0.05);
    this.waveshaper.curve = distCurve(fx.distDrive / 100);
    const db = -60 + (fx.compThreshold / 100) * 60;
    this.compressor.threshold.setTargetAtTime(db, t, 0.05);
    // EQ
    this.eqLow.gain.setTargetAtTime(fx.eqLow ?? 0, t, 0.05);
    this.eqMid.gain.setTargetAtTime(fx.eqMid ?? 0, t, 0.05);
    this.eqHigh.gain.setTargetAtTime(fx.eqHigh ?? 0, t, 0.05);
    // Phaser
    this.phasLfo.frequency.setTargetAtTime(fx.phaserRate ?? 0.5, t, 0.05);
    this.phasLfoG.gain.setTargetAtTime(fx.phaserEnabled ? (fx.phaserDepth ?? 0.5) * 1500 : 0, t, 0.05);
    // Pre-filter
    if (fx.filterEnabled) {
      this.preFilter.frequency.setTargetAtTime(200 + (fx.filterCutoff ?? 100) / 100 * 19800, t, 0.05);
      this.preFilter.Q.setTargetAtTime((fx.filterRes ?? 0) / 100 * 20, t, 0.05);
    } else {
      this.preFilter.frequency.setTargetAtTime(20000, t, 0.05);
    }
  }

  setDelayTime(bpm: number): void {
    const dt = Math.min((60 / bpm) * 0.75, 0.99);
    this.delayNode.delayTime.setTargetAtTime(dt, this.ctx.currentTime, 0.05);
  }

  noteOn(note: number, velocity: number, slot: RealmSlot): void {
    const vel = velocity / 65535;
    this.setFx(slot.fx);
    const noteWithPitch = note + (slot.fx.pitchSemi ?? 0) + (slot.fx.halftimeEnabled ? -12 : 0);
    if (slot.kind === 'sample' && slot.sample.buffer) {
      this.triggerSample(noteWithPitch, vel, slot.sample);
    } else {
      const cfg = slot.kind === 'preset'
        ? { ...DEFAULT_OSC, volume: slot.preset.volume, pan: slot.preset.pan }
        : slot.osc;
      this.triggerOsc(noteWithPitch, vel, cfg);
    }
  }

  noteOff(note: number): void {
    const e = this.activeOscs.get(note);
    if (e) {
      const t = this.ctx.currentTime;
      e.gain.gain.cancelScheduledValues(t);
      e.gain.gain.setValueAtTime(e.gain.gain.value, t);
      e.gain.gain.linearRampToValueAtTime(0, t + 0.12);
      try { e.osc.stop(t + 0.14); } catch {}
      this.activeOscs.delete(note);
    }
    // Also stop any playing sample for this note
    const s = this.activeSamples.get(note);
    if (s) { try { s.stop(); } catch {} this.activeSamples.delete(note); }
  }

  dispose(): void {
    try { this.chorusLFO.stop(); } catch (_) {}
    try { this.phasLfo.stop(); } catch (_) {}
    this.activeOscs.forEach(({ osc }) => { try { osc.stop(); } catch (_) {} });
    this.activeSamples.forEach(s => { try { s.stop(); } catch (_) {} });
    this.activeOscs.clear(); this.activeSamples.clear();
  }

  private triggerOsc(note: number, vel: number, c: OscConfig): void {
    const ctx = this.ctx;
    const freq = 440 * Math.pow(2, (note + c.pitch - 69) / 12);
    const osc = ctx.createOscillator();
    osc.type = c.waveform; osc.frequency.value = freq; osc.detune.value = c.detune;

    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 200 + (c.filterCutoff / 100) * 18000;
    flt.Q.value = (c.filterRes / 100) * 20;

    const pan = ctx.createStereoPanner(); pan.pan.value = c.pan;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const atk = Math.max((c.attack / 100) * 2, 0.002);
    const dec = (c.decay / 100);
    const sus = (c.sustain / 100) * vel * c.volume;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vel * c.volume, now + atk);
    gain.gain.linearRampToValueAtTime(sus, now + atk + dec);

    osc.connect(flt).connect(gain).connect(pan).connect(this.slotGain);
    osc.start(now);
    this.activeOscs.set(note, { osc, gain });
  }

  private triggerSample(note: number, vel: number, c: SampleConfig): void {
    if (!c.buffer) return;
    const ctx = this.ctx; const now = ctx.currentTime;
    this.activeSamples.get(note)?.stop();
    this.activeSamples.delete(note);
    const src = ctx.createBufferSource();
    src.buffer = c.buffer; src.loop = c.loop;
    src.playbackRate.value = Math.pow(2, (note - 60 + c.pitch) / 12);
    const pan  = ctx.createStereoPanner(); pan.pan.value = c.pan;
    const gain = ctx.createGain(); gain.gain.value = vel * c.volume;
    src.connect(gain).connect(pan).connect(this.slotGain);
    src.start(now);
    src.onended = () => this.activeSamples.delete(note);
    this.activeSamples.set(note, src);
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MultiRealmForgeProps {
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  showMessage?: (msg: string) => void;
  /** Whether the Multi-Realm tab is currently active — gates MIDI audio */
  isActiveTab?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const MultiRealmForge: React.FC<MultiRealmForgeProps> = ({
  parameterValues, update, showMessage, isActiveTab = true,
}) => {
  const initialSlots = useMemo(() => {
    try {
      const saved = localStorage.getItem('mrf_slots');
      if (saved) {
        const parsed: RealmSlot[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0)
          return parsed.map(s => ({ ...s, sample: { ...s.sample, file: null, buffer: null } }));
      }
    } catch (_) {}
    return Array.from({ length: 5 }, (_, i) => makeSlot(i));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [slots, setSlots]               = useState<RealmSlot[]>(initialSlots);
  const [playMode, setPlayMode]         = useState<PlayMode>(
    () => (localStorage.getItem('mrf_playMode') as PlayMode) || 'omni'
  );
  const [masterVol, setMasterVol]       = useState(0.85);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(initialSlots[0]?.id ?? null);
  const [expandedPanel, setExpandedPanel] = useState<'controls' | 'fx'>('controls');
  const [rrCursor, setRrCursor]         = useState(0);
  const [previewNote, setPreviewNote]   = useState<number | null>(null);
  const [pianoKeys, setPianoKeys]       = useState<Set<number>>(new Set());
  const [saveName, setSaveName]         = useState('');
  const [showSave, setShowSave]         = useState(false);
  const [showPresetBrowser, setShowPresetBrowser] = useState(false);
  // Browser source: which library to browse, the search query, the selected
  // Core Library category, and which slot a picked sound loads into.
  const [browserSource, setBrowserSource] = useState<'library' | 'vault' | 'multi'>('library');
  const [browserSearch, setBrowserSearch] = useState('');
  const [browserCat, setBrowserCat] = useState<string | null>(null);
  const [browserTargetSlot, setBrowserTargetSlot] = useState<string | null>(null);
  const [draggingSlot, setDraggingSlot] = useState<string | null>(null);
  const dragCounters  = useRef<Record<string, number>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const enginesRef    = useRef<Map<string, SlotEngine>>(new Map());
  const isActiveTabRef = useRef(isActiveTab);
  const bpm = parameterValues?.bpm ?? 120;
  const allPresets = useMemo(() => presetService.getAll(), []);
  // Detect multi-realm presets by the presence of layer data, so it works
  // regardless of the preset's `type` classification (now 'Multi-Realm').
  const multiPresets = useMemo(
    () => allPresets.filter(p => p.state?.params?.multiRealmSlots != null
      || p.type === 'Multi-Realm' || p.type === 'Multi-Preset'),
    [allPresets]);

  // ── Audio context ─────────────────────────────────────────────────────────
  const ensureCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      const ctx = audioEngine.ctx;
      const mgain = ctx.createGain(); mgain.gain.value = isActiveTabRef.current ? masterVol : 0;
      mgain.connect(audioEngine.masterBus);
      audioCtxRef.current   = ctx;
      masterGainRef.current = mgain;
    }
    audioEngine.resume();
    return audioCtxRef.current;
  }, [masterVol]);

  const getEngine = useCallback((slotId: string): SlotEngine => {
    const ctx = ensureCtx();
    let e = enginesRef.current.get(slotId);
    if (!e) { e = new SlotEngine(ctx, masterGainRef.current ?? ctx.destination); enginesRef.current.set(slotId, e); }
    return e;
  }, [ensureCtx]);

  useEffect(() => { if (isActiveTabRef.current) masterGainRef.current?.gain.setValueAtTime(masterVol, audioCtxRef.current?.currentTime ?? 0); }, [masterVol]);
  useEffect(() => { enginesRef.current.forEach(e => e.setDelayTime(bpm)); }, [bpm]);
  useEffect(() => () => { enginesRef.current.forEach(e => e.dispose()); audioCtxRef.current?.close().catch(() => {}); }, []);

  // ── Persist slots + playMode to localStorage on every change (tabs survive switching) ────
  useEffect(() => {
    // Keep fileName in the persisted record so IndexedDB reload works; strip live objects
    try { localStorage.setItem('mrf_slots', JSON.stringify(slots.map(s => ({ ...s, sample: { ...s.sample, file: null, buffer: null } })))); } catch (_) {}
  }, [slots]);
  useEffect(() => { try { localStorage.setItem('mrf_playMode', playMode); } catch (_) {} }, [playMode]);

  // ── Sync osc waveforms to native JUCE sampler ─────────────────────────────
  // When running inside JUCE, upload each synth slot's waveform as a looping
  // single-cycle buffer so native SacredSampler handles audio (no web bridge).
  useEffect(() => {
    slots.forEach((slot, idx) => {
      if (!slot.enabled) return;
      if (slot.kind === 'osc' || slot.kind === 'preset') {
        const wf = slot.osc.waveform as 'sine' | 'sawtooth' | 'square' | 'triangle';
        nativeAudio.loadOscWaveform(Math.min(idx, 7), wf);
      }
    });
  }, [slots]);

  // ── Reload cached audio buffers from IndexedDB on first mount ────────────
  // Slots are restored from localStorage (without live audio). This effect decodes
  // the audio from IndexedDB so the slot sounds play immediately on next load.
  useEffect(() => {
    let cancelled = false;
    async function restoreCachedBuffers() {
      const ctx = ensureCtx();
      for (const slot of initialSlots) {
        if (slot.kind !== 'sample' || !slot.sample.fileName) continue;
        const cacheKey = `mrf_audio_${slot.id}`;
        try {
          const result = await retrieveAudioBuffer(cacheKey, ctx);
          if (result && !cancelled) {
            setSlots(prev => prev.map(s =>
              s.id === slot.id && !s.sample.buffer
                ? { ...s, sample: { ...s.sample, buffer: result.buffer, fileName: result.fileName } }
                : s
            ));
          }
        } catch (_) {}
      }
    }
    restoreCachedBuffers();
    return () => { cancelled = true; };
  // Only run once on mount using initialSlots
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Restore Multi-Preset when loaded from Vault ────────────────────────
  useEffect(() => {
    const raw = parameterValues?.multiRealmSlots;
    if (!raw) return;
    try {
      const saved: RealmSlot[] = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length > 0) {
        setSlots(saved.map(s => ({ ...s, sample: { ...s.sample, file: null, buffer: null } })));
        const pm = parameterValues?.multiRealmPlayMode as PlayMode | undefined;
        if (pm) setPlayMode(pm);
        showMessage?.('MULTI-PRESET RESTORED');
      }
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameterValues?.multiRealmSlots]);

  // ── Dispatch ─────────────────────────────────────────────────────────────
  const activeSlots = useMemo(() => slots.filter(s => s.enabled), [slots]);

  const dispatchNote = useCallback((note: number, vel: number) => {
    if (!activeSlots.length) return;
    let targets: RealmSlot[];
    if (playMode === 'omni')          targets = activeSlots;
    else if (playMode === 'round-robin') { targets = [activeSlots[rrCursor % activeSlots.length]]; setRrCursor(c => (c + 1) % activeSlots.length); }
    else                              targets = [activeSlots[Math.floor(Math.random() * activeSlots.length)]];
    targets.forEach(s => getEngine(s.id).noteOn(note, vel, s));
  }, [activeSlots, playMode, rrCursor, getEngine]);

  const dispatchOff = useCallback((note: number) => {
    slots.forEach(s => enginesRef.current.get(s.id)?.noteOff(note));
  }, [slots]);

  useEffect(() => {
    // Keep isActiveTab accessible inside the listener without re-subscribing
    isActiveTabRef.current = isActiveTab;
  }, [isActiveTab]);

  // Strict tab isolation: only the active tab is audible. Mute the Multi-Realm
  // master when it isn't the displayed tab and silence any sounding voices, so
  // switching tabs never bleeds audio (matches the Electric Pantheon behavior).
  useEffect(() => {
    const mg = masterGainRef.current;
    const t = audioCtxRef.current?.currentTime ?? 0;
    if (mg) mg.gain.setTargetAtTime(isActiveTab ? masterVol : 0, t, 0.02);
    if (!isActiveTab) {
      try { enginesRef.current.forEach(e => (e as any).allNotesOff?.()); } catch {}
      setPianoKeys(new Set());
    }
  }, [isActiveTab, masterVol]);

  useEffect(() => {
    const unsub = neuralInputBus.addListener(ev => {
      if (!isActiveTabRef.current) return; // only fire when Multi-Realm is the active tab
      if (ev.type === 'midi_note_on' || (ev.type === 'midi' && ev.note !== undefined))
        dispatchNote(ev.note ?? 60, ev.velocity ?? 32768);
      else if (ev.type === 'midi_note_off')
        dispatchOff(ev.note ?? 60);
    });
    return unsub;
  }, [dispatchNote, dispatchOff]);

  // ── Slot CRUD ─────────────────────────────────────────────────────────────
  const addSlot      = useCallback(() => { if (slots.length >= 16) return; const s = makeSlot(slots.length); setSlots(p => [...p, s]); setExpandedSlot(s.id); }, [slots.length]);
  const removeSlot   = useCallback((id: string) => {
    enginesRef.current.get(id)?.dispose();
    enginesRef.current.delete(id);
    deleteCachedBuffer(`mrf_audio_${id}`).catch(() => {});
    setSlots(p => p.filter(s => s.id !== id));
  }, []);
  const dupSlot      = useCallback((id: string) => { setSlots(p => { const i = p.findIndex(s => s.id === id); if (i === -1) return p; const c: RealmSlot = { ...p[i], id: `slot-${Date.now()}-dup`, label: p[i].label + ' ✦' }; const n = [...p]; n.splice(i + 1, 0, c); return n; }); }, []);
  const patchSlot    = useCallback(<K extends keyof RealmSlot>(id: string, k: K, v: RealmSlot[K]) => setSlots(p => p.map(s => s.id === id ? { ...s, [k]: v } : s)), []);
  const patchOsc     = useCallback((id: string, k: keyof OscConfig,    v: any) => setSlots(p => p.map(s => s.id === id ? { ...s, osc:    { ...s.osc,    [k]: v } } : s)), []);
  const patchSample  = useCallback((id: string, k: keyof SampleConfig, v: any) => setSlots(p => p.map(s => s.id === id ? { ...s, sample: { ...s.sample, [k]: v } } : s)), []);
  const patchPreset  = useCallback((id: string, k: keyof PresetConfig, v: any) => setSlots(p => p.map(s => s.id === id ? { ...s, preset: { ...s.preset, [k]: v } } : s)), []);
  const patchFx      = useCallback((id: string, k: FxParamKey, v: number) => setSlots(p => p.map(s => { if (s.id !== id) return s; const nf = { ...s.fx, [k]: v }; enginesRef.current.get(id)?.setFx(nf); return { ...s, fx: nf }; })), []);
  const patchFxBool  = useCallback((id: string, k: FxBoolKey) => setSlots(p => p.map(s => { if (s.id !== id) return s; const nf = { ...s.fx, [k]: !s.fx[k] }; enginesRef.current.get(id)?.setFx(nf); return { ...s, fx: nf }; })), []);

  const pianoNoteOn  = useCallback((note: number) => {
    setPianoKeys(p => new Set(p).add(note));
    slots.forEach(s => { if (s.enabled) enginesRef.current.get(s.id)?.noteOn(note, 32767, s); });
  }, [slots]);

  const pianoNoteOff = useCallback((note: number) => {
    setPianoKeys(p => { const n = new Set(p); n.delete(note); return n; });
    enginesRef.current.forEach(e => e.noteOff(note));
  }, []);

  // ── Load vault preset ─────────────────────────────────────────────────────
  const loadVaultPreset = useCallback((slotId: string, preset: UnifiedPreset) => {
    const p = preset.state?.params ?? {};
    setSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s;
      return {
        ...s, kind: 'preset', label: preset.name.slice(0, 22),
        preset: { presetId: preset.id, presetName: preset.name, volume: 0.8, pan: 0 },
        osc: {
          ...s.osc,
          waveform:     ((p.waveform   ?? s.osc.waveform) as WaveType),
          attack:       p.attack       ?? s.osc.attack,
          decay:        p.decay        ?? s.osc.decay,
          sustain:      p.sustain      ?? s.osc.sustain,
          release:      p.release      ?? s.osc.release,
          filterCutoff: p.filterFreq   ?? s.osc.filterCutoff,
          filterRes:    p.filterQ      ?? s.osc.filterRes,
        },
        fx: { ...s.fx, reverbMix: p.reverbMix ?? s.fx.reverbMix, chorusMix: p.chorusMix ?? s.fx.chorusMix, delayMix: p.delayMix ?? s.fx.delayMix },
      };
    }));
    showMessage?.(`PRESET LOADED: ${preset.name}`);
  }, [showMessage]);

  // ── File loading ──────────────────────────────────────────────────────────
  const loadFile = useCallback(async (slotId: string, file: File) => {
    try {
      const ctx = ensureCtx();
      const raw = await file.arrayBuffer();
      // Feed the native sampler BEFORE decodeAudioData (which detaches the buffer).
      const slotIdxN = slots.findIndex(s => s.id === slotId);
      nativeAudio.loadSampleBytes(slotIdxN >= 0 ? Math.min(slotIdxN, 7) : 0, raw.slice(0));
      const buf = await ctx.decodeAudioData(raw);
      const cacheKey = `mrf_audio_${slotId}`;
      await cacheAudioBuffer(cacheKey, file.name, buf);
      patchSample(slotId, 'file', file);
      patchSample(slotId, 'buffer', buf);
      patchSample(slotId, 'fileName', file.name);
      patchSlot(slotId, 'kind', 'sample');
      patchSlot(slotId, 'label', file.name.replace(/\.[^.]+$/, '').slice(0, 22) as unknown as RealmSlot['label']);
      showMessage?.(`LOADED: ${file.name}`);

      // Send to JUCE native sampler so DAW MIDI playback works without web audio roundtrip.
      // Slot index = position in current slots array (0-based, max 7 for JUCE).
      const slotIdx = slots.findIndex(s => s.id === slotId);
      const juceSlotIdx = slotIdx >= 0 ? Math.min(slotIdx, 7) : 0;
      const filePath = (file as any).path as string | undefined;
      if (filePath) {
        try {
          nativeAudio.dispatch({
            type: 'LOAD_SAMPLE',
            payload: { trackIdx: juceSlotIdx, filePath },
          });
        } catch {}
      }
    } catch { showMessage?.('Could not decode audio file'); }
  }, [ensureCtx, patchSlot, patchSample, showMessage, slots]);

  const loadFileFromPath = useCallback(async (slotId: string, filePath: string, filename: string, slotIdxN: number): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const id = `mrf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      const done = (success: boolean) => {
        clearTimeout(timer);
        if ((window as any).__godRealmPendingFiles) {
          delete (window as any).__godRealmPendingFiles[id];
        }
        resolve(success);
      };

      const timer = setTimeout(() => {
        if ((window as any).__godRealmPendingFiles) {
          delete (window as any).__godRealmPendingFiles[id];
        }
        const url = 'file:///' + filePath.replace(/\\/g, '/');
        fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject())
          .then(async (arr) => {
            const ctx = ensureCtx();
            nativeAudio.loadSampleBytes(slotIdxN, arr.slice(0));
            const buf = await ctx.decodeAudioData(arr);
            const cacheKey = `mrf_audio_${slotId}`;
            await cacheAudioBuffer(cacheKey, filename, buf);
            patchSample(slotId, 'file', null);
            patchSample(slotId, 'buffer', buf);
            patchSample(slotId, 'fileName', filename);
            patchSlot(slotId, 'kind', 'sample');
            patchSlot(slotId, 'label', filename.replace(/\.[^.]+$/, '').slice(0, 22) as any);
            done(true);
          })
          .catch(() => done(false));
      }, 3000);

      if (!(window as any).__godRealmPendingFiles) (window as any).__godRealmPendingFiles = {};
      (window as any).__godRealmPendingFiles[id] = async (b64: string) => {
        try {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const ctx = ensureCtx();
          nativeAudio.loadSampleBytes(slotIdxN, bytes.buffer.slice(0));
          const buf = await ctx.decodeAudioData(bytes.buffer);
          const cacheKey = `mrf_audio_${slotId}`;
          await cacheAudioBuffer(cacheKey, filename, buf);
          patchSample(slotId, 'file', null);
          patchSample(slotId, 'buffer', buf);
          patchSample(slotId, 'fileName', filename);
          patchSlot(slotId, 'kind', 'sample');
          patchSlot(slotId, 'label', filename.replace(/\.[^.]+$/, '').slice(0, 22) as any);
          done(true);
        } catch { done(false); }
      };

      try {
        nativeAudio.dispatch({ type: 'LOAD_FILE_PATH', payload: { path: filePath, id } });
      } catch {
        done(false);
      }
    });
  }, [ensureCtx, patchSlot, patchSample]);

  // ── Load a Core Library sample into a slot ─────────────────────────────────
  const loadCoreLibSound = useCallback(async (slotId: string, category: string, sample: { name: string; file: string }) => {
    const slotIdxN = slots.findIndex(s => s.id === slotId);
    const targetIdx = slotIdxN >= 0 ? Math.min(slotIdxN, 7) : 0;

    let ok = false;
    if (coreLibraryFS.isLocated) {
      try {
        const bytes = await coreLibraryFS.getFileBuffer(category, sample.file);
        if (bytes) {
          const ctx = ensureCtx();
          nativeAudio.loadSampleBytes(targetIdx, bytes.slice(0));
          const buf = await ctx.decodeAudioData(bytes.slice(0));
          const cacheKey = `mrf_audio_${slotId}`;
          await cacheAudioBuffer(cacheKey, sample.file, buf);
          patchSample(slotId, 'file', null);
          patchSample(slotId, 'buffer', buf);
          patchSample(slotId, 'fileName', sample.file);
          patchSlot(slotId, 'kind', 'sample');
          patchSlot(slotId, 'label', sample.name.slice(0, 22) as any);
          showMessage?.(`LOADED: ${sample.name} → ${slotId}`);
          ok = true;
        }
      } catch {}
    }

    if (!ok) {
      const customLibraryRoot = (() => {
        try { return localStorage.getItem('vst-god-library-root') || null; } catch { return null; }
      })();
      const roots = customLibraryRoot
        ? [customLibraryRoot, ...CORE_LIBRARY_ROOTS.filter(r => r !== customLibraryRoot)]
        : CORE_LIBRARY_ROOTS;

      for (const root of roots) {
        const filePath = `${root}\\${category}\\${sample.file}`;
        ok = await loadFileFromPath(slotId, filePath, sample.file, targetIdx);
        if (ok) {
          showMessage?.(`LOADED: ${sample.name} → ${slotId}`);
          break;
        }
      }
    }

    if (!ok) {
      showMessage?.(`Could not load "${sample.file}" — locate the Core Library or drag-drop the file`);
    }
  }, [ensureCtx, patchSlot, patchSample, showMessage, slots, loadFileFromPath]);


  const handleDrop = useCallback((slotId: string, e: React.DragEvent) => {
    e.preventDefault(); dragCounters.current[slotId] = 0; setDraggingSlot(null);
    const f = Array.from(e.dataTransfer.files).find(f => /\.(wav|mp3|ogg|flac|aiff?)$/i.test(f.name));
    if (f) loadFile(slotId, f);
  }, [loadFile]);

  const handleFileInput = useCallback((slotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) loadFile(slotId, f); e.target.value = '';
  }, [loadFile]);

  // ── Preview ───────────────────────────────────────────────────────────────
  const previewKey = useCallback((note: number) => {
    ensureCtx(); dispatchNote(note, 50000); setPreviewNote(note);
    setTimeout(() => { dispatchOff(note); setPreviewNote(null); }, 700);
  }, [ensureCtx, dispatchNote, dispatchOff]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const doSave = useCallback(() => {
    presetService.saveAs({
      name: saveName.trim() || 'My Multi-Realm', type: 'Multi-Realm', tags: ['Multi-Preset','Multi-Realm','Layered'],
      // Preserve fileName so the receiver can look up IndexedDB; strip live File/Buffer objects
      state: { params: { multiRealmSlots: JSON.stringify(slots.map(s => ({ ...s, sample: { ...s.sample, file: null, buffer: null } }))), multiRealmPlayMode: playMode } },
    });
    setShowSave(false); setSaveName('');
    showMessage?.(`SAVED TO VAULT: "${saveName || 'My Multi-Realm'}"`);
  }, [saveName, slots, playMode, showMessage]);

  const doQuickSave = useCallback(() => {
    const name = `Quick Save ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    presetService.saveAs({
      name, type: 'Multi-Realm', tags: ['Multi-Preset','Multi-Realm','Quick'],
      state: { params: { multiRealmSlots: JSON.stringify(slots.map(s => ({ ...s, sample: { ...s.sample, file: null, buffer: null } }))), multiRealmPlayMode: playMode } },
    });
    showMessage?.(`QUICK SAVED: "${name}"`);
  }, [slots, playMode, showMessage]);

  const loadMultiPreset = useCallback((preset: ReturnType<typeof presetService.getAll>[0]) => {
    try {
      const p = preset.state?.params ?? {};
      if (p.multiRealmSlots) {
        const saved: RealmSlot[] = JSON.parse(p.multiRealmSlots);
        if (Array.isArray(saved) && saved.length > 0) {
          const restoredSlots = saved.map(s => ({ ...s, sample: { ...s.sample, file: null, buffer: null } }));
          setSlots(restoredSlots);
          if (p.multiRealmPlayMode) setPlayMode(p.multiRealmPlayMode as PlayMode);
          setShowPresetBrowser(false);
          showMessage?.(`LOADED: "${preset.name}"`);

          // Async-reload audio buffers from IndexedDB for sample slots
          const ctx = ensureCtx();
          restoredSlots.forEach(async (slot) => {
            if (slot.kind !== 'sample' || !slot.sample.fileName) return;
            const cacheKey = `mrf_audio_${slot.id}`;
            try {
              const result = await retrieveAudioBuffer(cacheKey, ctx);
              if (result) {
                setSlots(prev => prev.map(s =>
                  s.id === slot.id && !s.sample.buffer
                    ? { ...s, sample: { ...s.sample, buffer: result.buffer } }
                    : s
                ));
              }
            } catch (_) {}
          });
        }
      }
    } catch (_) {}
  }, [showMessage, ensureCtx]);

  // ── Drag a browser item onto a slot ────────────────────────────────────────
  // Browser rows call setDragPayload on dragstart; the slot drop handler reads it.
  // We keep the payload in a ref (dataTransfer string can be unreliable across
  // some embedded webviews, and this also lets us carry rich objects).
  const dragPayloadRef = useRef<any>(null);
  const onSlotDrop = useCallback((slotId: string, e: React.DragEvent) => {
    e.preventDefault();
    dragCounters.current[slotId] = 0;
    setDraggingSlot(null);

    // 1) A sound/preset dragged from the in-app browser
    const payload = dragPayloadRef.current;
    if (payload) {
      dragPayloadRef.current = null;
      if (payload.kind === 'library') loadCoreLibSound(slotId, payload.category, payload.sample);
      else if (payload.kind === 'vault') loadVaultPreset(slotId, payload.preset);
      else if (payload.kind === 'multi') loadMultiPreset(payload.preset);
      return;
    }

    // 2) An audio file dragged from the OS
    const f = Array.from(e.dataTransfer.files).find(f => /\.(wav|mp3|ogg|flac|aiff?)$/i.test(f.name));
    if (f) loadFile(slotId, f);
  }, [loadCoreLibSound, loadVaultPreset, loadMultiPreset, loadFile]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(180deg,#09090f 0%,#070710 100%)', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", userSelect: 'none' }}>

      {/* HEADER */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.45)' }}>
        <Layers size={14} style={{ color: '#f59e0b' }} />
        <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.15em', color: '#fff', textTransform: 'uppercase' }}>Multi-Realm Forge</span>

        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'rgba(0,0,0,0.4)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', marginLeft: 6 }}>
          {([['omni','OMNI',Layers],['round-robin','ROUND ROBIN',ArrowLeftRight],['random','RANDOM',Shuffle]] as [PlayMode, string, React.ElementType][]).map(([id, lbl, Icon]) => (
            <button key={id} onClick={() => setPlayMode(id)}
              style={{ display:'flex', alignItems:'center', gap: 5, padding:'4px 10px', borderRadius: 7, border:'none', cursor:'pointer', fontWeight: 800, fontSize: 9, letterSpacing:'0.1em', textTransform:'uppercase', transition:'all 0.15s', background: playMode === id ? '#f59e0b':'transparent', color: playMode === id ? '#000':'rgba(255,255,255,0.38)' }}
            >{React.createElement(Icon as any, { size: 9 })}{lbl}</button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Test keys */}
        <div style={{ display:'flex', alignItems:'center', gap: 3 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform:'uppercase', marginRight: 4 }}>Play</span>
          {([60,62,64,65,67,69,71,72] as const).map((note, ni) => (
            <button key={note} onMouseDown={() => previewKey(note)}
              style={{ width:26, height:26, borderRadius:5, border:`1px solid ${previewNote===note?'#f59e0b':'rgba(255,255,255,0.1)'}`, cursor:'pointer', fontWeight:800, fontSize:8, background: previewNote===note?'#f59e0b':'rgba(255,255,255,0.04)', color: previewNote===note?'#000':'rgba(255,255,255,0.45)', transition:'all 0.1s' }}
            >{['C','D','E','F','G','A','B','C'][ni]}</button>
          ))}
        </div>

        {/* Vol + Save */}
        <div style={{ display:'flex', alignItems:'center', gap: 8, paddingLeft: 12, borderLeft:'1px solid rgba(255,255,255,0.07)' }}>
          <Volume2 size={11} style={{ color:'rgba(255,255,255,0.72)' }} />
          <input type="range" min={0} max={1} step={0.01} value={masterVol} onChange={e => setMasterVol(+e.target.value)} style={{ width:68, accentColor:'#f59e0b', cursor:'pointer' }} />
          {/* Whole-rig multi-presets (per-sound browsing now lives in each slot) */}
          <button onClick={() => { setBrowserSource('multi'); setShowPresetBrowser(p => !p); }}
            title="Load or save a whole 4-layer rig"
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px', background: (showPresetBrowser && browserSource==='multi')?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.05)', border:`1px solid ${(showPresetBrowser && browserSource==='multi')?'rgba(245,158,11,0.5)':'rgba(255,255,255,0.15)'}`, borderRadius:7, fontSize: 10, fontWeight:700, cursor:'pointer', color: (showPresetBrowser && browserSource==='multi')?'#fbbf24':'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
            <Package size={9}/> Rigs {multiPresets.length > 0 && `(${multiPresets.length})`}
          </button>
          {showSave ? (
            <div style={{ display:'flex', gap:4 }}>
              <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} onKeyDown={e => { if(e.key==='Enter') doSave(); if(e.key==='Escape') setShowSave(false); }} placeholder="Name…" autoFocus
                style={{ width:100, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:6, padding:'3px 8px', fontSize: 11, color:'#fff', outline:'none' }} />
              <button onClick={doSave} style={{ padding:'3px 8px', background:'#f59e0b', border:'none', borderRadius:6, fontSize: 10, fontWeight:900, cursor:'pointer', color:'#000', textTransform:'uppercase' }}>Save</button>
            </div>
          ) : (
            <button onClick={() => setShowSave(true)} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:7, fontSize: 10, fontWeight:700, cursor:'pointer', color:'rgba(255,255,255,0.88)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              <Save size={9}/> Save
            </button>
          )}
        </div>
      </div>

      {/* ── SOUND BROWSER (Core Library + Preset Vault + Multi-Presets) ─────── */}
      {showPresetBrowser && (() => {
        const targetId = browserTargetSlot ?? slots[0]?.id ?? null;
        const q = browserSearch.trim().toLowerCase();
        const vaultSounds = allPresets.filter(p => !p.state?.params?.multiRealmSlots
          && (!q || p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)
            || p.tags.some(t => t.toLowerCase().includes(q))));
        const libCats = Object.keys(CORE_LIBRARY);
        const libSamples = browserCat
          ? (CORE_LIBRARY[browserCat] ?? []).filter(s => !q || s.name.toLowerCase().includes(q))
          : [];
        const rowStyle: React.CSSProperties = { display:'flex', alignItems:'center', gap:8, padding:'5px 10px', borderRadius:6, cursor:'pointer', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', transition:'all 0.12s' };
        const hov = (on: boolean) => (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = on ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)');
        return (
        <div style={{ flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.55)', display:'flex', flexDirection:'column', maxHeight:300 }}>
          {/* Source tabs + target slot + close */}
          <div style={{ padding:'6px 12px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display:'flex', gap:2, padding:2, background:'rgba(0,0,0,0.4)', borderRadius:7, border:'1px solid rgba(255,255,255,0.08)' }}>
              {([['library','Core Library'],['vault','Preset Vault'],['multi','Multi-Presets']] as [typeof browserSource, string][]).map(([id,lbl]) => (
                <button key={id} onClick={() => { setBrowserSource(id); setBrowserCat(null); }}
                  style={{ padding:'3px 9px', borderRadius:5, border:'none', cursor:'pointer', fontSize:9, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', background: browserSource===id?'#f59e0b':'transparent', color: browserSource===id?'#000':'rgba(255,255,255,0.45)' }}>
                  {lbl}
                </button>
              ))}
            </div>
            <div style={{ flex:1 }} />
            <span style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' }}>Load into</span>
            <select value={targetId ?? ''} onChange={e => setBrowserTargetSlot(e.target.value)}
              style={{ background:'rgba(0,0,0,0.5)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:6, padding:'3px 6px', fontSize:10, color:'#fbbf24', cursor:'pointer', outline:'none' }}>
              {slots.map((s, i) => <option key={s.id} value={s.id} style={{ background:'#111' }}>Layer {i+1}</option>)}
            </select>
            <button onClick={() => setShowPresetBrowser(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', fontSize:14, lineHeight:1 }}>✕</button>
          </div>

          {/* Search */}
          <div style={{ padding:'6px 12px 4px' }}>
            <input value={browserSearch} onChange={e => setBrowserSearch(e.target.value)}
              placeholder={browserSource==='library' ? (browserCat ? `Search ${browserCat}…` : 'Search a category below…') : 'Search presets…'}
              style={{ width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:6, padding:'5px 10px', color:'#fff', fontSize:11, outline:'none' }} />
          </div>

          {/* Body */}
          <div style={{ flex:1, overflowY:'auto', padding:'4px 8px 8px' }}>
            {browserSource === 'multi' && (
              multiPresets.length === 0
                ? <div style={{ padding:'12px 16px', fontSize:10, color:'rgba(255,255,255,0.3)', textAlign:'center' }}>No Multi-Presets saved yet. Use Save above.</div>
                : <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {multiPresets.filter(p => !q || p.name.toLowerCase().includes(q)).map(p => (
                      <div key={p.id} draggable
                        onDragStart={e => { dragPayloadRef.current = { kind:'multi', preset: p }; e.dataTransfer.effectAllowed='copy'; e.dataTransfer.setData('text/plain', p.name); }}
                        onClick={() => loadMultiPreset(p)} style={{ ...rowStyle, cursor:'grab' }} onMouseEnter={hov(true)} onMouseLeave={hov(false)}>
                        <Layers size={10} style={{ color:'#f59e0b', flexShrink:0 }} />
                        <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.82)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                        <button onClick={e=>{e.stopPropagation(); loadMultiPreset(p);}} style={{ padding:'2px 7px', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:5, fontSize:8, fontWeight:800, cursor:'pointer', color:'#fbbf24', textTransform:'uppercase' }}>LOAD ALL</button>
                      </div>
                    ))}
                  </div>
            )}

            {browserSource === 'vault' && (
              vaultSounds.length === 0
                ? <div style={{ padding:'12px 16px', fontSize:10, color:'rgba(255,255,255,0.3)', textAlign:'center' }}>No presets match.</div>
                : <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {vaultSounds.map(p => (
                      <div key={p.id} draggable
                        onDragStart={e => { dragPayloadRef.current = { kind:'vault', preset: p }; e.dataTransfer.effectAllowed='copy'; e.dataTransfer.setData('text/plain', p.name); }}
                        onClick={() => targetId && loadVaultPreset(targetId, p)} style={{ ...rowStyle, cursor:'grab' }} onMouseEnter={hov(true)} onMouseLeave={hov(false)}>
                        <Package size={10} style={{ color:'#a78bfa', flexShrink:0 }} />
                        <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.82)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                        <span style={{ fontSize:8, color:'rgba(255,255,255,0.3)', textTransform:'uppercase' }}>{p.type}</span>
                        <button onClick={e=>{e.stopPropagation(); targetId && loadVaultPreset(targetId, p);}} style={{ padding:'2px 7px', background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.3)', borderRadius:5, fontSize:8, fontWeight:800, cursor:'pointer', color:'#c4b5fd', textTransform:'uppercase' }}>LOAD</button>
                      </div>
                    ))}
                  </div>
            )}

            {browserSource === 'library' && (
              !browserCat ? (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(92px,1fr))', gap:6, padding:'2px 4px' }}>
                  {libCats.map(cat => (
                    <button key={cat} onClick={() => { setBrowserCat(cat); setBrowserSearch(''); }}
                      style={{ padding:'9px 6px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', cursor:'pointer', color:'rgba(255,255,255,0.72)', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(245,158,11,0.4)'; e.currentTarget.style.background='rgba(245,158,11,0.07)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; e.currentTarget.style.background='rgba(255,255,255,0.03)';}}>
                      {cat}
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginTop:2 }}>{(CORE_LIBRARY[cat]||[]).length}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <button onClick={() => setBrowserCat(null)} style={{ alignSelf:'flex-start', margin:'0 0 4px 4px', padding:'2px 8px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:5, fontSize:9, color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>← Categories</button>
                  {!coreLibraryFS.isLocated && (
                    <div style={{ padding:'8px 12px', margin:'0 4px 4px', fontSize:9, color:'#fbbf24', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:6 }}>
                      Core Library not located — open Preset Vault → Core Library → LOCATE to enable loading.
                    </div>
                  )}
                  {libSamples.length === 0
                    ? <div style={{ padding:'10px 16px', fontSize:10, color:'rgba(255,255,255,0.3)', textAlign:'center' }}>No samples match.</div>
                    : libSamples.map(s => (
                        <div key={s.file} draggable
                          onDragStart={e => { dragPayloadRef.current = { kind:'library', category: browserCat, sample: s }; e.dataTransfer.effectAllowed='copy'; e.dataTransfer.setData('text/plain', s.name); }}
                          onClick={() => targetId && loadCoreLibSound(targetId, browserCat, s)} style={{ ...rowStyle, cursor:'grab' }} onMouseEnter={hov(true)} onMouseLeave={hov(false)}>
                          <Music size={10} style={{ color:'#34d399', flexShrink:0 }} />
                          <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.82)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
                          <button onClick={e=>{e.stopPropagation(); targetId && loadCoreLibSound(targetId, browserCat, s);}} style={{ padding:'2px 7px', background:'rgba(52,211,153,0.15)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:5, fontSize:8, fontWeight:800, cursor:'pointer', color:'#6ee7b7', textTransform:'uppercase' }}>LOAD</button>
                        </div>
                      ))}
                </div>
              )
            )}
          </div>
        </div>
        );
      })()}

      {/* SLOT GRID */}
      <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <AnimatePresence initial={false}>
          {slots.map(slot => {
            const isExp  = expandedSlot === slot.id;
            const isDrag = draggingSlot === slot.id;
            return (
              <motion.div key={slot.id} layout
                initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.94 }}
                style={{ borderRadius:12, border:`2px solid ${isDrag?'#f59e0b':isExp?slot.color:'rgba(255,255,255,0.07)'}`, background: isDrag?'rgba(245,158,11,0.06)':isExp?`${slot.color}0d`:'rgba(255,255,255,0.015)', overflow:'hidden', transition:'border-color 0.2s, background 0.2s', display:'flex', flexDirection:'column', minHeight: 180 }}
                onDragEnter={e=>{ e.preventDefault(); dragCounters.current[slot.id]=(dragCounters.current[slot.id]??0)+1; setDraggingSlot(slot.id); }}
                onDragOver={e=>e.preventDefault()}
                onDragLeave={()=>{ if((dragCounters.current[slot.id]=(dragCounters.current[slot.id]??1)-1)===0) setDraggingSlot(null); }}
                onDrop={e=>onSlotDrop(slot.id,e)}
              >
                {/* HEADER ROW */}
                <div onClick={()=>setExpandedSlot(isExp?null:slot.id)} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', cursor:'pointer' }}>
                  <div style={{ width:3, height:22, borderRadius:2, background:slot.color, flexShrink:0 }} />
                  <button onClick={e=>{e.stopPropagation(); patchSlot(slot.id,'enabled',!slot.enabled as unknown as RealmSlot['enabled']);}} style={{ background:'none', border:'none', cursor:'pointer', padding:2, color:slot.enabled?'rgba(255,255,255,0.75)':'rgba(255,255,255,0.18)', flexShrink:0 }}>
                    <Power size={11}/>
                  </button>
                  <span style={{ fontSize:8, fontWeight:900, padding:'2px 6px', borderRadius:4, textTransform:'uppercase', letterSpacing:'0.08em', flexShrink:0, background: slot.kind==='osc'?'rgba(168,85,247,0.18)':slot.kind==='sample'?'rgba(59,130,246,0.18)':'rgba(245,158,11,0.18)', color: slot.kind==='osc'?'#c084fc':slot.kind==='sample'?'#60a5fa':'#fbbf24' }}>
                    {slot.kind==='osc'?'OSC':slot.kind==='sample'?'SMPL':'PRE'}
                  </span>
                  <span style={{ fontSize:13, fontWeight:700, color:slot.enabled?'rgba(255,255,255,0.88)':'rgba(255,255,255,0.22)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{slot.label}</span>
                  {/* Volume knob */}
                  <div onClick={e=>e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:7, color:'rgba(255,255,255,0.44)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>VOL</span>
                    <input
                      type="range" min={0} max={1} step={0.01}
                      value={slot.kind==='sample'?slot.sample.volume:slot.kind==='preset'?slot.preset.volume:slot.osc.volume}
                      onChange={e=>{
                        const v = parseFloat(e.target.value);
                        if (slot.kind==='sample') patchSample(slot.id,'volume',v);
                        else if (slot.kind==='preset') patchPreset(slot.id,'volume',v);
                        else patchOsc(slot.id,'volume',v);
                      }}
                      style={{ width:50, accentColor: slot.color, cursor:'pointer' }}
                    />
                    <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)', minWidth:22 }}>
                      {Math.round((slot.kind==='sample'?slot.sample.volume:slot.kind==='preset'?slot.preset.volume:slot.osc.volume)*100)}%
                    </span>
                  </div>
                  {/* Kind switcher — OSC and SMP only (preset loading now done inside SMP) */}
                  <div onClick={e=>e.stopPropagation()} style={{ display:'flex', gap:2, background:'rgba(0,0,0,0.3)', borderRadius:6, padding:2 }}>
                    {(['osc','sample'] as SlotKind[]).map(k=>(
                      <button key={k} onClick={()=>patchSlot(slot.id,'kind',k as RealmSlot['kind'])} style={{ padding:'2px 7px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, fontWeight:800, textTransform:'uppercase', background:slot.kind===k?'rgba(255,255,255,0.16)':'transparent', color:slot.kind===k?'#fff':'rgba(255,255,255,0.38)' }}>{k==='osc'?'OSC':'SMP'}</button>
                    ))}
                  </div>
                  <div onClick={e=>e.stopPropagation()} style={{ display:'flex', gap:1, alignItems:'center' }}>
                    <button
                      onClick={()=>{ setBrowserTargetSlot(slot.id); setBrowserSource('library'); setShowPresetBrowser(true); }}
                      title="Browse Core Library & Preset Vault for this layer"
                      style={{ display:'flex', alignItems:'center', gap:3, padding:'3px 7px', marginRight:2, borderRadius:5, border:`1px solid ${slot.color}55`, background:`${slot.color}14`, color:slot.color, cursor:'pointer', fontSize:8, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.06em' }}
                    ><Search size={9}/> Browse</button>
                    <button onClick={()=>dupSlot(slot.id)} title="Duplicate" style={{ background:'none', border:'none', cursor:'pointer', padding:3, color:'rgba(255,255,255,0.55)' }}><Copy size={10}/></button>
                    {slots.length>1&&<button onClick={()=>removeSlot(slot.id)} title="Remove" style={{ background:'none', border:'none', cursor:'pointer', padding:3, color:'rgba(255,255,255,0.55)' }}><Trash2 size={10}/></button>}
                    {isExp?<ChevronUp size={12} style={{color:'rgba(255,255,255,0.7)'}}/>:<ChevronDown size={12} style={{color:'rgba(255,255,255,0.7)'}}/>}
                  </div>
                </div>

                {/* WAVEFORM DISPLAY — always visible when sample/preset has audio */}
                {slot.kind === 'sample' && slot.sample.buffer && (
                  <div style={{ background: 'rgba(0,0,0,0.45)', borderTop: '1px solid rgba(255,255,255,0.04)', padding: '6px 10px 4px' }}>
                    <WaveformCanvas buffer={slot.sample.buffer} color={slot.color} height={110} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                        {slot.sample.fileName || 'Audio'}
                      </span>
                      <span style={{ fontSize: 8, color: `${slot.color}99`, fontWeight: 700, flexShrink: 0 }}>
                        {slot.sample.buffer.duration.toFixed(2)}s · {(slot.sample.buffer.sampleRate/1000).toFixed(1)}kHz
                      </span>
                    </div>
                  </div>
                )}

                {/* EXPANDED DETAIL */}
                <AnimatePresence>
                  {isExp && (
                    <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} style={{overflow:'hidden',borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                      <div style={{ padding:14, overflowY:'auto', maxHeight:300 }}>
                        {/* Sub-tab bar */}
                        <div style={{ display:'flex', gap:3, marginBottom:12 }}>
                          {(['controls','fx'] as const).map(tab=>(
                            <button key={tab} onClick={()=>setExpandedPanel(tab)} style={{ padding:'4px 12px', borderRadius:7, border:'none', cursor:'pointer', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', background:expandedPanel===tab?'rgba(255,255,255,0.11)':'transparent', color:expandedPanel===tab?'#fff':'rgba(255,255,255,0.32)' }}>
                              {tab==='controls'?'✦ SYNTH':'⚡ FX CHAIN'}
                            </button>
                          ))}
                        </div>
                        {expandedPanel==='controls' && (
                          <>
                            {slot.kind==='osc'    && <OscPanel    osc={slot.osc}    onChange={(k,v)=>patchOsc(slot.id,k,v)}    color={slot.color}/>}
                            {slot.kind==='sample' && (
                              <>
                                <SamplePanel sample={slot.sample} slotId={slot.id} color={slot.color} isDrag={isDrag}
                                  fileRef={el=>{fileInputRefs.current[slot.id]=el;}}
                                  onChange={(k,v)=>patchSample(slot.id,k,v)}
                                  onInput={e=>handleFileInput(slot.id,e)}
                                  onBrowse={()=>fileInputRefs.current[slot.id]?.click()} />
                                <div style={{ marginTop:10, padding:'8px 0', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.44)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>Load from Preset Vault</span>
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, maxHeight:120, overflowY:'auto' }}>
                                    {allPresets.slice(0,40).map(p=>(
                                      <button key={p.id} onClick={()=>loadVaultPreset(slot.id,p)}
                                        style={{ padding:'3px 7px', borderRadius:5, border:`1px solid ${slot.color}44`, background:`${slot.color}11`, color:slot.color, fontSize:8, fontWeight:800, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
                                        {p.name.slice(0,18)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                        {expandedPanel==='fx' && <FxPanel fx={slot.fx} onChange={(k,v)=>patchFx(slot.id,k,v)} onToggle={k=>patchFxBool(slot.id,k)} color={slot.color}/>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {slots.length < 16 && (
          <button onClick={addSlot}
            style={{ width:'100%', padding:'10px 0', borderRadius:10, border:'1px dashed rgba(255,255,255,0.1)', background:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, color:'rgba(255,255,255,0.28)', fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em' }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(245,158,11,0.4)';(e.currentTarget as HTMLButtonElement).style.color='#f59e0b';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,0.1)';(e.currentTarget as HTMLButtonElement).style.color='rgba(255,255,255,0.28)';}}
          ><Plus size={12}/> Add Layer</button>
        )}
      </div>

      <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:12, padding:'4px 16px', borderTop:'1px solid rgba(255,255,255,0.05)', background:'rgba(0,0,0,0.3)' }}>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)', fontStyle:'italic' }}>Drop audio · choose vault preset · or pick OSC</span>
      </div>
    </div>
  );
};

// ─── Sub-panels ────────────────────────────────────────────────────────────────

const WAVES: WaveType[] = ['sine','sawtooth','square','triangle'];
const WAVE_LBL: Record<WaveType,string> = { sine:'SIN', sawtooth:'SAW', square:'SQR', triangle:'TRI' };

const OscPanel: React.FC<{ osc: OscConfig; onChange: (k: keyof OscConfig, v: any)=>void; color: string }> = ({ osc, onChange, color }) => (
  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
    <div>
      <RowLabel>Waveform</RowLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, marginTop:5 }}>
        {WAVES.map(w=>(
          <button key={w} onClick={()=>onChange('waveform',w)} style={{ padding:'5px 0', borderRadius:6, border:'none', cursor:'pointer', fontSize:9, fontWeight:900, background:osc.waveform===w?color:'rgba(255,255,255,0.07)', color:osc.waveform===w?'#000':'rgba(255,255,255,0.45)' }}>{WAVE_LBL[w]}</button>
        ))}
      </div>
    </div>
    <div>
      <RowLabel>Tune</RowLabel>
      <SliderRow label="PITCH" min={-24} max={24} step={1} val={osc.pitch}  unit="st" onChange={v=>onChange('pitch',v)}/>
      <SliderRow label="FINE"  min={0}   max={100}        val={osc.detune}            onChange={v=>onChange('detune',v)}/>
    </div>
    <div style={{ gridColumn:'span 2' }}>
      <RowLabel>Envelope</RowLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:5 }}>
        {(['attack','decay','sustain','release'] as const).map(k=>(
          <SliderRow key={k} label={k.slice(0,3).toUpperCase()} min={0} max={100} val={osc[k]} onChange={v=>onChange(k,v)}/>
        ))}
      </div>
    </div>
    <div><RowLabel>Filter</RowLabel>
      <SliderRow label="CUT" min={0} max={100} val={osc.filterCutoff} onChange={v=>onChange('filterCutoff',v)}/>
      <SliderRow label="RES" min={0} max={100} val={osc.filterRes}    onChange={v=>onChange('filterRes',v)}/>
    </div>
    <div><RowLabel>Output</RowLabel>
      <SliderRow label="VOL" min={0} max={1} step={0.01} val={osc.volume} onChange={v=>onChange('volume',v)}/>
      <SliderRow label="PAN" min={-1} max={1} step={0.01} val={osc.pan}   onChange={v=>onChange('pan',v)}/>
    </div>
  </div>
);

const SamplePanel: React.FC<{
  sample: SampleConfig; slotId: string; color: string; isDrag: boolean;
  fileRef: React.RefCallback<HTMLInputElement>;
  onChange: (k: keyof SampleConfig, v: any)=>void;
  onInput: (e: React.ChangeEvent<HTMLInputElement>)=>void;
  onBrowse: ()=>void;
}> = ({ sample, color, isDrag, fileRef, onChange, onInput, onBrowse }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
    {!sample.buffer ? (
      <div onClick={onBrowse} style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, padding:20, borderRadius:10, border:`2px dashed ${isDrag?'#f59e0b':'rgba(255,255,255,0.14)'}`, cursor:'pointer', background: isDrag?'rgba(245,158,11,0.05)':'transparent', transition:'all 0.15s' }}>
        <Upload size={22} style={{ color:isDrag?'#f59e0b':'rgba(255,255,255,0.22)' }}/>
        <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.32)', textAlign:'center', lineHeight:1.5 }}>Drop WAV / MP3 / AIFF<br/>or click to browse</span>
        <input ref={fileRef} type="file" accept="audio/*" style={{ display:'none' }} onChange={onInput}/>
      </div>
    ) : (
      <>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <FileAudio size={15} style={{ color, flexShrink:0 }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.88)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sample.file?.name??'Buffer'}</div>
            {sample.buffer&&<div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginTop:1 }}>{sample.buffer.duration.toFixed(2)}s · {sample.buffer.numberOfChannels}ch · {(sample.buffer.sampleRate/1000).toFixed(1)}kHz</div>}
          </div>
          <button onClick={onBrowse} style={{ background:'none', border:'none', cursor:'pointer', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase' }}>Replace</button>
          <input ref={fileRef} type="file" accept="audio/*" style={{ display:'none' }} onChange={onInput}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <SliderRow label="PITCH" min={-24} max={24} step={1} val={sample.pitch}  unit="st" onChange={v=>onChange('pitch',v)}/>
          <SliderRow label="VOL"   min={0}   max={1}  step={0.01} val={sample.volume}         onChange={v=>onChange('volume',v)}/>
          <SliderRow label="PAN"   min={-1}  max={1}  step={0.01} val={sample.pan}            onChange={v=>onChange('pan',v)}/>
          <div style={{ display:'flex', alignItems:'center', paddingTop:4 }}>
            <button onClick={()=>onChange('loop',!sample.loop)} style={{ padding:'4px 8px', borderRadius:5, border:`1px solid ${sample.loop?'rgba(59,130,246,0.5)':'rgba(255,255,255,0.1)'}`, background:sample.loop?'rgba(59,130,246,0.18)':'rgba(255,255,255,0.04)', color:sample.loop?'#93c5fd':'rgba(255,255,255,0.3)', fontSize:9, fontWeight:800, textTransform:'uppercase', cursor:'pointer' }}>LOOP</button>
          </div>
        </div>
      </>
    )}
  </div>
);

const PresetPickerPanel: React.FC<{ config: PresetConfig; presets: UnifiedPreset[]; onLoad:(p:UnifiedPreset)=>void; color:string }> = ({ config, presets, onLoad }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(()=>presets.filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase())||p.type.toLowerCase().includes(search.toLowerCase())).slice(0,40),[presets,search]);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {config.presetId&&(
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)' }}>
          <Music size={13} style={{ color:'#fbbf24', flexShrink:0 }}/>
          <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.9)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{config.presetName}</span>
          <span style={{ fontSize:9, color:'rgba(245,158,11,0.7)', fontWeight:700, textTransform:'uppercase' }}>LOADED</span>
        </div>
      )}
      <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vault presets…"
        style={{ width:'100%', background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 12px', fontSize:12, color:'#fff', outline:'none', boxSizing:'border-box' }}/>
      <div style={{ maxHeight:160, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
        {filtered.map(p=>(
          <button key={p.id} onClick={()=>onLoad(p)} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:7, border:`1px solid ${config.presetId===p.id?'rgba(245,158,11,0.28)':'transparent'}`, background:config.presetId===p.id?'rgba(245,158,11,0.09)':'rgba(255,255,255,0.02)', cursor:'pointer', textAlign:'left', width:'100%' }}>
            <span style={{ fontSize:12, fontWeight:600, color:config.presetId===p.id?'#fbbf24':'rgba(255,255,255,0.72)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.25)', textTransform:'uppercase', fontWeight:700, flexShrink:0 }}>{p.type}</span>
          </button>
        ))}
        {!filtered.length&&<span style={{ fontSize:11, color:'rgba(255,255,255,0.22)', padding:'10px 0', textAlign:'center' }}>No presets found</span>}
      </div>
    </div>
  );
};

const FxPanel: React.FC<{
  fx: FxChain;
  onChange: (k: FxParamKey, v: number) => void;
  onToggle: (k: FxBoolKey) => void;
  color: string;
}> = ({ fx, onChange, onToggle }) => {
  const row = (
    label: string, desc: string, color: string,
    k: FxParamKey, min: number, max: number, step = 1
  ) => (
    <div key={k} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width:3, height:26, borderRadius:2, background:color, flexShrink:0 }}/>
      <div style={{ width:82, flexShrink:0 }}>
        <div style={{ fontSize:9, fontWeight:900, color:'#fff', letterSpacing:'0.08em', textTransform:'uppercase' }}>{label}</div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginTop:1 }}>{desc}</div>
      </div>
      <input type="range" min={min} max={max} step={step} value={(fx as any)[k] ?? 0} onChange={e=>onChange(k,+e.target.value)} style={{ flex:1, accentColor:color, cursor:'pointer' }}/>
      <span style={{ width:28, textAlign:'right', fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.97)', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{((fx as any)[k]??0).toFixed(step<1?1:0)}</span>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <div style={{ fontSize:9, fontWeight:900, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:4 }}>DYNAMICS &amp; DRIVE</div>
      {row('REVERB',    'Hall convolution',  '#818cf8', 'reverbMix',     0, 100)}
      {row('CHORUS',    'Stereo LFO',        '#34d399', 'chorusMix',     0, 100)}
      {row('DELAY',     'Tape dotted-8th',   '#60a5fa', 'delayMix',      0, 100)}
      {row('OVERDRIVE', 'Soft-clip saturation','#f87171','distDrive',     0, 100)}
      {row('COMPRESS',  'Dynamic threshold', '#fbbf24', 'compThreshold', 0, 100)}

      <div style={{ fontSize:9, fontWeight:900, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:6, marginBottom:4 }}>EQ</div>
      {row('LOW',   '± 15 dB shelf @ 120Hz', '#a78bfa', 'eqLow',  -15, 15, 0.5)}
      {row('MID',   '± 15 dB peak @ 1kHz',   '#c084fc', 'eqMid',  -15, 15, 0.5)}
      {row('HIGH',  '± 15 dB shelf @ 8kHz',   '#e879f9', 'eqHigh', -15, 15, 0.5)}

      <div style={{ fontSize:9, fontWeight:900, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:6, marginBottom:4 }}>PHASER &amp; FILTER</div>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width:3, height:26, borderRadius:2, background:'#22d3ee', flexShrink:0 }}/>
        <div style={{ width:82, flexShrink:0 }}>
          <div style={{ fontSize:9, fontWeight:900, color:'#fff', letterSpacing:'0.08em', textTransform:'uppercase' }}>PHASER</div>
        </div>
        <input type="range" min={0.1} max={5} step={0.1} value={fx.phaserRate} onChange={e=>onChange('phaserRate',+e.target.value)} style={{ flex:1, accentColor:'#22d3ee', cursor:'pointer' }}/>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', flexShrink:0 }}>RATE</span>
        <input type="range" min={0} max={1} step={0.01} value={fx.phaserDepth} onChange={e=>onChange('phaserDepth',+e.target.value)} style={{ width:60, accentColor:'#22d3ee', cursor:'pointer' }}/>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', flexShrink:0 }}>DEPTH</span>
        <button onClick={()=>onToggle('phaserEnabled')} style={{ padding:'3px 8px', borderRadius:5, border:'none', cursor:'pointer', fontSize:9, fontWeight:800, textTransform:'uppercase', background:fx.phaserEnabled?'rgba(34,211,238,0.2)':'rgba(255,255,255,0.05)', color:fx.phaserEnabled?'#22d3ee':'rgba(255,255,255,0.2)' }}>
          {fx.phaserEnabled?'ON':'OFF'}
        </button>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width:3, height:26, borderRadius:2, background:'#fb923c', flexShrink:0 }}/>
        <div style={{ width:82, flexShrink:0 }}>
          <div style={{ fontSize:9, fontWeight:900, color:'#fff', letterSpacing:'0.08em', textTransform:'uppercase' }}>FILTER</div>
        </div>
        <input type="range" min={0} max={100} step={1} value={fx.filterCutoff} onChange={e=>onChange('filterCutoff',+e.target.value)} style={{ flex:1, accentColor:'#fb923c', cursor:'pointer' }}/>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', flexShrink:0 }}>CUT</span>
        <input type="range" min={0} max={100} step={1} value={fx.filterRes} onChange={e=>onChange('filterRes',+e.target.value)} style={{ width:60, accentColor:'#fb923c', cursor:'pointer' }}/>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', flexShrink:0 }}>RES</span>
        <button onClick={()=>onToggle('filterEnabled')} style={{ padding:'3px 8px', borderRadius:5, border:'none', cursor:'pointer', fontSize:9, fontWeight:800, textTransform:'uppercase', background:fx.filterEnabled?'rgba(251,146,60,0.2)':'rgba(255,255,255,0.05)', color:fx.filterEnabled?'#fb923c':'rgba(255,255,255,0.2)' }}>
          {fx.filterEnabled?'ON':'OFF'}
        </button>
      </div>

      <div style={{ fontSize:9, fontWeight:900, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:6, marginBottom:4 }}>PITCH &amp; HALFTIME</div>
      {row('PITCH', 'Semitone shift ±24', '#f472b6', 'pitchSemi', -24, 24, 1)}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${fx.halftimeEnabled?'rgba(245,158,11,0.4)':'rgba(255,255,255,0.06)'}` }}>
        <div style={{ width:3, height:22, borderRadius:2, background:'#f59e0b', flexShrink:0 }}/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, fontWeight:900, color:'#f59e0b', textTransform:'uppercase', letterSpacing:'0.08em' }}>HALFTIME</div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)' }}>0.5× speed · pitch drops one octave</div>
        </div>
        <button onClick={()=>onToggle('halftimeEnabled' as FxBoolKey)} style={{ padding:'3px 10px', borderRadius:5, border:'none', cursor:'pointer', fontSize:9, fontWeight:800, textTransform:'uppercase', background:fx.halftimeEnabled?'rgba(245,158,11,0.25)':'rgba(255,255,255,0.05)', color:fx.halftimeEnabled?'#f59e0b':'rgba(255,255,255,0.2)' }}>
          {fx.halftimeEnabled?'ON':'OFF'}
        </button>
      </div>
    </div>
  );
};

const RowLabel: React.FC<{children:React.ReactNode}> = ({children}) => (
  <div style={{ fontSize:10, fontWeight:900, color:'rgba(255,255,255,0.88)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:5 }}>{children}</div>
);

const SliderRow: React.FC<{ label:string; min?:number; max?:number; step?:number; val:number; unit?:string; onChange:(v:number)=>void }> = ({ label, min=0, max=100, step=1, val, unit='', onChange }) => (
  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5 }}>
    <span style={{ width:29, fontSize:9, fontWeight:900, color:'rgba(255,255,255,0.88)', textTransform:'uppercase', letterSpacing:'0.07em', flexShrink:0 }}>{label}</span>
    <input type="range" min={min} max={max} step={step} value={val} onChange={e=>onChange(+e.target.value)} style={{ flex:1, accentColor:'#a855f7', cursor:'pointer', minWidth:40 }}/>
    <span style={{ width:32, fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.97)', fontVariantNumeric:'tabular-nums', textAlign:'right', flexShrink:0 }}>{typeof val==='number'?val.toFixed(step<1?2:0):val}{unit}</span>
  </div>
);

// ─── Waveform canvas ──────────────────────────────────────────────────────────

const WaveformCanvas: React.FC<{ buffer: AudioBuffer | null; color: string; height?: number }> =
  React.memo(({ buffer, color, height = 90 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);

    if (!buffer) {
      g.strokeStyle = 'rgba(255,255,255,0.06)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
      return;
    }

    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / W));
    const mid = H / 2;

    // Filled region
    g.fillStyle = `${color}20`;
    g.beginPath(); g.moveTo(0, mid);
    for (let x = 0; x < W; x++) {
      let mv = 0;
      for (let j = 0; j < step; j++) mv = Math.max(mv, Math.abs(data[x * step + j] ?? 0));
      g.lineTo(x, mid - mv * (mid - 2));
    }
    for (let x = W - 1; x >= 0; x--) {
      let mv = 0;
      for (let j = 0; j < step; j++) mv = Math.max(mv, Math.abs(data[x * step + j] ?? 0));
      g.lineTo(x, mid + mv * (mid - 2));
    }
    g.closePath(); g.fill();

    // Stroke outline
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let x = 0; x < W; x++) {
      let mn = 1, mx = -1;
      for (let j = 0; j < step; j++) {
        const v = data[x * step + j] ?? 0;
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
      if (x === 0) g.moveTo(x, mid + mn * (mid - 2));
      g.lineTo(x, mid + mx * (mid - 2));
      g.lineTo(x, mid + mn * (mid - 2));
    }
    g.stroke();

    // Center line
    g.strokeStyle = `${color}40`;
    g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(0, mid); g.lineTo(W, mid); g.stroke();
  }, [buffer, color, height]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={height}
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    />
  );
});
WaveformCanvas.displayName = 'WaveformCanvas';

export default MultiRealmForge;
