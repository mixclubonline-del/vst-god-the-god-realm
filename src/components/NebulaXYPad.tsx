import React, { useState, useRef, useEffect } from 'react';
import { motion, useSpring } from 'framer-motion';
import { GodRealmSamplerEngine } from '../engine/samplerEngine';
import './NebulaXYPad.css';

interface NebulaXYPadProps {
  label?: string;
  engineRef?: React.RefObject<GodRealmSamplerEngine>;
  onChange?: (x: number, y: number) => void;
}

export const NebulaXYPad: React.FC<NebulaXYPadProps> = ({ 
  label = "NEBULA MOD", 
  engineRef,
  onChange 
}) => {
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [rms, setRms] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Spring physics for smooth movement
  const springX = useSpring(0.5, { stiffness: 80, damping: 15 });
  const springY = useSpring(0.5, { stiffness: 80, damping: 15 });

  // Update internal RMS for visual pulsing
  useEffect(() => {
    let rafId: number;
    const update = () => {
      if (engineRef?.current) {
        setRms(prev => prev * 0.8 + engineRef.current!.getRMSLevel() * 0.2);
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [engineRef]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current || e.buttons !== 1) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    setPosition({ x, y });
    springX.set(x);
    springY.set(y);
    onChange?.(x, y);
  };

  return (
    <div className="nebula-container glass-panel">
      <div className="nebula-header">
        <span className="nebula-label">{label}</span>
        <div className="nebula-values">
          <span>X: {Math.round(position.x * 100)}</span>
          <span>Y: {Math.round(position.y * 100)}</span>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="nebula-surface"
        onPointerMove={handlePointerMove}
      >
        {/* Procedural Nebula Background */}
        <div className="nebula-bg">
          <svg width="100%" height="100%">
            <defs>
              <filter id="nebula-filter">
                <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="2" />
                <feColorMatrix values="0 0 0 0 0.8 0 0 0 0 0.2 0 0 0 0 0 0 0 0 1 0" />
                <feGaussianBlur stdDeviation={5 + rms * 15} />
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#nebula-filter)" opacity={0.2 + rms * 0.4} />
          </svg>
        </div>

        {/* Interaction Grid */}
        <div className="nebula-grid" />

        {/* Gravity Wells / Anchor Points */}
        <div className="anchor anchor-tl" />
        <div className="anchor anchor-tr" />
        <div className="anchor anchor-bl" />
        <div className="anchor anchor-br" />
        <div className="anchor anchor-center" />

        {/* The Modulation Node (Floating Fluid) */}
        <motion.div 
          className="nebula-node"
          style={{
            left: `${position.x * 100}%`,
            top: `${position.y * 100}%`,
            boxShadow: `0 0 ${20 + rms * 60}px var(--mixx-accent)`,
            transform: `translate(-50%, -50%) scale(${1 + rms * 0.4})`
          }}
        >
          <div className="node-fluid" />
          <div className="node-core" />
        </motion.div>
      </div>
    </div>
  );
};
