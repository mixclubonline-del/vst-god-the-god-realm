/**
 * useSequencerEngine — Web Audio Lookahead Scheduler
 * Sample-accurate step sequencer timing via AudioContext clock.
 * Uses the "two clocks" pattern: JS timer for scheduling, AudioContext for playback.
 *
 * Sacred Sequence Ascension — Universal Track Architecture
 * Supports sample, synth, and bus track types with dynamic add/remove (up to 16).
 */
import React, { useRef, useCallback, useEffect } from 'react';
import { useUndoableReducer } from './useUndoableReducer';
import { MasterChain, MasterParams } from '../../audio/VelvetCurveEngine';
import { FXRack } from '../../audio/FXRack';
import type { ElectricPantheonGodId } from '../../data/electricPantheonGods';
import { nativeAudio } from '../../native/bridge';

/* ═══ Constants ═══ */
export const MAX_TRACKS = 16;
export const MIN_TRACKS = 1;

/* ═══ Types ═══ */
export type TrackSourceType = 'sample' | 'synth' | 'bus';
export type VoiceMode = 'poly' | 'mono' | 'legato';

export interface StepState {
  enabled: boolean;
  velocity: number;       // 0-127
  pitch: number;          // -24 to +24 semitones
  pan: number;            // -1 to 1
  decay: number;          // 0-1 (note length)
  probability: number;    // 0-100%
  trigCondition: 'always' | 'fill' | 'notFill' | '1:2' | '1:4' | '1:8';
  microTiming: number;    // -50 to +50 (% of step duration)
  retrigRate: null | '1/2' | '1/4' | '1/8' | '1/16' | '1/32';
  retrigVelocityCurve: 'flat' | 'rampUp' | 'rampDown' | 'random';
  sliceIndex: number;     // Index of the slice to play (0 = full sample or slice 1)
  reverse?: boolean;      // FL Quality: Play this specific step backwards
}

export interface PianoRollNote {
  id: string;
  note: number;         // MIDI note 0-127
  startStep: number;    // Fractional step position (e.g. 3.25)
  duration: number;     // Length in steps (min 0.25)
  velocity: number;     // 0-127
  /* FL Quality: Per-note event properties */
  pan?: number;         // -1 to 1
  pitchBend?: number;   // -1 to 1 (fine tuning)
  probability?: number; // 0-100%
  microTiming?: number; // -50 to 50%
}

let _pianoNoteIdCounter = 0;
export function generatePianoNoteId(): string {
  return `pn-${Date.now()}-${_pianoNoteIdCounter++}`;
}

export interface SynthTrackConfig {
  godId: ElectricPantheonGodId;
  octave: number;               // -2 to +2
  voiceMode: VoiceMode;
  macros: { energy: number; divinity: number; width: number; realm: number };
  noteMap: number[];            // per-step MIDI note (60 = C4), length = MAX_STEPS
  pianoRollNotes: PianoRollNote[];  // Full piano roll note data
  usePianoRoll: boolean;            // true = use pianoRollNotes, false = use noteMap
}

export interface BusTrackConfig {
  inputTrackIds: string[];
}

export interface FXSendState {
  reverb: number;    // 0-100
  chorus: number;
  delay: number;
  saturation: number;
}

/* ═══ Automation Types ═══ */

/** A single automation breakpoint with sub-step precision */
export interface AutomationPoint {
  step: number;       // 0-based, fractional for sub-step precision (e.g. 3.5)
  value: number;      // 0–1 normalized (mapped to parameter range at playback)
}

/** Automatable parameters */
export type AutomationParam =
  | 'volume' | 'pan'
  | 'fxReverb' | 'fxChorus' | 'fxDelay' | 'fxSaturation'
  | 'synthEnergy' | 'synthDivinity' | 'synthWidth' | 'synthRealm';

/** A single automation lane attached to a track */
export interface AutomationLane {
  param: AutomationParam;
  enabled: boolean;
  points: AutomationPoint[];    // sorted ascending by step
  curveType: 'linear' | 'step' | 'smooth';  // interpolation mode
}

/** Interpolate automation value at a given step position */
export function getAutomationValue(lane: AutomationLane, step: number): number | null {
  if (!lane.enabled || lane.points.length === 0) return null;
  const pts = lane.points;

  // Before first point — hold first value
  if (step <= pts[0].step) return pts[0].value;
  // After last point — hold last value
  if (step >= pts[pts.length - 1].step) return pts[pts.length - 1].value;

  // Binary search for surrounding points
  let lo = 0, hi = pts.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].step <= step) lo = mid;
    else hi = mid;
  }

  const p0 = pts[lo];
  const p1 = pts[hi];
  const t = (step - p0.step) / (p1.step - p0.step);

  switch (lane.curveType) {
    case 'step':
      return p0.value;
    case 'smooth': {
      // Hermite / smoothstep interpolation
      const s = t * t * (3 - 2 * t);
      return p0.value + (p1.value - p0.value) * s;
    }
    case 'linear':
    default:
      return p0.value + (p1.value - p0.value) * t;
  }
}

/* ═══ Insert FX Types ═══ */
export type InsertEffectType = 'filter' | 'distortion' | 'bitcrusher' | 'compressor' | 'reverb' | 'delay' | 'chorus' | 'saturation';

export interface InsertEffect {
  id: string;
  type: InsertEffectType;
  enabled: boolean;
  params: Record<string, number>;
}

export interface TrackState {
  id: string;
  name: string;
  color: string;
  icon: string;
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;                // -1 to 1 (track-level pan)
  swing: number;              // 0 = use global, 1-100 = per-track override
  eqLow: number;              // -12 to +12 dB
  eqMid: number;              // -12 to +12 dB
  eqHigh: number;             // -12 to +12 dB
  polymetricLength: number;
  patternA: StepState[];
  patternB: StepState[];
  sourceType: TrackSourceType;
  synthConfig?: SynthTrackConfig;
  busConfig?: BusTrackConfig;
  fxSends: FXSendState;
  insertFx: InsertEffect[];
  sampleParams: {
    start: number;
    end: number;
    reverse: boolean;
    loop: boolean;
    loopStart: number;
    loopEnd: number;
    slices: { start: number; end: number; reverse?: boolean; loop?: boolean; volume?: number }[];
    /* Chopper params — persisted */
    chopperSpeed: number;
    chopperPitch: number;
    chopperFadeIn: number;
    chopperFadeOut: number;
    chopperGlide: number;
    chopperSensitivity: number;
    chopperTrigger: 'MIDI' | 'Gate' | 'OneShot';
    chopperDryWet: number;
    chopperOutputVolume: number;
    chopMode: 'Manual' | 'Auto' | 'Grid';
    scopeGlobal: boolean;
    snapToTransient: boolean;
    snapToZero: boolean;
  };
  automationLanes: AutomationLane[];
  /* Track Bounce/Freeze */
  isFrozen: boolean;
  isRecordArmed: boolean;
}

/* ═══ Song Mode Types ═══ */
export interface SongBlock {
  id: string;
  pattern: 'A' | 'B';
  repeats: number; // how many times this block plays before advancing
  label?: string;
}

export interface SequencerState {
  bpm: number;
  swing: number;
  swingPreset: 'none' | 'mpc' | 'sp1200' | 'tr808' | 'tr909';
  stepCount: 16 | 32 | 64;
  currentStep: number;
  isPlaying: boolean;
  isRecording: boolean;
  isFillMode: boolean;
  activePattern: 'A' | 'B';
  activeGraphMode: 'velocity' | 'pitch' | 'pan' | 'decay' | 'probability' | 'note';
  selectedTrack: number;
  tracks: TrackState[];
  cycleCount: number;
  master: MasterParams;
  playbackMode: 'pattern' | 'song';
  /* Song Mode */
  songArrangement: SongBlock[];
  songPosition: number; // index into songArrangement
  songRepeatCount: number; // how many repeats of current block have played
  /* Clipboard */
  clipboardPattern: StepState[] | null;
  clipboardTrack: TrackState | null;
  /* Multi-step selection */
  selectedSteps: number[];        // indices of selected steps on the active track
  selectionAnchor: number | null; // anchor point for shift-click range selection
  clipboardSteps: StepState[] | null; // copied step range
}
import { THRONE_DOMAINS } from '../../data/throneDomains';

/* ═══ Default Data ═══ */
const DEFAULT_TRACKS: { name: string; color: string; icon: string; sourceType: TrackSourceType; godId?: ElectricPantheonGodId }[] = [
  { name: 'KICK',     color: THRONE_DOMAINS[0].color,  icon: THRONE_DOMAINS[0].sigil,  sourceType: 'sample' },   // Thunder ⚡
  { name: 'SNARE',    color: THRONE_DOMAINS[1].color,  icon: THRONE_DOMAINS[1].sigil,  sourceType: 'sample' },   // Tides 🌊
  { name: 'HI-HAT',   color: THRONE_DOMAINS[3].color,  icon: THRONE_DOMAINS[3].sigil,  sourceType: 'sample' },   // Crystal 💎
  { name: '808',      color: THRONE_DOMAINS[2].color,  icon: THRONE_DOMAINS[2].sigil,  sourceType: 'sample' },   // Inferno 🔥
  { name: 'PERC',     color: THRONE_DOMAINS[4].color,  icon: THRONE_DOMAINS[4].sigil,  sourceType: 'sample' },   // Eden 🌿
  { name: 'MELODY',   color: '#FFD700', icon: '⚡', sourceType: 'synth', godId: 'olympus' },
  { name: 'CHORDS',   color: '#A855F7', icon: '⚡', sourceType: 'synth', godId: 'athena' },
  { name: 'LEAD',     color: '#3B82F6', icon: '⚡', sourceType: 'synth', godId: 'zeus' },
  { name: 'PAD',      color: '#14B8A6', icon: '⚡', sourceType: 'synth', godId: 'poseidon' },
  { name: 'FX HIT',   color: THRONE_DOMAINS[11].color, icon: THRONE_DOMAINS[11].sigil, sourceType: 'sample' },  // Wrath ⚔️
];

