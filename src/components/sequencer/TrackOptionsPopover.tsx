/**
 * TrackOptionsPopover — Floating dropdown menu for track-level pattern operations.
 * Opens when clicking the vertical ellipsis button (⋮) on a track lane header.
 */
import React, { useEffect, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';

interface TrackOptionsPopoverProps {
  trackIndex: number;
  trackName: string;
  trackColor: string;
  anchorPosition: { x: number; y: number };
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onSwap: () => void;
  onRandomize: () => void;
  onClear: () => void;
  onHumanize: () => void;
  onQuantize: () => void;
  canPaste: boolean;
  /* Track Clipboard */
  onCopyTrack?: () => void;
  onPasteTrack?: () => void;
  canPasteTrack?: boolean;
  /* Phase A/B: Quick Operations */
  onFillSteps?: (interval: number) => void;
  onShiftSteps?: (direction: 'left' | 'right') => void;
}

export const TrackOptionsPopover: React.FC<TrackOptionsPopoverProps> = ({
  trackIndex,
  trackName,
  trackColor,
  anchorPosition,
  onClose,
  onCopy,
  onPaste,
  onDuplicate,
  onSwap,
  onRandomize,
  onClear,
  onHumanize,
  onQuantize,
  canPaste,
  onCopyTrack,
  onPasteTrack,
  canPasteTrack,
  onFillSteps,
  onShiftSteps,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Listen for Escape to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Position popover close to the ⋮ button
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(anchorPosition.x, window.innerWidth - 240),
    top: Math.min(anchorPosition.y + 12, window.innerHeight - 340),
    zIndex: 9999,
  };

  const handleAction = (callback: () => void) => {
    callback();
    // Do not auto-close so the user can keep working with the window
  };

  return (
    <motion.div 
      className="seq-options-popover" 
      ref={ref} 
      style={style}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      whileDrag={{ scale: 1.02, opacity: 0.95 }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div 
        className="seq-options-popover__header" 
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="seq-options-popover__color" style={{ background: trackColor }} />
        <span className="seq-options-popover__title">{trackName} ACTIONS</span>
        <button className="seq-options-popover__close" onClick={onClose}>✕</button>
      </div>

      <div 
        className="seq-options-popover__menu"
        onWheel={(e) => e.stopPropagation()}
      >
        <button className="seq-options-popover__item" onClick={() => handleAction(onCopy)}>
          <span className="seq-options-popover__item-icon">📋</span>
          <span className="seq-options-popover__item-label">Copy Track Pattern</span>
          <span className="seq-options-popover__item-shortcut">⌘C</span>
        </button>

        <button 
          className="seq-options-popover__item" 
          onClick={() => handleAction(onPaste)} 
          disabled={!canPaste}
        >
          <span className="seq-options-popover__item-icon">📥</span>
          <span className="seq-options-popover__item-label">Paste Track Pattern</span>
          <span className="seq-options-popover__item-shortcut">⌘V</span>
        </button>
 
        {onCopyTrack && (
          <button className="seq-options-popover__item" onClick={() => handleAction(onCopyTrack)}>
            <span className="seq-options-popover__item-icon">📋</span>
            <span className="seq-options-popover__item-label">Copy Entire Track</span>
            <span className="seq-options-popover__item-shortcut">⌥⌘C</span>
          </button>
        )}

        {onPasteTrack && (
          <button 
            className="seq-options-popover__item" 
            onClick={() => handleAction(onPasteTrack)} 
            disabled={!canPasteTrack}
          >
            <span className="seq-options-popover__item-icon">📥</span>
            <span className="seq-options-popover__item-label">Paste Entire Track</span>
            <span className="seq-options-popover__item-shortcut">⌥⌘V</span>
          </button>
        )}

        <button className="seq-options-popover__item" onClick={() => handleAction(onDuplicate)}>
          <span className="seq-options-popover__item-icon">👥</span>
          <span className="seq-options-popover__item-label">Duplicate Pattern</span>
          <span className="seq-options-popover__item-shortcut">⌘D</span>
        </button>

        <button className="seq-options-popover__item" onClick={() => handleAction(onSwap)}>
          <span className="seq-options-popover__item-icon">🔄</span>
          <span className="seq-options-popover__item-label">Swap A/B Patterns</span>
          <span className="seq-options-popover__item-shortcut">Tab</span>
        </button>

        <div className="seq-options-popover__separator" />

        {onFillSteps && (
          <>
            <button className="seq-options-popover__item" onClick={() => handleAction(() => onFillSteps(2))}>
              <span className="seq-options-popover__item-icon">⚡</span>
              <span className="seq-options-popover__item-label">Fill Each 2 Steps</span>
            </button>
            <button className="seq-options-popover__item" onClick={() => handleAction(() => onFillSteps(4))}>
              <span className="seq-options-popover__item-icon">⚡</span>
              <span className="seq-options-popover__item-label">Fill Each 4 Steps</span>
            </button>
            <button className="seq-options-popover__item" onClick={() => handleAction(() => onFillSteps(8))}>
              <span className="seq-options-popover__item-icon">⚡</span>
              <span className="seq-options-popover__item-label">Fill Each 8 Steps</span>
            </button>
          </>
        )}

        {onShiftSteps && (
          <>
            <button className="seq-options-popover__item" onClick={() => handleAction(() => onShiftSteps('left'))}>
              <span className="seq-options-popover__item-icon">⬅️</span>
              <span className="seq-options-popover__item-label">Shift Left</span>
              <span className="seq-options-popover__item-shortcut">Shift+←</span>
            </button>
            <button className="seq-options-popover__item" onClick={() => handleAction(() => onShiftSteps('right'))}>
              <span className="seq-options-popover__item-icon">➡️</span>
              <span className="seq-options-popover__item-label">Shift Right</span>
              <span className="seq-options-popover__item-shortcut">Shift+→</span>
            </button>
          </>
        )}

        <div className="seq-options-popover__separator" />

        <button className="seq-options-popover__item" onClick={() => handleAction(onRandomize)}>
          <span className="seq-options-popover__item-icon">🎲</span>
          <span className="seq-options-popover__item-label">Randomize Steps</span>
        </button>

        <button className="seq-options-popover__item" onClick={() => handleAction(onClear)}>
          <span className="seq-options-popover__item-icon">✕</span>
          <span className="seq-options-popover__item-label">Clear Steps</span>
        </button>

        <button className="seq-options-popover__item" onClick={() => handleAction(onHumanize)}>
          <span className="seq-options-popover__item-icon">🌊</span>
          <span className="seq-options-popover__item-label">Humanize Steps</span>
        </button>

        <button className="seq-options-popover__item" onClick={() => handleAction(onQuantize)}>
          <span className="seq-options-popover__item-icon">🎯</span>
          <span className="seq-options-popover__item-label">Quantize Steps</span>
        </button>
      </div>
    </motion.div>
  );
};
