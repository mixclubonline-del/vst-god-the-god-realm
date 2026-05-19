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
  realmKnobVariant?: 'default' | 'mystical' | 'infernal' | 'celestial' | 'celestial-blue' | 'eden-green' | 'marble-gold';
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
              {/* Greek key meander pattern along the top (y=5) and bottom (y=195) */}
              <path d="M 2,5 h4 v4 h-2 v-2 h2 v2 M 10,5 h4 v4 h-2 v-2 h2 v2 M 18,5 h4 v4 h-2 v-2 h2 v2 M 26,5 h4 v4 h-2 v-2 h2 v2 M 34,5 h4 v4 h-2 v-2 h2 v2 M 42,5 h4 v4 h-2 v-2 h2 v2 M 50,5 h4 v4 h-2 v-2 h2 v2 M 58,5 h4 v4 h-2 v-2 h2 v2 M 66,5 h4 v4 h-2 v-2 h2 v2 M 74,5 h4 v4 h-2 v-2 h2 v2 M 82,5 h4 v4 h-2 v-2 h2 v2 M 90,5 h4 v4 h-2 v-2 h2 v2" />
              <path d="M 2,195 h4 v-4 h-2 v2 h2 v-2 M 10,195 h4 v-4 h-2 v2 h2 v-2 M 18,195 h4 v-4 h-2 v2 h2 v-2 M 26,195 h4 v-4 h-2 v2 h2 v-2 M 34,195 h4 v-4 h-2 v2 h2 v-2 M 42,195 h4 v-4 h-2 v2 h2 v-2 M 50,195 h4 v-4 h-2 v2 h2 v-2 M 58,195 h4 v-4 h-2 v2 h2 v-2 M 66,195 h4 v-4 h-2 v2 h2 v-2 M 74,195 h4 v-4 h-2 v2 h2 v-2 M 82,195 h4 v-4 h-2 v2 h2 v-2 M 90,195 h4 v-4 h-2 v2 h2 v-2" />
              {/* Golden lightning bolts */}
              <path d="M5,15 L12,40 L3,45 L15,70" opacity="0.4" />
              <path d="M95,15 L88,40 L97,45 L85,70" opacity="0.4" />
            </svg>
          )}
          {realm === 'aether' && (
            <svg className="w-full h-full text-[#ffd700]/50" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.75">
              {/* Left Pillar */}
              <g opacity="0.8">
                <rect x="2" y="188" width="8" height="8" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="0.5" />
                <rect x="3" y="185" width="6" height="3" fill="currentColor" opacity="0.4" />
                <line x1="4" y1="12" x2="4" y2="185" stroke="currentColor" strokeWidth="0.5" />
                <line x1="6" y1="12" x2="6" y2="185" stroke="currentColor" strokeWidth="0.5" />
                <line x1="8" y1="12" x2="8" y2="185" stroke="currentColor" strokeWidth="0.5" />
                <rect x="3" y="9" width="6" height="3" fill="currentColor" opacity="0.4" />
                <circle cx="3" cy="8" r="1" fill="none" stroke="currentColor" strokeWidth="0.4" />
                <circle cx="9" cy="8" r="1" fill="none" stroke="currentColor" strokeWidth="0.4" />
              </g>
              {/* Right Pillar */}
              <g opacity="0.8">
                <rect x="90" y="188" width="8" height="8" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="0.5" />
                <rect x="91" y="185" width="6" height="3" fill="currentColor" opacity="0.4" />
                <line x1="92" y1="12" x2="92" y2="185" stroke="currentColor" strokeWidth="0.5" />
                <line x1="94" y1="12" x2="94" y2="185" stroke="currentColor" strokeWidth="0.5" />
                <line x1="96" y1="12" x2="96" y2="185" stroke="currentColor" strokeWidth="0.5" />
                <rect x="91" y="9" width="6" height="3" fill="currentColor" opacity="0.4" />
                <circle cx="91" cy="8" r="1" fill="none" stroke="currentColor" strokeWidth="0.4" />
                <circle cx="97" cy="8" r="1" fill="none" stroke="currentColor" strokeWidth="0.4" />
              </g>
              {/* Top and Bottom bronze plates */}
              <path d="M10,6 H90 M10,194 H90" strokeWidth="1" opacity="0.5" />
            </svg>
          )}
          {realm === 'inferno' && (
            <svg className="w-full h-full text-[#ff3322]/40" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.75">
              {/* Molten/cracked border veins */}
              <path d="M 2 20 Q 8 40 2 60 T 9 100 T 1 140 T 8 180" opacity="0.6" strokeWidth="0.8" />
              <path d="M 98 20 Q 92 40 98 60 T 91 100 T 99 140 T 92 180" opacity="0.6" strokeWidth="0.8" />
              {/* Lava cracks at corners */}
              <path d="M 0 0 L 15 5 L 8 15 L 2 12 L 5 22 L 0 18 Z" fill="currentColor" opacity="0.2" />
              <path d="M 100 0 L 85 5 L 92 15 L 98 12 L 95 22 L 100 18 Z" fill="currentColor" opacity="0.2" />
              <path d="M 0 200 L 15 195 L 8 185 L 2 188 L 5 178 L 0 182 Z" fill="currentColor" opacity="0.2" />
              <path d="M 100 200 L 85 195 L 92 185 L 98 188 L 95 178 L 100 182 Z" fill="currentColor" opacity="0.2" />
              {/* Translucent hot glow zones */}
              <circle cx="10" cy="50" r="15" fill="currentColor" opacity="0.08" filter="blur(4px)" />
              <circle cx="90" cy="150" r="15" fill="currentColor" opacity="0.08" filter="blur(4px)" />
            </svg>
          )}
          {realm === 'eden' && (
            <svg className="w-full h-full text-[#33ff88]/45" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.5">
              {/* Twisting ivy vines */}
              <path d="M 2 10 Q 8 45 3 80 T 9 130 T 2 190" strokeWidth="0.7" />
              <path d="M 98 10 Q 92 45 97 80 T 91 130 T 98 190" strokeWidth="0.7" />
              {/* Ivy leaves along left vine */}
              <path d="M 3 35 C -1 31 1 23 6 27 C 6 33 3 35 3 35 Z" fill="currentColor" opacity="0.7" />
              <path d="M 5 70 C 9 65 11 57 6 62 C 3 66 5 70 5 70 Z" fill="currentColor" opacity="0.7" />
              <path d="M 3 115 C -1 111 1 103 6 107 C 6 113 3 115 3 115 Z" fill="currentColor" opacity="0.7" />
              <path d="M 6 155 C 11 150 13 142 8 147 C 5 151 6 155 6 155 Z" fill="currentColor" opacity="0.7" />
              {/* Ivy leaves along right vine */}
              <path d="M 97 45 C 101 41 99 33 94 37 C 94 43 97 45 97 45 Z" fill="currentColor" opacity="0.7" />
              <path d="M 95 85 C 91 80 89 72 94 77 C 97 81 95 85 95 85 Z" fill="currentColor" opacity="0.7" />
              <path d="M 97 125 C 101 121 99 113 94 117 C 94 123 97 125 97 125 Z" fill="currentColor" opacity="0.7" />
              <path d="M 94 165 C 89 160 87 152 92 157 C 95 161 94 165 94 165 Z" fill="currentColor" opacity="0.7" />
            </svg>
          )}
          {realm === 'starfield' && (
            <svg className="w-full h-full text-[#b366ff]/60" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.5">
              {/* Top Left Crystal Cluster */}
              <g transform="translate(2, 2) scale(0.65)">
                <polygon points="5,5 16,1 11,13" fill="currentColor" opacity="0.7" stroke="currentColor" strokeWidth="0.3" />
                <polygon points="5,5 11,13 1,10" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="0.3" />
                <polygon points="16,1 21,8 11,13" fill="currentColor" opacity="0.9" stroke="currentColor" strokeWidth="0.3" />
              </g>
              {/* Top Right Crystal Cluster */}
              <g transform="translate(98, 2) scale(0.65) scale(-1, 1)">
                <polygon points="5,5 16,1 11,13" fill="currentColor" opacity="0.7" stroke="currentColor" strokeWidth="0.3" />
                <polygon points="5,5 11,13 1,10" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="0.3" />
                <polygon points="16,1 21,8 11,13" fill="currentColor" opacity="0.9" stroke="currentColor" strokeWidth="0.3" />
              </g>
              {/* Bottom Left Crystal Cluster */}
              <g transform="translate(2, 198) scale(0.65) scale(1, -1)">
                <polygon points="5,5 16,1 11,13" fill="currentColor" opacity="0.7" stroke="currentColor" strokeWidth="0.3" />
                <polygon points="5,5 11,13 1,10" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="0.3" />
                <polygon points="16,1 21,8 11,13" fill="currentColor" opacity="0.9" stroke="currentColor" strokeWidth="0.3" />
              </g>
              {/* Bottom Right Crystal Cluster */}
              <g transform="translate(98, 198) scale(0.65) scale(-1, -1)">
                <polygon points="5,5 16,1 11,13" fill="currentColor" opacity="0.7" stroke="currentColor" strokeWidth="0.3" />
                <polygon points="5,5 11,13 1,10" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="0.3" />
                <polygon points="16,1 21,8 11,13" fill="currentColor" opacity="0.9" stroke="currentColor" strokeWidth="0.3" />
              </g>
              {/* Star Constellations */}
              <circle cx="20" cy="50" r="0.8" fill="white" opacity="0.8" />
              <circle cx="35" cy="40" r="0.6" fill="white" opacity="0.5" />
              <circle cx="28" cy="65" r="0.5" fill="white" opacity="0.6" />
              <line x1="20" y1="50" x2="35" y2="40" stroke="currentColor" strokeWidth="0.25" opacity="0.3" />
              <line x1="20" y1="50" x2="28" y2="65" stroke="currentColor" strokeWidth="0.25" opacity="0.3" />
              
              <circle cx="80" cy="140" r="0.8" fill="white" opacity="0.8" />
              <circle cx="70" cy="155" r="0.6" fill="white" opacity="0.5" />
              <circle cx="88" cy="165" r="0.5" fill="white" opacity="0.6" />
              <line x1="80" y1="140" x2="70" y2="155" stroke="currentColor" strokeWidth="0.25" opacity="0.3" />
              <line x1="80" y1="140" x2="88" y2="165" stroke="currentColor" strokeWidth="0.25" opacity="0.3" />
            </svg>
          )}
          {realm === 'celestial' && (
            <svg className="w-full h-full text-[#00d4ff]/40" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.4">
              {/* Grid cockpit borders */}
              <rect x="3" y="3" width="94" height="194" strokeWidth="0.4" strokeDasharray="1,5" />
              {/* Target rings */}
              <circle cx="50" cy="100" r="30" strokeWidth="0.3" strokeDasharray="2,8" />
              <circle cx="50" cy="100" r="45" strokeWidth="0.2" />
              <circle cx="50" cy="100" r="12" strokeWidth="0.4" strokeDasharray="1,2" />
              {/* Crosshairs */}
              <line x1="50" y1="40" x2="50" y2="60" strokeWidth="0.4" />
              <line x1="50" y1="140" x2="50" y2="160" strokeWidth="0.4" />
              <line x1="10" y1="100" x2="30" y2="100" strokeWidth="0.4" />
              <line x1="70" y1="100" x2="90" y2="100" strokeWidth="0.4" />
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
