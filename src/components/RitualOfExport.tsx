import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileAudio, Zap, Download, Disc, HardDrive, 
  Activity, Shield, Waves, Share2, ArrowRight, Archive, Package,
  ChevronDown
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

  // Export dropdown states
  const [format, setFormat] = useState<'wav_32' | 'wav_24' | 'wav_16' | 'mp3' | 'flac'>('wav_32');
  const [sampleRate, setSampleRate] = useState<'44100' | '48000' | '96000'>('48000');
  const [normalization, setNormalization] = useState<'off' | '0_1' | '1_0'>('0_1');

  const [isFormatOpen, setIsFormatOpen] = useState(false);
  const [isSampleRateOpen, setIsSampleRateOpen] = useState(false);
  const [isNormalizationOpen, setIsNormalizationOpen] = useState(false);

  // Meter levels states
  const [lufsVal, setLufsVal] = useState(-18.0);
  const [dbtpVal, setDbtpVal] = useState(-12.0);
  const [peakHoldLufs, setPeakHoldLufs] = useState(-18.0);
  const [peakHoldDbtp, setPeakHoldDbtp] = useState(-12.0);

  // Audio metering integration (both JUCE analyser and simulation)
  useEffect(() => {
    let animationFrameId: number;
    let dataArray: Uint8Array;
    let bufferLength = 0;

    if (analyser) {
      analyser.fftSize = 256;
      bufferLength = analyser.fftSize;
      dataArray = new Uint8Array(bufferLength);
    }

    const updateMeters = () => {
      let currentPeak = 0.001;
      let currentRms = 0.001;

      if (isRendering || renderingStemIdx !== null) {
        // High fidelity rendering simulation: nice dynamic peaks/rms
        const t = Date.now() / 150;
        const base = 0.5 + Math.sin(t) * 0.15;
        const jitter = Math.random() * 0.08;
        currentPeak = Math.min(1.0, base + jitter + 0.15);
        currentRms = Math.min(1.0, base * 0.7 + jitter * 0.3);
      } else if (analyser) {
        analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = (dataArray[i] - 128) / 128; // Normalize to [-1.0, 1.0]
          const absVal = Math.abs(val);
          if (absVal > currentPeak) {
            currentPeak = absVal;
          }
          sumSquares += val * val;
        }
        currentRms = Math.sqrt(sumSquares / bufferLength);
      } else {
        // Subtle ambient background noise/idle animation
        const t = Date.now() / 1000;
        currentPeak = 0.02 + Math.sin(t) * 0.005;
        currentRms = 0.01 + Math.sin(t * 0.7) * 0.003;
      }

      // DB Conversions
      let dbPeak = 20 * Math.log10(currentPeak);
      if (dbPeak < -60) dbPeak = -60;
      if (dbPeak > 0) dbPeak = 0;

      let dbRms = 20 * Math.log10(currentRms);
      if (dbRms < -60) dbRms = -60;
      if (dbRms > 0) dbRms = 0;

      // Map RMS to LUFS scale (-60 to 0)
      const lufs = dbRms + 4.0 > 0 ? 0 : dbRms + 4.0;

      // Ballistics (Smoothing)
      setLufsVal(prev => prev * 0.8 + lufs * 0.2);
      setDbtpVal(prev => prev * 0.6 + dbPeak * 0.4);

      // Peak Hold Decay
      setPeakHoldLufs(prev => {
        if (lufs > prev) return lufs;
        return Math.max(-60, prev - 0.08); // slow decay
      });
      setPeakHoldDbtp(prev => {
        if (dbPeak > prev) return dbPeak;
        return Math.max(-60, prev - 0.12); // slow decay
      });

      animationFrameId = requestAnimationFrame(updateMeters);
    };

    animationFrameId = requestAnimationFrame(updateMeters);
    return () => cancelAnimationFrame(animationFrameId);
  }, [analyser, isRendering, renderingStemIdx]);

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
        <div className="flex-1 glass-panel border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent flex flex-col items-center justify-start pt-4 pb-2 px-6 text-center relative overflow-y-auto custom-scrollbar">
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
            whileHover={{ scale: 1.03 }}
            animate={{ 
              scale: isDragging ? 0.95 : 1,
              boxShadow: exportUrl 
                ? '0 0 60px rgba(34,197,94,0.25)' 
                : isRendering 
                  ? '0 0 80px rgba(245,176,65,0.3)' 
                  : '0 0 30px rgba(255,215,0,0.05)'
            }}
            className={`relative w-36 h-36 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
              isRendering 
                ? 'bg-yellow-500/5 ring-4 ring-yellow-500/20' 
                : exportUrl
                  ? 'bg-green-500/5 border-2 border-green-500/30 cursor-grab active:cursor-grabbing hover:border-green-400'
                  : 'bg-white/[0.02] border border-white/5 hover:border-yellow-500/30 hover:bg-yellow-500/5 cursor-default'
            }`}
          >
            {/* Sacred Geometry Sigil (Persistent Relic Visual) */}
            <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <radialGradient id="relicGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={exportUrl ? '#22c55e' : '#f5b041'} stopOpacity={isRendering ? '0.4' : '0.15'} />
                  <stop offset="100%" stopColor="#000" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="triUpGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={exportUrl ? '#4ade80' : '#f5b041'} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={exportUrl ? '#166534' : '#78350f'} stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="triDownGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={exportUrl ? '#166534' : '#78350f'} stopOpacity="0.02" />
                  <stop offset="100%" stopColor={exportUrl ? '#4ade80' : '#f5b041'} stopOpacity="0.2" />
                </linearGradient>
                <filter id="svgGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation={isRendering ? "4" : "1.5"} result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Glowing Background Core */}
              <circle cx="100" cy="100" r="90" fill="url(#relicGlow)" />

              {/* Outer Runic Rings (Rotates clockwise) */}
              <motion.g
                animate={{ rotate: isRendering ? 360 : 30 }}
                transition={{
                  rotate: isRendering 
                    ? { repeat: Infinity, duration: 4, ease: "linear" } 
                    : { repeat: Infinity, duration: 80, ease: "linear" }
                }}
                style={{ transformOrigin: '100px 100px' }}
              >
                {/* Outer dotted scale */}
                <circle cx="100" cy="100" r="88" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="1" strokeDasharray="3, 5" strokeOpacity="0.4" fill="none" />
                {/* Thin outer ring */}
                <circle cx="100" cy="100" r="82" stroke={exportUrl ? '#4ade80' : '#f5b041'} strokeWidth="0.75" strokeOpacity="0.6" fill="none" />
                {/* Runes or ticks */}
                {Array.from({ length: 24 }).map((_, idx) => {
                  const angle = (idx * 360) / 24;
                  return (
                    <line
                      key={idx}
                      x1="100"
                      y1="14"
                      x2="100"
                      y2="18"
                      stroke={exportUrl ? '#22c55e' : '#f5b041'}
                      strokeWidth="1.5"
                      strokeOpacity="0.7"
                      transform={`rotate(${angle}, 100, 100)`}
                    />
                  );
                })}
              </motion.g>

              {/* Middle Ring (Rotates counter-clockwise) */}
              <motion.g
                animate={{ rotate: isRendering ? -360 : -15 }}
                transition={{
                  rotate: isRendering 
                    ? { repeat: Infinity, duration: 6, ease: "linear" } 
                    : { repeat: Infinity, duration: 100, ease: "linear" }
                }}
                style={{ transformOrigin: '100px 100px' }}
              >
                <circle cx="100" cy="100" r="72" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="0.75" strokeDasharray="10, 6" strokeOpacity="0.5" fill="none" />
                <circle cx="100" cy="100" r="66" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="0.5" strokeOpacity="0.3" fill="none" />
              </motion.g>

              {/* Inner Sacred Geometry Lattice (Merkaba / Metatron's Cube wireframe) */}
              <motion.g
                animate={{ 
                  rotate: isRendering ? 360 : 0,
                  scale: isRendering ? [1, 1.03, 1] : 1
                }}
                transition={{
                  rotate: isRendering 
                    ? { repeat: Infinity, duration: 15, ease: "linear" } 
                    : { duration: 0.5 },
                  scale: isRendering
                    ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
                    : {}
                }}
                style={{ transformOrigin: '100px 100px' }}
                filter="url(#svgGlow)"
              >
                {/* Star Tetrahedron / Hexagram Polygons */}
                <polygon points="100,45 147.6,127.6 52.4,127.6" fill="url(#triUpGrad)" stroke={exportUrl ? '#4ade80' : '#f5b041'} strokeWidth="1" strokeOpacity="0.5" />
                <polygon points="100,155 147.6,72.4 52.4,72.4" fill="url(#triDownGrad)" stroke={exportUrl ? '#4ade80' : '#f5b041'} strokeWidth="1" strokeOpacity="0.5" />

                {/* Outer Hexagon connecting lines */}
                <polygon points="100,45 147.6,72.4 147.6,127.6 100,155 52.4,127.6 52.4,72.4" fill="none" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="0.75" strokeOpacity="0.3" />

                {/* Inner Lattice Diameters / Connecting lines */}
                <line x1="100" y1="45" x2="100" y2="155" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="0.5" strokeOpacity="0.25" />
                <line x1="52.4" y1="72.4" x2="147.6" y2="127.6" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="0.5" strokeOpacity="0.25" />
                <line x1="52.4" y1="127.6" x2="147.6" y2="72.4" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="0.5" strokeOpacity="0.25" />

                <line x1="100" y1="45" x2="147.6" y2="127.6" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="0.5" strokeOpacity="0.25" />
                <line x1="100" y1="45" x2="52.4" y2="127.6" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="0.5" strokeOpacity="0.25" />
                <line x1="100" y1="155" x2="147.6" y2="72.4" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="0.5" strokeOpacity="0.25" />
                <line x1="100" y1="155" x2="52.4" y2="72.4" stroke={exportUrl ? '#22c55e' : '#f5b041'} strokeWidth="0.5" strokeOpacity="0.25" />

                {/* Lattice Nodes (Small gold/green dots at vertices) */}
                {[
                  { cx: 100, cy: 45 }, { cx: 147.6, cy: 72.4 }, { cx: 147.6, cy: 127.6 },
                  { cx: 100, cy: 155 }, { cx: 52.4, cy: 127.6 }, { cx: 52.4, cy: 72.4 },
                  { cx: 100, cy: 100 }
                ].map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.cx}
                    cy={pt.cy}
                    r={i === 6 ? "4" : "2.5"}
                    fill={exportUrl ? '#22c55e' : '#f5b041'}
                    stroke="#fff"
                    strokeWidth="0.5"
                    className={isRendering ? 'animate-pulse' : ''}
                  />
                ))}
              </motion.g>
            </svg>

            {/* Centered state content overlay */}
            <div className="absolute z-10 flex flex-col items-center justify-center text-center">
              <AnimatePresence mode="wait">
                {isRendering ? (
                  <motion.div 
                    key="rendering"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex flex-col items-center"
                  >
                     <div className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">
                       {Math.round(renderProgress * 100)}%
                     </div>
                     <span className="text-[7px] font-black text-yellow-500 uppercase tracking-widest mt-1">Forging Relic</span>
                  </motion.div>
                ) : exportUrl ? (
                  <motion.div 
                    key="ready"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center cursor-grab active:cursor-grabbing"
                  >
                    <motion.div 
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(34,197,94,0.4)] border border-green-300/30 mb-2"
                    >
                      <Download size={24} className="text-black" />
                    </motion.div>
                    <span className="text-[9px] font-black text-green-400 uppercase tracking-[0.2em]">Ascended</span>
                    <p className="text-[6px] text-white/40 font-black uppercase tracking-wider mt-0.5">Drag to DAW</p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 mb-2 hover:border-yellow-500/20 transition-colors">
                      <HardDrive size={24} className="text-white/20" />
                    </div>
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.25em]">Dormant Relic</span>
                    <p className="text-[6px] text-white/15 font-black uppercase tracking-wider mt-0.5">Manifest Stems</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Export Settings Summary */}
          <div className="mt-4 grid grid-cols-3 gap-8">
            {/* Format Selector */}
            <div className="flex flex-col items-center relative z-30">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1.5">Format</span>
              <button
                onClick={() => {
                  setIsFormatOpen(!isFormatOpen);
                  setIsSampleRateOpen(false);
                  setIsNormalizationOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-black text-white uppercase tracking-wider transition-all backdrop-blur-md ${
                  isFormatOpen 
                    ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(230,175,46,0.2)]'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                {format === 'wav_32' && 'WAV 32-Bit'}
                {format === 'wav_24' && 'WAV 24-Bit'}
                {format === 'wav_16' && 'WAV 16-Bit'}
                {format === 'mp3' && 'MP3 320k'}
                {format === 'flac' && 'FLAC'}
                <ChevronDown size={10} className={`text-white/40 transition-transform ${isFormatOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isFormatOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    className="absolute top-12 left-1/2 -translate-x-1/2 w-32 border border-white/10 bg-black/90 p-1 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col gap-0.5"
                  >
                    {[
                      { val: 'wav_32', label: 'WAV 32-Bit' },
                      { val: 'wav_24', label: 'WAV 24-Bit' },
                      { val: 'wav_16', label: 'WAV 16-Bit' },
                      { val: 'mp3', label: 'MP3 320kbps' },
                      { val: 'flac', label: 'FLAC Lossless' }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setFormat(opt.val as any);
                          setIsFormatOpen(false);
                        }}
                        className={`w-full px-2 py-1.5 text-left text-[9px] font-bold rounded-lg transition-all ${
                          format === opt.val
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sample Rate Selector */}
            <div className="flex flex-col items-center relative z-30">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1.5">Sample Rate</span>
              <button
                onClick={() => {
                  setIsSampleRateOpen(!isSampleRateOpen);
                  setIsFormatOpen(false);
                  setIsNormalizationOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-black text-white uppercase tracking-wider transition-all backdrop-blur-md ${
                  isSampleRateOpen 
                    ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(230,175,46,0.2)]'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                {sampleRate === '44100' && '44.1 kHz'}
                {sampleRate === '48000' && '48.0 kHz'}
                {sampleRate === '96000' && '96.0 kHz'}
                <ChevronDown size={10} className={`text-white/40 transition-transform ${isSampleRateOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isSampleRateOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    className="absolute top-12 left-1/2 -translate-x-1/2 w-32 border border-white/10 bg-black/90 p-1 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col gap-0.5"
                  >
                    {[
                      { val: '44100', label: '44.1 kHz' },
                      { val: '48000', label: '48.0 kHz' },
                      { val: '96000', label: '96.0 kHz' }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setSampleRate(opt.val as any);
                          setIsSampleRateOpen(false);
                        }}
                        className={`w-full px-2 py-1.5 text-left text-[9px] font-bold rounded-lg transition-all ${
                          sampleRate === opt.val
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Normalization Selector */}
            <div className="flex flex-col items-center relative z-30">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1.5">Normalization</span>
              <button
                onClick={() => {
                  setIsNormalizationOpen(!isNormalizationOpen);
                  setIsFormatOpen(false);
                  setIsSampleRateOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-black text-white uppercase tracking-wider transition-all backdrop-blur-md ${
                  isNormalizationOpen 
                    ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(230,175,46,0.2)]'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                {normalization === 'off' && 'Disabled'}
                {normalization === '0_1' && '-0.1 dBFS'}
                {normalization === '1_0' && '-1.0 dBFS'}
                <ChevronDown size={10} className={`text-white/40 transition-transform ${isNormalizationOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isNormalizationOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    className="absolute top-12 left-1/2 -translate-x-1/2 w-32 border border-white/10 bg-black/90 p-1 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col gap-0.5"
                  >
                    {[
                      { val: 'off', label: 'Disabled' },
                      { val: '0_1', label: '-0.1 dBFS' },
                      { val: '1_0', label: '-1.0 dBFS' }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setNormalization(opt.val as any);
                          setIsNormalizationOpen(false);
                        }}
                        className={`w-full px-2 py-1.5 text-left text-[9px] font-bold rounded-lg transition-all ${
                          normalization === opt.val
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mastering Mojo Chain */}
          <div className="mt-2 w-full border border-white/5 bg-white/[0.01] rounded-xl p-2 flex flex-col gap-1.5 relative overflow-hidden flex-shrink-0">
            <div className="flex justify-between items-center px-1">
              <span className="text-[6px] font-black text-white/30 uppercase tracking-[0.25em]">Mastering Mojo Chain</span>
              <div className="flex gap-1 items-center">
                <span className="w-1 h-1 rounded-full bg-green-500/80 shadow-[0_0_6px_#22c55e]" />
                <span className="text-[5px] font-black text-green-400 uppercase tracking-widest">Active</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 relative">
              {/* Pulsing signal path line */}
              {isRendering && (
                <motion.div 
                  className="absolute top-[16px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-yellow-500/0 via-yellow-400 to-yellow-500/0 z-0 pointer-events-none"
                  animate={{ left: ['0%', '100%'], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              )}

              {/* Module 1: Input Gain */}
              <div className="glass-panel border border-white/5 bg-black/40 p-1 rounded-lg flex flex-col items-center relative z-10">
                <span className="text-[5px] font-black text-white/20 uppercase tracking-wider mb-0.5">Gain</span>
                {/* Mini Visual */}
                <div className="h-4 w-full flex items-center justify-center relative">
                  <div className="w-3 h-3 rounded-full border border-white/10 flex items-center justify-center">
                    <motion.div 
                      className="w-0.5 h-2 bg-yellow-500/70 origin-bottom"
                      style={{ 
                        transform: `rotate(${(parameterValues.masterInputGain ?? 0) * 10}deg)` 
                      }}
                    />
                  </div>
                </div>
                <span className="text-[7px] font-mono font-black text-white mt-0.5">
                  {(parameterValues.masterInputGain ?? 0) >= 0 ? '+' : ''}{(parameterValues.masterInputGain ?? 0).toFixed(1)}
                </span>
              </div>

              {/* Module 2: Aether Drive */}
              <div className="glass-panel border border-white/5 bg-black/40 p-1 rounded-lg flex flex-col items-center relative z-10">
                <span className="text-[5px] font-black text-white/20 uppercase tracking-wider mb-0.5">Drive</span>
                {/* Mini Visual */}
                <div className="h-4 w-full flex items-center justify-center">
                  <svg className="w-8 h-3 text-orange-500/40" viewBox="0 0 40 16">
                    <motion.path 
                      d="M0,8 Q5,-4 10,8 T20,8 T30,8 T40,8" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="1.5"
                      animate={{ 
                        strokeWidth: isRendering ? [1.5, 2.5, 1.5] : 1.5,
                        opacity: isRendering ? [0.4, 0.9, 0.4] : 0.4
                      }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  </svg>
                </div>
                <span className="text-[7px] font-mono font-black text-white mt-0.5">
                  {Math.round(parameterValues.masterDrive ?? 20)}%
                </span>
              </div>

              {/* Module 3: Dynamic Limit */}
              <div className="glass-panel border border-white/5 bg-black/40 p-1 rounded-lg flex flex-col items-center relative z-10">
                <span className="text-[5px] font-black text-white/20 uppercase tracking-wider mb-0.5">Ceiling</span>
                {/* Mini Visual */}
                <div className="h-4 w-full flex items-center justify-center relative">
                  <div className="w-8 h-[1px] bg-red-500/30 absolute top-1/2 -translate-y-1/2" />
                  <motion.div 
                    className="w-8 h-1 bg-gradient-to-b from-yellow-500/20 to-transparent"
                    animate={{ 
                      y: isRendering ? [0, 1, 0] : 0,
                      opacity: isRendering ? [0.3, 0.7, 0.3] : 0.3
                    }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                </div>
                <span className="text-[7px] font-mono font-black text-white mt-0.5">
                  {(parameterValues.masterCeiling ?? -0.1).toFixed(1)}
                </span>
              </div>

              {/* Module 4: Stereo Imager */}
              <div className="glass-panel border border-white/5 bg-black/40 p-1 rounded-lg flex flex-col items-center relative z-10">
                <span className="text-[5px] font-black text-white/20 uppercase tracking-wider mb-0.5">Imager</span>
                {/* Mini Visual */}
                <div className="h-4 w-full flex items-center justify-center">
                  <motion.div 
                    className="w-4 h-2 border border-cyan-400/20 rounded-full flex items-center justify-center"
                    animate={{ 
                      scaleX: isRendering ? [0.8, 1.2, 0.8] : 1,
                      scaleY: isRendering ? [0.9, 1.1, 0.9] : 1 
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="w-0.5 h-0.5 bg-cyan-400 rounded-full" />
                  </motion.div>
                </div>
                <span className="text-[7px] font-mono font-black text-white mt-0.5">
                  {Math.round(parameterValues.masterWidth ?? 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Console / Log */}
        <div className="h-20 glass-panel border border-white/5 bg-black/60 p-2.5 font-mono text-[9px] overflow-hidden relative flex-shrink-0">
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
                <span className="text-xs font-mono font-black text-white">{lufsVal > -60 ? lufsVal.toFixed(1) : '-INF'}</span>
              </div>
              <div className="flex-1 bg-black/40 rounded-lg border border-white/5 relative overflow-hidden flex flex-col justify-end p-1">
                {/* Meter Ticks */}
                <div className="absolute inset-0 pointer-events-none">
                  {[0, -3, -6, -9, -12, -15, -18, -24, -36, -48, -60].map(tick => {
                    const topPercent = (Math.abs(tick) / 60) * 100;
                    return (
                      <div 
                        key={tick} 
                        className="absolute left-0 right-0 border-t border-white/[0.04] flex justify-end pr-2"
                        style={{ top: `${topPercent}%` }}
                      >
                        <span className="text-[5px] font-mono text-white/20 -mt-1">{tick}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Meter Bar */}
                <motion.div 
                  className="w-full bg-gradient-to-t from-amber-600 via-yellow-500 to-yellow-300 rounded-md shadow-[0_0_10px_rgba(255,215,0,0.15)]"
                  style={{ height: `${Math.max(0, Math.min(100, ((lufsVal + 60) / 60) * 100))}%` }}
                  transition={{ type: "tween", ease: "linear", duration: 0.05 }}
                />
                {/* Peak Hold Indicator */}
                <motion.div 
                  className="absolute left-1 right-1 h-[2px] bg-white shadow-[0_0_8px_#fff] rounded-full z-10"
                  style={{ bottom: `${Math.max(0, Math.min(99, ((peakHoldLufs + 60) / 60) * 100))}%` }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                />
              </div>
              <span className="text-[9px] font-black text-white/20 uppercase text-center mt-3 tracking-widest">LUFS</span>
            </div>

            {/* Peak Meter */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[8px] font-black text-white/30 uppercase">True Peak</span>
                <span className="text-xs font-mono font-black text-white">{dbtpVal > -60 ? dbtpVal.toFixed(1) : '-INF'}</span>
              </div>
              <div className="flex-1 bg-black/40 rounded-lg border border-white/5 relative overflow-hidden flex flex-col justify-end p-1">
                {/* Meter Ticks */}
                <div className="absolute inset-0 pointer-events-none">
                  {[0, -3, -6, -9, -12, -15, -18, -24, -36, -48, -60].map(tick => {
                    const topPercent = (Math.abs(tick) / 60) * 100;
                    return (
                      <div 
                        key={tick} 
                        className="absolute left-0 right-0 border-t border-white/[0.04] flex justify-end pr-2"
                        style={{ top: `${topPercent}%` }}
                      >
                        <span className="text-[5px] font-mono text-white/20 -mt-1">{tick}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Meter Bar */}
                <motion.div 
                  className="w-full bg-gradient-to-t from-blue-600 via-cyan-400 to-blue-300 rounded-md shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                  style={{ height: `${Math.max(0, Math.min(100, ((dbtpVal + 60) / 60) * 100))}%` }}
                  transition={{ type: "tween", ease: "linear", duration: 0.05 }}
                />
                {/* Peak Hold Indicator */}
                <motion.div 
                  className="absolute left-1 right-1 h-[2px] bg-white shadow-[0_0_8px_#fff] rounded-full z-10"
                  style={{ bottom: `${Math.max(0, Math.min(99, ((peakHoldDbtp + 60) / 60) * 100))}%` }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
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
