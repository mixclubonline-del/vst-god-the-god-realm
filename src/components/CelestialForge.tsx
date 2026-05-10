import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '@/styles/CelestialForge.css';

interface GodKnobV2Props {
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  id: string;
  update: (id: string, val: any) => void;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  labels?: [string, string, string]; // e.g. ["WARM", "TILT", "BRIGHT"]
}

export const GodKnobV2: React.FC<GodKnobV2Props> = ({
  label,
  value,
  min = 0,
  max = 100,
  unit = '',
  id,
  update,
  color = 'var(--god-primary)',
  size = 'md',
  labels
}) => {
  const rotation = ((value - min) / (max - min)) * 270 - 135;
  const sizePx = size === 'sm' ? 48 : size === 'md' ? 84 : 110;

  return (
    <div className="flex flex-col items-center group/gknob relative">
      {/* Numerical Readout Above */}
      <div className="text-[10px] font-mono text-white/80 font-bold mb-1 opacity-0 group-hover/gknob:opacity-100 transition-opacity">
        {Math.round(value * 10) / 10}{unit}
      </div>

      <div 
        className="relative flex items-center justify-center cursor-ns-resize"
        style={{ width: sizePx, height: sizePx }}
      >
        {/* Outer Value Ring (SVG) */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 overflow-visible" viewBox="0 0 100 100">
          <circle 
            cx="50" cy="50" r="46" 
            fill="none" 
            stroke="rgba(255,255,255,0.03)" 
            strokeWidth="2" 
          />
          <motion.circle 
            cx="50" cy="50" r="46" 
            fill="none" 
            stroke={color} 
            strokeWidth="3"
            strokeDasharray="289"
            strokeDashoffset={289 - (289 * (value - min) / (max - min))}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
          />
        </svg>

        {/* Knob Body with Brushed Metal Effect */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#2a2a2a] to-[#050505] shadow-[0_8px_20px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/5 flex items-center justify-center overflow-hidden">
          {/* Circular Grain Overlay */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_transparent_0%,_black_100%)] mix-blend-overlay" />
          
          {/* Glowing Indicator Line */}
          <motion.div 
            className="absolute top-1.5 w-1 rounded-full shadow-[0_0_12px_rgba(255,102,0,0.9)]"
            style={{ 
                height: size === 'sm' ? 6 : 10,
                backgroundColor: color,
                rotate: rotation,
                transformOrigin: '50% 400%' // Adjusted for rotation center
            }}
          />

          {/* Internal Glow (The Heat) */}
          <motion.div 
            className="w-1/2 h-1/2 rounded-full blur-xl"
            style={{ backgroundColor: color }}
            animate={{ 
                opacity: [0.1, 0.2, 0.1],
                scale: [0.8, 1.2, 0.8]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </div>

        <input 
          type="range"
          min={min}
          max={max}
          step="0.1"
          className="absolute inset-0 opacity-0 cursor-ns-resize"
          value={value}
          onChange={(e) => update(id, parseFloat(e.target.value))}
        />
      </div>

      <span className="text-[10px] font-black text-white/40 mt-3 uppercase tracking-[0.2em] group-hover/gknob:text-white/90 transition-colors">{label}</span>
      
      {labels && (
        <div className="flex justify-between w-full mt-1 px-1 opacity-40">
           <span className="text-[7px] font-bold">{labels[0]}</span>
           <span className="text-[7px] font-bold">{labels[1]}</span>
           <span className="text-[7px] font-bold">{labels[2]}</span>
        </div>
      )}
    </div>
  );
};

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
            scale: [1, 1.08, 1],
            opacity: [0.3, 0.5, 0.3],
            rotate: [0, 180, 360]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        style={{ 
            background: 'radial-gradient(circle, var(--god-primary) 0%, transparent 75%)',
            filter: 'blur(60px)',
            zIndex: 0
        }}
      />

      <svg className="vg-sun-disk-svg relative z-1" viewBox="0 0 400 400">
        {/* Fractal Corona Effect (Simulated with multiple paths) */}
        {Array.from({ length: 12 }).map((_, i) => (
            <motion.circle 
                key={i}
                cx="200" cy="200" r={160 + Math.random() * 20}
                fill="none"
                stroke="var(--god-primary)"
                strokeWidth={0.5}
                strokeDasharray="5,15"
                animate={{ 
                    rotate: [0, 360],
                    opacity: [0.1, 0.4, 0.1],
                    scale: [1, 1.05, 1]
                }}
                transition={{ duration: 2 + i, repeat: Infinity, ease: 'linear' }}
            />
        ))}

        {/* Outer Circular Bounds */}
        <circle cx="200" cy="200" r="185" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        
        {/* High-Precision Peak Meter (Top Arcs) */}
        <path 
          d="M 40 200 A 160 160 0 0 1 360 200" 
          fill="none" 
          stroke="rgba(255,255,255,0.02)" 
          strokeWidth="16" 
          strokeLinecap="round" 
        />
        <motion.path 
          d="M 40 200 A 160 160 0 0 1 360 200" 
          fill="none" 
          stroke="var(--god-primary)" 
          strokeWidth="16" 
          strokeLinecap="round" 
          strokeDasharray="503"
          strokeDashoffset={503 - (503 * levels.peak)}
          style={{ filter: 'drop-shadow(0 0 12px var(--god-primary))' }}
        />

        {/* RMS Meter (Inner Bottom Arcs) */}
        <path 
          d="M 70 200 A 130 130 0 0 0 330 200" 
          fill="none" 
          stroke="rgba(255,255,255,0.02)" 
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
          strokeDashoffset={408 - (408 * levels.rms)}
          className="opacity-80"
        />

        {/* Level Ticks */}
        {Array.from({ length: 11 }).map((_, i) => {
            const angle = (i * 18) - 180;
            const x1 = 200 + 175 * Math.cos((angle * Math.PI) / 180);
            const y1 = 200 + 175 * Math.sin((angle * Math.PI) / 180);
            const x2 = 200 + 185 * Math.cos((angle * Math.PI) / 180);
            const y2 = 200 + 185 * Math.sin((angle * Math.PI) / 180);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />;
        })}
      </svg>

      {/* Sun Core */}
      <div className="vg-sun-disk-core z-10">
        <motion.div 
          className="vg-sun-active-gem"
          animate={{ 
              opacity: levels.reduction > 0.05 ? [0.4, 1, 0.4] : 0.2,
              scale: levels.reduction > 0.05 ? [1, 1.3, 1] : 1,
              rotate: [45, 405]
          }}
          transition={{ duration: 0.3, repeat: levels.reduction > 0.05 ? Infinity : 0 }}
          style={{ 
              boxShadow: levels.reduction > 0.05 ? '0 0 20px #ff6600' : 'none',
              backgroundColor: levels.reduction > 0.05 ? '#ff9900' : '#444'
          }}
        />
        <span className="vg-sun-label">ACTIVE</span>
        <span className="vg-sun-sublabel">FINAL OUTPUT LEVEL</span>
        <div className="mt-2 font-mono text-[14px] text-white font-black">
            {Math.round((levels.peak * 24 - 24) * 10) / 10} <span className="text-[8px] opacity-40">dB</span>
        </div>
      </div>
    </div>
  );
};

const AetherSaturationMatrix: React.FC<{ drive: number; tone: number }> = ({ drive, tone }) => {
  return (
    <div className="vg-aether-section">
      <div className="flex flex-col justify-center gap-6 pr-6 border-r border-white/5">
        <div className="flex flex-col items-center">
            <span className="text-data-md text-white font-black">{Math.round(drive)}%</span>
            <span className="text-[7px] font-bold text-orange-500/60 uppercase tracking-widest mt-1">Aether Drive</span>
        </div>
        <div className="flex flex-col items-center">
            <span className="text-data-md text-white font-black">{Math.round(tone)}%</span>
            <span className="text-[7px] font-bold text-orange-500/60 uppercase tracking-widest mt-1">Harmonic Tone</span>
        </div>
      </div>

      <div className="vg-aether-viz group">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-10" 
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="laser-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--god-primary)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--god-primary)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--god-primary)" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Dynamic Laser Transfer Curves */}
          {Array.from({ length: 4 }).map((_, i) => {
            const intensity = (drive / 100);
            const bend = (tone / 100) * 40 - 20;
            const path = `M 0 100 Q ${30 + i * 10 + bend} ${80 - intensity * 60} 100 0`;
            
            return (
              <motion.path 
                key={i}
                d={path}
                fill="none"
                stroke="url(#laser-grad)"
                strokeWidth={0.5 + intensity * 2}
                className="drop-shadow-[0_0_8px_var(--god-primary-glow)]"
                animate={{ opacity: [0.1, 0.4, 0.1] }}
                transition={{ duration: 1 + i * 0.5, repeat: Infinity }}
              />
            );
          })}
        </svg>

        {/* Scanline Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-4 animate-scanline pointer-events-none" />
      </div>

      <div className="flex flex-col justify-center pl-6">
          <h3 className="text-label-xs text-white/60 mb-2">SATURATION CURVE</h3>
          <div className="flex gap-2">
              <div className="w-1 h-8 bg-orange-500 shadow-[0_0_8px_#ff6600]" />
              <div className="w-1 h-8 bg-white/10" />
              <div className="w-1 h-8 bg-white/10" />
          </div>
      </div>
    </div>
  );
};

const AnchorOrbits: React.FC<{ levels: Record<string, number> }> = ({ levels }) => {
  const anchors = [
    { name: 'BODY', freq: '20Hz-200Hz', class: 'body', val: levels.bodyLevel || 0.3 },
    { name: 'AIR', freq: '10kHz-20kHz', class: 'air', val: levels.airLevel || 0.4 },
    { name: 'SOUL', freq: '200Hz-2kHz', class: 'soul', val: levels.soulLevel || 0.5 },
    { name: 'SILK', freq: '2kHz-10kHz', class: 'silk', val: levels.silkLevel || 0.2 }
  ];

  return (
    <>
      {anchors.map(a => (
        <div key={a.name} className={`vg-anchor-label ${a.class}`}>
          <span className="vg-anchor-name">{a.name}</span>
          <span className="vg-anchor-freq">{a.freq}</span>
          <motion.div 
            className="w-16 h-16 absolute -z-1 rounded-full border border-orange-500/10"
            animate={{ 
                scale: [1, 1 + a.val * 1.5, 1],
                opacity: [0.1, 0.4, 0.1]
            }}
            transition={{ duration: 0.5 + Math.random(), repeat: Infinity }}
          />
        </div>
      ))}
    </>
  );
};

export const CelestialForge: React.FC<{
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  moduleLevels: Record<string, number>;
}> = ({ parameterValues, update, moduleLevels }) => {
  return (
    <div className="vg-celestial-forge">
      <div className="vg-forge-stone" />
      <div className="vg-forge-glyphs" />
      
      <header className="vg-forge-header">
        <div className="flex items-center gap-6">
            <span className="text-[10px] font-black text-white/20 tracking-widest">AURA / DIVINE AUDIO</span>
            <div className="w-0.5 h-4 bg-white/10" />
            <span className="vg-forge-title">Mastering Section</span>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end">
              <span className="text-[8px] text-white/40 font-bold tracking-widest">PRESET</span>
              <span className="text-[10px] text-orange-500 font-black">DEEP EMBER</span>
           </div>
           <div className="w-1 h-8 bg-orange-500/20" />
           <div className="flex flex-col">
              <span className="text-[8px] text-white/40 font-bold tracking-widest">ENGINE</span>
              <span className="text-[10px] text-white font-black">CELESTIAL FORGE v2</span>
           </div>
        </div>

        <div className="text-[10px] font-black text-white/20 tracking-widest">DIVINE AUDIO</div>
      </header>

      <div className="vg-forge-main">
        {/* Left Rail */}
        <aside className="vg-forge-rail">
          <GodKnobV2 label="GAIN" id="masterInputGain" value={parameterValues.masterInputGain || 0} min={-12} max={12} unit="dB" update={update} />
          <GodKnobV2 label="DRIVE" id="masterDrive" value={parameterValues.masterDrive || 75} unit="%" update={update} />
          <GodKnobV2 label="COLOR" id="masterColorTilt" value={parameterValues.masterColorTilt || 45} unit="%" labels={["WARM", "TILT", "BRIGHT"]} update={update} />
          
          <div className="mt-auto p-6 glass-panel rounded-xl border border-white/5">
             <span className="text-label-xs text-white/30 mb-4 block text-center">Dynamics</span>
             <div className="flex gap-4">
                <GodKnobV2 size="sm" label="THRES" id="masterDynamicsThreshold" value={parameterValues.masterDynamicsThreshold || -18.4} min={-60} max={0} update={update} />
                <GodKnobV2 size="sm" label="RATIO" id="masterDynamicsRatio" value={parameterValues.masterDynamicsRatio || 2.5} min={1} max={10} update={update} />
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
          
          <AetherSaturationMatrix 
            drive={parameterValues.masterDrive || 75} 
            tone={parameterValues.masterColorTilt || 45} 
          />
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-30">
             <div className="text-[24px] font-black text-white italic tracking-tighter">AURA</div>
             <div className="text-[8px] font-bold text-orange-500">Mastering</div>
          </div>
        </div>

        {/* Right Rail */}
        <aside className="vg-forge-rail items-end">
          <GodKnobV2 label="COLD" id="masterColdExtension" value={parameterValues.masterColdExtension || 45} min={0} max={100} unit="%" update={update} />
          <div className="flex flex-col items-center">
              <span className="text-label-xs text-white/30 mb-2">CEILING</span>
              <GodKnobV2 label="CEILING" id="masterCeiling" value={parameterValues.masterCeiling || 0} min={-12} max={12} unit="dB" update={update} />
          </div>
          
          <div className="p-6 glass-panel rounded-xl border border-white/5 w-full">
             <div className="flex gap-4 justify-center">
                <GodKnobV2 size="sm" label="ATTACK" id="masterAttack" value={parameterValues.masterAttack || 12} min={1} max={100} unit="ms" update={update} />
                <GodKnobV2 size="sm" label="RELEASE" id="masterRelease" value={parameterValues.masterRelease || 250} min={10} max={1000} unit="ms" update={update} />
             </div>
          </div>

          <div className="p-6 glass-panel rounded-xl border border-white/5 w-full">
             <span className="text-label-xs text-white/30 mb-4 block text-center">Stereo Field</span>
             <div className="flex gap-4 justify-center">
                <GodKnobV2 size="sm" label="WIDTH" id="masterWidth" value={parameterValues.masterWidth || 120} min={0} max={200} unit="%" update={update} />
                <GodKnobV2 size="sm" label="IMAGER" id="masterImager" value={parameterValues.masterImager || 0} min={-1} max={1} update={update} />
             </div>
          </div>
        </aside>
      </div>

      {/* Floating Polish Effects */}
      <div className="fixed top-0 right-0 w-1/3 h-1/3 bg-orange-500/5 blur-[120px] pointer-events-none" />
    </div>
  );
};
