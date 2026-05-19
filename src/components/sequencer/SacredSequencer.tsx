/**
 * SacredSequencer — The God Realm Step Sequencer
 * FL Studio Channel Rack / Elektron Digitakt-class trap step sequencer.
 * 8-track multi-lane sequencer with per-step parameter control,
 * probability, swing, pattern A/B, fill mode, and graph editor.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSequencerEngine } from './useSequencerEngine';
import { SacredSequencerHeader } from './SacredSequencerHeader';
import { SacredTrackLane } from './SacredTrackLane';
import { SacredGraphEditor } from './SacredGraphEditor';
import { SacredStepDetail } from './SacredStepDetail';
import type { SequencerState, StepState } from './useSequencerEngine';
import { sampleManager } from './SampleManager';
import { SacredMasterPanel } from './SacredMasterPanel';
import { GodRealmSampleChopper } from '../GodRealmSampleChopper';
import { ExportEngine } from '../../audio/ExportEngine';
import { PantheonSynthEngine } from '../../audio/PantheonSynthEngine';
import { FXRack } from '../../audio/FXRack';
import { SacredMixerStrip } from './SacredMixerStrip';
import { SacredFXRackPanel } from './SacredFXRackPanel';
import { SacredSongTimeline } from './SacredSongTimeline';
import { SacredProjectDrawer } from './SacredProjectDrawer';
import { useTrackMetering } from './useTrackMetering';
import { useProjectManager } from './useProjectManager';
import type { FXSendState, AutomationParam } from './useSequencerEngine';
import { nativeAudio, StepBridgePayload } from '../../native/bridge';
import { useJuceBridge } from '@/hooks/useJuceBridge';
import './SacredSequencer.css';

interface SacredSequencerProps {
  parameterValues?: Record<string, any>;
  update?: (id: string, val: any) => void;
  // Lifted Engine Props
  engine: ReturnType<typeof useSequencerEngine>;
  buffers: Record<number, AudioBuffer>;
}

export const SacredSequencer: React.FC<SacredSequencerProps> = ({
  parameterValues = {},
  update,
  engine,
  buffers,
}) => {
  const { state, dispatch, play, stop, togglePlay, setOnTrigger, setOnAutomation, audioCtx, masterChain, fxRack, undo, redo, canUndo, canRedo, clearHistory } = engine;
  const isLoadedRef = useRef(true);

  // ─── JUCE Transport Sync ───
  // When running inside JUCE, the DAW host drives the playhead position.
  // This syncs the sequencer's visual step to the engine's transport state.
  const bridgeState = useJuceBridge();
  const juceStep = bridgeState.transport.currentStep;
  const juceIsPlaying = bridgeState.transport.isPlaying;

  useEffect(() => {
    // Only sync from JUCE when transport is active and step is valid
    if (juceIsPlaying && juceStep >= 0 && juceStep < state.stepCount) {
      dispatch({ type: 'SET_CURRENT_STEP', step: juceStep % state.stepCount });
    }
  }, [juceStep, juceIsPlaying, state.stepCount, dispatch]);

  // Step Detail Popover State
  const [stepDetail, setStepDetail] = useState<{
    trackIndex: number;
    stepIndex: number;
    position: { x: number; y: number };
  } | null>(null);
  
  const [chopperTrackIndex, setChopperTrackIndex] = useState<number | null>(null);
  const [showMixer, setShowMixer] = useState(false);
  const [showFxPanel, setShowFxPanel] = useState(false);
  const [showProjectDrawer, setShowProjectDrawer] = useState(false);

  // ─── Project Manager ───
  const projectManager = useProjectManager(state, dispatch, clearHistory);

  // ─── Track Metering ───
  const trackLevels = useTrackMetering(fxRack, state.isPlaying, state.tracks.length);

  // ─── Synth Engine Pool ───
  // One PantheonSynthEngine per synth track, lazily created and cached by track index.
  const synthEnginesRef = useRef<Map<number, PantheonSynthEngine>>(new Map());

  // Keep synth engines in sync with track config changes (god, macros)
  useEffect(() => {
    const engines = synthEnginesRef.current;
    state.tracks.forEach((track, idx) => {
      if (track.sourceType !== 'synth' || !track.synthConfig) return;
      const engine = engines.get(idx);
      if (engine) {
        // Update god if changed
        engine.setGod(track.synthConfig.godId);
        // Update macros
        Object.entries(track.synthConfig.macros).forEach(([key, val]) => {
          engine.setMacro(key, val);
        });
        engine.setVoiceMode(track.synthConfig.voiceMode.toUpperCase() as any);
      }
    });
  }, [state.tracks]);

  // Cleanup synth engines on unmount
  useEffect(() => {
    return () => {
      synthEnginesRef.current.forEach(e => e.dispose());
      synthEnginesRef.current.clear();
    };
  }, []);

  // Helper: get or create a synth engine for a track
  const getSynthEngine = useCallback((trackIndex: number, godId: string): PantheonSynthEngine | null => {
    if (!audioCtx.current) return null;
    const engines = synthEnginesRef.current;
    let engine = engines.get(trackIndex);
    if (!engine) {
      engine = new PantheonSynthEngine();
      engine.init(audioCtx.current);
      engine.setGod(godId);
      engines.set(trackIndex, engine);
    }
    return engine;
  }, [audioCtx]);

  // ─── BPM → FXRack Delay Sync ───
  useEffect(() => {
    if (fxRack.current) {
      fxRack.current.updateBPM(state.bpm);
    }
  }, [state.bpm, fxRack]);

  // ─── Per-Track FX Send Level Sync ───
  useEffect(() => {
    if (!fxRack.current) return;
    state.tracks.forEach((track, idx) => {
      fxRack.current!.updateTrackSends(idx, track.fxSends);
    });
  }, [state.tracks, fxRack]);

  // Sample + Synth trigger logic
  useEffect(() => {
    setOnTrigger((trackIndex, step, time) => {
      const track = state.tracks[trackIndex];
      if (!audioCtx.current || !masterChain.current || !track) return;
      
      const ctx = audioCtx.current;

      // ─── Get or create per-track FX send nodes ───
      const sends = fxRack.current?.createTrackSends(trackIndex, track.fxSends);
      // Fallback destination: if FXRack not ready, route to masterChain directly
      const trackDestination = sends?.dry ?? masterChain.current!.input;

      // ═══ SYNTH TRACK ROUTING ═══
      if (track.sourceType === 'synth' && track.synthConfig) {
        const engine = getSynthEngine(trackIndex, track.synthConfig.godId);
        if (!engine) return;

        // Resolve MIDI note: noteMap[stepIndex] + octave offset
        const baseNote = track.synthConfig.noteMap[step.sliceIndex] ?? 60; // C4 fallback
        const midiNote = baseNote + (track.synthConfig.octave * 12);
        const velocity = step.velocity;

        // Trigger note
        engine.noteOn(midiNote, velocity);

        // Schedule noteOff after decay duration
        const decayMs = Math.max(50, step.decay * 2000);
        setTimeout(() => {
          engine.noteOff(midiNote);
        }, decayMs);

        // Phase 4: Forward step trigger to JUCE
        const stepBridgePayload: StepBridgePayload = {
          velocity: step.velocity,
          pitch: step.pitch,
          pan: step.pan,
          decay: step.decay,
          sliceIndex: step.sliceIndex,
          sourceType: 'synth',
          synthNote: midiNote,
          synthGodId: track.synthConfig.godId,
        };
        nativeAudio.triggerStep(trackIndex, stepBridgePayload, time);
        return;
      }

      // ═══ SAMPLE TRACK ROUTING (existing logic) ═══
      if (!buffers[trackIndex]) return;
      
      const originalBuffer = buffers[trackIndex];
      const params = track.sampleParams;

      // Slice / Parameter selection
      let slice = null;
      if (params.slices && params.slices.length > 0 && step.sliceIndex > 0) {
        // step.sliceIndex is 1-based in UI
        slice = params.slices[step.sliceIndex - 1];
      }

      // Determine final behavior (XOR reversal)
      const isGlobalReverse = !!params.reverse;
      const isSliceReverse = !!slice?.reverse;
      const actualReverse = isGlobalReverse !== isSliceReverse;

      // Determine the active buffer
      const bufferToUse = actualReverse 
        ? sampleManager.reverseBuffer(ctx, originalBuffer)
        : originalBuffer;

      const source = ctx.createBufferSource();
      source.buffer = bufferToUse;

      // Normalization of boundaries
      let startNorm = slice ? slice.start : params.start;
      let endNorm = slice ? slice.end : params.end;

      // Calculate final startTime and duration in seconds
      let startTime, duration;
      if (actualReverse) {
        // In a reversed buffer, the "start" is at the end relative to original
        startTime = (1.0 - endNorm) * originalBuffer.duration;
        duration = (endNorm - startNorm) * originalBuffer.duration;
      } else {
        startTime = startNorm * originalBuffer.duration;
        duration = (endNorm - startNorm) * originalBuffer.duration;
      }

      // Safeguard duration
      duration = Math.max(0.001, duration);

      // Pitch mapping (-24 to +24 semitones)
      let playbackRate = Math.pow(2, step.pitch / 12);
      source.playbackRate.setValueAtTime(playbackRate, time);

      // Looping
      const shouldLoop = slice ? !!slice.loop : !!params.loop;
      if (shouldLoop) {
        source.loop = true;
        if (actualReverse) {
          source.loopStart = (1.0 - endNorm) * originalBuffer.duration;
          source.loopEnd = (1.0 - startNorm) * originalBuffer.duration;
        } else {
          source.loopStart = startNorm * originalBuffer.duration;
          source.loopEnd = endNorm * originalBuffer.duration;
        }
      }

      // Gain / Velocity / Decay / Slice Volume
      const gain = ctx.createGain();
      const velocityGain = step.velocity / 127;
      const trackVolume = track.volume;
      const sliceVolume = slice?.volume ?? 1.0;
      // Multiplier of 0.7 for headroom
      const initialGain = velocityGain * trackVolume * sliceVolume * 0.7;
      
      // De-clicking: 3ms ramp for smoother trap transients
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(initialGain, time + 0.003);
      
      // Decay (exponential ramp)
      const decayTime = 0.05 + step.decay * 2.0; 
      gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

      // Panning
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(step.pan, time);

      // Routing — through per-track FX sends
      source.connect(gain).connect(panner);
      panner.connect(trackDestination);
      // Route to FX sends (reverb, chorus, delay, saturation)
      if (sends) {
        panner.connect(sends.reverb);
        panner.connect(sends.chorus);
        panner.connect(sends.delay);
        panner.connect(sends.saturation);
      }
      
      // Start/Stop
      source.start(time, startTime, shouldLoop ? undefined : duration);
      source.stop(time + decayTime + 0.1);

      // Phase 4: Forward step trigger to JUCE for native playback
      const stepBridgePayload: StepBridgePayload = {
        velocity: step.velocity,
        pitch: step.pitch,
        pan: step.pan,
        decay: step.decay,
        sliceIndex: step.sliceIndex,
        sourceType: track.sourceType || 'sample',
        synthNote: undefined,
        synthGodId: undefined,
      };
      nativeAudio.triggerStep(trackIndex, stepBridgePayload, time);
    });
  }, [setOnTrigger, audioCtx, masterChain, fxRack, state.tracks, getSynthEngine]);

  // ─── Automation Playback Callback ───
  // Applies per-step automation values to the live audio graph
  useEffect(() => {
    setOnAutomation((trackIndex: number, param: AutomationParam, value: number, _time: number) => {
      // Apply automation values to the audio graph
      switch (param) {
        case 'volume':
          // Update track volume in state (0-1 normalized → 0-1.5 range)
          dispatch({ type: 'SET_TRACK_VOLUME', trackIndex, volume: value * 1.5 });
          break;
        case 'fxReverb':
          dispatch({ type: 'SET_FX_SEND', trackIndex, fx: 'reverb', value: value * 100 });
          break;
        case 'fxChorus':
          dispatch({ type: 'SET_FX_SEND', trackIndex, fx: 'chorus', value: value * 100 });
          break;
        case 'fxDelay':
          dispatch({ type: 'SET_FX_SEND', trackIndex, fx: 'delay', value: value * 100 });
          break;
        case 'fxSaturation':
          dispatch({ type: 'SET_FX_SEND', trackIndex, fx: 'saturation', value: value * 100 });
          break;
        case 'synthEnergy':
        case 'synthDivinity':
        case 'synthWidth':
        case 'synthRealm': {
          // Map automation param name → synth macro key
          const macroMap: Record<string, string> = {
            synthEnergy: 'energy', synthDivinity: 'divinity',
            synthWidth: 'width', synthRealm: 'realm',
          };
          const macroKey = macroMap[param];
          if (macroKey) {
            dispatch({ type: 'SET_SYNTH_MACRO', trackIndex, macro: macroKey as any, value: value * 100 });
          }
          break;
        }
        // Pan is applied per-step at trigger time — stored but not dispatched here
        case 'pan':
          break;
      }
    });
  }, [setOnAutomation, dispatch]);


  // Keyboard shortcuts — comprehensive DAW workflow
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isMeta = e.metaKey || e.ctrlKey;

      // ─── Modifier shortcuts (Cmd/Ctrl + key) ───
      if (isMeta) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
            return;
          case 'y':
            e.preventDefault();
            redo();
            return;
          case 's':
            e.preventDefault();
            if (projectManager.activeProject) {
              projectManager.quickSave();
            } else {
              setShowProjectDrawer(true);
            }
            return;
          case 'c':
            e.preventDefault();
            dispatch({ type: 'COPY_TRACK_PATTERN' });
            return;
          case 'v':
            e.preventDefault();
            dispatch({ type: 'PASTE_TRACK_PATTERN' });
            return;
        }
        return;
      }

      // ─── Single-key shortcuts ───
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyM':
          dispatch({ type: 'TOGGLE_MUTE', trackIndex: state.selectedTrack });
          break;
        case 'KeyS':
          dispatch({ type: 'TOGGLE_SOLO', trackIndex: state.selectedTrack });
          break;
        case 'KeyA':
          dispatch({ type: 'SET_PATTERN', pattern: 'A' });
          break;
        case 'KeyB':
          dispatch({ type: 'SET_PATTERN', pattern: 'B' });
          break;
        case 'KeyF':
          dispatch({ type: 'TOGGLE_FILL' });
          break;
        case 'KeyR':
          dispatch({ type: 'TOGGLE_AUTOMATION_RECORD' });
          break;
        case 'Tab':
          e.preventDefault();
          dispatch({ type: 'SELECT_TRACK', index: (state.selectedTrack + 1) % state.tracks.length });
          break;
        case 'Escape':
          setStepDetail(null);
          setChopperTrackIndex(null);
          setShowProjectDrawer(false);
          break;
        case 'Delete':
        case 'Backspace':
          if (!e.metaKey && !e.ctrlKey) {
            dispatch({ type: 'CLEAR_TRACK', trackIndex: state.selectedTrack });
          }
          break;
        // Number keys 1-8 select tracks
        case 'Digit1': dispatch({ type: 'SELECT_TRACK', index: 0 }); break;
        case 'Digit2': dispatch({ type: 'SELECT_TRACK', index: Math.min(1, state.tracks.length - 1) }); break;
        case 'Digit3': dispatch({ type: 'SELECT_TRACK', index: Math.min(2, state.tracks.length - 1) }); break;
        case 'Digit4': dispatch({ type: 'SELECT_TRACK', index: Math.min(3, state.tracks.length - 1) }); break;
        case 'Digit5': dispatch({ type: 'SELECT_TRACK', index: Math.min(4, state.tracks.length - 1) }); break;
        case 'Digit6': dispatch({ type: 'SELECT_TRACK', index: Math.min(5, state.tracks.length - 1) }); break;
        case 'Digit7': dispatch({ type: 'SELECT_TRACK', index: Math.min(6, state.tracks.length - 1) }); break;
        case 'Digit8': dispatch({ type: 'SELECT_TRACK', index: Math.min(7, state.tracks.length - 1) }); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, undo, redo, dispatch, state.selectedTrack, state.tracks.length, projectManager]);

  /* ─── Dispatch Helpers ─── */
  const handleToggleStep = useCallback((trackIndex: number, stepIndex: number) => {
    dispatch({ type: 'TOGGLE_STEP', trackIndex, stepIndex });
    
    // Sync to Native Bridge
    const track = state.tracks[trackIndex];
    const pattern = state.activePattern === 'A' ? track.patternA : track.patternB;
    const step = pattern[stepIndex];
    // We send the inverted state because dispatch hasn't updated the 'state' variable yet in this closure
    // Actually, it's safer to just send the data after dispatch if we use a useEffect or a wrapper.
    // Let's do it manually for now with the toggled value.
    const updatedStep = { ...step, enabled: !step.enabled };
    nativeAudio.updateSequencerStep(trackIndex, state.activePattern, stepIndex, updatedStep);
  }, [dispatch, state.tracks, state.activePattern]);

  const handleSetVelocity = useCallback((trackIndex: number, stepIndex: number, velocity: number) => {
    dispatch({ type: 'SET_STEP_VELOCITY', trackIndex, stepIndex, velocity });
    
    const track = state.tracks[trackIndex];
    const pattern = state.activePattern === 'A' ? track.patternA : track.patternB;
    const step = pattern[stepIndex];
    const updatedStep = { ...step, velocity, enabled: true };
    nativeAudio.updateSequencerStep(trackIndex, state.activePattern, stepIndex, updatedStep);
  }, [dispatch, state.tracks, state.activePattern]);

  const handleGraphSetValue = useCallback((stepIndex: number, value: number) => {
    // Note mode routes to SET_NOTE_MAP for synth tracks
    if (state.activeGraphMode === 'note') {
      dispatch({
        type: 'SET_NOTE_MAP',
        trackIndex: state.selectedTrack,
        stepIndex,
        note: Math.round(value),
      });
      return;
    }

    const propMap: Record<Exclude<SequencerState['activeGraphMode'], 'note'>, string> = {
      velocity: 'velocity',
      pitch: 'pitch',
      pan: 'pan',
      decay: 'decay',
      probability: 'probability',
    };
    const prop = propMap[state.activeGraphMode as Exclude<SequencerState['activeGraphMode'], 'note'>];
    let finalValue = value;

    // Normalize for pan and decay (stored as 0-1)
    if (prop === 'pan') finalValue = value / 100;
    if (prop === 'decay') finalValue = value / 100;

    dispatch({
      type: 'SET_STEP_PROP',
      trackIndex: state.selectedTrack,
      stepIndex,
      prop: prop as any,
      value: finalValue,
    });

    // Sync to Native Bridge
    const track = state.tracks[state.selectedTrack];
    const pattern = state.activePattern === 'A' ? track.patternA : track.patternB;
    const step = pattern[stepIndex];
    const updatedStep = { ...step, [prop]: finalValue };
    nativeAudio.updateSequencerStep(state.selectedTrack, state.activePattern, stepIndex, updatedStep);
  }, [dispatch, state.activeGraphMode, state.selectedTrack, state.tracks, state.activePattern]);

  const handleOpenStepDetail = useCallback((trackIndex: number, stepIndex: number, position: { x: number; y: number }) => {
    setStepDetail({ trackIndex, stepIndex, position });
  }, []);

  const handleUpdateStepProp = useCallback((prop: keyof StepState, value: any) => {
    if (!stepDetail) return;
    dispatch({
      type: 'SET_STEP_PROP',
      trackIndex: stepDetail.trackIndex,
      stepIndex: stepDetail.stepIndex,
      prop,
      value,
    });

    // Sync to Native Bridge
    const track = state.tracks[stepDetail.trackIndex];
    const pattern = state.activePattern === 'A' ? track.patternA : track.patternB;
    const step = pattern[stepDetail.stepIndex];
    const updatedStep = { ...step, [prop]: value };
    nativeAudio.updateSequencerStep(stepDetail.trackIndex, state.activePattern, stepDetail.stepIndex, updatedStep);
  }, [dispatch, stepDetail, state.tracks, state.activePattern]);

  const handleCopyPattern = useCallback((from: 'A' | 'B', to: 'A' | 'B') => {
    dispatch({ type: 'COPY_PATTERN', from, to });
  }, [dispatch]);
  
  const handleExport = useCallback(async () => {
    if (!isLoadedRef.current) return;
    try {
      console.log('Starting Sacred Render...');
      const blob = await ExportEngine.renderToWav(state, buffers);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sacred_loop_${state.bpm}bpm.wav`;
      a.click();
      URL.revokeObjectURL(url);
      console.log('Sacred Render Complete.');
    } catch (err) {
      console.error('Failed to export sacred loop', err);
    }
  }, [state]);

  const selectedTrack = state.tracks[state.selectedTrack];
  const selectedPattern = state.activePattern === 'A' ? selectedTrack?.patternA : selectedTrack?.patternB;

  /* ─── Trap Beat Presets ─── */
  const TRAP_PRESETS = [
    { id: 'metro', label: '🔥 METRO BOUNCING', desc: 'Metro Boomin bounce pattern' },
    { id: 'southside', label: '💀 SOUTHSIDE 808', desc: 'Southside dark 808 pattern' },
    { id: 'lex', label: '⚡ LEX LUGER', desc: 'Lex Luger hard-hitting drums' },
    { id: 'zaytoven', label: '🎹 ZAYTOVEN', desc: 'Zaytoven fast hi-hat pattern' },
    { id: 'pierre', label: '🌊 PIERRE BOURNE', desc: 'Pi\'erre Bourne melodic bounce' },
    { id: 'hihat-rolls', label: '🔔 ROLL MACHINE', desc: 'Hi-hat roll generator' },
  ];

  const loadTrapPreset = useCallback((presetId: string) => {
    // Define patterns per preset
    const patterns: Record<string, Record<number, { steps: number[]; vel?: number[] }>> = {
      metro: {
        0: { steps: [0, 6, 8, 14], vel: [127, 80, 100, 60] },           // Kick - off-grid bounce
        1: { steps: [4, 12], vel: [120, 110] },                          // Snare
        2: { steps: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], vel: [100,60,80,50,100,60,80,50,100,60,80,50,100,60,80,50] }, // HH
        6: { steps: [0, 6, 8], vel: [127, 90, 100] },                    // 808
      },
      southside: {
        0: { steps: [0, 3, 8, 11], vel: [127, 90, 120, 80] },
        1: { steps: [4, 12], vel: [127, 127] },
        2: { steps: [0,2,4,6,8,10,12,14], vel: [110,70,100,60,110,70,100,60] },
        6: { steps: [0, 3, 8, 11], vel: [127, 100, 120, 90] },
      },
      lex: {
        0: { steps: [0, 4, 8, 12], vel: [127, 127, 127, 127] },          // Four on the floor HARD
        1: { steps: [4, 12], vel: [127, 120] },
        2: { steps: [0,2,4,6,8,10,12,14], vel: [127,80,110,70,120,80,110,70] },
        3: { steps: [2, 10], vel: [90, 80] },                            // Open hat
        6: { steps: [0, 8], vel: [127, 120] },
      },
      zaytoven: {
        0: { steps: [0, 10], vel: [100, 80] },
        1: { steps: [4, 12], vel: [110, 100] },
        2: { steps: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], vel: [100,50,70,40,90,50,70,40,100,50,70,40,90,50,70,40] },
        4: { steps: [2, 6, 10, 14], vel: [60, 50, 55, 45] },
      },
      pierre: {
        0: { steps: [0, 7, 8], vel: [110, 70, 100] },
        1: { steps: [4, 12], vel: [100, 95] },
        2: { steps: [0,2,4,6,8,10,12,14], vel: [90,50,80,45,85,50,80,45] },
        6: { steps: [0, 7, 8], vel: [110, 80, 100] },
        4: { steps: [3, 11], vel: [50, 45] },
      },
      'hihat-rolls': {
        2: { steps: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], vel: [120,60,90,40,110,55,85,35,120,60,90,40,110,55,85,35] },
        3: { steps: [4, 8, 14], vel: [70, 60, 80] },
      },
    };

    const preset = patterns[presetId] || {};
    // Single batch dispatch — replaces ~100+ individual dispatches
    dispatch({ type: 'LOAD_PRESET', preset });
  }, [dispatch]);

  // Calculate playhead beam position
  const playheadBeamLeft = state.currentStep >= 0
    ? `calc(140px + ${(state.currentStep / state.stepCount) * 100}% * (1 - 140px / 100%))`
    : '-10px';

  return (
    <div className={`seq-container ${state.isFillMode ? 'seq-container--fill' : ''}`}>
      {/* Header / Transport */}
      <SacredSequencerHeader
        state={state}
        onPlay={() => {
          play();
          // Phase 4: Transport sync — notify JUCE on play
          nativeAudio.updateTransport({ bpm: state.bpm, isPlaying: true, swing: state.swing });
        }}
        onStop={() => {
          stop();
          // Phase 4: Transport sync — notify JUCE on stop
          nativeAudio.updateTransport({ bpm: state.bpm, isPlaying: false, swing: state.swing });
        }}
        onTogglePlay={togglePlay}
        onSetBpm={(bpm) => {
          dispatch({ type: 'SET_BPM', bpm });
          nativeAudio.setParameter('globalBpm', bpm);
          // Phase 4: Transport sync
          nativeAudio.updateTransport({ bpm, isPlaying: state.isPlaying, swing: state.swing });
        }}
        onSetSwing={(swing) => {
          dispatch({ type: 'SET_SWING', swing });
          // Phase 4: Transport sync
          nativeAudio.updateTransport({ bpm: state.bpm, isPlaying: state.isPlaying, swing });
        }}
        onSetSwingPreset={(preset) => dispatch({ type: 'SET_SWING_PRESET', preset })}
        onSetStepCount={(count) => dispatch({ type: 'SET_STEP_COUNT', count })}
        onSetPattern={(pattern) => {
          dispatch({ type: 'SET_PATTERN', pattern });
          nativeAudio.setParameter('activePattern', pattern === 'A' ? 0 : 1);
        }}
        onCopyPattern={handleCopyPattern}
        onToggleFill={() => dispatch({ type: 'TOGGLE_FILL' })}
        onClearAll={() => dispatch({ type: 'CLEAR_ALL' })}
        onExport={handleExport}
        showMixer={showMixer}
        onToggleMixer={() => setShowMixer(prev => !prev)}
        showFxPanel={showFxPanel}
        onToggleFxPanel={() => setShowFxPanel(prev => !prev)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        activeProject={projectManager.activeProject}
        isDirty={projectManager.isDirty}
        onToggleProjectDrawer={() => setShowProjectDrawer(prev => !prev)}
        isRecording={state.isRecording}
        onToggleRecord={() => dispatch({ type: 'TOGGLE_AUTOMATION_RECORD' })}
      />

      {/* Playhead Position Bar */}
      <div className="seq-playhead-bar" style={{ gridTemplateColumns: `repeat(${state.stepCount}, 1fr)` }}>
        {state.isPlaying && state.currentStep >= 0 && (
          <div
            className="seq-playhead-beam"
            style={{
              left: `calc(${(state.currentStep + 0.5) / state.stepCount * 100}%)`,
            }}
          />
        )}
        {Array.from({ length: state.stepCount }).map((_, i) => (
          <div
            key={i}
            className={`seq-playhead-cell ${state.currentStep === i ? 'seq-playhead-cell--active' : ''} ${i % 4 === 0 ? 'seq-playhead-cell--downbeat' : ''}`}
          >
            {i % 4 === 0 && <span className="seq-playhead-num">{Math.floor(i / 4) + 1}</span>}
          </div>
        ))}
      </div>

      {/* Track Lanes */}
      <div className="seq-lanes">
        {state.tracks.map((track, i) => (
          <SacredTrackLane
            key={track.id}
            track={track}
            trackIndex={i}
            currentStep={state.currentStep}
            isSelected={state.selectedTrack === i}
            activePattern={state.activePattern}
            isFillMode={state.isFillMode}
            stepCount={state.stepCount}
            swing={state.swing}
            onSelectTrack={() => dispatch({ type: 'SELECT_TRACK', index: i })}
            onToggleStep={(stepIdx) => handleToggleStep(i, stepIdx)}
            onSetVelocity={(stepIdx, vel) => handleSetVelocity(i, stepIdx, vel)}
            onOpenStepDetail={(stepIdx, pos) => handleOpenStepDetail(i, stepIdx, pos)}
            onOpenChopper={() => setChopperTrackIndex(i)}
            onRandomize={() => dispatch({ type: 'RANDOMIZE_TRACK', trackIndex: i })}
            onClear={() => dispatch({ type: 'CLEAR_TRACK', trackIndex: i })}
            onToggleMute={() => dispatch({ type: 'TOGGLE_MUTE', trackIndex: i })}
            onToggleSolo={() => dispatch({ type: 'TOGGLE_SOLO', trackIndex: i })}
            onSetSource={(trackIndex, sourceType, godId) =>
              dispatch({ type: 'SET_TRACK_SOURCE', trackIndex, sourceType, godId })
            }
            onRename={(trackIndex, name) =>
              dispatch({ type: 'RENAME_TRACK', trackIndex, name })
            }
            onSetColor={(trackIndex, color) =>
              dispatch({ type: 'SET_TRACK_COLOR', trackIndex, color })
            }
            onDeleteTrack={(trackId) =>
              dispatch({ type: 'REMOVE_TRACK', trackId })
            }
            onSetFxSend={(trackIndex, fx, value) =>
              dispatch({ type: 'SET_FX_SEND', trackIndex, fx, value })
            }
            /* Automation lane props */
            isPlaying={state.isPlaying}
            onAddAutomationLane={(trackIndex, param) =>
              dispatch({ type: 'ADD_AUTOMATION_LANE', trackIndex, param })
            }
            onRemoveAutomationLane={(trackIndex, param) =>
              dispatch({ type: 'REMOVE_AUTOMATION_LANE', trackIndex, param })
            }
            onSetAutomationPoint={(trackIndex, param, point) =>
              dispatch({ type: 'SET_AUTOMATION_POINT', trackIndex, param, point })
            }
            onRemoveAutomationPoint={(trackIndex, param, pointIndex) =>
              dispatch({ type: 'REMOVE_AUTOMATION_POINT', trackIndex, param, pointIndex })
            }
            onSetAutomationPoints={(trackIndex, param, points) =>
              dispatch({ type: 'SET_AUTOMATION_POINTS', trackIndex, param, points })
            }
            onToggleAutomationEnabled={(trackIndex, param) =>
              dispatch({ type: 'TOGGLE_AUTOMATION_ENABLED', trackIndex, param })
            }
            onSetAutomationCurveType={(trackIndex, param, curveType) =>
              dispatch({ type: 'SET_AUTOMATION_CURVE_TYPE', trackIndex, param, curveType })
            }
          />
        ))}
      </div>

      {/* Mixer Strip — FL Studio-style per-track mixer */}
      {showMixer && (
        <SacredMixerStrip
          tracks={state.tracks}
          selectedTrack={state.selectedTrack}
          levels={trackLevels}
          onSelectTrack={(idx) => dispatch({ type: 'SELECT_TRACK', index: idx })}
          onSetVolume={(trackIndex, volume) => {
            dispatch({ type: 'SET_TRACK_VOLUME', trackIndex, volume });
            // Live record: capture volume changes as automation
            if (state.isRecording && state.isPlaying && state.currentStep >= 0) {
              dispatch({
                type: 'RECORD_AUTOMATION_SNAPSHOT',
                trackIndex, param: 'volume',
                step: state.currentStep,
                value: Math.min(1, volume / 1.5),  // normalize to 0-1
              });
            }
          }}
          onSetFxSend={(trackIndex, fx, value) => {
            dispatch({ type: 'SET_FX_SEND', trackIndex, fx, value });
            // Live record: capture FX send changes as automation
            if (state.isRecording && state.isPlaying && state.currentStep >= 0) {
              const fxParamMap: Record<string, AutomationParam> = {
                reverb: 'fxReverb', chorus: 'fxChorus', delay: 'fxDelay', saturation: 'fxSaturation',
              };
              const autoParam = fxParamMap[fx];
              if (autoParam) {
                dispatch({
                  type: 'RECORD_AUTOMATION_SNAPSHOT',
                  trackIndex, param: autoParam,
                  step: state.currentStep,
                  value: value / 100,  // normalize to 0-1
                });
              }
            }
          }}
          onToggleMute={(trackIndex) => dispatch({ type: 'TOGGLE_MUTE', trackIndex })}
          onToggleSolo={(trackIndex) => dispatch({ type: 'TOGGLE_SOLO', trackIndex })}
        />
      )}

      {/* FX Rack Panel — toggle via FX button */}
      {showFxPanel && (
        <SacredFXRackPanel fxRack={fxRack} />
      )}

      {/* Song Timeline — arrangement row */}
      <SacredSongTimeline
        arrangement={state.songArrangement}
        songPosition={state.songPosition}
        isPlaying={state.isPlaying}
        playbackMode={state.playbackMode}
        onAddBlock={(pattern) => dispatch({ type: 'ADD_SONG_BLOCK', pattern })}
        onRemoveBlock={(index) => dispatch({ type: 'REMOVE_SONG_BLOCK', index })}
        onUpdateBlock={(index, changes) => dispatch({ type: 'UPDATE_SONG_BLOCK', index, changes })}
        onSetPosition={(position) => dispatch({ type: 'SET_SONG_POSITION', position })}
        onSetPlaybackMode={(mode) => dispatch({ type: 'SET_PLAYBACK_MODE', mode })}
      />

      {/* Graph Editor */}
      {selectedPattern && (
        <SacredGraphEditor
          steps={selectedPattern}
          stepCount={state.stepCount}
          mode={state.activeGraphMode}
          trackColor={selectedTrack.color}
          currentStep={state.currentStep}
          noteMap={selectedTrack.synthConfig?.noteMap}
          onSetMode={(mode) => dispatch({ type: 'SET_GRAPH_MODE', mode })}
          onSetValue={handleGraphSetValue}
        />
      )}

      {/* Master Panel & Visualizer */}
      <SacredMasterPanel
        params={state.master}
        onParamChange={(param, value) => dispatch({ type: 'SET_MASTER_PARAM', param, value })}
        analyser={masterChain.current?.analyser || null}
        isPlaying={state.isPlaying}
      />

      {/* Trap Beat Presets */}
      <div className="seq-presets">
        <span className="seq-presets__label">PRESETS</span>
        {TRAP_PRESETS.map(p => (
          <button
            key={p.id}
            className="seq-preset-chip"
            onClick={() => loadTrapPreset(p.id)}
            title={p.desc}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Bottom Status */}
      <div className="seq-status">
        <span className="seq-status__track">
          {selectedTrack?.icon} {selectedTrack?.name}
        </span>
        <span className="seq-status__info">
          {state.stepCount} STEPS · PATTERN {state.activePattern} · {state.bpm} BPM
        </span>
        <span className="seq-status__label">
          THE SACRED SEQUENCER
        </span>
      </div>

      {/* Step Detail Popover */}
      {stepDetail && (
        <SacredStepDetail
          step={(state.activePattern === 'A' ? state.tracks[stepDetail.trackIndex].patternA : state.tracks[stepDetail.trackIndex].patternB)[stepDetail.stepIndex]}
          stepIndex={stepDetail.stepIndex}
          trackIndex={stepDetail.trackIndex}
          trackName={state.tracks[stepDetail.trackIndex].name}
          trackColor={state.tracks[stepDetail.trackIndex].color}
          position={stepDetail.position}
          onClose={() => setStepDetail(null)}
          onSetProp={handleUpdateStepProp}
        />
      )}

      {/* Sample Chopper Overlay */}
      {chopperTrackIndex !== null && (
        <div className="seq-chopper-overlay">
          <div className="seq-chopper-modal">
            <button 
              className="seq-chopper-close" 
              onClick={() => setChopperTrackIndex(null)}
            >
              ✕
            </button>
            <GodRealmSampleChopper
              activePad={chopperTrackIndex}
              parameterValues={{
                chopMarkers: state.tracks[chopperTrackIndex]?.sampleParams?.slices?.map((s: any) => s.start) || [0.25, 0.5, 0.75],
                snapToTransient: true,
                scopeGlobal: true,
                chopMode: 'Auto',
                chopperSpeed: 1.0,
                chopperPitch: 0,
                chopperFadeIn: 25,
                chopperFadeOut: 150,
                chopperGlide: 10,
                chopperReverse: state.tracks[chopperTrackIndex]?.sampleParams?.reverse ?? false,
                chopperSensitivity: 50,
                chopperTrigger: 'MIDI',
                chopperDryWet: 75,
                chopperOutputVolume: -3,
              }}
              update={(param: string, value: any) => {
                if (param === 'chopperReverse') {
                  dispatch({ type: 'SET_SAMPLE_PARAM', trackIndex: chopperTrackIndex, param: 'reverse', value });
                } else if (param === 'chopMarkers') {
                  // Map markers back to slices
                  const slices = (value as number[]).map((start: number, i: number) => ({
                    start,
                    end: (value as number[])[i + 1] ?? 1.0,
                    reverse: false,
                    loop: false,
                    volume: 1.0,
                  }));
                  dispatch({ type: 'SET_SAMPLE_PARAM', trackIndex: chopperTrackIndex, param: 'slices', value: slices });
                }
              }}
              buffer={buffers[chopperTrackIndex] || null}
            />
          </div>
        </div>
      )}

      {/* Project Drawer */}
      <SacredProjectDrawer
        isOpen={showProjectDrawer}
        onClose={() => setShowProjectDrawer(false)}
        projects={projectManager.projects}
        activeProject={projectManager.activeProject}
        isDirty={projectManager.isDirty}
        onSave={projectManager.saveProject}
        onLoad={projectManager.loadProject}
        onDelete={projectManager.deleteProject}
        onRename={projectManager.renameProject}
        onNew={projectManager.newProject}
        onExport={projectManager.exportProject}
        onImport={projectManager.importProject}
      />
    </div>
  );
};
