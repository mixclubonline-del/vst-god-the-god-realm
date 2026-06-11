/**
 * MiniSequencerStrip — Compact step-sequencer view within the Astral Dais
 *
 * Shows the active pattern steps for each sample track (0-15) mapped to thrones.
 * Collapsible via toggle. Allows quick step toggling without leaving the pad view.
 *
 * "The Dais remembers every rhythmic decree inscribed upon its thrones."
 */
import React, { useCallback, useMemo } from 'react';
import { THRONE_DOMAINS } from '../data/throneDomains';

interface MiniSequencerStripProps {
  /** Full sequencer state */
  tracks: Array<{
    name: string;
    sourceType: string;
    muted: boolean;
    patternA: Array<{ enabled: boolean; velocity: number }>;
    patternB: Array<{ enabled: boolean; velocity: number }>;
  }>;
  /** Which pattern is active */
  activePattern: 'A' | 'B';
  /** Current playhead step (0-based) */
  currentStep: number;
  /** Is sequencer playing */
  isPlaying: boolean;
  /** Step count (16/32/64) */
  stepCount: number;
  /** Is the strip expanded */
  isExpanded: boolean;
  /** Toggle expand/collapse */
  onToggle: () => void;
  /** Toggle a step on/off */
  onToggleStep: (trackIndex: number, stepIndex: number) => void;
}

export const MiniSequencerStrip: React.FC<MiniSequencerStripProps> = React.memo(({
  tracks,
  activePattern,
  currentStep,
  isPlaying,
  stepCount,
  isExpanded,
  onToggle,
  onToggleStep,
}) => {
  // Only show sample tracks mapped to thrones (indices 0-15)
  const sampleTracks = useMemo(() => {
    return tracks
      .map((track, idx) => ({ track, idx }))
      .filter(({ track, idx }) => track.sourceType === 'sample' && idx < 16);
  }, [tracks]);

  // Count active steps across all sample tracks
  const totalActiveSteps = useMemo(() => {
    return sampleTracks.reduce((sum, { track }) => {
      const pattern = activePattern === 'A' ? track.patternA : track.patternB;
      return sum + pattern.filter(s => s.enabled).length;
    }, 0);
  }, [sampleTracks, activePattern]);

  const handleStepClick = useCallback((trackIdx: number, stepIdx: number) => {
    onToggleStep(trackIdx, stepIdx);
  }, [onToggleStep]);

  // Show first 16 steps only in the mini view
  const visibleSteps = Math.min(stepCount, 16);

  return (
    <div className="mini-seq-container">
      {/* Toggle Bar */}
      <button
        className={`mini-seq__toggle ${isExpanded ? 'mini-seq__toggle--expanded' : ''}`}
        onClick={onToggle}
        title={isExpanded ? 'Collapse Mini Sequencer' : 'Expand Mini Sequencer'}
      >
        <span className="mini-seq__toggle-chevron">▾</span>
        <span className="mini-seq__toggle-label">SEQUENCE INSCRIPTIONS</span>
        <span className="mini-seq__toggle-count">{totalActiveSteps} steps</span>
        {isPlaying && (
          <span className="mini-seq__toggle-playing">▶</span>
        )}
      </button>

      {/* Collapsible Strip */}
      <div className={`mini-seq ${isExpanded ? 'mini-seq--expanded' : ''}`}>
        <div className="mini-seq__tracks">
          {sampleTracks.map(({ track, idx }) => {
            const pattern = activePattern === 'A' ? track.patternA : track.patternB;
            const domain = THRONE_DOMAINS[idx];
            const trackColor = domain?.color || '#FFD700';

            return (
              <div
                key={idx}
                className={`mini-seq__track ${track.muted ? 'mini-seq__track--muted' : ''}`}
                style={{ '--track-color': trackColor } as React.CSSProperties}
              >
                {/* Track Identity */}
                <div className="mini-seq__track-info">
                  <span
                    className="mini-seq__track-dot"
                    style={{ background: trackColor }}
                  />
                  <span className="mini-seq__track-label">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>

                {/* Step Grid */}
                <div
                  className="mini-seq__steps"
                  style={{ '--step-count': visibleSteps } as React.CSSProperties}
                >
                  {Array.from({ length: visibleSteps }, (_, stepIdx) => {
                    const step = pattern[stepIdx];
                    const isOn = step?.enabled || false;
                    const isCurrent = isPlaying && stepIdx === currentStep;
                    const velocity = step?.velocity || 100;

                    return (
                      <button
                        key={stepIdx}
                        className={[
                          'mini-seq__step',
                          isOn ? 'mini-seq__step--on' : '',
                          isCurrent ? 'mini-seq__step--current' : '',
                          stepIdx % 4 === 0 ? 'mini-seq__step--beat' : '',
                        ].filter(Boolean).join(' ')}
                        style={{
                          '--step-velocity': velocity / 127,
                        } as React.CSSProperties}
                        onClick={() => handleStepClick(idx, stepIdx)}
                        title={`Track ${idx + 1}, Step ${stepIdx + 1}${isOn ? ' (ON)' : ''}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

MiniSequencerStrip.displayName = 'MiniSequencerStrip';
