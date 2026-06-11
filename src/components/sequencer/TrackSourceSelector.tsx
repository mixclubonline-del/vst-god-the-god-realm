/**
 * TrackSourceSelector — God Realm Track Configuration Popover
 * Allows switching track source type (SAMPLE / SYNTH / BUS),
 * renaming, recoloring, and deleting tracks.
 * Sacred Sequence Ascension · Phase 1
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TrackState, TrackSourceType } from './useSequencerEngine';
import { electricPantheonGods } from '../../data/electricPantheonGods';
import type { ElectricPantheonGodId } from '../../data/electricPantheonGods';

interface TrackSourceSelectorProps {
  track: TrackState;
  trackIndex: number;
  anchorPosition: { x: number; y: number };
  onSetSource: (sourceType: TrackSourceType, godId?: ElectricPantheonGodId) => void;
  onRename: (name: string) => void;
  onSetColor: (color: string) => void;
  onDelete: () => void;
  onClose: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onSwap?: () => void;
  canPaste?: boolean;
}

const SOURCE_CARDS: { type: TrackSourceType; label: string; icon: string; desc: string; accentColor: string }[] = [
  { type: 'sample', label: 'SAMPLE', icon: '🎵', desc: 'Load from Divine Archive', accentColor: '#60A5FA' },
  { type: 'synth',  label: 'SYNTH',  icon: '⚡', desc: 'Pantheon Synth Voice',   accentColor: '#FFD700' },
  { type: 'bus',    label: 'BUS',    icon: '🔊', desc: 'Group through Forge',    accentColor: '#F97316' },
];

const PRESET_COLORS = [
  '#FFD700', '#60A5FA', '#F5B041', '#E74C3C',
  '#9B59B6', '#14B8A6', '#FFD700', '#22C55E',
];

export const TrackSourceSelector: React.FC<TrackSourceSelectorProps> = ({
  track,
  trackIndex,
  anchorPosition,
  onSetSource,
  onRename,
  onSetColor,
  onDelete,
  onClose,
  onCopy,
  onPaste,
  onSwap,
  canPaste = false,
}) => {
  const [editName, setEditName] = useState(track.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleRename = useCallback(() => {
    if (editName.trim() && editName.trim() !== track.name) {
      onRename(editName.trim().toUpperCase());
    }
  }, [editName, track.name, onRename]);

  const handleSourceSelect = useCallback((type: TrackSourceType) => {
    if (type === track.sourceType) return;
    if (type === 'synth') {
      // Default to Olympus when switching to synth
      onSetSource(type, 'olympus');
    } else {
      onSetSource(type);
    }
  }, [track.sourceType, onSetSource]);

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        className="track-source-selector"
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          left: Math.min(anchorPosition.x, window.innerWidth - 340),
          top: Math.min(anchorPosition.y, window.innerHeight - 460),
          zIndex: 9999,
        }}
      >
        {/* Header */}
        <div className="tss__header">
          <span className="tss__title">TRACK {trackIndex + 1}</span>
          <button className="tss__close" onClick={onClose}>✕</button>
        </div>

        {/* Rename */}
        <div className="tss__section">
          <input
            className="tss__name-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value.toUpperCase())}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            maxLength={12}
            spellCheck={false}
          />
        </div>

        {/* Source Type Cards */}
        <div className="tss__section">
          <span className="tss__label">SOURCE TYPE</span>
          <div className="tss__cards">
            {SOURCE_CARDS.map(card => (
              <button
                key={card.type}
                className={`tss__card ${track.sourceType === card.type ? 'tss__card--active' : ''}`}
                style={{ '--card-accent': card.accentColor } as React.CSSProperties}
                onClick={() => handleSourceSelect(card.type)}
              >
                <span className="tss__card-icon">{card.icon}</span>
                <span className="tss__card-label">{card.label}</span>
                <span className="tss__card-desc">{card.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* God Selector — only for synth tracks */}
        {track.sourceType === 'synth' && (
          <div className="tss__section">
            <span className="tss__label">PANTHEON GOD</span>
            <div className="tss__gods">
              {electricPantheonGods.map(god => (
                <button
                  key={god.id}
                  className={`tss__god-dot ${track.synthConfig?.godId === god.id ? 'tss__god-dot--active' : ''}`}
                  style={{
                    '--god-color': god.colors.primary,
                    '--god-glow': `${god.colors.primary}88`,
                  } as React.CSSProperties}
                  onClick={() => onSetSource('synth', god.id)}
                  title={`${god.name} — ${god.title}`}
                >
                  <span className="tss__god-icon">{god.icon}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Color Picker */}
        <div className="tss__section">
          <span className="tss__label">COLOR</span>
          <div className="tss__colors">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                className={`tss__color-swatch ${track.color === c ? 'tss__color-swatch--active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => onSetColor(c)}
              />
            ))}
          </div>
        </div>

        {/* Track Clipboard */}
        <div className="tss__section">
          <span className="tss__label">TRACK CLIPBOARD</span>
          <div className="tss__clipboard-row">
            <button className="tss__btn" onClick={onCopy} title="Copy track pattern">
              📋 COPY
            </button>
            <button className="tss__btn" onClick={onPaste} disabled={!canPaste} title="Paste copied pattern">
              📥 PASTE
            </button>
            <button className="tss__btn" onClick={onSwap} title="Swap Pattern A and B">
              🔄 SWAP A/B
            </button>
          </div>
        </div>

        {/* Delete */}
        <div className="tss__section tss__section--danger">
          {confirmDelete ? (
            <div className="tss__confirm-row">
              <span className="tss__confirm-text">Delete this track?</span>
              <button className="tss__btn tss__btn--danger" onClick={onDelete}>YES</button>
              <button className="tss__btn" onClick={() => setConfirmDelete(false)}>NO</button>
            </div>
          ) : (
            <button
              className="tss__btn tss__btn--delete"
              onClick={() => setConfirmDelete(true)}
            >
              🗑 DELETE TRACK
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
