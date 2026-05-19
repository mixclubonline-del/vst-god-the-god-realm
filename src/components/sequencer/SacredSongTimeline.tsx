/**
 * SacredSongTimeline — Arrangement row for Song Mode.
 * Displays a horizontal chain of pattern blocks that the sequencer will play
 * through sequentially. Each block shows pattern A/B, repeat count, and can
 * be added/removed/reordered.
 */
import React, { useCallback } from 'react';
import type { SongBlock } from './useSequencerEngine';

interface SacredSongTimelineProps {
  arrangement: SongBlock[];
  songPosition: number;
  isPlaying: boolean;
  playbackMode: 'pattern' | 'song';
  onAddBlock: (pattern: 'A' | 'B') => void;
  onRemoveBlock: (index: number) => void;
  onUpdateBlock: (index: number, changes: Partial<Omit<SongBlock, 'id'>>) => void;
  onSetPosition: (position: number) => void;
  onSetPlaybackMode: (mode: 'pattern' | 'song') => void;
}

export const SacredSongTimeline: React.FC<SacredSongTimelineProps> = ({
  arrangement,
  songPosition,
  isPlaying,
  playbackMode,
  onAddBlock,
  onRemoveBlock,
  onUpdateBlock,
  onSetPosition,
  onSetPlaybackMode,
}) => {
  const isSongMode = playbackMode === 'song';

  const handleRepeatChange = useCallback((index: number, delta: number) => {
    const block = arrangement[index];
    if (!block) return;
    const newRepeats = Math.max(1, Math.min(16, block.repeats + delta));
    onUpdateBlock(index, { repeats: newRepeats });
  }, [arrangement, onUpdateBlock]);

  const handlePatternToggle = useCallback((index: number) => {
    const block = arrangement[index];
    if (!block) return;
    onUpdateBlock(index, { pattern: block.pattern === 'A' ? 'B' : 'A' });
  }, [arrangement, onUpdateBlock]);

  return (
    <div className={`seq-song-timeline ${isSongMode ? 'seq-song-timeline--active' : ''}`}>
      {/* Mode Toggle */}
      <button
        className={`seq-song-timeline__mode-btn ${isSongMode ? 'seq-song-timeline__mode-btn--song' : ''}`}
        onClick={() => onSetPlaybackMode(isSongMode ? 'pattern' : 'song')}
        title={isSongMode ? 'Switch to Pattern mode' : 'Switch to Song mode'}
      >
        {isSongMode ? '🎼 SONG' : '🔁 PAT'}
      </button>

      {/* Timeline blocks */}
      <div className="seq-song-timeline__blocks">
        {arrangement.map((block, idx) => (
          <div
            key={block.id}
            className={`seq-song-timeline__block ${
              isSongMode && isPlaying && songPosition === idx
                ? 'seq-song-timeline__block--playing'
                : ''
            } ${songPosition === idx ? 'seq-song-timeline__block--current' : ''}`}
            onClick={() => onSetPosition(idx)}
          >
            <div className="seq-song-timeline__block-header">
              <span className="seq-song-timeline__block-index">{idx + 1}</span>
              <button
                className="seq-song-timeline__block-remove"
                onClick={(e) => { e.stopPropagation(); onRemoveBlock(idx); }}
                title="Remove block"
              >
                ×
              </button>
            </div>

            <button
              className={`seq-song-timeline__pattern-badge seq-song-timeline__pattern-badge--${block.pattern.toLowerCase()}`}
              onClick={(e) => { e.stopPropagation(); handlePatternToggle(idx); }}
              title={`Pattern ${block.pattern} — click to toggle`}
            >
              {block.pattern}
            </button>

            <div className="seq-song-timeline__repeat-row">
              <button
                className="seq-song-timeline__repeat-btn"
                onClick={(e) => { e.stopPropagation(); handleRepeatChange(idx, -1); }}
              >−</button>
              <span className="seq-song-timeline__repeat-count">{block.repeats}×</span>
              <button
                className="seq-song-timeline__repeat-btn"
                onClick={(e) => { e.stopPropagation(); handleRepeatChange(idx, 1); }}
              >+</button>
            </div>

            {block.label && (
              <span className="seq-song-timeline__block-label">{block.label}</span>
            )}
          </div>
        ))}

        {/* Add buttons */}
        <div className="seq-song-timeline__add-group">
          <button
            className="seq-song-timeline__add-btn seq-song-timeline__add-btn--a"
            onClick={() => onAddBlock('A')}
            title="Add Pattern A block"
          >
            + A
          </button>
          <button
            className="seq-song-timeline__add-btn seq-song-timeline__add-btn--b"
            onClick={() => onAddBlock('B')}
            title="Add Pattern B block"
          >
            + B
          </button>
        </div>
      </div>

      {/* Info */}
      {isSongMode && arrangement.length > 0 && (
        <div className="seq-song-timeline__info">
          {arrangement.reduce((sum, b) => sum + b.repeats, 0)} bars total
        </div>
      )}
    </div>
  );
};
