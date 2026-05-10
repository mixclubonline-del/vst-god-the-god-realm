import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Link2 } from 'lucide-react';

interface SoundSlotProps {
  id: number;
  name: string;
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
      className={`vg-sound-slot ${isActive ? 'vg-sound-slot-active' : ''} relative overflow-hidden`}
      onClick={onSelect}
    >
      {/* Spectral Glow Overlay */}
      {level > 0.05 && (
        <div 
          className="absolute inset-0 bg-red-500/10 pointer-events-none transition-opacity duration-75 mix-blend-screen" 
          style={{ opacity: level * 0.4, filter: 'blur(30px)' }}
        />
      )}

      <div className="vg-slot-header relative z-10">
        <div 
          className={`vg-slot-power ${isPowered ? 'vg-slot-power-on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            const next = !isPowered;
            update(`slotPower_${id}`, next);
            onToggle(next);
          }}
        >
          {isPowered && level > 0.05 && (
            <motion.div 
              className="absolute inset-[-4px] border border-red-500/40 rounded-full"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
            />
          )}
        </div>
        <div className="vg-slot-name" title={name}>{name || 'EMPTY SLOT'}</div>
        <div className="text-[8px] text-white/20 font-bold">●</div>
      </div>

      <div className="vg-slot-viz">
         {/* High-fidelity wave simulation driven by level */}
         <div className="flex items-end gap-[1px] h-3/4">
           {Array.from({ length: 24 }).map((_, i) => {
             const baseH = Math.abs(Math.sin(i * 0.8 + id)) * 30;
             const h = 5 + (level * 90) + (level > 0.05 ? baseH : 0);
             return (
               <div 
                 key={i}
                 className="w-[2px] rounded-full bg-gradient-to-t from-red-500/60 to-transparent transition-all duration-75"
                 style={{ 
                   height: `${isPowered ? h : 4}%`,
                   opacity: isPowered ? (0.3 + level * 0.7) : 0.1,
                   boxShadow: level > 0.1 ? `0 0 ${level * 20}px rgba(255,102,0,0.3)` : 'none'
                 }}
               />
             );
           })}
         </div>
      </div>

      <div className="vg-slot-knobs">
        <div className="flex flex-col items-center gap-1 group/knob relative">
          <span className="text-[7px] font-bold text-white/30 uppercase">Vol</span>
          <div 
            className="w-8 h-8 rounded-full border border-white/10 relative bg-black/20 cursor-ns-resize"
            onDoubleClick={() => update(`slotVol_${id}`, 75)}
          >
             <div className="absolute top-1 left-1/2 -ml-[0.5px] w-[1.5px] h-2.5 bg-red-500/80 rounded-full" 
                  style={{ transformOrigin: 'bottom', transform: `rotate(${(vol/100)*270 - 135}deg)` }} />
             <input 
               type="range" 
               className="absolute inset-0 opacity-0 cursor-pointer"
               value={vol}
               onChange={(e) => update(`slotVol_${id}`, +e.target.value)}
             />
             <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-[8px] px-1 rounded opacity-0 group-hover/knob:opacity-100 pointer-events-none transition-opacity whitespace-nowrap border border-white/10">
                {vol === 0 ? '-INF' : `${((vol/100)*6 - 6).toFixed(1)} dB`}
             </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 group/knob relative">
          <span className="text-[7px] font-bold text-white/30 uppercase">Pan</span>
          <div 
            className="w-8 h-8 rounded-full border border-white/10 relative bg-black/20 cursor-ns-resize"
            onDoubleClick={() => update(`slotPan_${id}`, 50)}
          >
             <div className="absolute top-1 left-1/2 -ml-[0.5px] w-[1.5px] h-2.5 bg-white/40 rounded-full" 
                  style={{ transformOrigin: 'bottom', transform: `rotate(${(pan/100)*270 - 135}deg)` }} />
             <input 
               type="range" 
               className="absolute inset-0 opacity-0 cursor-pointer"
               value={pan}
               onChange={(e) => update(`slotPan_${id}`, +e.target.value)}
             />
             <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-[8px] px-1 rounded opacity-0 group-hover/knob:opacity-100 pointer-events-none transition-opacity whitespace-nowrap border border-white/10">
                {pan === 50 ? 'C' : (pan < 50 ? `L${Math.round((50-pan)*2)}` : `R${Math.round((pan-50)*2)}`)}
             </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 group/knob relative">
          <span className="text-[7px] font-bold text-white/30 uppercase">Tune</span>
          <div 
            className="w-8 h-8 rounded-full border border-white/10 relative bg-black/20 cursor-ns-resize"
            onDoubleClick={() => update(`slotTune_${id}`, 50)}
          >
             <div className="absolute top-1 left-1/2 -ml-[0.5px] w-[1.5px] h-2.5 bg-orange-400/60 rounded-full" 
                  style={{ transformOrigin: 'bottom', transform: `rotate(${(tune/100)*270 - 135}deg)` }} />
             <input 
               type="range" 
               className="absolute inset-0 opacity-0 cursor-pointer"
               value={tune}
               onChange={(e) => update(`slotTune_${id}`, +e.target.value)}
             />
             <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-[8px] px-1 rounded opacity-0 group-hover/knob:opacity-100 pointer-events-none transition-opacity whitespace-nowrap border border-white/10">
                {Math.round((tune/100)*24 - 12)} ST
             </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 group/knob relative">
          <span className="text-[7px] font-bold text-red-500/60 uppercase">Texture</span>
          <div 
            className="w-8 h-8 rounded-full border border-red-500/20 relative bg-red-500/5 group cursor-ns-resize"
            onDoubleClick={() => update(`slotTexture_${id}`, 40)}
          >
             <div className="absolute inset-1 rounded-full border border-red-500/10 group-hover:border-red-500/40 transition-colors" />
             <div className="absolute top-1 left-1/2 -ml-[0.5px] w-[1.5px] h-2.5 bg-red-500 rounded-full" 
                  style={{ transformOrigin: 'bottom', transform: `rotate(${(texture/100)*270 - 135}deg)` }} />
             <input 
               type="range" 
               className="absolute inset-0 opacity-0 cursor-pointer"
               value={texture}
               onChange={(e) => update(`slotTexture_${id}`, +e.target.value)}
             />
             <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-[8px] px-1 rounded opacity-0 group-hover/knob:opacity-100 pointer-events-none transition-opacity whitespace-nowrap border border-white/10">
                DRIVE: {Math.round(texture)}
             </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[7px] font-bold text-white/30 uppercase">Fine</span>
          <div className="w-8 h-8 rounded-full border border-white/10 relative bg-black/20">
             <div className="absolute top-1 left-1/2 -ml-[0.5px] w-[1.5px] h-2.5 bg-white/10 rounded-full" 
                  style={{ transformOrigin: 'bottom', transform: `rotate(${(fine/100)*270 - 135}deg)` }} />
             <input 
               type="range" 
               className="absolute inset-0 opacity-0 cursor-pointer"
               value={fine}
               onChange={(e) => update(`slotFine_${id}`, +e.target.value)}
             />
          </div>
        </div>
      </div>

      <div className="vg-slot-actions">
        <button className="vg-slot-btn">S</button>
        <button className="vg-slot-btn">M</button>
        <button className="vg-slot-btn vg-slot-btn-active"><Link2 size={10} /></button>
        <button className="vg-slot-btn"><Lock size={10} /></button>
      </div>

      <div className="vg-slot-keys">
         <span className="vg-key-range">C-2</span>
         <div className="flex-1 flex gap-[1px] items-end h-3 px-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={`flex-1 h-full rounded-t-[1px] ${[1,3,6,8,10].includes(i) ? 'bg-white/5 h-2/3' : 'bg-white/20'}`} />
            ))}
         </div>
         <span className="vg-key-range">G#1</span>
      </div>
    </div>
  );
};
