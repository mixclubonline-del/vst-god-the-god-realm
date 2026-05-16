/**
 * useSequencerEngine — Web Audio Lookahead Scheduler
 * Sample-accurate step sequencer timing via AudioContext clock.
 * Uses the "two clocks" pattern: JS timer for scheduling, AudioContext for playback.
 *
 * Sacred Sequence Ascension — Universal Track Architecture
 * Supports sample, synth, and bus track types with dynamic add/remove (up to 16).
 */
import { useReducer, useRef, useCallback, useEffect } from 'react';
import { MasterChain, MasterParams } from '../../audio/VelvetCurveEngine';
import type { ElectricPantheonGodId } from '../../data/electricPantheonGods';

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
}

export interface SynthTrackConfig {
  godId: ElectricPantheonGodId;
  octave: number;               // -2 to +2
  voiceMode: VoiceMode;
  macros: { energy: number; divinity: number; width: number; realm: number };
  noteMap: number[];            // per-step MIDI note (60 = C4), length = MAX_STEPS
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

export interface TrackState {
  id: string;
  name: string;
  color: string;
  icon: string;
  muted: boolean;
  soloed: boolean;
  volume: number;
  polymetricLength: number;
  patternA: StepState[];
  patternB: StepState[];
  sourceType: TrackSourceType;
  synthConfig?: SynthTrackConfig;
  busConfig?: BusTrackConfig;
  fxSends: FXSendState;
  sampleParams: {
    start: number;
    end: number;
    reverse: boolean;
    loop: boolean;
    loopStart: number;
    loopEnd: number;
    slices: { start: number; end: number; reverse?: boolean; loop?: boolean; volume?: number }[];
  };
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
}

/* ═══ Default Data ═══ */
const DEFAULT_TRACKS: { name: string; color: string; icon: string; sourceType: TrackSourceType; godId?: ElectricPantheonGodId }[] = [
  { name: 'KICK',     color: '#FFD700', icon: '💥', sourceType: 'sample' },
  { name: 'SNARE',    color: '#60A5FA', icon: '🥁', sourceType: 'sample' },
  { name: 'HI-HAT',   color: '#F5B041', icon: '🔔', sourceType: 'sample' },
  { name: '808',      color: '#E74C3C', icon: '🔶', sourceType: 'sample' },
  { name: 'PERC',     color: '#9B59B6', icon: '✦',  sourceType: 'sample' },
  { name: 'MELODY',   color: '#FFD700', icon: '⚡', sourceType: 'synth', godId: 'olympus' },
  { name: 'CHORDS',   color: '#A855F7', icon: '⚡', sourceType: 'synth', godId: 'athena' },
  { name: 'LEAD',     color: '#3B82F6', icon: '⚡', sourceType: 'synth', godId: 'zeus' },
  { name: 'PAD',      color: '#14B8A6', icon: '⚡', sourceType: 'synth', godId: 'poseidon' },
  { name: 'FX HIT',   color: '#22C55E', icon: '🌊', sourceType: 'sample' },
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
    slices: [],
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
  return {
    id: generateTrackId(),
    name: info.name, color: info.color, icon: info.icon,
    muted: false, soloed: false, volume: 0.8,
    polymetricLength: stepCount,
    patternA: Array.from({ length: stepCount }, () => createDefaultStep()),
    patternB: Array.from({ length: stepCount }, () => createDefaultStep()),
    sourceType,
    synthConfig: sourceType === 'synth' ? createDefaultSynthConfig(info.godId || 'olympus', stepCount) : undefined,
    busConfig: sourceType === 'bus' ? { inputTrackIds: [] } : undefined,
    fxSends: createDefaultFXSends(),
    sampleParams: createDefaultSampleParams(),
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
  };
}

/* ═══ Reducer Actions ═══ */
type SeqAction =
  | { type: 'PLAY' }
  | { type: 'STOP' }
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
  | { type: 'RENAME_TRACK'; trackIndex: number; name: string }
  | { type: 'SET_TRACK_COLOR'; trackIndex: number; color: string }
  | { type: 'SET_PLAYBACK_MODE'; mode: 'pattern' | 'song' };

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
      return { ...state, isPlaying: false, currentStep: -1 };
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
    case 'INCREMENT_CYCLE':
      return { ...state, cycleCount: state.cycleCount + 1 };
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
      return { ...state, playbackMode: action.mode };

    default:
      return state;
  }
}

/* ═══ Swing Helpers ═══ */
function applySwing(stepIndex: number, stepDuration: number, swingAmount: number): number {
  if (swingAmount === 0 || stepIndex % 2 === 0) return 0;
  return stepDuration * (swingAmount / 200); // Shift odd steps forward
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

/* ═══ Hook ═══ */
export function useSequencerEngine() {
  const [state, dispatch] = useReducer(sequencerReducer, null, createInitialState);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerIdRef = useRef<number | null>(null);
  const nextStepTimeRef = useRef(0);
  const currentStepRef = useRef(-1);
  const masterChainRef = useRef<MasterChain | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (masterChainRef.current) {
      masterChainRef.current.updateParams(state.master);
    }
  }, [state]);

  // Trigger callback — override from parent to play actual samples
  const onTriggerRef = useRef<((trackIndex: number, step: StepState, time: number) => void) | null>(null);

  const setOnTrigger = useCallback((fn: (trackIndex: number, step: StepState, time: number) => void) => {
    onTriggerRef.current = fn;
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

      s.tracks.forEach((track, trackIdx) => {
        // Mute/solo logic
        if (track.muted) return;
        if (hasSolo && !track.soloed) return;

        const pattern = s.activePattern === 'A' ? track.patternA : track.patternB;
        const polyStep = stepIdx % track.polymetricLength;
        if (polyStep >= pattern.length) return;

        const step = pattern[polyStep];
        if (!shouldTrigger(step, s.isFillMode, s.cycleCount)) return;

        // Calculate timing with swing and micro-timing
        const swingOffset = applySwing(stepIdx, stepDuration, s.swing);
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
              onTriggerRef.current(trackIdx, subStep, subTime);
            }
          }
        } else {
          // Normal Trigger
          if (onTriggerRef.current) {
            onTriggerRef.current(trackIdx, step, triggerTime);
          }
        }
      });

      // Update UI step (via dispatch, decoupled from audio)
      dispatch({ type: 'SET_CURRENT_STEP', step: stepIdx });
      nextStepTimeRef.current += stepDuration;
    }
  }, []);

  const play = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      masterChainRef.current = new MasterChain(audioCtxRef.current);
      masterChainRef.current.connect(audioCtxRef.current.destination);
      masterChainRef.current.updateParams(stateRef.current.master);
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    currentStepRef.current = -1;
    nextStepTimeRef.current = audioCtxRef.current.currentTime + 0.05;
    dispatch({ type: 'PLAY' });

    // Start scheduler loop
    if (schedulerIdRef.current) clearInterval(schedulerIdRef.current);
    schedulerIdRef.current = window.setInterval(scheduleStep, SCHEDULE_INTERVAL);
  }, [scheduleStep]);

  const stop = useCallback(() => {
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
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  return {
    state,
    dispatch,
    play,
    stop,
    togglePlay,
    setOnTrigger,
    audioCtx: audioCtxRef,
    masterChain: masterChainRef,
  };
}

