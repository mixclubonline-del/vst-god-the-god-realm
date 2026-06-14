/**
 * SacredStepDetail — Per-Step Parameter Lock Panel
 * Elektron Digitakt-class step editing popover.
 * Shift+Click on any step to open, edit retrig, trig conditions,
 * micro-timing, probability, pitch, pan, decay.
 */
import React, { useCallback, useRef, useEffect } from 'react';
import type { StepState } from './useSequencerEngine';
import { DivineSlider } from '../ui/DivineSlider';


interface SacredStepDetailProps {
  step: StepState;
  stepIndex: number;
  trackIndex: number;
  trackName: string;
  trackColor: string;
  position: { x: number; y: number };
  onClose: () => void;
  onSetProp: (prop: keyof StepState, value: any) => void;
}

const RETRIG_RATES: Array<StepState['retrigRate']> = [null, '1/2', '1/4', '1/8', '1/16', '1/32'];
const RETRIG_LABELS: Record<string, string> = {
  'null': 'OFF', '1/2': '1/2', '1/4': '1/4', '1/8': '1/8', '1/16': '1/16', '1/32': '1/32',
};

const VELOCITY_CURVES: Array<StepState['retrigVelocityCurve']> = ['flat', 'rampUp', 'rampDown', 'random'];
const CURVE_ICONS: Record<string, string> = {
  flat: '━', rampUp: '↗', rampDown: '↘', random: '⟿',
};

const TRIG_CONDITIONS: Array<StepState['trigCondition']> = ['always', 'fill', 'notFill', '1:2', '1:4', '1:8'];
const TRIG_LABELS: Record<string, string> = {
  always: 'ALWAYS', fill: 'FILL', notFill: '!FILL', '1:2': '1:2', '1:4': '1:4', '1:8': '1:8',
};

