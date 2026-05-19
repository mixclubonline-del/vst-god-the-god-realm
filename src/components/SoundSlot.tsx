import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Link2, Power } from 'lucide-react';
import { DivineKnob } from './ui/DivineKnob';

interface SoundSlotProps {
  id: number;
  name: string;
  room?: string;
  category?: string;
  realm?: string;
  realmIcon?: string;
  realmColor?: string;
  realmKnobVariant?: 'default' | 'mystical' | 'infernal' | 'celestial';
  isActive: boolean;
  onSelect: () => void;
  onToggle: (active: boolean) => void;
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  level?: number;
  midiActivity?: boolean;
}

/**
 * SoundSlot — Individual sound engine module for the Multi-Realm stack.
 * Each slot carries a unique realm identity with distinct visuals.
 */
export const SoundSlot: React.FC<SoundSlotProps> = ({
  id,
  name,
  room,
  category,
  realm,
  realmIcon,
  realmColor,
  realmKnobVariant = 'default',
  isActive,
  onSelect,
  onToggle,
  parameterValues,
  update,
  level = 0,
  midiActivity = false
}) => {
  const isPowered = parameterValues[`slotPower_${id}`] !== false;
  const vol = parameterValues[`slotVol_${id}`] || 75;
  const pan = parameterValues[`slotPan_${id}`] || 50;
  const tune = parameterValues[`slotTune_${id}`] || 50;
  const texture = parameterValues[`slotTexture_${id}`] || 40;
  const fine = parameterValues[`slotFine_${id}`] || 50;

  return (
    <div 
      className={`vg-sound-slot ${isActive ? 'vg-sound-slot-active' : ''} relative overflow-hidden group`}
      data-realm={realm}
      onClick={onSelect}
    >
      {/* Realm Ambient Animation Layer */}
      {realm && (
        <div className="realm-ambient">
          <div className="realm-deco-layer-1" />
          <div className="realm-deco-layer-2" />
        </div>
      )}

      {/* Realm Detailed SVG Background Art */}
      {realm && (
        <div className="realm-svg-backdrop opacity-[0.04] group-hover:opacity-[0.10] transition-opacity duration-500 absolute inset-0 pointer-events-none z-0">
          {realm === 'celestial' && (
            <svg className="w-full h-full text-[#00d4ff]" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <circle cx="50" cy="50" r="45" strokeWidth="0.3" strokeDasharray="3,6" />
              <circle cx="50" cy="50" r="30" strokeWidth="0.5" />
              <circle cx="50" cy="50" r="15" strokeWidth="0.3" strokeDasharray="1,4" />
              <line x1="50" y1="2" x2="50" y2="98" strokeWidth="0.2" strokeDasharray="2,8" />
              <line x1="2" y1="50" x2="98" y2="50" strokeWidth="0.2" strokeDasharray="2,8" />
            </svg>
          )}
          {realm === 'olympus' && (
            <svg className="w-full h-full text-[#ffd700]" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <path d="M50,0 L45,30 L60,25 L40,65 L55,60 L35,100" strokeWidth="0.75" />
              <path d="M20,0 L15,20 L25,18 L12,45 L22,42 L10,70" strokeWidth="0.5" opacity="0.7" />
              <path d="M80,10 L75,35 L85,32 L70,60 L80,57 L65,90" strokeWidth="0.5" opacity="0.7" />
            </svg>
          )}
          {realm === 'inferno' && (
            <svg className="w-full h-full text-[#ff3322]" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <path d="M10,90 L30,70 L25,50 L45,35 L40,10" strokeWidth="1.2" />
              <path d="M30,70 L60,65 L70,85 L90,80" strokeWidth="1" />
              <path d="M45,35 L75,30 L80,15 L95,10" strokeWidth="1.1" />
              <path d="M25,50 L5,45 L15,20 L5,5" strokeWidth="0.8" />
              <path d="M75,30 L60,45 L65,65" strokeWidth="0.9" />
            </svg>
          )}
          {realm === 'starfield' && (
            <svg className="w-full h-full text-[#b366ff]" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <polygon points="50,10 62,45 50,80 38,45" strokeWidth="0.75" />
              <polygon points="35,30 50,45 35,70 20,45" strokeWidth="0.5" />
              <polygon points="65,30 80,45 65,70 50,45" strokeWidth="0.5" />
              <path d="M15,15 L15,25 M10,20 L20,20" strokeWidth="0.5" />
              <path d="M85,15 L85,25 M80,20 L90,20" strokeWidth="0.5" />
              <path d="M85,85 L85,95 M80,90 L90,90" strokeWidth="0.5" />
              <path d="M15,85 L15,95 M10,90 L20,90" strokeWidth="0.5" />
            </svg>
          )}
          {realm === 'eden' && (
            <svg className="w-full h-full text-[#33ff88]" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <path d="M0,80 C30,90 50,70 50,50 C50,30 70,10 100,20" strokeWidth="0.75" />
              <path d="M0,20 C20,10 40,30 50,50 C60,70 80,90 100,80" strokeWidth="0.5" />
              <path d="M35,75 C30,70 35,60 45,65 C40,75 35,75 35,75 Z" fill="currentColor" opacity="0.3" />
              <path d="M65,25 C70,30 65,40 55,35 C60,25 65,25 65,25 Z" fill="currentColor" opacity="0.3" />
              <path d="M25,30 C20,35 25,45 35,40 C30,30 25,30 25,30 Z" fill="currentColor" opacity="0.3" />
              <path d="M75,70 C80,65 75,55 65,60 C70,70 75,70 75,70 Z" fill="currentColor" opacity="0.3" />
            </svg>
          )}
          {realm === 'aether' && (
            <svg className="w-full h-full text-[#ff8844]" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <path d="M30,20 C30,40 25,60 35,80 C40,85 60,85 65,80 C75,60 70,40 70,20" strokeWidth="1.5" />
              <path d="M28,23 L72,23" strokeWidth="2" />
              <line x1="38" y1="23" x2="38" y2="82" strokeWidth="0.5" />
              <line x1="44" y1="23" x2="44" y2="83" strokeWidth="0.5" />
              <line x1="50" y1="23" x2="50" y2="83" strokeWidth="0.5" />
              <line x1="56" y1="23" x2="56" y2="83" strokeWidth="0.5" />
              <line x1="62" y1="23" x2="62" y2="82" strokeWidth="0.5" />
              <rect x="42" y="80" width="16" height="6" rx="2" fill="currentColor" opacity="0.3" />
            </svg>
          )}
        </div>
      )}

      {/* Realm Corner Ornaments & Border Embellishments */}
      {realm && (
        <div className="realm-border-ornament pointer-events-none absolute inset-0 z-20">
          {realm === 'olympus' && (
            <svg className="w-full h-full text-[#ffd700]/30" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.75">
              <path d="M2,2 H15 V5 H5 V15 H2 Z" />
              <path d="M98,2 H85 V5 H95 V15 H98 Z" />
              <path d="M2,198 H15 V195 H5 V185 H2 Z" />
              <path d="M98,198 H85 V195 H95 V185 H98 Z" />
            </svg>
          )}
          {realm === 'aether' && (
            <svg className="w-full h-full text-[#d4af37]/45" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.75">
              <line x1="4" y1="5" x2="4" y2="195" strokeWidth="1.2" />
              <line x1="6" y1="10" x2="6" y2="190" strokeWidth="0.5" />
              <line x1="96" y1="5" x2="96" y2="195" strokeWidth="1.2" />
              <line x1="94" y1="10" x2="94" y2="190" strokeWidth="0.5" />
              <path d="M2,5 H9 M91,5 H98" strokeWidth="1.5" />
              <path d="M2,195 H9 M91,195 H98" strokeWidth="1.5" />
            </svg>
          )}
          {realm === 'inferno' && (
            <svg className="w-full h-full text-[#ff3322]/20" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.75">
              <path d="M0,0 L20,0 L15,10 L10,8 L8,18 L0,15 Z" fill="currentColor" opacity="0.25" />
              <path d="M100,0 L80,0 L85,10 L90,8 L92,18 L100,15 Z" fill="currentColor" opacity="0.25" />
              <path d="M0,200 L20,200 L17,190 L10,192 L8,182 L0,185 Z" fill="currentColor" opacity="0.25" />
              <path d="M100,200 L80,200 L83,190 L90,192 L92,182 L100,185 Z" fill="currentColor" opacity="0.25" />
            </svg>
          )}
          {realm === 'eden' && (
            <svg className="w-full h-full text-[#33ff88]/30" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.5">
              <path d="M2,10 Q5,30 2,60 T5,120 T2,190" />
              <path d="M98,10 Q95,30 98,60 T95,120 T98,190" />
              <path d="M2,30 Q-2,25 0,20 Q5,22 2,30" fill="currentColor" />
              <path d="M98,50 Q102,45 100,40 Q95,42 98,50" fill="currentColor" />
              <path d="M2,110 Q-2,105 0,100 Q5,102 2,110" fill="currentColor" />
              <path d="M98,140 Q102,135 100,130 Q95,132 98,140" fill="currentColor" />
            </svg>
          )}
          {realm === 'starfield' && (
            <svg className="w-full h-full text-[#b366ff]/40" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.5">
              <polygon points="2,2 12,2 7,15 2,9" fill="currentColor" opacity="0.2" />
              <polygon points="98,2 88,2 93,15 98,9" fill="currentColor" opacity="0.2" />
              <polygon points="2,198 12,198 7,183 2,191" fill="currentColor" opacity="0.2" />
              <polygon points="98,198 88,198 93,183 98,191" fill="currentColor" opacity="0.2" />
            </svg>
          )}
          {realm === 'celestial' && (
            <svg className="w-full h-full text-[#00d4ff]/25" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.4">
              <rect x="3" y="3" width="94" height="194" strokeWidth="0.4" strokeDasharray="1,8" />
              <line x1="3" y1="100" x2="8" y2="100" />
              <line x1="92" y1="100" x2="97" y2="100" />
            </svg>
          )}
        </div>
      )}

      {/* Divine Aura Background */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: isPowered ? (0.1 + level * 0.5) : 0 }}
        style={{ background: realmColor ? `radial-gradient(ellipse at center, ${realmColor}10 0%, transparent 70%)` : undefined }}
      />

      {/* MIDI 2.0 Note-On Flash */}
      {midiActivity && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-20"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            background: `radial-gradient(ellipse at center, ${realmColor || 'rgba(245,176,65,1)'}55 0%, transparent 70%)`,
            boxShadow: `inset 0 0 20px ${realmColor || 'rgba(245,176,65,0.2)'}33`
          }}
        />
      )}

      <div className="vg-slot-header relative z-10 p-3">
        {/* Power Toggle with realm color */}
        <div 
          className="cursor-pointer transition-all duration-300"
          style={{ color: isPowered ? (realmColor || 'var(--mixx-accent)') : 'rgba(255,255,255,0.2)' }}
          onClick={(e) => {
            e.stopPropagation();
            const next = !isPowered;
            update(`slotPower_${id}`, next);
            onToggle(next);
          }}
        >
          <Power size={14} fill={isPowered ? "currentColor" : "none"} />
        </div>
        
        {/* Realm Icon Badge */}
        {realmIcon && (
          <span className="text-sm ml-1 select-none" style={{ filter: isPowered ? 'none' : 'grayscale(1) opacity(0.3)' }}>
            {realmIcon}
          </span>
        )}

        <div className="vg-slot-title ml-3" title={name}>
          <div className="vg-slot-name text-[11px] font-black tracking-tighter uppercase">
            {name || 'EMPTY SLOT'}
          </div>
          {(room || category) && (
            <div className="vg-slot-meta text-[8px] font-bold text-white/30 uppercase tracking-widest">
              {[room, category].filter(Boolean).join(' // ')}
            </div>
          )}
        </div>
        
        <div className="ml-auto flex gap-2">
           <div 
             className={`w-1.5 h-1.5 rounded-full ${isPowered ? 'animate-pulse realm-power-on' : 'bg-white/10'}`}
             style={isPowered ? { background: realmColor, boxShadow: `0 0 8px ${realmColor}` } : undefined}
           />
        </div>
      </div>

      {/* Visualizer Area — Realm-Tinted Waveform */}
      <div className="vg-slot-viz h-24 flex items-center justify-center relative">
         <div className="flex items-end gap-[2px] h-12 relative z-10">
           {Array.from({ length: 32 }).map((_, i) => {
             let baseH = 0;
             let barWidth = "w-[2px]";
             let barRadius = "rounded-full";
             
             if (realm === 'celestial') {
               baseH = Math.sin(i * 0.2 + id * 1.5) * 20 + 25;
               barWidth = "w-[3px]";
             } else if (realm === 'olympus') {
               baseH = (i % 4 === 0 ? 55 : (i % 2 === 0 ? 25 : 10));
               barWidth = "w-[1.5px]";
             } else if (realm === 'inferno') {
               baseH = 15 + Math.abs(Math.sin(i * 0.1)) * 10;
               barWidth = "w-[4px]";
               barRadius = "rounded-t-[1px]";
             } else if (realm === 'starfield') {
               baseH = (i % 8 === 0 ? 60 : (i % 4 === 0 ? 30 : 8));
               barWidth = "w-[2px]";
             } else if (realm === 'eden') {
               baseH = Math.sin(i * 0.3) * 20 + Math.cos(i * 0.5) * 15 + 35;
               barWidth = "w-[2px]";
             } else if (realm === 'aether') {
               baseH = (i / 32) * 40 + 15;
               barWidth = "w-[2.5px]";
             } else {
               baseH = Math.abs(Math.sin(i * 0.4 + id)) * 40;
             }

             const h = 5 + (level * 80) + (level > 0.05 ? baseH : 0);

             return (
               <motion.div 
                 key={i}
                 className={`realm-wave-bar ${barWidth} ${barRadius}`}
                 animate={{ 
                    height: isPowered ? `${h}%` : '4%',
                    opacity: isPowered ? (0.2 + level * 0.8) : 0.05,
                 }}
                 style={{ 
                    '--bar-index': i,
                    background: realmColor || 'var(--mixx-accent)',
                    boxShadow: level > 0.1 ? `0 0 10px ${realmColor || 'var(--mixx-accent-glow)'}` : 'none'
                 } as React.CSSProperties}
               />
             );
           })}
         </div>
      </div>

      {/* Divine Control Suite — Realm-Matched Knobs */}
      <div className="vg-slot-knobs grid grid-cols-5 gap-1 p-3 bg-black/40 backdrop-blur-md border-t border-white/5">
        <DivineKnob 
          label="Vol" 
          size="sm" 
          value={vol} 
          onChange={(v) => update(`slotVol_${id}`, v)} 
          unit="dB"
          variant={realmKnobVariant}
        />
        <DivineKnob 
          label="Pan" 
          size="sm" 
          value={pan} 
          onChange={(v) => update(`slotPan_${id}`, v)} 
          variant={realmKnobVariant}
        />
        <DivineKnob 
          label="Tune" 
          size="sm" 
          value={tune} 
          onChange={(v) => update(`slotTune_${id}`, v)} 
          variant={realmKnobVariant}
        />
        <DivineKnob 
          label="Txture" 
          size="sm" 
          value={texture} 
          onChange={(v) => update(`slotTexture_${id}`, v)} 
          variant={realmKnobVariant}
        />
        <DivineKnob 
          label="Fine" 
          size="sm" 
          value={fine} 
          onChange={(v) => update(`slotFine_${id}`, v)} 
          variant={realmKnobVariant}
        />
      </div>

      <div className="vg-slot-actions flex items-center justify-between px-3 py-2 bg-black/60 border-t border-white/5">
        <div className="flex gap-1">
          <button className="vg-slot-btn w-6 h-6 rounded bg-white/5 text-[9px] font-bold text-white/40 hover:bg-white/10 transition-colors">S</button>
          <button className="vg-slot-btn w-6 h-6 rounded bg-white/5 text-[9px] font-bold text-white/40 hover:bg-white/10 transition-colors">M</button>
        </div>
        
        <div className="flex gap-2 text-white/20">
           <Link2 size={10} className={parameterValues[`slotLinked_${id}`] ? 'text-mixx-accent' : ''} />
           <Lock size={10} className={parameterValues[`slotLocked_${id}`] ? 'text-mixx-accent' : ''} />
        </div>

        <div className="vg-slot-keys flex-1 flex gap-[1px] items-end h-3 px-4 opacity-30">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={`flex-1 h-full rounded-t-[1px] ${[1,3,6,8,10].includes(i) ? 'bg-white/20 h-2/3' : 'bg-white/40'}`} />
            ))}
        </div>
      </div>
    </div>
  );
};