function createDefaultStep(): StepState {
  return {
    enabled: false, velocity: 100, pitch: 0, pan: 0,
    decay: 0.5, probability: 100, trigCondition: 'always',
    microTiming: 0, retrigRate: null, retrigVelocityCurve: 'flat',
    sliceIndex: 0,
  };
}

function createDefaultSampleParams() {
  return {
    start: 0,
    end: 1,
    reverse: false,
    loop: false,
    loopStart: 0,
    loopEnd: 1,
    slices: [] as { start: number; end: number; reverse?: boolean; loop?: boolean; volume?: number }[],
    chopperSpeed: 1.0,
    chopperPitch: 0,
    chopperFadeIn: 25,
    chopperFadeOut: 150,
    chopperGlide: 10,
    chopperSensitivity: 50,
    chopperTrigger: 'MIDI' as const,
    chopperDryWet: 75,
    chopperOutputVolume: -3,
    chopMode: 'Manual' as const,
    scopeGlobal: true,
    snapToTransient: true,
    snapToZero: true,
  };
}

function createDefaultFXSends(): FXSendState {
  return { reverb: 0, chorus: 0, delay: 0, saturation: 0 };
}

function createDefaultSynthConfig(godId: ElectricPantheonGodId = 'olympus', stepCount: number = 16): SynthTrackConfig {
  return {
    godId,
    octave: 0,
    voiceMode: 'poly',
    macros: { energy: 50, divinity: 50, width: 50, realm: 50 },
    noteMap: Array.from({ length: stepCount }, () => 60), // C4 default
    pianoRollNotes: [],
    usePianoRoll: false,
  };
}

let _trackIdCounter = 0;
function generateTrackId(): string {
  return `trk-${Date.now()}-${_trackIdCounter++}`;
}

function createDefaultTrack(
  info: { name: string; color: string; icon: string; sourceType?: TrackSourceType; godId?: ElectricPantheonGodId },
  stepCount: number
): TrackState {
  const sourceType = info.sourceType || 'sample';
  const patternA = Array.from({ length: stepCount }, () => createDefaultStep());
  
  // Inject default trap beat
  if (info.name === 'KICK') {
    [0, 8, 11].forEach(i => { if (patternA[i]) patternA[i].enabled = true; });
  } else if (info.name === 'SNARE') {
    [4, 12].forEach(i => { if (patternA[i]) patternA[i].enabled = true; });
  } else if (info.name === 'HI-HAT') {
    [0, 2, 4, 6, 8, 10, 12, 14, 15].forEach(i => { if (patternA[i]) patternA[i].enabled = true; });
  } else if (info.name === '808') {
    [0, 8].forEach(i => { if (patternA[i]) patternA[i].enabled = true; });
  } else if (info.name === 'PERC') {
    [7, 13].forEach(i => { if (patternA[i]) patternA[i].enabled = true; });
  }

  return {
    id: generateTrackId(),
    name: info.name, color: info.color, icon: info.icon,
    muted: false, soloed: false, volume: 0.8,
    pan: 0,
    swing: 0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    polymetricLength: stepCount,
    patternA,
    patternB: Array.from({ length: stepCount }, () => createDefaultStep()),
    sourceType,
    synthConfig: sourceType === 'synth' ? createDefaultSynthConfig(info.godId || 'olympus', stepCount) : undefined,
    busConfig: sourceType === 'bus' ? { inputTrackIds: [] } : undefined,
    fxSends: createDefaultFXSends(),
    insertFx: [],
    sampleParams: createDefaultSampleParams(),
    automationLanes: [],
    isFrozen: false,
    isRecordArmed: false,
  };
}

const INITIAL_STEP_COUNT = 16;

const STORAGE_KEY = 'sacred_sequencer_state';

function createInitialState(): SequencerState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return { ...parsed, isPlaying: false, currentStep: -1 };
    } catch (e) {
      console.error('Failed to parse saved sequencer state', e);
    }
  }

  return {
    bpm: 140, swing: 0, swingPreset: 'none',
    stepCount: INITIAL_STEP_COUNT as 16, currentStep: -1,
    isPlaying: false, isRecording: false, isFillMode: false,
    activePattern: 'A',
    activeGraphMode: 'velocity', selectedTrack: 0,
    tracks: DEFAULT_TRACKS.map(t => createDefaultTrack(t, INITIAL_STEP_COUNT)),
    cycleCount: 0,
    master: {
      drive: 1.2,
      silk: 0.3,
      body: 0,
      soul: 0,
      air: 0,
      threshold: -0.5,
      ceiling: -0.1,
      volume: 1.0,
    },
    playbackMode: 'pattern',
    songArrangement: [],
    songPosition: 0,
    songRepeatCount: 0,
    clipboardPattern: null,
    clipboardTrack: null,
    selectedSteps: [],
    selectionAnchor: null,
    clipboardSteps: null,
  };
}

