import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './DivineKnob.css';

interface DivineKnobProps {
  label?: string;
  min?: number;
  max?: number;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** CelestialForge bridge pattern — when both id+update are present, update(id, val) is called */
  id?: string;
  update?: (id: string, val: number) => void;
  unit?: string;
  /** Alias for unit — maps GodKnob's suffix prop */
  suffix?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  labels?: [string, string, string]; // e.g. ["MIN", "MID", "MAX"]
  showValue?: boolean;
  valueDisplay?: string;
  variant?: 'default' | 'mystical' | 'infernal' | 'celestial' | 'celestial-blue' | 'eden-green' | 'marble-gold';
}

export const DivineKnob: React.FC<DivineKnobProps> = ({
  label,
  min = 0,
  max = 100,
  value: externalValue,
  defaultValue = 0,
  onChange,
  id,
  update,
  unit: unitProp = '',
  suffix,
  size = 'md',
  color = 'var(--mixx-accent)',
  labels,
  showValue = true,
  valueDisplay,
  variant = 'default'
}) => {
  const unit = suffix || unitProp;
  const [internalValue, setInternalValue] = useState(externalValue ?? defaultValue);
  const [rms, setRms] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  // Sync internal state when external value changes
  useEffect(() => {
    if (externalValue !== undefined) setInternalValue(externalValue);
  }, [externalValue]);

  const displayValue = externalValue ?? internalValue;

  /** Unified emit — routes to either update(id,val) or onChange(val) */
  const emit = (val: number) => {
    setInternalValue(val);
    if (id && update) update(id, val);
    onChange?.(val);
  };

  // Audio reactivity loop (Mocked for premium feel)
  useEffect(() => {
    let rafId: number;
    let frame = 0;
    const update = () => {
      frame++;
      // High-precision organic pulse with micro-jitters
      const basePulse = (Math.sin(frame * 0.05) * 0.3 + 0.7);
      const jitter = (Math.random() * 0.05);
      const mockLevel = basePulse * (0.9 + jitter) * 0.12;
      
      setRms(prev => prev * 0.8 + mockLevel * 0.2);
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const rotation = ((displayValue - min) / (max - min)) * 280 - 140;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = displayValue;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    e.stopPropagation();

    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const sensitivity = range / (e.shiftKey ? 1000 : 200); 
    
    let newValue = startValue.current + deltaY * sensitivity;
    newValue = Math.max(min, Math.min(max, newValue));
    
    emit(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleDoubleClick = () => {
    emit(defaultValue);
  };

  return (
    <div 
      className={`divine-knob-container size-${size} variant-${variant} ${isDragging.current ? 'is-dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Numerical Readout Above (Refined) */}
      <div className={`divine-knob-readout ${isHovered || isDragging.current ? 'visible' : ''}`}>
        {valueDisplay || <>{displayValue.toFixed(1)}<span className="unit">{unit}</span></>}
      </div>

      <div className="divine-knob-wrapper">
        {/* Divine Halo - Audio Reactive */}
        <motion.div 
          className="divine-knob-halo"
          style={{ 
            scale: 1 + rms * 2.5,
            opacity: 0.1 + rms * 0.9,
            boxShadow: `0 0 ${25 + rms * 50}px ${color}`
          }}
        />

        {/* Outer Ring / Track */}
        <svg className="divine-knob-track" viewBox="0 0 100 100">
          <circle 
            cx="50" cy="50" r="45" 
            className="track-bg"
          />
          <motion.circle 
            cx="50" cy="50" r="45" 
            className="track-fill"
            style={{ 
              pathLength: (displayValue - min) / (max - min),
              stroke: color,
              filter: `drop-shadow(0 0 8px ${color})`
            }}
          />
        </svg>

        {/* Main Knob Face */}
        <motion.div 
          className="divine-knob-face"
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
        >
          <div className="divine-knob-machined-texture" />
          
          {/* Internal Heat Glow */}
          <motion.div 
            className="divine-knob-heat"
            style={{ backgroundColor: color }}
            animate={{ 
              opacity: [0.1 * (displayValue/max), 0.3 * (displayValue/max), 0.1 * (displayValue/max)],
              scale: [0.8, 1.1, 0.8]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          <div className="divine-knob-cap" />
          <div className="divine-knob-indicator-line" style={{ background: color }} />
        </motion.div>

        {/* Centered Value (Optional / Secondary) */}
        {!showValue && (
           <AnimatePresence>
             {(isHovered || isDragging.current) && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.8 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.8 }}
                 className="divine-knob-center-value"
               >
                 {displayValue.toFixed(0)}
               </motion.div>
             )}
           </AnimatePresence>
        )}
      </div>

      {/* Label and Triple Marks */}
      <div className="divine-knob-footer">
        {label && (
          <motion.span 
            className="divine-knob-label"
            animate={{ opacity: isHovered ? 1 : 0.6 }}
          >
            {label}
          </motion.span>
        )}
        
        {labels && (
          <div className="divine-knob-triple-labels">
            <span>{labels[0]}</span>
            <span>{labels[1]}</span>
            <span>{labels[2]}</span>
          </div>
        )}
      </div>
    </div>
  );
};

