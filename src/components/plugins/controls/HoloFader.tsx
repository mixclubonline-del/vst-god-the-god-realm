import React, { useRef, useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCalibrationSettings, applyCurve, invertCurve } from '@/utils/calibration';
import { midiMappingService } from '@/services/midiMappingService';

interface HoloFaderProps {
  value: number;     // 0-100
  onChange: (v: number) => void;
  label: string;
  color?: string;
  height?: number;   // track height in px
  orientation?: 'vertical' | 'horizontal';
  defaultValue?: number; // value to reset to on double-click
  id?: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const HoloFader: React.FC<HoloFaderProps> = ({
  value,
  onChange,
  label,
  color = '#38D5FF',
  height = 80,
  orientation = 'vertical',
  defaultValue = 50,
  id,
}) => {
  const calibration = useCalibrationSettings();
  const [dragging, setDragging] = useState(false);
  const [justReset, setJustReset] = useState(false);
  const dragRef = useRef({ startY: 0, startX: 0, startRaw: 0 });
  const trackRef = useRef<HTMLDivElement>(null);
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
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Cleanup reset timer
  useEffect(() => {
    return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!trackRef.current) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    const rect = trackRef.current.getBoundingClientRect();
    let norm: number;
    if (orientation === 'vertical') {
      norm = 1 - (e.clientY - rect.top) / rect.height;
    } else {
      norm = (e.clientX - rect.left) / rect.width;
    }
    const initialRaw = clamp(norm * 100, 0, 100);
    dragRef.current = { startY: e.clientY, startX: e.clientX, startRaw: initialRaw };
    setDragging(true);

    const newVal = applyCurve(initialRaw, calibration.faderCurve, 0, 100);
    onChange(Math.round(newVal));
  }, [onChange, orientation, calibration.faderCurve]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const dy = dragRef.current.startY - e.clientY;
    const dx = e.clientX - dragRef.current.startX;
    const trackLength = orientation === 'vertical' ? rect.height : rect.width;
    if (trackLength === 0) return;

    const deltaRaw = ((orientation === 'vertical' ? dy : dx) / trackLength) * 100;
    const newRaw = clamp(dragRef.current.startRaw + deltaRaw * calibration.faderSensitivity, 0, 100);
    const newVal = applyCurve(newRaw, calibration.faderCurve, 0, 100);
    onChange(Math.round(newVal));
  }, [dragging, onChange, orientation, calibration.faderCurve, calibration.faderSensitivity]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const isVert = orientation === 'vertical';
  const rawValue = invertCurve(value, calibration.faderCurve, 0, 100);
  const pos = rawValue / 100;

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

  return (
    <motion.div
      className={`fp-fader ${isVert ? 'fp-fader--vert' : 'fp-fader--horiz'} ${learning ? 'is-learning' : ''}`}
      style={{ [isVert ? 'height' : 'width']: height, position: 'relative' }}
      onContextMenu={handleContextMenu}
      animate={{ scale: justReset ? 1.1 : 1 }}
      transition={{ scale: { duration: 0.15 } }}
    >
      {midiCC !== null && (
        <div className="divine-knob-cc-badge" style={{ top: '-4px', right: '4px' }}>cc {midiCC}</div>
      )}
      {/* Track area (invisible — "no physical track") */}
      <div
        ref={trackRef}
        className="fp-fader__track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
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
