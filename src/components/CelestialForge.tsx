import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '@/styles/CelestialForge.css';
import { useJuceBridge } from '@/hooks/useJuceBridge';
import { nativeAudio, MasteringBridgeParams } from '@/native/bridge';
import { MasterMeter } from './ui/MasterMeter';
import { HardwareScrew } from './ui/HardwareScrew';
import { DivineKnob } from './ui/DivineKnob';
import { SpectralRadarPanner } from './SpectralRadarPanner';
import { SpectralWaterfall } from './SpectralWaterfall';
import { DivineMatrix } from './DivineMatrix';
import { SolarDisk } from './SolarDisk';


/* GodKnobV2 has been retired — all mastering knobs now use DivineKnob with variant="celestial" */

interface MasteringPreset {
  id: string;
  name: string;
  description: string;
  params: {
    masterInputGain: number;
    masterDrive: number;
    masterColorTilt: number;
    masterDynamicsThreshold: number;
    masterDynamicsRatio: number;
    masterColdExtension: number;
    masterCeiling: number;
    masterAttack: number;
    masterRelease: number;
    masterWidth: number;
    masterImager: number;
    masterHeatBias: number;
    masterHeatWarmth: number;
    masterHeatCrunch: number;
  };
}

const DEFAULTS_MAP: Record<string, number> = {
  masterInputGain: 0,
  masterDrive: 20,
  masterColorTilt: 50,
  masterDynamicsThreshold: -12,
  masterDynamicsRatio: 2.0,
  masterColdExtension: 0,
  masterCeiling: -0.1,
  masterAttack: 30,
  masterRelease: 100,
  masterWidth: 100,
  masterImager: 0,
  masterHeatBias: 0,
  masterHeatWarmth: 30,
  masterHeatCrunch: 10,
};

const FACTORY_PRESETS: MasteringPreset[] = [
  {
    id: 'deep_ember',
    name: 'DEEP EMBER',
    description: 'Warm saturation, gentle low-shelf boost',
    params: {
      masterInputGain: 0,
      masterDrive: 25,
      masterColorTilt: 40,
      masterDynamicsThreshold: -12,
      masterDynamicsRatio: 2.0,
      masterColdExtension: 10,
      masterCeiling: -0.1,
      masterAttack: 30,
      masterRelease: 150,
      masterWidth: 110,
      masterImager: 0.1,
      masterHeatBias: 0.1,
      masterHeatWarmth: 40,
      masterHeatCrunch: 15
    }
  },
  {
    id: 'solar_flare',
    name: 'SOLAR FLARE',
    description: 'Aggressive drive, bright excitation',
    params: {
      masterInputGain: 1.5,
      masterDrive: 45,
      masterColorTilt: 65,
      masterDynamicsThreshold: -16,
      masterDynamicsRatio: 2.5,
      masterColdExtension: 30,
      masterCeiling: -0.2,
      masterAttack: 20,
      masterRelease: 100,
      masterWidth: 120,
      masterImager: 0.2,
      masterHeatBias: 0.3,
      masterHeatWarmth: 60,
      masterHeatCrunch: 45
    }
  },
  {
    id: 'golden_shimmer',
    name: 'GOLDEN SHIMMER',
    description: 'High-end silk & wide imaging',
    params: {
      masterInputGain: -0.5,
      masterDrive: 15,
      masterColorTilt: 55,
      masterDynamicsThreshold: -8,
      masterDynamicsRatio: 1.5,
      masterColdExtension: 45,
      masterCeiling: -0.1,
      masterAttack: 40,
      masterRelease: 200,
      masterWidth: 135,
      masterImager: 0.4,
      masterHeatBias: -0.1,
      masterHeatWarmth: 25,
      masterHeatCrunch: 5
    }
  },
  {
    id: 'volcanic_punch',
    name: 'VOLCANIC PUNCH',
    description: 'Heavy transient compression & body boost',
    params: {
      masterInputGain: 1.0,
      masterDrive: 35,
      masterColorTilt: 45,
      masterDynamicsThreshold: -18,
      masterDynamicsRatio: 3.5,
      masterColdExtension: 5,
      masterCeiling: -0.3,
      masterAttack: 10,
      masterRelease: 80,
      masterWidth: 105,
      masterImager: 0.0,
      masterHeatBias: 0.2,
      masterHeatWarmth: 50,
      masterHeatCrunch: 30
    }
  },
  {
    id: 'obsidian_wall',
    name: 'OBSIDIAN WALL',
    description: 'Max volume brick-wall limiting',
    params: {
      masterInputGain: 4.0,
      masterDrive: 10,
      masterColorTilt: 50,
      masterDynamicsThreshold: -24,
      masterDynamicsRatio: 8.0,
      masterColdExtension: 15,
      masterCeiling: -0.05,
      masterAttack: 5,
      masterRelease: 50,
      masterWidth: 100,
      masterImager: 0.0,
      masterHeatBias: 0.0,
      masterHeatWarmth: 35,
      masterHeatCrunch: 20
    }
  },
  {
    id: 'bypass',
    name: 'BYPASS',
    description: 'Zeroed out / flat mastering chain',
    params: {
      masterInputGain: 0,
      masterDrive: 0,
      masterColorTilt: 50,
      masterDynamicsThreshold: 0,
      masterDynamicsRatio: 1.0,
      masterColdExtension: 0,
      masterCeiling: 0,
      masterAttack: 30,
      masterRelease: 100,
      masterWidth: 100,
      masterImager: 0.0,
      masterHeatBias: 0.0,
      masterHeatWarmth: 0.0,
      masterHeatCrunch: 0.0
    }
  }
];

