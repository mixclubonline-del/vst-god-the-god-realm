/**
 * SacredSequencerHeader — Transport bar, BPM, Pattern A/B, Fill, Swing, Step Count.
 * The command center for the Sacred Sequencer.
 */
import React, { useCallback, useRef, useState } from 'react';
import type { SequencerState } from './useSequencerEngine';

interface SacredSequencerHeaderProps {
  state: SequencerState;
  onPlay: () => void;
  onStop: () => void;
  onTogglePlay: () => void;
  onSetBpm: (bpm: number) => void;
  onSetSwing: (swing: number) => void;
  onSetSwingPreset: (preset: SequencerState['swingPreset']) => void;
  onSetStepCount: (count: 16 | 32 | 64) => void;
  onSetPattern: (pattern: 'A' | 'B') => void;
  onCopyPattern: (from: 'A' | 'B', to: 'A' | 'B') => void;
  onToggleFill: () => void;
  onClearAll: () => void;
  onExport: () => void;
  showMixer: boolean;
  onToggleMixer: () => void;
  showFxPanel: boolean;
  onToggleFxPanel: () => void;
  /* Phase 5 */
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  activeProject: string | null;
  isDirty: boolean;
  onToggleProjectDrawer: () => void;
  /* Phase 6b — Automation Record */
  isRecording: boolean;
  onToggleRecord: () => void;
  /* Phase A: Stem Export + Metronome */
  onExportStems?: () => void;
  isExportingStems?: boolean;
  metronomeOn?: boolean;
  onToggleMetronome?: () => void;
  /* MIDI Mapping */
  showMidiMapper?: boolean;
  isMidiLearning?: boolean;
  onToggleMidiMapper?: () => void;
  /* Piano Roll */
  showPianoRoll?: boolean;
  isSynthTrack?: boolean;
  onTogglePianoRoll?: () => void;
  /* MIDI Note Input */
  midiNoteArmed?: boolean;
  hasActiveMidiInput?: boolean;
  onToggleMidiArm?: () => void;
  /* Arpeggiator */
  showArpeggiator?: boolean;
  arpEnabled?: boolean;
  onToggleArpPanel?: () => void;
  /* Scale & Chord */
  showScaleChord?: boolean;
  scaleEnabled?: boolean;
  onToggleScalePanel?: () => void;
  /* Sidechain */
  showSidechain?: boolean;
  sidechainEnabled?: boolean;
  onToggleSidechain?: () => void;
  /* Master Meter */
  showMeter?: boolean;
  onToggleMeter?: () => void;
  /* Fullscreen */
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const SWING_PRESETS: { id: SequencerState['swingPreset']; label: string }[] = [
  { id: 'none', label: 'OFF' },
  { id: 'mpc', label: 'MPC' },
  { id: 'sp1200', label: 'SP-12' },
  { id: 'tr808', label: '808' },
  { id: 'tr909', label: '909' },
];

export const SacredSequencerHeader: React.FC<SacredSequencerHeaderProps> = ({
  state,
  onPlay,
  onStop,
  onTogglePlay,
  onSetBpm,
  onSetSwing,
  onSetSwingPreset,
  onSetStepCount,
  onSetPattern,
  onCopyPattern,
  onToggleFill,
  onClearAll,
  onExport,
  showMixer,
  onToggleMixer,
  showFxPanel,
  onToggleFxPanel,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  activeProject,
  isDirty,
  onToggleProjectDrawer,
  isRecording,
  onToggleRecord,
  onExportStems,
  isExportingStems,
  metronomeOn,
  onToggleMetronome,
  showMidiMapper,
  isMidiLearning,
  onToggleMidiMapper,
  showPianoRoll,
  isSynthTrack,
  onTogglePianoRoll,
  midiNoteArmed,
  hasActiveMidiInput,
  onToggleMidiArm,
  showArpeggiator,
  arpEnabled,
  onToggleArpPanel,
  showScaleChord,
  scaleEnabled,
  onToggleScalePanel,
  showSidechain,
  sidechainEnabled,
  onToggleSidechain,
  showMeter,
  onToggleMeter,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const bpmInputRef = useRef<HTMLInputElement>(null);
  const bpmDragRef = useRef({ isDragging: false, startY: 0, startBpm: 0 });

  // Tap tempo
  const tapTimesRef = useRef<number[]>([]);
  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    tapTimesRef.current.push(now);
    // Keep last 4 taps
    if (tapTimesRef.current.length > 4) tapTimesRef.current.shift();
    if (tapTimesRef.current.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avg);
      onSetBpm(bpm);
    }
    // Reset if gap > 2s
    setTimeout(() => {
      if (tapTimesRef.current.length > 0 &&
          performance.now() - tapTimesRef.current[tapTimesRef.current.length - 1] > 2000) {
        tapTimesRef.current = [];
      }
    }, 2100);
  }, [onSetBpm]);

  const handleBpmDoubleClick = useCallback(() => {
    setIsEditingBpm(true);
    requestAnimationFrame(() => bpmInputRef.current?.select());
  }, []);

  const handleBpmSubmit = useCallback(() => {
    setIsEditingBpm(false);
    if (bpmInputRef.current) {
      const val = parseFloat(bpmInputRef.current.value);
      if (!isNaN(val)) onSetBpm(val);
    }
  }, [onSetBpm]);

  // BPM scroll handler — mouse wheel to adjust
  const handleBpmWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const step = e.shiftKey ? 10 : 1;
    onSetBpm(state.bpm + delta * step);
  }, [onSetBpm, state.bpm]);

  // BPM drag handler — vertical drag to adjust
  const handleBpmDragStart = useCallback((e: React.PointerEvent) => {
    if (isEditingBpm) return;
    e.preventDefault();
    e.stopPropagation();
    bpmDragRef.current = { isDragging: true, startY: e.clientY, startBpm: state.bpm };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isEditingBpm, state.bpm]);

  const handleBpmDragMove = useCallback((e: React.PointerEvent) => {
    if (!bpmDragRef.current.isDragging) return;
    e.stopPropagation();
    const delta = bpmDragRef.current.startY - e.clientY;
    const sensitivity = e.shiftKey ? 0.5 : 0.2;
    const newBpm = Math.round(bpmDragRef.current.startBpm + delta * sensitivity);
    onSetBpm(newBpm);
  }, [onSetBpm]);

  const handleBpmDragEnd = useCallback((e: React.PointerEvent) => {
    bpmDragRef.current.isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div className={`seq-header ${state.isFillMode ? 'seq-header--fill' : ''}`}>
      {/* Transport Status — controls live in floating DivineTransport */}
      <div className="seq-header__transport">
        <div
          className={`seq-transport-indicator ${state.isPlaying ? 'seq-transport-indicator--playing' : ''}`}
          title={state.isPlaying ? 'Playing — use transport bar to stop' : 'Stopped — use transport bar to play'}
        >
          {state.isPlaying ? (
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="1,0 9,5 1,10" fill="currentColor"/></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor"/></svg>
          )}
        </div>

        <button
          className={`seq-transport-btn seq-record-btn ${isRecording ? 'seq-transport-btn--recording' : ''}`}
          onClick={onToggleRecord}
          title="Record Automation (R)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="5" fill={isRecording ? "#EF4444" : "currentColor"} />
          </svg>
        </button>

        {/* Undo/Redo — sequencer-specific operations */}
        <button
          className={`seq-transport-btn seq-undo-btn ${!canUndo ? 'seq-transport-btn--disabled' : ''}`}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
        >
          ↶
        </button>
        <button
          className={`seq-transport-btn seq-redo-btn ${!canRedo ? 'seq-transport-btn--disabled' : ''}`}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
        >
          ↷
        </button>
      </div>

      {/* BPM Display — scroll + drag to adjust */}
      <div
        className="seq-header__bpm"
        onDoubleClick={handleBpmDoubleClick}
        onWheel={handleBpmWheel}
        onPointerDown={handleBpmDragStart}
        onPointerMove={handleBpmDragMove}
        onPointerUp={handleBpmDragEnd}
        style={{ cursor: isEditingBpm ? 'text' : 'ns-resize' }}
      >
        {isEditingBpm ? (
          <input
            ref={bpmInputRef}
            className="seq-header__bpm-input"
            type="number"
            defaultValue={state.bpm}
            onBlur={handleBpmSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleBpmSubmit()}
            autoFocus
          />
        ) : (
          <>
            <span className="seq-header__bpm-value">{state.bpm}</span>
            <span className="seq-header__bpm-label">BPM</span>
          </>
        )}
        <button className="seq-header__tap" onClick={handleTapTempo} title="Tap Tempo">
          TAP
        </button>
      </div>

      {/* Pattern A/B */}
      <div className="seq-header__patterns">
        <button
          className={`seq-pattern-btn ${state.activePattern === 'A' ? 'seq-pattern-btn--active' : ''}`}
          onClick={() => onSetPattern('A')}
        >
          A
        </button>
        <button
          className={`seq-pattern-btn ${state.activePattern === 'B' ? 'seq-pattern-btn--active' : ''}`}
          onClick={() => onSetPattern('B')}
        >
          B
        </button>
        <div className="seq-pattern-actions">
          <button 
            className="seq-pattern-action-btn" 
            onClick={() => onCopyPattern('A', 'B')}
            title="Copy A to B"
          >
            A→B
          </button>
          <button 
            className="seq-pattern-action-btn" 
            onClick={() => onCopyPattern('B', 'A')}
            title="Copy B to A"
          >
            B→A
          </button>
        </div>
      </div>

      {/* Fill Toggle */}
      <button
        className={`seq-fill-btn ${state.isFillMode ? 'seq-fill-btn--active' : ''}`}
        onClick={onToggleFill}
      >
        FILL
      </button>

      {/* Swing */}
      <div className="seq-header__swing">
        <span className="seq-header__swing-label">SWING</span>
        <input
          type="range"
          className="seq-header__swing-slider"
          min={0}
          max={100}
          value={state.swing}
          onChange={(e) => onSetSwing(parseInt(e.target.value))}
        />
        <span className="seq-header__swing-value">{state.swing}%</span>
        <div className="seq-header__swing-presets">
          {SWING_PRESETS.map(p => (
            <button
              key={p.id}
              className={`seq-swing-preset ${state.swingPreset === p.id ? 'seq-swing-preset--active' : ''}`}
              onClick={() => onSetSwingPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step Count */}
      <div className="seq-header__steps">
        {([16, 32, 64] as const).map(c => (
          <button
            key={c}
            className={`seq-step-count-btn ${state.stepCount === c ? 'seq-step-count-btn--active' : ''}`}
            onClick={() => onSetStepCount(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Clear */}
      <button className="seq-clear-btn" onClick={onClearAll} title="Clear All Patterns">
        CLR
      </button>

      {/* Project */}
      <button
        className={`seq-mixer-toggle ${activeProject ? 'seq-mixer-toggle--active' : ''}`}
        onClick={onToggleProjectDrawer}
        title="Projects (⌘S)"
      >
        <span style={{ fontSize: '12px' }}>📁</span>
        <span>{activeProject ? (activeProject.length > 8 ? activeProject.slice(0, 8) + '…' : activeProject) : 'PROJ'}</span>
        {isDirty && <span className="seq-project-dirty-dot" />}
      </button>

      {/* Export */}
      <button className="seq-export-btn" onClick={onExport} title="Render to WAV">
        EXPORT
      </button>

      {/* Stem Export */}
      {onExportStems && (
        <button
          className={`seq-stem-export-btn ${isExportingStems ? 'seq-stem-export-btn--busy' : ''}`}
          onClick={onExportStems}
          disabled={isExportingStems}
          title="Export individual track stems as WAV files"
        >
          {isExportingStems ? '⏳' : '🎚️'} STEMS
        </button>
      )}

      {/* Metronome */}
      {onToggleMetronome && (
        <button
          className={`seq-metronome-btn ${metronomeOn ? 'seq-metronome-btn--active' : ''}`}
          onClick={onToggleMetronome}
          title={metronomeOn ? 'Metronome OFF' : 'Metronome ON'}
        >
          🔔
        </button>
      )}

      {/* MIDI Mapping */}
      {onToggleMidiMapper && (
        <button
          className={`seq-header__btn seq-midi-btn ${showMidiMapper ? 'seq-midi-btn--active' : ''} ${isMidiLearning ? 'seq-midi-btn--learning' : ''}`}
          onClick={onToggleMidiMapper}
          title={showMidiMapper ? 'Hide MIDI Mapping' : 'Show MIDI Mapping'}
        >
          🎛️
        </button>
      )}

      {/* Piano Roll — synth tracks only */}
      {isSynthTrack && onTogglePianoRoll && (
        <button
          className={`seq-header__btn seq-pianoroll-btn ${showPianoRoll ? 'seq-pianoroll-btn--active' : ''}`}
          onClick={onTogglePianoRoll}
          title={showPianoRoll ? 'Hide Piano Roll' : 'Show Piano Roll'}
        >
          🎹
        </button>
      )}

      {/* MIDI Note Input Arm — synth tracks only */}
      {isSynthTrack && onToggleMidiArm && (
        <button
          className={`seq-header__btn seq-midi-arm-btn ${midiNoteArmed ? 'seq-midi-arm-btn--armed' : ''} ${hasActiveMidiInput ? 'seq-midi-arm-btn--active' : ''}`}
          onClick={onToggleMidiArm}
          title={midiNoteArmed ? 'Disarm MIDI Input' : 'Arm MIDI Note Input (Record)'}
        >
          🎙️
        </button>
      )}

      {/* Arpeggiator Toggle — synth tracks only */}
      {isSynthTrack && onToggleArpPanel && (
        <button
          className={`seq-header__btn seq-arp-btn ${showArpeggiator ? 'seq-arp-btn--open' : ''} ${arpEnabled ? 'seq-arp-btn--active' : ''}`}
          onClick={onToggleArpPanel}
          title={showArpeggiator ? 'Hide Arpeggiator' : 'Show Arpeggiator'}
        >
          ARP
        </button>
      )}

      {/* Scale & Chord Toggle — synth tracks only */}
      {isSynthTrack && onToggleScalePanel && (
        <button
          className={`seq-header__btn seq-scale-btn ${showScaleChord ? 'seq-scale-btn--open' : ''} ${scaleEnabled ? 'seq-scale-btn--active' : ''}`}
          onClick={onToggleScalePanel}
          title={showScaleChord ? 'Hide Scale & Chords' : 'Show Scale & Chords'}
        >
          🎼
        </button>
      )}

      {/* Sidechain Toggle */}
      {onToggleSidechain && (
        <button
          className={`seq-header__btn seq-sc-btn ${showSidechain ? 'seq-sc-btn--open' : ''} ${sidechainEnabled ? 'seq-sc-btn--active' : ''}`}
          onClick={onToggleSidechain}
          title={showSidechain ? 'Hide Sidechain' : 'Show Sidechain'}
        >
          SC
        </button>
      )}

      {/* Mixer Toggle */}
      <button
        className={`seq-mixer-toggle ${showMixer ? 'seq-mixer-toggle--active' : ''}`}
        onClick={onToggleMixer}
        title={showMixer ? 'Hide Mixer' : 'Show Mixer'}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="2" height="10" rx="0.5" fill="currentColor" opacity={showMixer ? 1 : 0.5} />
          <rect x="6" y="5" width="2" height="7" rx="0.5" fill="currentColor" opacity={showMixer ? 1 : 0.5} />
          <rect x="11" y="1" width="2" height="11" rx="0.5" fill="currentColor" opacity={showMixer ? 1 : 0.5} />
        </svg>
        <span>MIX</span>
      </button>

      {/* FX Panel Toggle */}
      <button
        className={`seq-mixer-toggle ${showFxPanel ? 'seq-mixer-toggle--active' : ''}`}
        onClick={onToggleFxPanel}
        title={showFxPanel ? 'Hide FX Rack' : 'Show FX Rack'}
        style={{ color: showFxPanel ? '#FFD700' : undefined }}
      >
        <span style={{ fontSize: '12px' }}>✨</span>
        <span>FX</span>
      </button>

      {/* Master Meter Toggle */}
      {onToggleMeter && (
        <button
          className={`seq-mixer-toggle ${showMeter ? 'seq-mixer-toggle--active' : ''}`}
          onClick={onToggleMeter}
          title={showMeter ? 'Hide Master Meter' : 'Show Master Meter'}
          style={{ color: showMeter ? '#FFD700' : undefined }}
        >
          <span style={{ fontSize: '12px' }}>📊</span>
          <span>METER</span>
        </button>
      )}

      {/* Fullscreen Toggle */}
      {onToggleFullscreen && (
        <button
          className={`seq-mixer-toggle ${isFullscreen ? 'seq-mixer-toggle--active' : ''}`}
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          <span style={{ fontSize: '12px' }}>{isFullscreen ? '↙️' : '↗️'}</span>
          <span>FULL</span>
        </button>
      )}
    </div>
  );
};
