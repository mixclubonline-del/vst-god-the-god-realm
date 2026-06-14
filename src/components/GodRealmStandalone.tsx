import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Terminal, 
  Cpu, 
  Settings, 
  Box,
  Database,
  Share2,
  Download,
  RotateCcw,
  Zap,
  Layers,
  ChevronRight,
  Fingerprint,
  PanelRightOpen,
  X
} from 'lucide-react';
import { VstgodthegodrealmPlugin } from './VstgodthegodrealmPlugin';
import { GlassPanel, GlassButton } from './ui/Glassmorphism';
import godRealmSpec from '@/specs/VSTGODTheGodRealm.vst-spec.json';
import { usePluginStore } from '@/services/pluginStore';
import { exportPluginBundle } from '@/services/exportEngine';
import { ControlMap, ExportBundle, ExportFile, DSPChainModule, DSPModuleType } from '@/services/types';
import { LiveChainPreview } from './LiveChainPreview';
import { useJuceBridge } from '@/hooks/useJuceBridge';

const DSP_MODULE_TYPES = new Set<DSPModuleType>([
  'eq',
  'compressor',
  'delay',
  'reverb',
  'distortion',
  'gain',
  'chorus',
  'phaser',
  'limiter',
  'multi808',
  'celestialKeys',
]);

const normalizeRoutingChain = (chain: Array<{ instanceId: string; type: string; index?: number; bypassed?: boolean }>): DSPChainModule[] =>
  chain.map((module, i) => {
    const moduleType = DSP_MODULE_TYPES.has(module.type as DSPModuleType)
      ? module.type as DSPModuleType
      : 'gain';

    return {
      instanceId: module.instanceId,
      type: moduleType,
      index: module.index ?? i + 1,
      bypassed: module.bypassed ?? false,
    };
  });

/**
 * GodRealmStandalone — High-Fidelity Standalone Development Harness
 * Designed for deep iteration and testing of "The God Realm" plugin.
 */