export const CelestialForge: React.FC<{
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  moduleLevels: Record<string, number>;
  analyser?: AnalyserNode | null;
}> = ({ parameterValues, update, moduleLevels }) => {
  // Live engine metering from JUCE bridge
  const bridgeState = useJuceBridge();
  const [vizMode, setVizMode] = useState<'disk' | 'radar' | 'waterfall' | 'matrix'>('disk');

  // Mastering Preset System State
  const [customPresets, setCustomPresets] = useState<MasteringPreset[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('deep_ember');
  const [saveDrawerOpen, setSaveDrawerOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Phase 4: Debounced mastering parameter sync to JUCE (60Hz max)
  const masteringSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMasteringSync = useRef<MasteringBridgeParams | null>(null);

  const syncMasteringToJuce = useCallback(() => {
    const params: MasteringBridgeParams = {
      drive: parameterValues.masterDrive ?? 20,
      silk: parameterValues.masterColorTilt ?? 50,    // ColorTilt maps to Silk anchor
      body: parameterValues.masterInputGain ?? 0,      // InputGain maps to Body anchor
      soul: parameterValues.masterDrive ?? 20,          // Drive also feeds Soul harmonic
      air: parameterValues.masterColdExtension ?? 0,    // Cold Extension maps to Air anchor
      threshold: parameterValues.masterDynamicsThreshold ?? -12,
      ceiling: parameterValues.masterCeiling ?? -0.1,
      width: parameterValues.masterWidth ?? 100,
      imager: parameterValues.masterImager ?? 0,
      volume: parameterValues.masterInputGain ?? 0,
    };
    pendingMasteringSync.current = params;

    if (!masteringSyncTimer.current) {
      masteringSyncTimer.current = setTimeout(() => {
        if (pendingMasteringSync.current) {
          nativeAudio.updateMasteringParams(pendingMasteringSync.current);
        }
        masteringSyncTimer.current = null;
      }, 16); // ~60Hz debounce
    }
  }, [parameterValues]);

  // Wrapped update that syncs to both local state and JUCE
  const bridgedUpdate = useCallback((id: string, val: any) => {
    update(id, val);
    // Queue a debounced sync after the local state update
    requestAnimationFrame(syncMasteringToJuce);
  }, [update, syncMasteringToJuce]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (masteringSyncTimer.current) {
        clearTimeout(masteringSyncTimer.current);
      }
    };
  }, []);

  // Load custom presets on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('vst_god_mastering_presets');
      if (stored) {
        setCustomPresets(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load custom mastering presets', e);
    }
  }, []);

  const allPresets = [...FACTORY_PRESETS, ...customPresets];
  const activePreset = allPresets.find(p => p.id === selectedPresetId) || FACTORY_PRESETS[0];

  const checkIsModified = useCallback(() => {
    if (!activePreset) return false;
    const keys = Object.keys(activePreset.params) as Array<keyof MasteringPreset['params']>;
    for (const key of keys) {
      const val1 = parameterValues[key] !== undefined ? parameterValues[key] : DEFAULTS_MAP[key];
      const val2 = activePreset.params[key];
      if (Math.abs(val1 - val2) > 0.05) {
        return true;
      }
    }
    return false;
  }, [parameterValues, activePreset]);

  const handleSelectPreset = (preset: MasteringPreset) => {
    setSelectedPresetId(preset.id);
    setDropdownOpen(false);
    
    // Apply parameters
    const keys = Object.keys(preset.params) as Array<keyof MasteringPreset['params']>;
    keys.forEach(key => {
      bridgedUpdate(key, preset.params[key]);
    });
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: MasteringPreset = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim().toUpperCase(),
      description: 'Custom user mastering preset',
      params: {
        masterInputGain: parameterValues.masterInputGain ?? 0,
        masterDrive: parameterValues.masterDrive ?? 20,
        masterColorTilt: parameterValues.masterColorTilt ?? 50,
        masterDynamicsThreshold: parameterValues.masterDynamicsThreshold ?? -12,
        masterDynamicsRatio: parameterValues.masterDynamicsRatio ?? 2.0,
        masterColdExtension: parameterValues.masterColdExtension ?? 0,
        masterCeiling: parameterValues.masterCeiling ?? -0.1,
        masterAttack: parameterValues.masterAttack ?? 30,
        masterRelease: parameterValues.masterRelease ?? 100,
        masterWidth: parameterValues.masterWidth ?? 100,
        masterImager: parameterValues.masterImager ?? 0,
        masterHeatBias: parameterValues.masterHeatBias ?? 0,
        masterHeatWarmth: parameterValues.masterHeatWarmth ?? 30,
        masterHeatCrunch: parameterValues.masterHeatCrunch ?? 10,
      }
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem('vst_god_mastering_presets', JSON.stringify(updated));
    setSelectedPresetId(newPreset.id);
    setNewPresetName('');
    setSaveDrawerOpen(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    localStorage.setItem('vst_god_mastering_presets', JSON.stringify(updated));
    if (selectedPresetId === id) {
      setSelectedPresetId('deep_ember');
    }
  };

  return (
    <div className="vg-celestial-forge">
      <div className="vg-forge-stone" />
      <div className="vg-forge-glyphs" />
      
      {/* Corner Screws for the Main Panel */}
      <HardwareScrew className="absolute top-4 left-4 z-20" size={18} rotation={15} />
      <HardwareScrew className="absolute top-4 right-4 z-20" size={18} rotation={120} />
      <HardwareScrew className="absolute bottom-4 left-4 z-20" size={18} rotation={210} />
      <HardwareScrew className="absolute bottom-4 right-4 z-20" size={18} rotation={315} />
      
      {/* Ambient Environmental Lighting */}
      <motion.div 
        className="vg-ambient-orb orange"
        animate={{ 
            x: [0, 100, -50, 0],
            y: [0, -100, 50, 0],
            scale: [1, 1.2, 0.8, 1],
            opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        style={{ top: '-10%', left: '-10%' }}
      />
      <motion.div 
        className="vg-ambient-orb blue"
        animate={{ 
            x: [0, -150, 100, 0],
            y: [0, 150, -100, 0],
            scale: [0.8, 1.1, 0.9, 0.8],
            opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        style={{ bottom: '-10%', right: '-10%' }}
      />
      <motion.div 
        className="vg-ambient-orb gold"
        animate={{ 
            x: [0, 200, -100, 0],
            y: [0, 50, 150, 0],
            opacity: [0.1, 0.3, 0.1]
        }}
        transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
        style={{ top: '30%', left: '40%' }}
      />
      

      <div className="vg-forge-main">
        {/* Left Rail */}
        <aside className="vg-forge-rail">
          {/* Panel Screws */}
          <HardwareScrew className="absolute top-2 left-2 opacity-60" size={12} rotation={45} />
          <HardwareScrew className="absolute top-2 right-2 opacity-60" size={12} rotation={180} />

          {/* Calibrated Defaults */}
          <div className="flex w-full justify-around mt-2">
            <DivineKnob size="sm" label="GAIN" id="masterInputGain" value={parameterValues.masterInputGain ?? 0} min={-12} max={12} unit="dB" update={bridgedUpdate} variant="celestial" />
            <DivineKnob size="sm" label="DRIVE" id="masterDrive" value={parameterValues.masterDrive ?? 20} unit="%" update={bridgedUpdate} variant="celestial" />
          </div>
          
          <DivineKnob label="COLOR" id="masterColorTilt" value={parameterValues.masterColorTilt ?? 50} unit="%" labels={["WARM", "TILT", "BRIGHT"]} update={bridgedUpdate} variant="celestial" />
          
          <div className="mt-auto flex flex-col items-center w-full">
             <span className="text-label-xs text-white/50 mb-2 block text-center drop-shadow-[0_0_4px_rgba(255,255,255,0.2)] tracking-widest uppercase">Dynamics</span>
             <div className="flex gap-2 justify-center">
                <DivineKnob size="sm" label="THRES" id="masterDynamicsThreshold" value={parameterValues.masterDynamicsThreshold ?? -12} min={-60} max={0} unit="dB" update={bridgedUpdate} variant="celestial" />
                <DivineKnob size="sm" label="RATIO" id="masterDynamicsRatio" value={parameterValues.masterDynamicsRatio ?? 2.0} min={1} max={10} unit=":1" update={bridgedUpdate} variant="celestial" />
             </div>
          </div>
        </aside>

        {/* Central Visualization Area */}
        <div className="vg-forge-viz-area">
          {vizMode === 'radar' ? (
            <SpectralRadarPanner spectralData={bridgeState.spectralData} />
          ) : vizMode === 'waterfall' ? (
            <SpectralWaterfall 
              spectralData={bridgeState.spectralData} 
              drive={parameterValues.masterDrive ?? 20}
              cold={parameterValues.masterColdExtension ?? 0}
              gain={parameterValues.masterInputGain ?? 0}
              ceiling={parameterValues.masterCeiling ?? -0.1}
              stereoWidth={parameterValues.masterWidth ?? 100}
              attack={parameterValues.masterAttack ?? 30}
              release={parameterValues.masterRelease ?? 100}
            />
          ) : vizMode === 'matrix' ? (
            <div className="relative w-full flex-1 h-full flex items-center justify-center">
              <div className="w-full flex justify-center z-20">
                  <DivineMatrix 
              spectralData={bridgeState.spectralData} 
              drive={parameterValues.masterDrive ?? 20}
              cold={parameterValues.masterColdExtension ?? 0}
              gain={parameterValues.masterInputGain ?? 0}
              ceiling={parameterValues.masterCeiling ?? -0.1}
              stereoWidth={parameterValues.masterWidth ?? 100}
              attack={parameterValues.masterAttack ?? 30}
              release={parameterValues.masterRelease ?? 100}
            />
              </div>
            </div>
          ) : (
            <div className="relative w-full flex-1 h-full flex items-center justify-center">
              <div className="relative flex justify-center items-center w-full z-30">
                <SolarDisk 
            levels={{ 
              peak: moduleLevels.masterOutput || 0, 
              rms: (moduleLevels.masterOutput || 0) * 0.7, 
              reduction: moduleLevels.masterReduction || 0 
            }} 
            moduleLevels={moduleLevels}
            spectralData={bridgeState.spectralData}
            drive={parameterValues.masterDrive}
            cold={parameterValues.masterColdExtension}
            gain={parameterValues.masterInputGain}
            stereoWidth={parameterValues.masterWidth}
            ceiling={parameterValues.masterCeiling}
            attack={parameterValues.masterAttack}
            release={parameterValues.masterRelease}
          />
              </div>
              
              {/* Hidden placeholder to keep structure balanced if needed */}
              <div className="hidden">
                  <DivineMatrix 
              spectralData={bridgeState.spectralData} 
              drive={parameterValues.masterDrive ?? 20}
              cold={parameterValues.masterColdExtension ?? 0}
              gain={parameterValues.masterInputGain ?? 0}
              ceiling={parameterValues.masterCeiling ?? -0.1}
              stereoWidth={parameterValues.masterWidth ?? 100}
              attack={parameterValues.masterAttack ?? 30}
              release={parameterValues.masterRelease ?? 100}
            />
              </div>
            </div>
          )}
          
          {vizMode === 'disk' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-40 mix-blend-screen pointer-events-none">
               <div className="text-[28px] font-black text-white italic tracking-tighter drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]">AURA</div>
               <div className="text-[9px] font-bold text-yellow-500 uppercase tracking-[0.3em]">Mastering</div>
            </div>
          )}
        </div>

        {/* Right Rail */}
        <aside className="vg-forge-rail items-center">
          {/* Panel Screws */}
          <HardwareScrew className="absolute top-2 left-2 opacity-60" size={12} rotation={90} />
          <HardwareScrew className="absolute top-2 right-2 opacity-60" size={12} rotation={270} />

          <div className="flex w-full justify-around mt-2">
            <DivineKnob size="sm" label="COLD" id="masterColdExtension" value={parameterValues.masterColdExtension ?? 0} min={0} max={100} unit="%" update={bridgedUpdate} variant="mystical" color="#00ccff" />
            <div className="flex flex-col items-center">
                <span className="text-label-xs text-white/50 mb-2 drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]">CEIL</span>
                <DivineKnob size="sm" label="CEILING" id="masterCeiling" value={parameterValues.masterCeiling ?? -0.1} min={-12} max={12} unit="dB" update={bridgedUpdate} variant="infernal" color="#ff2200" />
            </div>
          </div>
          
          <div className="flex flex-col items-center w-full mt-2">
             <span className="text-label-xs text-white/50 mb-2 block text-center drop-shadow-[0_0_4px_rgba(255,255,255,0.2)] tracking-widest uppercase">Envelopes</span>
             <div className="flex gap-2 justify-center">
                <DivineKnob size="sm" label="ATT" id="masterAttack" value={parameterValues.masterAttack ?? 30} min={1} max={100} unit="ms" update={bridgedUpdate} variant="celestial" />
                <DivineKnob size="sm" label="REL" id="masterRelease" value={parameterValues.masterRelease ?? 100} min={10} max={1000} unit="ms" update={bridgedUpdate} variant="celestial" />
             </div>
          </div>

          <div className="flex flex-col items-center w-full mt-2">
             <span className="text-label-xs text-white/50 mb-2 block text-center drop-shadow-[0_0_4px_rgba(255,255,255,0.2)] tracking-widest uppercase">Stereo Field</span>
             <div className="flex gap-2 justify-center">
                <DivineKnob size="sm" label="WIDTH" id="masterWidth" value={parameterValues.masterWidth ?? 100} min={0} max={200} unit="%" update={bridgedUpdate} variant="mystical" color="#cc00ff" />
                <DivineKnob size="sm" label="IMAGER" id="masterImager" value={parameterValues.masterImager ?? 0} min={-1} max={1} update={bridgedUpdate} variant="mystical" color="#cc00ff" />
             </div>
          </div>

          {/* Master Output Meter */}
          <div className="mt-auto pt-4 w-full flex flex-col items-center">
            <span className="text-label-xs text-white/50 mb-2 block text-center drop-shadow-[0_0_4px_rgba(255,255,255,0.2)] tracking-widest uppercase">OUTPUT</span>
            <MasterMeter 
              left={bridgeState.masterPeak.left}
              right={bridgeState.masterPeak.right}
              height={100}
            />
          </div>
        </aside>
      </div>

      <header className="vg-forge-header">
        <div className="flex items-center gap-6">
            <span className="text-[10px] font-black text-white/40 tracking-widest">AURA / DIVINE AUDIO</span>
            <div className="w-0.5 h-4 bg-white/20" />
            <span className="vg-forge-title">Mastering Section</span>
            <div className="flex bg-black/40 p-0.5 rounded-md border border-white/5 gap-0.5 ml-4">
              <button
                onClick={() => setVizMode('disk')}
                className={`px-3 py-1 text-[9px] font-bold rounded uppercase transition-all ${
                  vizMode === 'disk' 
                    ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' 
                    : 'text-white/40 hover:text-white'
                }`}
              >
                Solar Disk
              </button>
              <button
                onClick={() => setVizMode('matrix')}
                className={`px-3 py-1 text-[9px] font-bold rounded uppercase transition-all ${
                  vizMode === 'matrix' 
                    ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' 
                    : 'text-white/40 hover:text-white'
                }`}
              >
                Divine Matrix
              </button>
              <button
                onClick={() => setVizMode('radar')}
                className={`px-3 py-1 text-[9px] font-bold rounded uppercase transition-all ${
                  vizMode === 'radar' 
                    ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' 
                    : 'text-white/40 hover:text-white'
                }`}
              >
                Spectral Radar
              </button>
              <button
                onClick={() => setVizMode('waterfall')}
                className={`px-3 py-1 text-[9px] font-bold rounded uppercase transition-all ${
                  vizMode === 'waterfall' 
                    ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' 
                    : 'text-white/40 hover:text-white'
                }`}
              >
                Spectral Waterfall
              </button>
            </div>
        </div>
        
        <div className="flex items-center gap-4 relative">
           <div 
             className="flex flex-col items-end cursor-pointer group"
             onClick={() => setDropdownOpen(d => !d)}
           >
              <span className="text-[8px] text-white/50 font-bold tracking-widest group-hover:text-yellow-500 transition-colors">PRESET ▾</span>
              <span className="text-[10px] text-yellow-500 font-black drop-shadow-[0_0_8px_rgba(255,215,0,0.5)] select-none">
                {activePreset.name}{checkIsModified() ? '*' : ''}
              </span>
           </div>
           
           <div className="w-1 h-8 bg-yellow-500/30 rounded-full" />
           
           <div className="flex flex-col">
              <span className="text-[8px] text-white/50 font-bold tracking-widest">ENGINE</span>
              <span className="text-[10px] text-white font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] select-none">CELESTIAL FORGE v2</span>
           </div>

           {/* Dropdown Menu */}
           <AnimatePresence>
             {dropdownOpen && (
               <>
                 <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                 <motion.div 
                   className="absolute bottom-10 left-0 bg-[#0f0e14]/95 border border-white/10 rounded-xl p-3 w-64 shadow-[0_12px_36px_rgba(0,0,0,0.8)] z-50 backdrop-blur-md"
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 10 }}
                   transition={{ duration: 0.15 }}
                 >
                   <div className="max-h-60 overflow-y-auto flex flex-col gap-1 mb-2 pr-1 vg-scrollbar">
                     <span className="text-[7px] text-white/30 font-bold tracking-wider mb-1 px-2 uppercase block">Factory Presets</span>
                     {FACTORY_PRESETS.map(p => (
                       <button
                         key={p.id}
                         onClick={() => handleSelectPreset(p)}
                         className={`text-left px-2 py-1.5 rounded-md text-[10px] transition-all flex flex-col ${
                           selectedPresetId === p.id 
                             ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/20' 
                             : 'text-white/60 hover:text-white hover:bg-white/5'
                         }`}
                       >
                         <span className="font-bold">{p.name}</span>
                         <span className="text-[8px] text-white/40 font-mono truncate">{p.description}</span>
                       </button>
                     ))}

                     {customPresets.length > 0 && (
                       <>
                         <div className="h-[1px] bg-white/5 my-1" />
                         <span className="text-[7px] text-white/30 font-bold tracking-wider mb-1 px-2 uppercase block">Custom Presets</span>
                         {customPresets.map(p => (
                           <div
                             key={p.id}
                             onClick={() => handleSelectPreset(p)}
                             className={`px-2 py-1.5 rounded-md text-[10px] transition-all flex justify-between items-center cursor-pointer group/item ${
                               selectedPresetId === p.id 
                                 ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/20' 
                                 : 'text-white/60 hover:text-white hover:bg-white/5'
                             }`}
                           >
                             <div className="flex flex-col truncate">
                               <span className="font-bold">{p.name}</span>
                               <span className="text-[8px] text-white/40 font-mono truncate">{p.description}</span>
                             </div>
                             <button
                               onClick={(e) => handleDeletePreset(p.id, e)}
                               className="text-white/20 hover:text-red-500 transition-colors p-1 opacity-0 group-hover/item:opacity-100"
                             >
                               ✕
                             </button>
                           </div>
                         ))}
                       </>
                     )}
                   </div>

                   <div className="h-[1px] bg-white/10 my-2" />

                   {saveDrawerOpen ? (
                     <div className="flex flex-col gap-2 p-1">
                       <input 
                         type="text"
                         placeholder="PRESET NAME"
                         value={newPresetName}
                         onChange={(e) => setNewPresetName(e.target.value.toUpperCase())}
                         maxLength={20}
                         className="w-full bg-black/40 border border-white/15 rounded px-2 py-1 text-[10px] font-mono text-yellow-500 placeholder:text-white/20 uppercase"
                       />
                       <div className="flex gap-2">
                         <button 
                           onClick={handleSavePreset}
                           className="flex-1 bg-yellow-500/25 border border-yellow-500/40 hover:bg-yellow-500/35 text-yellow-500 text-[8px] font-bold py-1 rounded uppercase tracking-wider transition-colors"
                         >
                           Save
                         </button>
                         <button 
                           onClick={() => setSaveDrawerOpen(false)}
                           className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 text-[8px] font-bold py-1 rounded uppercase tracking-wider transition-colors"
                         >
                           Cancel
                         </button>
                       </div>
                     </div>
                   ) : (
                     <button
                       onClick={() => setSaveDrawerOpen(true)}
                       className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[8px] font-bold py-1.5 rounded uppercase tracking-wider transition-all"
                     >
                       + Save Current State
                     </button>
                   )}
                 </motion.div>
               </>
             )}
           </AnimatePresence>
        </div>

        <div className="text-[10px] font-black text-white/40 tracking-widest">DIVINE AUDIO</div>
      </header>

      {/* Floating Polish Effects */}
      <div className="fixed top-0 right-0 w-1/3 h-1/3 bg-yellow-500/10 blur-[150px] pointer-events-none mix-blend-screen" />
      <div className="fixed bottom-0 left-0 w-1/4 h-1/4 bg-blue-500/10 blur-[120px] pointer-events-none mix-blend-screen" />

      {/* SVG Filters for MixxTech GUI Forge */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="chromatic-aberration">
            <feOffset in="SourceGraphic" dx="1.5" dy="0" result="offset1" />
            <feOffset in="SourceGraphic" dx="-1.5" dy="0" result="offset2" />
            <feColorMatrix in="offset1" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="red" />
            <feColorMatrix in="offset2" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="cyan" />
            <feBlend in="red" in2="cyan" mode="screen" result="combined" />
            <feBlend in="combined" in2="SourceGraphic" mode="screen" />
          </filter>
        </defs>
      </svg>
    </div>
  );
};
