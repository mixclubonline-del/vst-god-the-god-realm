import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import './SacredSequencer.css';

interface SacredSequencerProps {
  label?: string;
  steps: number[];
  enabledSteps: boolean[];
  currentStep: number;
  onStepChange: (index: number, value: number) => void;
  onToggleStep: (index: number) => void;
}

export const SacredSequencer: React.FC<SacredSequencerProps> = ({
  label = "DIVINE RHYTHM",
  steps,
  enabledSteps,
  currentStep,
  onStepChange,
  onToggleStep
}) => {
  const draggingIndex = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (e.button === 0) { // Left click
      draggingIndex.current = index;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIndex.current === null) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const normalized = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onStepChange(draggingIndex.current, normalized);
  };

  const handlePointerUp = () => {
    draggingIndex.current = null;
  };

  return (
    <div className="sacred-sequencer-container">
      <div className="sacred-sequencer-header">
        <span className="sacred-sequencer-title">{label}</span>
      </div>

      <div 
        className="sacred-sequencer-grid"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {steps.map((value, i) => (
          <div
            key={i}
            className={`sacred-step ${enabledSteps[i] ? 'enabled' : ''} ${currentStep === i ? 'playing' : ''}`}
            onClick={(e) => {
              // Only toggle if we didn't drag much
              if (Math.abs(e.nativeEvent.movementY) < 5) {
                onToggleStep(i);
              }
            }}
            onPointerDown={(e) => handlePointerDown(e, i)}
            style={{ height: '100%' }}
          >
            <motion.div 
              className="sacred-step-fill"
              animate={{ height: `${value * 100}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
            
            {currentStep === i && (
              <motion.div 
                className="absolute inset-0 bg-white/10"
                animate={{ opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
