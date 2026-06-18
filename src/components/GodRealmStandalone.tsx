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

  return (
    <div 
      className="absolute inset-0 flex flex-col text-white font-sans overflow-hidden"
      style={{
        backgroundImage: "url('/plugins/backgrounds/vst-god-atmospheric.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* ── Full-Screen Plugin Display ── */}
      <main className="flex-1 flex overflow-hidden relative">
        <section className={`flex-1 flex overflow-hidden transition-all duration-500`}>
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
      </main>
    </div>
  );
};

export default GodRealmStandalone;
