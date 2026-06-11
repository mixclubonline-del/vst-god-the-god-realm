/**
 * HoloFader.tsx — Holographic Floating Fader
 * GUI Forge Paradigm #4: "Handles that float without physical tracks,
 * leaving light trails when moved."
 */

import React, { useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';

interface HoloFaderProps {
  value: number;     // 0-100
  onChange: (v: number) => void;
  label: string;
  color?: string;
  height?: number;   // track height in px
  orientation?: 'vertical' | 'horizontal';
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const HoloFader: React.FC<HoloFaderProps> = ({
  value,
  onChange,
  label,
  color = '#38D5FF',
  height = 80,
  orientation = 'vertical',
}) => {
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    updateFromPointer(e);
  }, []);

  const updateFromPointer = useCallback((e: React.PointerEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    let norm: number;
    if (orientation === 'vertical') {
      norm = 1 - (e.clientY - rect.top) / rect.height;
    } else {
      norm = (e.clientX - rect.left) / rect.width;
    }
    onChange(Math.round(clamp(norm * 100, 0, 100)));
  }, [onChange, orientation]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    updateFromPointer(e);
  }, [dragging, updateFromPointer]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const isVert = orientation === 'vertical';
  const pos = value / 100;

  return (
    <div
      className={`fp-fader ${isVert ? 'fp-fader--vert' : 'fp-fader--horiz'}`}
      style={{ [isVert ? 'height' : 'width']: height }}
    >
      {/* Track area (invisible — "no physical track") */}
      <div
        ref={trackRef}
        className="fp-fader__track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
      >
        {/* Light trail */}
        <div
          className="fp-fader__trail"
          style={{
            background: `linear-gradient(${isVert ? 'to top' : 'to right'}, transparent, ${color})`,
            [isVert ? 'height' : 'width']: `${pos * 100}%`,
            opacity: 0.3 + pos * 0.4,
          }}
        />

        {/* Floating orb handle */}
        <motion.div
          className="fp-fader__orb"
          style={{
            [isVert ? 'bottom' : 'left']: `${pos * 100}%`,
            background: color,
            boxShadow: `0 0 ${dragging ? 12 : 6}px ${color}, 0 0 ${dragging ? 24 : 12}px ${color}40`,
          }}
          animate={{
            scale: dragging ? 1.3 : 1,
            opacity: [0.85, 1, 0.85],
          }}
          transition={{
            scale: { duration: 0.1 },
            opacity: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
          }}
        />
      </div>

      {/* Value */}
      <span className="fp-fader__value" style={{ color: dragging ? color : undefined }}>
        {value}
      </span>

      {/* Label */}
      <span className="fp-fader__label">{label}</span>
    </div>
  );
};
