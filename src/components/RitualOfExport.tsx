import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileAudio, Zap, Download, Disc, HardDrive, 
  Activity, Shield, Waves, Share2, ArrowRight, Archive, Package
} from 'lucide-react';
import JSZip from 'jszip';
import { ExportEngine } from '../audio/ExportEngine';
import { useSequencerEngine } from './sequencer/useSequencerEngine';
import { DivineSpectrometer } from './ui/DivineSpectrometer';

interface RitualOfExportProps {
  onExportComplete?: (data: any) => void;
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  analyser: AnalyserNode | null;
  engine: ReturnType<typeof useSequencerEngine>;
  buffers: Record<number, AudioBuffer>;
}

export const RitualOfExport: React.FC<RitualOfExportProps> = ({
  onExportComplete,
  parameterValues,
  update,
  analyser,
  engine,
  buffers
}) => {
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [activeStem, setActiveStem] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [stemUrls, setStemUrls] = useState<Record<number, string>>({});
  const [renderingStemIdx, setRenderingStemIdx] = useState<number | null>(null);
  const [isBatchManifesting, setIsBatchManifesting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  const stems = engine.state.tracks.map((t, idx) => ({
    name: t.name,
    type: 'Stereo',
    size: stemUrls[idx] ? 'Ready' : 'Pending',
    status: stemUrls[idx] ? 'Manifested' : 'Unmanifested'
  }));

  const handleStartRitual = useCallback(async () => {
    if (isRendering) return;
    setIsRendering(true);
    setRenderProgress(0);
    setExportUrl(null);
    
    try {
      console.log('Initiating Sacred Ritual of Export...');
      
      // Simulate ritual progress for visual impact
      const duration = 2000; 
      const start = Date.now();
      
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min(0.9, elapsed / duration); 
        setRenderProgress(progress);
      }, 50);

      // Perform actual render
      const blob = await ExportEngine.renderToWav(engine.state, buffers);
      
      clearInterval(progressInterval);
      setRenderProgress(1);
      
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
      
      setIsRendering(false);
      onExportComplete?.({ success: true, timestamp: new Date().toISOString(), url, type: 'master' });
      
    } catch (err) {
      console.error('The Ritual has failed:', err);
      setIsRendering(false);
    }
  }, [isRendering, engine.state, buffers, onExportComplete]);

  const handleStemExport = useCallback(async (idx: number) => {
    if (isRendering || renderingStemIdx !== null) return;
    setRenderingStemIdx(idx);
    
    try {
      const buffer = buffers[idx];
      if (!buffer) throw new Error('Buffer not found');
      
      const blob = await ExportEngine.renderStem(engine.state, idx, buffer);
      const url = URL.createObjectURL(blob);
      
      setStemUrls(prev => ({ ...prev, [idx]: url }));
      setRenderingStemIdx(null);
      
      onExportComplete?.({ success: true, trackIdx: idx, url, type: 'stem' });
      return url;
    } catch (err) {
      console.error(`Stem Manifestation ${idx} failed:`, err);
      setRenderingStemIdx(null);
      throw err;
    }
  }, [isRendering, renderingStemIdx, engine.state, buffers, onExportComplete]);

  const handleManifestAllStems = useCallback(async () => {
    if (isBatchManifesting || isRendering) return;
    setIsBatchManifesting(true);
    
    try {
      for (let i = 0; i < engine.state.tracks.length; i++) {
        await handleStemExport(i);
      }
    } catch (err) {
      console.error('Batch Manifestation failed:', err);
    } finally {
      setIsBatchManifesting(false);
    }
  }, [isBatchManifesting, isRendering, engine.state.tracks.length, handleStemExport]);

  const handleBundleAsZip = useCallback(async () => {
    if (isZipping || (!exportUrl && Object.keys(stemUrls).length === 0)) return;
    setIsZipping(true);
    setZipUrl(null);
    
    try {
      const zip = new JSZip();
      const timestamp = new Date().getTime();
      const folderName = `GodRealm_Export_${timestamp}`;
      
      // Add Master if it exists
      if (exportUrl) {
        const response = await fetch(exportUrl);
        const blob = await response.blob();
        zip.file(`${folderName}/Master_Render.wav`, blob);
      }
      
      // Add Stems
      for (const [idxStr, url] of Object.entries(stemUrls)) {
        const idx = parseInt(idxStr);
        const trackName = engine.state.tracks[idx].name.replace(/\s+/g, '_');
        console.log(`[PROCESS] Packaging Stem: ${trackName}...`);
        const response = await fetch(url);
        const blob = await response.blob();
        zip.file(`${folderName}/Stems/Stem_${trackName}.wav`, blob);
      }
      
      console.log(`[PROCESS] Compressing Sacred Archive...`);
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      setZipUrl(url);
      
      console.log(`[SUCCESS] Sacred Archive manifested at ${url}`);
      onExportComplete?.({ success: true, url, type: 'zip', fileName: `${folderName}.zip` });
    } catch (err) {
      console.error('ZIP Bundle failed:', err);
    } finally {
      setIsZipping(false);
    }
  }, [isZipping, exportUrl, stemUrls, engine.state.tracks, onExportComplete]);

  const onDragStart = (e: React.DragEvent, url: string | null, label: string) => {
    if (!url) return;
    setIsDragging(true);
    const fileName = `GodRealm_${label.replace(/\s+/g, '_')}_${new Date().getTime()}.wav`;
    // Chrome/Tauri DownloadURL convention
    e.dataTransfer.setData("DownloadURL", `audio/wav:${fileName}:${url}`);
  };

  return (
    <div className="flex w-full h-full gap-4 p-4 overflow-hidden select-none bg-black/20">
      {/* ─── LEFT: MULTI-STEM MANIFESTATION ─── */}
      <section className="w-1/3 flex flex-col gap-4">
        <header className="p-4 glass-panel border border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div>
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Ritual Composition</h3>
            <h2 className="text-xl font-black text-white tracking-tighter">Multi-Stem Manifestation</h2>
          </div>
          <motion.button
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,215,0,0.1)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleManifestAllStems}
            disabled={isBatchManifesting || isRendering}
            className="px-3 py-2 rounded-lg border border-yellow-500/30 text-[9px] font-black uppercase tracking-widest text-yellow-500 disabled:opacity-30"
          >
            {isBatchManifesting ? 'Manifesting All...' : 'Manifest All'}
          </motion.button>
        </header>

        <div className="flex-1 glass-panel border border-white/5 bg-black/40 overflow-y-auto custom-scrollbar p-2 space-y-2">
          {stems.map((stem, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onMouseEnter={() => setActiveStem(idx)}
              onMouseLeave={() => setActiveStem(null)}
              onClick={() => handleStemExport(idx)}
              draggable={!!stemUrls[idx]}
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, stemUrls[idx], stem.name)}
              onDragEnd={() => setIsDragging(false)}
              className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                renderingStemIdx === idx
                  ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20'
                  : stemUrls[idx]
                    ? 'bg-green-500/10 border-green-500/30'
                    : activeStem === idx 
                      ? 'bg-yellow-500/10 border-yellow-500/30' 
                      : 'bg-white/[0.03] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    renderingStemIdx === idx 
                      ? 'bg-blue-500 text-black' 
                      : stemUrls[idx]
                        ? 'bg-green-500 text-black'
                        : activeStem === idx 
                          ? 'bg-yellow-500 text-black' 
                          : 'bg-white/5 text-white/40'
                  }`}>
                    <FileAudio size={14} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-white">{stem.name}</h4>
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">
                      {stem.type} • {stemUrls[idx] ? 'Manifested' : 'Unmanifested'}
                    </p>
                  </div>
                </div>
                <div className={`text-[8px] font-black uppercase px-2 py-1 rounded transition-colors ${
                  renderingStemIdx === idx 
                    ? 'bg-blue-500/20 text-blue-400 animate-pulse' 
                    : stemUrls[idx]
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-white/5 text-white/20'
                }`}>
                  {renderingStemIdx === idx ? 'Manifesting...' : stemUrls[idx] ? 'Ready' : 'Invoke'}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full ${
                    stemUrls[idx] 
                      ? 'bg-green-500' 
                      : renderingStemIdx === idx
                        ? 'bg-blue-500'
                        : 'bg-gradient-to-r from-amber-600 to-yellow-400'
                  }`}
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: stemUrls[idx] ? '100%' : renderingStemIdx === idx ? '100%' : '0%'
                  }}
                  transition={{
                    duration: renderingStemIdx === idx ? 2 : 0.5
                  }}
                />
              </div>
              
              {stemUrls[idx] && (
                <div className="mt-2 flex justify-end">
                   <p className="text-[7px] text-white/20 font-black uppercase">Click to Re-Manifest • Drag to Export</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>

          <div className="flex gap-2">
            <button 
              onClick={handleStartRitual}
              disabled={isRendering}
              className="flex-1 py-6 rounded-2xl bg-amber-600 hover:bg-yellow-500 disabled:bg-white/5 disabled:text-white/10 text-black font-black uppercase tracking-[0.4em] transition-all relative overflow-hidden group shadow-[0_0_40px_rgba(255,215,0,0.2)]"
            >
              {isRendering && (
                <motion.div 
                  className="absolute inset-0 bg-white/20"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-3">
                {isRendering ? (
                  <>
                    <Zap size={18} className="animate-bounce" />
                    Invoking Render...
                  </>
                ) : (
                  <>
                    <Download size={18} className="group-hover:translate-y-1 transition-transform" />
                    Begin Final Ritual
                  </>
                )}
              </span>
            </button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (zipUrl) {
                  const a = document.createElement('a');
                  a.href = zipUrl;
                  a.download = `GodRealm_Sacred_Archive_${new Date().getTime()}.zip`;
                  a.click();
                } else {
                  handleBundleAsZip();
                }
              }}
              disabled={isZipping || (!exportUrl && Object.keys(stemUrls).length === 0)}
              className={`px-6 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 min-w-[120px] ${
                zipUrl 
                  ? 'bg-green-500/20 border-green-500/50 text-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 disabled:opacity-20'
              }`}
            >
              {isZipping ? (
                <>
                  <Activity size={20} className="animate-spin" />
                  <span className="text-[7px] font-black uppercase">Zipping...</span>
                </>
              ) : zipUrl ? (
                <>
                  <Package size={20} className="animate-bounce" />
                  <span className="text-[7px] font-black uppercase">Download ZIP</span>
                </>
              ) : (
                <>
                  <Archive size={20} />
                  <span className="text-[7px] font-black uppercase">Bundle ZIP</span>
                </>
              )}
            </motion.button>
          </div>
      </section>

      {/* ─── CENTER: DIVINE RELIC (DRAG ZONE) ─── */}
      <section className="flex-1 flex flex-col gap-4 relative">
        <div className="flex-1 glass-panel border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
          {/* Background visuals */}
          <div className="absolute inset-0 pointer-events-none">
            <DivineSpectrometer 
              analyser={analyser} 
              isActive={isRendering || renderingStemIdx !== null} 
              color="#F5B041" 
              glowColor="rgba(255, 102, 0, 0.4)"
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/5 rounded-full animate-spin-slow opacity-20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/10 rounded-full animate-spin-slow-reverse opacity-20" />
          </div>

          <motion.div 
            draggable={!!exportUrl}
            onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, exportUrl, 'Full_Pattern')}
            onDragEnd={() => setIsDragging(false)}
            animate={{ 
              scale: isDragging ? 0.8 : 1,
              rotate: isRendering ? 360 : 0,
              boxShadow: exportUrl ? '0_0_80px_rgba(34,197,94,0.3)' : '0_0_40px_rgba(255,215,0,0.1)'
            }}
            transition={{ 
              rotate: isRendering ? { repeat: Infinity, duration: 2, ease: 'linear' } : { duration: 0.5 }
            }}
            className={`relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-500 ${
              isRendering 
                ? 'bg-yellow-500/20 shadow-[0_0_100px_rgba(255,215,0,0.4)] ring-4 ring-yellow-500/20' 
                : exportUrl
                  ? 'bg-green-500/20 border-2 border-green-500/50 cursor-grab active:cursor-grabbing'
                  : 'bg-white/[0.03] border border-white/10 hover:border-yellow-500/40 hover:bg-yellow-500/5 cursor-default'
            }`}
          >
            <AnimatePresence mode="wait">
              {isRendering ? (
                <motion.div 
                  key="rendering"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                   <Disc size={80} className="text-yellow-500 opacity-20 animate-spin" />
                   <div className="absolute text-2xl font-black text-white">
                     {Math.round(renderProgress * 100)}%
                   </div>
                </motion.div>
              ) : exportUrl ? (
                <motion.div 
                  key="ready"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-20 h-20 bg-green-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.5)] mb-6">
                    <Download size={40} className="text-black" />
                  </div>
                  <span className="text-[10px] font-black text-green-400 uppercase tracking-[0.4em]">Relic Manifested</span>
                  <p className="text-[8px] text-white/40 font-bold uppercase mt-2">Drag to DAW or Desktop</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 mb-6">
                    <HardDrive size={40} className="text-white/20" />
                  </div>
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">The Divine Relic</span>
                  <p className="text-[8px] text-white/10 font-bold uppercase mt-2">Awaiting the Ritual</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Orbiting particles during render */}
            {isRendering && Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-yellow-500 rounded-full blur-[1px]"
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  rotate: { repeat: Infinity, duration: 1 + i * 0.2, ease: 'linear' },
                  duration: 2, repeat: Infinity
                }}
                style={{ 
                  transformOrigin: `${132 + Math.sin(i) * 10}px center`,
                  left: '50%',
                  top: '50%'
                }}
              />
            ))}
          </motion.div>

          {/* Export Settings Summary */}
          <div className="mt-12 grid grid-cols-3 gap-8">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Format</span>
              <span className="text-[11px] font-black text-white uppercase">WAV 32-Bit</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Sample Rate</span>
              <span className="text-[11px] font-black text-white uppercase">48.0 kHz</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Normalization</span>
              <span className="text-[11px] font-black text-white uppercase">-0.1 dB</span>
            </div>
          </div>
        </div>

        {/* Console / Log */}
        <div className="h-32 glass-panel border border-white/5 bg-black/60 p-4 font-mono text-[9px] overflow-hidden relative">
          <div className="absolute top-2 right-4 flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
          </div>
          <div className="text-white/40 space-y-1">
            <p className="text-yellow-500/60 font-bold">[SYSTEM] Initializing Divine Render Engine v1.0.4...</p>
            <p>[SYSTEM] Mapping sacred frequency nodes (20Hz - 20kHz)...</p>
            <p>[SYSTEM] Applying Celestial Forge mastering chain (Aether v2)...</p>
            <p>[SYSTEM] Manifesting multi-stem arrays (6 channels detected)...</p>
            {isRendering && (
              <motion.p 
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-white/80"
              >
                [PROCESS] Consolidating audio buffers: {Math.round(renderProgress * 100)}% complete...
              </motion.p>
            )}
            {isBatchManifesting && (
               <p className="text-blue-400 animate-pulse">[PROCESS] Invoking multi-stem manifestation sequence...</p>
            )}
            {isZipping && (
               <p className="text-yellow-400 animate-pulse">[PROCESS] Encoding Sacred Archive (ZIP)...</p>
            )}
            {zipUrl && !isZipping && (
               <p className="text-green-400">[SUCCESS] Sacred Archive is ready for ascension.</p>
            )}
            {!isRendering && renderProgress === 1 && (
              <p className="text-green-500 font-bold">[SUCCESS] The Ritual is complete. Relic generated.</p>
            )}
          </div>
        </div>
      </section>

      {/* ─── RIGHT: LOUDNESS SANCTUM ─── */}
      <section className="w-80 flex flex-col gap-4">
        <div className="flex-1 glass-panel border border-white/5 bg-black/40 p-6 flex flex-col">
          <header className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} className="text-yellow-500" />
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Loudness Sanctum</h3>
            </div>
            <div className="h-[1px] w-full bg-white/5" />
          </header>

          {/* Metering */}
          <div className="flex-1 flex gap-6">
            {/* LUFS Meter */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[8px] font-black text-white/30 uppercase">Integrated</span>
                <span className="text-xs font-black text-white">-14.2</span>
              </div>
              <div className="flex-1 bg-white/[0.02] rounded-lg border border-white/5 relative overflow-hidden flex flex-col justify-end p-1">
                {/* Meter Ticks */}
                <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20">
                   {[-3, -6, -9, -12, -15, -18, -21, -24].map(v => (
                     <div key={v} className="w-full flex items-center gap-2">
                       <div className="h-[1px] flex-1 bg-white" />
                       <span className="text-[6px] font-mono">{v}</span>
                     </div>
                   ))}
                </div>
                <motion.div 
                  className="w-full bg-gradient-to-t from-amber-600 via-yellow-400 to-yellow-200 rounded-md shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                  animate={{ height: isRendering ? ['40%', '60%', '55%', '65%', '45%'] : '55%' }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              </div>
              <span className="text-[9px] font-black text-white/20 uppercase text-center mt-3 tracking-widest">LUFS</span>
            </div>

            {/* Peak Meter */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[8px] font-black text-white/30 uppercase">True Peak</span>
                <span className="text-xs font-black text-white">-0.1</span>
              </div>
              <div className="flex-1 bg-white/[0.02] rounded-lg border border-white/5 relative overflow-hidden flex flex-col justify-end p-1">
                <motion.div 
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-md shadow-[0_0_15px_rgba(0,150,255,0.3)]"
                  animate={{ height: isRendering ? ['70%', '95%', '85%', '98%', '75%'] : '85%' }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                />
              </div>
              <span className="text-[9px] font-black text-white/20 uppercase text-center mt-3 tracking-widest">dBTP</span>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield size={14} className="text-yellow-500" />
                <span className="text-[10px] font-black text-white uppercase">Divine Limit</span>
              </div>
              <div className="w-10 h-5 bg-amber-600 rounded-full flex items-center px-1">
                <div className="w-3 h-3 bg-white rounded-full ml-auto shadow-sm" />
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Waves size={14} className="text-blue-400" />
                <span className="text-[10px] font-black text-white uppercase">Dither Souls</span>
              </div>
              <div className="w-10 h-5 bg-white/10 rounded-full flex items-center px-1">
                <div className="w-3 h-3 bg-white/20 rounded-full shadow-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 glass-panel border border-white/5 bg-yellow-500/5 flex items-center justify-between group cursor-pointer hover:bg-yellow-500/10 transition-all">
          <div className="flex items-center gap-3">
            <Share2 size={16} className="text-yellow-500 group-hover:scale-110 transition-transform" />
            <div>
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Ascend to Cloud</h4>
              <p className="text-[8px] text-white/30 font-bold uppercase mt-0.5">Share Ritual with the Pantheon</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-white/20 group-hover:text-yellow-500 group-hover:translate-x-1 transition-all" />
        </div>
      </section>
    </div>
  );
};
