import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DivineKnob } from './ui/DivineKnob';
import { DivineSlider } from './ui/DivineSlider';
import { SacredSwitch } from './ui/SacredSwitch';
import { VortexXYPad } from './ui/VortexXYPad';
import './ui/DivineKnob.css';
import './ui/DivineSlider.css';
import './ui/SacredSwitch.css';
import './ui/VortexXYPad.css';

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
  const [routings, setRoutings] = useState([
    { src: 'LFO 1', target: 'RA LOW', amt: 45, active: true },
    { src: 'LFO 2', target: 'ZEUS TIME', amt: 12, active: false },
    { src: 'LFO 4', target: 'MSTR REVERB', amt: 68, active: true },
    { src: 'MOD W', target: 'WIDTH', amt: 92, active: true }
  ]);

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
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-red-500 tracking-[0.2em] uppercase">The Aura Matrix</span>
                    <span className="text-[7px] text-white/30 uppercase tracking-widest">Divine Modulation Engine</span>
                  </div>
                  <div className="flex gap-2">
                     {['LFO 1', 'LFO 2', 'LFO 3', 'LFO 4'].map(l => (
                        <button key={l} className="px-2.5 py-1 bg-red-500/5 border border-red-500/10 rounded-md text-[7px] font-bold text-red-500/60 uppercase hover:bg-red-500/10 transition-colors">{l}</button>
                     ))}
                  </div>
               </div>

               <div className="flex-1 grid grid-cols-2 gap-6">
                  {/* Sacred Routing Table */}
                  <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4 flex flex-col relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
                     <span className="text-[8px] font-bold text-white/40 uppercase mb-3 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-red-500/40 animate-pulse" />
                       Sacred Routings
                     </span>
                     
                     <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 vg-custom-scrollbar">
                        {routings.map((r, i) => (
                           <div 
                             key={i} 
                             className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer select-none ${r.active ? 'bg-red-500/5 border-red-500/10 shadow-[inset_0_0_10px_rgba(255,0,0,0.02)]' : 'bg-black/20 border-white/5 opacity-40'}`}
                             onClick={() => {
                               setRoutings(prev => prev.map((route, idx) => 
                                 idx === i ? { ...route, active: !route.active } : route
                               ));
                             }}
                           >
                              <div className="flex items-center gap-3">
                                <div className={`w-1.5 h-1.5 rounded-full transition-all ${r.active ? 'bg-red-500 shadow-[0_0_6px_rgba(255,0,0,0.6)]' : 'bg-white/10'}`} />
                                <span className={`text-[9px] font-black tracking-tighter transition-colors ${r.active ? 'text-red-500' : 'text-white/20'}`}>{r.src}</span>
                                <span className="text-[8px] text-white/10">▶</span>
                                <span className={`text-[8px] font-bold uppercase tracking-tight transition-colors ${r.active ? 'text-white/60' : 'text-white/20'}`}>{r.target}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-red-500/40" 
                                    animate={{ width: r.active ? `${r.amt}%` : '0%' }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                  />
                                </div>
                                <span className={`text-[9px] font-mono w-6 text-right transition-colors ${r.active ? 'text-orange-500/60' : 'text-white/10'}`}>{r.amt}%</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Divine Wave Visualization */}
                  <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4 flex flex-col relative overflow-hidden">
                     <div className="absolute bottom-0 right-0 w-32 h-32 bg-red-500/5 blur-[60px] rounded-full pointer-events-none" />
                     <span className="text-[8px] font-bold text-white/40 uppercase mb-4 flex justify-between">
                       <span>Divine Wave</span>
                       <span className="font-mono text-red-500/40">1/4 TRIPLET</span>
                     </span>
                     
                     <div className="flex-1 flex items-center justify-center relative">
                        <svg className="w-full h-24 overflow-visible" viewBox="0 0 100 40">
                           <defs>
                             <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
                               <stop offset="0%" stopColor="transparent" />
                               <stop offset="50%" stopColor="#ff4444" />
                               <stop offset="100%" stopColor="transparent" />
                             </linearGradient>
                           </defs>
                           
                           {/* Layered Waves */}
                           <motion.path 
                             d="M 0 20 C 10 10, 20 10, 30 20 S 50 30, 60 20 S 80 10, 90 20 S 100 30, 110 20" 
                             fill="none" 
                             stroke="url(#waveGrad)" 
                             strokeWidth="1.5"
                             animate={{ x: [-10, 10, -10] }}
                             transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                             className="drop-shadow-[0_0_12px_rgba(255,0,0,0.5)] opacity-80"
                           />
                           <motion.path 
                             d="M -10 20 C 0 30, 10 30, 20 20 S 40 10, 50 20 S 70 30, 80 20 S 90 10, 100 20" 
                             fill="none" 
                             stroke="#ff8800" 
                             strokeWidth="0.5"
                             strokeDasharray="2 4"
                             animate={{ x: [10, -10, 10] }}
                             transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                             className="opacity-20"
                           />
                           <motion.path 
                             d="M 0 20 Q 25 5, 50 20 T 100 20" 
                             fill="none" 
                             stroke="#ff0000" 
                             strokeWidth="0.25"
                             animate={{ scaleY: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
                             transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                           />
                        </svg>

                        {/* Central Focus Orb */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12">
                          <motion.div 
                            className="absolute inset-0 rounded-full border border-red-500/20 bg-red-500/5 shadow-[0_0_20px_rgba(255,0,0,0.1)]"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <div className="absolute inset-4 rounded-full bg-red-500 blur-sm opacity-20 animate-pulse" />
                        </div>
                     </div>

                     <div className="mt-4 flex justify-between">
                       <div className="flex flex-col gap-1">
                         <span className="text-[6px] text-white/20 uppercase font-black">Symmetry</span>
                         <div className="w-16 h-[2px] bg-white/5 rounded-full overflow-hidden">
                           <div className="h-full bg-white/20 w-3/4" />
                         </div>
                       </div>
                       <div className="flex flex-col gap-1 items-end">
                         <span className="text-[6px] text-white/20 uppercase font-black">Smooth</span>
                         <div className="w-16 h-[2px] bg-white/5 rounded-full overflow-hidden">
                           <div className="h-full bg-white/20 w-1/2" />
                         </div>
                       </div>
                     </div>
                  </div>
               </div>
            </div>
          ) : (
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
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
           {[
              { label: 'LOW', key: 'god_ra_low' },
              { label: 'LOW MID', key: 'god_ra_mid' },
              { label: 'HIGH MID', key: 'god_ra_presence' },
              { label: 'HIGH', key: 'god_ra_high' }
           ].map(band => {
              return (
                <div key={band.label} className="flex flex-col items-center">
                   <DivineKnob 
                     value={parameterValues[band.key] || 50}
                     onChange={(val) => update(band.key, val)}
                     label={band.label}
                     size="md"
                     min={0}
                     max={100}
                     showValue={true}
                     variant="mystical"
                     color="#00ccff"
                     valueDisplay={`${((((parameterValues[band.key] || 50) - 50) / 50) * 12).toFixed(1)}dB`}
                   />
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
         <div className="w-full h-40">
            <VortexXYPad 
              x={morphX}
              y={morphY}
              onChange={(x, y) => {
                update('morphX', x);
                update('morphY', y);
                if (isRecording) {
                  setAutomationPath(prev => [...prev.slice(-49), {x, y}]);
                }
              }}
              anchors={vortexAnchors}
              onAnchorClick={(anchor) => {
                update('morphX', anchor.x);
                update('morphY', anchor.y);
              }}
              onSaveAnchor={(x, y) => {
                const name = prompt('Anchor Name:', `Loop ${vortexAnchors.length + 1}`);
                if (name && onSaveVortexAnchor) onSaveVortexAnchor(x, y, name);
              }}
            />
         </div>

          {/* Morph Macro (Phase 5) */}
          <div className="w-full mt-4 flex flex-col gap-1">
             <DivineSlider 
               value={parameterValues.morphFactor || 0}
               onChange={(val) => update('morphFactor', val)}
               label="Divine Morph"
               min={0}
               max={100}
             />
          </div>
       </div>

      {/* ── Arp / Gate ── */}
      <div className="vg-control-panel">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Arp / Gate</span>
            <SacredSwitch 
              active={parameterValues.arpEnabled || false}
              onToggle={() => update('arpEnabled', !parameterValues.arpEnabled)}
              label="ON"
            />
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
              <div key={l.label} className="flex flex-col items-center">
                 <DivineKnob 
                   value={l.val}
                   onChange={(val) => update(l.key, val)}
                   label={l.label}
                   size="sm"
                   showValue={true}
                   variant="mystical"
                   color="#00ccff"
                   valueDisplay={l.label === 'Rate' ? (l.val < 25 ? '1/4' : l.val < 50 ? '1/8' : l.val < 75 ? '1/16' : '1/32') : `${Math.round(l.val)}${l.unit}`}
                 />
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
              return (
                <div key={m} className="flex flex-col items-center">
                   <DivineKnob 
                     value={parameterValues[paramKey] || 50}
                     onChange={(val) => update(paramKey, val)}
                     label={m}
                     size="lg"
                     showValue={true}
                     variant="celestial"
                     color="#ffd700"
                     valueDisplay={`${Math.round(parameterValues[paramKey] || 50)}%`}
                   />
                </div>
              );
            })}
         </div>
      </div>
    </div>
  );
};