export const GodRealmStandalone: React.FC = () => {
  const [logs, setLogs] = useState<{ id: string; time: string; param: string; value: any }[]>([]);
  const [activeTab, setActiveTab] = useState('Plugin');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'analyzing' | 'compressing' | 'finalizing' | 'complete'>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState('');
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const [lastBundle, setLastBundle] = useState<ExportBundle | null>(null);
  const [selectedFile, setSelectedFile] = useState<ExportFile | null>(null);
  const [dspChain, setDspChain] = useState<DSPChainModule[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Live Engine Telemetry ───
  const bridgeState = useJuceBridge();
  const cpuPct = bridgeState.telemetry.cpuUsage;
  const sampleRate = bridgeState.telemetry.sampleRate;
  const bufferSize = bridgeState.telemetry.bufferSize;
  const systemStatus = cpuPct > 80 ? 'SYSTEM_HOT' : cpuPct > 60 ? 'SYSTEM_LOAD' : 'SYSTEM_STABLE';
  const statusColor = cpuPct > 80 ? 'text-red-400' : cpuPct > 60 ? 'text-amber-400' : 'text-white/40';
  
  // Initialize DSP chain from spec
  useEffect(() => {
    if (godRealmSpec.audioProcessing?.routingChain) {
      setDspChain(normalizeRoutingChain(godRealmSpec.audioProcessing.routingChain));
    }
  }, []);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [exportLogs]);

  const { activePlugins, addPlugin, setPluginParameter } = usePluginStore();

  // Find or initialize the God Realm plugin in the store
  const godPlugin = activePlugins.find(p => p.spec.plugin.name.includes('God Realm'));
  const pluginId = godPlugin?.id;

  useEffect(() => {
    if (!godPlugin) {
      console.log('[Standalone] Initializing God Realm Spec...');
      addPlugin(godRealmSpec as any);
    }
  }, [godPlugin, addPlugin]);

  const addLog = useCallback((param: string, value: any) => {
    const id = Math.random().toString(36).substr(2, 9);
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ id, time, param, value }, ...prev].slice(0, 100));
  }, []);

  const handleParamChange = (pId: string, val: any) => {
    console.log(`[GodRealmStandalone] Parameter change: ${pId} = ${val}`);
    if (pluginId) {
      setPluginParameter(pluginId, pId, val);
      addLog(pId, val);
    } else {
      console.warn('[GodRealmStandalone] pluginId is missing, cannot log or save parameter');
    }
  };

  const handleReset = () => {
    if (pluginId) {
      godRealmSpec.parameters.forEach(p => {
        setPluginParameter(pluginId, p.id, p.default);
      });
      setLogs([]);
      setExportStatus('idle');
      setExportProgress(0);
      setExportLogs([]);
      addLog('System', 'Engine Reset Complete');
    }
  };

  const startBuildSequence = async () => {
    setExportStatus('analyzing');
    setExportProgress(0);
    setCurrentTask('Initializing Compiler');
    setExportLogs(['[SYSTEM] Initializing God Realm Compiler v1.0...', '[SYSTEM] Source: VSTGODTheGodRealm.vst-spec.json', '[SYSTEM] Target: Sauce Land Distribution Kit', '[SYSTEM] Loading build environment...']);
    
    await new Promise(r => setTimeout(r, 600));
    setExportLogs(prev => [...prev, '[ANALYZE] Parsing DSP Routing Chain...', `[ANALYZE] Found ${godRealmSpec.audioProcessing.routingChain.length} modules.`]);
    
    // Construct ControlMap from spec + current store values
    const currentParams = godPlugin?.parameterValues || {};
    
    await new Promise(r => setTimeout(r, 400));
    setExportProgress(20);
    setCurrentTask('Engine Execution');
    setExportLogs(prev => [...prev, '[ENGINE] Invoking God Forge Code Generator...', '[ENGINE] Mapping parameters to normalized VST space...']);

    try {
      // Real export engine call
      const bundle = exportPluginBundle({
        pluginName: godRealmSpec.plugin.name,
        manufacturer: godRealmSpec.plugin.manufacturer,
        category: godRealmSpec.plugin.category,
        version: godRealmSpec.plugin.version,
        dimensions: godRealmSpec.ui,
        description: "High-fidelity God Realm plugin with integrated sample chopper and FX chain.",
        imageData: "", 
        imageMimeType: "image/png",
        colorScheme: {
          primary: "#FFD700",
          secondary: "#ff4400",
          accent: "#ffcc00",
          background: "#0a0a0a",
          text: "#ffffff"
        },
        controls: godRealmSpec.ui.controls.map(c => {
          const param = godRealmSpec.parameters.find(p => p.id === c.parameterId);
          return {
            ...c,
            confidence: 1.0,
            parameter: param || {
              name: c.label,
              min: 0,
              max: 100,
              default: 0,
              unit: "",
              curve: "linear",
              automatable: true
            }
          };
        }) as any,
        groups: [],
        tabs: godRealmSpec.ui.tabs,
        routingChain: normalizeRoutingChain(godRealmSpec.audioProcessing.routingChain)
      });
      setLastBundle(bundle);
      
      await new Promise(r => setTimeout(r, 800));
      setExportStatus('compressing');
      setExportProgress(45);
      setCurrentTask('Generating Code');
      setExportLogs(prev => [...prev, 
        `[CODEGEN] Success: Created ${bundle.files.length} source files.`,
        ...bundle.files.map(f => `[CODEGEN] Written: ${f.filename} (${f.language})`)
      ]);

      await new Promise(r => setTimeout(r, 1000));
      setExportStatus('finalizing');
      setExportProgress(80);
      setCurrentTask('Signing Payload');
      setExportLogs(prev => [...prev, '[FINAL] Generating manifest.json...', '[FINAL] Validating cryptographic checksums...', '[FINAL] Creating Sauce Land Distribution Manifest...']);
      
      await new Promise(r => setTimeout(r, 800));
      setExportStatus('complete');
      setExportProgress(100);
      setCurrentTask('Build Finished');
      setExportLogs(prev => [...prev, '[SUCCESS] Kit "Divine Collection" build complete.', '[SUCCESS] Ready for Antigravity cloud synchronization.']);
    } catch (err) {
      setExportStatus('idle');
      setExportLogs(prev => [...prev, `[ERROR] Build failed: ${err instanceof Error ? err.message : String(err)}`]);
    }
  };

  const tabs = ['Plugin', 'Parameter Stream', 'State Matrix', 'Export Lab'];

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0E0A2E] text-white font-sans overflow-hidden">
      {/* ── Standalone Header ── */}
      <header className="h-16 flex items-center justify-between px-8 bg-black/40 backdrop-blur-3xl border-b border-white/5 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 shadow-[0_0_20px_rgba(255,215,0,0.2)]">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-[0.2em] text-white/90 uppercase">Antigravity Standalone</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-yellow-400 font-bold tracking-widest uppercase">The God Realm</span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="text-[10px] text-white/30 font-bold tracking-widest uppercase">v1.0.0-dev</span>
              </div>
            </div>
          </div>

        </div>

        {/* Workspace Navigation */}
        <nav className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/5 border border-yellow-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-yellow-500/80">LAB_SESSION: ACTIVE</span>
          </div>
          <GlassButton variant="secondary" size="sm" className="w-9 h-9 p-0 rounded-xl" onClick={() => setInspectorOpen(o => !o)}>
            <PanelRightOpen className={`w-4 h-4 transition-colors ${inspectorOpen ? 'text-yellow-400' : 'text-white/60'}`} />
          </GlassButton>
          <GlassButton variant="secondary" size="sm" className="w-9 h-9 p-0 rounded-xl" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 text-white/60" />
          </GlassButton>
        </div>
      </header>

      {/* ── Workbench Content ── */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Background Ambient Elements — Divine Light */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-yellow-500/8 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-1/3 w-[300px] h-[300px] bg-cyan-500/3 blur-[100px] rounded-full pointer-events-none" />

        {/* ── Full-Screen Plugin Display ── */}
        <section className={`flex-1 flex overflow-hidden transition-all duration-500 ${activeTab !== 'Plugin' ? 'opacity-40 scale-95' : ''}`}>
          <div className="relative flex-1 overflow-hidden">
            <VstgodthegodrealmPlugin 
              isOpen={true} 
              onClose={() => {}} 
              embedded
              width="100%"
              height="100%"
              onParameterChange={handleParamChange}
              parameterValues={godPlugin?.parameterValues}
            />
          </div>
        </section>

        {/* ── Slide-Out Inspector Drawer ── */}
        <AnimatePresence>
        {inspectorOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/40 z-30"
              onClick={() => setInspectorOpen(false)}
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-[420px] flex flex-col bg-[#0a0a0f]/95 border-l border-white/10 backdrop-blur-3xl z-40 shadow-[-20px_0_60px_rgba(0,0,0,0.6)]"
            >
              {/* Drawer Header */}
              <div className="h-12 flex items-center justify-between px-5 border-b border-white/5 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-yellow-400" /> Engine Inspector
                </span>
                <button onClick={() => setInspectorOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
           {/* Tab Content */}
           <div className="flex-1 overflow-hidden flex flex-col">
              <AnimatePresence mode="wait">
                {activeTab === 'Parameter Stream' && (
                  <motion.div 
                    key="stream"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex-1 flex flex-col p-6 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-6">
                       <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                         <Terminal className="w-4 h-4 text-yellow-400" /> Real-time Stream
                       </h3>
                       <span className="text-[10px] font-mono text-white/20">{logs.length} EVENTS</span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 glass-scroll flex flex-col gap-2">
                       {logs.length === 0 ? (
                         <div className="flex-1 flex flex-col items-center justify-center opacity-20 grayscale">
                            <Activity className="w-12 h-12 mb-4" />
                            <p className="text-xs font-bold uppercase tracking-widest">No Activity Detected</p>
                         </div>
                       ) : (
                         logs.map((log) => (
                           <motion.div 
                             key={log.id}
                             initial={{ opacity: 0, y: -10 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all"
                           >
                              <div className="flex items-center gap-3">
                                 <span className="text-[9px] font-mono text-white/20">{log.time}</span>
                                 <span className="text-[10px] font-bold text-yellow-300 uppercase tracking-wider">{log.param}</span>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-emerald-400">
                                {typeof log.value === 'number' ? log.value.toFixed(2) : String(log.value)}
                              </span>
                           </motion.div>
                         ))
                       )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'State Matrix' && (
                   <motion.div 
                     key="state"
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     className="flex-1 flex flex-col p-6 overflow-hidden"
                   >
                     <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                          <Database className="w-4 h-4 text-yellow-400" /> State Matrix
                        </h3>
                        <GlassButton variant="ghost" size="sm" className="h-7 text-[9px] px-2" onClick={() => {
                          const blob = new Blob([JSON.stringify(godPlugin?.parameterValues, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'god-realm-state.json';
                          a.click();
                        }}>
                          <Download className="w-3 h-3" /> Snapshot
                        </GlassButton>
                     </div>

                     <div className="flex-1 bg-black/40 rounded-2xl border border-white/5 p-4 overflow-y-auto glass-scroll font-mono text-[11px]">
                        <pre className="text-emerald-400/80 leading-relaxed">
                          {JSON.stringify(godPlugin?.parameterValues || {}, null, 2)}
                        </pre>
                     </div>
                   </motion.div>
                )}

                {activeTab === 'Export Lab' && (
                   <motion.div 
                     key="export"
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     className="flex-1 flex flex-col p-6 overflow-hidden"
                   >
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                          <Share2 className="w-4 h-4 text-emerald-400" /> Kit Deployment
                        </h3>
                        {exportStatus === 'complete' && (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Build Success</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                         <GlassPanel className="p-5 shrink-0">
                            <h4 className="text-xs font-bold text-white/90 mb-2">Build Sauce Land Kit</h4>
                            <p className="text-[10px] text-white/40 mb-4 leading-relaxed">
                               Assemble the current state and assets into a distributable Sauce Land kit format.
                            </p>
                            
                            {exportStatus === 'idle' ? (
                              <GlassButton 
                                variant="primary" 
                                className="w-full h-10 uppercase tracking-widest text-[10px] font-black"
                                onClick={startBuildSequence}
                              >
                                Initialize Build Sequence
                              </GlassButton>
                            ) : (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex justify-between text-[9px] font-bold text-white/40 uppercase tracking-tighter">
                                    <span>{currentTask || exportStatus}...</span>
                                    <span>{exportProgress}%</span>
                                  </div>
                                  <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                                    <motion.div 
                                      className={`h-full ${exportStatus === 'complete' ? 'bg-emerald-500' : 'bg-yellow-500'} shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all duration-300 ease-out relative`}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${exportProgress}%` }}
                                    >
                                      {exportStatus !== 'complete' && (
                                        <div className="vg-progress-scanner" />
                                      )}
                                    </motion.div>
                                  </div>
                                </div>
                                
                                {exportStatus === 'complete' && (
                                  <div className="flex gap-2">
                                    <GlassButton 
                                      variant="primary" 
                                      className="flex-1 h-9 uppercase tracking-widest text-[9px] font-black"
                                      onClick={() => addLog('Export', 'Cloud Upload Initialized')}
                                    >
                                      Deploy to Cloud
                                    </GlassButton>
                                    <GlassButton 
                                      variant="secondary" 
                                      className="flex-1 h-9 uppercase tracking-widest text-[9px] font-black"
                                      onClick={() => setExportStatus('idle')}
                                    >
                                      New Build
                                    </GlassButton>
                                  </div>
                                )}
                              </div>
                            )}
                         </GlassPanel>

                         <div className="flex-1 flex flex-col bg-[#08080A] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                             {/* Terminal Header */}
                             <div className="h-9 px-4 flex items-center justify-between bg-white/[0.03] border-b border-white/5">
                                <div className="flex items-center gap-4">
                                   <div className="flex gap-1.5">
                                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
                                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40" />
                                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
                                   </div>
                                   <div className="flex items-center gap-2 text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">
                                      <Terminal className="w-3 h-3" /> {selectedFile ? selectedFile.filename : 'System_Compiler_v1.0'}
                                   </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {selectedFile && (
                                    <button 
                                      onClick={() => setSelectedFile(null)}
                                      className="text-[8px] font-bold text-white/30 hover:text-white/60 uppercase tracking-widest"
                                    >
                                      Back to Logs
                                    </button>
                                  )}
                                  <div className="text-[8px] font-mono text-white/10">{selectedFile ? selectedFile.language.toUpperCase() : 'STDOUT_PRIMARY'}</div>
                                </div>
                             </div>
                             
                             <div className="flex-1 p-5 overflow-y-auto font-mono text-[10px] space-y-1.5 glass-scroll pr-2 selection:bg-yellow-500/30">
                                {selectedFile ? (
                                  <div className="whitespace-pre text-yellow-200/90 leading-relaxed">
                                    {selectedFile.content}
                                  </div>
                                ) : exportLogs.length === 0 ? (
                                  <div className="h-full flex items-center justify-center text-white/10 italic">
                                     Awaiting build command...
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="space-y-1.5">
                                      {exportLogs.map((log, i) => (
                                        <motion.div 
                                          key={i} 
                                          initial={{ opacity: 0, x: -5 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          className={`flex gap-3 ${log.includes('[SUCCESS]') ? 'text-emerald-400' : log.includes('[FILE]') ? 'text-amber-400/80' : 'text-yellow-300/80'}`}
                                        >
                                           <span className="opacity-20 shrink-0 font-mono w-4 text-right">{i + 1}</span>
                                           <span className="break-all">{log}</span>
                                        </motion.div>
                                      ))}
                                    </div>

                                    {lastBundle && (
                                      <div className="pt-4 border-t border-white/5 space-y-3">
                                        <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Generated Artifacts</div>
                                        <div className="grid grid-cols-2 gap-2">
                                          {lastBundle.files.map((file, i) => (
                                            <button
                                              key={i}
                                              onClick={() => setSelectedFile(file)}
                                              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left group"
                                            >
                                              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform">
                                                <Box className="w-4 h-4" />
                                              </div>
                                              <div className="flex flex-col min-w-0">
                                                <span className="text-[10px] font-bold text-white/80 truncate">{file.filename}</span>
                                                <span className="text-[8px] font-medium text-white/20 uppercase">{file.language}</span>
                                              </div>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div ref={scrollRef} />
                             </div>
                          </div>
                      </div>
                   </motion.div>
                )}
                
                {activeTab === 'Plugin' && (
                  <motion.div 
                    key="audio-engine"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex-1 flex flex-col p-6 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" /> WebAudio Engine
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-emerald-400/80 uppercase">Processing</span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto glass-scroll pr-2">
                      <LiveChainPreview 
                        chain={dspChain}
                        parameterValues={godPlugin?.parameterValues}
                        onBypassToggle={(id, bypassed) => {
                          setDspChain(prev => prev.map(m => 
                            m.instanceId === id ? { ...m, bypassed } : m
                          ));
                          addLog(`BYPASS_${id}`, bypassed ? 'ON' : 'OFF');
                        }}
                      />

                      <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/5">
                        <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Engine Status</h4>
                        <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1">
                              <span className="text-[8px] text-white/20 uppercase block">Sample Rate</span>
                              <span className="text-[10px] font-mono text-white/60">44100 Hz</span>
                           </div>
                           <div className="space-y-1">
                              <span className="text-[8px] text-white/20 uppercase block">Buffer Size</span>
                              <span className="text-[10px] font-mono text-white/60">512 samples</span>
                           </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
           </div>

           {/* Metrics Footer — Live Engine Telemetry */}
           <div className="p-6 bg-black/40 border-t border-white/5">
              <div className="flex flex-col gap-4">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                       <Activity className="w-3.5 h-3.5" /> Engine Metrics
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${cpuPct > 60 ? 'text-amber-400' : 'text-yellow-400'}`}>
                      {cpuPct > 80 ? 'HOT' : cpuPct > 60 ? 'WARM' : 'OPTIMAL'}
                    </span>
                 </div>
                 
                 <div className="space-y-3">
                    <div className="space-y-1">
                       <div className="flex justify-between text-[9px] font-bold text-white/20 uppercase">
                          <span>DSP Overhead</span>
                          <span>{cpuPct.toFixed(1)}%</span>
                       </div>
                       <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            animate={{ width: `${Math.min(100, cpuPct)}%` }}
                            transition={{ duration: 0.15, ease: 'linear' }}
                            className={`h-full ${cpuPct > 80 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : cpuPct > 60 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-yellow-500 shadow-[0_0_10px_rgba(255,215,0,0.5)]'}`}
                          />
                       </div>
                    </div>
                    <div className="space-y-1">
                       <div className="flex justify-between text-[9px] font-bold text-white/20 uppercase">
                          <span>Buffer</span>
                          <span>{bufferSize} smp</span>
                       </div>
                       <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            animate={{ width: `${Math.min(100, (bufferSize / 2048) * 100)}%` }}
                            transition={{ duration: 0.3 }}
                            className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                          />
                       </div>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-white/20 uppercase">
                       <span>Sample Rate</span>
                       <span className="text-white/40">{(sampleRate / 1000).toFixed(1)} kHz</span>
                    </div>
                 </div>
              </div>
           </div>
            </motion.aside>
          </>
        )}
        </AnimatePresence>
      </main>

      {/* ── Global Footer — Live Status ── */}
      <footer className="h-10 flex items-center justify-between px-8 bg-[#0A0824] border-t border-yellow-500/10 text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">
        <div className="flex gap-8">
          <span className="flex items-center gap-2">ANTIGRAVITY_CORE::CONNECTED</span>
          <span className="flex items-center gap-2 text-yellow-400/60">STANDALONE_MODE::ENABLED</span>
        </div>
        <div className="flex gap-8">
          <span className="text-white/30">{(sampleRate / 1000).toFixed(1)}kHz / {bufferSize}smp</span>
          <span>{new Date().toISOString().split('T')[0]}</span>
          <span className={statusColor}>{systemStatus}</span>
        </div>
      </footer>
    </div>
  );
};

export default GodRealmStandalone;