export const SacredStepDetail: React.FC<SacredStepDetailProps> = ({
  step, stepIndex, trackIndex, trackName, trackColor, position, onClose, onSetProp,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape or outside click
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    // Delay click listener to avoid immediate close
    const timer = setTimeout(() => window.addEventListener('mousedown', handleClick), 50);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
      clearTimeout(timer);
    };
  }, [onClose]);

  // Clamp panel position to viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 280),
    top: Math.min(position.y, window.innerHeight - 420),
    zIndex: 100,
  };

  return (
    <div ref={panelRef} className="step-detail" style={style}>
      {/* Header */}
      <div className="step-detail__header" style={{ borderColor: trackColor }}>
        <span className="step-detail__title">
          STEP {stepIndex + 1} · {trackName}
        </span>
        <button className="step-detail__close" onClick={onClose}>✕</button>
      </div>

      {/* Velocity */}
      <ParamRow label="VELOCITY" value={step.velocity} suffix="" color={trackColor}>
        <div className="step-detail__slider-custom">
          <DivineSlider
            min={0}
            max={127}
            value={step.velocity}
            step={1}
            decimals={0}
            onChange={(v) => onSetProp('velocity', Math.round(v))}
            color={trackColor}
            size="sm"
          />
        </div>
        <span className="step-detail__value">{step.velocity}</span>
      </ParamRow>

      {/* Pitch */}
      <ParamRow label="PITCH" value={step.pitch} suffix="st" color={trackColor}>
        <div className="step-detail__slider-custom">
          <DivineSlider
            min={-24}
            max={24}
            value={step.pitch}
            step={1}
            decimals={0}
            onChange={(v) => onSetProp('pitch', Math.round(v))}
            color={trackColor}
            size="sm"
          />
        </div>
        <span className="step-detail__value">{step.pitch > 0 ? '+' : ''}{step.pitch}</span>
      </ParamRow>

      {/* Pan */}
      <ParamRow label="PAN" value={Math.round(step.pan * 100)} suffix="" color={trackColor}>
        <div className="step-detail__slider-custom">
          <DivineSlider
            min={-100}
            max={100}
            value={Math.round(step.pan * 100)}
            step={1}
            decimals={0}
            onChange={(v) => onSetProp('pan', Math.round(v) / 100)}
            color={trackColor}
            size="sm"
          />
        </div>
        <span className="step-detail__value">
          {step.pan === 0 ? 'C' : step.pan < 0 ? `L${Math.abs(Math.round(step.pan * 100))}` : `R${Math.round(step.pan * 100)}`}
        </span>
      </ParamRow>

      {/* Decay */}
      <ParamRow label="DECAY" value={Math.round(step.decay * 100)} suffix="%" color={trackColor}>
        <div className="step-detail__slider-custom">
          <DivineSlider
            min={0}
            max={100}
            value={Math.round(step.decay * 100)}
            step={1}
            decimals={0}
            onChange={(v) => onSetProp('decay', Math.round(v) / 100)}
            color={trackColor}
            size="sm"
          />
        </div>
        <span className="step-detail__value">{Math.round(step.decay * 100)}%</span>
      </ParamRow>

      {/* Probability */}
      <ParamRow label="PROB" value={step.probability} suffix="%" color={trackColor}>
        <div className="step-detail__slider-custom">
          <DivineSlider
            min={0}
            max={100}
            value={step.probability}
            step={5}
            decimals={0}
            onChange={(v) => onSetProp('probability', Math.round(v))}
            color={trackColor}
            size="sm"
          />
        </div>
        <span className="step-detail__value">{step.probability}%</span>
      </ParamRow>

      {/* Micro-Timing */}
      <ParamRow label="μTIME" value={step.microTiming} suffix="%" color={trackColor}>
        <div className="step-detail__slider-custom">
          <DivineSlider
            min={-50}
            max={50}
            value={step.microTiming}
            step={1}
            decimals={0}
            onChange={(v) => onSetProp('microTiming', Math.round(v))}
            color={trackColor}
            size="sm"
          />
        </div>
        <span className="step-detail__value">{step.microTiming > 0 ? '+' : ''}{step.microTiming}</span>
      </ParamRow>

      {/* Slice Index */}
      <ParamRow label="SLICE" value={step.sliceIndex} suffix="" color={trackColor}>
        <div className="step-detail__slider-custom">
          <DivineSlider
            min={0}
            max={16}
            value={step.sliceIndex}
            step={1}
            decimals={0}
            onChange={(v) => onSetProp('sliceIndex', Math.round(v))}
            color={trackColor}
            size="sm"
          />
        </div>
        <span className="step-detail__value">{step.sliceIndex === 0 ? 'ALL' : `S${step.sliceIndex}`}</span>
      </ParamRow>

      {/* Divider */}
      <div className="step-detail__divider" />

      {/* Trig Condition */}
      <div className="step-detail__section">
        <span className="step-detail__section-label">TRIG CONDITION</span>
        <div className="step-detail__chip-row">
          {TRIG_CONDITIONS.map(tc => (
            <button
              key={tc}
              className={`step-detail__chip ${step.trigCondition === tc ? 'step-detail__chip--active' : ''}`}
              style={step.trigCondition === tc ? { borderColor: trackColor, color: trackColor } : {}}
              onClick={() => onSetProp('trigCondition', tc)}
            >
              {TRIG_LABELS[tc]}
            </button>
          ))}
        </div>
      </div>

      {/* Retrig Rate */}
      <div className="step-detail__section">
        <span className="step-detail__section-label">RETRIG RATE</span>
        <div className="step-detail__chip-row">
          {RETRIG_RATES.map(rate => (
            <button
              key={String(rate)}
              className={`step-detail__chip ${step.retrigRate === rate ? 'step-detail__chip--active' : ''}`}
              style={step.retrigRate === rate ? { borderColor: trackColor, color: trackColor } : {}}
              onClick={() => onSetProp('retrigRate', rate)}
            >
              {RETRIG_LABELS[String(rate)]}
            </button>
          ))}
        </div>
      </div>

      {/* Retrig Velocity Curve */}
      {step.retrigRate && (
        <div className="step-detail__section">
          <span className="step-detail__section-label">RETRIG CURVE</span>
          <div className="step-detail__chip-row">
            {VELOCITY_CURVES.map(curve => (
              <button
                key={curve}
                className={`step-detail__chip step-detail__chip--wide ${step.retrigVelocityCurve === curve ? 'step-detail__chip--active' : ''}`}
                style={step.retrigVelocityCurve === curve ? { borderColor: trackColor, color: trackColor } : {}}
                onClick={() => onSetProp('retrigVelocityCurve', curve)}
              >
                <span className="step-detail__chip-icon">{CURVE_ICONS[curve]}</span>
                {curve.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Helper: Parameter Row ─── */
const ParamRow: React.FC<{
  label: string;
  value: number;
  suffix: string;
  color: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="step-detail__param">
    <span className="step-detail__param-label">{label}</span>
    <div className="step-detail__param-control">{children}</div>
  </div>
);
