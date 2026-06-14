/**
 * SacredSidechain — Sidechain Compressor Panel
 *
 * Visual control panel for per-track sidechain ducking.
 * Shows source selector, threshold/ratio/attack/release/hold/depth controls,
 * and a real-time gain reduction meter.
 */
import React, { useCallback } from 'react';
import type { SidechainConfig } from '../../audio/SidechainEngine';
import { DivineSlider } from '../ui/DivineSlider';
import './SacredSidechain.css';


interface TrackInfo {
  index: number;
  name: string;
  icon: string;
  color: string;
}

interface SacredSidechainProps {
  config: SidechainConfig;
  onConfigChange: (changes: Partial<SidechainConfig>) => void;
  /** Available tracks to use as sidechain source */
  availableSources: TrackInfo[];
  /** Current track index (can't sidechain from self) */
  currentTrackIndex: number;
  /** Current gain reduction 0-1 (for meter) */
  gainReduction: number;
}

export const SacredSidechain: React.FC<SacredSidechainProps> = ({
  config,
  onConfigChange,
  availableSources,
  currentTrackIndex,
  gainReduction,
}) => {
  const handleToggle = useCallback(() => {
    onConfigChange({ enabled: !config.enabled });
  }, [config.enabled, onConfigChange]);

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({ sourceTrackIndex: parseInt(e.target.value, 10) });
  }, [onConfigChange]);

  const handleSlider = useCallback((param: keyof SidechainConfig, value: number) => {
    onConfigChange({ [param]: value } as Partial<SidechainConfig>);
  }, [onConfigChange]);

  const reductionDb = gainReduction > 0 ? Math.abs(20 * Math.log10(1 - gainReduction)).toFixed(1) : '0.0';
  const reductionPercent = Math.round(gainReduction * 100);

  // Sources: all tracks except self
  const sources = availableSources.filter(t => t.index !== currentTrackIndex);

  const sourceName = config.sourceTrackIndex >= 0
    ? availableSources.find(t => t.index === config.sourceTrackIndex)?.name ?? 'Unknown'
    : 'None';

  return (
    <div className={`sacred-sc ${config.enabled ? 'sacred-sc--active' : ''}`}>
      {/* Header */}
      <div className="sacred-sc__header">
        <button
          className={`sacred-sc__power ${config.enabled ? 'sacred-sc__power--on' : ''}`}
          onClick={handleToggle}
          title={config.enabled ? 'Disable Sidechain' : 'Enable Sidechain'}
        >
          {config.enabled ? '⚡' : '○'}
        </button>
        <span className="sacred-sc__title">SIDECHAIN</span>

        {/* Gain reduction meter (compact) */}
        {config.enabled && (
          <div className="sacred-sc__meter-mini">
            <div
              className="sacred-sc__meter-bar"
              style={{ width: `${Math.min(100, reductionPercent)}%` }}
            />
            <span className="sacred-sc__meter-label">-{reductionDb}dB</span>
          </div>
        )}
      </div>

      <div className="sacred-sc__body">
        {/* Source selector */}
        <div className="sacred-sc__section">
          <span className="sacred-sc__label">SOURCE</span>
          <select
            className="sacred-sc__source-select"
            value={config.sourceTrackIndex}
            onChange={handleSourceChange}
          >
            <option value={-1}>— Select Source —</option>
            {sources.map(t => (
              <option key={t.index} value={t.index}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
          {config.sourceTrackIndex >= 0 && (
            <span className="sacred-sc__source-name">
              Ducking from: {sourceName}
            </span>
          )}
        </div>

        {/* Controls grid */}
        <div className="sacred-sc__controls">
          {/* Threshold */}
          <div className="sacred-sc__knob">
            <span className="sacred-sc__knob-label">THRESH</span>
            <div className="sacred-sc__slider-custom" style={{ width: 48 }}>
              <DivineSlider
                min={-60}
                max={0}
                value={config.threshold}
                step={1}
                decimals={0}
                onChange={v => handleSlider('threshold', v)}
                color="#EF4444"
                size="sm"
              />
            </div>
            <span className="sacred-sc__knob-value">{config.threshold}dB</span>
          </div>

          {/* Ratio */}
          <div className="sacred-sc__knob">
            <span className="sacred-sc__knob-label">RATIO</span>
            <div className="sacred-sc__slider-custom" style={{ width: 48 }}>
              <DivineSlider
                min={1}
                max={20}
                value={config.ratio}
                step={0.5}
                decimals={1}
                onChange={v => handleSlider('ratio', v)}
                color="#EF4444"
                size="sm"
              />
            </div>
            <span className="sacred-sc__knob-value">{config.ratio.toFixed(1)}:1</span>
          </div>

          {/* Attack */}
          <div className="sacred-sc__knob">
            <span className="sacred-sc__knob-label">ATK</span>
            <div className="sacred-sc__slider-custom" style={{ width: 48 }}>
              <DivineSlider
                min={0.1}
                max={100}
                value={config.attack}
                step={0.1}
                decimals={1}
                onChange={v => handleSlider('attack', v)}
                color="#EF4444"
                size="sm"
              />
            </div>
            <span className="sacred-sc__knob-value">{config.attack.toFixed(1)}ms</span>
          </div>

          {/* Release */}
          <div className="sacred-sc__knob">
            <span className="sacred-sc__knob-label">REL</span>
            <div className="sacred-sc__slider-custom" style={{ width: 48 }}>
              <DivineSlider
                min={10}
                max={1000}
                value={config.release}
                step={5}
                decimals={0}
                onChange={v => handleSlider('release', v)}
                color="#EF4444"
                size="sm"
              />
            </div>
            <span className="sacred-sc__knob-value">{config.release}ms</span>
          </div>

          {/* Hold */}
          <div className="sacred-sc__knob">
            <span className="sacred-sc__knob-label">HOLD</span>
            <div className="sacred-sc__slider-custom" style={{ width: 48 }}>
              <DivineSlider
                min={0}
                max={200}
                value={config.hold}
                step={1}
                decimals={0}
                onChange={v => handleSlider('hold', v)}
                color="#EF4444"
                size="sm"
              />
            </div>
            <span className="sacred-sc__knob-value">{config.hold}ms</span>
          </div>

          {/* Depth */}
          <div className="sacred-sc__knob">
            <span className="sacred-sc__knob-label">DEPTH</span>
            <div className="sacred-sc__slider-custom" style={{ width: 48 }}>
              <DivineSlider
                min={0}
                max={100}
                value={config.depth}
                step={1}
                decimals={0}
                onChange={v => handleSlider('depth', v)}
                color="#FFD700"
                size="sm"
              />
            </div>
            <span className="sacred-sc__knob-value">{config.depth}%</span>
          </div>
        </div>

        {/* Gain reduction meter (full) */}
        {config.enabled && (
          <div className="sacred-sc__section sacred-sc__meter-section">
            <span className="sacred-sc__label">GAIN REDUCTION</span>
            <div className="sacred-sc__meter-full">
              <div className="sacred-sc__meter-track">
                <div
                  className="sacred-sc__meter-fill"
                  style={{ width: `${Math.min(100, reductionPercent)}%` }}
                />
                {/* Threshold marker */}
                <div
                  className="sacred-sc__meter-threshold"
                  style={{ left: `${Math.max(0, 100 + (config.threshold / 60 * 100))}%` }}
                />
              </div>
              <div className="sacred-sc__meter-values">
                <span>0dB</span>
                <span className="sacred-sc__meter-current">-{reductionDb}dB</span>
                <span>-40dB</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
