/**
 * DivineSettings — The Sacred Configuration Panel
 * ─────────────────────────────────────────────────
 * Slide-from-right settings drawer with all plugin preferences.
 * Persists to localStorage with JUCE bridge sync.
 *
 * "Even gods must choose their dominion."
 */

import React, { useState, useCallback, useEffect } from 'react';
import '@/styles/DivineSettings.css';
import { nativeAudio } from '@/native/bridge';

// ═══════════════════════════════════════════════════════
// Settings Schema & Defaults
// ═══════════════════════════════════════════════════════

export interface DivineSettingsData {
  // Audio
  audioBufferSize: number;
  sampleRate: number;
  oversampling: '1x' | '2x' | '4x';
  dithering: boolean;

  // Engine
  multiThreadedDSP: boolean;
  maxVoices: number;
  preloadSamples: boolean;

  // UI
  uiScale: number;
  showTooltips: boolean;
  animationsEnabled: boolean;
  meterRefreshRate: number;
  theme: 'divine-gold' | 'midnight-violet' | 'obsidian';

  // MIDI
  midiChannel: number; // 0 = Omni
  velocityCurve: 'linear' | 'soft' | 'hard' | 'custom';
  midiThrough: boolean;

  // Paths
  sampleLibraryPath: string;
  presetPath: string;
  exportPath: string;

  // Behavior
  autoSave: boolean;
  autoSaveIntervalSec: number;
  confirmOnClose: boolean;
  loadLastSessionOnStart: boolean;

  // About (read-only display)
  pluginVersion: string;
}

const DEFAULT_SETTINGS: DivineSettingsData = {
  audioBufferSize: 512,
  sampleRate: 44100,
  oversampling: '1x',
  dithering: true,
  multiThreadedDSP: true,
  maxVoices: 128,
  preloadSamples: true,
  uiScale: 100,
  showTooltips: true,
  animationsEnabled: true,
  meterRefreshRate: 30,
  theme: 'divine-gold',
  midiChannel: 0,
  velocityCurve: 'linear',
  midiThrough: false,
  sampleLibraryPath: '~/Library/Audio/Samples/VST GOD/',
  presetPath: '~/Library/Audio/Presets/VST GOD/',
  exportPath: '~/Desktop/',
  autoSave: true,
  autoSaveIntervalSec: 120,
  confirmOnClose: true,
  loadLastSessionOnStart: true,
  pluginVersion: 'v1.0.0-dev',
};

const STORAGE_KEY = 'vst-god-divine-settings';

function loadSettings(): DivineSettingsData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // localStorage may not be available in JUCE WebView
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: DivineSettingsData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Silently fail in restricted WebView contexts
  }
}

// ═══════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange }) => (
  <div className="ds-row">
    <div className="ds-row__info">
      <span className="ds-row__label">{label}</span>
      {description && <span className="ds-row__description">{description}</span>}
    </div>
    <label className="ds-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ds-toggle__track" />
    </label>
  </div>
);

interface SelectRowProps {
  label: string;
  description?: string;
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (v: string) => void;
}

