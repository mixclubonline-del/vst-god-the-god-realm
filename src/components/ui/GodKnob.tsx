import React, { useState, useRef, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import './GodKnob.css';

interface GodKnobProps {
  label?: string;
  min?: number;
  max?: number;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  suffix?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const GodKnob: React.FC<GodKnobProps> = ({
  label,
  min = 0,
  max = 100,
  value: externalValue,
  defaultValue = 0,
  onChange,
  suffix = '',
  size = 'md'
}) => {
  const [internalValue, setInternalValue] = useState(externalValue ?? defaultValue);
  const [rms, setRms] = useState(0);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const displayValue = externalValue ?? internalValue;

  // Audio reactivity loop (Mocked for premium feel)
  useEffect(() => {
    let rafId: number;
    let frame = 0;
    const update = () => {
      frame++;
      // Premium organic pulse
      const mockLevel = (Math.sin(frame * 0.04) * 0.4 + 0.6) * (Math.random() * 0.1 + 0.9) * 0.15;
      setRms(prev => prev * 0.85 + mockLevel * 0.15);
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Map value to rotation (-140 to 140 degrees)
  const rotation = ((displayValue - min) / (max - min)) * 280 - 140;

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = displayValue;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;

    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const sensitivity = range / 200; // Adjust for feel
    
    let newValue = startValue.current + deltaY * sensitivity;
    newValue = Math.max(min, Math.min(max, newValue));
    
    setInternalValue(newValue);
    onChange?.(newValue);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  return (
    <div 
      className={`god-knob-container size-${size}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {label && <span className="god-knob-label">{label}</span>}
      
      <div className="god-knob-wrapper">
        {/* Audio Reactive Pulse Ring */}
        <motion.div 
          className="god-knob-pulse"
          style={{ 
            scale: 1 + rms * 1.5,
            opacity: rms * 0.8
          }}
        />

        {/* Outer Ring */}
        <div className="god-knob-outer-ring" />

        {/* Rotating Face */}
        <motion.div 
          className="god-knob-face"
          style={{ rotate: rotation }}
        >
          <div className="god-knob-machined" />
          <div className="god-knob-indicator" />
        </motion.div>

        {/* Value Tooltip */}
        <div className="god-knob-value-tooltip">
          {displayValue.toFixed(1)}{suffix}
        </div>
      </div>
    </div>
  );
};
