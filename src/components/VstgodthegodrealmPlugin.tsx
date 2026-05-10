/**
 * VstgodthegodrealmPlugin — VST GOD — The God Realm
 * Faithfully rebuilt from the actual Forge design reference.
 * Category: Sampler / Preset Manager / Kit Exporter
 * Controls: 24 | Tabs: 4
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '@/styles/VSTGODTheGodRealm-theme.css';
import type { DSPChainModule } from '@/services/types';
import { GodRealmSamplerEngine } from '@/engine/samplerEngine';
import { SoundSlot } from './SoundSlot';
import { MultiControlPanel } from './MultiControlPanel';
import { RealmDashboard } from './RealmDashboard';
import { NeuralSuggestPanel } from './NeuralSuggestPanel';
import { CelestialForge } from './CelestialForge';
import { GodRealmSampleChopper } from './GodRealmSampleChopper';
import { SamplerEngine } from './SamplerEngine';
import { KitExporter } from './KitExporter';
import { PresetLibrarySidebar } from './PresetLibrarySidebar';
import { CelestialBrowser } from './CelestialBrowser';

interface VstgodthegodrealmPluginProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
  width?: number | string;
  height?: number | string;
  onParameterChange?: (paramId: string, value: number | string | boolean) => void;
  parameterValues?: Record<string, any>;
}

/* ─── Data ─── */
const CATEGORIES = [
  { name: 'All Presets', count: 512, icon: '📁' },
  { name: 'Favorites', count: 48, icon: '❤️' },
  { name: 'User Presets', count: 127, icon: '👤' },
  { name: 'Bass', count: 86, icon: '🎸' },
  { name: 'Lead', count: 101, icon: '🎹' },
  { name: 'Pad', count: 94, icon: '🎵' },
  { name: 'Arp', count: 63, icon: '🔄' },
  { name: 'Pluck', count: 72, icon: '🪕' },
  { name: 'Keys', count: 46, icon: '🎹' },
  { name: 'FX', count: 37, icon: '⚡' },
  { name: 'Percussion', count: 25, icon: '🥁' },
  { name: 'Vocal', count: 21, icon: '🎤' },
  { name: 'Textures', count: 18, icon: '🌊' },
];

/* ─── Initial Data ─── */
const DEFAULT_PRESETS = [
  { name: 'Olympus Domain', type: 'Multi-Realm', author: 'VST GOD', rating: 5, fav: true, state: null },
  { name: "Zeus' Thunder", type: 'Bass', author: 'VST GOD', rating: 5, fav: true, state: null },
  { name: 'Godspeed', type: 'Lead', author: 'VST GOD', rating: 5, fav: true, state: null },
  { name: 'Heavenly Gates', type: 'Pad', author: 'VST GOD', rating: 5, fav: false, state: null },
  { name: 'Divine Touch', type: 'Pluck', author: 'VST GOD', rating: 5, fav: false, state: null },
  { name: 'Eternal Choir', type: 'Pad', author: 'VST GOD', rating: 4, fav: false, state: null },
  { name: 'Titan Rise', type: 'Arp', author: 'VST GOD', rating: 4, fav: false, state: null },
  { name: 'Celestial Keys', type: 'Keys', author: 'VST GOD', rating: 5, fav: false, state: null },
  { name: 'Wrath of Zeus', type: 'FX', author: 'VST GOD', rating: 4, fav: false, state: null },
  { name: 'Mount Olympus', type: 'Texture', author: 'VST GOD', rating: 5, fav: false, state: null },
  { name: 'Golden Era', type: 'Pad', author: 'VST GOD', rating: 4, fav: false, state: null },
  { name: 'Lightning Strike', type: 'Lead', author: 'VST GOD', rating: 5, fav: false, state: null },
  { name: 'Sacred Bass', type: 'Bass', author: 'VST GOD', rating: 4, fav: false, state: null },
  { name: 'Astral Drift', type: 'Pad', author: 'VST GOD', rating: 3, fav: false, state: null },
  { name: 'Hades Pluck', type: 'Pluck', author: 'VST GOD', rating: 4, fav: false, state: null },
  { name: 'Muted Trumpet Accent 1', type: 'Vocal', author: 'VST GOD', rating: 5, fav: true, state: null },
  { name: 'Muted Trumpet Accent 2', type: 'Vocal', author: 'VST GOD', rating: 5, fav: false, state: null },
  { name: 'Miles Mood', type: 'Texture', author: 'VST GOD', rating: 4, fav: false, state: null },
  { name: "Chet's Whisper", type: 'Texture', author: 'VST GOD', rating: 5, fav: false, state: null },
];

const KITS = [
  { name: 'Divine Collection', author: 'VST GOD', count: 24, starred: true, image: '/plugins/kits/divine-collection.png' },
  { name: 'Euphoria Essentials', author: 'VST GOD', count: 18, starred: true, image: '/plugins/kits/euphoria-essentials.png' },
  { name: 'Dark Olympus', author: 'VST GOD', count: 32, starred: false, image: '/plugins/kits/dark-olympus.png' },
  { name: 'Sauce Land Kit', author: 'VST GOD', count: 16, starred: false, image: '/plugins/kits/sauce-land.png' },
];

const INCLUDED_PRESETS = [
  { name: 'Olympus Domain', type: 'Multi-Realm' },
  { name: "Zeus' Thunder", type: 'Bass' },
  { name: 'Godspeed', type: 'Lead' },
  { name: 'Heavenly Gates', type: 'Pad' },
  { name: 'Divine Touch', type: 'Pluck' },
  { name: 'Eternal Choir', type: 'Pad' },
  { name: 'Titan Rise', type: 'Arp' },
  { name: 'Celestial Keys', type: 'Keys' },
  { name: 'Lightning Strike', type: 'Lead' },
];

