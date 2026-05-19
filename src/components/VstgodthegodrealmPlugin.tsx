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
import { SoundSlot } from './SoundSlot';
import { MultiControlPanel } from './MultiControlPanel';
import { RealmDashboard } from './RealmDashboard';
import { NeuralSuggestPanel } from './NeuralSuggestPanel';
import { CelestialTabs } from './ui/CelestialTabs';
import { GodKnob } from './ui/GodKnob';
import { DivineKnob } from './ui/DivineKnob';
import { DivineSlider } from './ui/DivineSlider';
import { CelestialForge } from './CelestialForge';
import { GodRealmSampleChopper } from './GodRealmSampleChopper';
import { SamplerEngine } from './SamplerEngine';
import { KitExporter } from './KitExporter';
import { PresetLibrarySidebar } from './PresetLibrarySidebar';
import { DivineArchive } from './DivineArchive';
import { SpectralRadarPanner } from './SpectralRadarPanner';
import { NebulaXYPad } from './NebulaXYPad';
import { FluidSlider } from './FluidSlider';
import { SacredSequencer as SacredSequencerV2, useSequencerEngine } from './sequencer';
import { RealmParticleCanvas } from './RealmParticleCanvas';
import { RealmPortalTransition } from './RealmPortalTransition';
import { sampleManager } from './sequencer/SampleManager';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { DivineSpectrometer } from './ui/DivineSpectrometer';
import { SacredGeometryBackground } from './ui/SacredGeometryBackground';
import { HarmonicPantheon } from './HarmonicPantheon';
import { EternalPresetVault } from './EternalPresetVault';
import { RitualOfExport } from './RitualOfExport';
import { ElectricPantheon } from './electricPantheon/ElectricPantheon';
import type { DivineRelic } from '@/archive/divineArchive';
import { useJuceBridge } from '@/hooks/useJuceBridge';
import type { Midi2NoteEvent } from '@/native/bridge';
import { GodRealmSamplerEngine } from '@/services/samplerEngine';
import { neuralInputBus } from '@/services/neuralInputBus';

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

