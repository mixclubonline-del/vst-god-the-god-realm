import React, { useState, useRef, useEffect } from 'react';
import { motion, useSpring } from 'framer-motion';
import './VortexXYPad.css';
import { useCalibrationSettings, applyCurve, invertCurve } from '@/utils/calibration';

interface Anchor {
  x: number;
  y: number;
  name: string;
}

interface VortexXYPadProps {
  label?: string;
  x: number;
  y: number;
  onPositionChange: (x: number, y: number) => void;
  anchors?: Anchor[];
  onAnchorClick?: (anchor: Anchor) => void;
  level?: number;
}

export const VortexXYPad: React.FC<VortexXYPadProps> = ({
  label = "X/Y VORTEX",
  x,
  y,
  onPositionChange,
  anchors = [],
  onAnchorClick,
  level
}) => {
  const calibration = useCalibrationSettings();
  const [rms, setRms] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startRawX: 0, startRawY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const rawX = invertCurve(x, calibration.xyPadCurveX, 0, 100);
  const rawY = invertCurve(y, calibration.xyPadCurveY, 0, 100);

  // Spring physics for smooth UI response
  const springX = useSpring(rawX, { stiffness: 100, damping: 20 });
  const springY = useSpring(rawY, { stiffness: 100, damping: 20 });

  useEffect(() => {
    springX.set(rawX);
    springY.set(rawY);
  }, [rawX, rawY, springX, springY]);

  // Audio reactivity loop
  useEffect(() => {
    if (level !== undefined) {
      setRms(prev => prev * 0.85 + level * 0.15);
      return;
    }

    let rafId: number;
    let frame = 0;
    const update = () => {
      frame++;
      const mockLevel = (Math.sin(frame * 0.035) * 0.5 + 0.5) * 0.18;
      setRms(prev => prev * 0.85 + mockLevel * 0.15);
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [level]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = containerRef.current.getBoundingClientRect();
    const clickRawX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const clickRawY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    dragRef.current = { startX: e.clientX, startY: e.clientY, startRawX: clickRawX, startRawY: clickRawY };
    setDragging(true);

    const calibratedX = applyCurve(clickRawX, calibration.xyPadCurveX, 0, 100);
    const calibratedY = applyCurve(clickRawY, calibration.xyPadCurveY, 0, 100);
    onPositionChange(calibratedX, calibratedY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    e.stopPropagation();

    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    const deltaRawX = (dx / rect.width) * 100;
    const deltaRawY = (dy / rect.height) * 100;

    const newRawX = Math.max(0, Math.min(100, dragRef.current.startRawX + deltaRawX * calibration.xyPadSensitivity));
    const newRawY = Math.max(0, Math.min(100, dragRef.current.startRawY + deltaRawY * calibration.xyPadSensitivity));

    const calibratedX = applyCurve(newRawX, calibration.xyPadCurveX, 0, 100);
    const calibratedY = applyCurve(newRawY, calibration.xyPadCurveY, 0, 100);
    onPositionChange(calibratedX, calibratedY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div className="vortex-container">
      <div className="vortex-header">
        <span className="vortex-label">{label}</span>
        <div className="flex gap-4">
           <span className="font-mono text-[9px] text-red-500/60">X: {Math.round(x)}%</span>
           <span className="font-mono text-[9px] text-red-500/60">Y: {Math.round(y)}%</span>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="vortex-surface"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <div className="vortex-bg">
           <div className="vortex-grid" />
        </div>

        {/* Anchors */}
        {anchors.map((anchor, i) => (
          <div 
            key={i}
            className="vortex-anchor"
            style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onAnchorClick?.(anchor);
            }}
          >
            <span className="vortex-anchor-label">{anchor.name}</span>
          </div>
        ))}

        {/* The Node */}
        <motion.div 
          className="vortex-node"
          style={{
            left: `${rawX}%`,
            top: `${rawY}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <motion.div 
            className="vortex-aura"
            style={{ 
              scale: 1 + rms * 2,
              opacity: 0.4 + rms * 0.6
            }}
          />
        </motion.div>

        {/* Procedural Lines (Vortex Effect) */}
        <svg className="vortex-svg">
           <defs>
              <radialGradient id="vortexGrad" cx="50%" cy="50%" r="50%">
                 <stop offset="0%" stopColor="var(--god-primary)" stopOpacity="0.2" />
                 <stop offset="100%" stopColor="transparent" />
              </radialGradient>
           </defs>
           <circle cx={`${rawX}%`} cy={`${rawY}%`} r={20 + rms * 40} fill="url(#vortexGrad)" />
           <line x1={`${rawX}%`} y1="0" x2={`${rawX}%`} y2="100%" stroke="rgba(255,215,0,0.1)" strokeWidth="1" />
           <line x1="0" y1={`${rawY}%`} x2="100%" y2={`${rawY}%`} stroke="rgba(255,215,0,0.1)" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
};
