/**
 * DivineKnob.tsx — Sacred Circular Control
 * Custom SVG arc knob following GUI Forge paradigm: "Every control is a visualizer."
 * No <input type="range"> — pure pointer-drag interaction with LED glow ring.
 */

import React, { useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';

interface DivineKnobProps {
  value: number;        // 0-100
  onChange: (v: number) => void;
  label: string;
  color?: string;       // accent color
  size?: number;        // px diameter
  showValue?: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const DivineKnob: React.FC<DivineKnobProps> = ({
  value,
  onChange,
  label,
  color = '#B87DFF',
  size = 48,
  showValue = true,
}) => {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startY: 0, startVal: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startVal: value };
    setDragging(true);
  }, [value]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dy = dragRef.current.startY - e.clientY;
    const sensitivity = 0.5;
    const newVal = clamp(dragRef.current.startVal + dy * sensitivity, 0, 100);
    onChange(Math.round(newVal));
  }, [dragging, onChange]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Arc geometry
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const endAngle = 405;
  const range = endAngle - startAngle;
  const valueAngle = startAngle + (value / 100) * range;

  const polarToCart = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos((angle * Math.PI) / 180),
    y: cy + radius * Math.sin((angle * Math.PI) / 180),
  });

  const describeArc = (start: number, end: number, radius: number) => {
    const s = polarToCart(start, radius);
    const e = polarToCart(end, radius);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const trackPath = describeArc(startAngle, endAngle, r);
  const valuePath = value > 0 ? describeArc(startAngle, valueAngle, r) : '';

  // Indicator dot
  const dot = polarToCart(valueAngle, r);

  return (
    <motion.div
      className="fp-knob"
      style={{ width: size, height: size + 18, cursor: dragging ? 'grabbing' : 'grab' }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        {/* Glow filter */}
        <defs>
          <filter id={`knob-glow-${label}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Track (background arc) */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Value arc */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            filter={dragging ? `url(#knob-glow-${label})` : undefined}
            style={{ transition: dragging ? 'none' : 'all 0.05s ease' }}
          />
        )}

        {/* Indicator dot */}
        <circle
          cx={dot.x}
          cy={dot.y}
          r={3}
          fill={color}
          style={{
            filter: `drop-shadow(0 0 4px ${color})`,
            transition: dragging ? 'none' : 'all 0.05s ease',
          }}
        />

        {/* Center value */}
        {showValue && (
          <text
            x={cx}
            y={cy + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(255,255,255,0.7)"
            fontSize={size > 44 ? 10 : 8}
            fontFamily="'JetBrains Mono', monospace"
            fontWeight={600}
          >
            {value}
          </text>
        )}
      </svg>

      {/* Label below */}
      <span
        className="fp-knob__label"
        style={{ color: dragging ? color : undefined }}
      >
        {label}
      </span>
    </motion.div>
  );
};
