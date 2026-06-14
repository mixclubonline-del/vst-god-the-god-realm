import React, { useState, useRef, useEffect } from 'react';
import { motion, useTransform, AnimatePresence } from 'framer-motion';
import './DivineSlider.css';
import { midiMappingService } from '@/services/midiMappingService';

interface DivineSliderProps {
  label?: string;
  min?: number;
  max?: number;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  id?: string;
  update?: (id: string, val: number) => void;
  unit?: string;
  color?: string;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'mystical' | 'infernal' | 'celestial' | 'fluid';
  step?: number;
  decimals?: number;
}

export const DivineSlider: React.FC<DivineSliderProps> = ({
  label,
  min = 0,
  max = 1,
  value: externalValue,
  defaultValue = 0.5,
  onChange,
  id,
  update,
  unit = '',
  color = 'var(--mixx-accent)',
  orientation = 'horizontal',
  size = 'md',
  variant = 'default',
  step,
  decimals = 2
}) => {
  const [internalValue, setInternalValue] = useState(externalValue ?? defaultValue);
  const [rms, setRms] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // MIDI Mapping / Learn States
  const [midiCC, setMidiCC] = useState<number | null>(null);
  const [learning, setLearning] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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

  /** Unified emit — routes to either update(id,val) or onChange(val) */
  const emit = (val: number) => {
    let clamped = Math.max(min, Math.min(max, val));
    if (step !== undefined && step > 0) {
      clamped = Math.round((clamped - min) / step) * step + min;
      clamped = Math.max(min, Math.min(max, clamped));
      const decimalsFactor = Math.pow(10, decimals);
      clamped = Math.round(clamped * decimalsFactor) / decimalsFactor;
    }
    setInternalValue(clamped);
    if (id && update) update(id, clamped);
    onChange?.(clamped);
  };

  const displayValueRef = useRef(displayValue);
  useEffect(() => {
    displayValueRef.current = displayValue;
  });

  const emitRef = useRef(emit);
  useEffect(() => {
    emitRef.current = emit;
  });

  // Register MIDI mapping target
  useEffect(() => {
    if (!id) return;

    midiMappingService.registerTarget({
      id,
      label: label || id,
      group: 'Front Panel',
      min,
      max,
      getValue: () => displayValueRef.current,
      setValue: (val) => {
        emitRef.current(val);
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
  }, [id, label, min, max]);

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
    emit(newValue);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    handleUpdate(e.clientX, e.clientY);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    e.stopPropagation();
    handleUpdate(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!id) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleMidiLearn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenu(null);
    if (id) {
      midiMappingService.startLearn(id).catch((err) => {
        console.warn('MIDI Learn error:', err);
      });
    }
  };

  const handleClearMidi = (e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenu(null);
    if (id) {
      midiMappingService.removeMappingForTarget(id);
    }
  };

  return (
    <div 
      className={`divine-slider-container orientation-${orientation} size-${size} slider-variant-${variant} ${isDragging.current ? 'is-dragging' : ''} ${learning ? 'is-learning' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
    >
      <div className="divine-slider-header">
        {label && <span className="divine-slider-label">{label}</span>}
        <motion.span 
          className="divine-slider-value"
          animate={{ color: isHovered || isDragging.current ? color : 'rgba(255,255,255,0.4)' }}
        >
          {displayValue.toFixed(decimals)}<span className="unit">{unit}</span>
        </motion.span>
      </div>

      <div 
        ref={trackRef}
        className="divine-slider-track-area"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {midiCC !== null && (
          <div className="divine-slider-cc-badge">cc {midiCC}</div>
        )}
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
    </div>
  );
};