const SelectRow: React.FC<SelectRowProps> = ({ label, description, value, options, onChange }) => (
  <div className="ds-row">
    <div className="ds-row__info">
      <span className="ds-row__label">{label}</span>
      {description && <span className="ds-row__description">{description}</span>}
    </div>
    <select className="ds-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

interface SliderRowProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({ label, description, value, min, max, step = 1, suffix = '', onChange }) => (
  <div className="ds-row">
    <div className="ds-row__info">
      <span className="ds-row__label">{label}</span>
      {description && <span className="ds-row__description">{description}</span>}
    </div>
    <div className="ds-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="ds-slider__value">{value}{suffix}</span>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════

interface DivineSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DivineSettings: React.FC<DivineSettingsProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<DivineSettingsData>(loadSettings);
  const [exiting, setExiting] = useState(false);

  // Load settings from C++ on mount if running in JUCE
  useEffect(() => {
    const unsubscribe = nativeAudio.subscribeSettings((nativeSettings) => {
      if (nativeSettings && Object.keys(nativeSettings).length > 0) {
        setSettings((prev) => {
          const merged = { ...prev, ...nativeSettings };
          saveSettings(merged);
          return merged;
        });
      }
    });
    nativeAudio.getSettings();
    return unsubscribe;
  }, []);

  // Persist on every change
  useEffect(() => {
    saveSettings(settings);
    nativeAudio.saveSettings(settings);
  }, [settings]);

  const update = useCallback(<K extends keyof DivineSettingsData>(
    key: K,
    value: DivineSettingsData[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      onClose();
    }, 300);
  }, [onClose]);

  const handleReset = useCallback(() => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      setSettings({ ...DEFAULT_SETTINGS });
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`divine-settings-backdrop ${exiting ? 'divine-settings-backdrop--exiting' : ''}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div className={`divine-settings ${exiting ? 'divine-settings--exiting' : ''}`}>

        {/* ═══ Header ═══ */}
        <div className="ds-header">
          <div className="ds-header__title">
            <span className="ds-header__icon">⚙</span>
            <span className="ds-header__text">Sacred Configuration</span>
          </div>
          <button className="ds-header__close" onClick={handleClose} aria-label="Close Settings">✕</button>
        </div>

        {/* ═══ Scrollable Content ═══ */}
        <div className="ds-content">

          {/* ─── Audio Engine ─── */}
          <div className="ds-section">
            <div className="ds-section__header">
              <span className="ds-section__icon">🎛</span>
              <span className="ds-section__title">Audio Engine</span>
            </div>

            <SelectRow
              label="Buffer Size"
              description="Lower = less latency, higher CPU"
              value={settings.audioBufferSize}
              options={[
                { value: 64, label: '64 samples' },
                { value: 128, label: '128 samples' },
                { value: 256, label: '256 samples' },
                { value: 512, label: '512 samples' },
                { value: 1024, label: '1024 samples' },
                { value: 2048, label: '2048 samples' },
              ]}
              onChange={(v) => update('audioBufferSize', Number(v))}
            />

            <SelectRow
              label="Sample Rate"
              description="Match your DAW project settings"
              value={settings.sampleRate}
              options={[
                { value: 44100, label: '44.1 kHz' },
                { value: 48000, label: '48 kHz' },
                { value: 88200, label: '88.2 kHz' },
                { value: 96000, label: '96 kHz' },
              ]}
              onChange={(v) => update('sampleRate', Number(v))}
            />

            <SelectRow
              label="Oversampling"
              description="Higher quality at the cost of CPU"
              value={settings.oversampling}
              options={[
                { value: '1x', label: '1x (Standard)' },
                { value: '2x', label: '2x (High)' },
                { value: '4x', label: '4x (Ultra)' },
              ]}
              onChange={(v) => update('oversampling', v as '1x' | '2x' | '4x')}
            />

            <ToggleRow
              label="Dithering"
              description="Apply dithering on bit-depth reduction"
              checked={settings.dithering}
              onChange={(v) => update('dithering', v)}
            />
          </div>

          {/* ─── DSP Engine ─── */}
          <div className="ds-section">
            <div className="ds-section__header">
              <span className="ds-section__icon">⚡</span>
              <span className="ds-section__title">DSP Engine</span>
            </div>

            <ToggleRow
              label="Multi-Threaded DSP"
              description="Spread processing across CPU cores"
              checked={settings.multiThreadedDSP}
              onChange={(v) => update('multiThreadedDSP', v)}
            />

            <SelectRow
              label="Max Polyphony"
              description="Maximum simultaneous voices"
              value={settings.maxVoices}
              options={[
                { value: 32, label: '32 voices' },
                { value: 64, label: '64 voices' },
                { value: 128, label: '128 voices' },
                { value: 256, label: '256 voices' },
              ]}
              onChange={(v) => update('maxVoices', Number(v))}
            />

            <ToggleRow
              label="Preload Samples"
              description="Load all samples into RAM on startup"
              checked={settings.preloadSamples}
              onChange={(v) => update('preloadSamples', v)}
            />
          </div>

          {/* ─── MIDI ─── */}
          <div className="ds-section">
            <div className="ds-section__header">
              <span className="ds-section__icon">🎹</span>
              <span className="ds-section__title">MIDI</span>
            </div>

            <SelectRow
              label="MIDI Channel"
              description="Omni receives all channels"
              value={settings.midiChannel}
              options={[
                { value: 0, label: 'Omni (All)' },
                ...Array.from({ length: 16 }, (_, i) => ({
                  value: i + 1,
                  label: `Channel ${i + 1}`,
                })),
              ]}
              onChange={(v) => update('midiChannel', Number(v))}
            />

            <SelectRow
              label="Velocity Curve"
              description="How velocity maps to volume"
              value={settings.velocityCurve}
              options={[
                { value: 'linear', label: 'Linear' },
                { value: 'soft', label: 'Soft (Logarithmic)' },
                { value: 'hard', label: 'Hard (Exponential)' },
                { value: 'custom', label: 'Custom' },
              ]}
              onChange={(v) => update('velocityCurve', v as 'linear' | 'soft' | 'hard' | 'custom')}
            />

            <ToggleRow
              label="MIDI Thru"
              description="Pass incoming MIDI to output"
              checked={settings.midiThrough}
              onChange={(v) => update('midiThrough', v)}
            />
          </div>

          {/* ─── Interface ─── */}
          <div className="ds-section">
            <div className="ds-section__header">
              <span className="ds-section__icon">✨</span>
              <span className="ds-section__title">Interface</span>
            </div>

            <SliderRow
              label="UI Scale"
              description="Resize the entire interface"
              value={settings.uiScale}
              min={75}
              max={150}
              step={5}
              suffix="%"
              onChange={(v) => update('uiScale', v)}
            />

            <SelectRow
              label="Theme"
              description="Visual appearance of the God Realm"
              value={settings.theme}
              options={[
                { value: 'divine-gold', label: '🔱 Divine Gold' },
                { value: 'midnight-violet', label: '🌌 Midnight Violet' },
                { value: 'obsidian', label: '⬛ Obsidian' },
              ]}
              onChange={(v) => update('theme', v as DivineSettingsData['theme'])}
            />

            <ToggleRow
              label="Animations"
              description="Sacred geometry, particles, transitions"
              checked={settings.animationsEnabled}
              onChange={(v) => update('animationsEnabled', v)}
            />

            <ToggleRow
              label="Tooltips"
              description="Show parameter hints on hover"
              checked={settings.showTooltips}
              onChange={(v) => update('showTooltips', v)}
            />

            <SliderRow
              label="Meter Refresh"
              description="VU/spectrum update frequency"
              value={settings.meterRefreshRate}
              min={15}
              max={60}
              step={5}
              suffix=" Hz"
              onChange={(v) => update('meterRefreshRate', v)}
            />
          </div>

          {/* ─── Paths ─── */}
          <div className="ds-section">
            <div className="ds-section__header">
              <span className="ds-section__icon">📂</span>
              <span className="ds-section__title">File Paths</span>
            </div>

            <div className="ds-row">
              <div className="ds-row__info">
                <span className="ds-row__label">Sample Library</span>
                <span className="ds-row__description">Where sacred samples are stored</span>
              </div>
              <div className="ds-path">
                <span className="ds-path__value" title={settings.sampleLibraryPath}>
                  {settings.sampleLibraryPath}
                </span>
              </div>
            </div>

            <div className="ds-row">
              <div className="ds-row__info">
                <span className="ds-row__label">Presets</span>
                <span className="ds-row__description">Where rituals are stored</span>
              </div>
              <div className="ds-path">
                <span className="ds-path__value" title={settings.presetPath}>
                  {settings.presetPath}
                </span>
              </div>
            </div>

            <div className="ds-row">
              <div className="ds-row__info">
                <span className="ds-row__label">Export</span>
                <span className="ds-row__description">Default export destination</span>
              </div>
              <div className="ds-path">
                <span className="ds-path__value" title={settings.exportPath}>
                  {settings.exportPath}
                </span>
              </div>
            </div>
          </div>

          {/* ─── Behavior ─── */}
          <div className="ds-section">
            <div className="ds-section__header">
              <span className="ds-section__icon">🛡</span>
              <span className="ds-section__title">Behavior</span>
            </div>

            <ToggleRow
              label="Auto-Save"
              description="Periodically save current session"
              checked={settings.autoSave}
              onChange={(v) => update('autoSave', v)}
            />

            {settings.autoSave && (
              <SliderRow
                label="Auto-Save Interval"
                description="Seconds between auto-saves"
                value={settings.autoSaveIntervalSec}
                min={30}
                max={600}
                step={30}
                suffix="s"
                onChange={(v) => update('autoSaveIntervalSec', v)}
              />
            )}

            <ToggleRow
              label="Confirm on Close"
              description="Ask before closing with unsaved changes"
              checked={settings.confirmOnClose}
              onChange={(v) => update('confirmOnClose', v)}
            />

            <ToggleRow
              label="Load Last Session on Start"
              description="Resume where you left off"
              checked={settings.loadLastSessionOnStart}
              onChange={(v) => update('loadLastSessionOnStart', v)}
            />
          </div>

          {/* ─── Reset ─── */}
          <button className="ds-reset-btn" onClick={handleReset}>
            ↺ Reset All Settings to Defaults
          </button>
        </div>

        {/* ═══ Footer ═══ */}
        <div className="ds-footer">
          <div className="ds-footer__brand">VST GOD</div>
          <div className="ds-footer__version">{settings.pluginVersion} — The God Realm</div>
          <div className="ds-footer__credits">Forged by MixxTech · ©2026</div>
        </div>
      </div>
    </>
  );
};

export default DivineSettings;
