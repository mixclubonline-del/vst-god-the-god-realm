import React from 'react';
import { motion } from 'framer-motion';
import { DivineKnob } from './DivineKnob';
import { PresetDropdown } from './PresetDropdown';
import { Settings } from 'lucide-react';
import '@/styles/VSTGODTheGodRealm-theme.css';

interface Tab {
  id: string;
  label: string;
}

interface BloomDeckProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  isBloomActive: boolean;
  onToggleBloom: () => void;
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  allPresets: any[];
  activePresetId: string | null;
  currentPresetName: string;
  handlePresetSelect: (preset: any) => void;
  handlePresetPrev: () => void;
  handlePresetNext: () => void;
  handleToggleFavorite: (presetId: string) => void;
  isSequencerOpen: boolean;
  onToggleSequencer: () => void;
  isKitBrowserOpen: boolean;
  onToggleKitBrowser: (open: boolean) => void;
  isExportOverlayOpen: boolean;
  onToggleExportOverlay: (open: boolean) => void;
  isMidiModalOpen: boolean;
  onToggleMidiModal: (open: boolean) => void;
  isSyncing: boolean;
  onCloudBackup: () => void;
  onCloudRestore: () => void;
  isSettingsOpen: boolean;
  onToggleSettings: (open: boolean) => void;
  showModMatrix: boolean;
  onToggleModMatrix: (open: boolean) => void;
  isNeuralPanelOpen: boolean;
  onToggleNeuralPanel: (open: boolean) => void;
}

const TAB_SUBTITLES: Record<string, string> = {
  'Multi-Realm': 'MULTI-REALM FORGE',
  'Pantheon': 'THE DIVINE PANTHEON',
  'Sample Chopper': 'SACRED SAMPLE CHOPPER',
  'Divine Archive': 'THE DIVINE ARCHIVE',
  'Sequencer': 'SACRED SEQUENCER',
  'Mastering': 'CELESTIAL FORGE',
  'Export': 'RITUAL OF EXPORT',
  'Preset Vault': 'ETERNAL PRESET VAULT',
  'Electric Pantheon': 'ELECTRIC PANTHEON',
  'Aesthetics': 'ALTAR OF AESTHETICS',
};

const TAB_ICONS: Record<string, string> = {
  'Multi-Realm': '🌌',
  'Pantheon': '🔱',
  'Sample Chopper': '✂️',
  'Divine Archive': '📖',
  'Sequencer': '🎹',
  'Mastering': '⚡',
  'Export': '📦',
  'Preset Vault': '🔑',
  'Electric Pantheon': '⚡🎹',
  'Aesthetics': '🎨',
};