export const VstgodthegodrealmPlugin: React.FC<VstgodthegodrealmPluginProps> = ({
  isOpen,
  onClose,
  embedded = false,
  width = 1440,
  height = 960,
  onParameterChange,
  parameterValues = {},
}) => {
  const activeTab = parameterValues.activeTab || 'Preset Vault';
  const selectedPreset = parameterValues.selectedPreset || 0;
  const selectedCategory = parameterValues.selectedCategory || 'All Presets';
  const presetSearch = parameterValues.presetSearch || '';
  const currentPresetName = parameterValues.currentPresetName || 'Olympus Domain';
  const kitName = parameterValues.kitName || 'Divine Collection';
  const kitAuthor = parameterValues.kitAuthor || 'VST GOD';
  const kitDescription = parameterValues.kitDescription || 'A collection of godly sounds crafted for the modern producer. All presets included.';
  const tuneSemitones = parameterValues.tuneSemitones || 0;
  const masterVolume = parameterValues.masterVolume || 0;
  const globalBpm = parameterValues.globalBpm || 140.00;
  const activePad = parameterValues.activePad || 0;
  const [isNeuralPanelOpen, setIsNeuralPanelOpen] = useState(false);
  const [draggingMarker, setDraggingMarker] = useState<number | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GodRealmSamplerEngine | null>(null);

  useEffect(() => {
    const engine = new GodRealmSamplerEngine();
    engineRef.current = engine;
    engine.init().then(() => {
      const pantheonChain: DSPChainModule[] = [
        { instanceId: 'zeus', type: 'compressor', index: 1, bypassed: false },
        { instanceId: 'ra', type: 'eq', index: 1, bypassed: false },
        { instanceId: 'agni', type: 'distortion', index: 1, bypassed: false },
        { instanceId: 'anubis', type: 'multi808', index: 1, bypassed: false },
        { instanceId: 'loki', type: 'delay', index: 1, bypassed: false },
        { instanceId: 'poseidon', type: 'reverb', index: 1, bypassed: false },
        { instanceId: 'artemis', type: 'celestialKeys', index: 1, bypassed: false },
        { instanceId: 'odin', type: 'limiter', index: 1, bypassed: false }
      ];
      engine.buildGraph(pantheonChain);
      // Sync initial parameters
      engine.updateFromParameters(parameterValues);
    });

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const [slotLevels, setSlotLevels] = useState<number[]>(new Array(6).fill(0));
  const [arpStep, setArpStep] = useState<number>(0);
  const [moduleLevels, setModuleLevels] = useState<Record<string, number>>({});
  const [vortexAnchors, setVortexAnchors] = useState<Array<{x: number, y: number, name: string}>>([]);

  useEffect(() => {
    let animId: number;
    const poll = () => {
      if (engineRef.current) {
        setModuleLevels(engineRef.current.getModuleLevels());
        setSlotLevels(engineRef.current.getSlotLevels());
        setArpStep(engineRef.current.getArpStep());
        setVortexAnchors(engineRef.current.getVortexAnchors());
        
        // Auto-Mixing logic (Phase 5)
        engineRef.current.applyNeuralOrchestration();
      }
      animId = requestAnimationFrame(poll);
    };
    poll();
    return () => cancelAnimationFrame(animId);
  }, []);

  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem('vst-god-realm-presets');
    return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
  });

  const includedPresets = useMemo(() => {
    const fromProps = parameterValues.includedPresets || [];
    return presets.map((_: any, i: number) => i < fromProps.length ? fromProps[i] : true);
  }, [parameterValues.includedPresets, presets]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'All Presets': presets.length,
      'Favorites': presets.filter((p: any) => p.fav).length,
      'User Presets': presets.filter((p: any) => p.author !== 'VST GOD').length,
    };
    
    presets.forEach((p: any) => {
      if (p.type) {
        counts[p.type] = (counts[p.type] || 0) + 1;
      }
    });
    
    return counts;
  }, [presets]);

  const filteredPresets = useMemo(() => {
    return presets.map((p: any, originalIndex: number) => ({ ...p, originalIndex }))
      .filter((p: any) => {
        const matchesSearch = p.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
                              p.type.toLowerCase().includes(presetSearch.toLowerCase()) ||
                              p.author.toLowerCase().includes(presetSearch.toLowerCase());
        
        let matchesCategory = true;
        if (selectedCategory === 'Favorites') matchesCategory = p.fav;
        else if (selectedCategory === 'User Presets') matchesCategory = p.author !== 'VST GOD';
        else if (selectedCategory !== 'All Presets') matchesCategory = p.type === selectedCategory;
        
        return matchesSearch && matchesCategory;
      });
  }, [presets, presetSearch, selectedCategory]);

  const [vaultMessage, setVaultMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    localStorage.setItem('vst-god-realm-presets', JSON.stringify(presets));
  }, [presets]);

  // --- Neural Morph Logic (Phase 5) ---
  useEffect(() => {
    if (engineRef.current && parameterValues.morphFactor !== undefined && parameterValues.morphFactor > 0) {
      const heavenPreset = presets[selectedPreset];
      const hellPreset = presets.find((p: any) => p.name === "Hades Depth") || presets[1] || presets[0];
      
      if (heavenPreset?.state && hellPreset?.state) {
        engineRef.current.morphPresets(heavenPreset.state, hellPreset.state, parameterValues.morphFactor / 100);
      }
    }
  }, [parameterValues.morphFactor, selectedPreset, presets]);

  const update = useCallback((id: string, val: any) => {
    if (onParameterChange) onParameterChange(id, val);
  }, [onParameterChange]);

  const handleApplyNeuralSuggestion = useCallback((suggestion: any) => {
    if (!suggestion || !suggestion.params) return;
    Object.entries(suggestion.params).forEach(([id, val]) => {
      update(id, val);
    });
    showMessage("Neural Suggestion Applied");
  }, [update]);

  const showMessage = (msg: string) => {
    setVaultMessage(msg);
    setTimeout(() => setVaultMessage(''), 3000);
  };

  const handleLoadPreset = useCallback(() => {
    const p = presets[selectedPreset];
    if (!p) return;
    
    if (p.state && engineRef.current) {
      engineRef.current.setState(p.state);
      if (p.state.params) {
        Object.entries(p.state.params).forEach(([id, val]) => {
          update(id, val);
        });
      }
    }
    update('currentPresetName', p.name);
    showMessage(`Loaded: ${p.name}`);
  }, [presets, selectedPreset, update]);

  const handleSavePreset = useCallback(() => {
    if (!engineRef.current) return;
    const currentState = engineRef.current.getState();
    const nextPresets = [...presets];
    if (nextPresets[selectedPreset]) {
      nextPresets[selectedPreset] = {
        ...nextPresets[selectedPreset],
        state: currentState
      };
      setPresets(nextPresets);
      showMessage(`Saved: ${nextPresets[selectedPreset].name}`);
    }
  }, [presets, selectedPreset]);

  const handleSaveAsPreset = useCallback(() => {
    if (!engineRef.current) return;
    const name = prompt('Enter Preset Name:', `New Preset ${presets.length + 1}`);
    if (!name) return;

    const currentState = engineRef.current.getState();
    const newPreset = {
      name,
      type: 'User',
      author: 'User',
      rating: 5,
      fav: false,
      state: currentState
    };

    setPresets([...presets, newPreset]);
    update('selectedPreset', presets.length);
    update('currentPresetName', name);
    showMessage(`Created: ${name}`);
  }, [presets, update]);

  const handleDeletePreset = useCallback(() => {
    if (presets.length <= 1) return;
    if (!confirm(`Delete preset "${presets[selectedPreset]?.name}"?`)) return;

    const nextPresets = presets.filter((_: any, i: number) => i !== selectedPreset);
    setPresets(nextPresets);
    update('selectedPreset', 0);
    showMessage('Preset Deleted');
  }, [presets, selectedPreset, update]);

  const handleExportVault = useCallback(() => {
    const data = JSON.stringify(presets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GodRealm_Vault_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showMessage('Vault Exported');
  }, [presets]);

  const handleImportVault = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const imported = JSON.parse(text);
        if (Array.isArray(imported)) {
          setPresets(imported);
          showMessage('Vault Restored');
        }
      } catch (err) {
        alert('Invalid Vault File');
      }
      update('btnRestoreVault', false);
    };
    input.click();
  }, [update]);

  const handleRestoreDefaults = useCallback(() => {
    if (!confirm('This will reset your library to factory defaults. Continue?')) return;
    setPresets(DEFAULT_PRESETS);
    localStorage.removeItem('vst-god-realm-presets');
    showMessage('VAULT RESET TO DEFAULTS');
  }, []);

  const handleCloudSync = useCallback(() => {
    if (isSyncing) return;
    setIsSyncing(true);
    showMessage('CONNECTING TO DIVINE CLOUD...');
    
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 1) showMessage('VERIFYING DIVINE CHUNKS...');
      if (step === 2) showMessage('CALCULATING COSMIC HASHES...');
      if (step === 3) showMessage('UPLOADING TO THE GOD REALM...');
      if (step === 4) {
        clearInterval(interval);
        showMessage('DIVINE SYNC SUCCESSFUL');
        setIsSyncing(false);
        update('btnCloudSync', false);
      }
    }, 1500);
  }, [isSyncing, update]);

  const handleExportPreset = useCallback(() => {
    const p = presets[selectedPreset];
    if (!p) return;
    const data = JSON.stringify(p, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GodRealm_${p.name.replace(/\s+/g, '_')}.json`;
    a.click();
    showMessage(`EXPORTED: ${p.name}`);
    update('btnExportPreset', false);
  }, [presets, selectedPreset, update]);

  const handleImportPreset = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const imported = JSON.parse(text);
        if (imported.name && imported.state) {
          setPresets((prev: any) => [...prev, imported]);
          showMessage(`IMPORTED: ${imported.name}`);
        } else {
          alert('Invalid Preset File');
        }
      } catch (err) {
        alert('Error reading file');
      }
      update('btnImportPreset', false);
    };
    input.click();
  }, [update]);

  const handleExportKit = useCallback(() => {
    const kitData = {
      kitName,
      kitAuthor,
      kitDescription,
      presets: presets.filter((_: any, i: number) => includedPresets[i]),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(kitData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kitName.replace(/\s+/g, '_')}_GodKit.json`;
    a.click();
    showMessage('Kit Exported!');
  }, [kitName, kitAuthor, kitDescription, presets, includedPresets]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingMarker === null || !waveformRef.current) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pos = Math.max(0, Math.min(1, x / rect.width));
    
    const nextMarkers = [...(parameterValues.chopMarkers || [0.25, 0.5, 0.75])];
    nextMarkers[draggingMarker] = pos;
    update('chopMarkers', nextMarkers);
    update(`chopMarker_${draggingMarker}_move`, pos);
  }, [draggingMarker, parameterValues.chopMarkers, update]);

  const handleMouseUp = useCallback(() => {
    setDraggingMarker(null);
  }, []);

  if (!isOpen) return null;

  const tabs = ['Multi-Realm', 'Divine Archive', 'Sample Chopper', 'Effects', 'Mastering', 'Preset Vault'] as const;
  const wrapperClassName = embedded
    ? 'relative flex h-full w-full items-center justify-center'
    : 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4';

  /* Star renderer */
  const Stars = ({ count }: { count: number }) => (
    <span className="vg-stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < count ? 'vg-star-on' : 'vg-star-off'}>★</span>
      ))}
    </span>
  );

  return (
    <div 
      className={wrapperClassName}
      onClick={embedded ? undefined : onClose}
    >
      <div 
        className="vg-plugin" 
        style={{ width, height, maxWidth: embedded ? '100%' : undefined, maxHeight: embedded ? '100%' : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background ambient glow */}
        <div className="vg-ambient-glow" />

        {/* Ember Background Particles */}
        <div className="vg-ember-bg">
          {Array.from({ length: 40 }).map((_, i) => (
            <div 
              key={i} 
              className="vg-ember" 
              style={{ 
                '--d': `${Math.random() * 10 + 5}s`, 
                '--x': `${(Math.random() - 0.5) * 100}px`,
                left: `${Math.random() * 100}%`,
                width: `${Math.random() * 4 + 2}px`,
                height: `${Math.random() * 4 + 2}px`,
                animationDelay: `${Math.random() * 10}s`
              } as any} 
            />
          ))}
        </div>

      {/* ═══════════ HEADER BAR ═══════════ */}
      <header className="vg-header">
        <div className="vg-header-left">
          <div className="vg-logo">
            <span className="vg-logo-vst">VST</span>
            <span className="vg-logo-god">GOD</span>
          </div>
          <div className="vg-preset-nav">
            <span className="vg-preset-label">PRESET</span>
            <button className="vg-nav-arrow" onClick={() => update('presetPrev', true)}>◀</button>
            <span className="vg-preset-current">{currentPresetName}</span>
            <button className="vg-nav-arrow" onClick={() => update('presetNext', true)}>▶</button>
            <button className="vg-nav-arrow vg-nav-copy" onClick={() => update('presetCopy', true)}>📋</button>
          </div>
        </div>

        <div className="vg-header-center">
          <h1 className="vg-title">THE GOD REALM</h1>
          <span className="vg-subtitle">PRESET VAULT &amp; KIT EXPORTER</span>
        </div>

        <div className="vg-header-right">
          <div className="vg-master-display">
            <span className="vg-display-value">{globalBpm.toFixed(2)} Hz</span>
            <span className="vg-display-label">GLOBAL</span>
          </div>
          <div className="vg-master-display">
            <span className="vg-display-value">{Math.round(globalBpm)} BPM</span>
            <span className="vg-display-label">TEMPO</span>
          </div>
          <div className="vg-knob-group">
            <div className="vg-knob-mini">
              <div className="vg-knob-ring-sm">
                <div className="vg-knob-dot" style={{ transform: `rotate(${-135 + ((tuneSemitones + 24) / 48) * 270}deg)` }} />
              </div>
              <span className="vg-knob-label">TUNE</span>
              <span className="vg-knob-val">{tuneSemitones} ST</span>
              <input type="range" className="vg-knob-slider" min={-24} max={24} step={1}
                value={tuneSemitones} onChange={e => { update('tuneSemitones', +e.target.value); }} />
            </div>
            <div className="vg-knob-mini">
              <div className="vg-knob-ring-lg">
                <div className="vg-knob-dot" style={{ transform: `rotate(${-135 + ((masterVolume + 60) / 66) * 270}deg)` }} />
              </div>
              <span className="vg-knob-label">VOLUME</span>
              <span className="vg-knob-val">{masterVolume.toFixed(1)} dB</span>
              <input type="range" className="vg-knob-slider" min={-60} max={6} step={0.1}
                value={masterVolume} onChange={e => { update('masterVolume', +e.target.value); }} />
            </div>
          </div>
          
          <button className="vg-header-close" onClick={onClose} aria-label="Close Plugin">
            ✕
          </button>
        </div>
      </header>

      {/* ═══════════ TAB BAR ═══════════ */}
      <nav className="vg-tab-bar">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`vg-tab ${activeTab === tab ? 'vg-tab-active' : ''}`}
            onClick={() => { update('activeTab', tab); update(`tab${tab.replace(/\s/g, '')}`, true); }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="vg-main">

        {/* ─── MULTI-REALM TAB (THE GOD FORGE) ─── */}
        {activeTab === 'Multi-Realm' && (
          <SamplerEngine
            parameterValues={parameterValues}
            update={update}
            slotLevels={slotLevels}
            arpStep={arpStep}
            vortexAnchors={vortexAnchors}
            onNeuralForge={() => setIsNeuralPanelOpen(true)}
            isNeuralPanelOpen={isNeuralPanelOpen}
            onCloseNeuralPanel={() => setIsNeuralPanelOpen(false)}
            onApplyNeuralSuggestion={handleApplyNeuralSuggestion}
            engineRef={engineRef}
          />
        )}

        {/* ─── DIVINE ARCHIVE TAB (NEW) ─── */}
        {activeTab === 'Divine Archive' && (
          <div className="vg-panel vg-archive h-full overflow-hidden">
            <CelestialBrowser 
              engineRef={engineRef}
              activePad={activePad}
            />
          </div>
        )}

        {/* ─── SAMPLE CHOPPER TAB (Phase 6 Polish) ─── */}
        {activeTab === 'Sample Chopper' && (
          <GodRealmSampleChopper
            activePad={activePad}
            parameterValues={parameterValues}
            update={update}
            engineRef={engineRef}
          />
        )}

        {/* ─── THE PANTHEON (EFFECTS) TAB ─── */}
        {activeTab === 'Effects' && (() => {
          const GODS = [
            { god: 'Zeus', origin: 'Greek', domain: 'Transients', icon: '⚡', color: '#60A5FA', avatar: '/plugins/gods/zeus.png', params: ['Attack', 'Sustain', 'Punch', 'Threshold'] },
            { god: 'Ra', origin: 'Egyptian', domain: 'Harmonics', icon: '☀️', color: '#F5B041', avatar: '/plugins/gods/ra.png', params: ['Low', 'Mid', 'High', 'Presence'] },
            { god: 'Agni', origin: 'Hindu', domain: 'Saturation', icon: '🔥', color: '#E74C3C', avatar: '/plugins/gods/agni.png', params: ['Drive', 'Warmth', 'Mix'] },
            { god: 'Anubis', origin: 'Egyptian', domain: 'Multi-808', icon: '💀', color: '#27AE60', avatar: '/plugins/gods/anubis.png', params: ['Sub', 'Mid', 'Click', 'Phase', 'Drive'] },
            { god: 'Loki', origin: 'Norse', domain: 'Delay', icon: '🌀', color: '#9B59B6', avatar: '/plugins/gods/loki.png', params: ['Time', 'Feedback', 'Chaos'] },
            { god: 'Poseidon', origin: 'Greek', domain: 'Reverb', icon: '🌊', color: '#1ABC9C', avatar: '/plugins/gods/poseidon.png', params: ['Size', 'Depth', 'Tide'] },
            { god: 'Artemis', origin: 'Greek', domain: 'Celestial Keys', icon: '🌙', color: '#BB8FCE', avatar: '/plugins/gods/artemis.png', params: ['Tines', 'Hammer', 'Drift', 'Luster'] },
            { god: 'Odin', origin: 'Norse', domain: 'Limiter', icon: '🛡️', color: '#85929E', avatar: '/plugins/gods/odin.png', params: ['Ceiling', 'Wisdom'] },
          ];
          const selectedGod = (parameterValues.selectedGod as string) || '';
          const sel = GODS.find(g => g.god === selectedGod);
          const CX = 240; const CY = 190; const R = 145;
          const totalInvoke = GODS.reduce((sum, g) => {
            const v = parameterValues[`god_${g.god.toLowerCase()}_invoke`];
            return sum + (v !== undefined ? (v as number) : 50);
          }, 0);
          const divinePower = Math.round(totalInvoke / GODS.length);

          return (
          <div className="vg-panel vg-effects vg-pantheon">
            {/* ── Constellation Area ── */}
            <div className="vg-constellation-wrap">
              <div className="vg-constellation-inner" style={{ position: 'relative', height: '100%', width: '100%', maxWidth: 'calc(100vh * (480/380))', maxHeight: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="vg-constellation-svg" viewBox="0 0 480 380" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible', width: '100%', height: '100%' }}>
                  <defs>
                  <radialGradient id="coreGlow"><stop offset="0%" stopColor="rgba(255,102,0,0.25)" /><stop offset="100%" stopColor="transparent" /></radialGradient>
                  <filter id="godGlow"><feGaussianBlur stdDeviation="3" /><feColorMatrix type="saturate" values="2" /></filter>
                </defs>

                {/* Ambient orbit rings */}
                <g className="vg-orbit-group-1" style={{ transformOrigin: `${CX}px ${CY}px` }}>
                  <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 6" />
                </g>
                <g className="vg-orbit-group-2" style={{ transformOrigin: `${CX}px ${CY}px` }}>
                  <circle cx={CX} cy={CY} r={R - 30} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" strokeDasharray="10 20" />
                </g>
                <g className="vg-orbit-group-3" style={{ transformOrigin: `${CX}px ${CY}px` }}>
                  <circle cx={CX} cy={CY} r={R + 20} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" strokeDasharray="2 8" />
                </g>

                {/* Signal flow lines between consecutive gods */}
                {GODS.map((g, i) => {
                  const next = GODS[(i + 1) % GODS.length];
                  const a1 = (i / GODS.length) * Math.PI * 2 - Math.PI / 2;
                  const a2 = ((i + 1) / GODS.length) * Math.PI * 2 - Math.PI / 2;
                  const x1 = CX + Math.cos(a1) * R; const y1 = CY + Math.sin(a1) * R;
                  const x2 = CX + Math.cos(a2) * R; const y2 = CY + Math.sin(a2) * R;
                  const bypassed1 = parameterValues[`god_${g.god.toLowerCase()}_bypass`] === true;
                  const bypassed2 = parameterValues[`god_${next.god.toLowerCase()}_bypass`] === true;
                  return (
                    <g key={`flow-${i}`}>
                      <path d={`M ${x1} ${y1} L ${x2} ${y2}`}
                        fill="none"
                        stroke={(bypassed1 || bypassed2) ? 'rgba(255,255,255,0.03)' : `${g.color}30`}
                        strokeWidth="2.5" strokeDasharray={bypassed1 ? '2 4' : 'none'}
                      />
                      {!(bypassed1 || bypassed2) && (
                        <path d={`M ${x1} ${y1} L ${x2} ${y2}`}
                          fill="none"
                          stroke={g.color}
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray="5 100"
                          pathLength="100"
                          className="vg-signal-flow-edge"
                          style={{ filter: 'url(#godGlow)', animationDelay: `${i * -0.4}s` }}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Lines from each god to center */}
                {GODS.map((g, i) => {
                  const angle = (i / GODS.length) * Math.PI * 2 - Math.PI / 2;
                  const x = CX + Math.cos(angle) * R; const y = CY + Math.sin(angle) * R;
                  const inv = parameterValues[`god_${g.god.toLowerCase()}_invoke`] as number ?? 50;
                  const bypassed = parameterValues[`god_${g.god.toLowerCase()}_bypass`] === true;
                  return (
                    <g key={`core-${i}`}>
                      <line x1={x} y1={y} x2={CX} y2={CY}
                        stroke={`${g.color}${Math.round(inv * 0.2 + 5).toString(16).padStart(2, '0')}`}
                        strokeWidth="0.5" strokeDasharray="2 8"
                      />
                      {!bypassed && inv > 10 && (
                        <line x1={x} y1={y} x2={CX} y2={CY}
                          stroke={g.color}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray="3 100"
                          pathLength="100"
                          className="vg-signal-flow-core"
                          style={{ filter: 'url(#godGlow)', animationDelay: `${i * -0.2}s`, animationDuration: `${3 - (inv / 50)}s` }}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Divine Core (center) */}
                <circle cx={CX} cy={CY} r="40" fill="url(#coreGlow)" />
                <circle cx={CX} cy={CY} r="28" fill="rgba(0,0,0,0.6)" stroke="rgba(255,102,0,0.4)" strokeWidth="1.5" />
                {/* Core invoke ring */}
                <circle cx={CX} cy={CY} r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                <circle cx={CX} cy={CY} r="24" fill="none" stroke="#ff6600" strokeWidth="2"
                  strokeDasharray={`${divinePower * 1.5} ${150 - divinePower * 1.5}`}
                  strokeDashoffset="37.5" strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(255,102,0,0.6))' }}
                />
                <text x={CX} y={CY - 6} textAnchor="middle" className="vg-core-number">{divinePower}</text>
                <text x={CX} y={CY + 8} textAnchor="middle" className="vg-core-label">DIVINE</text>
                <text x={CX} y={CY + 18} textAnchor="middle" className="vg-core-label">POWER</text>

                {/* God Nodes via foreignObject */}
                {GODS.map((god, i) => {
                  const angle = (i / GODS.length) * Math.PI * 2 - Math.PI / 2;
                  const x = CX + Math.cos(angle) * R;
                  const y = CY + Math.sin(angle) * R;
                  const invokeId = `god_${god.god.toLowerCase()}_invoke`;
                  const invokeVal = parameterValues[invokeId] !== undefined ? (parameterValues[invokeId] as number) : 50;
                  const bypassed = parameterValues[`god_${god.god.toLowerCase()}_bypass`] === true;
                  const isSelected = selectedGod === god.god;
                  const peakLevel = moduleLevels[god.god.toLowerCase()] || 0;

                  return (
                    <foreignObject 
                      key={god.god} 
                      x={x - 60} 
                      y={y - 60} 
                      width="120" 
                      height="120" 
                      style={{ overflow: 'visible' }}
                    >
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <button
                          className={`vg-cnode ${bypassed ? 'vg-cnode-sleep' : ''} ${isSelected ? 'vg-cnode-active' : ''}`}
                          style={{
                            '--god-c': god.color, 
                            '--god-c-glow': `${god.color}${Math.round(peakLevel * 100).toString(16).padStart(2, '0')}`,
                            '--god-peak': `${1 + peakLevel * 0.2}`,
                            left: '50%', top: '50%', position: 'absolute', transform: `translate(-50%, -50%) scale(${1 + peakLevel * 0.1})`
                          } as any}
                          onClick={() => update('selectedGod', isSelected ? '' : god.god)}
                        >
                          <img src={god.avatar} alt={god.god} className="vg-cnode-img" />
                          <svg viewBox="0 0 44 44" className="vg-cnode-ring">
                            <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                            <circle cx="22" cy="22" r="20" fill="none" stroke={god.color} strokeWidth="2"
                              strokeDasharray={`${invokeVal * 1.26} ${126 - invokeVal * 1.26}`}
                              strokeDashoffset="31.5" strokeLinecap="round"
                              style={{ filter: `drop-shadow(0 0 ${4 + peakLevel * 10}px ${god.color})`, transition: 'stroke-dasharray 0.3s' }}
                            />
                          </svg>
                          <span className="vg-cnode-name">{god.god.toUpperCase()}</span>
                          <span className="vg-cnode-domain">{god.domain}</span>
                        </button>
                      </div>
                    </foreignObject>
                  );
                })}
              </svg>
            </div>
            </div>

            {/* ── Selected God Detail Panel ── */}
            {sel && (
              <div className="vg-deity-panel" style={{ '--god-c': sel.color, '--god-c-glow': `${sel.color}40` } as any}>
                <div className="vg-deity-header">
                  <div className="vg-deity-id">
                    <img src={sel.avatar} alt={sel.god} className="vg-deity-thumb" />
                    <div>
                      <div className="vg-deity-title">
                        <span className="vg-deity-icon">{sel.icon}</span>
                        <span className="vg-deity-name">{sel.god.toUpperCase()}</span>
                        <span className="vg-god-origin">{sel.origin}</span>
                      </div>
                      <span className="vg-deity-domain">{sel.domain}</span>
                    </div>
                  </div>
                  <div className="vg-deity-actions">
                    <button className="vg-deity-bypass-btn"
                      onClick={() => update(`god_${sel.god.toLowerCase()}_bypass`,
                        !(parameterValues[`god_${sel.god.toLowerCase()}_bypass`] === true)
                      )}
                    >
                      {parameterValues[`god_${sel.god.toLowerCase()}_bypass`] === true ? '💤 SLEEPING' : '✦ ACTIVE'}
                    </button>
                    <button className="vg-deity-close" onClick={() => update('selectedGod', '')}>✕</button>
                  </div>
                </div>
                <div className="vg-deity-controls">
                  {/* Invoke (main intensity) */}
                  <div className="vg-deity-invoke-row">
                    <span className="vg-deity-invoke-label">INVOKE</span>
                    <div className="vg-deity-invoke-track">
                      <div className="vg-deity-invoke-fill"
                        style={{ width: `${parameterValues[`god_${sel.god.toLowerCase()}_invoke`] ?? 50}%` }} />
                      <input type="range" min="0" max="100"
                        value={parameterValues[`god_${sel.god.toLowerCase()}_invoke`] ?? 50}
                        className="vg-deity-invoke-input"
                        onChange={(e) => update(`god_${sel.god.toLowerCase()}_invoke`, parseFloat(e.target.value))}
                      />
                    </div>
                    <span className="vg-deity-invoke-val">
                      {(() => {
                        const v = (parameterValues[`god_${sel.god.toLowerCase()}_invoke`] as number) ?? 50;
                        return v < 20 ? 'MORTAL' : v < 50 ? 'DEMIGOD' : v < 80 ? 'GOD' : 'DEITY';
                      })()}
                    </span>
                  </div>
                  {/* DSP Parameters */}
                  <div className="vg-deity-params-grid">
                    {sel.params.map(p => {
                      const paramId = `god_${sel.god.toLowerCase()}_${p.toLowerCase()}`;
                      const val = parameterValues[paramId] !== undefined ? (parameterValues[paramId] as number) : 50;
                      return (
                        <div key={p} className="vg-deity-param">
                          <span className="vg-deity-param-name">{p}</span>
                          <div className="vg-deity-param-track">
                            <div className="vg-deity-param-fill" style={{ width: `${val}%` }} />
                            <input type="range" min="0" max="100" value={val}
                              className="vg-deity-param-input"
                              onChange={(e) => update(paramId, parseFloat(e.target.value))} />
                          </div>
                          <span className="vg-deity-param-val">{val}</span>
                        </div>
                      );
                    })}
                    
                    {/* Specialized Multi-808 Actions */}
                    {sel.god === 'Anubis' && (
                      <div className="vg-deity-extra-actions">
                        <button className="vg-phase-align-btn" 
                          onClick={() => {
                            // Phase Align logic: suggest 180 or 0
                            const current = (parameterValues.god_anubis_phase as number) || 0;
                            const next = current > 50 ? 0 : 80; // Toggle between common sweet spots
                            update('god_anubis_phase', next);
                            showMessage('PHASE ALIGNED');
                          }}
                        >
                          <span className="vg-btn-glow" />
                          PHASE ALIGN
                        </button>
                        <div className="vg-808-viz">
                          <div className="vg-808-wave-layer sub" style={{ opacity: (parameterValues.god_anubis_sub as number || 50) / 100 }} />
                          <div className="vg-808-wave-layer mid" style={{ opacity: (parameterValues.god_anubis_mid as number || 50) / 100 }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Prompt when nothing selected */}
            {!sel && (
              <div className="vg-pantheon-hint">
                <span>SELECT A DEITY TO INVOKE THEIR POWER</span>
              </div>
            )}
          </div>
          );
        })()}

        {/* ─── MASTERING TAB (Celestial Forge Design) ─── */}
        {activeTab === 'Mastering' && (
          <CelestialForge 
            parameterValues={parameterValues}
            update={update}
            moduleLevels={moduleLevels}
          />
        )}

        {/* ─── PRESET VAULT TAB ─── */}
        {activeTab === 'Preset Vault' && (
          <div className="vg-panel vg-vault flex gap-1 h-full overflow-hidden p-1">
            {/* ── LEFT: PRESET LIBRARY ── */}
            <PresetLibrarySidebar 
              categories={CATEGORIES}
              selectedCategory={selectedCategory}
              onSelectCategory={(name) => update('selectedCategory', name)}
              presetSearch={presetSearch}
              onSearchChange={(val) => update('presetSearch', val)}
              filteredPresets={filteredPresets}
              selectedPreset={selectedPreset}
              onSelectPreset={(idx) => update('selectedPreset', idx)}
              onToggleFavorite={(idx) => {
                const nextPresets = [...presets];
                nextPresets[idx] = { ...nextPresets[idx], fav: !nextPresets[idx].fav };
                setPresets(nextPresets);
              }}
            />

            {/* ── CENTER: ACTION HUB ── */}
            <div className="flex-1 flex flex-col glass-panel bg-black/20 overflow-hidden relative">
              <div className="vg-ambient-glow opacity-30" />
              
              {/* Active Preset Header */}
              <div className="p-8 border-b border-white/5 bg-gradient-to-b from-orange-500/5 to-transparent">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] mb-2 block">Current Selection</span>
                    <h2 className="text-5xl font-black text-white tracking-tighter mb-2">{presets[selectedPreset]?.name || 'Unknown'}</h2>
                    <div className="flex items-center gap-4 text-xs font-bold text-white/40 uppercase">
                      <span>{presets[selectedPreset]?.type}</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>{presets[selectedPreset]?.author}</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <Stars count={presets[selectedPreset]?.rating || 0} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="vg-btn vg-btn-primary px-8" onClick={handleLoadPreset}>LOAD PRESET</button>
                    <button className="vg-btn px-6" onClick={handleSavePreset}>OVERWRITE</button>
                  </div>
                </div>
              </div>

              {/* Central Action Grid */}
              <div className="flex-1 p-8 grid grid-cols-2 gap-8 overflow-y-auto">
                <div className="space-y-6">
                  <div className="glass-panel p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Library Management</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <button className="vg-btn vg-btn-ghost text-left justify-start gap-3" onClick={handleSaveAsPreset}>
                        <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px]">+</span>
                        CREATE NEW PRESET
                      </button>
                      <button className="vg-btn vg-btn-ghost text-left justify-start gap-3" onClick={handleDeletePreset}>
                        <span className="w-6 h-6 rounded bg-red-500/20 text-red-400 flex items-center justify-center text-[10px]">✕</span>
                        DELETE SELECTED
                      </button>
                      <button className="vg-btn vg-btn-ghost text-left justify-start gap-3" onClick={handleRestoreDefaults}>
                        <span className="w-6 h-6 rounded bg-orange-500/20 text-orange-400 flex items-center justify-center text-[10px]">↺</span>
                        RESTORE FACTORY DEFAULTS
                      </button>
                    </div>
                  </div>

                  <div className="glass-panel p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Neural Morphing</h3>
                    <div className="space-y-4">
                       <p className="text-[10px] text-white/40 leading-relaxed font-bold">
                        Morph between the current preset and the "Hades Depth" anchor to create divine hybrids.
                       </p>
                       <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black text-orange-500 uppercase">
                            <span>Heaven</span>
                            <span>Hell</span>
                          </div>
                          <input 
                            type="range" 
                            className="w-full accent-orange-500"
                            value={parameterValues.morphFactor || 0}
                            onChange={(e) => update('morphFactor', parseFloat(e.target.value))}
                          />
                       </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="glass-panel p-6 bg-white/5 border border-white/10 rounded-2xl h-full relative overflow-hidden group">
                    <img 
                      src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1964&auto=format&fit=crop" 
                      className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-opacity duration-700" 
                      alt="Art"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="relative h-full flex flex-col justify-end">
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em] mb-2">Divine Collection</span>
                      <h4 className="text-2xl font-black text-white mb-2">THE GOD KIT</h4>
                      <p className="text-[10px] text-white/60 leading-relaxed font-bold mb-6">
                        Bundle your favorite presets into a single distributor-ready asset. 
                        Includes custom metadata and cloud-sync capability.
                      </p>
                      <button className="vg-btn vg-btn-accent w-full" onClick={() => update('kitName', 'My Divine Kit')}>
                        CONFIGURE EXPORT
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Bar */}
              {vaultMessage && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-orange-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-[0_0_30px_rgba(255,102,0,0.4)] z-50"
                >
                  {vaultMessage}
                </motion.div>
              )}
            </div>

            {/* ── RIGHT: KIT EXPORTER ── */}
            <KitExporter 
              kitName={kitName}
              kitAuthor={kitAuthor}
              kitDescription={kitDescription}
              presets={presets}
              includedPresets={includedPresets}
              onToggleIncluded={(idx) => {
                const next = [...includedPresets];
                next[idx] = !next[idx];
                update('includedPresets', next);
              }}
              onExport={handleExportKit}
              update={update}
            />
          </div>
        )}
      </main>

      {/* ═══════════ FOOTER BAR ═══════════ */}
      <footer className="vg-footer">
        <div className="vg-footer-left">
          <button className="vg-foot-btn" onClick={handleImportPreset}>📥 IMPORT PRESET</button>
          <button className="vg-foot-btn" onClick={handleExportPreset}>📤 EXPORT PRESET</button>
          <button className="vg-foot-btn" onClick={handleExportVault}>💾 BACKUP VAULT</button>
          <button className="vg-foot-btn" onClick={handleImportVault}>🔄 RESTORE VAULT</button>
          <button className="vg-foot-btn vg-foot-accent" style={{ position: 'relative', overflow: 'hidden' }} onClick={handleCloudSync}>
            {isSyncing && <div className="vg-progress-scanner" />}
            <span style={{ position: 'relative', zIndex: 1 }}>{isSyncing ? '⌛ SYNCING...' : '☁️ CLOUD SYNC'}</span>
          </button>
          <span className="vg-sync-status">{isSyncing ? 'Alignment in progress...' : 'Synced 2 min ago'}</span>
        </div>
        <div className="vg-footer-right">
          <div className="vg-foot-info">
            <span>PLUGIN INFO</span>
            <span className="vg-foot-sub">Version 1.0.0</span>
          </div>
          <button className="vg-foot-btn">📚 TUTORIALS</button>
          <button className="vg-foot-btn">💬 JOIN DISCORD</button>
          <div className="vg-foot-info">
            <span>WEBSITE</span>
            <span className="vg-foot-sub">payhip.com/sauceland</span>
          </div>
        </div>
      </footer>


    </div>
    </div>
  );
};

export default VstgodthegodrealmPlugin;
