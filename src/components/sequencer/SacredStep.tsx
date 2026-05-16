import React, { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StepState } from './useSequencerEngine';

interface SacredStepProps {
  step: StepState;
  stepIndex: number;
  trackIndex: number;
  trackColor: string;
  isPlaying: boolean;
  isDownbeat: boolean;       // Every 4th step
  isFillOnly: boolean;       // Trig condition is 'fill'
  onToggle: () => void;
  onVelocityChange: (velocity: number) => void;
  onOpenDetail?: (position: { x: number; y: number }) => void;
}

export const SacredStep: React.FC<SacredStepProps> = React.memo(({
  step,
  stepIndex,
  trackIndex,
  trackColor,
  isPlaying,
  isDownbeat,
  isFillOnly,
  onToggle,
  onVelocityChange,
  onOpenDetail,
}) => {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVel = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) return; // Skip right-click
    isDragging.current = false;
    startY.current = e.clientY;
    startVel.current = step.velocity;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [step.velocity]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const delta = startY.current - e.clientY;
    if (Math.abs(delta) > 3) isDragging.current = true;
    if (!isDragging.current) return;

    const newVel = Math.max(1, Math.min(127, startVel.current + delta));
    onVelocityChange(newVel);
  }, [onVelocityChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) {
      if (e.shiftKey && onOpenDetail) {
        onOpenDetail({ x: e.clientX, y: e.clientY });
      } else {
        onToggle();
      }
    }
    isDragging.current = false;
  }, [onToggle, onOpenDetail]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenDetail) {
      onOpenDetail({ x: e.clientX, y: e.clientY });
    }
  }, [onOpenDetail]);

  const velNorm = step.velocity / 127;
  const probDim = step.probability < 100 ? 0.3 + (step.probability / 100) * 0.7 : 1;

  const classNames = [
    'seq-step',
    step.enabled ? 'seq-step--on' : '',
    isPlaying ? 'seq-step--playing' : '',
    isDownbeat ? 'seq-step--downbeat' : '',
    isFillOnly ? 'seq-step--fill' : '',
    step.retrigRate ? 'seq-step--retrig' : '',
    step.probability < 100 ? 'seq-step--unstable' : '',
  ].filter(Boolean).join(' ');

  // Retrig Subdivision Rendering
  const renderRetrigSegments = () => {
    if (!step.retrigRate || !step.enabled) return null;
    
    const divisionMap: Record<string, number> = {
      '1/2': 2, '1/4': 4, '1/8': 8, '1/16': 16, '1/32': 32
    };
    const count = divisionMap[step.retrigRate] ?? 2;
    const segments = [];
    for (let i = 0; i < count; i++) {
      segments.push(<div key={i} className="seq-step__segment" />);
    }
    
    return (
      <div className={`seq-step__segments seq-step__segments--${step.retrigRate}`}>
        {segments}
      </div>
    );
  };

  return (
    <motion.div
      className={classNames}
      style={{
        '--step-color': trackColor,
        '--vel-height': `${velNorm * 100}%`,
        '--vel-scale': 0.2 + velNorm * 0.8,
        '--prob-opacity': probDim,
        '--divine-glow': step.enabled ? `0 0 ${10 + velNorm * 20}px ${trackColor}44` : 'none',
      } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
      data-step={stepIndex}
      data-track={trackIndex}
      initial={false}
      animate={{
        scale: isPlaying ? 1.05 : 1,
        borderColor: isPlaying ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Velocity Energy Core */}
      <AnimatePresence>
        {step.enabled && (
          <motion.div 
            className="seq-step__energy-core"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: 0.2 + velNorm * 0.8, 
              opacity: 1,
              backgroundColor: trackColor 
            }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          />
        )}
      </AnimatePresence>

      {/* Retrig Subdivisions */}
      {renderRetrigSegments()}

      {/* Playhead flash & Particles */}
      <AnimatePresence>
        {isPlaying && (
          <>
            <motion.div 
              className="seq-step__flash"
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: 0, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            {/* Soul Particles */}
            <motion.div
              className="seq-step__particles"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5] }}
              transition={{ duration: 0.3 }}
            >
              {[...Array(4)].map((_, i) => (
                <motion.span
                  key={i}
                  className="seq-step__particle"
                  animate={{
                    x: (Math.random() - 0.5) * 40,
                    y: (Math.random() - 0.5) * 40,
                    opacity: 0
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={{ backgroundColor: trackColor }}
                />
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Micro-timing indicator */}
      {step.enabled && Math.abs(step.microTiming) > 0 && (
        <div 
          className="seq-step__micro-bar" 
          style={{ '--micro-offset': `${step.microTiming}%` } as React.CSSProperties} 
        />
      )}

      {/* Probability label / indicator */}
      {step.enabled && step.probability < 100 && (
        <div className="seq-step__soul-aura">
          <div className="seq-step__prob-label">{step.probability}%</div>
        </div>
      )}

      {/* Fill indication */}
      {isFillOnly && <div className="seq-step__fill-badge">FILL</div>}
    </motion.div>
  );
});

SacredStep.displayName = 'SacredStep';
