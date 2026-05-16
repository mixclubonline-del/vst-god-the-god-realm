/**
 * SacredTrackLane — God Realm Universal Track Lane
 * Supports sample, synth, and bus track types.
 * Sacred Sequence Ascension · Phase 1
 *
 * Visual identity:
 *  - Source type badge (🎵 / ⚡ / 🔊)
 *  - God indicator circle (synth tracks) with divine glow
 *  - FX send mini-knob (all tracks)
 *  - Gear icon → opens TrackSourceSelector
 *  - Note letter display on synth track steps
 */
import React, { useCallback, useState } from 'react';
import { SacredStep } from './SacredStep';
import { TrackSourceSelector } from './TrackSourceSelector';
import type { TrackState, StepState, TrackSourceType } from './useSequencerEngine';
import { electricPantheonGods } from '../../data/electricPantheonGods';
import type { ElectricPantheonGodId } from '../../data/electricPantheonGods';

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
  // Sacred Sequence Ascension props
  onSetSource?: (trackIndex: number, sourceType: TrackSourceType, godId?: ElectricPantheonGodId) => void;
  onRename?: (trackIndex: number, name: string) => void;
  onSetColor?: (trackIndex: number, color: string) => void;
  onDeleteTrack?: (trackId: string) => void;
}

/** Convert MIDI note number to note name */
function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}

const SOURCE_ICONS: Record<TrackSourceType, string> = {
  sample: '🎵',
  synth: '⚡',
  bus: '🔊',
};

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
  onOpenChopper,
  onToggleMute,
  onToggleSolo,
  onSetSource,
  onRename,
  onSetColor,
  onDeleteTrack,
}) => {
  const pattern = activePattern === 'A' ? track.patternA : track.patternB;
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorPos, setSelectorPos] = useState({ x: 0, y: 0 });

  // Find god data for synth tracks
  const godData = track.sourceType === 'synth' && track.synthConfig
    ? electricPantheonGods.find(g => g.id === track.synthConfig!.godId)
    : null;

  const laneClass = [
    'seq-lane',
    isSelected ? 'seq-lane--selected' : '',
    track.muted ? 'seq-lane--muted' : '',
    `seq-lane--${track.sourceType}`,
  ].filter(Boolean).join(' ');

  const handleGearClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectorPos({ x: e.clientX, y: e.clientY });
    setSelectorOpen(true);
  }, []);

  // Calculate total FX send level for the mini indicator
  const totalFx = track.fxSends
    ? (track.fxSends.reverb + track.fxSends.chorus + track.fxSends.delay + track.fxSends.saturation) / 4
    : 0;

  return (
    <div
      className={laneClass}
      style={{
        '--lane-color': track.color,
        '--swing-offset': `${swing * 0.15}px`,
        '--god-color': godData?.colors.primary || track.color,
      } as React.CSSProperties}
    >
      {/* Track Header */}
      <div className="seq-lane__header" onClick={onSelectTrack}>
        {/* Color bar with source-aware styling */}
        <div className="seq-lane__color-bar" />

        {/* Source Type Badge */}
        <span className="seq-lane__source-badge" title={track.sourceType.toUpperCase()}>
          {SOURCE_ICONS[track.sourceType]}
        </span>

        {/* God Indicator (synth tracks only) */}
        {track.sourceType === 'synth' && godData && (
          <span
            className="seq-lane__god-indicator"
            style={{ '--god-primary': godData.colors.primary } as React.CSSProperties}
            title={`${godData.name} — ${godData.title}`}
          >
            {godData.icon}
          </span>
        )}

        {/* Track Name + Octave */}
        <div className="seq-lane__name-group">
          <span className="seq-lane__name">{track.name}</span>
          {track.sourceType === 'synth' && track.synthConfig && (
            <span className="seq-lane__octave">
              {midiToNoteName(60 + track.synthConfig.octave * 12)}
            </span>
          )}
          {track.sourceType === 'synth' && godData && (
            <span className="seq-lane__god-name" style={{ color: godData.colors.primary }}>
              {godData.name}
            </span>
          )}
        </div>

        {/* Controls */}
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

          {/* FX Send Indicator */}
          <div
            className="seq-lane__fx-indicator"
            title={`FX: R${track.fxSends?.reverb || 0} C${track.fxSends?.chorus || 0} D${track.fxSends?.delay || 0} S${track.fxSends?.saturation || 0}`}
            style={{ '--fx-level': `${totalFx}%` } as React.CSSProperties}
          >
            <span className="seq-lane__fx-label">FX</span>
            <svg className="seq-lane__fx-arc" viewBox="0 0 24 24">
              <circle
                cx="12" cy="12" r="9"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="2"
              />
              <circle
                cx="12" cy="12" r="9"
                fill="none"
                stroke={godData?.colors.primary || track.color}
                strokeWidth="2"
                strokeDasharray={`${totalFx * 0.565} 56.5`}
                strokeLinecap="round"
                transform="rotate(-90 12 12)"
                style={{ filter: `drop-shadow(0 0 3px ${godData?.colors.primary || track.color}66)` }}
              />
            </svg>
          </div>

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
          {track.sourceType === 'sample' && onOpenChopper && (
            <button
              className="seq-lane__btn seq-lane__btn--chop"
              onClick={(e) => { e.stopPropagation(); onOpenChopper(); }}
              title="Open Sample Chopper"
            >
              ✂️
            </button>
          )}

          {/* Gear Icon — Opens TrackSourceSelector */}
          <button
            className="seq-lane__btn seq-lane__btn--gear"
            onClick={handleGearClick}
            title="Track Settings"
          >
            ⚙
          </button>
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

      {/* Note labels for synth tracks (overlaid on step grid) */}
      {track.sourceType === 'synth' && track.synthConfig && (
        <div
          className="seq-lane__note-overlay"
          style={{ gridTemplateColumns: `repeat(${stepCount}, 1fr)` }}
        >
          {pattern.slice(0, stepCount).map((step, i) => (
            <span
              key={i}
              className={`seq-lane__note-label ${step.enabled ? 'seq-lane__note-label--active' : ''}`}
            >
              {step.enabled ? midiToNoteName(track.synthConfig!.noteMap[i] || 60) : ''}
            </span>
          ))}
        </div>
      )}

      {/* TrackSourceSelector Popover */}
      {selectorOpen && (
        <TrackSourceSelector
          track={track}
          trackIndex={trackIndex}
          anchorPosition={selectorPos}
          onSetSource={(type, godId) => {
            onSetSource?.(trackIndex, type, godId);
          }}
          onRename={(name) => onRename?.(trackIndex, name)}
          onSetColor={(color) => onSetColor?.(trackIndex, color)}
          onDelete={() => {
            onDeleteTrack?.(track.id);
            setSelectorOpen(false);
          }}
          onClose={() => setSelectorOpen(false)}
        />
      )}
    </div>
  );
});

SacredTrackLane.displayName = 'SacredTrackLane';
