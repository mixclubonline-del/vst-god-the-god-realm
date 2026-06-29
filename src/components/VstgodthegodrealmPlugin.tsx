/**
 * VstgodthegodrealmPlugin — VST GOD — The God Realm
 * Faithfully rebuilt from the actual Forge design reference.
 * Category: Sampler / Preset Manager / Kit Exporter
 * Controls: 24 | Tabs: 4
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '@/styles/VSTGODTheGodRealm-theme.css';
import { DivineLoadingScreen, DIVINE_STAGES } from './DivineLoadingScreen';
import { DivineSettings } from './DivineSettings';
import { DivineSetupWizard } from './DivineSetupWizard';
import { LicenseActivationModal } from './LicenseActivationModal';
import { ReleaseNotesModal } from './ReleaseNotesModal';
import { checkForUpdates, uploadPresetsBackup, downloadPresetsBackup, sharePreset } from '../services/supabase';
import { nativeAudio } from '../native/bridge';
import type { DSPChainModule } from '@/services/types';
import { MultiRealmForge } from './MultiRealmForge';
import { MultiControlPanel } from './MultiControlPanel';
import { RealmDashboard } from './RealmDashboard';
import { NeuralSuggestPanel } from './NeuralSuggestPanel';
import { CelestialTabs } from './ui/CelestialTabs';
import { DivineKnob } from './ui/DivineKnob';
import { DivineSlider } from './ui/DivineSlider';
import { CelestialForge } from './CelestialForge';
import { SacredChopper } from './GodRealmSampleChopper';
import { DEFAULT_MIDI_MAP } from '../data/throneDomains';
import { KitExporter } from './KitExporter';
import { CelestialBrowser } from './CelestialBrowser';
import { SpectralRadarPanner } from './SpectralRadarPanner';
/* FluidSlider retired — use DivineSlider variant="fluid" instead */
import { SacredSequencer as SacredSequencerV2, useSequencerEngine, type AutomationParam, type SequencerState } from './sequencer';
import { useAutomationRecorder } from '@/hooks/useAutomationRecorder';
import { RealmParticleCanvas } from './RealmParticleCanvas';
import { RealmPortalTransition } from './RealmPortalTransition';
import { sampleManager } from './sequencer/SampleManager';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { DivineSpectrometer } from './ui/DivineSpectrometer';
import { SacredGeometryBackground } from './ui/SacredGeometryBackground';
import { EternalPresetVault } from './EternalPresetVault';
import { GodVault } from './GodVault';
import { PedalRealm } from './PedalRealm';
import { RitualOfExport } from './RitualOfExport';
import { ElectricPantheon } from './electricPantheon/ElectricPantheon';
import type { DivineRelic } from '@/archive/divineArchive';
import { useJuceBridge } from '@/hooks/useJuceBridge';
import type { Midi2NoteEvent } from '@/native/bridge';
import { GodRealmSamplerEngine } from '@/services/samplerEngine';
import { audioEngine } from '@/services/audioEngine';
import { neuralInputBus } from '@/services/neuralInputBus';
import { BufferRegistry } from '@/audio/BufferRegistry';
import { useBufferRegistry } from '@/hooks/useBufferRegistry';
import { MasterChain } from '@/audio/VelvetCurveEngine';
import { KontaktKitBrowser } from './KontaktKitBrowser';
import VaultPianoKeyboard from './VaultPianoKeyboard';
import type { SlotMapping } from '@/services/kontaktKitLoader';
import { SessionSealDrawer } from './SessionSealDrawer';
import { realmSessionManager, type RealmSnapshot } from '@/services/RealmSessionManager';
import { useKeyboardPads } from '../hooks/useKeyboardPads';
import { useWebMidi } from '../hooks/useWebMidi';
import { NerveMonitor } from './NerveMonitor';
import '../components/NerveMonitor.css';
import { PluginWindowProvider } from '@/contexts/PluginWindowContext';
import { PluginWindowLayer } from './plugins/FloatingPluginWindow';
import { PluginWindowBar } from './plugins/PluginWindowBar';
import '@/styles/FloatingPlugin.css';
import { MidiMappingModal, type MidiCCMapping } from './MidiMappingModal';
import '@/styles/MidiMappingModal.css';
import { midiMappingService } from '@/services/midiMappingService';

// PresetDropdown removed from header
import { usePresetService, presetService, type UnifiedPreset } from '@/services/presetService';
import { DivinePresetModal } from './ui/DivinePresetModal';
import { DivineConfirmModal } from './ui/DivineConfirmModal';


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
  { id: 'Sample Chopper', label: 'CHOPPER' },
  { id: 'Preset Vault', label: 'PRESET VAULT' },
  { id: 'Pedal Realm', label: 'PEDAL REALM' },
  { id: 'Electric Pantheon', label: 'ELECTRIC PANTHEON' },
];

const TAB_SUBTITLES: Record<string, string> = {
  'Multi-Realm': 'MULTI-REALM FORGE',
  'Pantheon': 'THE DIVINE PANTHEON',
  'Sample Chopper': 'SACRED SAMPLE CHOPPER',
  'Mastering': 'CELESTIAL FORGE',
  'Preset Vault': 'ETERNAL PRESET VAULT',
  'Pedal Realm': 'GLOBAL PEDAL RACK',
  'Electric Pantheon': 'THE ELECTRIC PANTHEON',
};

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

/* ─── Phase 32: Sequencer Automation Helpers ─── */
function getTrackIndexForParam(paramId: string, state: SequencerState): number {
  const lowercaseId = paramId.toLowerCase();
  
  if (lowercaseId.startsWith('pad_')) {
    const idx = state.tracks.findIndex(t => t.name.toUpperCase().includes('PAD'));
    if (idx !== -1) return idx;
    return 8; // fallback to track index 8 (PAD)
  }
  if (lowercaseId.startsWith('lead_')) {
    const idx = state.tracks.findIndex(t => t.name.toUpperCase().includes('LEAD'));
    if (idx !== -1) return idx;
    return 7; // fallback to track index 7 (LEAD)
  }
  if (lowercaseId.startsWith('bass_')) {
    const idx = state.tracks.findIndex(t => t.name.toUpperCase().includes('BASS') || t.name.toUpperCase().includes('808'));
    if (idx !== -1) return idx;
    return 3; // fallback to track index 3 (808)
  }
  if (lowercaseId.startsWith('pluck_')) {
    const idx = state.tracks.findIndex(t => t.name.toUpperCase().includes('MELODY') || t.name.toUpperCase().includes('PLUCK') || t.name.toUpperCase().includes('CHORDS'));
    if (idx !== -1) return idx;
    return 5; // fallback to track index 5 (MELODY)
  }
  if (lowercaseId.startsWith('texture_')) {
    const idx = state.tracks.findIndex(t => t.name.toUpperCase().includes('PAD') || t.name.toUpperCase().includes('TEXTURE'));
    if (idx !== -1) return idx;
    return 8; // fallback to track index 8 (PAD)
  }
  
  // Default: currently selected track in the sequencer
  return state.selectedTrack;
}

