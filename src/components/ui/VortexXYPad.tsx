import React, { useState, useRef, useEffect } from 'react';
import { motion, useSpring } from 'framer-motion';
import './VortexXYPad.css';

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
}

export const VortexXYPad: React.FC<VortexXYPadProps> = ({
  label = "X/Y VORTEX",
  x,
  y,
  onPositionChange,
  anchors = [],
  onAnchorClick
}) => {
  const [rms, setRms] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Spring physics for smooth UI response
  const springX = useSpring(x, { stiffness: 100, damping: 20 });
  const springY = useSpring(y, { stiffness: 100, damping: 20 });

  useEffect(() => {
    springX.set(x);
    springY.set(y);
  }, [x, y, springX, springY]);

  // Audio reactivity loop
  useEffect(() => {
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
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    handleUpdate(e.clientX, e.clientY);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1) return;
    handleUpdate(e.clientX, e.clientY);
  };

  const handleUpdate = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const ny = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    onPositionChange(nx, ny);
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
            left: `${x}%`,
            top: `${y}%`,
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
           <circle cx={`${x}%`} cy={`${y}%`} r={20 + rms * 40} fill="url(#vortexGrad)" />
           <line x1={`${x}%`} y1="0" x2={`${x}%`} y2="100%" stroke="rgba(255,215,0,0.1)" strokeWidth="1" />
           <line x1="0" y1={`${y}%`} x2="100%" y2={`${y}%`} stroke="rgba(255,215,0,0.1)" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
};
