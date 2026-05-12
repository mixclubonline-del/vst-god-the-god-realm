import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Link2, Power } from 'lucide-react';
import { DivineKnob } from './ui/DivineKnob';

interface SoundSlotProps {
  id: number;
  name: string;
  room?: string;
  category?: string;
  isActive: boolean;
  onSelect: () => void;
  onToggle: (active: boolean) => void;
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  level?: number;
}

/**
 * SoundSlot — Individual sound engine module for the Multi-Realm stack.
 * Features specialized controls for per-layer synthesis parameters.
 */
export const SoundSlot: React.FC<SoundSlotProps> = ({
  id,
  name,
  room,
  category,
  isActive,
  onSelect,
  onToggle,
  parameterValues,
  update,
  level = 0
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
      onClick={onSelect}
    >
      {/* Divine Aura Background */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-br from-mixx-accent/5 to-transparent pointer-events-none"
        animate={{ opacity: isPowered ? (0.1 + level * 0.5) : 0 }}
      />

      <div className="vg-slot-header relative z-10 p-3">
        <div 
          className={`cursor-pointer transition-all duration-300 ${isPowered ? 'text-mixx-accent' : 'text-white/20'}`}
          onClick={(e) => {
            e.stopPropagation();
            const next = !isPowered;
            update(`slotPower_${id}`, next);
            onToggle(next);
          }}
        >
          <Power size={14} fill={isPowered ? "currentColor" : "none"} />
        </div>
        
        <div className="vg-slot-title ml-3" title={name}>
          <div className="vg-slot-name text-[11px] font-black tracking-tighter text-white/90 uppercase">{name || 'EMPTY SLOT'}</div>
          {(room || category) && (
            <div className="vg-slot-meta text-[8px] font-bold text-white/30 uppercase tracking-widest">
              {[room, category].filter(Boolean).join(' // ')}
            </div>
          )}
        </div>
        
        <div className="ml-auto flex gap-2">
           <div className={`w-1 h-1 rounded-full ${isPowered ? 'bg-mixx-accent animate-pulse' : 'bg-white/10'}`} />
        </div>
      </div>

      {/* Visualizer Area */}
      <div className="vg-slot-viz h-24 flex items-center justify-center relative">
         <div className="flex items-end gap-[2px] h-12">
           {Array.from({ length: 32 }).map((_, i) => {
             const baseH = Math.abs(Math.sin(i * 0.4 + id)) * 40;
             const h = 5 + (level * 80) + (level > 0.05 ? baseH : 0);
             return (
               <motion.div 
                 key={i}
                 className="w-[2px] rounded-full bg-mixx-accent/40"
                 animate={{ 
                    height: isPowered ? `${h}%` : '4%',
                    opacity: isPowered ? (0.2 + level * 0.8) : 0.05,
                 }}
                 style={{ 
                    boxShadow: level > 0.1 ? `0 0 10px var(--mixx-accent-glow)` : 'none'
                 }}
               />
             );
           })}
         </div>
      </div>

      {/* Divine Control Suite */}
      <div className="vg-slot-knobs grid grid-cols-5 gap-1 p-3 bg-black/40 backdrop-blur-md border-t border-white/5">
        <DivineKnob 
          label="Vol" 
          size="sm" 
          value={vol} 
          onChange={(v) => update(`slotVol_${id}`, v)} 
          suffix="dB"
          color="var(--mixx-accent)"
        />
        <DivineKnob 
          label="Pan" 
          size="sm" 
          value={pan} 
          onChange={(v) => update(`slotPan_${id}`, v)} 
          color="#ffffff"
        />
        <DivineKnob 
          label="Tune" 
          size="sm" 
          value={tune} 
          onChange={(v) => update(`slotTune_${id}`, v)} 
          color="#fbbf24"
        />
        <DivineKnob 
          label="Txture" 
          size="sm" 
          value={texture} 
          onChange={(v) => update(`slotTexture_${id}`, v)} 
          color="#ef4444"
        />
        <DivineKnob 
          label="Fine" 
          size="sm" 
          value={fine} 
          onChange={(v) => update(`slotFine_${id}`, v)} 
          color="rgba(255,255,255,0.4)"
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