function getAutomationParamAndValue(paramId: string, val: any): { param: AutomationParam; value: number } | null {
  const lowercaseId = paramId.toLowerCase();
  let normalizedValue = typeof val === 'number' ? val / 100 : Number(val) / 100;
  if (isNaN(normalizedValue)) return null;

  // 1. Macros
  if (lowercaseId.includes('energy') || lowercaseId.includes('filterfreq') || lowercaseId.includes('warmth')) {
    return { param: 'synthEnergy', value: Math.min(1, Math.max(0, normalizedValue)) };
  }
  if (lowercaseId.includes('divinity') || lowercaseId.includes('shimmer')) {
    return { param: 'synthDivinity', value: Math.min(1, Math.max(0, normalizedValue)) };
  }
  if (lowercaseId.includes('width') || lowercaseId.includes('space') || lowercaseId.includes('stereo')) {
    return { param: 'synthWidth', value: Math.min(1, Math.max(0, normalizedValue)) };
  }
  if (lowercaseId.includes('realm')) {
    return { param: 'synthRealm', value: Math.min(1, Math.max(0, normalizedValue)) };
  }
  
  // 2. Mixer / FX Sends
  if (lowercaseId.includes('reverbmix') || lowercaseId.includes('reverb') || lowercaseId.includes('depth')) {
    return { param: 'fxReverb', value: Math.min(1, Math.max(0, normalizedValue)) };
  }
  if (lowercaseId.includes('chorusmix') || lowercaseId.includes('chorus') || lowercaseId.includes('drift')) {
    return { param: 'fxChorus', value: Math.min(1, Math.max(0, normalizedValue)) };
  }
  if (lowercaseId.includes('delaymix') || lowercaseId.includes('delay')) {
    return { param: 'fxDelay', value: Math.min(1, Math.max(0, normalizedValue)) };
  }
  if (lowercaseId.includes('satdrive') || lowercaseId.includes('satmix') || lowercaseId.includes('saturation')) {
    return { param: 'fxSaturation', value: Math.min(1, Math.max(0, normalizedValue)) };
  }
  
  // 3. Volume and Pan
  if (lowercaseId.includes('volume') || lowercaseId.includes('gain') || lowercaseId.includes('master') || lowercaseId.includes('level')) {
    if (lowercaseId.includes('mastervolume') || lowercaseId.includes('volume')) {
      const dbVal = typeof val === 'number' ? val : Number(val);
      if (dbVal < 0) {
        normalizedValue = Math.max(0, (dbVal + 60) / 60);
      } else {
        normalizedValue = 1.0 + (dbVal / 6);
      }
    }
    return { param: 'volume', value: Math.min(1, Math.max(0, normalizedValue)) };
  }
  if (lowercaseId.includes('pan')) {
    const panVal = typeof val === 'number' ? val : Number(val);
    let normPan = panVal;
    if (panVal > 1 || panVal < -1) {
      normPan = (panVal - 50) / 50;
    }
    normalizedValue = (normPan + 1) / 2;
    return { param: 'pan', value: Math.min(1, Math.max(0, normalizedValue)) };
  }

  return null;
}

