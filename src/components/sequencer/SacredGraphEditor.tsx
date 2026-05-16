/**
 * SacredGraphEditor — FL Studio-style per-step parameter graph.
 * Switchable between velocity, pitch, pan, decay, and probability modes.
 * Supports drag-to-set and right-click ramp drawing.
 */
import React, { useCallback, useRef } from 'react';
import type { StepState, SequencerState } from './useSequencerEngine';

interface SacredGraphEditorProps {
  steps: StepState[];
  stepCount: number;
  mode: SequencerState['activeGraphMode'];
  trackColor: string;
  currentStep: number;
  onSetMode: (mode: SequencerState['activeGraphMode']) => void;
  onSetValue: (stepIndex: number, value: number) => void;
}

const MODES: { id: SequencerState['activeGraphMode']; label: string; min: number; max: number; unit: string }[] = [
  { id: 'velocity', label: 'VEL', min: 0, max: 127, unit: '' },
  { id: 'pitch',    label: 'PITCH', min: -24, max: 24, unit: 'st' },
  { id: 'pan',      label: 'PAN', min: -100, max: 100, unit: '%' },
  { id: 'decay',    label: 'DECAY', min: 0, max: 100, unit: '%' },
  { id: 'probability', label: 'PROB', min: 0, max: 100, unit: '%' },
  { id: 'note',     label: 'NOTE', min: 24, max: 96, unit: '' },
];

function getStepValue(step: StepState, mode: SequencerState['activeGraphMode']): number {
  switch (mode) {
    case 'velocity': return step.velocity;
    case 'pitch': return step.pitch;
    case 'pan': return step.pan * 100;
    case 'decay': return step.decay * 100;
    case 'probability': return step.probability;
    case 'note': return 60; // Note mode uses piano-roll overlay, bar value is placeholder
  }
}

function normalizeValue(value: number, mode: SequencerState['activeGraphMode']): number {
  const m = MODES.find(x => x.id === mode)!;
  return (value - m.min) / (m.max - m.min);
}

export const SacredGraphEditor: React.FC<SacredGraphEditorProps> = ({
  steps,
  stepCount,
  mode,
  trackColor,
  currentStep,
  onSetMode,
  onSetValue,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const modeConfig = MODES.find(m => m.id === mode)!;

  const getStepFromX = useCallback((clientX: number): { index: number; normalized: number } | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const stepWidth = rect.width / stepCount;
    const index = Math.floor(x / stepWidth);
    if (index < 0 || index >= stepCount) return null;
    return { index, normalized: x / rect.width };
  }, [stepCount]);

  const getValueFromY = useCallback((clientY: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const normalized = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return modeConfig.min + normalized * (modeConfig.max - modeConfig.min);
  }, [modeConfig]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const result = getStepFromX(e.clientX);
    if (result) {
      const value = getValueFromY(e.clientY);
      onSetValue(result.index, Math.round(value));
    }
  }, [getStepFromX, getValueFromY, onSetValue]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const result = getStepFromX(e.clientX);
    if (result) {
      const value = getValueFromY(e.clientY);
      onSetValue(result.index, Math.round(value));
    }
  }, [getStepFromX, getValueFromY, onSetValue]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div className="seq-graph">
      {/* Mode Tabs */}
      <div className="seq-graph__tabs">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`seq-graph__tab ${mode === m.id ? 'seq-graph__tab--active' : ''}`}
            onClick={() => onSetMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Graph Area */}
      <div
        className="seq-graph__area"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Center line for bipolar modes (pitch, pan) */}
        {(mode === 'pitch' || mode === 'pan') && (
          <div className="seq-graph__center-line" />
        )}

        {/* Bars */}
        {steps.slice(0, stepCount).map((step, i) => {
          const value = getStepValue(step, mode);
          const norm = normalizeValue(value, mode);
          const isBipolar = mode === 'pitch' || mode === 'pan';

          return (
            <div
              key={i}
              className={`seq-graph__bar-wrap ${currentStep === i ? 'seq-graph__bar-wrap--playing' : ''} ${i % 4 === 0 ? 'seq-graph__bar-wrap--downbeat' : ''}`}
              style={{ width: `${100 / stepCount}%` }}
            >
              <div
                className={`seq-graph__bar ${!step.enabled ? 'seq-graph__bar--disabled' : ''}`}
                style={{
                  '--bar-color': trackColor,
                  '--bar-height': isBipolar ? `${Math.abs(norm - 0.5) * 100}%` : `${norm * 100}%`,
                  '--bar-bottom': isBipolar ? (norm >= 0.5 ? '50%' : `${norm * 100}%`) : '0%',
                } as React.CSSProperties}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
