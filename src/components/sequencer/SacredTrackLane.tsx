/**
 * SacredTrackLane — Single instrument track in the sequencer.
 * Contains track header (name, mute/solo, volume) + step grid.
 */
import React, { useCallback } from 'react';
import { SacredStep } from './SacredStep';
import type { TrackState, StepState, SequencerState } from './useSequencerEngine';

interface SacredTrackLaneProps {
  track: TrackState;
  trackIndex: number;
  currentStep: number;
  isSelected: boolean;
  activePattern: 'A' | 'B';
  isFillMode: boolean;
  stepCount: number;
  swing: number;
  onSelectTrack: () => void;
  onToggleStep: (stepIndex: number) => void;
  onSetVelocity: (stepIndex: number, velocity: number) => void;
  onRandomize?: () => void;
  onClear?: () => void;
  onOpenStepDetail?: (stepIndex: number, position: { x: number; y: number }) => void;
  onOpenChopper?: () => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
}

export const SacredTrackLane: React.FC<SacredTrackLaneProps> = React.memo(({
  track,
  trackIndex,
  currentStep,
  isSelected,
  activePattern,
  isFillMode,
  stepCount,
  swing,
  onSelectTrack,
  onToggleStep,
  onSetVelocity,
  onRandomize,
  onClear,
  onOpenStepDetail,
  onToggleMute,
  onToggleSolo,
}) => {
  const pattern = activePattern === 'A' ? track.patternA : track.patternB;

  const laneClass = [
    'seq-lane',
    isSelected ? 'seq-lane--selected' : '',
    track.muted ? 'seq-lane--muted' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={laneClass}
      style={{ 
        '--lane-color': track.color,
        '--swing-offset': `${swing * 0.15}px` 
      } as React.CSSProperties}
    >
      {/* Track Header */}
      <div className="seq-lane__header" onClick={onSelectTrack}>
        <div className="seq-lane__color-bar" />
        <span className="seq-lane__icon">{track.icon}</span>
        <span className="seq-lane__name">{track.name}</span>
        <div className="seq-lane__controls">
          <button
            className={`seq-lane__btn ${track.muted ? 'seq-lane__btn--active-mute' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
            title="Mute"
          >
            M
          </button>
          <button
            className={`seq-lane__btn ${track.soloed ? 'seq-lane__btn--active-solo' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleSolo(); }}
            title="Solo"
          >
            S
          </button>
          {onRandomize && (
            <button
              className="seq-lane__action-btn"
              onClick={(e) => { e.stopPropagation(); onRandomize(); }}
              title="Randomize"
            >
              🎲
            </button>
          )}
          {onClear && (
            <button
              className="seq-lane__action-btn"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              title="Clear Track"
            >
              ✕
            </button>
          )}
          {onOpenChopper && (
            <button
              className="seq-lane__btn seq-lane__btn--chop"
              onClick={(e) => { e.stopPropagation(); onOpenChopper(); }}
              title="Open Sample Chopper"
            >
              ✂️
            </button>
          )}
        </div>
      </div>

      {/* Step Grid */}
      <div className="seq-lane__grid" style={{ gridTemplateColumns: `repeat(${stepCount}, 1fr)` }}>
        {pattern.slice(0, stepCount).map((step, i) => (
          <SacredStep
            key={i}
            step={step}
            stepIndex={i}
            trackIndex={trackIndex}
            trackColor={track.color}
            isPlaying={currentStep === (i % track.polymetricLength)}
            isDownbeat={i % 4 === 0}
            isFillOnly={step.trigCondition === 'fill'}
            onToggle={() => onToggleStep(i)}
            onVelocityChange={(vel) => onSetVelocity(i, vel)}
            onOpenDetail={onOpenStepDetail ? (pos) => onOpenStepDetail(i, pos) : undefined}
          />
        ))}
      </div>
    </div>
  );
});

SacredTrackLane.displayName = 'SacredTrackLane';