export const VstgodthegodrealmPlugin: React.FC<VstgodthegodrealmPluginProps> = ({
  isOpen,
  onClose,
  embedded = false,
  width = 1440,
  height = 960,
  onParameterChange,
  parameterValues = {},
}) => {
  // JUCE sends activeTab as an integer (e.g. 7) but all tab comparisons use
  // string names. Treat any non-string value as the default tab so the string
  // comparisons below (displayedTab === 'Preset Vault', etc.) work correctly.
  const activeTab = (typeof parameterValues.activeTab === 'string' && parameterValues.activeTab)
    ? parameterValues.activeTab
    : 'Preset Vault';

  /* ─── Sequencer Drawer & Export Overlay State ─── */
  const [isSequencerOpen, setIsSequencerOpen] = useState(false);
  const [isExportOverlayOpen, setIsExportOverlayOpen] = useState(false);
  const [isKitBrowserOpen, setIsKitBrowserOpen] = useState(false);

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

  /* ─── Session Seal State ─── */
  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSessionName, setActiveSessionName] = useState<string | null>(() => realmSessionManager.getActiveSession());
  const [recentSessions, setRecentSessions] = useState<string[]>(() => realmSessionManager.getRecentSessions());

  /* ─── Auto-Update State ─── */
  const [latestRelease, setLatestRelease] = useState<any | null>(null);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  /* ─── Astral Dais State ─── */
  const [midiMap, setMidiMap] = useState<number[]>(DEFAULT_MIDI_MAP);
  const [triggerFlash, setTriggerFlash] = useState<boolean[]>(Array(16).fill(false));

  const handleMidiMapChange = useCallback((padIndex: number, note: number) => {
    setMidiMap(prev => {
      const next = [...prev];
      next[padIndex] = note;
      return next;
    });
  }, []);

  /* ─── MIDI Mapping Modal State ─── */
  const [isMidiModalOpen, setIsMidiModalOpen] = useState(false);

  /* ─── Preset Saving & Confirmation Modal State ─── */
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetModalConfig, setPresetModalConfig] = useState<{
    defaultName: string;
    onSave: (name: string, type: string, tags: string[], energyLevel: number) => void;
  } | null>(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [ccMappings, setCCMappings] = useState<MidiCCMapping[]>(() => {
    const active = midiMappingService.getMappings();
    if (active.length > 0) {
      return active.map(m => ({
        ccNumber: m.cc,
        targetParam: m.targetId,
        targetLabel: m.targetLabel || m.targetId,
        min: 0,
        max: 127
      }));
    }
    return [
      { ccNumber: 1, targetParam: 'modWheel', targetLabel: 'Mod Wheel', min: 0, max: 127 },
      { ccNumber: 7, targetParam: 'masterVolume', targetLabel: 'Master Volume', min: 0, max: 127 },
    ];
  });

  // Sync service mappings on mount and setup subscription
  useEffect(() => {
    // Seed default mappings in service if empty
    if (midiMappingService.getMappings().length === 0) {
      midiMappingService.setMapping({
        ccKey: '0:1',
        cc: 1,
        channel: 0,
        targetId: 'modWheel',
        targetLabel: 'Mod Wheel',
        deviceName: 'Generic'
      });
      midiMappingService.setMapping({
        ccKey: '0:7',
        cc: 7,
        channel: 0,
        targetId: 'masterVolume',
        targetLabel: 'Master Volume',
        deviceName: 'Generic'
      });
    }

    const syncFromService = () => {
      const active = midiMappingService.getMappings();
      setCCMappings(
        active.map(m => ({
          ccNumber: m.cc,
          targetParam: m.targetId,
          targetLabel: m.targetLabel || m.targetId,
          min: 0,
          max: 127
        }))
      );
    };

    // Initial sync
    syncFromService();

    // Subscribe to changes
    return midiMappingService.onMappingChange(syncFromService);
  }, []);

  const handleCCMappingsChange = useCallback((newMappings: MidiCCMapping[]) => {
    midiMappingService.clearAll();
    newMappings.forEach(m => {
      midiMappingService.setMapping({
        ccKey: `0:${m.ccNumber}`,
        cc: m.ccNumber,
        channel: 0,
        targetId: m.targetParam,
        targetLabel: m.targetLabel,
        deviceName: 'Generic'
      });
    });
    setCCMappings(newMappings);
  }, []);

  const handleNavigateToTab = useCallback((tabName: string, options?: { padIndex?: number }) => {
    if (options?.padIndex !== undefined && onParameterChange) {
      onParameterChange('activePad', options.padIndex);
    }
    setPendingTab(tabName);
  }, [onParameterChange]);

  /* ─── Throne Trigger Flash (Sequencer → Pad visual bridge) ─── */
  useEffect(() => {
    const flashTimers: ReturnType<typeof setTimeout>[] = [];
    const handleThroneTrigger = (e: Event) => {
      const { padIndex } = (e as CustomEvent<{ padIndex: number }>).detail;
      if (padIndex < 0 || padIndex >= 16) return;
      setTriggerFlash(prev => {
        const next = [...prev];
        next[padIndex] = true;
        return next;
      });
      const timer = setTimeout(() => {
        setTriggerFlash(prev => {
          const next = [...prev];
          next[padIndex] = false;
          return next;
        });
      }, 150);
      flashTimers.push(timer);
    };
    window.addEventListener('throne-trigger', handleThroneTrigger);
    return () => {
      window.removeEventListener('throne-trigger', handleThroneTrigger);
      flashTimers.forEach(clearTimeout);
    };
  }, []);
  const [draggingMarker, setDraggingMarker] = useState<number | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  /* ─── Phase 1: Sovereign AudioContext (Shared by both engines) ─── */
  /* Created lazily — starts suspended until first user gesture (play, pad tap, etc.) */
  const sovereignCtx = useRef<AudioContext | null>(null);
  const celestialForgeChain = useRef<MasterChain | null>(null);

  const sovereignLimiterRef = useRef<DynamicsCompressorNode | null>(null);

  const ensureSovereignCtx = useCallback(() => {
    // CRITICAL: use the ONE shared AudioContext (audioEngine.ctx). Every engine —
    // instruments, sequencer, sampler — must live on a single context and feed the
    // single capture node that bridges to JUCE. A separate context (the old
    // `new AudioContext()`) leaked straight to the system speakers (never muted in
    // plugin mode) and never reached the DAW, so the sequencer/sampler played out
    // of the laptop a few ms out of sync with the bridged instruments = the
    // doubled/phasing "feedback" the user kept hearing.
    if (!sovereignCtx.current && typeof window !== 'undefined') {
      sovereignCtx.current = audioEngine.ctx;
    }
    // Phase 3: Celestial Forge — create alongside context
    if (!celestialForgeChain.current && sovereignCtx.current) {
      celestialForgeChain.current = new MasterChain(sovereignCtx.current);
      // Global limiter: MasterChain → limiter → audioEngine.masterBus.
      // masterBus is the node captured to JUCE and muted from the local speakers
      // in plugin mode, so the sampler/sequencer now route through the DAW like
      // every other instrument instead of leaking to the system output.
      if (!sovereignLimiterRef.current) {
        const lim = sovereignCtx.current.createDynamicsCompressor();
        lim.threshold.value = -3;
        lim.knee.value = 0;
        lim.ratio.value = 20;
        lim.attack.value = 0.001;
        lim.release.value = 0.08;
        lim.connect(audioEngine.masterBus);
        sovereignLimiterRef.current = lim;
        celestialForgeChain.current.connect(lim);
      } else {
        celestialForgeChain.current.connect(audioEngine.masterBus);
      }
    }
    return sovereignCtx.current;
  }, []);

  /* ─── Sequencer Engine (uses Sovereign Context + Celestial Forge) ─── */
  const engine = useSequencerEngine(sovereignCtx, celestialForgeChain);
  const { masterChain } = engine;

  if (typeof window !== 'undefined') {
    (window as any).sequencerEngine = engine;
  }


  // ─── Phase 32: Sequencer Automation Recording ───
  const isSelectingPresetRef = useRef(false);
  const { recordAutomation } = useAutomationRecorder({
    isRecording: engine.state.isRecording,
    isPlaying: engine.state.isPlaying,
    currentStep: engine.state.currentStep,
    dispatch: engine.dispatch,
  });

  // ─── DAW Audio Bridge ────────────────────────────────────────────────────
  // Once JUCE tells us whether we're a plugin or standalone, configure the
  // shared AudioContext so audio routes through the DAW bus (plugin) or to
  // system speakers (standalone).
  useEffect(() => {
    const standalone = parameterValues.isStandalone;
    if (standalone !== undefined) {
      audioEngine.setIsPlugin(!standalone);
    }
  }, [parameterValues.isStandalone]);

  const prevParameterValuesRef = useRef<Record<string, any>>({ ...parameterValues });

  useEffect(() => {
    if (engine.state.isRecording && engine.state.isPlaying && !isSelectingPresetRef.current) {
      const prev = prevParameterValuesRef.current;
      const current = parameterValues;
      
      Object.keys(current).forEach(key => {
        if (current[key] !== prev[key]) {
          const mapped = getAutomationParamAndValue(key, current[key]);
          if (mapped) {
            const trackIdx = getTrackIndexForParam(key, engine.state);
            recordAutomation(trackIdx, mapped.param, mapped.value);
          }
        }
      });
    }
    prevParameterValuesRef.current = { ...parameterValues };
  }, [parameterValues, engine.state, recordAutomation]);


  
  // Connect the analyser to the design system CSS variables
  // Phase 3: Use the Celestial Forge chain's analyser (it's the shared master)
  useAudioAnalyser(celestialForgeChain.current?.analyser || masterChain.current?.analyser || null);
  
  /* ─── Phase 2: Unified Buffer Registry (replaces React state buffers) ─── */
  const registryRef = useRef<BufferRegistry | null>(null);
  if (!registryRef.current) {
    registryRef.current = new BufferRegistry(16);
  }
  const registry = registryRef.current;
  const buffers = useBufferRegistry(registry);
  const isBuffersLoaded = Object.keys(buffers).length > 0;

  // ─── Metronome (lifted from SacredSequencer for transport access) ───
  const [metronomeOn, setMetronomeOn] = useState(false);

  /* ─── God Realm Sampler Engine (86KB DSP Powerhouse) ─── */
  const godEngine = useRef<GodRealmSamplerEngine | null>(null);
  const [engineEpoch, setEngineEpoch] = useState(0);

  /* ─── Divine Loading Screen State ─── */
  const [loadingStage, setLoadingStage] = useState('awaken');
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);

  /* ─── Divine Setup Wizard State ─── */
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [activeSettings, setActiveSettings] = useState<any>(null);
  const setupCompletedRef = useRef(false);

  // Initialize the engine on mount — always re-creates on Strict Mode re-mount
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        // ── Stage 1: Awakening ──
        setLoadingStage('awaken');
        ensureSovereignCtx();

        // ── Stage 2: Bridge ──
        setLoadingStage('bridge');
        const eng = new GodRealmSamplerEngine();
        await eng.init(sovereignCtx.current ?? undefined, registry);
        if (cancelled) { eng.dispose(); return; }
        godEngine.current = eng;

        // ── Settings Check & Setup Wizard ──
        console.log('[God Plugin] Checking settings...');
        const waitForSettings = () => new Promise<any>((resolve) => {
          console.log('[God Plugin] Subscribing to settings and sending GET_SETTINGS...');
          const unsubscribe = nativeAudio.subscribeSettings((settings) => {
            console.log('[God Plugin] Settings received:', JSON.stringify(settings));
            unsubscribe();
            resolve(settings);
          });
          nativeAudio.getSettings();
        });

        const settings = await waitForSettings();
        console.log('[God Plugin] waitForSettings resolved settings:', JSON.stringify(settings));
        if (cancelled) return;
        setActiveSettings(settings);

        // Check for updates
        try {
          const pluginVersion = settings?.pluginVersion || 'v1.0.0-dev';
          const update = await checkForUpdates(pluginVersion);
          if (update && !cancelled) {
            console.log('[God Plugin] Update available:', update.version);
            setLatestRelease(update);
          }
        } catch (e) {
          console.error('[God Plugin] Update check failed:', e);
        }

        // ── Stage 3: Samples ──
        setLoadingStage('samples');

        // ── Stage 4: Mastering chain ──
        setLoadingStage('mastering');
        if (celestialForgeChain.current) {
          eng.routeOutput(celestialForgeChain.current.input);
        }

        // ── Stage 5: UI manifest ──
        setLoadingStage('ui');

        if (!cancelled) {
          setEngineEpoch(prev => prev + 1);
          // ── Stage 6: Ready ──
          setLoadingStage('ready');
          setLoadingComplete(true);
          if (import.meta.env.DEV) {
            console.log('[God Engine] Initialized — %d sacred samples loaded via BufferRegistry', registry.loadedCount);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[God Engine] Initialization failed, falling back to SampleManager', err);
        // Phase 2: Fallback — load via SampleManager into the registry
        const ctx = sovereignCtx.current || engine.audioCtx.current;
        if (ctx) {
          try {
            const fallbackBuffers = await sampleManager.loadKit(ctx);
            if (!cancelled) {
              // Push fallback buffers into the registry
              for (const [slot, buf] of Object.entries(fallbackBuffers)) {
                registry.setBuffer(Number(slot), buf, `Sample ${Number(slot) + 1}`);
              }
              console.log('[God Engine] Fallback: SampleManager loaded into registry');
            }
          } catch (fallbackErr) {
            console.error('[God Engine] Fallback also failed', fallbackErr);
          }
        }
      }
    };

    boot();

    return () => {
      cancelled = true;
      if (godEngine.current) {
        godEngine.current.dispose();
        godEngine.current = null;
        console.log('[God Engine] Disposed');
      }
      // The sovereign context is now the shared audioEngine.ctx singleton — do
      // NOT close it (that would kill the capture node and every other
      // instrument's audio). Just tear down the chain we built on it and drop our
      // reference so a remount rebuilds the MasterChain/limiter into masterBus.
      if (celestialForgeChain.current) {
        try { celestialForgeChain.current.disconnect(); } catch {}
        celestialForgeChain.current = null;
      }
      if (sovereignLimiterRef.current) {
        try { sovereignLimiterRef.current.disconnect(); } catch {}
        sovereignLimiterRef.current = null;
      }
      sovereignCtx.current = null;
    };
  }, []);

  // Open Setup Wizard after the Loading Screen has finished transitioning out
  useEffect(() => {
    if (!showLoadingScreen && activeSettings) {
      const libraryPath = activeSettings.sampleLibraryPath;
      const needsSetup = !libraryPath || libraryPath === '~/Library/Audio/Samples/VST GOD/' || libraryPath === '';
      if (needsSetup && !setupCompletedRef.current) {
        console.log('[God Plugin] Loading screen dismissed. Opening Setup Wizard...');
        setShowSetupWizard(true);
      }
    }
  }, [showLoadingScreen, activeSettings]);

  // Phase 5: Sync BPM from transport → God Engine arpeggiator
  useEffect(() => {
    godEngine.current?.setBpm(engine.state.bpm);
  }, [engine.state.bpm]);

  // Keep a ref to displayedTab so the MIDI listener can read it without being re-created
  const displayedTabRef = useRef(displayedTab);
  useEffect(() => { displayedTabRef.current = displayedTab; }, [displayedTab]);

  // Tabs whose MIDI notes should route to the GodRealmSamplerEngine (pad/sampler mode)
  // NOTE: Sample Chopper is intentionally excluded — the Chopper component manages its own MIDI
  // routing internally (slice preview). Routing notes to the engine here would cause the full
  // sample to play on every key press alongside the slice preview.
  const SAMPLER_TABS = new Set([
    'Multi-Realm',
  ]);

  useEffect(() => {
    const unsubscribe = neuralInputBus.addListener((event) => {
      const tab = displayedTabRef.current;

      // Electric Pantheon: JUCE handles note-on/off natively; web layer only needs CC
      // Other non-sampler tabs (Preset Vault, Export, Settings, etc.): silence web engine
      if (!SAMPLER_TABS.has(tab)) return;

      const eng = godEngine.current;
      if (!eng) return;

      // Resume AudioContext on first user interaction (Chrome autoplay policy)
      if (sovereignCtx.current?.state === 'suspended') {
        sovereignCtx.current.resume();
      }

      if (event.type === 'midi' && event.note !== undefined) {
        // Pad-range MIDI notes (mapped via midiMap → pad index)
        eng.triggerMidiNote(event.note, event.velocity);
      } else if (event.type === 'midi_note_on' && event.note !== undefined) {
        // Full-range MIDI keys
        eng.triggerMidiNote(event.note, event.velocity);
      } else if (event.type === 'midi_note_off') {
        // Note Off — future: release sustained voices
      } else if (event.type !== 'midi_cc') {
        // Computer keyboard / pad click → trigger specific slot
        eng.playBufferPart(event.target, 0);
      }

      // Visual feedback — pad flash
      if (event.type !== 'midi_cc' && event.type !== 'midi_note_off') {
        if (onParameterChange) onParameterChange('activePad', event.target % 16);
      }
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onParameterChange]);
  // ─── JUCE ↔ WebView Bidirectional State Bridge ───
  const bridgeState = useJuceBridge();
  // Use real DAW host BPM when available; fall back to parameter/default
  const effectiveBpm = bridgeState.transport.bpm > 0 ? bridgeState.transport.bpm : (parameterValues.globalBpm || 140.00);
  const moduleLevels: Record<string, number> = {};
  const [vortexAnchors, setVortexAnchors] = useState<Array<{x: number, y: number, name: string}>>([]);
  const activeMidiNotes = bridgeState.midiNotes;
  const masterPeak = bridgeState.masterPeak;

  // ─── Live Metering from DSP Engine (rAF loop) ───
  const [liveSlotLevels, setLiveSlotLevels] = useState<number[]>(new Array(16).fill(0));
  const [liveArpStep, setLiveArpStep] = useState<number>(0);
  const meterRafRef = useRef<number | null>(null);

  useEffect(() => {
    // engineEpoch changes each time the DSP engine successfully boots
    if (!godEngine.current) return;

    const eng = godEngine.current;
    const tick = () => {
      const levels = eng.getSlotLevels();
      setLiveSlotLevels(levels);
      setLiveArpStep(eng.getArpStep());
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);
    console.log('[Live Meters] rAF metering loop engaged — epoch', engineEpoch);
    // DEBUG: expose engine for console probing (remove before prod)
    (window as any).__godEngine = eng;

    return () => {
      if (meterRafRef.current !== null) {
        cancelAnimationFrame(meterRafRef.current);
        console.log('[Live Meters] rAF metering loop disengaged');
      }
    };
  }, [engineEpoch]);

  // Use live engine data when available, fall back to JUCE bridge
  const slotLevels = liveSlotLevels;
  const arpStep = liveArpStep || bridgeState.arpStep;

  // ─── Global Keyboard Shortcuts ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          engine.togglePlay();
          break;
        case 'KeyR':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            engine.dispatch({ type: 'TOGGLE_AUTOMATION_RECORD' });
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine]);

  /* ─── Phase 5: Nerve System — Live Input Hooks ─── */
  const handleKeyboardPadTrigger = useCallback((padIndex: number) => {
    // Only respond when on a sampler tab — prevents double-trigger on Pantheon/other tabs
    if (!SAMPLER_TABS.has(displayedTabRef.current)) return;
    if (onParameterChange) onParameterChange('activePad', padIndex % 16);
  }, [onParameterChange]);

  const keyboardPadState = useKeyboardPads(godEngine, handleKeyboardPadTrigger);
  const webMidiState = useWebMidi(godEngine, midiMap, handleKeyboardPadTrigger);

  // Keep neuralInputBus in sync with the live midiMap so pad lookups always use the right notes
  useEffect(() => {
    neuralInputBus.updateMidiMap(midiMap);
  }, [midiMap]);

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

  // --- Unified Preset System ---
  const presetSvc = usePresetService();
  const allPresets = presetSvc.getAll();
  const activePresetId = parameterValues.currentPresetId || (allPresets[0]?.id ?? null);
  const activePreset = presetSvc.getById(activePresetId);
  const currentName = activePreset ? activePreset.name : (parameterValues.currentPresetName || 'Unknown Preset');

  // One-time capture of factory defaults based on initial parameters
  useEffect(() => {
    presetSvc.captureFactoryDefaults(parameterValues);
  }, []); // Run once on mount

  const includedPresets = useMemo(() => {
    const fromProps = parameterValues.includedPresets || [];
    return allPresets.map((_: any, i: number) => i < fromProps.length ? fromProps[i] : true);
  }, [parameterValues.includedPresets, allPresets]);

  const [vaultMessage, setVaultMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // --- Neural Morph Logic (Phase 5) ---
  useEffect(() => {
    if (parameterValues.morphFactor !== undefined && parameterValues.morphFactor > 0) {
      // Morph logic now handled in JUCE backend
    }
  }, [parameterValues.morphFactor, activePresetId]);

  const update = useCallback((id: string, val: any) => {
    if (onParameterChange) onParameterChange(id, val);

    // Forward every parameter change to the DSP engine for real-time processing
    // The engine's updateFromParameters handles mapping param IDs → AudioParam nodes
    if (godEngine.current) {
      godEngine.current.updateFromParameters({ [id]: val });
    }
  }, [onParameterChange]);

  /* ─── Session Seal: Collect & Apply Snapshots ─── */
  const collectSnapshot = useCallback((name: string): RealmSnapshot => {
    // Gather pad assignments from BufferRegistry
    const padAssignments = registry.loadedSlots.map(slot => ({
      slotIndex: slot,
      path: registry.getPath(slot),
      name: registry.getName(slot),
      isFileDrop: registry.getPath(slot).startsWith('file://'),
    }));

    // Sequencer state (strip transient fields)
    const { isPlaying, currentStep, cycleCount, clipboardPattern, ...seqState } = engine.state;

    return {
      version: 1,
      name,
      savedAt: new Date().toISOString(),
      sequencerState: seqState,
      padAssignments,
      pantheonGod: (parameterValues.electricPantheonGod as string) || 'olympus',
      pantheonMacros: {
        energy: parameterValues.pantheonEnergy ?? 50,
        divinity: parameterValues.pantheonDivinity ?? 50,
        width: parameterValues.pantheonWidth ?? 50,
        realm: parameterValues.pantheonRealm ?? 50,
      },
      parameterValues: { ...parameterValues },
      daisState: {
        activePad,
        playModes: [],
        midiMap: midiMap.reduce((acc, note, idx) => { acc[idx] = note; return acc; }, {} as Record<number, number>),
      },
    };
  }, [registry, engine.state, parameterValues, activePad, midiMap]);

  const applySnapshot = useCallback(async (snapshot: RealmSnapshot) => {
    isSelectingPresetRef.current = true;
    try {
      // 1. Restore sequencer state
      if (snapshot.sequencerState) {
        engine.dispatch({
          type: 'LOAD_PROJECT_STATE',
          payload: {
            ...snapshot.sequencerState,
            isPlaying: false,
            currentStep: -1,
            cycleCount: 0,
            clipboardPattern: null,
          },
        });
      }

      // 2. Restore parameter values (covers effects, mastering, all knobs)
      if (snapshot.parameterValues) {
        Object.entries(snapshot.parameterValues).forEach(([key, val]) => {
          update(key, val);
        });
      }

      // 3. Restore pad assignments (re-fetch from paths)
      if (snapshot.padAssignments && sovereignCtx.current) {
        registry.clearAll();
        for (const pad of snapshot.padAssignments) {
          if (pad.isFileDrop) {
            console.warn(`[SessionSeal] Pad ${pad.slotIndex} ("${pad.name}") was a file drop — must re-drop manually`);
            continue;
          }
          try {
            await registry.loadFromPath(sovereignCtx.current, pad.path, pad.slotIndex, pad.name);
          } catch (err) {
            console.warn(`[SessionSeal] Failed to reload pad ${pad.slotIndex}:`, err);
          }
        }
      }

      // 4. Restore Dais state
      if (snapshot.daisState) {
        update('activePad', snapshot.daisState.activePad);
        if (snapshot.daisState.midiMap) {
          const newMap = [...DEFAULT_MIDI_MAP];
          Object.entries(snapshot.daisState.midiMap).forEach(([idx, note]) => {
            newMap[Number(idx)] = Number(note);
          });
          setMidiMap(newMap);
        }
      }

      setActiveSessionName(snapshot.name);
      setRecentSessions(realmSessionManager.getRecentSessions());
      console.log(`[SessionSeal] Restored: "${snapshot.name}"`);
    } finally {
      setTimeout(() => {
        isSelectingPresetRef.current = false;
      }, 50);
    }
  }, [engine, update, registry, setMidiMap]);

  const handleSessionSave = useCallback(async (name: string) => {
    const snapshot = collectSnapshot(name);
    await realmSessionManager.saveSession(snapshot);
    setActiveSessionName(name);
    setRecentSessions(realmSessionManager.getRecentSessions());
  }, [collectSnapshot]);

  const handleSessionLoad = useCallback(async (name: string) => {
    const snapshot = await realmSessionManager.loadSession(name);
    if (snapshot) {
      await applySnapshot(snapshot);
    }
  }, [applySnapshot]);

  const handleQuickRecall = useCallback(async (name: string) => {
    const snapshot = await realmSessionManager.loadSession(name);
    if (snapshot) {
      await applySnapshot(snapshot);
    }
  }, [applySnapshot]);

  const handleRealmTransition = useCallback((newTab: string) => {
    if (newTab === displayedTab) return;
    setPendingTab(newTab);
    setIsTransitioning(true);
    // Update the parameter so tab bar highlights immediately
    update('activeTab', newTab);
  }, [displayedTab, update]);

  const handleApplyNeuralSuggestion = useCallback((suggestion: any) => {
    if (!suggestion) return;
    const params = suggestion.params || suggestion;
    Object.entries(params).forEach(([id, val]) => {
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

    // 2. Load the audio buffer into the engine (registry is updated automatically via Phase 2)
    const eng = godEngine.current;
    if (eng) {
      try {
        await eng.loadSampleByPath(samplePath, padIndex);
        console.log(`[God Engine] Buffer loaded for Pad ${padIndex}: ${relic.name}`);
      } catch (err) {
        console.error(`[God Engine] Failed to load buffer for ${relic.name}:`, err);
      }
    }

    // Phase 4: One-Touch Pad → Track — sync sequencer track with the recalled relic
    if (padIndex < engine.state.tracks.length) {
      // Rename the sequencer track to match the relic
      engine.dispatch({ type: 'RENAME_TRACK', trackIndex: padIndex, name: relic.name });
      // Ensure the track is set to 'sample' source type
      if (engine.state.tracks[padIndex].sourceType !== 'sample') {
        engine.dispatch({ type: 'SET_TRACK_SOURCE', trackIndex: padIndex, sourceType: 'sample' });
      }
    }
  }, [update, engine]);

  const handleLoadKit = useCallback(async (mappings: SlotMapping[]) => {
    const eng = godEngine.current;
    if (!eng) return;

    const samplesToLoad = mappings
      .filter(m => m.sample !== null)
      .map(m => ({ file: m.sample!.file, slotIndex: m.slotIndex }));

    await eng.loadKit(samplesToLoad);

    // Phase 2 + 4: Buffers go into registry, AND sync sequencer track names
    for (const mapping of mappings) {
      if (mapping.sample) {
        const sampleName = mapping.sample.name.replace(/\.[^.]+$/, '');
        update(`slotName_${mapping.slotIndex}`, sampleName);
        update(`slotCategory_${mapping.slotIndex}`, mapping.sample.category);
        update(`slotPath_${mapping.slotIndex}`, mapping.sample.path);

        // Phase 4: Sync sequencer track name
        if (mapping.slotIndex < engine.state.tracks.length) {
          engine.dispatch({ type: 'RENAME_TRACK', trackIndex: mapping.slotIndex, name: sampleName });
        }
      }
    }

    showMessage(`KIT LOADED — ${samplesToLoad.length} SAMPLES ASSIGNED`);
  }, [update]);

  const handlePresetSelect = useCallback((preset: UnifiedPreset) => {
    // Cancel active MIDI Learn on preset select
    midiMappingService.cancelLearn();

    isSelectingPresetRef.current = true;
    update('currentPresetId', preset.id);
    update('currentPresetName', preset.name);

    // Auto-switch to Multi-Realm tab when loading a Multi-Preset
    if (preset.type === 'Multi-Preset' || preset.state?.params?.multiRealmSlots) {
      update('activeTab', 'Multi-Realm');
    }

    if (preset.state?.params) {
      Object.entries(preset.state.params).forEach(([key, val]) => {
        if (key !== 'currentPresetId' && key !== 'currentPresetName') {
          update(key, val);
        }
      });
    }
    setTimeout(() => {
      isSelectingPresetRef.current = false;
    }, 50);
  }, [update]);

  const handlePresetNext = useCallback(() => {
    handlePresetSelect(presetSvc.getNext(activePresetId));
  }, [presetSvc, activePresetId, handlePresetSelect]);

  const handlePresetPrev = useCallback(() => {
    handlePresetSelect(presetSvc.getPrev(activePresetId));
  }, [presetSvc, activePresetId, handlePresetSelect]);

  const handleToggleFavorite = useCallback((id: string) => {
    presetSvc.toggleFavorite(id);
  }, [presetSvc]);

  const handleLoadPreset = useCallback(() => {
    if (activePreset) {
      handlePresetSelect(activePreset);
      showMessage(`Loaded: ${activePreset.name}`);
    }
  }, [activePreset, handlePresetSelect]);

  const handleSavePreset = useCallback(() => {
    if (activePreset && activePreset.source !== 'pantheon') {
      setConfirmModalConfig({
        title: 'OVERWRITE PRESET',
        description: `Overwrite preset "${activePreset.name}" with current settings?`,
        confirmLabel: 'OVERWRITE',
        cancelLabel: 'CANCEL',
        isDestructive: false,
        onConfirm: () => {
          presetSvc.save({ ...activePreset, state: { params: parameterValues } });
          showMessage(`Saved: ${activePreset.name}`);
        }
      });
      setConfirmModalOpen(true);
    } else {
      showMessage('Cannot save Pantheon presets. Use Save As.');
    }
  }, [activePreset, presetSvc, parameterValues]);

  const handleSaveAsPreset = useCallback(() => {
    setPresetModalConfig({
      defaultName: `New Preset ${allPresets.length + 1}`,
      onSave: (name, type, tags, energyLevel) => {
        const newPreset: UnifiedPreset = {
          id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          type,
          author: activeSettings?.username || 'User',
          rating: 5,
          fav: false,
          tags: tags.length > 0 ? tags : ['User', 'Custom'],
          lastModified: new Date().toISOString(),
          energyLevel: energyLevel,
          source: 'user',
          state: { params: parameterValues }
        };
        presetSvc.save(newPreset);
        handlePresetSelect(newPreset);
        showMessage(`Created: ${name}`);
      }
    });
    setPresetModalOpen(true);
  }, [allPresets.length, parameterValues, presetSvc, handlePresetSelect, activeSettings?.username]);

  const handleDeletePreset = useCallback(() => {
    if (activePreset && activePreset.source !== 'pantheon') {
      setConfirmModalConfig({
        title: 'BANISH PRESET',
        description: `Are you sure you want to permanently delete the preset "${activePreset.name}"? This action cannot be undone.`,
        confirmLabel: 'BANISH',
        cancelLabel: 'KEEP',
        isDestructive: true,
        onConfirm: () => {
          presetSvc.delete(activePreset.id);
          handlePresetSelect(allPresets[0]);
          showMessage('Preset Deleted');
        }
      });
      setConfirmModalOpen(true);
    }
  }, [activePreset, presetSvc, handlePresetSelect, allPresets]);

  const handleExportVault = useCallback(() => {
    const data = presetSvc.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GodRealm_Vault_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showMessage('Vault Exported');
  }, [presetSvc]);

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
          imported.forEach(p => presetSvc.save(p));
          showMessage('Vault Restored');
        }
      } catch (err) {
        alert('Invalid Vault File');
      }
      update('btnRestoreVault', false);
    };
    input.click();
  }, [presetSvc, update]);

  const handleRestoreDefaults = useCallback(() => {
    setConfirmModalConfig({
      title: 'RESTORE DEFAULTS',
      description: 'This will reset your library to factory defaults and reload the page. All unsaved custom presets will be lost. Continue?',
      confirmLabel: 'RESTORE',
      cancelLabel: 'CANCEL',
      isDestructive: true,
      onConfirm: () => {
        localStorage.removeItem('vst-god-realm-presets-v2');
        window.location.reload();
      }
    });
    setConfirmModalOpen(true);
  }, []);

  const handleCloudBackup = useCallback(async () => {
    if (isSyncing) return;
    if (!activeSettings?.licenseActivated) {
      showMessage('LICENSE REQUIRED FOR CLOUD BACKUP');
      return;
    }
    setIsSyncing(true);
    showMessage('CONNECTING TO DIVINE CLOUD...');
    
    try {
      const allVaultPresets = presetSvc.getVaultPresets();
      const presetsJson = JSON.stringify(allVaultPresets);
      
      showMessage('UPLOADING VAULT BACKUP...');
      const result = await uploadPresetsBackup(
        activeSettings.licenseKey,
        activeSettings.machineId,
        presetsJson
      );
      
      if (result.success) {
        showMessage('CLOUD BACKUP SUCCESSFUL');
      } else {
        showMessage(`BACKUP FAILED: ${result.message}`);
      }
    } catch (err: any) {
      showMessage(`BACKUP ERROR: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, activeSettings, presetSvc, showMessage]);

  const handleCloudRestore = useCallback(async () => {
    if (isSyncing) return;
    if (!activeSettings?.licenseActivated) {
      showMessage('LICENSE REQUIRED FOR CLOUD RESTORE');
      return;
    }
    
    setConfirmModalConfig({
      title: 'RESTORE FROM CLOUD?',
      description: 'This will overwrite your current local vault with the presets from your cloud backup. Continue?',
      confirmLabel: 'RESTORE',
      cancelLabel: 'CANCEL',
      isDestructive: false,
      onConfirm: async () => {
        setConfirmModalOpen(false);
        setIsSyncing(true);
        showMessage('RETRIEVING CLOUD BACKUP...');
        
        try {
          const result = await downloadPresetsBackup(
            activeSettings.licenseKey,
            activeSettings.machineId
          );
          
          if (result.success && result.data) {
            const imported = presetSvc.importVault(result.data);
            if (imported) {
              showMessage(`RESTORED ${imported.length} RITUALS FROM CLOUD`);
            } else {
              showMessage('FAILED TO PARSE CLOUD DATA');
            }
          } else {
            showMessage(result.message || 'NO CLOUD BACKUP FOUND');
          }
        } catch (err: any) {
          showMessage(`RESTORE ERROR: ${err.message || err}`);
        } finally {
          setIsSyncing(false);
        }
      }
    });
    setConfirmModalOpen(true);
  }, [isSyncing, activeSettings, presetSvc, showMessage]);

  const handleSharePreset = useCallback(async (preset: any) => {
    if (isSyncing) return;
    if (!activeSettings?.licenseActivated) {
      showMessage('LICENSE REQUIRED FOR SHARING');
      return;
    }
    setIsSyncing(true);
    showMessage(`ASCENDING "${preset.name}" TO SOVEREIGN CLOUD...`);
    
    try {
      const result = await sharePreset(
        activeSettings.licenseKey,
        activeSettings.machineId,
        preset
      );
      if (result.success) {
        showMessage('RITUAL ASCENDED SUCCESSFULLY');
      } else {
        showMessage(`SHARING FAILED: ${result.message}`);
      }
    } catch (err: any) {
      showMessage(`SHARING ERROR: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, activeSettings, showMessage]);

  const handleCloudSync = handleCloudBackup;

  const handleExportPreset = useCallback(() => {
    if (!activePreset) return;
    const data = presetSvc.exportPreset(activePreset.id);
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GodRealm_${activePreset.name.replace(/\s+/g, '_')}.json`;
    a.click();
    showMessage(`EXPORTED: ${activePreset.name}`);
    update('btnExportPreset', false);
  }, [activePreset, presetSvc, update]);

  const handleImportPreset = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const p = presetSvc.importPreset(text);
        if (p) {
          showMessage(`IMPORTED: ${p.name}`);
          handlePresetSelect(p);
        } else {
          alert('Invalid Preset File');
        }
      } catch (err) {
        alert('Error reading file');
      }
      update('btnImportPreset', false);
    };
    input.click();
  }, [presetSvc, handlePresetSelect, update]);

  const handleExportKit = useCallback(() => {
    const kitData = {
      kitName,
      kitAuthor,
      kitDescription,
      presets: allPresets.filter((_: any, i: number) => includedPresets[i]),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(kitData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kitName.replace(/\s+/g, '_')}_GodKit.json`;
    a.click();
    showMessage('Kit Exported!');
  }, [kitName, kitAuthor, kitDescription, allPresets, includedPresets]);

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
    <PluginWindowProvider>
    <div 
      className={wrapperClassName}
      onClick={embedded ? undefined : onClose}
    >
      <div 
        className="vg-hardware-rack" 
        style={{ width, height, maxWidth: embedded ? '100%' : undefined, maxHeight: embedded ? '100%' : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Rack Ear */}
        <div className="vg-rack-ear vg-rack-ear--left">
          <div className="vg-rack-screw-slot">
            <div className="vg-rack-screw vg-rack-screw--top" />
          </div>
          <div className="vg-rack-power">
            <div className="vg-rack-power-led" />
            <span className="vg-rack-power-label">POWER</span>
          </div>
          <div className="vg-rack-handle" />
          <div className="vg-rack-screw-slot">
            <div className="vg-rack-screw vg-rack-screw--bottom" />
          </div>
        </div>

        {/* Main Plugin Body */}
        <div className="vg-plugin">
        {/* ═══ DIVINE SETUP WIZARD ═══ */}
        {showSetupWizard && (
          <DivineSetupWizard
            initialSettings={activeSettings}
            onComplete={(completedSettings) => {
              try {
                const stored = localStorage.getItem('vst-god-divine-settings') || '{}';
                const parsed = JSON.parse(stored);
                localStorage.setItem('vst-god-divine-settings', JSON.stringify({
                  ...parsed,
                  ...completedSettings
                }));
              } catch (e) {
                // ignore
              }
              setupCompletedRef.current = true;
              setShowSetupWizard(false);
            }}
          />
        )}

        {/* ═══ DIVINE LOADING SCREEN ═══ */}
        {showLoadingScreen && (
          <DivineLoadingScreen
            currentStage={loadingStage}
            isReady={loadingComplete}
            skipVideo={false}
            onTransitionComplete={() => {
              setShowLoadingScreen(false);
            }}
          />
        )}

        {/* ═══ LICENSE ACTIVATION MODAL ═══ */}
        {loadingComplete && activeSettings && !activeSettings.licenseActivated && (
          <LicenseActivationModal
            activeSettings={activeSettings}
            onActivationSuccess={(updatedSettings) => {
              setActiveSettings(updatedSettings);
            }}
          />
        )}
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
        </div>

        <div className="vg-header-center">
          <h1 className="vg-title">THE GOD REALM</h1>
          <span className="vg-subtitle">{TAB_SUBTITLES[displayedTab] || 'THE GOD REALM'}</span>
        </div>

        <div className="vg-header-right">
          <div className="vg-knob-group">
            <DivineKnob 
              id="tuneSemitones"
              update={update}
              label="TUNE"
              min={-24}
              max={24}
              value={tuneSemitones}
              onChange={(v) => update('tuneSemitones', v)}
              size="sm"
              suffix=" ST"
              variant="celestial"
            />
            <DivineKnob 
              id="masterVolume"
              update={update}
              label="VOLUME"
              min={-60}
              max={6}
              value={masterVolume}
              onChange={(v) => update('masterVolume', v)}
              size="sm"
              suffix=" dB"
              variant="celestial"
            />
          </div>

          {latestRelease && (
            <button
              className="vg-header-update-badge animate-pulse"
              onClick={() => setShowReleaseNotes(true)}
              aria-label="Update Available"
              title={`Upgrade available: ${latestRelease.version}`}
              style={{
                background: 'rgba(255, 215, 0, 0.12)',
                border: '1px solid var(--god-primary)',
                color: 'var(--god-primary)',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                padding: '4px 8px',
                borderRadius: '4px',
                marginRight: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 0 10px rgba(255,215,0,0.25)',
              }}
            >
              ⚡ UPDATE {latestRelease.version}
            </button>
          )}

          <button
            className={`vg-header-btn ${isMidiModalOpen ? 'active' : ''}`}
            onClick={() => setIsMidiModalOpen(true)}
            aria-label="MIDI Mapping"
            title="MIDI Mapping"
            style={{
              background: 'rgba(255, 215, 0, 0.08)',
              border: '1px solid var(--god-primary)',
              color: 'var(--god-primary)',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '9px',
              fontWeight: 800,
              letterSpacing: '0.05em',
              padding: '4px 8px',
              borderRadius: '4px',
              marginRight: '8px',
              cursor: 'pointer',
            }}
          >
            🎹 MIDI MAP
          </button>

          <button
            className={`vg-header-btn ${isSettingsOpen ? 'active' : ''}`}
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
            style={{
              background: 'rgba(255, 215, 0, 0.08)',
              border: '1px solid var(--god-primary)',
              color: 'var(--god-primary)',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '12px',
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: '4px',
              marginRight: '8px',
              cursor: 'pointer',
            }}
          >
            ⚙
          </button>

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
          isPlaying={engine.state.isPlaying}
          currentStep={engine.state.currentStep}
          totalSteps={engine.state.stepCount}
        />

      {/* Quick recall bar removed */}

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

        {/* ─── ALWAYS-MOUNTED: Multi-Realm & Sample Chopper ─── */}
        {/* Kept mounted at all times so audio buffers and session state survive tab switches.   */}
        {/* isActiveTab prop gates MIDI processing so they stay silent when not the active tab. */}
        <div style={{ display: displayedTab === 'Multi-Realm' ? 'contents' : 'none' }}>
          <MultiRealmForge
            parameterValues={parameterValues}
            update={update}
            showMessage={showMessage}
            isActiveTab={displayedTab === 'Multi-Realm'}
          />
        </div>

        <div style={{ display: displayedTab === 'Sample Chopper' ? 'contents' : 'none' }}>
          <SacredChopper
            onFileDropped={(file, buffer) => {
              const baseName = file.name.replace(/\.[^.]+$/, '');
              registry.setBuffer(activePad, buffer, baseName, `file://${file.name}`);
              godEngine.current?.loadSampleFromFile(file, activePad);
              update(`slotName_${activePad}`, baseName);
              update(`slotPath_${activePad}`, `file://${file.name}`);
            }}
            onClearSample={() => {
              // Reset the active pad buffer and metadata
              registry.setBuffer(activePad, null as any, '', '');
              update(`slotName_${activePad}`, '');
              update(`slotPath_${activePad}`, '');
              update('chopMarkers', []);
            }}
            trackIndex={activePad}
            trackName={`PAD ${activePad + 1}`}
            trackColor={'#a855f7'}
            buffer={buffers[activePad] || null}
            sampleParams={{
              start: 0,
              end: 1,
              reverse: parameterValues.chopperReverse ?? false,
              slices: (parameterValues.chopMarkers || [0.25, 0.5, 0.75]).map((pos: number, i: number, arr: number[]) => ({
                start: pos,
                end: arr[i + 1] ?? 1.0,
              })),
              chopperSpeed: parameterValues.chopperSpeed ?? 1.0,
              chopperPitch: parameterValues.chopperPitch ?? 0,
              chopperFadeIn: parameterValues.chopperFadeIn ?? 25,
              chopperFadeOut: parameterValues.chopperFadeOut ?? 150,
              chopperGlide: parameterValues.chopperGlide ?? 10,
              chopperSensitivity: parameterValues.chopperSensitivity ?? 50,
              chopperTrigger: parameterValues.chopperTrigger ?? 'MIDI',
              chopperDryWet: parameterValues.chopperDryWet ?? 75,
              chopperOutputVolume: parameterValues.chopperOutputVolume ?? -3,
              chopMode: parameterValues.chopMode ?? 'Manual',
              scopeGlobal: parameterValues.scopeGlobal ?? true,
              snapToTransient: parameterValues.snapToTransient ?? true,
              snapToZero: parameterValues.snapToZero ?? true,
            }}
            onUpdateParam={(param, value) => update(param, value)}
            onClose={() => handleRealmTransition('Multi-Realm')}
            bpm={effectiveBpm}
            isActiveTab={displayedTab === 'Sample Chopper'}
            showMessage={showMessage}
            onSpreadToPads={(slices) => {
              for (let i = engine.state.tracks.length; i < slices.length && i < 16; i++) {
                engine.dispatch({ type: 'ADD_TRACK', sourceType: 'sample', name: `Slice ${i + 1}` });
              }
              slices.forEach((slice, i) => {
                if (i < 16) {
                  registry.setBuffer(i, slice.buffer, `Slice ${i + 1}`);
                  if (slice.sliceStart !== undefined) update(`slot${i}_sliceStart`, slice.sliceStart);
                  if (slice.sliceDuration !== undefined) update(`slot${i}_sliceDuration`, slice.sliceDuration);
                  engine.dispatch({ type: 'SET_TRACK_SOURCE', trackIndex: i, sourceType: 'sample' });
                  engine.dispatch({ type: 'RENAME_TRACK', trackIndex: i, name: `Slice ${i + 1}` });
                  engine.dispatch({ type: 'SET_SAMPLE_PARAM', trackIndex: i, param: 'start', value: slice.start });
                  engine.dispatch({ type: 'SET_SAMPLE_PARAM', trackIndex: i, param: 'end', value: slice.end });
                }
              });
              handleRealmTransition('Multi-Realm');
              slices.forEach((_, i) => {
                if (i < 16) {
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('throne-trigger', { detail: { padIndex: i } }));
                  }, i * 60);
                }
              });
            }}
          />
        </div>

        {/* ─── PRESET VAULT — always mounted so audio engine + state survive tab switches ─── */}
        <div style={{ display: displayedTab === 'Preset Vault' ? 'contents' : 'none' }}>
          <GodVault
            parameterValues={parameterValues}
            update={update}
            onLoadPreset={handlePresetSelect}
            showMessage={showMessage}
            isActiveTab={displayedTab === 'Preset Vault'}
            onNavigate={handleRealmTransition}
          />
        </div>

        {/* ─── PEDAL REALM (global FX rack) ─── */}
        <div style={{ display: displayedTab === 'Pedal Realm' ? 'contents' : 'none' }}>
          <PedalRealm isActiveTab={displayedTab === 'Pedal Realm'} showMessage={showMessage} />
        </div>

        {/* ─── ELECTRIC PANTHEON ─── */}
        {displayedTab === 'Electric Pantheon' && (
          <ElectricPantheon
            parameterValues={parameterValues}
            update={update}
          />
        )}

        {/* Mastering tab removed */}
      </main>

      {/* Sequencer drawer and Export overlay removed */}

      {/* ═══════════ KONTAKT KIT BROWSER (Modal) ═══════════ */}
      <KontaktKitBrowser
        isOpen={isKitBrowserOpen}
        onClose={() => setIsKitBrowserOpen(false)}
        onLoadKit={handleLoadKit}
        onPreview={(file) => godEngine.current?.previewFile(file)}
      />

      {/* Transport toolbar removed per user request */}

      {/* ═══════════ GLOBAL PIANO KEYBOARD (matches Preset Vault style) ═══════════ */}
      {displayedTab !== 'Preset Vault' && (
        <VaultPianoKeyboard />
      )}

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
            className={`vg-foot-btn-action ${isMidiModalOpen ? 'active' : ''}`}
            onClick={() => setIsMidiModalOpen(true)}
          >
            <span className="vg-foot-btn-icon">🎹</span>
            <span>MIDI MAP</span>
          </button>
        </div>
        <div className="vg-footer-right">
          <NerveMonitor
            midiState={webMidiState}
            keyboardActive={keyboardPadState.isActive}
          />
          <div className="vg-foot-info">
            <span>PLUGIN INFO</span>
            <span className="vg-foot-sub">Version 1.0.0</span>
          </div>
        </div>
      </footer>


      {/* ═══════════ SESSION SEAL DRAWER ═══════════ */}
      <SessionSealDrawer
        isOpen={isSessionDrawerOpen}
        onClose={() => setIsSessionDrawerOpen(false)}
        activeSession={activeSessionName}
        onSave={handleSessionSave}
        onLoad={handleSessionLoad}
      />

      {/* ═══════════ FLOATING PLUGIN WINDOWS ═══════════ */}
      <PluginWindowLayer />
      <PluginWindowBar />

      {/* ═══════════ MIDI MAPPING MODAL ═══════════ */}
      <MidiMappingModal
        isOpen={isMidiModalOpen}
        onClose={() => setIsMidiModalOpen(false)}
        noteMap={midiMap}
        onNoteMapChange={setMidiMap}
        ccMappings={ccMappings}
        onCCMappingsChange={handleCCMappingsChange}
        midiDevices={webMidiState.devices.map(d => ({ id: d.id, name: d.name }))}
      />

      {/* ═══════════ DIVINE SETTINGS PANEL ═══════════ */}
      <DivineSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* ═══════════ RELEASE NOTES MODAL ═══════════ */}
      {showReleaseNotes && latestRelease && (
        <ReleaseNotesModal
          release={latestRelease}
          onClose={() => setShowReleaseNotes(false)}
          activeSettings={activeSettings}
        />
      )}

      {/* ═══════════ NEURAL SUGGESTION PANEL ═══════════ */}
      <NeuralSuggestPanel
        isOpen={isNeuralPanelOpen}
        onClose={() => setIsNeuralPanelOpen(false)}
        activeSlots={Array.from({ length: 16 }).map((_, i) => ({
          name: parameterValues[`slotName_${i}`] || `Throne ${i + 1}`,
          enabled: parameterValues[`slotPower_${i}`] !== false,
          vol: parameterValues[`slotVol_${i}`] ?? 75
        }))}
        onApplySuggestion={handleApplyNeuralSuggestion}
      />

      {/* ═══════════ DIVINE CUSTOM PRESET MODALS ═══════════ */}
      <DivinePresetModal
        isOpen={presetModalOpen}
        onClose={() => setPresetModalOpen(false)}
        onSave={presetModalConfig?.onSave || (() => {})}
        defaultName={presetModalConfig?.defaultName}
      />

      <DivineConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmModalConfig?.onConfirm || (() => {})}
        title={confirmModalConfig?.title || ''}
        description={confirmModalConfig?.description || ''}
        confirmLabel={confirmModalConfig?.confirmLabel}
        cancelLabel={confirmModalConfig?.cancelLabel}
        isDestructive={confirmModalConfig?.isDestructive}
      />

      </div>

      {/* Right Rack Ear */}
      <div className="vg-rack-ear vg-rack-ear--right">
        <div className="vg-rack-screw-slot">
          <div className="vg-rack-screw vg-rack-screw--top" />
        </div>
        <div className="vg-rack-handle" />
        <div className="vg-rack-screw-slot">
          <div className="vg-rack-screw vg-rack-screw--bottom" />
        </div>
      </div>
      </div>
    </div>
    </PluginWindowProvider>
  );
};

export default VstgodthegodrealmPlugin;
