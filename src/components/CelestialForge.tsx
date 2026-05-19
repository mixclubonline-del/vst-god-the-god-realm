import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '@/styles/CelestialForge.css';
import { useJuceBridge } from '@/hooks/useJuceBridge';
import { nativeAudio, MasteringBridgeParams } from '@/native/bridge';
import { MasterMeter } from './ui/MasterMeter';
import { HardwareScrew } from './ui/HardwareScrew';
import { DivineKnob } from './ui/DivineKnob';

/* GodKnobV2 has been retired — all mastering knobs now use DivineKnob with variant="celestial" */

interface SunDiskProps {
  levels: { peak: number; rms: number; reduction: number };
}

const SunDisk: React.FC<SunDiskProps> = ({ levels }) => {
  return (
    <div className="vg-sun-disk-wrap">
      {/* Solar Corona (The Atmosphere) */}
      <motion.div 
        className="absolute inset-0 rounded-full"
        animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.5, 0.8, 0.5],
            rotate: [0, 180, 360]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        style={{ 
            background: 'radial-gradient(circle, var(--god-primary) 0%, transparent 70%)',
            filter: 'blur(70px)',
            zIndex: 0
        }}
      />
      <div 
        className="absolute inset-0 rounded-full mix-blend-screen pointer-events-none"
        style={{ 
            background: 'radial-gradient(circle, rgba(255, 200, 100, 0.1) 0%, transparent 60%)',
            filter: 'blur(40px)',
            zIndex: 0
        }}
      />

      {/* Holographic Scanning Grid Overlay */}
      <div className="absolute inset-10 rounded-full overflow-hidden opacity-30 mix-blend-overlay pointer-events-none border border-white/5">
        <div className="vg-scanning-grid" />
      </div>

      <svg className="vg-sun-disk-svg relative z-1 vg-chromatic-filter" viewBox="0 0 400 400">
        {/* Fractal Corona Effect (Simulated with multiple paths) */}
        {Array.from({ length: 8 }).map((_, i) => (
            <motion.circle 
                key={i}
                cx="200" cy="200" r={165 + Math.random() * 15}
                fill="none"
                stroke="var(--god-primary)"
                strokeWidth={0.5}
                strokeDasharray="2,8"
                animate={{ 
                    rotate: [0, 360],
                    opacity: [0.2, 0.5, 0.2],
                    scale: [1, 1.08, 1]
                }}
                transition={{ duration: 3 + i, repeat: Infinity, ease: 'linear' }}
            />
        ))}

        {/* Outer Circular Bounds */}
        <circle cx="200" cy="200" r="185" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        
        {/* High-Precision Peak Meter (Top Arcs) */}
        <path 
          d="M 40 200 A 160 160 0 0 1 360 200" 
          fill="none" 
          stroke="rgba(255,255,255,0.08)" 
          strokeWidth="16" 
          strokeLinecap="round" 
        />
        <motion.path 
          d="M 40 200 A 160 160 0 0 1 360 200" 
          fill="none" 
          stroke="url(#peak-gradient)" 
          strokeWidth="16" 
          strokeLinecap="round" 
          strokeDasharray="503"
          animate={{ strokeDashoffset: 503 - (503 * Math.min(Math.max(levels.peak, 0), 1)) }}
          transition={{ type: "spring", bounce: 0, duration: 0.1 }}
          style={{ filter: 'drop-shadow(0 0 16px var(--god-primary))' }}
        />

        {/* RMS Meter (Inner Bottom Arcs) */}
        <path 
          d="M 70 200 A 130 130 0 0 0 330 200" 
          fill="none" 
          stroke="rgba(255,255,255,0.08)" 
          strokeWidth="10" 
          strokeLinecap="round" 
        />
        <motion.path 
          d="M 70 200 A 130 130 0 0 0 330 200" 
          fill="none" 
          stroke="var(--god-secondary)" 
          strokeWidth="10" 
          strokeLinecap="round" 
          strokeDasharray="408"
          animate={{ strokeDashoffset: 408 - (408 * Math.min(Math.max(levels.rms, 0), 1)) }}
          transition={{ type: "tween", ease: "linear", duration: 0.15 }}
          className="opacity-90"
          style={{ filter: 'drop-shadow(0 0 8px var(--god-secondary-glow))' }}
        />

        {/* Level Ticks */}
        {Array.from({ length: 11 }).map((_, i) => {
            const angle = (i * 18) - 180;
            const x1 = 200 + 175 * Math.cos((angle * Math.PI) / 180);
            const y1 = 200 + 175 * Math.sin((angle * Math.PI) / 180);
            const x2 = 200 + 185 * Math.cos((angle * Math.PI) / 180);
            const y2 = 200 + 185 * Math.sin((angle * Math.PI) / 180);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />;
        })}

        <defs>
          <linearGradient id="peak-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff4400" />
            <stop offset="50%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#ff2200" />
          </linearGradient>
        </defs>
      </svg>

      {/* Sun Core */}
      <div className="vg-sun-disk-core z-10">
        <motion.div 
          className="vg-sun-active-gem"
          animate={{ 
              opacity: levels.reduction > 0.05 ? [0.6, 1, 0.6] : 0.3,
              scale: levels.reduction > 0.05 ? [1, 1.2, 1] : 1,
              rotate: [45, 405]
          }}
          transition={{ duration: 0.5, repeat: levels.reduction > 0.05 ? Infinity : 0 }}
          style={{ 
              boxShadow: levels.reduction > 0.05 ? '0 0 24px #FFD700, inset 0 0 8px #fff' : 'none',
              backgroundColor: levels.reduction > 0.05 ? '#FFD700' : '#333'
          }}
        />
        <span className="vg-sun-label">ACTIVE</span>
        <span className="vg-sun-sublabel">FINAL OUTPUT LEVEL</span>
        <div className="mt-2 font-mono text-[14px] text-white font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
            {Math.round((Math.max(levels.peak, 0.001) * 24 - 24) * 10) / 10} <span className="text-[8px] opacity-50">dB</span>
        </div>
      </div>
    </div>
  );
};

