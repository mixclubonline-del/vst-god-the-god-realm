import React, { useState, useRef, useEffect } from 'react';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import './DivineSlider.css';

interface DivineSliderProps {
  label?: string;
  min?: number;
  max?: number;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  unit?: string;
  color?: string;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'mystical' | 'infernal' | 'celestial' | 'fluid';
}

export const DivineSlider: React.FC<DivineSliderProps> = ({
  label,
  min = 0,
  max = 1,
  value: externalValue,
  defaultValue = 0.5,
  onChange,
  unit = '',
  color = 'var(--mixx-accent)',
  orientation = 'horizontal',
  size = 'md',
  variant = 'default'
}) => {
  const [internalValue, setInternalValue] = useState(externalValue ?? defaultValue);
  const [rms, setRms] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const displayValue = externalValue ?? internalValue;
  const percentage = ((displayValue - min) / (max - min)) * 100;

  // Audio reactivity for premium shimmer
  useEffect(() => {
    let rafId: number;
    let frame = 0;
    const update = () => {
      frame++;
      const mockLevel = (Math.sin(frame * 0.08) * 0.5 + 0.5) * 0.15;
      setRms(prev => prev * 0.92 + mockLevel * 0.08);
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleUpdate = (clientX: number, clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    
    let normalized = 0;
    if (orientation === 'horizontal') {
      normalized = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    } else {
      normalized = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    }

    const newValue = min + normalized * (max - min);
    setInternalValue(newValue);
    onChange?.(newValue);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    handleUpdate(e.clientX, e.clientY);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    handleUpdate(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  return (
    <div 
      className={`divine-slider-container orientation-${orientation} size-${size} slider-variant-${variant} ${isDragging.current ? 'is-dragging' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="divine-slider-header">
        {label && <span className="divine-slider-label">{label}</span>}
        <motion.span 
          className="divine-slider-value"
          animate={{ color: isHovered || isDragging.current ? color : 'rgba(255,255,255,0.4)' }}
        >
          {displayValue.toFixed(2)}<span className="unit">{unit}</span>
        </motion.span>
      </div>

      <div 
        ref={trackRef}
        className="divine-slider-track-area"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Ambient Molten Glow */}
        <motion.div 
          className="divine-slider-ambient-glow"
          style={{ 
            opacity: 0.05 + rms * 0.4,
            background: orientation === 'horizontal' 
              ? `linear-gradient(90deg, transparent, ${color}, transparent)`
              : `linear-gradient(0deg, transparent, ${color}, transparent)`
          }}
        />

        <div className="divine-slider-track-bg" />
        
        {/* Molten Fill */}
        <motion.div 
          className="divine-slider-fill"
          style={{ 
            [orientation === 'horizontal' ? 'width' : 'height']: `${percentage}%`,
            [orientation === 'horizontal' ? 'bottom' : 'bottom']: 0,
            background: `linear-gradient(${orientation === 'horizontal' ? '90deg' : '0deg'}, transparent, ${color})`
          }}
        >
          <div className="divine-slider-fill-shimmer" />
        </motion.div>

        {/* Divine Thumb - Glassmorphic */}
        <motion.div 
          className="divine-slider-thumb"
          style={{ 
            [orientation === 'horizontal' ? 'left' : 'bottom']: `${percentage}%`,
            boxShadow: `0 0 ${15 + rms * 30}px ${color}, 0 4px 15px rgba(0,0,0,0.5)`
          }}
          animate={{
            scale: isDragging.current ? 1.1 : (isHovered ? 1.05 : 1),
          }}
        >
          <div className="thumb-glass" />
          <div className="thumb-indicator" style={{ backgroundColor: color }} />
        </motion.div>
      </div>
    </div>
  );
};

