/**
 * SacredGraphEditor — FL Studio-style per-step parameter graph.
 * Phase 7: Enhanced with Pencil Freehand Draw Mode
 *
 * Switchable between velocity, pitch, pan, decay, probability, and note modes.
 * Supports drag-to-set, right-click ramp drawing, and pencil freehand painting.
 * NOTE mode displays real MIDI noteMap values from synth tracks.
 */
import React, { useCallback, useRef, useState, useMemo } from 'react';
import type { StepState, SequencerState } from './useSequencerEngine';

interface SacredGraphEditorProps {
  steps: StepState[];
  stepCount: number;
  mode: SequencerState['activeGraphMode'];
  trackColor: string;
  currentStep: number;
  /** MIDI note map for synth tracks (per-step pitch values) */
  noteMap?: number[];
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

/** MIDI note number → note name (e.g. 60 → "C4") */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

function getStepValue(
  step: StepState,
  mode: SequencerState['activeGraphMode'],
  stepIndex: number,
  noteMap?: number[]
): number {
  switch (mode) {
    case 'velocity': return step.velocity;
    case 'pitch': return step.pitch;
    case 'pan': return step.pan * 100;
    case 'decay': return step.decay * 100;
    case 'probability': return step.probability;
    case 'note': return noteMap?.[stepIndex] ?? 60;
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
  noteMap,
  onSetMode,
  onSetValue,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [isPencilMode, setIsPencilMode] = useState(false);
  const lastPaintedStep = useRef<number>(-1);

  // Phase 7: Value tooltip state for graph editor
  const [graphTooltip, setGraphTooltip] = useState<{ x: number; y: number; step: number; value: number } | null>(null);

  const modeConfig = MODES.find(m => m.id === mode)!;

  const getStepFromX = useCallback((clientX: number): { index: number; fractional: number } | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const stepWidth = rect.width / stepCount;
    const fractional = x / stepWidth;
    const index = Math.floor(fractional);
    if (index < 0 || index >= stepCount) return null;
    return { index, fractional };
  }, [stepCount]);

  const getValueFromY = useCallback((clientY: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const normalized = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return modeConfig.min + normalized * (modeConfig.max - modeConfig.min);
  }, [modeConfig]);

  // Phase 7: Interpolate between steps during fast mouse movement (pencil mode)
  const paintStepsInRange = useCallback((fromStep: number, toStep: number, value: number) => {
    const minStep = Math.min(fromStep, toStep);
    const maxStep = Math.max(fromStep, toStep);
    for (let s = minStep; s <= maxStep; s++) {
      if (s >= 0 && s < stepCount) {
        onSetValue(s, Math.round(value));
      }
    }
  }, [stepCount, onSetValue]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const result = getStepFromX(e.clientX);
    if (result) {
      const value = getValueFromY(e.clientY);
      onSetValue(result.index, Math.round(value));
      lastPaintedStep.current = result.index;

      // Show tooltip
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setGraphTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          step: result.index,
          value: Math.round(value),
        });
      }
    }
  }, [getStepFromX, getValueFromY, onSetValue]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    e.stopPropagation();
    const result = getStepFromX(e.clientX);
    if (result) {
      const value = getValueFromY(e.clientY);

      if (isPencilMode && lastPaintedStep.current >= 0) {
        // Phase 7: Interpolate to fill gaps during fast mouse movement
        paintStepsInRange(lastPaintedStep.current, result.index, value);
      } else {
        onSetValue(result.index, Math.round(value));
      }
      lastPaintedStep.current = result.index;

      // Update tooltip
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setGraphTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          step: result.index,
          value: Math.round(value),
        });
      }
    }
  }, [getStepFromX, getValueFromY, onSetValue, isPencilMode, paintStepsInRange]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    lastPaintedStep.current = -1;
    setGraphTooltip(null);
  }, []);

  return (
    <div className="seq-graph">
      {/* Mode Tabs + Pencil Toggle */}
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

        {/* Phase 7: Graph editor pencil mode toggle */}
        <button
          className={`seq-graph__pencil ${isPencilMode ? 'active armed' : ''}`}
          onClick={() => setIsPencilMode(!isPencilMode)}
          title={isPencilMode ? 'Switch to click mode' : 'Pencil: freehand paint values'}
        >
          ✏️
        </button>
      </div>

      {/* Graph Area */}
      <div
        className={`seq-graph__area ${isPencilMode ? 'seq-graph__area--pencil' : ''}`}
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ position: 'relative' }}
      >
        {/* Center line for bipolar modes (pitch, pan) */}
        {(mode === 'pitch' || mode === 'pan') && (
          <div className="seq-graph__center-line" />
        )}

        {/* Bars */}
        {steps.slice(0, stepCount).map((step, i) => {
          const value = getStepValue(step, mode, i, noteMap);
          const norm = normalizeValue(value, mode);
          const isBipolar = mode === 'pitch' || mode === 'pan';
          const isNote = mode === 'note';

          return (
            <div
              key={i}
              className={`seq-graph__bar-wrap ${currentStep === i ? 'seq-graph__bar-wrap--playing' : ''} ${i % 4 === 0 ? 'seq-graph__bar-wrap--downbeat' : ''}`}
              style={{ width: `${100 / stepCount}%` }}
              title={isNote ? midiToName(value) : `${Math.round(value)}${modeConfig.unit}`}
            >
              <div
                className={`seq-graph__bar ${!step.enabled ? 'seq-graph__bar--disabled' : ''}`}
                style={{
                  '--bar-color': trackColor,
                  '--bar-height': isBipolar ? `${Math.abs(norm - 0.5) * 100}%` : `${norm * 100}%`,
                  '--bar-bottom': isBipolar ? (norm >= 0.5 ? '50%' : `${norm * 100}%`) : '0%',
                } as React.CSSProperties}
              />
              {/* Note name label for NOTE mode */}
              {isNote && step.enabled && (
                <span className="seq-graph__note-label">{midiToName(value)}</span>
              )}
            </div>
          );
        })}

        {/* Phase 7: Graph tooltip */}
        {graphTooltip && (
          <div
            className="sacred-auto-tooltip"
            style={{
              left: `${Math.min(graphTooltip.x + 12, (containerRef.current?.clientWidth ?? 600) - 80)}px`,
              top: `${Math.max(graphTooltip.y - 24, 2)}px`,
            }}
          >
            <span className="sacred-auto-tooltip__step">
              Step {graphTooltip.step + 1}
            </span>
            <span className="sacred-auto-tooltip__value">
              {graphTooltip.value}{modeConfig.unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
