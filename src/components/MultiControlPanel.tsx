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
  level?: number;
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
  onSaveVortexAnchor,
  level
}) => {
  const [activePanelTab, setActivePanelTab] = useState<'EQ' | 'FILTER' | 'COMP' | 'AURA'>('EQ');
  const [activeLfo, setActiveLfo] = useState<number>(0);
  const morphX = parameterValues.morphX || 50;
  const morphY = parameterValues.morphY || 50;
  const [isRecording, setIsRecording] = useState(false);
  const [automationPath, setAutomationPath] = useState<Array<{x: number, y: number}>>([]);
  
  const routings = [
    { src: 'LFO 1', target: 'RA LOW', amt: parameterValues.routingAmt_0 ?? 45, active: parameterValues.routingActive_0 ?? true },
    { src: 'LFO 2', target: 'RA MID', amt: parameterValues.routingAmt_1 ?? 12, active: parameterValues.routingActive_1 ?? false },
    { src: 'LFO 3', target: 'RA HIGH', amt: parameterValues.routingAmt_2 ?? 68, active: parameterValues.routingActive_2 ?? true },
    { src: 'LFO 4', target: 'WIDTH', amt: parameterValues.routingAmt_3 ?? 92, active: parameterValues.routingActive_3 ?? true }
  ];

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
                     {['LFO 1', 'LFO 2', 'LFO 3', 'LFO 4'].map((l, idx) => (
                        <button 
                          key={l} 
                          onClick={() => setActiveLfo(idx)}
                          className={`px-2.5 py-1 rounded-md text-[7px] font-bold uppercase transition-all ${
                            activeLfo === idx 
                              ? 'bg-red-500 border border-red-500 text-black shadow-[0_0_8px_rgba(255,68,68,0.4)] font-black' 
                              : 'bg-red-500/5 border border-red-500/10 text-red-500/60 hover:bg-red-500/10'
                          }`}
                        >
                          {l}
                        </button>
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
                             className={`flex items-center justify-between p-2 rounded-lg border transition-all select-none ${r.active ? 'bg-red-500/5 border-red-500/10 shadow-[inset_0_0_10px_rgba(255,0,0,0.02)]' : 'bg-black/20 border-white/5 opacity-40'}`}
                           >
                              <div 
                                className="flex items-center gap-3 cursor-pointer flex-1"
                                onClick={() => update(`routingActive_${i}`, !r.active)}
                              >
                                <div className={`w-1.5 h-1.5 rounded-full transition-all ${r.active ? 'bg-red-500 shadow-[0_0_6px_rgba(255,0,0,0.6)]' : 'bg-white/10'}`} />
                                <span className={`text-[9px] font-black tracking-tighter transition-colors ${r.active ? 'text-red-500' : 'text-white/20'}`}>{r.src}</span>
                                <span className="text-[8px] text-white/10">▶</span>
                                <span className={`text-[8px] font-bold uppercase tracking-tight transition-colors ${r.active ? 'text-white/60' : 'text-white/20'}`}>{r.target}</span>
                              </div>
                              <div 
                                className="flex items-center gap-2 cursor-ew-resize py-1 select-none"
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  const el = e.currentTarget;
                                  const rect = el.getBoundingClientRect();
                                  const updateAmount = (clientX: number) => {
                                    const pct = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
                                    update(`routingAmt_${i}`, pct);
                                  };
                                  updateAmount(e.clientX);
                                  const onPointerMove = (moveEv: PointerEvent) => {
                                    updateAmount(moveEv.clientX);
                                  };
                                  const onPointerUp = () => {
                                    window.removeEventListener('pointermove', onPointerMove);
                                    window.removeEventListener('pointerup', onPointerUp);
                                  };
                                  window.addEventListener('pointermove', onPointerMove);
                                  window.addEventListener('pointerup', onPointerUp);
                                }}
                              >
                                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden pointer-events-none">
                                  <motion.div 
                                    className="h-full bg-red-500/40" 
                                    animate={{ width: r.active ? `${r.amt}%` : '0%' }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                  />
                                </div>
                                <span className={`text-[9px] font-mono w-6 text-right transition-colors pointer-events-none ${r.active ? 'text-yellow-500/60' : 'text-white/10'}`}>{r.amt}%</span>
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
                             stroke="#FFA726" 
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
          ) : activePanelTab === 'FILTER' ? (
            <svg className="w-full h-full p-2 overflow-visible" viewBox="0 0 200 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="filter-grad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="rgba(0,204,255,0)" />
                  <stop offset="100%" stopColor="rgba(0,204,255,0.12)" />
                </linearGradient>
              </defs>

              {/* Background Grid Lines */}
              <line x1="0" y1="50" x2="200" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
              {[50, 100, 150].map(x => (
                <line key={x} x1={x} y1="0" x2={x} y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
              ))}

              {(() => {
                const pad = parameterValues.activePad || 0;
                const cutoff = parameterValues[`slotFilterFreq_${pad}`] ?? 100;
                const q = parameterValues[`slotFilterQ_${pad}`] ?? 15;
                const type = parameterValues[`slotFilterType_${pad}`] ?? 'lowpass';

                const cx = 20 + (cutoff / 100) * 160;
                const peak = (q / 100) * 35;
                const cy = Math.max(10, 50 - peak);
                let path = '';
                let strokePath = '';
                
                if (type === 'lowpass') {
                  path = `M 0 50 L 0 50 L ${cx - 30} 50 Q ${cx - 15} 50 ${cx - 8} ${cy} Q ${cx} ${cy - 5} ${cx + 10} 70 T 200 98 L 200 50 Z`;
                  strokePath = `M 0 50 L ${cx - 30} 50 Q ${cx - 15} 50 ${cx - 8} ${cy} Q ${cx} ${cy - 5} ${cx + 10} 70 T 200 98`;
                } else if (type === 'highpass') {
                  path = `M 0 98 Q 50 90 ${cx - 10} 70 Q ${cx} ${cy - 5} ${cx + 8} ${cy} Q ${cx + 15} 50 ${cx + 30} 50 L 200 50 L 200 50 Z`;
                  strokePath = `M 0 98 Q 50 90 ${cx - 10} 70 Q ${cx} ${cy - 5} ${cx + 8} ${cy} Q ${cx + 15} 50 ${cx + 30} 50 L 200 50`;
                } else { // bandpass
                  path = `M 0 95 Q ${cx - 30} 90 ${cx - 15} ${cy + 15} Q ${cx} ${cy} ${cx + 15} ${cy + 15} Q ${cx + 30} 90 200 95 L 200 50 Z`;
                  strokePath = `M 0 95 Q ${cx - 30} 90 ${cx - 15} ${cy + 15} Q ${cx} ${cy} ${cx + 15} ${cy + 15} Q ${cx + 30} 90 200 95`;
                }

                return (
                  <>
                    <path d={path} fill="url(#filter-grad)" />
                    <path d={strokePath} fill="none" stroke="#00ccff" strokeWidth="2" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(0,204,255,0.4)]" />
                    <circle cx={cx} cy={type === 'lowpass' ? cy - 2 : type === 'highpass' ? cy - 2 : cy} r="3" fill="#00ccff" className="drop-shadow-[0_0_8px_#00ccff]" />
                  </>
                );
              })()}
            </svg>
          ) : activePanelTab === 'COMP' ? (
            <svg className="w-full h-full p-2 overflow-visible" viewBox="0 0 200 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="comp-grad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="rgba(255,68,68,0)" />
                  <stop offset="100%" stopColor="rgba(255,68,68,0.12)" />
                </linearGradient>
              </defs>

              {/* Background Grid Lines */}
              <line x1="20" y1="50" x2="180" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
              <line x1="100" y1="10" x2="100" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />

              {(() => {
                const thres = parameterValues.masterDynamicsThreshold ?? -12;
                const ratio = parameterValues.masterDynamicsRatio ?? 2.0;
                
                const tx = 20 + ((thres + 60) / 60) * 160;
                const ty = 90 - ((thres + 60) / 60) * 80;
                
                const outDb = thres + (0 - thres) / ratio;
                const ey = 90 - ((outDb + 60) / 60) * 80;
                
                const strokePath = `M 20 90 L ${tx} ${ty} L 180 ${ey}`;
                const path = `M 20 90 L ${tx} ${ty} L 180 ${ey} L 180 90 Z`;
                
                // Real-time bouncing indicator dot
                const activeLvl = level || 0;
                const lvlDb = -60 + activeLvl * 60;
                const dotX = 20 + ((lvlDb + 60) / 60) * 160;
                let dotY = 90 - ((lvlDb + 60) / 60) * 80;
                if (lvlDb > thres) {
                  const compDb = thres + (lvlDb - thres) / ratio;
                  dotY = 90 - ((compDb + 60) / 60) * 80;
                }

                // Gain Reduction
                const grDb = lvlDb > thres ? (lvlDb - thres) * (1 - 1 / ratio) : 0;
                const grHeight = (grDb / 40) * 80;

                return (
                  <>
                    <line x1={tx} y1="10" x2={tx} y2="90" stroke="rgba(255,68,68,0.25)" strokeWidth="1" strokeDasharray="3 3" />
                    
                    <path d={path} fill="url(#comp-grad)" />
                    <path d={strokePath} fill="none" stroke="#ff4444" strokeWidth="2" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(255,68,68,0.4)]" />
                    
                    {activeLvl > 0.01 && (
                      <circle cx={Math.max(20, Math.min(180, dotX))} cy={Math.max(10, Math.min(90, dotY))} r="3.5" fill="#ff4444" className="drop-shadow-[0_0_10px_#ff4444]" />
                    )}

                    <rect x="190" y="10" width="4" height="80" rx="1" fill="rgba(255,255,255,0.05)" />
                    {grDb > 0.1 && (
                      <rect x="190" y="10" width="4" height={Math.min(80, grHeight)} rx="1" fill="#ff4444" className="drop-shadow-[0_0_8px_#ff4444]" />
                    )}
                  </>
                );
              })()}
            </svg>
          ) : (
            <svg className="w-full h-full p-2 overflow-visible" viewBox="0 0 200 100" preserveAspectRatio="none">
                <defs>
                   <linearGradient id="eq-grad" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="rgba(255,215,0,0)" />
                      <stop offset="100%" stopColor="rgba(255,215,0,0.1)" />
                   </linearGradient>
                   <linearGradient id="freqGlow" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0%" stopColor="rgba(255,215,0,0.1)" />
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
                       <path d={strokePath} fill="none" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]" />
                       
                       {/* Interaction Nodes */}
                       {[p1, p2, p3, p4].map((p, i) => (
                         <g key={i} className="cursor-pointer">
                            <circle cx={p.x === 0 ? 10 : p.x} cy={p.y} r="3" fill="#FFD700" className="drop-shadow-[0_0_8px_#FFD700]" />
                            {Math.abs(50 - p.y) > 10 && (
                              <circle cx={p.x === 0 ? 10 : p.x} cy={p.y} r="6" fill="transparent" stroke="rgba(255,215,0,0.3)" strokeWidth="1" className="animate-ping" />
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
           {activePanelTab === 'EQ' && [
              { label: 'LOW', key: 'god_ra_low', color: '#FFD700', display: `${((((parameterValues.god_ra_low || 50) - 50) / 50) * 12).toFixed(1)}dB` },
              { label: 'LOW MID', key: 'god_ra_mid', color: '#FFD700', display: `${((((parameterValues.god_ra_mid || 50) - 50) / 50) * 12).toFixed(1)}dB` },
              { label: 'HIGH MID', key: 'god_ra_presence', color: '#FFD700', display: `${((((parameterValues.god_ra_presence || 50) - 50) / 50) * 12).toFixed(1)}dB` },
              { label: 'HIGH', key: 'god_ra_high', color: '#FFD700', display: `${((((parameterValues.god_ra_high || 50) - 50) / 50) * 12).toFixed(1)}dB` }
           ].map(band => (
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
                   color={band.color}
                   valueDisplay={band.display}
                 />
              </div>
           ))}

           {activePanelTab === 'FILTER' && (() => {
              const pad = parameterValues.activePad || 0;
              const fKey = `slotFilterFreq_${pad}`;
              const qKey = `slotFilterQ_${pad}`;
              const tKey = `slotFilterType_${pad}`;
              const volKey = `slotVol_${pad}`;
              
              const freqVal = parameterValues[fKey] ?? 100;
              const qVal = parameterValues[qKey] ?? 15;
              const typeVal = parameterValues[tKey] ?? 'lowpass';
              const volVal = parameterValues[volKey] ?? 75;
              
              const minF = Math.log(20);
              const maxF = Math.log(20000);
              const hz = Math.round(Math.exp(minF + (freqVal / 100) * (maxF - minF)));
              const hzStr = hz >= 1000 ? `${(hz / 1000).toFixed(1)}kHz` : `${hz}Hz`;

              return [
                { label: 'CUTOFF', key: fKey, val: freqVal, color: '#00ccff', display: hzStr },
                { label: 'RESONANCE', key: qKey, val: qVal, color: '#00ccff', display: `${Math.round(0.5 + (qVal/100)*19.5).toFixed(1)}Q` },
                { 
                  label: 'TYPE', 
                  key: tKey, 
                  val: typeVal === 'lowpass' ? 15 : typeVal === 'highpass' ? 50 : 85, 
                  color: '#00ccff', 
                  display: typeVal === 'lowpass' ? 'LP' : typeVal === 'highpass' ? 'HP' : 'BP',
                  onChange: (v: number) => {
                    const nextType = v < 33 ? 'lowpass' : v < 66 ? 'highpass' : 'bandpass';
                    update(tKey, nextType);
                  }
                },
                { label: 'LEVEL', key: volKey, val: volVal, color: '#FFD700', display: `${Math.round(volVal)}%` }
              ].map(ctrl => (
                <div key={ctrl.label} className="flex flex-col items-center">
                   <DivineKnob 
                     value={ctrl.val}
                     onChange={ctrl.onChange || ((v) => update(ctrl.key, v))}
                     label={ctrl.label}
                     size="md"
                     min={0}
                     max={100}
                     showValue={true}
                     variant="mystical"
                     color={ctrl.color}
                     valueDisplay={ctrl.display}
                   />
                </div>
              ));
           })()}

           {activePanelTab === 'COMP' && [
              { label: 'THRES', key: 'masterDynamicsThreshold', val: parameterValues.masterDynamicsThreshold ?? -12, min: -60, max: 0, color: '#ff4444', display: `${Math.round(parameterValues.masterDynamicsThreshold ?? -12)}dB` },
              { label: 'RATIO', key: 'masterDynamicsRatio', val: parameterValues.masterDynamicsRatio ?? 2.0, min: 1, max: 10, color: '#ff4444', display: `${(parameterValues.masterDynamicsRatio ?? 2.0).toFixed(1)}:1` },
              { label: 'ATTACK', key: 'masterDynamicsAttack', val: parameterValues.masterDynamicsAttack ?? 5, min: 1, max: 100, color: '#ff4444', display: `${Math.round(parameterValues.masterDynamicsAttack ?? 5)}ms` },
              { label: 'RELEASE', key: 'masterDynamicsRelease', val: parameterValues.masterDynamicsRelease ?? 100, min: 10, max: 1000, color: '#ff4444', display: `${Math.round(parameterValues.masterDynamicsRelease ?? 100)}ms` }
           ].map(ctrl => (
              <div key={ctrl.label} className="flex flex-col items-center">
                 <DivineKnob 
                   value={ctrl.val}
                   onChange={(v) => update(ctrl.key, v)}
                   label={ctrl.label}
                   size="md"
                   min={ctrl.min}
                   max={ctrl.max}
                   showValue={true}
                   variant="mystical"
                   color={ctrl.color}
                   valueDisplay={ctrl.display}
                 />
              </div>
           ))}

           {activePanelTab === 'AURA' && (() => {
               const rKey = `lfoRate_${activeLfo}`;
               const dKey = `lfoDepth_${activeLfo}`;
               const sKey = `lfoShape_${activeLfo}`;
               const verbKey = `masterReverbMix`;
               
               const rateVal = parameterValues[rKey] ?? (activeLfo === 0 ? 30 : activeLfo === 1 ? 45 : activeLfo === 2 ? 15 : 60);
               const depthVal = parameterValues[dKey] ?? 50;
               const shapeVal = parameterValues[sKey] ?? 0;
               const verbVal = parameterValues[verbKey] ?? 35;
               
               const minHz = Math.log(0.1);
               const maxHz = Math.log(20);
               const hz = Math.exp(minHz + (rateVal / 100) * (maxHz - minHz));
               const hzStr = `${hz.toFixed(2)}Hz`;

               const shapes = ['SINE', 'TRI', 'SAW', 'SQR'];
               const shapeStr = shapes[shapeVal] || 'SINE';

               return [
                 { label: 'LFO RATE', key: rKey, val: rateVal, color: '#ff4444', display: hzStr },
                 { label: 'LFO DEPTH', key: dKey, val: depthVal, color: '#ff4444', display: `${Math.round(depthVal)}%` },
                 { 
                   label: 'LFO SHAPE', 
                   key: sKey, 
                   val: shapeVal * 33.3,
                   color: '#ff4444', 
                   display: shapeStr,
                   onChange: (v: number) => {
                     const nextShape = Math.min(3, Math.max(0, Math.round((v / 100) * 3)));
                     update(sKey, nextShape);
                   }
                 },
                 { label: 'AURA SEND', key: verbKey, val: verbVal, color: '#FFD700', display: `${Math.round(verbVal)}%` }
               ].map(ctrl => (
                 <div key={ctrl.label} className="flex flex-col items-center">
                    <DivineKnob 
                      value={ctrl.val}
                      onChange={ctrl.onChange || ((v) => update(ctrl.key, v))}
                      label={ctrl.label}
                      size="md"
                      min={0}
                      max={100}
                      showValue={true}
                      variant="mystical"
                      color={ctrl.color}
                      valueDisplay={ctrl.display}
                    />
                 </div>
               ));
           })()}
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
              onPositionChange={(x: number, y: number) => {
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
              level={level}
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
              isOn={parameterValues.arpEnabled || false}
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
                        ? 'bg-red-500 h-full shadow-[0_0_15px_rgba(255,215,0,0.8)]' 
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
                     id={paramKey}
                     update={update}
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