const AetherSaturationMatrix: React.FC<{ drive: number; tone: number }> = ({ drive, tone }) => {
  const [isInteracting, setIsInteracting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger interaction state on prop change
  useEffect(() => {
    setIsInteracting(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 1500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [drive, tone]);

  return (
    <div className="vg-aether-section glass-panel">
      <div className="flex flex-col justify-center gap-6 pr-6 border-r border-white/10">
        <div className="flex flex-col items-center">
            <span className="text-data-md text-white font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">{Math.round(drive)}%</span>
            <span className="text-[7px] font-bold text-yellow-500/80 uppercase tracking-widest mt-1">Aether Drive</span>
        </div>
        <div className="flex flex-col items-center">
            <span className="text-data-md text-white font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">{Math.round(tone)}%</span>
            <span className="text-[7px] font-bold text-yellow-500/80 uppercase tracking-widest mt-1">Harmonic Tone</span>
        </div>
      </div>

      <div className="vg-aether-viz group">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-20" 
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="laser-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--god-primary)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--god-primary)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ffcc00" stopOpacity="1" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
          </defs>

          {/* Dynamic Laser Transfer Curves */}
          {Array.from({ length: 3 }).map((_, i) => {
            const intensity = (drive / 100);
            const bend = (tone / 100) * 40 - 20;
            // The curves react dynamically but only visually pulse when interacting
            const path = `M 0 100 Q ${30 + i * 15 + bend} ${80 - intensity * 60} 100 0`;
            
            return (
              <motion.path 
                key={i}
                d={path}
                initial={false}
                animate={{ d: path, opacity: isInteracting ? [0.4, 1, 0.4] : 0.7 }}
                transition={{ 
                  d: { type: "spring", bounce: 0, duration: 0.5 },
                  opacity: isInteracting ? { duration: 0.5 + i * 0.2, repeat: Infinity } : { duration: 0.5 }
                }}
                fill="none"
                stroke="url(#laser-grad)"
                strokeWidth={1 + intensity * 1.5}
                filter="url(#glow)"
              />
            );
          })}
        </svg>

        {/* Scanline Effect - Only visible/active during interaction */}
        <AnimatePresence>
            {isInteracting && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent h-4 animate-scanline pointer-events-none" 
                />
            )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col justify-center pl-6">
          <h3 className="text-label-xs text-white/80 mb-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">SATURATION CURVE</h3>
          <div className="flex gap-2">
              <motion.div 
                  className="w-1.5 h-8 bg-yellow-500 shadow-[0_0_12px_#FFD700] rounded-full" 
                  animate={{ height: isInteracting ? [32, 40, 32] : 32 }}
                  transition={{ duration: 0.5, repeat: isInteracting ? Infinity : 0 }}
              />
              <div className="w-1 h-8 bg-white/20 rounded-full" />
              <div className="w-1 h-8 bg-white/20 rounded-full" />
          </div>
      </div>
    </div>
  );
};

const AnchorOrbits: React.FC<{ levels: Record<string, number> }> = ({ levels }) => {
  const anchors = [
    { name: 'BODY', freq: '20Hz-200Hz', class: 'body', val: levels.bodyLevel || 0.3, color: '#ff4400' },
    { name: 'AIR', freq: '10kHz-20kHz', class: 'air', val: levels.airLevel || 0.4, color: '#00ccff' },
    { name: 'SOUL', freq: '200Hz-2kHz', class: 'soul', val: levels.soulLevel || 0.5, color: '#FFD700' },
    { name: 'SILK', freq: '2kHz-10kHz', class: 'silk', val: levels.silkLevel || 0.2, color: '#cc00ff' }
  ];

  return (
    <>
      {anchors.map((a, index) => (
        <div key={a.name} className={`vg-anchor-label ${a.class}`}>
          <motion.div 
            animate={{ 
                y: [0, -5, 0],
                filter: [`drop-shadow(0 0 10px ${a.color}44)`, `drop-shadow(0 0 20px ${a.color}88)`, `drop-shadow(0 0 10px ${a.color}44)`]
            }}
            transition={{ duration: 3 + index, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center"
          >
            <span className="vg-anchor-name">{a.name}</span>
            <span className="vg-anchor-freq">{a.freq}</span>
          </motion.div>
          
          <div className="absolute -z-1 w-24 h-24 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                {/* Neural Fluid Orbs / Blobs */}
                <motion.circle 
                    cx="50" cy="50"
                    fill="none"
                    stroke={a.color}
                    strokeWidth="0.5"
                    initial={{ r: 25 + (a.val * 20), opacity: 0.1 }}
                    animate={{ 
                        r: [25 + (a.val * 20), 35 + (a.val * 15), 25 + (a.val * 20)],
                        opacity: [0.1, 0.3, 0.1]
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                />
                
                {/* Orbital Rings */}
                <motion.circle 
                    cx="50" cy="50" r={30 + (a.val * 15)}
                    fill="none"
                    stroke={a.color}
                    strokeWidth="1.5"
                    strokeDasharray="10 5 2 5"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 10 + index * 2, repeat: Infinity, ease: "linear" }}
                    style={{ opacity: 0.3 + a.val * 0.5, filter: `drop-shadow(0 0 12px ${a.color})` }}
                />
                <motion.circle 
                    cx="50" cy="50" r={40 + (a.val * 10)}
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="0.5"
                    strokeDasharray="1 4"
                    animate={{ rotate: [360, 0] }}
                    transition={{ duration: 15 + index, repeat: Infinity, ease: "linear" }}
                />
            </svg>
          </div>
        </div>
      ))}
    </>
  );
};

export const CelestialForge: React.FC<{
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  moduleLevels: Record<string, number>;
  analyser?: AnalyserNode | null;
}> = ({ parameterValues, update, moduleLevels }) => {
  // Live engine metering from JUCE bridge
  const bridgeState = useJuceBridge();

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
      
      <header className="vg-forge-header">
        <div className="flex items-center gap-6">
            <span className="text-[10px] font-black text-white/40 tracking-widest">AURA / DIVINE AUDIO</span>
            <div className="w-0.5 h-4 bg-white/20" />
            <span className="vg-forge-title">Mastering Section</span>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end">
              <span className="text-[8px] text-white/50 font-bold tracking-widest">PRESET</span>
              <span className="text-[10px] text-yellow-500 font-black drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">DEEP EMBER</span>
           </div>
           <div className="w-1 h-8 bg-yellow-500/30 rounded-full" />
           <div className="flex flex-col">
              <span className="text-[8px] text-white/50 font-bold tracking-widest">ENGINE</span>
              <span className="text-[10px] text-white font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">CELESTIAL FORGE v2</span>
           </div>
        </div>

        <div className="text-[10px] font-black text-white/40 tracking-widest">DIVINE AUDIO</div>
      </header>

      <div className="vg-forge-main">
        {/* Left Rail */}
        <aside className="vg-forge-rail">
          {/* Panel Screws */}
          <HardwareScrew className="absolute top-2 left-2 opacity-60" size={12} rotation={45} />
          <HardwareScrew className="absolute top-2 right-2 opacity-60" size={12} rotation={180} />

          {/* Calibrated Defaults */}
          <DivineKnob label="GAIN" id="masterInputGain" value={parameterValues.masterInputGain ?? 0} min={-12} max={12} unit="dB" update={bridgedUpdate} variant="celestial" />
          <DivineKnob label="DRIVE" id="masterDrive" value={parameterValues.masterDrive ?? 20} unit="%" update={bridgedUpdate} variant="celestial" />
          <DivineKnob label="COLOR" id="masterColorTilt" value={parameterValues.masterColorTilt ?? 50} unit="%" labels={["WARM", "TILT", "BRIGHT"]} update={bridgedUpdate} variant="celestial" />
          
          <div className="mt-auto p-6 glass-panel rounded-2xl">
             <span className="text-label-xs text-white/50 mb-4 block text-center drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]">Dynamics</span>
             <div className="flex gap-4">
                <DivineKnob size="sm" label="THRES" id="masterDynamicsThreshold" value={parameterValues.masterDynamicsThreshold ?? -12} min={-60} max={0} unit="dB" update={bridgedUpdate} variant="celestial" />
                <DivineKnob size="sm" label="RATIO" id="masterDynamicsRatio" value={parameterValues.masterDynamicsRatio ?? 2.0} min={1} max={10} unit=":1" update={bridgedUpdate} variant="celestial" />
             </div>
          </div>
        </aside>

        {/* Central Visualization Area */}
        <div className="vg-forge-viz-area">
          <SunDisk levels={{ 
              peak: moduleLevels.masterOutput || 0, 
              rms: (moduleLevels.masterOutput || 0) * 0.7, 
              reduction: moduleLevels.masterReduction || 0 
          }} />
          
          <AnchorOrbits levels={moduleLevels} />
          
          <div className="absolute bottom-16">
              <AetherSaturationMatrix 
                drive={parameterValues.masterDrive ?? 20} 
                tone={parameterValues.masterColorTilt ?? 50} 
              />
          </div>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-40 mix-blend-screen pointer-events-none">
             <div className="text-[28px] font-black text-white italic tracking-tighter drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]">AURA</div>
             <div className="text-[9px] font-bold text-yellow-500 uppercase tracking-[0.3em]">Mastering</div>
          </div>
        </div>

        {/* Right Rail */}
        <aside className="vg-forge-rail items-end">
          {/* Panel Screws */}
          <HardwareScrew className="absolute top-2 left-2 opacity-60" size={12} rotation={90} />
          <HardwareScrew className="absolute top-2 right-2 opacity-60" size={12} rotation={270} />

          <DivineKnob label="COLD" id="masterColdExtension" value={parameterValues.masterColdExtension ?? 0} min={0} max={100} unit="%" update={bridgedUpdate} variant="mystical" color="#00ccff" />
          <div className="flex flex-col items-center">
              <span className="text-label-xs text-white/50 mb-2 drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]">CEILING</span>
              <DivineKnob label="CEILING" id="masterCeiling" value={parameterValues.masterCeiling ?? -0.1} min={-12} max={12} unit="dB" update={bridgedUpdate} variant="infernal" color="#ff2200" />
          </div>
          
          <div className="p-6 glass-panel rounded-2xl w-full">
             <div className="flex gap-4 justify-center">
                <DivineKnob size="sm" label="ATTACK" id="masterAttack" value={parameterValues.masterAttack ?? 30} min={1} max={100} unit="ms" update={bridgedUpdate} variant="celestial" />
                <DivineKnob size="sm" label="RELEASE" id="masterRelease" value={parameterValues.masterRelease ?? 100} min={10} max={1000} unit="ms" update={bridgedUpdate} variant="celestial" />
             </div>
          </div>

          <div className="p-6 glass-panel rounded-2xl w-full">
             <span className="text-label-xs text-white/50 mb-4 block text-center drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]">Stereo Field</span>
             <div className="flex gap-4 justify-center">
                <DivineKnob size="sm" label="WIDTH" id="masterWidth" value={parameterValues.masterWidth ?? 100} min={0} max={200} unit="%" update={bridgedUpdate} variant="mystical" color="#cc00ff" />
                <DivineKnob size="sm" label="IMAGER" id="masterImager" value={parameterValues.masterImager ?? 0} min={-1} max={1} update={bridgedUpdate} variant="mystical" color="#cc00ff" />
             </div>
          </div>

          {/* Master Output Meter */}
          <div className="mt-auto pt-4">
            <span className="text-label-xs text-white/50 mb-2 block text-center drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]">OUTPUT</span>
            <MasterMeter 
              left={bridgeState.masterPeak.left}
              right={bridgeState.masterPeak.right}
              height={140}
            />
          </div>
        </aside>
      </div>

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
