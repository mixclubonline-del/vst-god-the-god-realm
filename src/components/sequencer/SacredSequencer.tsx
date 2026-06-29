/**
 * SacredSequencer — The God Realm Step Sequencer
 * FL Studio Channel Rack / Elektron Digitakt-class trap step sequencer.
 * 8-track multi-lane sequencer with per-step parameter control,
 * probability, swing, pattern A/B, fill mode, and graph editor.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSequencerEngine } from './useSequencerEngine';
import { useAutomationRecorder } from '../../hooks/useAutomationRecorder';
import { SacredSequencerHeader } from './SacredSequencerHeader';
import { SacredTrackLane } from './SacredTrackLane';
import { SacredGraphEditor } from './SacredGraphEditor';
import { SacredStepDetail } from './SacredStepDetail';
import type { SequencerState, StepState } from './useSequencerEngine';
import { sampleManager } from './SampleManager';
import { SacredMasterPanel } from './SacredMasterPanel';
import { SacredChopper } from '../GodRealmSampleChopper';
import { ExportEngine } from '../../audio/ExportEngine';
import { PantheonSynthEngine } from '../../audio/PantheonSynthEngine';
import { FXRack } from '../../audio/FXRack';
import { SacredMixerConsole } from './SacredMixerConsole';
import { SacredFXRackPanel } from './SacredFXRackPanel';
import { SacredSongTimeline } from './SacredSongTimeline';
import { SelectionToolbar } from './SelectionToolbar';
import { DivineParticleField } from './DivineParticleField';
import { SacredProjectDrawer } from './SacredProjectDrawer';
import { useTrackMetering } from './useTrackMetering';
import { useProjectManager } from './useProjectManager';
import type { FXSendState, AutomationParam } from './useSequencerEngine';
import { nativeAudio, StepBridgePayload } from '../../native/bridge';
import { useJuceBridge } from '@/hooks/useJuceBridge';
import { neuralInputBus } from '../../services/neuralInputBus';
import type { GodRealmSamplerEngine } from '@/services/samplerEngine';
import { useMidiMapping } from './useMidiMapping';
import { SacredMidiMapper } from './SacredMidiMapper';
import { SacredPianoRoll } from './SacredPianoRoll';
import type { GhostTrackNotes } from './SacredPianoRoll';
import { useMidiNoteInput } from './useMidiNoteInput';
import { useArpeggiator } from './useArpeggiator';
import { SacredArpeggiator } from './SacredArpeggiator';
import { SacredScaleChord } from './SacredScaleChord';
import { SacredSidechain } from './SacredSidechain';
import { useSidechain } from './useSidechain';
import { DivineOraclePanel } from './DivineOraclePanel';
import { DEFAULT_SCALE_CONFIG, isNoteInScale, snapToScale, detectChord } from '../../audio/MusicTheoryEngine';
import type { ScaleConfig } from '../../audio/MusicTheoryEngine';
import type { PianoRollNote } from './useSequencerEngine';
import { bounceTrack } from '../../audio/TrackBounceEngine';
import type { BounceProgress } from '../../audio/TrackBounceEngine';
import { AudioInputRecorder } from '../../audio/AudioInputRecorder';
import type { RecordingState } from '../../audio/AudioInputRecorder';
import { MasterAnalyzer } from '../../audio/MasterAnalyzer';
import { SacredMasterMeter } from './SacredMasterMeter';
import { AnunnakiPluginWindow } from '../plugins/AnunnakiPluginWindow';
import { pluginRegistry } from '../plugins/pluginRegistry';
import './SacredSequencer.css';

interface SacredSequencerProps {
  parameterValues?: Record<string, any>;
  update?: (id: string, val: any) => void;
  // Lifted Engine Props
  engine: ReturnType<typeof useSequencerEngine>;
  buffers: Record<number, AudioBuffer>;
  // Phase 6: God Engine ref for cross-engine voice routing
  godEngine?: React.RefObject<GodRealmSamplerEngine | null>;
  showModMatrix?: boolean;
  onToggleModMatrix?: () => void;
}

export const SacredSequencer: React.FC<SacredSequencerProps> = ({
  parameterValues = {},
  update,
  engine,
  buffers,
  godEngine,
  showModMatrix,
  onToggleModMatrix,
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
  const [showMidiMapper, setShowMidiMapper] = useState(false);
  const [showPianoRoll, setShowPianoRoll] = useState(false);

  // ─── Phase 9: Live Automation Recorder ───
  const { recordAutomation } = useAutomationRecorder({
    isRecording: state.isRecording,
    isPlaying: state.isPlaying || juceIsPlaying,
    currentStep: state.currentStep >= 0 ? state.currentStep : juceStep,
    dispatch,
  });
  const [midiNoteArmed, setMidiNoteArmed] = useState(false);
  const [showArpeggiator, setShowArpeggiator] = useState(false);
  const [showScaleChord, setShowScaleChord] = useState(false);
  const [scaleConfig, setScaleConfig] = useState<ScaleConfig>({ ...DEFAULT_SCALE_CONFIG });
  const [showSidechain, setShowSidechain] = useState(false);
  const [showOracle, setShowOracle] = useState(false);

  // ─── Floating Plugin Windows ───
  const [openPlugins, setOpenPlugins] = useState<Array<{ trackIndex: number; slotIndex: number; id: string }>>([]);

  const handleOpenPlugin = useCallback((trackIndex: number, slotIndex: number) => {
    const id = `plugin-${trackIndex}-${slotIndex}`;
    // Toggle: close if already open
    setOpenPlugins(prev => {
      const exists = prev.find(p => p.id === id);
      if (exists) return prev.filter(p => p.id !== id);
      return [...prev, { trackIndex, slotIndex, id }];
    });
  }, []);

  const handleClosePlugin = useCallback((id: string) => {
    setOpenPlugins(prev => prev.filter(p => p.id !== id));
  }, []);
  const [showMeter, setShowMeter] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ─── Track Bounce/Freeze State ───
  const frozenBuffersRef = useRef<Record<number, AudioBuffer>>({});
  const [bouncingTrack, setBouncingTrack] = useState<number | null>(null);
  const [bounceProgress, setBounceProgress] = useState(0);
  const recorderRef = useRef<AudioInputRecorder | null>(null);
  const [recordingState, setRecordingState] = useState<{ isRecording: boolean; duration: number; peakLevel: number } | null>(null);

  // ─── Master Analyzer ───
  const analyzerRef = useRef<MasterAnalyzer | null>(null);

  useEffect(() => {
    // AudioContext + MasterChain are created lazily on first play(),
    // so we re-check on every isPlaying change to catch the first init.
    if (!audioCtx.current || !masterChain.current) return;
    if (analyzerRef.current) return; // already initialized

    const analyzer = new MasterAnalyzer(audioCtx.current);
    analyzer.connect(masterChain.current.output);
    analyzerRef.current = analyzer;

    return () => {
      analyzer.dispose();
      analyzerRef.current = null;
    };
  }, [state.isPlaying]); // re-check when playback state changes

  // ─── MIDI Controller Mapping ───
  const midi = useMidiMapping();

  // Register mappable parameters
  useEffect(() => {
    // Global params
    midi.registerTarget({
      id: 'seq.bpm', label: 'BPM', group: 'Transport',
      min: 30, max: 300,
      getValue: () => state.bpm,
      setValue: (v) => dispatch({ type: 'SET_BPM', bpm: Math.round(v) }),
    });
    midi.registerTarget({
      id: 'seq.swing', label: 'Swing', group: 'Transport',
      min: 0, max: 100,
      getValue: () => state.swing,
      setValue: (v) => dispatch({ type: 'SET_SWING', swing: Math.round(v) }),
    });

    // Per-track params (first 8 tracks)
    const trackCount = Math.min(state.tracks.length, 8);
    for (let i = 0; i < trackCount; i++) {
      const trackName = state.tracks[i]?.name ?? `Track ${i + 1}`;
      midi.registerTarget({
        id: `track.${i}.volume`, label: `${trackName} Vol`, group: 'Mixer',
        min: 0, max: 1,
        getValue: () => state.tracks[i]?.volume ?? 0.8,
        setValue: (v) => dispatch({ type: 'SET_TRACK_VOLUME', trackIndex: i, volume: v }),
      });
      midi.registerTarget({
        id: `track.${i}.pan`, label: `${trackName} Pan`, group: 'Mixer',
        min: -1, max: 1,
        getValue: () => state.tracks[i]?.pan ?? 0,
        setValue: (v) => dispatch({ type: 'SET_TRACK_PAN', trackIndex: i, pan: v }),
      });
      midi.registerTarget({
        id: `track.${i}.mute`, label: `${trackName} Mute`, group: 'Mixer',
        min: 0, max: 1, isToggle: true,
        getValue: () => state.tracks[i]?.muted ? 1 : 0,
        setValue: (v) => dispatch({ type: 'TOGGLE_MUTE', trackIndex: i }),
      });
    }

    // FX params
    midi.registerTarget({
      id: 'fx.reverb', label: 'FX Reverb', group: 'Effects',
      min: 0, max: 1,
      getValue: () => 0.5,
      setValue: (v) => {
        if (fxRack.current) fxRack.current.setReverbReturn(v);
      },
    });
    midi.registerTarget({
      id: 'fx.delay', label: 'FX Delay', group: 'Effects',
      min: 0, max: 1,
      getValue: () => 0.3,
      setValue: (v) => {
        if (fxRack.current) fxRack.current.setDelayReturn(v);
      },
    });

    return () => {
      // Cleanup on unmount
      midi.unregisterTarget('seq.bpm');
      midi.unregisterTarget('seq.swing');
      for (let i = 0; i < 8; i++) {
        midi.unregisterTarget(`track.${i}.volume`);
        midi.unregisterTarget(`track.${i}.pan`);
        midi.unregisterTarget(`track.${i}.mute`);
      }
      midi.unregisterTarget('fx.reverb');
      midi.unregisterTarget('fx.delay');
    };
  // Re-register when tracks change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tracks.length]);

  // ─── Project Manager ───
  const projectManager = useProjectManager(state, dispatch, clearHistory);

  // ─── Track Metering ───
  const trackLevels = useTrackMetering(fxRack, state.isPlaying, state.tracks.length);

  // ─── Sidechain Compression ───
  const sidechain = useSidechain({
    fxRack: fxRack.current,
    ctx: audioCtx.current,
    trackCount: state.tracks.length,
    selectedTrack: state.selectedTrack,
  });

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
    setOnTrigger((trackIndex, step, time, polyStep) => {
      const track = state.tracks[trackIndex];
      if (!audioCtx.current || !masterChain.current || !track) return;

      // ─── Astral Dais Bridge: emit throne trigger for pad flash ───
      if (track.sourceType === 'sample' && trackIndex < 16) {
        window.dispatchEvent(new CustomEvent('throne-trigger', {
          detail: { padIndex: trackIndex },
        }));
      }
      
      const ctx = audioCtx.current;

      // ─── Frozen Track: play bounced buffer on step 0 only ───
      if (track.isFrozen && frozenBuffersRef.current[trackIndex]) {
        // Only trigger the frozen buffer on step 0 to play the full pattern once
        if (polyStep === 0) {
          const frozenBuf = frozenBuffersRef.current[trackIndex];
          const source = ctx.createBufferSource();
          source.buffer = frozenBuf;
          const gain = ctx.createGain();
          gain.gain.value = track.volume * 0.8;
          const panner = ctx.createStereoPanner();
          panner.pan.value = track.pan;
          source.connect(gain).connect(panner).connect(masterChain.current!.input);
          source.start(time);
        }
        return; // Skip live processing for frozen tracks
      }

      // ─── Get or create per-track FX send nodes ───
      const sends = fxRack.current?.createTrackSends(trackIndex, track.fxSends);
      // Fallback destination: if FXRack not ready, route to masterChain directly
      const trackDestination = sends?.dry ?? masterChain.current!.input;

      // ═══ SYNTH TRACK ROUTING ═══
      if (track.sourceType === 'synth' && track.synthConfig) {
        const engine = getSynthEngine(trackIndex, track.synthConfig.godId);
        if (!engine) return;

        const octaveOffset = track.synthConfig.octave * 12;

        // ─── Piano Roll Mode: scan pianoRollNotes for this step ───
        if (track.synthConfig.usePianoRoll && track.synthConfig.pianoRollNotes?.length) {
          const stepDuration = 60 / state.bpm / 4; // duration of one step in seconds
          const currentStepIdx = step.sliceIndex; // step index from the sequencer

          // Find all notes that START on this step (within 0.5 step tolerance for quantized playback)
          const notesAtStep = track.synthConfig.pianoRollNotes.filter(n =>
            Math.floor(n.startStep) === currentStepIdx
          );

          for (const prNote of notesAtStep) {
            const midiNote = prNote.note + octaveOffset;
            engine.noteOn(midiNote, prNote.velocity);

            // Schedule noteOff based on actual note duration
            const durationMs = Math.max(50, prNote.duration * stepDuration * 1000);
            setTimeout(() => {
              engine.noteOff(midiNote);
            }, durationMs);
          }

          // JUCE bridge — send first note info
          if (notesAtStep.length > 0) {
            const stepBridgePayload: StepBridgePayload = {
              velocity: notesAtStep[0].velocity,
              pitch: step.pitch,
              pan: step.pan,
              decay: step.decay,
              sliceIndex: step.sliceIndex,
              sourceType: 'synth',
              synthNote: notesAtStep[0].note + octaveOffset,
              synthGodId: track.synthConfig.godId,
            };
            nativeAudio.triggerStep(trackIndex, stepBridgePayload, time);
          }
          return;
        }

        // ─── Legacy noteMap mode ───
        const baseNote = track.synthConfig.noteMap[step.sliceIndex] ?? 60; // C4 fallback
        const midiNote = baseNote + octaveOffset;
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

      // ═══ SAMPLE TRACK ROUTING ═══
      // Phase 6: Delegate to God Engine if available (uses per-slot DSP chain)
      if (godEngine?.current) {
        godEngine.current.triggerPadAtTime(
          trackIndex, 
          time, 
          step.velocity, 
          step.pitch, 
          step.decay,
          step.reverse,
          step.sliceIndex
        );

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
        return;
      }

      // Legacy fallback: create buffer source directly (when no God Engine)
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

      // Panning (step pan + track-level pan)
      const panner = ctx.createStereoPanner();
      const combinedPan = Math.max(-1, Math.min(1, step.pan + track.pan));
      panner.pan.setValueAtTime(combinedPan, time);

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
            if (e.altKey) {
              dispatch({ type: 'SWAP_TRACK_WITH_CLIPBOARD' });
            } else if (projectManager.activeProject) {
              projectManager.quickSave();
            } else {
              setShowProjectDrawer(true);
            }
            return;
          case 'c':
            e.preventDefault();
            if (e.altKey) {
              dispatch({ type: 'COPY_TRACK', trackIndex: state.selectedTrack });
            } else if ((state.selectedSteps ?? []).length > 0) {
              dispatch({ type: 'COPY_SELECTED_STEPS' });
            } else {
              dispatch({ type: 'COPY_TRACK_PATTERN' });
            }
            return;
          case 'v':
            e.preventDefault();
            if (e.altKey) {
              dispatch({ type: 'PASTE_TRACK', trackIndex: state.selectedTrack });
            } else if (state.clipboardSteps && state.clipboardSteps.length > 0) {
              const ss = state.selectedSteps ?? [];
              const startIdx = ss.length > 0
                ? Math.min(...ss)
                : 0;
              dispatch({ type: 'PASTE_SELECTED_STEPS', startIndex: startIdx });
            } else {
              dispatch({ type: 'PASTE_TRACK_PATTERN' });
            }
            return;
          case 'a':
            e.preventDefault();
            // Cmd+A: select all steps
            dispatch({
              type: 'SELECT_STEP_RANGE',
              from: 0,
              to: state.stepCount - 1,
            });
            return;
          case 'd':
            e.preventDefault();
            if ((state.selectedSteps ?? []).length > 0) {
              dispatch({ type: 'DOUBLE_SELECTED_STEPS' });
            } else {
              dispatch({ type: 'DUPLICATE_TRACK_PATTERN', trackIndex: state.selectedTrack });
            }
            return;
        }
        return;
      }
      
      // ─── Alt modifier shortcuts ───
      if (e.altKey) {
        switch (e.code) {
          case 'ArrowLeft':
            e.preventDefault();
            dispatch({ type: 'ROTATE_TRACK_PATTERN', trackIndex: state.selectedTrack, direction: 'left' });
            return;
          case 'ArrowRight':
            e.preventDefault();
            dispatch({ type: 'ROTATE_TRACK_PATTERN', trackIndex: state.selectedTrack, direction: 'right' });
            return;
          case 'KeyC':
            e.preventDefault();
            dispatch({ type: 'CLEAR_TRACK', trackIndex: state.selectedTrack });
            return;
          case 'KeyS':
            e.preventDefault();
            dispatch({ type: 'SWAP_PATTERNS' });
            return;
        }
      }

      // ─── Single-key shortcuts ───
      switch (e.code) {
        case 'Escape':
          if (isFullscreen) {
            e.preventDefault();
            setIsFullscreen(false);
          }
          setStepDetail(null);
          setChopperTrackIndex(null);
          setShowProjectDrawer(false);
          dispatch({ type: 'CLEAR_SELECTION' });
          return;
        case 'Space':
          e.preventDefault();
          togglePlay();
          return;
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
        case 'r':
        case 'R':
          if (!e.metaKey && !e.ctrlKey) {
            dispatch({ type: 'TOGGLE_AUTOMATION_RECORD' });
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (!e.metaKey && !e.ctrlKey) {
            if ((state.selectedSteps ?? []).length > 0) {
              dispatch({ type: 'DELETE_SELECTED_STEPS' });
            } else {
              dispatch({ type: 'CLEAR_TRACK', trackIndex: state.selectedTrack });
            }
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isMeta && e.altKey) {
            const from = state.selectedTrack;
            const to = (from - 1 + state.tracks.length) % state.tracks.length;
            dispatch({ type: 'REORDER_TRACKS', fromIndex: from, toIndex: to });
            dispatch({ type: 'SELECT_TRACK', index: to });
          } else {
            dispatch({ type: 'SELECT_TRACK', index: (state.selectedTrack - 1 + state.tracks.length) % state.tracks.length });
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (isMeta && e.altKey) {
            const from = state.selectedTrack;
            const to = (from + 1) % state.tracks.length;
            dispatch({ type: 'REORDER_TRACKS', fromIndex: from, toIndex: to });
            dispatch({ type: 'SELECT_TRACK', index: to });
          } else {
            dispatch({ type: 'SELECT_TRACK', index: (state.selectedTrack + 1) % state.tracks.length });
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
  }, [togglePlay, undo, redo, dispatch, state.selectedTrack, state.tracks.length, projectManager, isFullscreen]);

  /* ─── Dispatch Helpers ─── */
  const handleToggleMute = useCallback((trackIndex: number) => {
    dispatch({ type: 'TOGGLE_MUTE', trackIndex });
  }, [dispatch]);

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

  /* ─── Phase D: Sample Drag-and-Drop Loading ─── */
  const handleSampleDrop = useCallback(async (trackIndex: number, file: File) => {
    if (!audioCtx.current) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioCtx.current.decodeAudioData(arrayBuffer);

      // Store in the buffers map
      buffers[trackIndex] = audioBuffer;

      // Auto-convert to sample track if not already
      const track = state.tracks[trackIndex];
      if (track.sourceType !== 'sample') {
        dispatch({ type: 'SET_TRACK_SOURCE', trackIndex, sourceType: 'sample' as const });
      }

      // Rename track to the file name (strip extension, uppercase, truncate)
      const name = file.name.replace(/\.[^/.]+$/, '').toUpperCase().slice(0, 12);
      dispatch({ type: 'RENAME_TRACK', trackIndex, name });

      // Log sample info
      const duration = audioBuffer.duration.toFixed(2);
      const channels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      console.log(`[SacredSequencer] Sample loaded: ${file.name} (${duration}s, ${channels}ch, ${sampleRate}Hz)`);
    } catch (err) {
      console.error('[SacredSequencer] Failed to decode audio file:', err);
    }
  }, [audioCtx, buffers, dispatch, state.tracks]);

  /* ═══ Track Bounce/Freeze Handlers ═══ */

  const handleFreezeTrack = useCallback(async (trackIndex: number) => {
    if (bouncingTrack !== null) return; // already bouncing
    const track = state.tracks[trackIndex];
    if (!track || track.isFrozen) return;

    setBouncingTrack(trackIndex);
    setBounceProgress(0);

    try {
      const pattern = state.activePattern === 'A' ? track.patternA : track.patternB;
      const trackBuffer = buffers[trackIndex] || null;

      const rendered = await bounceTrack(
        track,
        pattern,
        trackBuffer,
        {
          bpm: state.bpm,
          stepCount: state.stepCount,
          sampleRate: audioCtx.current?.sampleRate ?? 44100,
          tailSeconds: 1.0,
        },
        (progress: BounceProgress) => {
          setBounceProgress(progress.percent);
        }
      );

      // Store the frozen buffer
      frozenBuffersRef.current[trackIndex] = rendered;

      // Mark track as frozen in state
      dispatch({ type: 'FREEZE_TRACK', trackIndex });

      console.log(`[SacredSequencer] Track ${trackIndex} frozen: ${rendered.duration.toFixed(2)}s`);
    } catch (err) {
      console.error('[SacredSequencer] Freeze failed:', err);
    } finally {
      setBouncingTrack(null);
      setBounceProgress(0);
    }
  }, [bouncingTrack, state.tracks, state.activePattern, state.bpm, state.stepCount, buffers, audioCtx, dispatch]);

  const handleUnfreezeTrack = useCallback((trackIndex: number) => {
    // Remove frozen buffer and restore live processing
    delete frozenBuffersRef.current[trackIndex];
    dispatch({ type: 'UNFREEZE_TRACK', trackIndex });
    console.log(`[SacredSequencer] Track ${trackIndex} unfrozen`);
  }, [dispatch]);

  /* ═══ Audio Input Recording Handlers ═══ */

  const handleStartRecording = useCallback(async () => {
    // Find the record-armed track
    const armedIdx = state.tracks.findIndex(t => t.isRecordArmed);
    if (armedIdx < 0) return;

    try {
      const recorder = new AudioInputRecorder({
        channelCount: 1,
        sampleRate: audioCtx.current?.sampleRate ?? 44100,
        maxDurationSeconds: 120,
        onLevel: (levelState) => {
          setRecordingState({
            isRecording: levelState.isRecording,
            duration: levelState.duration,
            peakLevel: levelState.peakLevel,
          });
        },
      });

      await recorder.start(audioCtx.current || undefined);
      recorderRef.current = recorder;
    } catch (err) {
      console.error('[SacredSequencer] Recording failed:', err);
      setRecordingState(null);
    }
  }, [state.tracks, audioCtx]);

  const handleStopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    const armedIdx = state.tracks.findIndex(t => t.isRecordArmed);
    const recordedBuffer = recorder.stop();
    recorder.dispose();
    recorderRef.current = null;
    setRecordingState(null);

    if (recordedBuffer && armedIdx >= 0) {
      // Assign recorded buffer to the armed track
      buffers[armedIdx] = recordedBuffer;

      // Auto-convert to sample track if needed
      if (state.tracks[armedIdx].sourceType !== 'sample') {
        dispatch({ type: 'SET_TRACK_SOURCE', trackIndex: armedIdx, sourceType: 'sample' as const });
      }

      // Rename track to indicate recording
      const timestamp = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit' });
      dispatch({ type: 'RENAME_TRACK', trackIndex: armedIdx, name: `REC ${timestamp}` });

      // Disarm
      dispatch({ type: 'TOGGLE_RECORD_ARM', trackIndex: armedIdx });

      console.log(`[SacredSequencer] Recording captured: ${recordedBuffer.duration.toFixed(2)}s → Track ${armedIdx}`);
    }
  }, [state.tracks, buffers, dispatch]);

  // Auto-start/stop recording when play state changes and a track is armed
  useEffect(() => {
    const hasArmedTrack = state.tracks.some(t => t.isRecordArmed);
    if (state.isPlaying && hasArmedTrack && !recorderRef.current) {
      handleStartRecording();
    } else if (!state.isPlaying && recorderRef.current) {
      handleStopRecording();
    }
  }, [state.isPlaying, state.tracks, handleStartRecording, handleStopRecording]);


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

  /* ─── Stem Export (per-track WAVs) ─── */
  const [isExportingStems, setIsExportingStems] = useState(false);
  const handleExportStems = useCallback(async () => {
    if (!isLoadedRef.current || isExportingStems) return;
    setIsExportingStems(true);
    try {
      console.log('Starting Stem Export...');
      for (let i = 0; i < state.tracks.length; i++) {
        const track = state.tracks[i];
        if (track.muted) continue;
        const buffer = buffers[i];
        const blob = await ExportEngine.renderStem(state, i, buffer);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = track.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        a.download = `stem_${i + 1}_${safeName}_${state.bpm}bpm.wav`;
        a.click();
        URL.revokeObjectURL(url);
      }
      console.log('Stem Export Complete.');
    } catch (err) {
      console.error('Failed to export stems', err);
    } finally {
      setIsExportingStems(false);
    }
  }, [state, isExportingStems]);

  /* ─── Metronome (click track) ─── */
  const [metronomeOn, setMetronomeOn] = useState(false);
  const metronomeRef = useRef<{ osc: OscillatorNode | null; gain: GainNode | null }>({ osc: null, gain: null });

  const triggerMetronomeClick = useCallback((isDownbeat: boolean) => {
    if (!metronomeOn || !audioCtx.current) return;
    const ctx = audioCtx.current;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = isDownbeat ? 1000 : 800; // higher pitch on downbeats

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isDownbeat ? 0.25 : 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }, [metronomeOn]);

  const selectedTrack = state.tracks[state.selectedTrack];
  const selectedPattern = state.activePattern === 'A' ? selectedTrack?.patternA : selectedTrack?.patternB;

  // ─── MIDI Note Input (Live Audition + Piano Roll Recording) ───
  const selectedSynthEngine = selectedTrack?.sourceType === 'synth' && selectedTrack?.synthConfig
    ? getSynthEngine(state.selectedTrack, selectedTrack.synthConfig.godId)
    : null;

  // ─── Arpeggiator ───
  const arp = useArpeggiator({
    synthEngine: selectedSynthEngine,
    bpm: state.bpm,
    octave: selectedTrack?.synthConfig?.octave ?? 0,
    enabled: selectedTrack?.sourceType === 'synth',
  });

  const midiNoteInput = useMidiNoteInput({
    isArmed: midiNoteArmed && selectedTrack?.sourceType === 'synth',
    isRecording: state.isRecording ?? false,
    isPlaying: state.isPlaying,
    currentStep: state.currentStep,
    stepCount: state.stepCount,
    bpm: state.bpm,
    octave: selectedTrack?.synthConfig?.octave ?? 0,
    // When arp is enabled, don't let MIDI input play directly — route through arp
    synthEngine: arp.config.enabled ? null : selectedSynthEngine,
    onAddNote: (note: PianoRollNote) => {
      dispatch({ type: 'ADD_PIANO_NOTE', trackIndex: state.selectedTrack, note });
      // Auto-enable Piano Roll mode
      if (!selectedTrack?.synthConfig?.usePianoRoll) {
        dispatch({ type: 'TOGGLE_PIANO_ROLL_MODE', trackIndex: state.selectedTrack });
      }
      // Auto-show Piano Roll panel
      if (!showPianoRoll) setShowPianoRoll(true);
    },
    scaleConfig,
  });

  // Route MIDI notes through arpeggiator when enabled
  useEffect(() => {
    if (!arp.config.enabled || !midiNoteArmed) return;
    // We piggyback on the MIDI input bus directly for arp routing
    const handleArpNote = (event: any) => {
      if (event.note === undefined) return;
      if (event.type === 'midi_note_on') {
        const velocity7bit = Math.round((event.velocity / 65535) * 127);
        arp.arpNoteOn(event.note, velocity7bit);
      }
      if (event.type === 'midi_note_off') {
        arp.arpNoteOff(event.note);
      }
    };
    const unsub = neuralInputBus.addListener(handleArpNote);
    return () => unsub();
  }, [arp.config.enabled, midiNoteArmed, arp.arpNoteOn, arp.arpNoteOff]);

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
    <div className={`seq-container ${state.isFillMode ? 'seq-container--fill' : ''} ${isFullscreen ? 'seq-container--fullscreen' : ''}`}>
      {/* God Realm: Ambient Divine Particle Field */}
      <DivineParticleField count={18} isPlaying={state.isPlaying} />

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
        onExportStems={handleExportStems}
        isExportingStems={isExportingStems}
        metronomeOn={metronomeOn}
        onToggleMetronome={() => setMetronomeOn(prev => !prev)}
        showMidiMapper={showMidiMapper}
        isMidiLearning={midi.isLearning}
        onToggleMidiMapper={() => setShowMidiMapper(prev => !prev)}
        showPianoRoll={showPianoRoll}
        isSynthTrack={selectedTrack.sourceType === 'synth'}
        onTogglePianoRoll={() => setShowPianoRoll(prev => !prev)}
        midiNoteArmed={midiNoteArmed}
        hasActiveMidiInput={midiNoteInput.hasActiveInput}
        onToggleMidiArm={() => setMidiNoteArmed(prev => !prev)}
        showArpeggiator={showArpeggiator}
        arpEnabled={arp.config.enabled}
        onToggleArpPanel={() => setShowArpeggiator(prev => !prev)}
        showScaleChord={showScaleChord}
        scaleEnabled={scaleConfig.enabled}
        onToggleScalePanel={() => setShowScaleChord(prev => !prev)}
        showSidechain={showSidechain}
        sidechainEnabled={sidechain.config.enabled}
        onToggleSidechain={() => {
          setShowSidechain(prev => !prev);
          if (!showSidechain) {
            setShowOracle(false);
            setShowScaleChord(false);
            setShowArpeggiator(false);
          }
        }}
        showOracle={showOracle}
        onToggleOracle={() => {
          setShowOracle(prev => !prev);
          if (!showOracle) {
            setShowScaleChord(false);
            setShowArpeggiator(false);
            setShowSidechain(false);
          }
        }}
        showMeter={showMeter}
        onToggleMeter={() => setShowMeter(prev => !prev)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
        showModMatrix={showModMatrix}
        onToggleModMatrix={onToggleModMatrix}
      />

      {/* Playhead Position Bar */}
      {!showMixer && (
        <>
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
            onHumanize={() => dispatch({ type: 'HUMANIZE_TRACK', trackIndex: i, amount: 15 })}
            onQuantize={() => dispatch({ type: 'QUANTIZE_TRACK', trackIndex: i })}
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
            /* Track reorder */
            onMoveTrackUp={i > 0 ? () => dispatch({ type: 'REORDER_TRACKS', fromIndex: i, toIndex: i - 1 }) : undefined}
            onMoveTrackDown={i < state.tracks.length - 1 ? () => dispatch({ type: 'REORDER_TRACKS', fromIndex: i, toIndex: i + 1 }) : undefined}
            /* Sample drop */
            onSampleDrop={(file) => handleSampleDrop(i, file)}
            /* Track pan */
            trackPan={track.pan}
            onSetTrackPan={(pan) => dispatch({ type: 'SET_TRACK_PAN', trackIndex: i, pan })}
            /* Per-track swing */
            trackSwing={track.swing}
            onSetTrackSwing={(swing) => dispatch({ type: 'SET_TRACK_SWING', trackIndex: i, swing })}
            /* Phase C: Multi-step selection */
            selectedSteps={state.selectedTrack === i ? (state.selectedSteps ?? []) : []}
            onSelectStep={(stepIndex, additive, range) =>
              dispatch({ type: 'SELECT_STEP', stepIndex, additive, range })
            }
            onFillSteps={(interval) =>
              dispatch({ type: 'FILL_STEPS', trackIndex: i, interval })
            }
            onShiftSteps={(direction) =>
              dispatch({ type: 'ROTATE_TRACK_PATTERN', trackIndex: i, direction })
            }
            /* Phase D: Waveform + Ghost Notes */
            buffer={buffers[i] || null}
            ghostSteps={state.tracks
              .filter((_, idx) => idx !== i)
              .map(t => ({
                color: t.color,
                pattern: (state.activePattern === 'A' ? t.patternA : t.patternB)
                  .slice(0, state.stepCount) as { enabled: boolean }[],
              }))}
            /* Phase 5: Polyrhythm */
            onSetPolymetricLength={(len) => dispatch({ type: 'SET_POLYMETRIC_LENGTH', trackIndex: i, length: len })}
            /* Phase 5: Pattern clipboard */
            onCopyTrackPattern={() => dispatch({ type: 'COPY_TRACK_PATTERN' })}
            onPasteTrackPattern={() => dispatch({ type: 'PASTE_TRACK_PATTERN' })}
            onSwapPatterns={() => dispatch({ type: 'SWAP_PATTERNS' })}
            onDuplicateTrackPattern={() => dispatch({ type: 'DUPLICATE_TRACK_PATTERN', trackIndex: i })}
            canPastePattern={state.clipboardPattern !== null}
            onCopyTrack={(trackIndex) => dispatch({ type: 'COPY_TRACK', trackIndex })}
            onPasteTrack={(trackIndex) => dispatch({ type: 'PASTE_TRACK', trackIndex })}
            canPasteTrack={state.clipboardTrack !== null}
            /* Track Bounce/Freeze */
            onFreezeTrack={() => handleFreezeTrack(i)}
            onUnfreezeTrack={() => handleUnfreezeTrack(i)}
            onToggleRecordArm={() => dispatch({ type: 'TOGGLE_RECORD_ARM', trackIndex: i })}
            isBouncing={bouncingTrack === i}
            bounceProgress={bouncingTrack === i ? bounceProgress : 0}
            recordingState={track.isRecordArmed ? recordingState : null}
          />
        ))}

        {/* ─── Add Track Button ─── */}
        {state.tracks.length < 16 && (
          <div className="seq-add-track-row">
            <button
              className="seq-add-track-btn"
              onClick={() => dispatch({ type: 'ADD_TRACK', sourceType: 'sample' })}
              title="Add Sample Track"
            >
              <span className="seq-add-track-btn__icon">+</span>
              <span className="seq-add-track-btn__label">ADD TRACK</span>
            </button>
            <button
              className="seq-add-track-btn seq-add-track-btn--synth"
              onClick={() => dispatch({ type: 'ADD_TRACK', sourceType: 'synth' })}
              title="Add Synth Track"
            >
              <span className="seq-add-track-btn__icon">⚡</span>
              <span className="seq-add-track-btn__label">ADD SYNTH</span>
            </button>
          </div>
        )}
      </div>
      </>)}

      {/* Mixer Console — God-tier premium mixing */}
      {showMixer && (
        <SacredMixerConsole
          tracks={state.tracks}
          selectedTrack={state.selectedTrack}
          levels={trackLevels}
          master={state.master}
          onSetMasterParam={(param, value) => {
            dispatch({ type: 'SET_MASTER_PARAM', param, value });
            // Let the velvet curve engine pick it up dynamically via its subscription/sync logic
          }}
          analyzer={analyzerRef.current}
          isPlaying={state.isPlaying}
          bpm={state.bpm}
          onSelectTrack={(idx) => dispatch({ type: 'SELECT_TRACK', index: idx })}
          parameterValues={parameterValues}
          update={update}
          onAddInsertFx={(trackIndex, slotIndex, effectType) => dispatch({ type: 'ADD_INSERT_FX', trackIndex, slotIndex, effectType })}
          onRemoveInsertFx={(trackIndex, slotIndex) => dispatch({ type: 'REMOVE_INSERT_FX', trackIndex, slotIndex })}
          onSetInsertFxParam={(trackIndex, slotIndex, param, value) => dispatch({ type: 'SET_INSERT_FX_PARAM', trackIndex, slotIndex, param, value })}
          onToggleInsertFx={(trackIndex, slotIndex) => dispatch({ type: 'TOGGLE_INSERT_FX', trackIndex, slotIndex })}
          onSetVolume={(trackIndex, volume) => {
            dispatch({ type: 'SET_TRACK_VOLUME', trackIndex, volume });
            recordAutomation(trackIndex, 'volume', Math.min(1, Math.max(0, volume / 1.5)));
          }}
          onSetPan={(trackIndex, pan) => {
            dispatch({ type: 'SET_TRACK_PAN', trackIndex, pan });
            recordAutomation(trackIndex, 'pan', (Math.max(-1, Math.min(1, pan)) + 1) / 2);
          }}
          onSetFxSend={(trackIndex, fx, value) => {
            dispatch({ type: 'SET_FX_SEND', trackIndex, fx, value });
            const fxParamMap: Record<string, AutomationParam> = {
              reverb: 'fxReverb', chorus: 'fxChorus', delay: 'fxDelay', saturation: 'fxSaturation',
            };
            const autoParam = fxParamMap[fx];
            if (autoParam) {
              recordAutomation(trackIndex, autoParam, Math.min(1, Math.max(0, value / 100)));
            }
          }}
          onSetEQ={(trackIndex, band, value) => {
            dispatch({ type: 'SET_TRACK_EQ', trackIndex, band, value });
            // Update FXRack EQ in real-time
            if (fxRack.current) {
              const track = state.tracks[trackIndex];
              const eq = {
                low: band === 'low' ? value : track.eqLow,
                mid: band === 'mid' ? value : track.eqMid,
                high: band === 'high' ? value : track.eqHigh,
              };
              fxRack.current.updateTrackEQ(trackIndex, eq);
            }
          }}
          onToggleMute={(trackIndex) => dispatch({ type: 'TOGGLE_MUTE', trackIndex })}
          onToggleSolo={(trackIndex) => dispatch({ type: 'TOGGLE_SOLO', trackIndex })}
          onOpenPlugin={handleOpenPlugin}
        />
      )}

      {/* FX Rack Panel — toggle via FX button */}
      {showFxPanel && (
        <SacredFXRackPanel fxRack={fxRack} />
      )}

      {/* Master Metering & Spectrum Analyzer */}
      {showMeter && (
        <SacredMasterMeter
          analyzer={analyzerRef.current}
          isPlaying={state.isPlaying}
          bpm={state.bpm}
        />
      )}

      {/* MIDI Controller Mapping Panel */}
      {showMidiMapper && (
        <SacredMidiMapper
          mappings={midi.mappings}
          targets={midi.targets}
          isLearning={midi.isLearning}
          learningTargetId={midi.learningTargetId}
          connectedDevices={midi.connectedDevices}
          ccActivity={midi.ccActivity}
          onStartLearn={midi.startLearn}
          onCancelLearn={midi.cancelLearn}
          onRemoveMapping={midi.removeMapping}
          onClearAll={midi.clearAll}
          onClose={() => setShowMidiMapper(false)}
        />
      )}
      {/* Selection Toolbar — floating when steps are selected */}
      <SelectionToolbar
        selectedCount={(state.selectedSteps ?? []).length}
        hasClipboard={!!(state.clipboardSteps ?? []).length}
        onCopy={() => dispatch({ type: 'COPY_SELECTED_STEPS' })}
        onPaste={() => {
          const ss = state.selectedSteps ?? [];
          const startIdx = ss.length > 0
            ? Math.min(...ss)
            : 0;
          dispatch({ type: 'PASTE_SELECTED_STEPS', startIndex: startIdx });
        }}
        onDelete={() => dispatch({ type: 'DELETE_SELECTED_STEPS' })}
        onReverse={() => dispatch({ type: 'REVERSE_SELECTED_STEPS' })}
        onDouble={() => dispatch({ type: 'DOUBLE_SELECTED_STEPS' })}
        onHalve={() => dispatch({ type: 'HALVE_SELECTED_STEPS' })}
        onRandomizeVelocity={() => dispatch({ type: 'RANDOMIZE_SELECTED_VELOCITY' })}
        onClear={() => dispatch({ type: 'CLEAR_SELECTION' })}
      />

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
        onReorderBlock={(fromIndex, toIndex) => dispatch({ type: 'REORDER_SONG_BLOCKS', fromIndex, toIndex })}
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

      {/* Piano Roll — for synth tracks */}
      {showPianoRoll && selectedTrack.sourceType === 'synth' && selectedTrack.synthConfig && (() => {
        // Compute ghost notes from all other synth tracks
        const ghostNotes: GhostTrackNotes[] = state.tracks
          .map((t, i) => ({ track: t, index: i }))
          .filter(({ track, index }) =>
            index !== state.selectedTrack &&
            track.sourceType === 'synth' &&
            track.synthConfig?.pianoRollNotes &&
            track.synthConfig.pianoRollNotes.length > 0
          )
          .map(({ track, index }) => ({
            trackIndex: index,
            trackName: track.name,
            trackColor: track.color,
            notes: track.synthConfig!.pianoRollNotes ?? [],
          }));

        return (
        <SacredPianoRoll
          notes={selectedTrack.synthConfig.pianoRollNotes ?? []}
          stepCount={state.stepCount}
          currentStep={state.currentStep}
          isPlaying={state.isPlaying}
          trackColor={selectedTrack.color}
          trackIndex={state.selectedTrack}
          octave={selectedTrack.synthConfig.octave}
          liveNotes={midiNoteInput.liveNotes}
          scaleConfig={scaleConfig}
          ghostNotes={ghostNotes}
          onAddNote={(note: PianoRollNote) => {
            dispatch({ type: 'ADD_PIANO_NOTE', trackIndex: state.selectedTrack, note });
            // Auto-enable Piano Roll mode when first note is added
            if (!selectedTrack.synthConfig?.usePianoRoll) {
              dispatch({ type: 'TOGGLE_PIANO_ROLL_MODE', trackIndex: state.selectedTrack });
            }
          }}
          onRemoveNote={(noteId: string) => {
            dispatch({ type: 'REMOVE_PIANO_NOTE', trackIndex: state.selectedTrack, noteId });
          }}
          onUpdateNote={(noteId: string, changes: Partial<Omit<PianoRollNote, 'id'>>) => {
            dispatch({ type: 'UPDATE_PIANO_NOTE', trackIndex: state.selectedTrack, noteId, changes });
          }}
        />
        );
      })()}

      {/* Arpeggiator Panel — for synth tracks */}
      {showArpeggiator && selectedTrack.sourceType === 'synth' && (
        <SacredArpeggiator
          config={arp.config}
          isRunning={arp.isRunning}
          currentStep={arp.currentStep}
          sequence={arp.sequence}
          heldNoteCount={arp.heldNoteCount}
          onConfigChange={arp.updateConfig}
        />
      )}

      {/* Scale & Chord Panel — for synth tracks */}
      {showScaleChord && selectedTrack.sourceType === 'synth' && selectedTrack.synthConfig && (
        <SacredScaleChord
          config={scaleConfig}
          onConfigChange={(changes) => setScaleConfig(prev => ({ ...prev, ...changes }))}
          detectedChord={
            selectedTrack.synthConfig.pianoRollNotes?.length >= 3
              ? detectChord(selectedTrack.synthConfig.pianoRollNotes.map(n => n.note))
              : null
          }
          insertStep={Math.max(0, state.currentStep)}
          onInsertChord={(notes) => {
            notes.forEach(note => {
              dispatch({ type: 'ADD_PIANO_NOTE', trackIndex: state.selectedTrack, note });
            });
            if (!selectedTrack.synthConfig?.usePianoRoll) {
              dispatch({ type: 'TOGGLE_PIANO_ROLL_MODE', trackIndex: state.selectedTrack });
            }
            if (!showPianoRoll) setShowPianoRoll(true);
          }}
        />
      )}

      {/* Divine Oracle Generative Panel */}
      {showOracle && (
        <DivineOraclePanel
          state={state}
          scaleConfig={scaleConfig}
          onClose={() => setShowOracle(false)}
          dispatch={dispatch}
        />
      )}

      {/* Sidechain Compressor Panel */}
      {showSidechain && (
        <SacredSidechain
          config={sidechain.config}
          onConfigChange={sidechain.updateConfig}
          availableSources={state.tracks.map((t, i) => ({
            index: i,
            name: t.name,
            icon: t.icon,
            color: t.color,
          }))}
          currentTrackIndex={state.selectedTrack}
          gainReduction={sidechain.gainReduction}
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
            <SacredChopper
              onFileDropped={(file, buffer) => {
                // Mutate the shared buffers map so playback picks up the new audio
                buffers[chopperTrackIndex] = buffer;
                const baseName = file.name.replace(/\.[^.]+$/, '');
                dispatch({ type: 'RENAME_TRACK', trackIndex: chopperTrackIndex, name: baseName });
                dispatch({ type: 'SET_TRACK_SOURCE', trackIndex: chopperTrackIndex, sourceType: 'sample' });
              }}
              trackIndex={chopperTrackIndex}
              trackName={state.tracks[chopperTrackIndex]?.name || 'TRACK'}
              trackColor={state.tracks[chopperTrackIndex]?.color || '#FFD700'}
              buffer={buffers[chopperTrackIndex] || null}
              sampleParams={state.tracks[chopperTrackIndex]?.sampleParams}
              onUpdateParam={(param: string, value: any) => {
                dispatch({
                  type: 'SET_SAMPLE_PARAM',
                  trackIndex: chopperTrackIndex,
                  param,
                  value,
                });
              }}
              onClose={() => setChopperTrackIndex(null)}
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

      {/* ═══ Floating Anunnaki Plugin Windows ═══ */}
      {openPlugins.map(({ trackIndex, slotIndex, id }) => {
        const track = state.tracks[trackIndex];
        if (!track) return null;
        const fx = track.insertFx?.[slotIndex];
        if (!fx) {
          // Effect was removed while window was open
          return null;
        }
        const entry = pluginRegistry[fx.type];
        if (!entry) return null;

        const PluginComponent = entry.component;

        return (
          <AnunnakiPluginWindow
            key={id}
            id={id}
            title={entry.displayName}
            icon={entry.icon}
            width={entry.defaultWidth}
            height={entry.defaultHeight}
            minWidth={entry.minWidth}
            minHeight={entry.minHeight}
            trackIndex={trackIndex}
            slotIndex={slotIndex}
            trackColor={track.color}
            onClose={() => handleClosePlugin(id)}
            onBypass={(bypassed) => dispatch({ type: 'TOGGLE_INSERT_FX', trackIndex, slotIndex })}
            bypassed={!fx.enabled}
          >
            {PluginComponent ? (
              <React.Suspense fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(212,168,83,0.4)', fontSize: '11px', letterSpacing: '2px' }}>
                  LOADING...
                </div>
              }>
                <PluginComponent
                  trackIndex={trackIndex}
                  slotIndex={slotIndex}
                  params={fx.params}
                  onParamChange={(param, value) => dispatch({ type: 'SET_INSERT_FX_PARAM', trackIndex, slotIndex, param, value })}
                  bypassed={!fx.enabled}
                  trackColor={track.color}
                />
              </React.Suspense>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'rgba(212,168,83,0.3)' }}>
                <div style={{ fontSize: '32px' }}>{entry.icon}</div>
                <div style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' as const }}>{entry.displayName}</div>
                <div style={{ fontSize: '9px', letterSpacing: '1px', opacity: 0.5 }}>COMING SOON</div>
              </div>
            )}
          </AnunnakiPluginWindow>
        );
      })}
    </div>
  );
};
