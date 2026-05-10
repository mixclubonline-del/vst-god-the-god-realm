import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface MultiControlPanelProps {
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  currentStep?: number;
  vortexAnchors?: Array<{x: number, y: number, name: string}>;
  onSaveVortexAnchor?: (x: number, y: number, name: string) => void;
}

/**
 * MultiControlPanel — The strategic heart of the God Realm.
 * Houses EQ, X/Y Morph, Arp/Gate, and Global Macro systems.
 */
export const MultiControlPanel: React.FC<MultiControlPanelProps> = ({
  parameterValues,
  update,
  currentStep = 0,
  vortexAnchors = [],
  onSaveVortexAnchor
}) => {
  const [activePanelTab, setActivePanelTab] = useState<'EQ' | 'FILTER' | 'COMP' | 'AURA'>('EQ');
  const morphX = parameterValues.morphX || 50;
  const morphY = parameterValues.morphY || 50;
  const [isRecording, setIsRecording] = useState(false);
  const [automationPath, setAutomationPath] = useState<Array<{x: number, y: number}>>([]);

  return (
    <div className="vg-control-center">
      {/* ── Tabbed Control Panel (EQ/Filter/etc) ── */}
      <div className="vg-control-panel">
        <div className="vg-panel-tabs">
          {['EQ', 'FILTER', 'COMP', 'AURA'].map(tab => (
            <div 
              key={tab}
              className={`vg-panel-tab ${activePanelTab === tab ? 'vg-panel-tab-active' : ''}`}
              onClick={() => setActivePanelTab(tab as any)}
            >
              {tab}
            </div>
          ))}
        </div>
        
        <div className="flex-1 bg-black/40 rounded-lg border border-white/5 relative overflow-hidden">
          {activePanelTab === 'AURA' ? (
            <div className="w-full h-full p-4 flex flex-col gap-4">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-red-500 tracking-widest uppercase">The Aura Matrix</span>
                  <div className="flex gap-2">
                     {['LFO 1', 'LFO 2', 'LFO 3', 'LFO 4'].map(l => (
                        <div key={l} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[7px] font-bold text-red-500 uppercase">{l}</div>
                     ))}
                  </div>
               </div>
               <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl border border-white/5 p-3 flex flex-col justify-between">
                     <span className="text-[8px] font-bold text-white/30 uppercase">Modulation Routings</span>
                     <div className="space-y-2 mt-2">
                        {[
                          { src: 'LFO 1', target: 'Slot 1 Cutoff', amt: 45 },
                          { src: 'LFO 2', target: 'Slot 3 Drive', amt: 12 },
                          { src: 'LFO 4', target: 'Master Reverb', amt: 68 }
                        ].map((r, i) => (
                           <div key={i} className="flex items-center justify-between bg-black/20 p-2 rounded border border-white/5">
                              <span className="text-[8px] text-red-500 font-black">{r.src}</span>
                              <span className="text-[8px] text-white/40 uppercase">→</span>
                              <span className="text-[8px] text-white/60 font-bold">{r.target}</span>
                              <span className="text-[9px] font-mono text-orange-500">{r.amt}%</span>
                           </div>
                        ))}
                     </div>
                  </div>
                  <div className="bg-white/5 rounded-xl border border-white/5 p-3 flex flex-col">
                     <span className="text-[8px] font-bold text-white/30 uppercase mb-2">LFO Visualization</span>
                     <div className="flex-1 flex items-center justify-center relative">
                        <svg className="w-full h-12 overflow-visible" viewBox="0 0 100 40">
                           {/* Aura Threads */}
                           <path d="M 0 20 Q 25 0 50 20 T 100 20" fill="none" stroke="#ff6600" strokeWidth="2.5" strokeDasharray="4 6" className="drop-shadow-[0_0_8px_rgba(255,102,0,0.6)]" />
                           <path d="M 0 20 Q 25 40 50 20 T 100 20" fill="none" stroke="#ff6600" strokeWidth="1" strokeDasharray="1 10" className="opacity-20" />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-red-500/20 bg-red-500/5 animate-pulse" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-red-500/5 bg-red-500/5 blur-xl animate-pulse" />
                     </div>
                  </div>
               </div>
            </div>
          ) : (
                  <>
                  {/* EQ Curve Display */}
               <svg className="w-full h-full p-2 overflow-visible" viewBox="0 0 200 100" preserveAspectRatio="none">
                   <defs>
                      <linearGradient id="eq-grad" x1="0" y1="1" x2="0" y2="0">
                         <stop offset="0%" stopColor="rgba(255,102,0,0)" />
                         <stop offset="100%" stopColor="rgba(255,102,0,0.1)" />
                      </linearGradient>
                      <linearGradient id="freqGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,102,0,0.1)" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                   </defs>

                   {/* Background Frequency Clouds */}
                   <path 
                     d="M 0 60 Q 50 20 100 50 T 200 40 L 200 100 L 0 100 Z" 
                     fill="url(#freqGlow)"
                     className="animate-pulse opacity-40"
                     style={{ animationDuration: '4s' }}
                   />
                   
                   {/* Dynamic Frequency Response Curve */}
                   {(() => {
                      const low = ((parameterValues['god_ra_low'] || 50) - 50) * 0.8;
                      const mid = ((parameterValues['god_ra_mid'] || 50) - 50) * 0.8;
                      const pres = ((parameterValues['god_ra_presence'] || 50) - 50) * 0.8;
                      const high = ((parameterValues['god_ra_high'] || 50) - 50) * 0.8;
                      
                      const p1 = { x: 0, y: 50 - low };
                      const p2 = { x: 50, y: 50 - mid };
                      const p3 = { x: 100, y: 50 - pres };
                      const p4 = { x: 150, y: 50 - high };
                      const p5 = { x: 200, y: 50 - high };

                      const path = `M 0 50 L 0 ${p1.y} Q 25 ${p1.y} 50 ${p2.y} T 100 ${p3.y} T 150 ${p4.y} L 200 ${p5.y} L 200 50 Z`;
                      const strokePath = `M 0 ${p1.y} Q 25 ${p1.y} 50 ${p2.y} T 100 ${p3.y} T 150 ${p4.y} L 200 ${p5.y}`;

                      return (
                        <>
                          <path d={path} fill="url(#eq-grad)" />
                          <path d={strokePath} fill="none" stroke="#ff6600" strokeWidth="2" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(255,102,0,0.4)]" />
                          
                          {/* Interaction Nodes */}
                          {[p1, p2, p3, p4].map((p, i) => (
                            <g key={i} className="cursor-pointer">
                               <circle cx={p.x === 0 ? 10 : p.x} cy={p.y} r="3" fill="#ff6600" className="drop-shadow-[0_0_8px_#ff6600]" />
                               {Math.abs(50 - p.y) > 10 && (
                                 <circle cx={p.x === 0 ? 10 : p.x} cy={p.y} r="6" fill="transparent" stroke="rgba(255,102,0,0.3)" strokeWidth="1" className="animate-ping" />
                               )}
                            </g>
                          ))}
                        </>
                      );
                   })()}
                   
                   {/* Background grid lines */}
                   <line x1="0" y1="50" x2="200" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                   {[50, 100, 150].map(x => (
                     <line key={x} x1={x} y1="0" x2={x} y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                   ))}
                </svg>
            </>
          )}
        </div>
        
        <div className="grid grid-cols-4 gap-2 mt-4">
           {[
              { label: 'LOW', key: 'god_ra_low' },
              { label: 'LOW MID', key: 'god_ra_mid' },
              { label: 'HIGH MID', key: 'god_ra_presence' },
              { label: 'HIGH', key: 'god_ra_high' }
           ].map(band => {
              const val = parameterValues[band.key] || 50;
              const db = ((val - 50) / 50) * 12;
              return (
                <div key={band.label} className="flex flex-col items-center group/knob relative">
                   <div 
                     className="w-10 h-10 rounded-full border border-white/10 relative bg-black/20 group-hover/knob:border-red-500/40 transition-colors cursor-ns-resize"
                     onDoubleClick={() => update(band.key, 50)}
                   >
                      <div className="absolute top-1 left-1/2 -ml-0.5 w-1 h-2.5 bg-red-500/40 rounded-full group-hover/knob:bg-red-500/80" 
                           style={{ transform: `rotate(${(val/100)*270 - 135}deg)`, transformOrigin: 'bottom' }} />
                      <input 
                        type="range"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        value={val}
                        onChange={(e) => update(band.key, +e.target.value)}
                      />
                   </div>
                   <span className="text-[7px] font-bold text-white/20 mt-1 uppercase tracking-tighter group-hover/knob:text-white/60 transition-colors">{band.label}</span>
                   <span className="text-[8px] font-mono text-orange-500/60 font-black">
                      {db > 0 ? '+' : ''}{db.toFixed(1)} dB
                   </span>
                </div>
              );
           })}
        </div>
      </div>

      {/* ── X/Y Morph Pad ── */}
      <div className="vg-control-panel items-center group relative overflow-hidden">
         <div className="flex justify-between items-center w-full mb-2 px-1">
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">X/Y Vortex</span>
            <button 
              onClick={() => {
                if (isRecording) {
                  setIsRecording(false);
                  update('automationPath', automationPath);
                } else {
                  setIsRecording(true);
                  setAutomationPath([]);
                }
              }}
              className={`w-3 h-3 rounded-full border transition-all ${isRecording ? 'bg-red-500 border-red-500 animate-pulse shadow-[0_0_8px_#ff0000]' : 'bg-white/10 border-white/20 hover:border-red-500'}`} 
            />
         </div>
         <div 
           className="vg-morph-pad w-full relative"
           onMouseDown={(e) => {
             const rect = e.currentTarget.getBoundingClientRect();
             const handleMove = (ev: MouseEvent) => {
               const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
               const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
               update('morphX', x);
               update('morphY', y);
               if (isRecording) {
                 setAutomationPath(prev => [...prev.slice(-49), {x, y}]); // Keep last 50 points for trail
               }
             };
             window.addEventListener('mousemove', handleMove);
             window.addEventListener('mouseup', () => window.removeEventListener('mousemove', handleMove), { once: true });
             handleMove(e.nativeEvent);
           }}
         >
            {/* Mood Pins */}
            {[
              { label: 'ETHEREAL', x: 15, y: 15, color: '#00ffff' },
              { label: 'DIVINE', x: 85, y: 15, color: '#ffd700' },
              { label: 'ABYSSAL', x: 15, y: 85, color: '#9933ff' },
              { label: 'AGGRESSIVE', x: 85, y: 85, color: '#ff3333' }
            ].map(pin => (
              <div 
                key={pin.label}
                className="absolute pointer-events-none flex flex-col items-center opacity-10 group-hover:opacity-30 transition-opacity"
                style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div className="w-1 h-1 rounded-full mb-1" style={{ backgroundColor: pin.color }} />
                <span className="text-[5px] font-black text-white tracking-[0.2em]">{pin.label}</span>
              </div>
            ))}

            <div className="vg-morph-vortex" />
            
            {/* Vortex Memory Pins (Phase 5) */}
            {vortexAnchors.map((anchor, i) => (
              <motion.div 
                key={`anchor-${i}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.6 }}
                className="absolute w-2 h-2 rounded-full border border-red-500/40 bg-red-500/10 shadow-[0_0_8px_rgba(255,102,0,0.3)] cursor-pointer hover:scale-125 hover:opacity-100 transition-all z-20"
                style={{ left: `${anchor.x}%`, top: `${anchor.y}%`, transform: 'translate(-50%, -50%)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  update('morphX', anchor.x);
                  update('morphY', anchor.y);
                }}
              />
            ))}
            
            {/* Automation Trail */}
            {automationPath.length > 0 && (
              <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
                <polyline 
                  points={automationPath.map(p => `${(p.x/100)*160},${(p.y/100)*160}`).join(' ')}
                  fill="none"
                  stroke="rgba(255,102,0,0.2)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}

            <motion.div 
              className="vg-morph-handle shadow-[0_0_15px_rgba(255,102,0,0.4)]"
              animate={{ left: `${morphX}%`, top: `${morphY}%` }}
              transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            />

             {/* Pin Button */}
             <div className="absolute top-2 right-2 flex gap-1 z-30">
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   const name = prompt('Anchor Name:', `Loop ${vortexAnchors.length + 1}`);
                   if (name && onSaveVortexAnchor) onSaveVortexAnchor(morphX, morphY, name);
                 }}
                 className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-[6px] font-black text-red-500 hover:bg-red-500/20 transition-colors uppercase tracking-widest"
               >
                 Pin
               </button>
             </div>
          </div>

          {/* Morph Macro (Phase 5) */}
          <div className="w-full mt-4 flex flex-col gap-1">
             <div className="flex justify-between items-center px-1">
                <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">Divine Morph</span>
                <span className="text-[7px] font-mono text-red-500/60">HEAVEN ↔ HELL</span>
             </div>
             <div className="h-6 relative group/morph cursor-pointer">
                <div className="absolute inset-y-[11px] inset-x-0 h-[2px] bg-white/5 rounded-full" />
                <input 
                  type="range"
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  value={parameterValues.morphFactor || 0}
                  onChange={(e) => update('morphFactor', +e.target.value)}
                />
                <motion.div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500 border border-red-500/50 shadow-[0_0_15px_#ff0000]"
                  style={{ left: `${parameterValues.morphFactor || 0}%`, x: '-50%' }}
                />
             </div>
          </div>
       </div>

      {/* ── Arp / Gate ── */}
      <div className="vg-control-panel">
         <div className="flex justify-between items-center mb-3">
           <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Arp / Gate</span>
           <div className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[8px] font-bold text-red-500 cursor-pointer hover:bg-red-500/20">ON</div>
         </div>
         
         <div className="flex-1 bg-black/20 rounded-lg border border-white/5 flex flex-col items-center justify-center gap-2 p-2 relative overflow-hidden">
            <span className="text-[10px] font-black text-white/60 tracking-wider">DIVINE RHYTHM</span>
            <div className="flex gap-[1px] w-full items-end h-8">
               {Array.from({ length: 16 }).map((_, i) => {
                 const isActive = currentStep === i;
                 return (
                   <motion.div 
                     key={i} 
                     className={`flex-1 rounded-sm transition-all duration-75 relative group/pill ${
                       isActive 
                        ? 'bg-red-500 h-full shadow-[0_0_15px_rgba(255,102,0,0.8)]' 
                        : (i % 4 === 0 ? 'bg-red-500/30 h-3/4' : 'bg-white/10 h-1/2')
                     }`} 
                   >
                      {isActive && (
                         <motion.div 
                           className="absolute inset-0 bg-white/20 rounded-sm" 
                           animate={{ opacity: [0.2, 0.5, 0.2] }}
                           transition={{ duration: 0.5, repeat: Infinity }}
                         />
                      )}
                      <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-gradient-to-t from-black/40 to-transparent" />
                   </motion.div>
                 );
               })}
            </div>
         </div>

         <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Rate', key: 'arpRate', val: parameterValues.arpRate || 50, unit: '/16' },
              { label: 'Swing', key: 'arpSwing', val: parameterValues.arpSwing || 0, unit: '%' },
              { label: 'Gate', key: 'arpGate', val: parameterValues.arpGate || 80, unit: '%' },
              { label: 'Oct', key: 'arpOct', val: parameterValues.arpOct || 0, unit: '' }
            ].map(l => (
              <div key={l.label} className="flex flex-col items-center group/knob relative">
                 <div 
                   className="w-8 h-8 rounded-full border border-white/10 relative bg-black/20 group-hover/knob:border-red-500/40 transition-colors cursor-ns-resize"
                   onDoubleClick={() => update(l.key, l.label === 'Gate' ? 80 : 0)}
                 >
                    <div className="absolute top-1 left-1/2 -ml-[0.5px] w-[1.5px] h-2.5 bg-red-500/60 rounded-full" 
                         style={{ transform: `rotate(${(l.val/100)*270 - 135}deg)`, transformOrigin: 'bottom' }} />
                    <input 
                      type="range"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      value={l.val}
                      onChange={(e) => update(l.key, +e.target.value)}
                    />
                 </div>
                 <span className="text-[7px] font-bold text-white/20 mt-1 uppercase group-hover/knob:text-white/60 transition-colors">{l.label}</span>
                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-[8px] px-1 rounded opacity-0 group-hover/knob:opacity-100 pointer-events-none transition-opacity whitespace-nowrap border border-white/10">
                    {l.label === 'Rate' ? (l.val < 25 ? '1/4' : l.val < 50 ? '1/8' : l.val < 75 ? '1/16' : '1/32') : `${Math.round(l.val)}${l.unit}`}
                 </div>
              </div>
            ))}
         </div>
      </div>

      {/* ── Global Macros ── */}
      <div className="vg-control-panel">
         <span className="text-[9px] font-bold text-white/30 mb-4 uppercase tracking-widest text-center">Global Macros</span>
         <div className="vg-macro-grid">
            {['ENERGY', 'DIVINITY', 'WIDTH', 'REALM'].map(m => {
              const paramKey = `macro_${m.toLowerCase()}`;
              const val = parameterValues[paramKey] || 50;
              return (
                <div 
                  key={m} 
                  className="flex flex-col items-center gap-2 group/macro cursor-pointer relative"
                  onDoubleClick={() => update(paramKey, 50)}
                >
                   <div className="w-12 h-12 rounded-full border-2 border-red-500/10 flex items-center justify-center relative group-hover/macro:border-red-500/30 transition-all cursor-ns-resize">
                      <div className="absolute inset-1 rounded-full border border-white/5" />
                      <div className="w-1 h-3 bg-red-500/80 rounded-full shadow-[0_0_8px_#ff6600]" style={{ transform: `rotate(${(val/100)*270 - 135}deg)`, transformOrigin: 'bottom' }} />
                      <input 
                        type="range"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        value={val}
                        onChange={(e) => update(paramKey, +e.target.value)}
                      />
                   </div>
                   <span className="text-[8px] font-black text-white/40 tracking-tighter uppercase group-hover/macro:text-red-500/80 transition-colors">{m}</span>
                   <span className="text-[9px] font-mono text-red-500/60">{Math.round(val)}%</span>
                </div>
              );
            })}
         </div>
      </div>
    </div>
  );
};
