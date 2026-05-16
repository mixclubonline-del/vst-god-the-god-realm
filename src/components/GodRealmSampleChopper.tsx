import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';

interface Slice {
  start: number;
  end: number;
  reverse?: boolean;
  loop?: boolean;
  volume?: number; 
}

interface GodRealmSampleChopperProps {
  buffer?: AudioBuffer | null;
  trackIndex?: number;
  analyser?: AnalyserNode | null;
  sampleParams?: {
    start: number;
    end: number;
    reverse: boolean;
    loop: boolean;
    loopStart: number;
    loopEnd: number;
    slices: Slice[];
  };
  onUpdateParam?: (param: string, val: any) => void;
  // Props passed from VstgodthegodrealmPlugin (for tab rendering fallback)
  activePad?: number;
  parameterValues?: any;
  update?: any;
}

export const GodRealmSampleChopper: React.FC<GodRealmSampleChopperProps> = ({
  buffer = null,
  trackIndex = 0,
  analyser = null,
  sampleParams,
  onUpdateParam,
  activePad,
  parameterValues,
  update
}) => {
  const safeSampleParams = sampleParams || {
    start: 0,
    end: 1,
    reverse: false,
    loop: false,
    loopStart: 0,
    loopEnd: 1,
    slices: []
  };

  const safeOnUpdateParam = onUpdateParam || ((param: string, val: any) => {
    // Optional fallback if we want to log or use the update() prop from parent
    if (update && activePad !== undefined) {
      // update(`pad_${activePad}_${param}`, val);
    }
  });
  const [snapToTransients, setSnapToTransients] = useState(false);
  const [draggingMarker, setDraggingMarker] = useState<{ type: string; index?: number } | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<number | null>(null);
  const [transientSensitivity, setTransientSensitivity] = useState(0.5);
  
  const transientsRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const audioData = useAudioAnalyser(analyser);

  // Robust Spectral Flux Transient Detection (Refined for God Realm)
  const detectTransients = useCallback((sensitivity: number = 0.5) => {
    if (!buffer) return;
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    // Spectral Flux refined: Using a more aggressive flux calculation for trap transients
    const winSize = 1024;
    const stepSize = 512;
    const fluxes: { flux: number, pos: number }[] = [];
    
    let prevEnergy = 0;
    
    for (let i = 0; i < data.length - winSize; i += stepSize) {
      // High-pass filter approximation: sum of differences between adjacent samples
      // We square the differences to emphasize sharp transitions (transients)
      let hfEnergy = 0;
      for (let j = 1; j < winSize; j++) {
        const diff = data[i + j] - data[i + j - 1];
        hfEnergy += diff * diff;
      }
      hfEnergy = Math.sqrt(hfEnergy / winSize);

      // Flux is the positive change in energy
      const flux = Math.max(0, hfEnergy - prevEnergy);
      fluxes.push({ flux, pos: i / data.length });
      prevEnergy = hfEnergy;
    }

    // Dynamic Thresholding with "God Mode" scaling
    const avgFlux = fluxes.reduce((a, b) => a + b.flux, 0) / fluxes.length;
    // Lower sensitivity means HIGHER threshold (fewer transients)
    const threshold = avgFlux * (4.0 - sensitivity * 3.5); 

    const results: number[] = [];
    fluxes.forEach((f, idx) => {
      if (f.flux > threshold) {
        // Local maximum detection (peak picking)
        const prev = fluxes[idx - 1]?.flux || 0;
        const next = fluxes[idx + 1]?.flux || 0;
        if (f.flux > prev && f.flux > next) {
          // Minimum 40ms gap (refined for fast rolls)
          if (results.length === 0 || f.pos - results[results.length - 1] > 0.04) {
            results.push(f.pos);
          }
        }
      }
    });
    
    transientsRef.current = results;
    
    const newSlices = results.map((t, i) => ({
      start: t,
      end: results[i + 1] || 1.0,
      reverse: false,
      loop: false,
      volume: 1.0
    }));
    
    safeOnUpdateParam('slices', newSlices);
    setSelectedSlice(null);
  }, [buffer, onUpdateParam]);

  // High-Fidelity & Reactive Waveform Rendering
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !buffer) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2.5;

    ctx.clearRect(0, 0, width, height);
    
    // 1. Deep Shadow Layer (Atmospheric)
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    for (let i = 0; i < width; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const datum = Math.abs(data[(i * step) + j]);
        if (datum > max) max = datum;
      }
      ctx.lineTo(i, height / 2 - max * amp * 1.4);
    }
    for (let i = width - 1; i >= 0; i--) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const datum = Math.abs(data[(i * step) + j]);
        if (datum > max) max = datum;
      }
      ctx.lineTo(i, height / 2 + max * amp * 1.4);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();

    // 2. Selected Slice Highlight (Divine Aura)
    if (selectedSlice !== null && safeSampleParams.slices[selectedSlice]) {
      const slice = safeSampleParams.slices[selectedSlice];
      const startX = slice.start * width;
      const endX = slice.end * width;
      
      const sGradient = ctx.createLinearGradient(startX, 0, endX, 0);
      sGradient.addColorStop(0, 'rgba(168, 85, 247, 0)');
      sGradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.15)');
      sGradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
      
      ctx.fillStyle = sGradient;
      ctx.fillRect(startX, 0, endX - startX, height);
    }

    // 3. The Energy Core (Glow)
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0)');
    gradient.addColorStop(0.4, 'rgba(168, 85, 247, 0.6)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.6, 'rgba(168, 85, 247, 0.6)');
    gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');

    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    for (let i = 0; i < width; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const datum = Math.abs(data[(i * step) + j]);
        if (datum > max) max = datum;
      }
      ctx.lineTo(i, height / 2 - max * amp);
    }
    for (let i = width - 1; i >= 0; i--) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const datum = Math.abs(data[(i * step) + j]);
        if (datum > max) max = datum;
      }
      ctx.lineTo(i, height / 2 + max * amp);
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // 4. "Lightning" Transient Sparks
    transientsRef.current.forEach(t => {
      const tx = t * width;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.moveTo(tx, height / 2 - 40);
      // Jagged lightning line
      let ly = height / 2 - 40;
      for (let j = 0; j < 5; j++) {
        ly += 16;
        ctx.lineTo(tx + (Math.random() - 0.5) * 10, ly);
      }
      ctx.stroke();

      const glow = ctx.createRadialGradient(tx, height / 2, 0, tx, height / 2, 40);
      glow.addColorStop(0, 'rgba(168, 85, 247, 0.2)');
      glow.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(tx - 40, 0, 80, height);
    });

    // 5. Reactive Analyzer Pulse
    if (audioData.energy > 0.05) {
      ctx.strokeStyle = `rgba(255, 102, 0, ${Math.min(0.8, audioData.energy * 0.8)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 15]);
      ctx.strokeRect(0, 0, width, height);
      ctx.setLineDash([]);
    }

  }, [buffer, selectedSlice, safeSampleParams.slices, audioData]);

  useEffect(() => {
    let frameId: number;
    const loop = () => {
      drawWaveform();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [drawWaveform]);

  useEffect(() => {
    if (buffer && safeSampleParams.slices.length === 0) {
      detectTransients(transientSensitivity);
    }
  }, [buffer]);

  const previewSlice = useCallback((start: number, end: number, reverse: boolean) => {
    if (!buffer) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    source.connect(gain).connect(ctx.destination);
    const duration = (end - start) * buffer.duration;
    source.start(0, start * buffer.duration, duration);
  }, [buffer]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingMarker || !waveformRef.current) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let pos = Math.max(0, Math.min(1, x / rect.width));

    if (snapToTransients && transientsRef.current.length > 0) {
      const closest = transientsRef.current.reduce((prev, curr) => 
        Math.abs(curr - pos) < Math.abs(prev - pos) ? curr : prev
      );
      if (Math.abs(closest - pos) < 0.02) pos = closest;
    }
    
    if (draggingMarker.type === 'start') safeOnUpdateParam('start', pos);
    if (draggingMarker.type === 'end') safeOnUpdateParam('end', pos);
    if (draggingMarker.type === 'loopStart') safeOnUpdateParam('loopStart', pos);
    if (draggingMarker.type === 'loopEnd') safeOnUpdateParam('loopEnd', pos);
    if (draggingMarker.type === 'slice' && draggingMarker.index !== undefined) {
      const nextSlices = [...safeSampleParams.slices];
      nextSlices[draggingMarker.index] = { ...nextSlices[draggingMarker.index], start: pos };
      if (draggingMarker.index > 0) {
        nextSlices[draggingMarker.index - 1] = { ...nextSlices[draggingMarker.index - 1], end: pos };
      }
      safeOnUpdateParam('slices', nextSlices);
    }
  }, [draggingMarker, safeSampleParams.slices, onUpdateParam, snapToTransients]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!waveformRef.current) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let pos = Math.max(0, Math.min(1, x / rect.width));

    // If Alt key or right click (if we wanted), but let's just make clicking the waveform create a slice if no marker is hit
    // The markers have their own onMouseDown which calls stopPropagation.
    // So if we are here, we clicked the empty waveform area.
    
    if (snapToTransients && transientsRef.current.length > 0) {
      const closest = transientsRef.current.reduce((prev, curr) => 
        Math.abs(curr - pos) < Math.abs(prev - pos) ? curr : prev
      );
      if (Math.abs(closest - pos) < 0.02) pos = closest;
    }

    const newSlice = { 
      start: pos, 
      end: Math.min(1.0, pos + 0.1), 
      reverse: false, 
      loop: false, 
      volume: 1.0 
    };

    safeOnUpdateParam('slices', [...safeSampleParams.slices, newSlice].sort((a, b) => a.start - b.start));
    setSelectedSlice(safeSampleParams.slices.length); // Select the new one
  }, [safeSampleParams.slices, onUpdateParam, snapToTransients]);

  const handleMouseUp = useCallback(() => {
    setDraggingMarker(null);
  }, []);

  const updateSlice = (index: number, prop: keyof Slice, val: any) => {
    const nextSlices = [...safeSampleParams.slices];
    nextSlices[index] = { ...nextSlices[index], [prop]: val };
    safeOnUpdateParam('slices', nextSlices);
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-hidden bg-[#050208] border border-white/5 rounded-3xl shadow-[0_20px_100px_rgba(0,0,0,0.8)]">
      
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
        <div className="flex flex-col">
          <span className="text-[10px] font-black tracking-[0.4em] text-[#a855f7] uppercase mb-1">Divine Extraction</span>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">The Chopper</h2>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex flex-col gap-1 items-end">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Flux Sensitivity</span>
              <span className="text-[9px] font-mono text-[#FFD700] font-bold">{transientsRef.current.length} NODES</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.01" 
              value={transientSensitivity}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setTransientSensitivity(val);
                // Real-time re-analysis for feedback
                if (buffer) detectTransients(val);
              }}
              className="w-32 h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-[#FFD700]"
            />
          </div>
          <RelicButton onClick={() => detectTransients(transientSensitivity)} color="#FFD700">Analyze Transients</RelicButton>
          <RelicButton onClick={() => {
            const newSlice = { start: 0.1, end: 0.2, reverse: false, loop: false, volume: 1.0 };
            safeOnUpdateParam('slices', [...safeSampleParams.slices, newSlice]);
          }} color="#a855f7">Manual Slice</RelicButton>
          <RelicButton onClick={() => { safeOnUpdateParam('slices', []); setSelectedSlice(null); }} color="#ef4444" secondary>Purge All</RelicButton>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="flex-[4] relative bg-[#0a0514] rounded-2xl border border-white/5 overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.9)]">
          <div 
            className="absolute inset-0 z-10 cursor-crosshair"
            ref={waveformRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <canvas 
              ref={canvasRef}
              width={1400}
              height={500}
              className="w-full h-full object-fill opacity-90"
            />

            <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
              <Marker x={safeSampleParams.start} color="#ffffff" label="ORIGIN" onMouseDown={() => setDraggingMarker({ type: 'start' })} isDragging={draggingMarker?.type === 'start'} />
              <Marker x={safeSampleParams.end} color="#ffffff" label="DESTINY" onMouseDown={() => setDraggingMarker({ type: 'end' })} isDragging={draggingMarker?.type === 'end'} />
              
              {safeSampleParams.loop && (
                <>
                  <Marker x={safeSampleParams.loopStart} color="#FFD700" label="CYCLE_START" onMouseDown={() => setDraggingMarker({ type: 'loopStart' })} isDragging={draggingMarker?.type === 'loopStart'} />
                  <Marker x={safeSampleParams.loopEnd} color="#FFD700" label="CYCLE_END" onMouseDown={() => setDraggingMarker({ type: 'loopEnd' })} isDragging={draggingMarker?.type === 'loopEnd'} />
                </>
              )}

              {safeSampleParams.slices.map((slice, i) => (
                <Marker 
                  key={i} 
                  x={slice.start} 
                  color="#a855f7" 
                  label={`FRAG_${i+1}`} 
                  isSelected={selectedSlice === i}
                  isDragging={draggingMarker?.type === 'slice' && draggingMarker.index === i}
                  onMouseDown={() => {
                    setDraggingMarker({ type: 'slice', index: i });
                    setSelectedSlice(i);
                  }} 
                  onPreview={() => previewSlice(slice.start, slice.end, !!slice.reverse)}
                />
              ))}
            </svg>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectedSlice !== null && (
            <motion.div 
              key={selectedSlice}
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 30, opacity: 0 }}
              className="w-80 bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-6 overflow-y-auto backdrop-blur-md"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-[11px] font-black text-[#a855f7] uppercase tracking-[0.2em]">Fragment Ritual</span>
                <button onClick={() => setSelectedSlice(null)} className="text-white/20 hover:text-white transition-colors">✕</button>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-4xl font-black text-white italic tracking-tighter">#{selectedSlice + 1}</span>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(168, 85, 247, 0.4)' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    const slice = safeSampleParams.slices[selectedSlice];
                    previewSlice(slice.start, slice.end, !!slice.reverse);
                  }}
                  className="p-4 rounded-full bg-[#a855f7]/20 text-[#a855f7] shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </motion.button>
              </div>

              <div className="space-y-6">
                <DivineToggle 
                  label="Inverted Karma" 
                  active={safeSampleParams.slices[selectedSlice]?.reverse} 
                  color="#FFD700"
                  onClick={() => updateSlice(selectedSlice, 'reverse', !safeSampleParams.slices[selectedSlice]?.reverse)} 
                />
                
                <DivineToggle 
                  label="Eternal Loop" 
                  active={safeSampleParams.slices[selectedSlice]?.loop} 
                  color="#a855f7"
                  onClick={() => updateSlice(selectedSlice, 'loop', !safeSampleParams.slices[selectedSlice]?.loop)} 
                />

                <div className="flex flex-col gap-3">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Spectral Gain</span>
                    <span className="text-[10px] font-mono text-[#a855f7]">{( (safeSampleParams.slices[selectedSlice]?.volume ?? 1) * 100).toFixed(0)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.01" 
                    value={safeSampleParams.slices[selectedSlice]?.volume ?? 1}
                    onChange={(e) => updateSlice(selectedSlice, 'volume', parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-[#a855f7]"
                  />
                </div>
                
                <button 
                  onClick={() => {
                    const nextSlices = safeSampleParams.slices.filter((_, i) => i !== selectedSlice);
                    safeOnUpdateParam('slices', nextSlices);
                    setSelectedSlice(null);
                  }}
                  className="mt-8 w-full py-3 bg-red-500/5 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-red-500/10 hover:border-red-500/40 transition-all"
                >
                  Dissolve Fragment
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-28 flex items-center justify-between px-10 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/5">
        
        <div className="flex items-center gap-12">
          <DivineToggle 
            label="Global Cycle" 
            active={safeSampleParams.loop} 
            color="#FFD700"
            onClick={() => safeOnUpdateParam('loop', !safeSampleParams.loop)} 
          />
          
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-black text-[#a855f7] uppercase tracking-widest">Chronology</span>
            <button 
              className={`px-8 py-3 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${safeSampleParams.reverse ? 'bg-[#FFD700]/10 border-[#FFD700]/50 text-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.2)]' : 'bg-white/5 border-white/10 text-white/30 hover:text-white'}`}
              onClick={() => safeOnUpdateParam('reverse', !safeSampleParams.reverse)}
            >
              {safeSampleParams.reverse ? 'Retrograde' : 'Chronological'}
            </button>
          </div>

          <DivineToggle 
            label="Sacred Snap" 
            active={snapToTransients} 
            color="#00f2ff"
            onClick={() => setSnapToTransients(!snapToTransients)} 
          />
        </div>

        <div className="h-16 w-px bg-white/5 mx-8" />

        <div className="flex-1 flex justify-around">
          <StatDisplay label="Origin" value={`${(safeSampleParams.start * 100).toFixed(1)}%`} />
          <StatDisplay label="Destiny" value={`${(safeSampleParams.end * 100).toFixed(1)}%`} />
          <StatDisplay label="Fragments" value={safeSampleParams.slices.length.toString()} />
        </div>

      </div>
    </div>
  );
};

const RelicButton = ({ children, onClick, color, secondary }: any) => (
  <motion.button
    whileHover={{ scale: 1.05, backgroundColor: `${color}15`, borderColor: `${color}66` }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`px-6 py-3 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${secondary ? 'border-red-500/20 text-red-400 bg-red-500/5' : `text-white bg-white/5`}`}
    style={{ borderColor: secondary ? undefined : `${color}22`, color: secondary ? undefined : color }}
  >
    {children}
  </motion.button>
);

const DivineToggle = ({ label, active, onClick, color }: any) => (
  <div className="flex flex-col gap-3">
    <span className="text-[10px] font-black text-[#a855f7] uppercase tracking-widest opacity-60">{label}</span>
    <button 
      className={`w-16 h-8 rounded-full border relative transition-all duration-500 ${active ? 'bg-white/5' : 'bg-black/40 border-white/5'}`}
      style={{ borderColor: active ? `${color}44` : undefined }}
      onClick={onClick}
    >
      <motion.div 
        className="absolute top-1.5 w-4 h-4 rounded-full shadow-lg"
        animate={{ left: active ? '38px' : '6px', backgroundColor: active ? color : 'rgba(255,255,255,0.1)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{ boxShadow: active ? `0 0 20px ${color}` : 'none' }}
      />
    </button>
  </div>
);

const Marker = ({ x, color, label, isSelected, isDragging, onMouseDown, onPreview }: any) => {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  
  useEffect(() => {
    if (!isDragging) {
      setParticles([]);
      return;
    }
    const interval = setInterval(() => {
      setParticles(prev => [
        ...prev.slice(-15),
        { id: Math.random(), x: (Math.random() - 0.5) * 40, y: Math.random() * 500 }
      ]);
    }, 50);
    return () => clearInterval(interval);
  }, [isDragging]);

  return (
    <g 
      className="cursor-ew-resize group/marker pointer-events-auto"
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(); }}
    >
      {/* Dynamic Particles on Drag */}
      {particles.map(p => (
        <motion.circle 
          key={p.id}
          cx={x * 100 + '%'} cy={p.y} r="1.5"
          initial={{ opacity: 0.8, x: 0 }}
          animate={{ opacity: 0, x: p.x, scale: 0 }}
          transition={{ duration: 0.8 }}
          fill={color}
          style={{ filter: 'blur(1px)' }}
        />
      ))}

      <motion.line 
        x1={`${x * 100}%`} y1="0" x2={`${x * 100}%`} y2="100%" 
        stroke={color} 
        strokeWidth={isSelected ? 2 : 1}
        initial={{ opacity: 0.2 }}
        animate={{ opacity: (isSelected || isDragging) ? 1 : 0.2 }}
        whileHover={{ opacity: 1, strokeWidth: 2 }}
        className="drop-shadow-[0_0_10px_black]"
      />
      
      <motion.circle 
        cx={`${x * 100}%`} cy="15" r="5" fill={color}
        animate={{ scale: isSelected ? [1, 1.4, 1] : 1, opacity: isSelected ? [0.6, 1, 0.6] : 0.3 }}
        transition={{ repeat: Infinity, duration: 3 }}
      />

      <motion.rect 
        x={x * 100 + '%'} y="15" width="90" height="24" rx="6" 
        transform="translate(-45, 0)"
        fill="#000"
        stroke={color}
        strokeWidth={isSelected ? 2 : 1}
        className={`${isSelected ? 'opacity-100' : 'opacity-20'} group-hover/marker:opacity-100 transition-opacity`}
      />
      
      {onPreview && (
        <foreignObject x={x * 100 + '%'} y="19" width="16" height="16" transform="translate(24, 0)">
          <button 
            onMouseDown={(e) => { e.stopPropagation(); onPreview(); }}
            className="text-white/20 hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </foreignObject>
      )}

      <text 
        x={`${x * 100}%`} y="31" textAnchor="middle" 
        className={`text-[10px] font-black ${(isSelected || isDragging) ? 'fill-white' : 'fill-white/40'} pointer-events-none uppercase tracking-tighter`}
      >
        {label}
      </text>
    </g>
  );
};


const StatDisplay = ({ label, value }: { label: string, value: string }) => (
  <div className="text-center">
    <div className="text-[10px] text-[#a855f7] font-black uppercase tracking-widest mb-2 opacity-60">{label}</div>
    <div className="text-2xl font-black text-white tracking-tighter italic">{value}</div>
  </div>
);
