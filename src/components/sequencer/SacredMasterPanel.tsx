import React from 'react';
import { MasterParams } from '../../audio/VelvetCurveEngine';
import { SacredVisualizer } from './SacredVisualizer';

interface SacredMasterPanelProps {
  params: MasterParams;
  onParamChange: (param: keyof MasterParams, value: number) => void;
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

export const SacredMasterPanel: React.FC<SacredMasterPanelProps> = ({
  params,
  onParamChange,
  analyser,
  isPlaying,
}) => {
  return (
    <div className="sacred-master-panel">
      <div className="sacred-master-panel__viz">
        <SacredVisualizer analyser={analyser} isActive={isPlaying} />
        <div className="sacred-master-panel__viz-label">MASTER OUTPUT</div>
      </div>

      <div className="sacred-master-panel__controls">
        <div className="master-controls-group">
          <div className="master-group-label">VELVET CURVE</div>
          <MasterControl
            label="DRIVE"
            value={params.drive}
            min={1}
            max={4}
            step={0.01}
            unit="x"
            onChange={(v) => onParamChange('drive', v)}
          />
          <MasterControl
            label="SILK"
            value={params.silk}
            min={0}
            max={1}
            step={0.01}
            unit="%"
            displayValue={Math.round(params.silk * 100)}
            onChange={(v) => onParamChange('silk', v)}
          />
        </div>

        <div className="master-controls-group">
          <div className="master-group-label">SILK EQ</div>
          <MasterControl
            label="BODY"
            value={params.body}
            min={-12}
            max={12}
            step={0.1}
            unit="dB"
            onChange={(v) => onParamChange('body', v)}
          />
          <MasterControl
            label="SOUL"
            value={params.soul}
            min={-12}
            max={12}
            step={0.1}
            unit="dB"
            onChange={(v) => onParamChange('soul', v)}
          />
          <MasterControl
            label="AIR"
            value={params.air}
            min={-12}
            max={12}
            step={0.1}
            unit="dB"
            onChange={(v) => onParamChange('air', v)}
          />
        </div>

        <div className="master-controls-group">
          <div className="master-group-label">LIMITER</div>
          <MasterControl
            label="THRESH"
            value={params.threshold}
            min={-24}
            max={0}
            step={0.1}
            unit="dB"
            onChange={(v) => onParamChange('threshold', v)}
          />
          <MasterControl
            label="GAIN"
            value={params.volume}
            min={0}
            max={1.5}
            step={0.01}
            unit="x"
            onChange={(v) => onParamChange('volume', v)}
          />
        </div>
      </div>
    </div>
  );
};

interface MasterControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  displayValue?: number | string;
  onChange: (val: number) => void;
}

const MasterControl: React.FC<MasterControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  displayValue,
  onChange,
}) => {
  return (
    <div className="master-control">
      <div className="master-control__label">{label}</div>
      <input
        type="range"
        className="master-control__slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="master-control__value">
        {displayValue !== undefined ? displayValue : value.toFixed(1)}
        <span className="master-control__unit">{unit}</span>
      </div>
    </div>
  );
};