/* ═══ Reducer Actions ═══ */
type SeqAction =
  | { type: 'PLAY' }
  | { type: 'STOP' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'TOGGLE_AUTOMATION_RECORD' }
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_SWING'; swing: number }
  | { type: 'SET_SWING_PRESET'; preset: SequencerState['swingPreset'] }
  | { type: 'SET_STEP_COUNT'; count: 16 | 32 | 64 }
  | { type: 'SET_CURRENT_STEP'; step: number }
  | { type: 'INCREMENT_CYCLE' }
  | { type: 'TOGGLE_FILL' }
  | { type: 'SET_PATTERN'; pattern: 'A' | 'B' }
  | { type: 'SET_GRAPH_MODE'; mode: SequencerState['activeGraphMode'] }
  | { type: 'SELECT_TRACK'; index: number }
  | { type: 'TOGGLE_STEP'; trackIndex: number; stepIndex: number }
  | { type: 'SET_STEP_VELOCITY'; trackIndex: number; stepIndex: number; velocity: number }
  | { type: 'SET_STEP_PROP'; trackIndex: number; stepIndex: number; prop: keyof StepState; value: any }
  | { type: 'TOGGLE_MUTE'; trackIndex: number }
  | { type: 'TOGGLE_SOLO'; trackIndex: number }
  | { type: 'SET_TRACK_VOLUME'; trackIndex: number; volume: number }
  | { type: 'SET_POLYMETRIC_LENGTH'; trackIndex: number; length: number }
  | { type: 'CLEAR_TRACK'; trackIndex: number }
  | { type: 'CLEAR_ALL' }
  | { type: 'RANDOMIZE_TRACK'; trackIndex: number }
  | { type: 'COPY_PATTERN'; from: 'A' | 'B'; to: 'A' | 'B' }
  | { type: 'SET_MASTER_PARAM'; param: keyof MasterParams; value: number }
  | { type: 'SET_SAMPLE_PARAM'; trackIndex: number; param: string; value: any }
  | { type: 'LOAD_PATTERN'; tracks: TrackState[] }
  | { type: 'LOAD_PROJECT_STATE'; payload: Partial<SequencerState> }
  /* ─── Sacred Sequence Ascension: Dynamic Track Management ─── */
  | { type: 'ADD_TRACK'; sourceType: TrackSourceType; name?: string; godId?: ElectricPantheonGodId }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'REORDER_TRACKS'; fromIndex: number; toIndex: number }
  | { type: 'SET_TRACK_SOURCE'; trackIndex: number; sourceType: TrackSourceType; godId?: ElectricPantheonGodId }
  | { type: 'SET_SYNTH_GOD'; trackIndex: number; godId: ElectricPantheonGodId }
  | { type: 'SET_SYNTH_OCTAVE'; trackIndex: number; octave: number }
  | { type: 'SET_SYNTH_VOICE_MODE'; trackIndex: number; voiceMode: VoiceMode }
  | { type: 'SET_SYNTH_MACRO'; trackIndex: number; macro: keyof SynthTrackConfig['macros']; value: number }
  | { type: 'SET_NOTE_MAP'; trackIndex: number; stepIndex: number; note: number }
  | { type: 'SET_FX_SEND'; trackIndex: number; fx: keyof FXSendState; value: number }
  /* Insert FX */
  | { type: 'ADD_INSERT_FX'; trackIndex: number; slotIndex: number; effectType: InsertEffectType }
  | { type: 'REMOVE_INSERT_FX'; trackIndex: number; slotIndex: number }
  | { type: 'SET_INSERT_FX_PARAM'; trackIndex: number; slotIndex: number; param: string; value: number }
  | { type: 'TOGGLE_INSERT_FX'; trackIndex: number; slotIndex: number }
  | { type: 'RENAME_TRACK'; trackIndex: number; name: string }
  | { type: 'SET_TRACK_COLOR'; trackIndex: number; color: string }
  | { type: 'SET_PLAYBACK_MODE'; mode: 'pattern' | 'song' }
  | { type: 'LOAD_PRESET'; preset: Record<number, { steps: number[]; vel?: number[] }> }
  | { type: 'LOAD_ORACLE_PATTERN'; trackIndex: number; steps: StepState[]; noteMap?: number[]; pianoNotes?: PianoRollNote[]; usePianoRoll?: boolean }
  /* Song Mode actions */
  | { type: 'ADD_SONG_BLOCK'; pattern: 'A' | 'B'; repeats?: number; label?: string }
  | { type: 'REMOVE_SONG_BLOCK'; index: number }
  | { type: 'REORDER_SONG_BLOCKS'; fromIndex: number; toIndex: number }
  | { type: 'UPDATE_SONG_BLOCK'; index: number; changes: Partial<Omit<SongBlock, 'id'>> }
  | { type: 'SET_SONG_POSITION'; position: number }
  /* Clipboard */
  | { type: 'COPY_TRACK_PATTERN' }
  | { type: 'PASTE_TRACK_PATTERN' }
  | { type: 'SWAP_PATTERNS' }
  | { type: 'COPY_TRACK'; trackIndex: number }
  | { type: 'PASTE_TRACK'; trackIndex: number }
  | { type: 'SWAP_TRACKS'; trackIndexA: number; trackIndexB: number }
  | { type: 'SWAP_TRACK_WITH_CLIPBOARD' }
  | { type: 'FILL_STEPS'; trackIndex: number; interval: number }
  | { type: 'ROTATE_TRACK_PATTERN'; trackIndex: number; direction: 'left' | 'right' }
  | { type: 'DUPLICATE_TRACK_PATTERN'; trackIndex: number }
  /* Automation */
  | { type: 'ADD_AUTOMATION_LANE'; trackIndex: number; param: AutomationParam }
  | { type: 'REMOVE_AUTOMATION_LANE'; trackIndex: number; param: AutomationParam }
  | { type: 'SET_AUTOMATION_POINT'; trackIndex: number; param: AutomationParam; point: AutomationPoint }
  | { type: 'REMOVE_AUTOMATION_POINT'; trackIndex: number; param: AutomationParam; pointIndex: number }
  | { type: 'SET_AUTOMATION_POINTS'; trackIndex: number; param: AutomationParam; points: AutomationPoint[] }
  | { type: 'TOGGLE_AUTOMATION_ENABLED'; trackIndex: number; param: AutomationParam }
  | { type: 'SET_AUTOMATION_CURVE_TYPE'; trackIndex: number; param: AutomationParam; curveType: AutomationLane['curveType'] }
  | { type: 'RECORD_AUTOMATION_SNAPSHOT'; trackIndex: number; param: AutomationParam; step: number; value: number }
  /* Phase A/B: FL Studio Quality Upgrade */
  | { type: 'SET_TRACK_PAN'; trackIndex: number; pan: number }
  | { type: 'SET_TRACK_SWING'; trackIndex: number; swing: number }
  | { type: 'HUMANIZE_TRACK'; trackIndex: number; amount: number }
  | { type: 'QUANTIZE_TRACK'; trackIndex: number }
  | { type: 'SET_TRACK_EQ'; trackIndex: number; band: 'low' | 'mid' | 'high'; value: number }
  /* Phase C: Multi-step selection + Bus Routing */
  | { type: 'SELECT_STEP'; stepIndex: number; additive: boolean; range: boolean }
  | { type: 'SELECT_STEP_RANGE'; from: number; to: number }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'COPY_SELECTED_STEPS' }
  | { type: 'PASTE_SELECTED_STEPS'; startIndex: number }
  | { type: 'DELETE_SELECTED_STEPS' }
  | { type: 'SET_BUS_INPUT_TRACKS'; trackIndex: number; inputTrackIds: string[] }
  /* Phase D: Selection Toolbar Actions */
  | { type: 'REVERSE_SELECTED_STEPS' }
  | { type: 'DOUBLE_SELECTED_STEPS' }
  | { type: 'HALVE_SELECTED_STEPS' }
  | { type: 'RANDOMIZE_SELECTED_VELOCITY' }
  /* Piano Roll */
  | { type: 'ADD_PIANO_NOTE'; trackIndex: number; note: PianoRollNote }
  | { type: 'REMOVE_PIANO_NOTE'; trackIndex: number; noteId: string }
  | { type: 'UPDATE_PIANO_NOTE'; trackIndex: number; noteId: string; changes: Partial<Omit<PianoRollNote, 'id'>> }
  | { type: 'TOGGLE_PIANO_ROLL_MODE'; trackIndex: number }
  /* Track Bounce/Freeze */
  | { type: 'FREEZE_TRACK'; trackIndex: number }
  | { type: 'UNFREEZE_TRACK'; trackIndex: number }
  | { type: 'TOGGLE_RECORD_ARM'; trackIndex: number };

function getActivePattern(track: TrackState, pattern: 'A' | 'B'): StepState[] {
  return pattern === 'A' ? track.patternA : track.patternB;
}

function setActivePattern(track: TrackState, pattern: 'A' | 'B', steps: StepState[]): TrackState {
  return pattern === 'A'
    ? { ...track, patternA: steps }
    : { ...track, patternB: steps };
}

