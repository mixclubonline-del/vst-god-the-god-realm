import React, { useRef, useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCalibrationSettings, applyCurve, invertCurve } from '@/utils/calibration';
import { midiMappingService } from '@/services/midiMappingService';

interface DivineKnobProps {
  value: number;        // 0-100
  onChange: (v: number) => void;
  label: string;
  color?: string;       // accent color
  size?: number;        // px diameter
  showValue?: boolean;
  defaultValue?: number; // value to reset to on double-click
  id?: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const DivineKnob: React.FC<DivineKnobProps> = ({
  value,
  onChange,
  label,
  color = '#B87DFF',
  size = 48,
  showValue = true,
  defaultValue = 50,
  id,
}) => {
  const calibration = useCalibrationSettings();
  const [dragging, setDragging] = useState(false);
  const [justReset, setJustReset] = useState(false);
  const dragRef = useRef({ startY: 0, startVal: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // MIDI Mapping / Learn States
  const [midiCC, setMidiCC] = useState<number | null>(null);
  const [learning, setLearning] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Register MIDI mapping target
  useEffect(() => {
    if (!id) return;

    midiMappingService.registerTarget({
      id,
      label: label || id,
      group: 'Plugin Controls',
      min: 0,
      max: 100,
      getValue: () => valueRef.current,
      setValue: (val) => {
        onChangeRef.current(val);
      }
    });

    // Initial check
    const mapping = midiMappingService.getMappingForTarget(id);
    if (mapping) setMidiCC(mapping.cc);

    // Subscriptions
    const unsubMap = midiMappingService.onMappingChange(() => {
      const mapping = midiMappingService.getMappingForTarget(id);
      setMidiCC(mapping ? mapping.cc : null);
    });

    const unsubLearn = midiMappingService.onLearnChange(() => {
      setLearning(midiMappingService.isLearning && midiMappingService.learningTargetId === id);
    });

    return () => {
      midiMappingService.unregisterTarget(id);
      unsubMap();
      unsubLearn();
    };
  }, [id, label]);

  // Double-click reset handler
  const handleDoubleClick = useCallback(() => {
    onChange(defaultValue);
    setJustReset(true);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setJustReset(false), 300);
  }, [onChange, defaultValue]);

  // Mousewheel handler
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const step = e.shiftKey ? 0.2 : 1;
    const delta = e.deltaY < 0 ? step : -step;
    const newVal = clamp(value + delta, 0, 100);
    onChange(Math.round(newVal * 100) / 100);
  }, [value, onChange]);

  // Attach wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Cleanup reset timer
  useEffect(() => {
    return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rawVal = invertCurve(value, calibration.knobCurve, 0, 100);
    dragRef.current = { startY: e.clientY, startVal: rawVal };
    setDragging(true);
  }, [value, calibration.knobCurve]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dy = dragRef.current.startY - e.clientY;
    const sensitivity = 0.5 * calibration.knobSensitivity;
    const rawVal = clamp(dragRef.current.startVal + dy * sensitivity, 0, 100);
    const newVal = applyCurve(rawVal, calibration.knobCurve, 0, 100);
    onChange(Math.round(newVal));
  }, [dragging, onChange, calibration.knobSensitivity, calibration.knobCurve]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!id) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [id]);

  const handleMidiLearn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenu(null);
    if (id) {
      midiMappingService.startLearn(id).catch((err) => {
        console.warn('MIDI Learn error:', err);
      });
    }
  }, [id]);

  const handleClearMidi = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenu(null);
    if (id) {
      midiMappingService.removeMappingForTarget(id);
    }
  }, [id]);

  // Arc geometry
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const endAngle = 405;
  const range = endAngle - startAngle;
  const rawValue = invertCurve(value, calibration.knobCurve, 0, 100);
  const valueAngle = startAngle + (rawValue / 100) * range;

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
      className={`fp-knob ${learning ? 'is-learning' : ''}`}
      style={{ width: size, height: size + 18, cursor: dragging ? 'grabbing' : 'grab', position: 'relative' }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      animate={{ scale: justReset ? 1.15 : 1 }}
      transition={{ scale: { duration: 0.15 } }}
    >
      {midiCC !== null && (
        <div className="divine-knob-cc-badge" style={{ top: '-4px', right: '-4px' }}>cc {midiCC}</div>
      )}
      <svg
        ref={svgRef}
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

      {contextMenu && (
        <>
          <div className="divine-context-menu-backdrop" onPointerDown={(e) => { e.stopPropagation(); setContextMenu(null); }} />
          <div 
            className="divine-context-menu" 
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="divine-context-menu__item" onClick={handleMidiLearn}>
              MIDI Learn
            </div>
            <div className="divine-context-menu__item" onClick={handleClearMidi}>
              Clear CC
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};
