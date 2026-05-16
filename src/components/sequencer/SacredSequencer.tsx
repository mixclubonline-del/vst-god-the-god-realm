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
import { nativeAudio } from '../../native/bridge';
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
  const { state, dispatch, play, stop, togglePlay, setOnTrigger, audioCtx, masterChain } = engine;
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

  // Sample-based trigger logic (Phase 7: Refined per-slice audio + de-clicking)
  useEffect(() => {
    setOnTrigger((trackIndex, step, time) => {
      const track = state.tracks[trackIndex];
      if (!audioCtx.current || !buffers[trackIndex] || !masterChain.current || !track) return;
      
      const ctx = audioCtx.current;
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

      // Routing
      source.connect(gain).connect(panner).connect(masterChain.current.input);
      
      // Start/Stop
      source.start(time, startTime, shouldLoop ? undefined : duration);
      source.stop(time + decayTime + 0.1);
    });
  }, [setOnTrigger, audioCtx, masterChain, state.tracks]);


  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay]);

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
    // Apply pattern to all tracks
    const s = state.stepCount;
    state.tracks.forEach((_, tIdx) => {
      // Clear first
      for (let step = 0; step < s; step++) {
        dispatch({ type: 'SET_STEP_PROP', trackIndex: tIdx, stepIndex: step, prop: 'enabled', value: false });
      }
    });

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
    Object.entries(preset).forEach(([trackIdxStr, data]) => {
      const tIdx = parseInt(trackIdxStr);
      data.steps.forEach((stepIdx, i) => {
        if (stepIdx < s) {
          dispatch({ type: 'TOGGLE_STEP', trackIndex: tIdx, stepIndex: stepIdx });
          if (data.vel && data.vel[i] !== undefined) {
            dispatch({ type: 'SET_STEP_VELOCITY', trackIndex: tIdx, stepIndex: stepIdx, velocity: data.vel[i] });
          }
        }
      });
    });
  }, [dispatch, state.stepCount, state.tracks]);

  // Calculate playhead beam position
  const playheadBeamLeft = state.currentStep >= 0
    ? `calc(140px + ${(state.currentStep / state.stepCount) * 100}% * (1 - 140px / 100%))`
    : '-10px';

  return (
    <div className={`seq-container ${state.isFillMode ? 'seq-container--fill' : ''}`}>
      {/* Header / Transport */}
      <SacredSequencerHeader
        state={state}
        onPlay={play}
        onStop={stop}
        onTogglePlay={togglePlay}
        onSetBpm={(bpm) => {
          dispatch({ type: 'SET_BPM', bpm });
          nativeAudio.setParameter('globalBpm', bpm);
        }}
        onSetSwing={(swing) => dispatch({ type: 'SET_SWING', swing })}
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
          />
        ))}
      </div>

      {/* Graph Editor */}
      {selectedPattern && (
        <SacredGraphEditor
          steps={selectedPattern}
          stepCount={state.stepCount}
          mode={state.activeGraphMode}
          trackColor={selectedTrack.color}
          currentStep={state.currentStep}
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
              buffer={buffers[chopperTrackIndex]}
              trackIndex={chopperTrackIndex}
              analyser={masterChain.current?.analyser || null}
              sampleParams={state.tracks[chopperTrackIndex].sampleParams}
              onUpdateParam={(param, value) => dispatch({ 
                type: 'SET_SAMPLE_PARAM', 
                trackIndex: chopperTrackIndex, 
                param, 
                value 
              })}
            />
          </div>
        </div>
      )}
    </div>
  );
};
