import React, { useState, useRef, useEffect } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';
import { GodRealmSamplerEngine } from '../engine/samplerEngine';
import './FluidSlider.css';

interface FluidSliderProps {
  label?: string;
  min?: number;
  max?: number;
  defaultValue?: number;
  engineRef?: React.RefObject<GodRealmSamplerEngine>;
  onChange?: (value: number) => void;
}

export const FluidSlider: React.FC<FluidSliderProps> = ({
  label = "INPUT GAIN",
  min = 0,
  max = 1,
  defaultValue = 0.5,
  engineRef,
  onChange
}) => {
  const [value, setValue] = useState(defaultValue);
  const [rms, setRms] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Spring for smooth value transitions
  const springValue = useSpring(defaultValue, { stiffness: 120, damping: 20 });
  
  // Audio reactivity loop
  useEffect(() => {
    let rafId: number;
    const update = () => {
      if (engineRef?.current) {
        // Smoothly follow the RMS level for the glow effect
        setRms(prev => prev * 0.85 + engineRef.current!.getRMSLevel() * 0.15);
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [engineRef]);

  const handlePointerDown = (e: React.PointerEvent) => {
    handlePointerMove(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current || (e.buttons !== 1 && e.type !== 'pointerdown')) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    // Calculate normalized value (0 to 1) from bottom to top
    const normalized = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const finalValue = min + normalized * (max - min);
    
    setValue(finalValue);
    springValue.set(finalValue);
    onChange?.(finalValue);
  };

  return (
    <div className="fluid-slider-container glass-panel">
      <span className="fluid-slider-label">{label}</span>
      
      <div 
        ref={containerRef}
        className="fluid-slider-track-wrapper"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <div className="fluid-slider-track">
          {/* Glowing Fluid Content */}
          <motion.div 
            className="fluid-content"
            style={{ 
              height: `${((value - min) / (max - min)) * 100}%`,
              filter: `brightness(${1 + rms * 2})`,
              boxShadow: `0 0 ${10 + rms * 40}px var(--mixx-accent)`
            }}
          >
            <div className="fluid-surface" />
            <div className="fluid-glow" />
          </motion.div>
        </div>

        {/* Glass Overlay for depth */}
        <div className="fluid-slider-glass-overlay" />

        {/* Floating Indicator (Thumb) */}
        <motion.div 
          className="fluid-slider-thumb"
          style={{ 
            bottom: `${((value - min) / (max - min)) * 100}%`,
            opacity: 0.5 + rms * 0.5
          }}
        />

        <div className="fluid-slider-value">
          {value.toFixed(2)}
        </div>
      </div>
    </div>
  );
};