function sequencerReducer(state: SequencerState, action: SeqAction): SequencerState {
  switch (action.type) {
    case 'PLAY':
      return { ...state, isPlaying: true, currentStep: -1 };
    case 'STOP':
      return { ...state, isPlaying: false, isRecording: false, currentStep: -1 };
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying, currentStep: state.isPlaying ? -1 : state.currentStep };
    case 'TOGGLE_AUTOMATION_RECORD':
      return { ...state, isRecording: !state.isRecording };
    case 'SET_BPM':
      return { ...state, bpm: Math.max(20, Math.min(300, action.bpm)) };
    case 'SET_SWING':
      return { ...state, swing: Math.max(0, Math.min(100, action.swing)) };
    case 'SET_SWING_PRESET': {
      const presetSwings: Record<string, number> = {
        none: 0, mpc: 54, sp1200: 62, tr808: 57, tr909: 50,
      };
      return { ...state, swingPreset: action.preset, swing: presetSwings[action.preset] ?? 0 };
    }
    case 'SET_STEP_COUNT': {
      const tracks = state.tracks.map(t => {
        const resizePattern = (p: StepState[]) => {
          if (p.length >= action.count) return p.slice(0, action.count);
          return [...p, ...Array.from({ length: action.count - p.length }, () => createDefaultStep())];
        };
        return {
          ...t,
          polymetricLength: Math.min(t.polymetricLength, action.count),
          patternA: resizePattern(t.patternA),
          patternB: resizePattern(t.patternB),
        };
      });
      return { ...state, stepCount: action.count, tracks };
    }
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.step };
    case 'INCREMENT_CYCLE': {
      const newCycle = state.cycleCount + 1;
      // In song mode, advance arrangement blocks
      if (state.playbackMode === 'song' && state.songArrangement.length > 0) {
        const currentBlock = state.songArrangement[state.songPosition];
        const newRepeat = state.songRepeatCount + 1;
        if (currentBlock && newRepeat >= currentBlock.repeats) {
          // Advance to next block (loop back to 0 at end)
          const nextPos = (state.songPosition + 1) % state.songArrangement.length;
          const nextBlock = state.songArrangement[nextPos];
          return {
            ...state,
            cycleCount: newCycle,
            songPosition: nextPos,
            songRepeatCount: 0,
            activePattern: nextBlock?.pattern ?? state.activePattern,
          };
        }
        return { ...state, cycleCount: newCycle, songRepeatCount: newRepeat };
      }
      return { ...state, cycleCount: newCycle };
    }
    case 'TOGGLE_FILL':
      return { ...state, isFillMode: !state.isFillMode };
    case 'SET_PATTERN':
      return { ...state, activePattern: action.pattern };
    case 'SET_GRAPH_MODE':
      return { ...state, activeGraphMode: action.mode };
    case 'SELECT_TRACK':
      return { ...state, selectedTrack: action.index };
    case 'TOGGLE_STEP': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      const steps = [...getActivePattern(track, state.activePattern)];
      steps[action.stepIndex] = { ...steps[action.stepIndex], enabled: !steps[action.stepIndex].enabled };
      tracks[action.trackIndex] = setActivePattern(track, state.activePattern, steps);
      return { ...state, tracks };
    }
    case 'SET_STEP_VELOCITY': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      const steps = [...getActivePattern(track, state.activePattern)];
      steps[action.stepIndex] = { ...steps[action.stepIndex], velocity: action.velocity, enabled: true };
      tracks[action.trackIndex] = setActivePattern(track, state.activePattern, steps);
      return { ...state, tracks };
    }
    case 'SET_STEP_PROP': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      const steps = [...getActivePattern(track, state.activePattern)];
      steps[action.stepIndex] = { ...steps[action.stepIndex], [action.prop]: action.value };
      tracks[action.trackIndex] = setActivePattern(track, state.activePattern, steps);
      return { ...state, tracks };
    }
    case 'TOGGLE_MUTE': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = { ...tracks[action.trackIndex], muted: !tracks[action.trackIndex].muted };
      return { ...state, tracks };
    }
    case 'TOGGLE_SOLO': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = { ...tracks[action.trackIndex], soloed: !tracks[action.trackIndex].soloed };
      return { ...state, tracks };
    }
    case 'SET_TRACK_VOLUME': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = { ...tracks[action.trackIndex], volume: action.volume };
      return { ...state, tracks };
    }
    case 'SET_POLYMETRIC_LENGTH': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = { ...tracks[action.trackIndex], polymetricLength: action.length };
      return { ...state, tracks };
    }
    case 'CLEAR_TRACK': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      const cleared = getActivePattern(track, state.activePattern).map(() => createDefaultStep());
      tracks[action.trackIndex] = setActivePattern(track, state.activePattern, cleared);
      return { ...state, tracks };
    }
    case 'CLEAR_ALL': {
      const tracks = state.tracks.map(t => {
        const cleared = getActivePattern(t, state.activePattern).map(() => createDefaultStep());
        return setActivePattern(t, state.activePattern, cleared);
      });
      return { ...state, tracks };
    }
    case 'RANDOMIZE_TRACK': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      const steps = getActivePattern(track, state.activePattern).map(() => {
        const step = createDefaultStep();
        step.enabled = Math.random() > 0.55;
        step.velocity = Math.floor(Math.random() * 60 + 60);
        return step;
      });
      tracks[action.trackIndex] = setActivePattern(track, state.activePattern, steps);
      return { ...state, tracks };
    }
    case 'COPY_PATTERN': {
      const tracks = state.tracks.map(t => {
        if (action.from === 'A' && action.to === 'B') {
          return { ...t, patternB: t.patternA.map(s => ({ ...s })) };
        } else if (action.from === 'B' && action.to === 'A') {
          return { ...t, patternA: t.patternB.map(s => ({ ...s })) };
        }
        return t;
      });
      return { ...state, tracks };
    }
    case 'SET_MASTER_PARAM':
      return { ...state, master: { ...state.master, [action.param]: action.value } };
    case 'SET_SAMPLE_PARAM': {
      const nextTracks = [...state.tracks];
      nextTracks[action.trackIndex] = {
        ...nextTracks[action.trackIndex],
        sampleParams: {
          ...nextTracks[action.trackIndex].sampleParams,
          [action.param]: action.value
        }
      };
      return { ...state, tracks: nextTracks };
    }
    case 'LOAD_PATTERN':
      return { ...state, tracks: action.tracks };
    case 'LOAD_PROJECT_STATE':
      return {
        ...state,
        ...action.payload,
        isPlaying: false,
        currentStep: -1,
        cycleCount: 0,
        clipboardPattern: null,
        // Ensure Phase C/D fields always present (old saves lack them)
        selectedSteps: [],
        selectionAnchor: null,
        clipboardSteps: null,
      };

    /* ─── Sacred Sequence Ascension: Dynamic Track Actions ─── */
    case 'ADD_TRACK': {
      if (state.tracks.length >= MAX_TRACKS) return state;
      const sourceIcons: Record<TrackSourceType, string> = { sample: '🎵', synth: '⚡', bus: '🔊' };
      const sourceColors: Record<TrackSourceType, string> = { sample: '#60A5FA', synth: '#FFD700', bus: '#F97316' };
      const newTrack = createDefaultTrack({
        name: action.name || `TRACK ${state.tracks.length + 1}`,
        color: sourceColors[action.sourceType],
        icon: sourceIcons[action.sourceType],
        sourceType: action.sourceType,
        godId: action.godId,
      }, state.stepCount);
      return { ...state, tracks: [...state.tracks, newTrack] };
    }
    case 'REMOVE_TRACK': {
      if (state.tracks.length <= MIN_TRACKS) return state;
      const filtered = state.tracks.filter(t => t.id !== action.trackId);
      const newSelected = Math.min(state.selectedTrack, filtered.length - 1);
      return { ...state, tracks: filtered, selectedTrack: newSelected };
    }
    case 'REORDER_TRACKS': {
      const reordered = [...state.tracks];
      const [moved] = reordered.splice(action.fromIndex, 1);
      reordered.splice(action.toIndex, 0, moved);
      return { ...state, tracks: reordered };
    }
    case 'SET_TRACK_SOURCE': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      const sourceIcons: Record<TrackSourceType, string> = { sample: '🎵', synth: '⚡', bus: '🔊' };
      tracks[action.trackIndex] = {
        ...track,
        sourceType: action.sourceType,
        icon: sourceIcons[action.sourceType],
        synthConfig: action.sourceType === 'synth'
          ? createDefaultSynthConfig(action.godId || 'olympus', state.stepCount)
          : undefined,
        busConfig: action.sourceType === 'bus' ? { inputTrackIds: [] } : undefined,
      };
      return { ...state, tracks };
    }
    case 'SET_SYNTH_GOD': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      if (!track.synthConfig) return state;
      tracks[action.trackIndex] = {
        ...track,
        synthConfig: { ...track.synthConfig, godId: action.godId },
      };
      return { ...state, tracks };
    }
    case 'SET_SYNTH_OCTAVE': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      if (!track.synthConfig) return state;
      tracks[action.trackIndex] = {
        ...track,
        synthConfig: { ...track.synthConfig, octave: Math.max(-2, Math.min(2, action.octave)) },
      };
      return { ...state, tracks };
    }
    case 'SET_SYNTH_VOICE_MODE': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      if (!track.synthConfig) return state;
      tracks[action.trackIndex] = {
        ...track,
        synthConfig: { ...track.synthConfig, voiceMode: action.voiceMode },
      };
      return { ...state, tracks };
    }
    case 'SET_SYNTH_MACRO': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      if (!track.synthConfig) return state;
      tracks[action.trackIndex] = {
        ...track,
        synthConfig: {
          ...track.synthConfig,
          macros: { ...track.synthConfig.macros, [action.macro]: Math.max(0, Math.min(100, action.value)) },
        },
      };
      return { ...state, tracks };
    }
    case 'SET_NOTE_MAP': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      if (!track.synthConfig) return state;
      const noteMap = [...track.synthConfig.noteMap];
      noteMap[action.stepIndex] = Math.max(24, Math.min(96, action.note)); // C1–C7
      tracks[action.trackIndex] = {
        ...track,
        synthConfig: { ...track.synthConfig, noteMap },
      };
      return { ...state, tracks };
    }
    case 'SET_FX_SEND': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = {
        ...tracks[action.trackIndex],
        fxSends: {
          ...tracks[action.trackIndex].fxSends,
          [action.fx]: Math.max(0, Math.min(100, action.value)),
        },
      };
      return { ...state, tracks };
    }
    case 'ADD_INSERT_FX': {
      const tracks = [...state.tracks];
      const track = { ...tracks[action.trackIndex] };
      const insertFx = [...(track.insertFx || [])];
      // Provide default params based on type
      let defaultParams: Record<string, number> = {};
      switch (action.effectType) {
        case 'filter': defaultParams = { cutoff: 100, resonance: 0, type: 0, drive: 0, lfoRate: 0, lfoDepth: 0, envAmount: 0 }; break;
        case 'distortion': defaultParams = { drive: 50, tone: 50 }; break;
        case 'bitcrusher': defaultParams = { bits: 8, downsample: 4 }; break;
        case 'compressor': defaultParams = { threshold: -12, ratio: 4, attack: 10, release: 100 }; break;
        case 'reverb': defaultParams = { size: 50, mix: 50 }; break;
        case 'delay': defaultParams = { time: 250, feedback: 50, mix: 50 }; break;
        case 'chorus': defaultParams = { rate: 50, depth: 50, mix: 50 }; break;
        case 'saturation': defaultParams = { drive: 50, mix: 100 }; break;
      }
      // Fill up to the slot index if needed
      while (insertFx.length <= action.slotIndex) {
        insertFx.push({ id: `empty-${Date.now()}-${Math.random()}`, type: 'filter', enabled: false, params: {} });
      }
      insertFx[action.slotIndex] = {
        id: `fx-${Date.now()}`,
        type: action.effectType,
        enabled: true,
        params: defaultParams
      };
      track.insertFx = insertFx;
      tracks[action.trackIndex] = track;
      return { ...state, tracks };
    }
    case 'REMOVE_INSERT_FX': {
      const tracks = [...state.tracks];
      const track = { ...tracks[action.trackIndex] };
      const insertFx = [...(track.insertFx || [])];
      if (insertFx[action.slotIndex]) {
        // Replace with empty disabled effect to preserve slot indices
        insertFx[action.slotIndex] = { id: `empty-${Date.now()}`, type: 'filter', enabled: false, params: {} };
      }
      track.insertFx = insertFx;
      tracks[action.trackIndex] = track;
      return { ...state, tracks };
    }
    case 'SET_INSERT_FX_PARAM': {
      const tracks = [...state.tracks];
      const track = { ...tracks[action.trackIndex] };
      const insertFx = [...(track.insertFx || [])];
      if (insertFx[action.slotIndex]) {
        insertFx[action.slotIndex] = {
          ...insertFx[action.slotIndex],
          params: { ...insertFx[action.slotIndex].params, [action.param]: action.value }
        };
      }
      track.insertFx = insertFx;
      tracks[action.trackIndex] = track;
      return { ...state, tracks };
    }
    case 'TOGGLE_INSERT_FX': {
      const tracks = [...state.tracks];
      const track = { ...tracks[action.trackIndex] };
      const insertFx = [...(track.insertFx || [])];
      if (insertFx[action.slotIndex] && insertFx[action.slotIndex].params && Object.keys(insertFx[action.slotIndex].params).length > 0) {
        insertFx[action.slotIndex] = {
          ...insertFx[action.slotIndex],
          enabled: !insertFx[action.slotIndex].enabled
        };
      }
      track.insertFx = insertFx;
      tracks[action.trackIndex] = track;
      return { ...state, tracks };
    }
    case 'RENAME_TRACK': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = { ...tracks[action.trackIndex], name: action.name };
      return { ...state, tracks };
    }
    case 'SET_TRACK_COLOR': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = { ...tracks[action.trackIndex], color: action.color };
      return { ...state, tracks };
    }
    case 'SET_PLAYBACK_MODE':
      return {
        ...state,
        playbackMode: action.mode,
        songPosition: 0,
        songRepeatCount: 0,
        // When entering song mode with blocks, set pattern to first block's pattern
        ...(action.mode === 'song' && state.songArrangement.length > 0
          ? { activePattern: state.songArrangement[0].pattern }
          : {}),
      };

    /* ─── Song Arrangement ─── */
    case 'ADD_SONG_BLOCK': {
      const newBlock: SongBlock = {
        id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pattern: action.pattern,
        repeats: action.repeats ?? 1,
        label: action.label,
      };
      return { ...state, songArrangement: [...state.songArrangement, newBlock] };
    }
    case 'REMOVE_SONG_BLOCK': {
      const arr = state.songArrangement.filter((_, i) => i !== action.index);
      return {
        ...state,
        songArrangement: arr,
        songPosition: Math.min(state.songPosition, Math.max(0, arr.length - 1)),
      };
    }
    case 'REORDER_SONG_BLOCKS': {
      const arr = [...state.songArrangement];
      const [moved] = arr.splice(action.fromIndex, 1);
      arr.splice(action.toIndex, 0, moved);
      return { ...state, songArrangement: arr };
    }
    case 'UPDATE_SONG_BLOCK': {
      const arr = [...state.songArrangement];
      arr[action.index] = { ...arr[action.index], ...action.changes };
      return { ...state, songArrangement: arr };
    }
    case 'SET_SONG_POSITION':
      return {
        ...state,
        songPosition: action.position,
        songRepeatCount: 0,
        activePattern: state.songArrangement[action.position]?.pattern ?? state.activePattern,
      };

    case 'LOAD_PRESET': {
      // Batch preset loading — single dispatch replaces O(N×M) individual toggles
      const tracks = state.tracks.map((track, tIdx) => {
        const data = action.preset[tIdx];
        // Clear all steps first
        const clearedSteps = getActivePattern(track, state.activePattern).map(() => createDefaultStep());
        if (!data) return setActivePattern(track, state.activePattern, clearedSteps);
        
        // Apply preset steps
        data.steps.forEach((stepIdx, i) => {
          if (stepIdx < clearedSteps.length) {
            clearedSteps[stepIdx] = {
              ...clearedSteps[stepIdx],
              enabled: true,
              velocity: data.vel?.[i] ?? 100,
            };
          }
        });
        return setActivePattern(track, state.activePattern, clearedSteps);
      });
      return { ...state, tracks };
    }

    case 'LOAD_ORACLE_PATTERN': {
      const tracks = [...state.tracks];
      const track = { ...tracks[action.trackIndex] };
      
      if (state.activePattern === 'A') {
        track.patternA = action.steps;
      } else {
        track.patternB = action.steps;
      }

      if (track.sourceType === 'synth' && track.synthConfig) {
        const synthConfig = { ...track.synthConfig };
        if (action.noteMap) {
          synthConfig.noteMap = [...action.noteMap];
        }
        if (action.pianoNotes) {
          synthConfig.pianoRollNotes = [...action.pianoNotes];
        }
        if (action.usePianoRoll !== undefined) {
          synthConfig.usePianoRoll = action.usePianoRoll;
        }
        track.synthConfig = synthConfig;
      }
      
      tracks[action.trackIndex] = track;
      return { ...state, tracks };
    }

    /* ─── Clipboard Actions ─── */
    case 'COPY_TRACK_PATTERN': {
      const track = state.tracks[state.selectedTrack];
      if (!track) return state;
      const pattern = getActivePattern(track, state.activePattern);
      return { ...state, clipboardPattern: pattern.map(s => ({ ...s })) };
    }
    case 'PASTE_TRACK_PATTERN': {
      if (!state.clipboardPattern) return state;
      const track = state.tracks[state.selectedTrack];
      if (!track) return state;
      // Paste clipboard, truncating or padding to match stepCount
      const pastedSteps = Array.from({ length: state.stepCount }, (_, i) =>
        i < state.clipboardPattern!.length
          ? { ...state.clipboardPattern![i] }
          : createDefaultStep()
      );
      const tracks = state.tracks.map((t, idx) =>
        idx === state.selectedTrack ? setActivePattern(t, state.activePattern, pastedSteps) : t
      );
      return { ...state, tracks };
    }
    case 'SWAP_PATTERNS': {
      const track = state.tracks[state.selectedTrack];
      if (!track) return state;
      const swapped: TrackState = {
        ...track,
        patternA: [...track.patternB],
        patternB: [...track.patternA],
      };
      const tracks = state.tracks.map((t, idx) =>
        idx === state.selectedTrack ? swapped : t
      );
      return { ...state, tracks };
    }
    case 'COPY_TRACK': {
      const track = state.tracks[action.trackIndex];
      if (!track) return state;
      return {
        ...state,
        clipboardTrack: JSON.parse(JSON.stringify(track)),
      };
    }
    case 'PASTE_TRACK': {
      if (!state.clipboardTrack) return state;
      const tracks = state.tracks.map((t, idx) =>
        idx === action.trackIndex
          ? {
              ...JSON.parse(JSON.stringify(state.clipboardTrack)),
              id: t.id, // preserve destination track ID
            }
          : t
      );
      return { ...state, tracks };
    }
    case 'SWAP_TRACKS': {
      const { trackIndexA, trackIndexB } = action;
      if (
        trackIndexA < 0 || trackIndexA >= state.tracks.length ||
        trackIndexB < 0 || trackIndexB >= state.tracks.length
      ) {
        return state;
      }
      const tracks = [...state.tracks];
      const temp = tracks[trackIndexA];
      tracks[trackIndexA] = tracks[trackIndexB];
      tracks[trackIndexB] = temp;
      return { ...state, tracks };
    }
    case 'SWAP_TRACK_WITH_CLIPBOARD': {
      if (!state.clipboardTrack) return state;
      const currentTrack = state.tracks[state.selectedTrack];
      const tracks = state.tracks.map((t, idx) =>
        idx === state.selectedTrack
          ? {
              ...JSON.parse(JSON.stringify(state.clipboardTrack)),
              id: t.id, // preserve destination track ID
            }
          : t
      );
      return {
        ...state,
        tracks,
        clipboardTrack: JSON.parse(JSON.stringify(currentTrack)),
      };
    }
    case 'ROTATE_TRACK_PATTERN': {
      const { trackIndex, direction } = action;
      const track = state.tracks[trackIndex];
      if (!track) return state;
      const fullPattern = getActivePattern(track, state.activePattern);
      const len = track.polymetricLength || state.stepCount;
      
      const activeSteps = fullPattern.slice(0, len);
      const remainingSteps = fullPattern.slice(len);
      
      if (direction === 'left') {
        const first = activeSteps.shift();
        if (first !== undefined) activeSteps.push(first);
      } else {
        const last = activeSteps.pop();
        if (last !== undefined) activeSteps.unshift(last);
      }
      
      const newPattern = [...activeSteps, ...remainingSteps];
      const tracks = state.tracks.map((t, idx) =>
        idx === trackIndex ? setActivePattern(t, state.activePattern, newPattern) : t
      );
      return { ...state, tracks };
    }
    case 'FILL_STEPS': {
      const { trackIndex, interval } = action;
      const track = state.tracks[trackIndex];
      if (!track) return state;
      const fullPattern = [...getActivePattern(track, state.activePattern)];
      const len = track.polymetricLength || state.stepCount;
      for (let i = 0; i < len; i++) {
        fullPattern[i].enabled = (i % interval === 0);
      }
      const tracks = state.tracks.map((t, idx) =>
        idx === trackIndex ? setActivePattern(t, state.activePattern, fullPattern) : t
      );
      return { ...state, tracks };
    }
    case 'DUPLICATE_TRACK_PATTERN': {
      const { trackIndex } = action;
      const track = state.tracks[trackIndex];
      if (!track) return state;
      const pattern = [...getActivePattern(track, state.activePattern)];
      const len = track.polymetricLength || state.stepCount;
      
      const newPattern = [...pattern];
      for (let i = 0; i < len; i++) {
        const destIdx = i + len;
        if (destIdx < pattern.length) {
          newPattern[destIdx] = { ...pattern[i] };
        }
      }
      
      const tracks = state.tracks.map((t, idx) =>
        idx === trackIndex ? setActivePattern(t, state.activePattern, newPattern) : t
      );
      return { ...state, tracks };
    }

    /* ═══ Automation Lane Actions ═══ */
    case 'ADD_AUTOMATION_LANE': {
      const track = state.tracks[action.trackIndex];
      if (!track) return state;
      // Don't add duplicate param lanes
      if (track.automationLanes.some(l => l.param === action.param)) return state;
      const newLane: AutomationLane = {
        param: action.param,
        enabled: true,
        points: [],
        curveType: 'linear',
      };
      const tracks = state.tracks.map((t, i) =>
        i === action.trackIndex
          ? { ...t, automationLanes: [...t.automationLanes, newLane] }
          : t
      );
      return { ...state, tracks };
    }
    case 'REMOVE_AUTOMATION_LANE': {
      const track = state.tracks[action.trackIndex];
      if (!track) return state;
      const tracks = state.tracks.map((t, i) =>
        i === action.trackIndex
          ? { ...t, automationLanes: t.automationLanes.filter(l => l.param !== action.param) }
          : t
      );
      return { ...state, tracks };
    }
    case 'SET_AUTOMATION_POINT': {
      const track = state.tracks[action.trackIndex];
      if (!track) return state;
      const tracks = state.tracks.map((t, i) => {
        if (i !== action.trackIndex) return t;
        const lanes = t.automationLanes.map(lane => {
          if (lane.param !== action.param) return lane;
          // Replace existing point at same step, or insert sorted
          let points = lane.points.filter(p => Math.abs(p.step - action.point.step) > 0.01);
          points.push(action.point);
          points.sort((a, b) => a.step - b.step);
          return { ...lane, points };
        });
        return { ...t, automationLanes: lanes };
      });
      return { ...state, tracks };
    }
    case 'REMOVE_AUTOMATION_POINT': {
      const track = state.tracks[action.trackIndex];
      if (!track) return state;
      const tracks = state.tracks.map((t, i) => {
        if (i !== action.trackIndex) return t;
        const lanes = t.automationLanes.map(lane => {
          if (lane.param !== action.param) return lane;
          return { ...lane, points: lane.points.filter((_, idx) => idx !== action.pointIndex) };
        });
        return { ...t, automationLanes: lanes };
      });
      return { ...state, tracks };
    }
    case 'SET_AUTOMATION_POINTS': {
      const track = state.tracks[action.trackIndex];
      if (!track) return state;
      const sorted = [...action.points].sort((a, b) => a.step - b.step);
      const tracks = state.tracks.map((t, i) => {
        if (i !== action.trackIndex) return t;
        const lanes = t.automationLanes.map(lane =>
          lane.param === action.param ? { ...lane, points: sorted } : lane
        );
        return { ...t, automationLanes: lanes };
      });
      return { ...state, tracks };
    }
    case 'TOGGLE_AUTOMATION_ENABLED': {
      const track = state.tracks[action.trackIndex];
      if (!track) return state;
      const tracks = state.tracks.map((t, i) => {
        if (i !== action.trackIndex) return t;
        const lanes = t.automationLanes.map(lane =>
          lane.param === action.param ? { ...lane, enabled: !lane.enabled } : lane
        );
        return { ...t, automationLanes: lanes };
      });
      return { ...state, tracks };
    }
    case 'SET_AUTOMATION_CURVE_TYPE': {
      const track = state.tracks[action.trackIndex];
      if (!track) return state;
      const tracks = state.tracks.map((t, i) => {
        if (i !== action.trackIndex) return t;
        const lanes = t.automationLanes.map(lane =>
          lane.param === action.param ? { ...lane, curveType: action.curveType } : lane
        );
        return { ...t, automationLanes: lanes };
      });
      return { ...state, tracks };
    }
    case 'RECORD_AUTOMATION_SNAPSHOT': {
      // Upserts a point during live recording
      const track = state.tracks[action.trackIndex];
      if (!track) return state;
      const clampedValue = Math.max(0, Math.min(1, action.value));
      const newPoint: AutomationPoint = { step: action.step, value: clampedValue };
      const tracks = state.tracks.map((t, i) => {
        if (i !== action.trackIndex) return t;
        
        const laneExists = t.automationLanes.some(lane => lane.param === action.param);
        let lanes;
        if (!laneExists) {
          // Auto-insert a new lane if it doesn't exist
          const newLane: AutomationLane = {
            param: action.param,
            enabled: true,
            points: [newPoint],
            curveType: 'linear'
          };
          lanes = [...t.automationLanes, newLane];
        } else {
          lanes = t.automationLanes.map(lane => {
            if (lane.param !== action.param) return lane;
            // Merge: remove points within ±0.1 step of new point, then insert
            let points = lane.points.filter(p => Math.abs(p.step - action.step) > 0.1);
            points.push(newPoint);
            points.sort((a, b) => a.step - b.step);
            return { ...lane, points };
          });
        }
        return { ...t, automationLanes: lanes };
      });
      return { ...state, tracks };
    }

    /* ═══ Phase A/B: FL Studio Quality Upgrade Actions ═══ */
    case 'SET_TRACK_PAN': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = { ...tracks[action.trackIndex], pan: Math.max(-1, Math.min(1, action.pan)) };
      return { ...state, tracks };
    }
    case 'SET_TRACK_SWING': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = { ...tracks[action.trackIndex], swing: Math.max(0, Math.min(100, action.swing)) };
      return { ...state, tracks };
    }
    case 'HUMANIZE_TRACK': {
      // Randomize velocity ±amount and micro-timing ±amount/2 for enabled steps
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      const pattern = getActivePattern(track, state.activePattern);
      const humanized = pattern.map(step => {
        if (!step.enabled) return step;
        const velJitter = Math.round((Math.random() - 0.5) * 2 * action.amount);
        const microJitter = Math.round((Math.random() - 0.5) * action.amount);
        return {
          ...step,
          velocity: Math.max(1, Math.min(127, step.velocity + velJitter)),
          microTiming: Math.max(-50, Math.min(50, step.microTiming + microJitter)),
        };
      });
      tracks[action.trackIndex] = setActivePattern(track, state.activePattern, humanized);
      return { ...state, tracks };
    }
    case 'QUANTIZE_TRACK': {
      // Reset all micro-timing to 0 (snap to grid)
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      const pattern = getActivePattern(track, state.activePattern);
      const quantized = pattern.map(step => ({ ...step, microTiming: 0 }));
      tracks[action.trackIndex] = setActivePattern(track, state.activePattern, quantized);
      return { ...state, tracks };
    }
    case 'SET_TRACK_EQ': {
      const tracks = [...state.tracks];
      const track = { ...tracks[action.trackIndex] };
      const clamped = Math.max(-12, Math.min(12, action.value));
      if (action.band === 'low') track.eqLow = clamped;
      else if (action.band === 'mid') track.eqMid = clamped;
      else track.eqHigh = clamped;
      tracks[action.trackIndex] = track;
      return { ...state, tracks };
    }

    /* ─── Phase C: Multi-step Selection ─── */
    case 'SELECT_STEP': {
      const { stepIndex, additive, range } = action;
      if (range && state.selectionAnchor !== null) {
        // Shift+click: select range from anchor to stepIndex
        const from = Math.min(state.selectionAnchor, stepIndex);
        const to = Math.max(state.selectionAnchor, stepIndex);
        const rangeSteps = Array.from({ length: to - from + 1 }, (_, i) => from + i);
        return { ...state, selectedSteps: rangeSteps };
      }
      if (additive) {
        // Ctrl+click: toggle individual step in selection
        const exists = state.selectedSteps.includes(stepIndex);
        const selectedSteps = exists
          ? state.selectedSteps.filter(s => s !== stepIndex)
          : [...state.selectedSteps, stepIndex].sort((a, b) => a - b);
        return { ...state, selectedSteps, selectionAnchor: stepIndex };
      }
      // Plain click: select single step
      return { ...state, selectedSteps: [stepIndex], selectionAnchor: stepIndex };
    }
    case 'SELECT_STEP_RANGE': {
      const from = Math.min(action.from, action.to);
      const to = Math.max(action.from, action.to);
      const rangeSteps = Array.from({ length: to - from + 1 }, (_, i) => from + i);
      return { ...state, selectedSteps: rangeSteps, selectionAnchor: action.from };
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedSteps: [], selectionAnchor: null };
    case 'COPY_SELECTED_STEPS': {
      if (state.selectedSteps.length === 0) return state;
      const track = state.tracks[state.selectedTrack];
      const pattern = getActivePattern(track, state.activePattern);
      const copied = state.selectedSteps
        .filter(i => i >= 0 && i < pattern.length)
        .sort((a, b) => a - b)
        .map(i => ({ ...pattern[i] }));
      return { ...state, clipboardSteps: copied };
    }
    case 'PASTE_SELECTED_STEPS': {
      if (!state.clipboardSteps || state.clipboardSteps.length === 0) return state;
      const tracks = [...state.tracks];
      const track = tracks[state.selectedTrack];
      const pattern = [...getActivePattern(track, state.activePattern)];
      const startIdx = action.startIndex;
      for (let i = 0; i < state.clipboardSteps.length && startIdx + i < pattern.length; i++) {
        pattern[startIdx + i] = { ...state.clipboardSteps[i] };
      }
      tracks[state.selectedTrack] = setActivePattern(track, state.activePattern, pattern);
      return { ...state, tracks };
    }
    case 'DELETE_SELECTED_STEPS': {
      if (state.selectedSteps.length === 0) return state;
      const tracks = [...state.tracks];
      const track = tracks[state.selectedTrack];
      const pattern = [...getActivePattern(track, state.activePattern)];
      for (const idx of state.selectedSteps) {
        if (idx >= 0 && idx < pattern.length) {
          pattern[idx] = { ...pattern[idx], enabled: false, velocity: 80 };
        }
      }
      tracks[state.selectedTrack] = setActivePattern(track, state.activePattern, pattern);
      return { ...state, tracks, selectedSteps: [] };
    }

    /* ─── Phase C: Bus Routing ─── */
    case 'SET_BUS_INPUT_TRACKS': {
      const tracks = [...state.tracks];
      const track = { ...tracks[action.trackIndex] };
      if (track.sourceType !== 'bus') return state;
      track.busConfig = { inputTrackIds: action.inputTrackIds };
      tracks[action.trackIndex] = track;
      return { ...state, tracks };
    }

    /* ─── Phase D: Selection Toolbar Actions ─── */
    case 'REVERSE_SELECTED_STEPS': {
      if (state.selectedSteps.length < 2) return state;
      const tracks = [...state.tracks];
      const track = tracks[state.selectedTrack];
      const pattern = [...getActivePattern(track, state.activePattern)];
      const sorted = [...state.selectedSteps].sort((a, b) => a - b);
      const stepsData = sorted.map(i => ({ ...pattern[i] }));
      stepsData.reverse();
      sorted.forEach((idx, i) => { pattern[idx] = stepsData[i]; });
      tracks[state.selectedTrack] = setActivePattern(track, state.activePattern, pattern);
      return { ...state, tracks };
    }
    case 'DOUBLE_SELECTED_STEPS': {
      if (state.selectedSteps.length === 0) return state;
      const tracks = [...state.tracks];
      const track = tracks[state.selectedTrack];
      const pattern = [...getActivePattern(track, state.activePattern)];
      const sorted = [...state.selectedSteps].sort((a, b) => a - b);
      const offset = sorted.length;
      for (let i = 0; i < sorted.length; i++) {
        const destIdx = sorted[i] + offset;
        if (destIdx < pattern.length) {
          pattern[destIdx] = { ...pattern[sorted[i]] };
        }
      }
      tracks[state.selectedTrack] = setActivePattern(track, state.activePattern, pattern);
      return { ...state, tracks };
    }
    case 'HALVE_SELECTED_STEPS': {
      if (state.selectedSteps.length < 2) return state;
      const tracks = [...state.tracks];
      const track = tracks[state.selectedTrack];
      const pattern = [...getActivePattern(track, state.activePattern)];
      const sorted = [...state.selectedSteps].sort((a, b) => a - b);
      // Disable every other step in the selection
      sorted.forEach((idx, i) => {
        if (i % 2 === 1) {
          pattern[idx] = { ...pattern[idx], enabled: false };
        }
      });
      tracks[state.selectedTrack] = setActivePattern(track, state.activePattern, pattern);
      return { ...state, tracks };
    }
    case 'RANDOMIZE_SELECTED_VELOCITY': {
      if (state.selectedSteps.length === 0) return state;
      const tracks = [...state.tracks];
      const track = tracks[state.selectedTrack];
      const pattern = [...getActivePattern(track, state.activePattern)];
      for (const idx of state.selectedSteps) {
        if (idx >= 0 && idx < pattern.length && pattern[idx].enabled) {
          pattern[idx] = {
            ...pattern[idx],
            velocity: Math.round(40 + Math.random() * 87), // 40-127
          };
        }
      }
      tracks[state.selectedTrack] = setActivePattern(track, state.activePattern, pattern);
      return { ...state, tracks };
    }

    /* ═══ Piano Roll ═══ */
    case 'ADD_PIANO_NOTE': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      if (!track.synthConfig) return state;
      tracks[action.trackIndex] = {
        ...track,
        synthConfig: {
          ...track.synthConfig,
          pianoRollNotes: [...track.synthConfig.pianoRollNotes, action.note],
        },
      };
      return { ...state, tracks };
    }
    case 'REMOVE_PIANO_NOTE': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      if (!track.synthConfig) return state;
      tracks[action.trackIndex] = {
        ...track,
        synthConfig: {
          ...track.synthConfig,
          pianoRollNotes: track.synthConfig.pianoRollNotes.filter(n => n.id !== action.noteId),
        },
      };
      return { ...state, tracks };
    }
    case 'UPDATE_PIANO_NOTE': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      if (!track.synthConfig) return state;
      tracks[action.trackIndex] = {
        ...track,
        synthConfig: {
          ...track.synthConfig,
          pianoRollNotes: track.synthConfig.pianoRollNotes.map(n =>
            n.id === action.noteId ? { ...n, ...action.changes } : n
          ),
        },
      };
      return { ...state, tracks };
    }
    case 'TOGGLE_PIANO_ROLL_MODE': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      if (!track.synthConfig) return state;
      tracks[action.trackIndex] = {
        ...track,
        synthConfig: {
          ...track.synthConfig,
          usePianoRoll: !track.synthConfig.usePianoRoll,
        },
      };
      return { ...state, tracks };
    }

    /* ═══ Track Bounce/Freeze ═══ */
    case 'FREEZE_TRACK': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = { ...tracks[action.trackIndex], isFrozen: true };
      return { ...state, tracks };
    }
    case 'UNFREEZE_TRACK': {
      const tracks = [...state.tracks];
      tracks[action.trackIndex] = { ...tracks[action.trackIndex], isFrozen: false };
      return { ...state, tracks };
    }
    case 'TOGGLE_RECORD_ARM': {
      const tracks = [...state.tracks];
      const track = tracks[action.trackIndex];
      // Only one track can be record-armed at a time
      const nextArmed = !track.isRecordArmed;
      tracks.forEach((t, i) => { tracks[i] = { ...t, isRecordArmed: i === action.trackIndex ? nextArmed : false }; });
      return { ...state, tracks };
    }

    default:
      return state;
  }
}

