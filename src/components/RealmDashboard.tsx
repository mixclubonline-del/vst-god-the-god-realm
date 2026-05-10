import React from 'react';
import { motion } from 'framer-motion';
import { Wind, Zap, Waves, Disc } from 'lucide-react';

interface RealmDashboardProps {
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  onNeuralForge?: () => void;
}

/**
 * RealmDashboard — The foundational control layer of the God Realm.
 * Manages specialized Realm FX modules and the master output stage.
 */
export const RealmDashboard: React.FC<RealmDashboardProps> = ({
  parameterValues,
  update,
  onNeuralForge
}) => {
  return (
    <div className="mt-8">
      {/* ── Realm FX Rack ── */}
      <div className="vg-section-head text-red-500/60 border-red-500/10">REALM FX</div>
      <div className="vg-realm-fx-row">
        {[
          { name: 'HEAVENLY REVERB', icon: <Wind size={14} />, param: 'SIZE', val: '75%', percent: 75, color: '#00ffff' },
          { name: 'ZEUS DELAY', icon: <Zap size={14} />, param: 'TIME', val: '1/4', percent: 25, color: '#ffd700' },
          { name: 'GODLY CHORUS', icon: <Waves size={14} />, param: 'DEPTH', val: '68%', percent: 68, color: '#9933ff' },
          { name: 'DIVINE DISTORTION', icon: <Disc size={14} />, param: 'DRIVE', val: '42%', percent: 42, color: '#ff3333' },
        ].map(fx => (
          <div key={fx.name} className="vg-fx-card group cursor-pointer hover:bg-white/5 transition-all border-white/5 hover:border-red-500/20 relative overflow-hidden">
             {/* Theme-specific background animations */}
             <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none">
                {fx.name.includes('REVERB') && (
                  <motion.div 
                    className="absolute inset-0 bg-cyan-500/20 blur-xl" 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                )}
                {fx.name.includes('DELAY') && (
                  <motion.div 
                    className="absolute inset-0 bg-yellow-500/10" 
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.1, repeat: Infinity, repeatDelay: Math.random() * 2 }}
                  />
                )}
                {fx.name.includes('DISTORTION') && (
                  <div className="absolute inset-0 bg-gradient-to-t from-red-500/40 to-transparent" />
                )}
             </div>

             <div className="w-10 h-10 rounded-lg bg-red-500/5 flex items-center justify-center text-red-500 group-hover:bg-red-500/20 transition-colors relative z-10">
                {fx.icon}
             </div>
             <div className="flex-1 flex flex-col gap-1 relative z-10">
                <div className="flex justify-between items-center">
                   <span className="text-[8px] font-black text-white/40 tracking-tighter uppercase group-hover:text-white/60">{fx.name}</span>
                   <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ color: fx.color, backgroundColor: 'currentColor' }} />
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-[7px] font-bold text-white/10 uppercase tracking-widest">{fx.param}</span>
                   <span className="text-[9px] font-mono text-red-500/60">{fx.val}</span>
                </div>
                <div className="h-[2px] bg-white/5 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${fx.percent}%` }}
                     className="h-full" 
                     style={{ backgroundColor: fx.color, opacity: 0.4 }}
                   />
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* ── Master Stage ── */}
      <div className="flex gap-8 mt-8 items-end">
         <div className="flex-1 flex flex-col">
            <div className="vg-section-head text-white/20 border-white/5">MASTER</div>
            <div className="flex gap-10 p-5 bg-black/40 rounded-2xl border border-white/5 shadow-2xl">
               {[
                 { label: 'ATTACK', key: 'masterAttack', val: parameterValues.masterAttack || 10, unit: 'ms', reset: 10 },
                 { label: 'DECAY', key: 'masterDecay', val: parameterValues.masterDecay || 65, unit: 'ms', reset: 65 },
                 { label: 'SUSTAIN', key: 'masterSustain', val: parameterValues.masterSustain || 78, unit: '%', reset: 78 },
                 { label: 'RELEASE', key: 'masterRelease', val: parameterValues.masterRelease || 40, unit: 'ms', reset: 40 }
               ].map(l => (
                 <div key={l.label} className="flex flex-col items-center gap-2 group/knob cursor-pointer relative">
                    <div 
                      className="w-10 h-10 rounded-full border border-white/10 relative bg-black/20 group-hover/knob:border-red-500/40 transition-colors cursor-ns-resize"
                      onDoubleClick={() => update(l.key, l.reset)}
                    >
                       <div className="absolute top-1 left-1/2 -ml-[0.5px] w-[1.5px] h-2.5 bg-red-500/40 rounded-full group-hover/knob:bg-red-500/80" 
                            style={{ transform: `rotate(${(l.val/100)*270 - 135}deg)`, transformOrigin: 'bottom' }} />
                       <input 
                         type="range"
                         className="absolute inset-0 opacity-0 cursor-pointer"
                         value={l.val}
                         onChange={(e) => update(l.key, +e.target.value)}
                       />
                    </div>
                    <span className="text-[7px] font-bold text-white/30 uppercase tracking-tighter group-hover/knob:text-white/60 transition-colors">{l.label}</span>
                    <span className="text-[8px] font-mono text-orange-500/60 font-bold">
                       {l.unit === 'ms' ? `${Math.round((l.val/100)*5000)}` : Math.round(l.val)}{l.unit}
                    </span>
                 </div>
               ))}
               <div className="flex-1 flex items-center justify-end">
                  <button className="px-8 py-2.5 rounded-lg bg-red-500/5 border border-red-500/30 text-[10px] font-black text-red-500 tracking-[0.2em] hover:bg-red-500/10 hover:border-red-500/60 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,0,0,0.05)]">
                     LIMITER
                  </button>
               </div>
            </div>
         </div>
         
         <div className="w-64 flex flex-col items-end gap-3">
            <button 
              onClick={onNeuralForge}
              className="group relative px-6 py-4 rounded-xl bg-black/60 border border-red-500/30 overflow-hidden hover:border-red-500/60 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,102,0,0.1)]"
            >
               <div className="absolute inset-0 bg-gradient-to-tr from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
               <div className="relative flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                     👁️
                  </div>
                  <div className="flex flex-col items-start">
                     <span className="text-[10px] font-black text-red-500 tracking-[0.2em] uppercase">Neural Forge</span>
                     <span className="text-[8px] text-white/30 uppercase tracking-widest">Consult The Eye</span>
                  </div>
               </div>
            </button>
            <div className="text-[48px] font-black text-white/5 leading-[0.8] tracking-tighter pointer-events-none">
               V
            </div>
         </div>
      </div>
    </div>
  );
};
