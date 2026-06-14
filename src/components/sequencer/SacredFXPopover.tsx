/**
 * SacredFXPopover — Quick-edit floating panel for per-track FX send levels.
 * Opens when clicking the FX arc indicator on a track lane.
 * Provides 4 vertical mini-sliders: Reverb, Chorus, Delay, Saturation.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import type { FXSendState } from './useSequencerEngine';
import { DivineSlider } from '../ui/DivineSlider';


interface SacredFXPopoverProps {
  trackIndex: number;
  trackName: string;
  trackColor: string;
  sends: FXSendState;
  anchorPosition: { x: number; y: number };
  onSetSend: (trackIndex: number, fx: keyof FXSendState, value: number) => void;
  onClose: () => void;
}

const FX_CHANNELS: { id: keyof FXSendState; label: string; accent: string; icon: string }[] = [
  { id: 'reverb',     label: 'REV', accent: '#FFD700', icon: '🌊' },
  { id: 'chorus',     label: 'CHR', accent: '#60A5FA', icon: '✨' },
  { id: 'delay',      label: 'DLY', accent: '#22C55E', icon: '🔁' },
  { id: 'saturation', label: 'SAT', accent: '#EF4444', icon: '🔥' },
];

export const SacredFXPopover: React.FC<SacredFXPopoverProps> = ({
  trackIndex,
  trackName,
  trackColor,
  sends,
  anchorPosition,
  onSetSend,
  onClose,
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

  // Position clamping to viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(anchorPosition.x, window.innerWidth - 220),
    top: Math.min(anchorPosition.y + 8, window.innerHeight - 260),
    zIndex: 9999,
  };

  return (
    <div className="seq-fx-popover" ref={ref} style={style}>
      <div className="seq-fx-popover__header">
        <div className="seq-fx-popover__color" style={{ background: trackColor }} />
        <span className="seq-fx-popover__title">{trackName} — FX SENDS</span>
        <button className="seq-fx-popover__close" onClick={onClose}>✕</button>
      </div>

      <div className="seq-fx-popover__channels">
        {FX_CHANNELS.map(ch => (
          <div key={ch.id} className="seq-fx-popover__channel">
            <div className="seq-fx-popover__channel-icon">{ch.icon}</div>
            <div className="seq-fx-popover__slider-wrap">
              <DivineSlider
                orientation="vertical"
                min={0}
                max={100}
                value={sends[ch.id]}
                step={1}
                decimals={0}
                onChange={(v) => onSetSend(trackIndex, ch.id, Math.round(v))}
                color={ch.accent}
                size="sm"
              />
            </div>
            <span className="seq-fx-popover__value" style={{ color: ch.accent }}>
              {sends[ch.id]}
            </span>
            <span className="seq-fx-popover__label">{ch.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