/* ═══ Swing Helpers ═══ */
function applySwing(stepIndex: number, stepDuration: number, swingAmount: number): number {
  if (swingAmount === 0 || stepIndex % 2 === 0) return 0;
  return stepDuration * (swingAmount / 200); // Shift odd steps forward
}

/** Get effective swing for a track (per-track override or global) */
function getTrackSwing(track: TrackState, globalSwing: number): number {
  return track.swing > 0 ? track.swing : globalSwing;
}

function shouldTrigger(step: StepState, isFillMode: boolean, cycleCount: number): boolean {
  if (!step.enabled) return false;
  // Trig conditions
  switch (step.trigCondition) {
    case 'fill': if (!isFillMode) return false; break;
    case 'notFill': if (isFillMode) return false; break;
    case '1:2': if (cycleCount % 2 !== 0) return false; break;
    case '1:4': if (cycleCount % 4 !== 0) return false; break;
    case '1:8': if (cycleCount % 8 !== 0) return false; break;
  }
  // Probability
  if (step.probability < 100 && Math.random() * 100 > step.probability) return false;
  return true;
}

/* ═══ Undo History Config ═══ */
const HISTORY_IGNORE_ACTIONS = [
  'SET_CURRENT_STEP',
  'INCREMENT_CYCLE',
  'PLAY',
  'STOP',
  'SET_SONG_POSITION',
  'RECORD_AUTOMATION_SNAPSHOT',
  'TOGGLE_AUTOMATION_RECORD',
];

