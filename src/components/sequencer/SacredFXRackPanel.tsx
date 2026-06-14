/**
 * SacredFXRackPanel — Tabbed global FX parameter control panel.
 * Four tabs (Reverb / Chorus / Delay / Saturation) with live parameter sliders.
 * Reads current values from FXRack.getParams() and calls setter methods in real time.
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { FXRack, FXRackParams } from '../../audio/FXRack';
import { DivineSlider } from '../ui/DivineSlider';


interface SacredFXRackPanelProps {
  fxRack: React.MutableRefObject<FXRack | null>;
}

type FXTab = 'reverb' | 'chorus' | 'delay' | 'saturation';

const TABS: { id: FXTab; label: string; color: string; icon: string }[] = [
  { id: 'reverb',     label: 'REVERB',     color: '#FFD700', icon: '🌊' },
  { id: 'chorus',     label: 'CHORUS',     color: '#60A5FA', icon: '💫' },
  { id: 'delay',      label: 'DELAY',      color: '#22C55E', icon: '⏳' },
  { id: 'saturation', label: 'SATURATION', color: '#EF4444', icon: '🔥' },
];

interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  getValue: (p: FXRackParams) => number;
  setValue: (rack: FXRack, v: number) => void;
}

const REVERB_SLIDERS: SliderDef[] = [
  {
    key: 'reverbDecay', label: 'Decay', min: 0.5, max: 8, step: 0.1, unit: 's',
    getValue: p => p.reverbDecay,
    setValue: (r, v) => r.setReverbDecay(v),
  },
  {
    key: 'reverbReturn', label: 'Return', min: 0, max: 1, step: 0.01, unit: '%',
    getValue: p => p.reverbReturn,
    setValue: (r, v) => r.setReverbReturn(v),
  },
];

const CHORUS_SLIDERS: SliderDef[] = [
  {
    key: 'chorusRate', label: 'Rate', min: 0.1, max: 5, step: 0.1, unit: 'Hz',
    getValue: p => p.chorusRate,
    setValue: (r, v) => r.setChorusRate(v),
  },
  {
    key: 'chorusDepth', label: 'Depth', min: 1, max: 15, step: 0.5, unit: 'ms',
    getValue: p => p.chorusDepth,
    setValue: (r, v) => r.setChorusDepth(v),
  },
  {
    key: 'chorusReturn', label: 'Return', min: 0, max: 1, step: 0.01, unit: '%',
    getValue: p => p.chorusReturn,
    setValue: (r, v) => r.setChorusReturn(v),
  },
];

const DELAY_SLIDERS: SliderDef[] = [
  {
    key: 'delayFeedback', label: 'Feedback', min: 0, max: 0.9, step: 0.01, unit: '%',
    getValue: p => p.delayFeedback,
    setValue: (r, v) => r.setDelayFeedback(v),
  },
  {
    key: 'delayFilterFreq', label: 'Filter', min: 500, max: 12000, step: 100, unit: 'Hz',
    getValue: p => p.delayFilterFreq,
    setValue: (r, v) => r.setDelayFilterFreq(v),
  },
  {
    key: 'delayReturn', label: 'Return', min: 0, max: 1, step: 0.01, unit: '%',
    getValue: p => p.delayReturn,
    setValue: (r, v) => r.setDelayReturn(v),
  },
];

const SAT_SLIDERS: SliderDef[] = [
  {
    key: 'satDrive', label: 'Drive', min: 0.5, max: 8, step: 0.1, unit: 'x',
    getValue: p => p.satDrive,
    setValue: (r, v) => r.setSatDrive(v),
  },
  {
    key: 'satMix', label: 'Mix', min: 0, max: 1, step: 0.01, unit: '%',
    getValue: p => p.satMix,
    setValue: (r, v) => r.setSatMix(v),
  },
  {
    key: 'satReturn', label: 'Return', min: 0, max: 1, step: 0.01, unit: '%',
    getValue: p => p.satReturn,
    setValue: (r, v) => r.setSatReturn(v),
  },
];

const TAB_SLIDERS: Record<FXTab, SliderDef[]> = {
  reverb: REVERB_SLIDERS,
  chorus: CHORUS_SLIDERS,
  delay: DELAY_SLIDERS,
  saturation: SAT_SLIDERS,
};

function formatValue(val: number, unit: string): string {
  if (unit === '%') return `${Math.round(val * 100)}%`;
  if (unit === 'Hz' && val >= 1000) return `${(val / 1000).toFixed(1)}kHz`;
  if (unit === 'Hz') return `${Math.round(val)}Hz`;
  return `${val.toFixed(1)}${unit}`;
}

export const SacredFXRackPanel: React.FC<SacredFXRackPanelProps> = ({ fxRack }) => {
  const [activeTab, setActiveTab] = useState<FXTab>('reverb');
  const [params, setParams] = useState<FXRackParams | null>(null);

  // Read params on mount and tab switch
  useEffect(() => {
    if (fxRack.current) {
      setParams(fxRack.current.getParams());
    }
  }, [fxRack, activeTab]);

  const handleChange = useCallback((slider: SliderDef, value: number) => {
    if (!fxRack.current) return;
    slider.setValue(fxRack.current, value);
    // Refresh params snapshot
    setParams(fxRack.current.getParams());
  }, [fxRack]);

  if (!params) return null;

  const sliders = TAB_SLIDERS[activeTab];
  const activeTabInfo = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="seq-fx-panel">
      <div className="seq-fx-panel__header">
        <span className="seq-fx-panel__title">FX RACK</span>
        <div className="seq-fx-panel__tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`seq-fx-panel__tab ${activeTab === tab.id ? 'seq-fx-panel__tab--active' : ''}`}
              style={{
                '--tab-color': tab.color,
                borderBottomColor: activeTab === tab.id ? tab.color : 'transparent',
              } as React.CSSProperties}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="seq-fx-panel__tab-icon">{tab.icon}</span>
              <span className="seq-fx-panel__tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className="seq-fx-panel__body"
        style={{ '--fx-color': activeTabInfo.color } as React.CSSProperties}
      >
        {sliders.map(slider => {
          const val = slider.getValue(params);
          return (
            <div key={slider.key} className="seq-fx-panel__control">
              <label className="seq-fx-panel__control-label">{slider.label}</label>
              <div className="seq-fx-panel__slider-wrap">
                <div className="seq-fx-panel__slider-custom" style={{ flex: 1 }}>
                  <DivineSlider
                    min={slider.min}
                    max={slider.max}
                    value={val}
                    step={slider.step}
                    decimals={slider.step < 0.1 ? 2 : slider.step < 1 ? 1 : 0}
                    onChange={(v) => handleChange(slider, v)}
                    color={activeTabInfo.color}
                    size="sm"
                  />
                </div>
                <span className="seq-fx-panel__control-value">
                  {formatValue(val, slider.unit)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
