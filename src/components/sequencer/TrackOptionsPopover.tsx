/**
 * TrackOptionsPopover — Floating dropdown menu for track-level pattern operations.
 * Opens when clicking the vertical ellipsis button (⋮) on a track lane header.
 */
import React, { useEffect, useRef } from 'react';

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
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
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
    onClose();
  };

  return (
    <div className="seq-options-popover" ref={ref} style={style}>
      <div className="seq-options-popover__header">
        <div className="seq-options-popover__color" style={{ background: trackColor }} />
        <span className="seq-options-popover__title">{trackName} ACTIONS</span>
        <button className="seq-options-popover__close" onClick={onClose}>✕</button>
      </div>

      <div className="seq-options-popover__menu">
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
    </div>
  );
};
