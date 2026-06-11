/**
 * SacredArpeggiator — God Realm Arpeggiator Panel
 *
 * Visual control panel for the ArpeggiatorEngine.
 * Displays mode selector, rate, octave range, gate, and rhythm pattern editor.
 */
import React, { useCallback, useMemo } from 'react';
import type { ArpConfig, ArpMode, ArpRate } from '../../audio/ArpeggiatorEngine';
import './SacredArpeggiator.css';

interface SacredArpeggiatorProps {
  config: ArpConfig;
  isRunning: boolean;
  currentStep: number;
  sequence: number[];
  heldNoteCount: number;
  onConfigChange: (changes: Partial<ArpConfig>) => void;
}

const ARP_MODES: { id: ArpMode; label: string; icon: string }[] = [
  { id: 'up', label: 'UP', icon: '↑' },
  { id: 'down', label: 'DOWN', icon: '↓' },
  { id: 'upDown', label: 'UP/DN', icon: '↕' },
  { id: 'random', label: 'RNG', icon: '🎲' },
  { id: 'order', label: 'ORD', icon: '→' },
];

const ARP_RATES: { id: ArpRate; label: string }[] = [
  { id: '1/4', label: '1/4' },
  { id: '1/8', label: '1/8' },
  { id: '1/8T', label: '1/8T' },
  { id: '1/16', label: '1/16' },
  { id: '1/16T', label: '1/16T' },
  { id: '1/32', label: '1/32' },
];

const RHYTHM_PRESETS = [
  { label: 'ALL', pattern: [1, 1, 1, 1] },
  { label: '3/4', pattern: [1, 1, 1, 0] },
  { label: 'DOT', pattern: [1, 0, 1, 0] },
  { label: 'SYNC', pattern: [1, 0, 0, 1] },
  { label: 'SKIP', pattern: [1, 1, 0, 1] },
  { label: 'PERC', pattern: [1, 0, 1, 1, 0, 1] },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

export const SacredArpeggiator: React.FC<SacredArpeggiatorProps> = ({
  config,
  isRunning,
  currentStep,
  sequence,
  heldNoteCount,
  onConfigChange,
}) => {
  const handleToggle = useCallback(() => {
    onConfigChange({ enabled: !config.enabled });
  }, [config.enabled, onConfigChange]);

  const handleModeChange = useCallback((mode: ArpMode) => {
    onConfigChange({ mode });
  }, [onConfigChange]);

  const handleRateChange = useCallback((rate: ArpRate) => {
    onConfigChange({ rate });
  }, [onConfigChange]);

  const handleOctaveChange = useCallback((delta: number) => {
    const next = Math.max(1, Math.min(4, config.octaveRange + delta));
    onConfigChange({ octaveRange: next });
  }, [config.octaveRange, onConfigChange]);

  const handleGateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ gate: parseFloat(e.target.value) });
  }, [onConfigChange]);

  const handlePatternToggle = useCallback((index: number) => {
    const newPattern = [...config.pattern];
    newPattern[index] = newPattern[index] === 1 ? 0 : 1;
    onConfigChange({ pattern: newPattern });
  }, [config.pattern, onConfigChange]);

  const handlePatternPreset = useCallback((pattern: number[]) => {
    onConfigChange({ pattern: [...pattern] });
  }, [onConfigChange]);

  // Sequence visualization (show first 16 notes)
  const visibleSequence = useMemo(() => {
    return sequence.slice(0, 16);
  }, [sequence]);

  return (
    <div className={`sacred-arp ${config.enabled ? 'sacred-arp--active' : ''}`}>
      {/* Header */}
      <div className="sacred-arp__header">
        <button
          className={`sacred-arp__power ${config.enabled ? 'sacred-arp__power--on' : ''}`}
          onClick={handleToggle}
          title={config.enabled ? 'Disable Arpeggiator' : 'Enable Arpeggiator'}
        >
          {config.enabled ? '⚡' : '○'}
        </button>
        <span className="sacred-arp__title">ARPEGGIATOR</span>
        <span className="sacred-arp__status">
          {isRunning ? (
            <span className="sacred-arp__running">● PLAYING</span>
          ) : heldNoteCount > 0 ? (
            <span className="sacred-arp__holding">{heldNoteCount} held</span>
          ) : (
            <span className="sacred-arp__idle">IDLE</span>
          )}
        </span>
      </div>

      {/* Controls */}
      <div className="sacred-arp__body">
        {/* Mode selector */}
        <div className="sacred-arp__section">
          <span className="sacred-arp__label">MODE</span>
          <div className="sacred-arp__mode-grid">
            {ARP_MODES.map(m => (
              <button
                key={m.id}
                className={`sacred-arp__mode-btn ${config.mode === m.id ? 'sacred-arp__mode-btn--active' : ''}`}
                onClick={() => handleModeChange(m.id)}
                title={m.label}
              >
                <span className="sacred-arp__mode-icon">{m.icon}</span>
                <span className="sacred-arp__mode-label">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rate selector */}
        <div className="sacred-arp__section">
          <span className="sacred-arp__label">RATE</span>
          <div className="sacred-arp__rate-grid">
            {ARP_RATES.map(r => (
              <button
                key={r.id}
                className={`sacred-arp__rate-btn ${config.rate === r.id ? 'sacred-arp__rate-btn--active' : ''}`}
                onClick={() => handleRateChange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Octave range + Gate */}
        <div className="sacred-arp__section sacred-arp__knobs-row">
          <div className="sacred-arp__knob-group">
            <span className="sacred-arp__label">OCTAVES</span>
            <div className="sacred-arp__octave-control">
              <button className="sacred-arp__oct-btn" onClick={() => handleOctaveChange(-1)}>−</button>
              <span className="sacred-arp__oct-value">{config.octaveRange}</span>
              <button className="sacred-arp__oct-btn" onClick={() => handleOctaveChange(1)}>+</button>
            </div>
          </div>

          <div className="sacred-arp__knob-group">
            <span className="sacred-arp__label">GATE</span>
            <input
              type="range"
              className="sacred-arp__gate-slider"
              min={0.1}
              max={1.0}
              step={0.05}
              value={config.gate}
              onChange={handleGateChange}
            />
            <span className="sacred-arp__gate-value">{Math.round(config.gate * 100)}%</span>
          </div>
        </div>

        {/* Rhythm pattern */}
        <div className="sacred-arp__section">
          <span className="sacred-arp__label">RHYTHM</span>
          <div className="sacred-arp__rhythm-row">
            {config.pattern.map((step, i) => (
              <button
                key={i}
                className={`sacred-arp__rhythm-step ${step === 1 ? 'sacred-arp__rhythm-step--on' : ''}`}
                onClick={() => handlePatternToggle(i)}
              />
            ))}
          </div>
          <div className="sacred-arp__rhythm-presets">
            {RHYTHM_PRESETS.map(p => (
              <button
                key={p.label}
                className="sacred-arp__rhythm-preset"
                onClick={() => handlePatternPreset(p.pattern)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sequence visualization */}
        {sequence.length > 0 && (
          <div className="sacred-arp__section sacred-arp__seq-viz">
            <span className="sacred-arp__label">SEQUENCE</span>
            <div className="sacred-arp__seq-notes">
              {visibleSequence.map((note, i) => (
                <span
                  key={i}
                  className={`sacred-arp__seq-note ${i === (currentStep % visibleSequence.length) && isRunning ? 'sacred-arp__seq-note--active' : ''}`}
                >
                  {midiToName(note)}
                </span>
              ))}
              {sequence.length > 16 && (
                <span className="sacred-arp__seq-more">+{sequence.length - 16}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
