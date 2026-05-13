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
}) => {
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const bpmInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className={`seq-header ${state.isFillMode ? 'seq-header--fill' : ''}`}>
      {/* Transport */}
      <div className="seq-header__transport">
        <button
          className={`seq-transport-btn seq-transport-btn--play ${state.isPlaying ? 'seq-transport-btn--active' : ''}`}
          onClick={onTogglePlay}
          title={state.isPlaying ? 'Stop' : 'Play'}
        >
          {state.isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" rx="1" fill="currentColor"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14"><polygon points="3,1 13,7 3,13" fill="currentColor"/></svg>
          )}
        </button>
      </div>

      {/* BPM Display */}
      <div className="seq-header__bpm" onDoubleClick={handleBpmDoubleClick}>
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

      {/* Export */}
      <button className="seq-export-btn" onClick={onExport} title="Render to WAV">
        EXPORT
      </button>
    </div>
  );
};