const TABS = [
  { id: 'Multi-Realm', label: 'MULTI-REALM' },
  { id: 'Pantheon', label: 'HARMONIC PANTHEON' },
  { id: 'Sample Chopper', label: 'CHOPPER' },
  { id: 'Divine Archive', label: 'ARCHIVE' },
  { id: 'Sequencer', label: 'SACRED SEQUENCER' },
  { id: 'Mastering', label: 'CELESTIAL FORGE' },
  { id: 'Export', label: 'RITUAL OF EXPORT' },
  { id: 'Preset Vault', label: 'PRESET VAULT' },
  { id: 'Electric Pantheon', label: 'ELECTRIC PANTHEON' },
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

  /* ─── Sequencer Drawer & Export Overlay State ─── */
  const [isSequencerOpen, setIsSequencerOpen] = useState(false);
  const [isExportOverlayOpen, setIsExportOverlayOpen] = useState(false);

  /* ─── Phase 4: Realm Transition State ─── */
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [displayedTab, setDisplayedTab] = useState(activeTab);
  const prevTabRef = useRef(activeTab);

  // Sync displayedTab if activeTab changes externally (e.g. prop-driven)
  useEffect(() => {
    if (!isTransitioning && activeTab !== prevTabRef.current) {
      setDisplayedTab(activeTab);
      prevTabRef.current = activeTab;
    }
  }, [activeTab, isTransitioning]);

  const handleTransitionComplete = useCallback(() => {
    if (pendingTab) {
      setDisplayedTab(pendingTab);
      prevTabRef.current = pendingTab;
    }
    setPendingTab(null);
    setIsTransitioning(false);
  }, [pendingTab]);
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

  /* ─── Phase 5: Oracle’s Vision (Audio Engine) ─── */
  const engine = useSequencerEngine();
  const { masterChain } = engine;
  
  // Connect the analyser to the design system CSS variables
  useAudioAnalyser(masterChain.current?.analyser || null);
  
  const [buffers, setBuffers] = useState<Record<number, AudioBuffer>>({});
  const [isBuffersLoaded, setIsBuffersLoaded] = useState(false);

  /* ─── God Realm Sampler Engine (86KB DSP Powerhouse) ─── */
  const godEngine = useRef<GodRealmSamplerEngine | null>(null);

  // Initialize the engine on mount, populate buffers from its manifest
  useEffect(() => {
    if (isBuffersLoaded) return;

    const boot = async () => {
      try {
        const eng = new GodRealmSamplerEngine();
        await eng.init();
        godEngine.current = eng;

        // Sync the engine's loaded buffers into React state for waveform rendering
        const loadedBuffers: Record<number, AudioBuffer> = {};
        for (let i = 0; i < 16; i++) {
          const buf = eng.getBuffer(i);
          if (buf) loadedBuffers[i] = buf;
        }
        setBuffers(loadedBuffers);
        setIsBuffersLoaded(true);
        console.log('[God Engine] Initialized — %d sacred samples loaded', Object.keys(loadedBuffers).length);
      } catch (err) {
        console.error('[God Engine] Initialization failed, falling back to SampleManager', err);
        // Graceful degradation: fall back to the simpler SampleManager loader
        if (engine.audioCtx.current) {
          try {
            const fallbackBuffers = await sampleManager.loadKit(engine.audioCtx.current);
            setBuffers(fallbackBuffers);
            setIsBuffersLoaded(true);
            console.log('[God Engine] Fallback: SampleManager loaded');
          } catch (fallbackErr) {
            console.error('[God Engine] Fallback also failed', fallbackErr);
          }
        }
      }
    };

    boot();

    return () => {
      if (godEngine.current) {
        godEngine.current.dispose();
        godEngine.current = null;
        console.log('[God Engine] Disposed');
      }
    };
  }, [isBuffersLoaded]);

  /* ─── Neural Input Bus (Keyboard Z-M / MIDI Triggering) ─── */
  useEffect(() => {
    const unsubscribe = neuralInputBus.addListener((event) => {
      const eng = godEngine.current;
      if (!eng) return;

      // Trigger the engine's polyphonic voice system
      eng.playBufferPart(event.target, 0);

      // Visual feedback: update activePad to reflect the triggered pad
      if (onParameterChange) onParameterChange('activePad', event.target);
    });

    return unsubscribe;
  }, [onParameterChange]);
  // ─── JUCE ↔ WebView Bidirectional State Bridge ───
  const bridgeState = useJuceBridge();
  const moduleLevels: Record<string, number> = {};
  const [vortexAnchors, setVortexAnchors] = useState<Array<{x: number, y: number, name: string}>>([]);
  const activeMidiNotes = bridgeState.midiNotes;
  const masterPeak = bridgeState.masterPeak;

  // ─── Live Metering from DSP Engine (rAF loop) ───
  const [liveSlotLevels, setLiveSlotLevels] = useState<number[]>(new Array(16).fill(0));
  const [liveArpStep, setLiveArpStep] = useState<number>(0);
  const meterRafRef = useRef<number | null>(null);

  useEffect(() => {
    const engine = godEngine.current;
    if (!engine) return;

    const tick = () => {
      const levels = engine.getSlotLevels();
      setLiveSlotLevels(levels);
      setLiveArpStep(engine.getArpStep());
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (meterRafRef.current !== null) {
        cancelAnimationFrame(meterRafRef.current);
      }
    };
  }, []);

  // Use live engine data when available, fall back to JUCE bridge
  const slotLevels = liveSlotLevels;
  const arpStep = liveArpStep || bridgeState.arpStep;

  // Derive per-slot MIDI activity: slot i ↔ MIDI channel i
  const midiActivity = useMemo(() => {
    const activity = new Array(6).fill(false);
    for (const note of activeMidiNotes) {
      if (note.channel >= 0 && note.channel < 6 && note.velocity16 > 0) {
        activity[note.channel] = true;
      }
    }
    return activity;
  }, [activeMidiNotes]);


  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem('vst-god-realm-presets');
    const base = saved ? JSON.parse(saved) : DEFAULT_PRESETS;
    // Map to new interface if needed
    return base.map((p: any, i: number) => ({
      ...p,
      id: p.id || `preset-${i}`,
      tags: p.tags || [p.type, 'Sacred', 'Ancient'],
      lastModified: p.lastModified || new Date().toISOString(),
      energyLevel: p.energyLevel || (40 + Math.random() * 60)
    }));
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
    if (parameterValues.morphFactor !== undefined && parameterValues.morphFactor > 0) {
      // Morph logic now handled in JUCE backend
    }
  }, [parameterValues.morphFactor, selectedPreset, presets]);

  const update = useCallback((id: string, val: any) => {
    if (onParameterChange) onParameterChange(id, val);

    // Forward every parameter change to the DSP engine for real-time processing
    // The engine's updateFromParameters handles mapping param IDs → AudioParam nodes
    if (godEngine.current) {
      godEngine.current.updateFromParameters({ [id]: val });
    }
  }, [onParameterChange]);

  const handleRealmTransition = useCallback((newTab: string) => {
    if (newTab === displayedTab) return;
    setPendingTab(newTab);
    setIsTransitioning(true);
    // Update the parameter so tab bar highlights immediately
    update('activeTab', newTab);
  }, [displayedTab, update]);

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

  const handleArchiveRecall = useCallback(async (samplePath: string, padIndex: number, relic: DivineRelic) => {
    // 1. Update metadata in parameter state (existing behavior)
    update(`slotName_${padIndex}`, relic.name);
    update(`slotRoom_${padIndex}`, relic.roomName);
    update(`slotCategory_${padIndex}`, relic.sourceCategory);
    update(`slotPath_${padIndex}`, samplePath);
    update(`slotFormat_${padIndex}`, relic.format.toUpperCase());
    update('lastArchiveRecall', `${relic.name} -> Pad ${padIndex + 1}`);
    showMessage(`Recalled ${relic.name} to Pad ${padIndex + 1}`);

    // 2. Actually load the audio buffer into the engine AND React state
    const eng = godEngine.current;
    if (eng) {
      try {
        await eng.loadSampleByPath(samplePath, padIndex);
        const loadedBuffer = eng.getBuffer(padIndex);
        if (loadedBuffer) {
          setBuffers(prev => ({ ...prev, [padIndex]: loadedBuffer }));
          console.log(`[God Engine] Buffer loaded for Pad ${padIndex}: ${relic.name}`);
        }
      } catch (err) {
        console.error(`[God Engine] Failed to load buffer for ${relic.name}:`, err);
      }
    }
  }, [update]);

  const handleLoadPreset = useCallback(() => {
    const p = presets[selectedPreset];
    if (!p) return;
    
    // State logic is delegated to the host
    if (p.state && p.state.params) {
      Object.entries(p.state.params).forEach(([id, val]) => {
        update(id, val);
      });
    }
    update('currentPresetName', p.name);
    showMessage(`Loaded: ${p.name}`);
  }, [presets, selectedPreset, update]);

  const handleSavePreset = useCallback(() => {
    const currentState = { params: parameterValues };
    const nextPresets = [...presets];
    if (nextPresets[selectedPreset]) {
      nextPresets[selectedPreset] = {
        ...nextPresets[selectedPreset],
        state: currentState
      };
      setPresets(nextPresets);
      showMessage(`Saved: ${nextPresets[selectedPreset].name}`);
    }
  }, [presets, selectedPreset, parameterValues]);

  const handleSaveAsPreset = useCallback(() => {
    const name = prompt('Enter Preset Name:', `New Preset ${presets.length + 1}`);
    if (!name) return;

    const currentState = { params: parameterValues };
    const newPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      type: 'User',
      author: 'User',
      rating: 5,
      fav: false,
      tags: ['User', 'Custom'],
      lastModified: new Date().toISOString(),
      energyLevel: 40 + Math.random() * 60,
      state: currentState
    };

    setPresets([...presets, newPreset]);
    update('selectedPreset', presets.length);
    update('currentPresetName', name);
    showMessage(`Created: ${name}`);
  }, [presets, update, parameterValues]);

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
        
        {/* Sacred Geometry Reactivity */}
        <SacredGeometryBackground activeTab={displayedTab} />

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
            <GodKnob 
              label="TUNE"
              min={-24}
              max={24}
              value={tuneSemitones}
              onChange={(v) => update('tuneSemitones', v)}
              size="sm"
              suffix=" ST"
            />
            <GodKnob 
              label="VOLUME"
              min={-60}
              max={6}
              value={masterVolume}
              onChange={(v) => update('masterVolume', v)}
              size="sm"
              suffix=" dB"
            />
          </div>
          
          <button className="vg-header-close" onClick={onClose} aria-label="Close Plugin">
            ✕
          </button>
        </div>
      </header>

      {/* ═══════════ TAB BAR ═══════════ */}
        <CelestialTabs 
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={handleRealmTransition}
        />

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main
        className="vg-main"
        data-realm={displayedTab}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          const py = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
          e.currentTarget.style.setProperty('--parallax-x', `${px * -4}px`);
          e.currentTarget.style.setProperty('--parallax-y', `${py * -4}px`);
        }}
      >
        {/* Living Atmosphere Particle Layer */}
        <RealmParticleCanvas realm={displayedTab as any} />

        {/* Phase 4: Realm Portal Transition Overlay */}
        <RealmPortalTransition
          isTransitioning={isTransitioning}
          targetRealm={pendingTab || displayedTab}
          onTransitionComplete={handleTransitionComplete}
        />

        {/* ─── MULTI-REALM TAB (THE GOD FORGE) ─── */}
        <AnimatePresence mode="wait">
        <motion.div
          key={displayedTab}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{ display: 'contents' }}
        >
        {displayedTab === 'Multi-Realm' && (
          <SamplerEngine
            parameterValues={parameterValues}
            update={update}
            slotLevels={slotLevels}
            arpStep={arpStep}
            vortexAnchors={vortexAnchors}
            midiActivity={midiActivity}
            onNeuralForge={() => setIsNeuralPanelOpen(true)}
            isNeuralPanelOpen={isNeuralPanelOpen}
            onCloseNeuralPanel={() => setIsNeuralPanelOpen(false)}
            onApplyNeuralSuggestion={handleApplyNeuralSuggestion}
          />
        )}

        {/* ─── DIVINE ARCHIVE TAB (V2) ─── */}
        {displayedTab === 'Divine Archive' && (
          <div className="vg-panel vg-archive h-full overflow-hidden">
            <DivineArchive
              engineRef={godEngine}
              activePad={activePad}
              onActivePadChange={(pad: number) => update('activePad', pad)}
            />
          </div>
        )}

        {/* ─── SAMPLE CHOPPER TAB (Original Prototype) ─── */}
        {displayedTab === 'Sample Chopper' && (
          <GodRealmSampleChopper
            activePad={activePad}
            parameterValues={parameterValues}
            update={update}
            engineRef={godEngine}
            buffer={buffers[activePad] || null}
          />
        )}

        {/* ─── THE PANTHEON (EFFECTS) TAB ─── */}
        {displayedTab === 'Pantheon' && (
          <HarmonicPantheon 
            parameterValues={parameterValues}
            update={update}
            moduleLevels={moduleLevels}
          />
        )}

        {/* ─── MASTERING TAB (Celestial Forge Design) ─── */}
        {displayedTab === 'Mastering' && (
          <CelestialForge 
            parameterValues={parameterValues}
            update={update}
            moduleLevels={moduleLevels}
            analyser={masterChain.current?.analyser || null}
          />
        )}

        {/* ─── SACRED SEQUENCER TAB ─── */}
        {displayedTab === 'Sequencer' && (
          <div className="vg-panel h-full overflow-hidden p-4">
            <SacredSequencerV2
              parameterValues={parameterValues}
              update={update}
              engine={engine}
              buffers={buffers}
            />
          </div>
        )}

        {/* ─── RITUAL OF EXPORT TAB ─── */}
        {displayedTab === 'Export' && (
          <div className="vg-panel h-full overflow-hidden p-4">
            <RitualOfExport
              parameterValues={parameterValues}
              update={update}
              analyser={masterChain.current?.analyser || null}
              engine={engine}
              buffers={buffers}
              onExportComplete={() => {
                showMessage('RITUAL EXPORT COMPLETE');
              }}
            />
          </div>
        )}

        {/* ─── ELECTRIC PANTHEON TAB ─── */}
        {displayedTab === 'Electric Pantheon' && (
          <ElectricPantheon
            parameterValues={parameterValues}
            update={update}
            engine={engine}
          />
        )}

        {/* ─── PRESET VAULT TAB ─── */}
        {displayedTab === 'Preset Vault' && (
          <EternalPresetVault 
            presets={presets}
            selectedPresetIndex={selectedPreset}
            onSelectPreset={(idx) => update('selectedPreset', idx)}
            onToggleFavorite={(idx) => {
              const next = [...presets];
              next[idx] = { ...next[idx], fav: !next[idx].fav };
              setPresets(next);
            }}
            onLoadPreset={handleLoadPreset}
            onSavePreset={handleSavePreset}
            onSaveAsPreset={handleSaveAsPreset}
            onDeletePreset={() => {
              if (confirm('Banish this ritual from the vault forever?')) {
                const next = presets.filter((_: any, i: number) => i !== selectedPreset);
                setPresets(next);
                if (selectedPreset >= next.length) update('selectedPreset', Math.max(0, next.length - 1));
              }
            }}
            onCloudSync={handleCloudSync}
            isSyncing={isSyncing}
            kitExporter={
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
            }
          />
        )}

        </motion.div>
        </AnimatePresence>
      </main>

      {/* ═══════════ SEQUENCER DRAWER (Collapsible Panel) ═══════════ */}
      <AnimatePresence>
        {isSequencerOpen && (
          <motion.div
            className="vg-sequencer-drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 340, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.1, duration: 0.5 }}
          >
            {/* Drag Handle */}
            <div className="vg-drawer-handle">
              <div className="vg-drawer-handle-bar" />
              <span className="vg-drawer-handle-label">SACRED SEQUENCER</span>
              <button
                className="vg-drawer-close"
                onClick={() => setIsSequencerOpen(false)}
                aria-label="Close Sequencer"
              >
                ✕
              </button>
            </div>
            <div className="vg-drawer-content">
              <SacredSequencerV2
                parameterValues={parameterValues}
                update={update}
                engine={engine}
                buffers={buffers}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ EXPORT OVERLAY (Modal) ═══════════ */}
      <AnimatePresence>
        {isExportOverlayOpen && (
          <motion.div
            className="vg-export-overlay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setIsExportOverlayOpen(false)}
          >
            <motion.div
              className="vg-export-overlay-panel"
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="vg-export-overlay-close"
                onClick={() => setIsExportOverlayOpen(false)}
                aria-label="Close Export"
              >
                ✕
              </button>
              <RitualOfExport
                parameterValues={parameterValues}
                update={update}
                analyser={masterChain.current?.analyser || null}
                engine={engine}
                buffers={buffers}
                onExportComplete={() => {
                  showMessage('RITUAL EXPORT COMPLETE');
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ FOOTER BAR (Cleaned Up) ═══════════ */}
      <footer className="vg-footer">
        <div className="vg-footer-left">
          <span className="vg-foot-status">ANTIGRAVITY_CORE::CONNECTED</span>
          <span className="vg-foot-status">STANDALONE_MODE::ENABLED</span>
          <span className="vg-foot-status">44.1KHZ / 512SMP</span>
          <span className="vg-foot-status">{new Date().toISOString().slice(0, 10)}</span>
          <span className="vg-foot-status">SYSTEM_STABLE</span>
        </div>
        <div className="vg-footer-center">
          <button
            className={`vg-foot-btn-action ${isSequencerOpen ? 'active' : ''}`}
            onClick={() => setIsSequencerOpen(!isSequencerOpen)}
          >
            <span className="vg-foot-btn-icon">🎹</span>
            <span>SEQUENCER</span>
          </button>
          <button
            className={`vg-foot-btn-action vg-foot-accent ${isExportOverlayOpen ? 'active' : ''}`}
            onClick={() => setIsExportOverlayOpen(true)}
          >
            <span className="vg-foot-btn-icon">⚡</span>
            <span>EXPORT</span>
          </button>
        </div>
        <div className="vg-footer-right">
          <div className="vg-foot-info">
            <span>PLUGIN INFO</span>
            <span className="vg-foot-sub">Version 1.0.0</span>
          </div>
        </div>
      </footer>


    </div>
    </div>
  );
};

export default VstgodthegodrealmPlugin;
