/**
 * useSequencerEngine — Web Audio Lookahead Scheduler
 * Sample-accurate step sequencer timing via AudioContext clock.
 * Uses the "two clocks" pattern: JS timer for scheduling, AudioContext for playback.
 */
import { useReducer, useRef, useCallback, useEffect } from 'react';
import { MasterChain, MasterParams } from '../../audio/VelvetCurveEngine';

/* ═══ Types ═══ */
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
  sampleParams: {
    start: number;
    end: number;
    reverse: boolean;
    loop: boolean;
    loopStart: number;
    loopEnd: number;
    slices: { start: number; end: number; reverse?: boolean; loop?: boolean }[];
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
  activeGraphMode: 'velocity' | 'pitch' | 'pan' | 'decay' | 'probability';
  selectedTrack: number;
  tracks: TrackState[];
  cycleCount: number;
  master: MasterParams;
}

/* ═══ Default Data ═══ */
const DEFAULT_TRACKS: { name: string; color: string; icon: string }[] = [
  { name: 'KICK',     color: '#ff6600', icon: '💥' },
  { name: 'SNARE',    color: '#60A5FA', icon: '🥁' },
  { name: 'HI-HAT',   color: '#F5B041', icon: '🔔' },
  { name: 'OPEN HAT',  color: '#E74C3C', icon: '🔶' },
  { name: 'PERC 1',   color: '#9B59B6', icon: '✦' },
  { name: 'PERC 2',   color: '#1ABC9C', icon: '✧' },
  { name: '808',      color: '#27AE60', icon: '🌊' },
  { name: 'FX',       color: '#BB8FCE', icon: '⚡' },
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

function createDefaultTrack(info: { name: string; color: string; icon: string }, stepCount: number): TrackState {
  return {
    id: info.name.toLowerCase().replace(/\s+/g, '-'),
    name: info.name, color: info.color, icon: info.icon,
    muted: false, soloed: false, volume: 0.8,
    polymetricLength: stepCount,
    patternA: Array.from({ length: stepCount }, () => createDefaultStep()),
    patternB: Array.from({ length: stepCount }, () => createDefaultStep()),
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
  | { type: 'LOAD_PATTERN'; tracks: TrackState[] };

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