export const BloomDeck: React.FC<BloomDeckProps> = ({
  isOpen,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  isBloomActive,
  onToggleBloom,
  parameterValues,
  update,
  allPresets,
  activePresetId,
  currentPresetName,
  handlePresetSelect,
  handlePresetPrev,
  handlePresetNext,
  handleToggleFavorite,
  isSequencerOpen,
  onToggleSequencer,
  isKitBrowserOpen,
  onToggleKitBrowser,
  isExportOverlayOpen,
  onToggleExportOverlay,
  isMidiModalOpen,
  onToggleMidiModal,
  isSyncing,
  onCloudBackup,
  onCloudRestore,
  isSettingsOpen,
  onToggleSettings,
  showModMatrix,
  onToggleModMatrix,
  isNeuralPanelOpen,
  onToggleNeuralPanel,
}) => {
  if (!isOpen) return null;

  const tuneSemitones = parameterValues.tuneSemitones || 0;
  const masterVolume = parameterValues.masterVolume || 0;
  const globalBpm = parameterValues.globalBpm || 140.00;

  return (
    <motion.div
      className="vg-bloom-deck-overlay"
      initial={{ opacity: 0, scale: 0.99, x: '-50%', y: '-50%' }}
      animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
      exit={{ opacity: 0, scale: 0.99, x: '-50%', y: '-50%' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      drag
      dragMomentum={false}
      style={{ left: '50%', top: '50%', position: 'absolute' }}
    >
      {/* ─── HEADER ─── */}
      <header className="vg-bloom-deck-header">
        <div className="vg-bloom-deck-logo">
          <span className="vg-bloom-deck-logo-vst">VST</span>
          <span className="vg-bloom-deck-logo-god">GOD</span>
          <span className="vg-bloom-deck-title">BLOOM CONTROL DECK</span>
        </div>

        <div className="vg-bloom-deck-header-right">
          <button
            className="vg-bloom-exit-btn"
            onClick={() => {
              onToggleBloom();
              onClose();
            }}
            title="Return to standard static window rails layout"
          >
            EXIT FOCUS MODE
          </button>
          <button
            className="vg-bloom-deck-close"
            onClick={onClose}
            aria-label="Close Bloom Deck"
            title="Close Bloom Deck"
          >
            ✕
          </button>
        </div>
      </header>

      {/* ─── GRID LAYOUT ─── */}
      <div className="vg-bloom-deck-grid">
        {/* LEFT PANEL: Realms (Tabs) & Presets */}
        <div className="vg-bloom-deck-left">
          {/* Section: Active Tab Realms */}
          <div>
            <h4 className="vg-bloom-section-title">Divine Realms</h4>
            <div className="vg-bloom-tabs-grid">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <div
                    key={tab.id}
                    className={`vg-bloom-tab-card ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onTabChange(tab.id);
                      onClose();
                    }}
                  >
                    <span className="vg-bloom-tab-card-icon">
                      {TAB_ICONS[tab.id] || '🔱'}
                    </span>
                    <div className="vg-bloom-tab-card-info">
                      <span className="vg-bloom-tab-card-label">{tab.label}</span>
                      <span className="vg-bloom-tab-card-sub">
                        {TAB_SUBTITLES[tab.id] || 'REALM'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Preset Vault Selector */}
          <div className="vg-bloom-preset-box">
            <h4 className="vg-bloom-section-title" style={{ marginBottom: 4 }}>
              Preset Vault
            </h4>
            <div className="flex items-center gap-4">
              <PresetDropdown
                presets={allPresets}
                activePresetId={activePresetId}
                currentName={currentPresetName}
                onSelect={handlePresetSelect}
                onPrev={handlePresetPrev}
                onNext={handlePresetNext}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Master Knobs & Action Hub */}
        <div className="vg-bloom-deck-right">
          {/* Section: Master Tuning & Leveling */}
          <div>
            <h4 className="vg-bloom-section-title">Master Staging</h4>
            <div className="vg-bloom-sliders-row">
              <div className="vg-bloom-slider-column">
                <DivineKnob
                  id="tuneSemitones"
                  update={update}
                  label="TUNE"
                  min={-24}
                  max={24}
                  value={tuneSemitones}
                  onChange={(v) => update('tuneSemitones', v)}
                  size="md"
                  suffix=" ST"
                  variant="celestial"
                />
              </div>

              <div className="vg-bloom-slider-column">
                <DivineKnob
                  id="masterVolume"
                  update={update}
                  label="VOLUME"
                  min={-60}
                  max={6}
                  value={masterVolume}
                  onChange={(v) => update('masterVolume', v)}
                  size="md"
                  suffix=" dB"
                  variant="celestial"
                />
              </div>

              <div className="vg-bloom-slider-column">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255, 215, 0, 0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    minWidth: '90px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: '8px',
                      color: 'var(--god-text-muted)',
                      letterSpacing: '0.15em',
                      marginBottom: '4px',
                    }}
                  >
                    TEMPO
                  </span>
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '18px',
                      color: 'var(--god-primary)',
                      fontWeight: 600,
                      textShadow: '0 0 10px rgba(255, 215, 0, 0.3)',
                    }}
                  >
                    {globalBpm.toFixed(1)}
                  </span>
                  <span
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: '8px',
                      color: 'var(--god-text-dim)',
                      letterSpacing: '0.1em',
                      marginTop: '2px',
                    }}
                  >
                    BPM
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Action Center Drawer Links */}
          <div>
            <h4 className="vg-bloom-section-title">Drawer Triggers</h4>
            <div className="vg-bloom-actions-grid">
              <div
                className={`vg-bloom-action-card ${isSequencerOpen ? 'active' : ''}`}
                onClick={() => {
                  onToggleSequencer();
                  onClose();
                }}
              >
                <span className="vg-bloom-action-card-icon">🎹</span>
                <span className="vg-bloom-action-card-label">SEQUENCER</span>
              </div>

              <div
                className={`vg-bloom-action-card ${isKitBrowserOpen ? 'active' : ''}`}
                onClick={() => {
                  onToggleKitBrowser(true);
                  onClose();
                }}
              >
                <span className="vg-bloom-action-card-icon">📂</span>
                <span className="vg-bloom-action-card-label">KIT LOADER</span>
              </div>

              <div
                className={`vg-bloom-action-card ${isExportOverlayOpen ? 'active' : ''}`}
                onClick={() => {
                  onToggleExportOverlay(true);
                  onClose();
                }}
              >
                <span className="vg-bloom-action-card-icon">📦</span>
                <span className="vg-bloom-action-card-label">EXPORT</span>
              </div>

              <div
                className={`vg-bloom-action-card ${isMidiModalOpen ? 'active' : ''}`}
                onClick={() => {
                  onToggleMidiModal(true);
                  onClose();
                }}
              >
                <span className="vg-bloom-action-card-icon">🎹</span>
                <span className="vg-bloom-action-card-label">MIDI MAP</span>
              </div>

              <div
                className={`vg-bloom-action-card ${showModMatrix ? 'active' : ''}`}
                onClick={() => {
                  onToggleModMatrix(true);
                  onClose();
                }}
              >
                <span className="vg-bloom-action-card-icon">⚡</span>
                <span className="vg-bloom-action-card-label">MOD MATRIX</span>
              </div>

              <div
                className={`vg-bloom-action-card ${isNeuralPanelOpen ? 'active' : ''}`}
                onClick={() => {
                  onToggleNeuralPanel(true);
                  onClose();
                }}
              >
                <span className="vg-bloom-action-card-icon">👁️</span>
                <span className="vg-bloom-action-card-label">THIRD EYE</span>
              </div>

              <div
                className={`vg-bloom-action-card ${isSettingsOpen ? 'active' : ''}`}
                onClick={() => {
                  onToggleSettings(true);
                  onClose();
                }}
              >
                <Settings size={18} className="vg-bloom-action-card-icon" />
                <span className="vg-bloom-action-card-label">SETTINGS</span>
              </div>

              <div
                className="vg-bloom-action-card"
                onClick={() => {
                  if (isSyncing) return;
                  onCloudBackup();
                  onClose();
                }}
                style={{ opacity: isSyncing ? 0.5 : 1, pointerEvents: isSyncing ? 'none' : 'auto' }}
              >
                <span className="vg-bloom-action-card-icon">☁️</span>
                <span className="vg-bloom-action-card-label">BACKUP</span>
              </div>

              <div
                className="vg-bloom-action-card"
                onClick={() => {
                  if (isSyncing) return;
                  onCloudRestore();
                  onClose();
                }}
                style={{ opacity: isSyncing ? 0.5 : 1, pointerEvents: isSyncing ? 'none' : 'auto' }}
              >
                <span className="vg-bloom-action-card-icon">📥</span>
                <span className="vg-bloom-action-card-label">RESTORE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SYSTEM TELEMETRY FOOTER ─── */}
      <footer className="vg-bloom-telemetry-box">
        <div className="vg-bloom-telemetry-item">
          <span className="vg-bloom-telemetry-dot" />
          <span>ANTIGRAVITY_CORE::ACTIVE</span>
          <span>•</span>
          <span>44.1KHZ / 512SMP</span>
          <span>•</span>
          <span>FOCUS_MODE::ENABLED</span>
        </div>
        <div className="vg-bloom-telemetry-item" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <span>THE GOD REALM V1.0.0</span>
        </div>
      </footer>
    </motion.div>
  );
};