const CLOCK_WORKLET_CODE = `
class GodRealmClockWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.tickIntervalSamples = Math.floor(sampleRate * 0.025); 
    this.samplesSinceLastTick = 0;

    this.port.onmessage = (event) => {
      if (event.data.type === 'SET_INTERVAL') {
        const ms = event.data.intervalMs || 25;
        this.tickIntervalSamples = Math.floor(sampleRate * (ms / 1000));
      }
    };
  }

  process(inputs, outputs, parameters) {
    this.samplesSinceLastTick += 128;

    if (this.samplesSinceLastTick >= this.tickIntervalSamples) {
      this.samplesSinceLastTick -= this.tickIntervalSamples;
      this.port.postMessage({ type: 'tick' });
    }

    return true;
  }
}

registerProcessor('god-realm-clock-worklet', GodRealmClockWorklet);
`;

/* ═══ Hook ═══ */
export function useSequencerEngine(
  sharedAudioCtx?: React.RefObject<AudioContext | null>,
  sharedMasterChain?: React.RefObject<MasterChain | null>,
) {
  const { state, dispatch, undo, redo, canUndo, canRedo, clearHistory } =
    useUndoableReducer(sequencerReducer, createInitialState(), {
      maxHistory: 50,
      ignoreActions: HISTORY_IGNORE_ACTIONS,
    });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerIdRef = useRef<number | null>(null);
  const clockNodeRef = useRef<AudioWorkletNode | null>(null);
  const nextStepTimeRef = useRef(0);
  const currentStepRef = useRef(-1);
  const masterChainRef = useRef<MasterChain | null>(null);
  const fxRackRef = useRef<FXRack | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Auto-save to localStorage (debounced, skips playhead-only changes)
  const prevPersistRef = useRef('');
  useEffect(() => {
    // Always sync master params immediately (cheap operation)
    if (masterChainRef.current) {
      masterChainRef.current.updateParams(state.master);
    }

    // Skip persistence for playhead-only changes during playback
    const { currentStep, cycleCount, ...persistableState } = state;
    const key = JSON.stringify(persistableState);
    if (key === prevPersistRef.current) return; // No meaningful change

    const timer = setTimeout(() => {
      prevPersistRef.current = key;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 500);

    return () => clearTimeout(timer);
  }, [state]);

  // Trigger callback — override from parent to play actual samples
  const onTriggerRef = useRef<((trackIndex: number, step: StepState, time: number, polyStep: number) => void) | null>(null);

  const setOnTrigger = useCallback((fn: (trackIndex: number, step: StepState, time: number, polyStep: number) => void) => {
    onTriggerRef.current = fn;
  }, []);

  // Automation callback — override from parent to apply automation values to audio graph
  const onAutomationRef = useRef<((trackIndex: number, param: AutomationParam, value: number, time: number) => void) | null>(null);

  const setOnAutomation = useCallback((fn: (trackIndex: number, param: AutomationParam, value: number, time: number) => void) => {
    onAutomationRef.current = fn;
  }, []);

  const LOOKAHEAD = 0.1;       // seconds to look ahead
  const SCHEDULE_INTERVAL = 25; // ms between scheduler calls

  const scheduleStep = useCallback(() => {
    const s = stateRef.current;
    if (!s.isPlaying || !audioCtxRef.current) return;

    const ctx = audioCtxRef.current;
    const stepDuration = 60 / s.bpm / 4; // 16th note duration

    while (nextStepTimeRef.current < ctx.currentTime + LOOKAHEAD) {
      currentStepRef.current = (currentStepRef.current + 1) % s.stepCount;
      const stepIdx = currentStepRef.current;

      // Check for cycle increment
      if (stepIdx === 0) {
        dispatch({ type: 'INCREMENT_CYCLE' });
      }

      const hasSolo = s.tracks.some(t => t.soloed);

      // ═══ Automation Playback — apply automation lane values for this step ═══
      s.tracks.forEach((track, tIdx) => {
        if (!track.automationLanes || track.automationLanes.length === 0) return;
        for (const lane of track.automationLanes) {
          const val = getAutomationValue(lane, stepIdx);
          if (val !== null && onAutomationRef.current) {
            onAutomationRef.current(tIdx, lane.param, val, nextStepTimeRef.current);
          }
        }
      });

      s.tracks.forEach((track, trackIdx) => {
        // Mute/solo logic
        if (track.muted) return;
        if (hasSolo && !track.soloed) return;

        const pattern = s.activePattern === 'A' ? track.patternA : track.patternB;
        const polyStep = stepIdx % track.polymetricLength;
        if (polyStep >= pattern.length) return;

        const step = pattern[polyStep];
        if (!shouldTrigger(step, s.isFillMode, s.cycleCount)) return;

        // Calculate timing with swing (per-track or global) and micro-timing
        const effectiveSwing = getTrackSwing(track, s.swing);
        const swingOffset = applySwing(stepIdx, stepDuration, effectiveSwing);
        const microOffset = stepDuration * (step.microTiming / 100);
        const triggerTime = nextStepTimeRef.current + swingOffset + microOffset;

        // Handle Retrigs (Sub-steps)
        if (step.retrigRate) {
          const divisions: Record<string, number> = {
            '1/2': 2, '1/4': 4, '1/8': 8, '1/16': 16, '1/32': 32
          };
          const count = divisions[step.retrigRate] || 1;
          const subStepDuration = stepDuration / count;

          for (let i = 0; i < count; i++) {
            const subTime = triggerTime + (i * subStepDuration);
            
            // Calculate velocity for this sub-hit based on curve
            let subVelocity = step.velocity;
            if (step.retrigVelocityCurve === 'rampUp') {
              subVelocity = step.velocity * (0.3 + (0.7 * (i / (count - 1 || 1))));
            } else if (step.retrigVelocityCurve === 'rampDown') {
              subVelocity = step.velocity * (1.0 - (0.7 * (i / (count - 1 || 1))));
            } else if (step.retrigVelocityCurve === 'random') {
              subVelocity = step.velocity * (0.5 + Math.random() * 0.5);
            }

            const subStep = { ...step, velocity: subVelocity };

            if (onTriggerRef.current) {
              onTriggerRef.current(trackIdx, subStep, subTime, polyStep);
            }
          }
        } else {
          // Normal Trigger
          if (onTriggerRef.current) {
            onTriggerRef.current(trackIdx, step, triggerTime, polyStep);
          }
        }
      });

      // Update UI step — throttled to reduce React re-render churn
      // Direct ref update is always current; dispatch is throttled
      if (s.currentStep !== stepIdx) {
        dispatch({ type: 'SET_CURRENT_STEP', step: stepIdx });
      }

      nextStepTimeRef.current += stepDuration;
    }
  }, []);

  const initAudio = async () => {
    if (nativeAudio.isInJuce()) {
      return;
    }
    if (!audioCtxRef.current) {
      // Phase 1: Use shared AudioContext if provided, otherwise create our own
      if (sharedAudioCtx?.current) {
        audioCtxRef.current = sharedAudioCtx.current;
      } else {
        audioCtxRef.current = new AudioContext();
      }

      // Phase 3: Load the highly-accurate Clock Worklet
      try {
        const blob = new Blob([CLOCK_WORKLET_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await audioCtxRef.current.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        clockNodeRef.current = new AudioWorkletNode(audioCtxRef.current, 'god-realm-clock-worklet');
        clockNodeRef.current.port.onmessage = (e) => {
          if (e.data.type === 'tick') {
            scheduleStep();
          }
        };
        clockNodeRef.current.connect(audioCtxRef.current.destination);
      } catch (err: any) {
        if (err.name !== 'AbortError' && audioCtxRef.current?.state !== 'closed') {
          console.warn('GodRealmClockWorklet failed to load, falling back to setInterval clock:', err);
        }
      }

      // Phase 3: Use shared MasterChain (Celestial Forge) if provided
      if (sharedMasterChain?.current) {
        masterChainRef.current = sharedMasterChain.current;
      } else {
        masterChainRef.current = new MasterChain(audioCtxRef.current);
        masterChainRef.current.connect(audioCtxRef.current.destination);
      }
      masterChainRef.current.updateParams(stateRef.current.master);
      // Insert FXRack between tracks and MasterChain
      fxRackRef.current = new FXRack(audioCtxRef.current, masterChainRef.current.input);
      fxRackRef.current.updateBPM(stateRef.current.bpm);
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
  };

  const play = useCallback(async () => {
    if (nativeAudio.isInJuce()) {
      dispatch({ type: 'PLAY' });
      return;
    }
    await initAudio();

    currentStepRef.current = -1;
    // Only set nextStepTime once we're sure audio is running
    nextStepTimeRef.current = audioCtxRef.current!.currentTime + 0.05;
    dispatch({ type: 'PLAY' });

    // If the Worklet loaded, it is already ticking in the background. 
    // If not, fallback to setInterval.
    if (!clockNodeRef.current) {
      if (schedulerIdRef.current) clearInterval(schedulerIdRef.current);
      schedulerIdRef.current = window.setInterval(scheduleStep, SCHEDULE_INTERVAL);
    }
  }, [scheduleStep]);

  const stop = useCallback(() => {
    if (nativeAudio.isInJuce()) {
      dispatch({ type: 'STOP' });
      return;
    }
    if (schedulerIdRef.current) {
      clearInterval(schedulerIdRef.current);
      schedulerIdRef.current = null;
    }
    dispatch({ type: 'STOP' });
  }, []);

  const togglePlay = useCallback(() => {
    if (stateRef.current.isPlaying) stop();
    else play();
  }, [play, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (schedulerIdRef.current) clearInterval(schedulerIdRef.current);
      if (clockNodeRef.current) {
        clockNodeRef.current.disconnect();
      }
      // Only close the AudioContext if we created it (not shared from parent)
      if (audioCtxRef.current && !sharedAudioCtx?.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return {
    state,
    dispatch,
    play,
    stop,
    togglePlay,
    setOnTrigger,
    setOnAutomation,
    audioCtx: audioCtxRef,
    masterChain: masterChainRef,
    fxRack: fxRackRef,
    /* Undo/Redo */

    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}

