/**
 * VST God Forge — Live Chain Preview
 * Real-time WebAudio preview of the DSP signal chain with waveform visualization,
 * transport controls, test tone selection, and per-module bypass toggles.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChainPreviewEngine, type TestToneType } from '@/services/webAudioPreview';
import type { DSPChainModule, DSPModuleType } from '@/services/types';
import { assetPersistence } from '@/services/assetPersistence';

// ─── Module Colors (match ControlMapper) ────────────────────────────────────

const MODULE_COLORS: Record<DSPModuleType, string> = {
  eq: '#ffcc00',        // Amber
  compressor: '#FFD700',  // Ember Orange
  delay: '#ff9900',     // Deep Orange
  reverb: '#ff4400',    // Red-Orange
  distortion: '#ff2200', // Crimson Ember
  gain: '#ffaa00',      // Gold
  chorus: '#FFA726',    // Bright Orange
  phaser: '#ff7700',    // Mid Orange
  limiter: '#cc3300',   // Dark Ember
  multi808: '#ff3d00',   // Sub Ember
  celestialKeys: '#ffc857', // Celestial Gold
};

const MODULE_ICONS: Record<DSPModuleType, string> = {
  eq: '📊',
  compressor: '🗜️',
  delay: '🔁',
  reverb: '🌊',
  distortion: '🔥',
  gain: '🔊',
  chorus: '🌀',
  phaser: '💫',
  limiter: '🧱',
  multi808: '🔻',
  celestialKeys: '✨',
};

// ─── Test Tone Options ──────────────────────────────────────────────────────

const TONE_OPTIONS: { id: TestToneType; label: string; icon: string }[] = [
  { id: 'sine', label: 'Sine 440Hz', icon: '〰️' },
  { id: 'white_noise', label: 'White Noise', icon: '📡' },
  { id: 'pink_noise', label: 'Pink Noise', icon: '🌸' },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface LiveChainPreviewProps {
  chain: DSPChainModule[];
  parameterValues?: Record<string, any>;
  onBypassToggle: (instanceId: string, bypassed: boolean) => void;
}

export const LiveChainPreview: React.FC<LiveChainPreviewProps> = ({
  chain,
  parameterValues,
  onBypassToggle,
}) => {
  const engineRef = useRef<ChainPreviewEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const dprRef = useRef<number>(1);
  const initialBuildDoneRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [selectedTone, setSelectedTone] = useState<TestToneType>('sine');
  const [isInitialized, setIsInitialized] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; id: string } | null>(null);
  const [vizMode, setVizMode] = useState<'waveform' | 'spectrum'>('waveform');
  const [outputLevel, setOutputLevel] = useState(0); // 0–1 normalized RMS
  const levelTimerRef = useRef<number>(0);

  // ── Initialize Engine ───────────────────────────────────────────────────

  const initEngine = useCallback(async () => {
    if (!engineRef.current) {
      engineRef.current = new ChainPreviewEngine();
    }
    await engineRef.current.init();

    // Check for persisted sample
    const lastSampleId = await assetPersistence.getMetadata('last_used_sample');
    if (lastSampleId && !uploadedFile) {
      const record = await assetPersistence.getSample(lastSampleId);
      if (record) {
        console.log(`[LiveChainPreview] Restoring sample: ${record.name}`);
        await engineRef.current.loadAudioBuffer(record.data);
        setUploadedFile({ name: record.name, id: record.id });
      }
    }

    setIsInitialized(true);
  }, [uploadedFile]);

  // ── Rebuild Graph When Chain Changes ────────────────────────────────────

  useEffect(() => {
    if (!engineRef.current || !isInitialized) return;

    // Skip the first render after init — handlePlay already called buildGraph
    if (!initialBuildDoneRef.current) {
      initialBuildDoneRef.current = true;
      return;
    }

    const wasPlaying = engineRef.current.isPlaying;
    if (wasPlaying) {
      engineRef.current.stop();
    }
    engineRef.current.buildGraph(chain);
    if (wasPlaying) {
      engineRef.current.play();
    }
  }, [chain, isInitialized]);

  // ── Canvas Sizing & Grid Cache ──────────────────────────────────────────
  
  const updateCanvasSize = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const targetWidth = Math.floor(width * dpr);
    const targetHeight = Math.floor(height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      renderGridCache(targetWidth, targetHeight, dpr);
    }
  }, []);

  const renderGridCache = (W: number, H: number, dpr: number) => {
    if (!gridCanvasRef.current) {
      gridCanvasRef.current = document.createElement('canvas');
    }
    const gCanvas = gridCanvasRef.current;
    gCanvas.width = W;
    gCanvas.height = H;
    const gCtx = gCanvas.getContext('2d');
    if (!gCtx) return;

    // Background - Midnight Deep
    gCtx.fillStyle = '#050507';
    gCtx.fillRect(0, 0, W, H);

    // Grid lines - Deep Ember Glow
    gCtx.strokeStyle = 'rgba(255, 102, 0, 0.04)';
    gCtx.lineWidth = 1 * dpr;
    
    // Vertical grid
    const gridSpacingX = W / 12;
    for (let x = 0; x <= W; x += gridSpacingX) {
      gCtx.beginPath();
      gCtx.moveTo(x, 0);
      gCtx.lineTo(x, H);
      gCtx.stroke();
    }

    // Horizontal grid
    const gridSpacingY = H / 6;
    for (let y = 0; y <= H; y += gridSpacingY) {
      gCtx.beginPath();
      gCtx.moveTo(0, y);
      gCtx.lineTo(W, y);
      gCtx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateCanvasSize(width, height);
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [updateCanvasSize]);

  // ── Sync Parameters ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!engineRef.current || !isInitialized || !parameterValues) return;
    engineRef.current.updateFromParameters(parameterValues);
  }, [parameterValues, isInitialized]);

  // ── Cleanup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      engineRef.current?.dispose();
    };
  }, []);

  // ── Waveform / Spectrum Visualization ───────────────────────────────────

  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // Optimization: no alpha for main canvas
    if (!ctx) return;

    const dpr = dprRef.current;
    const W = canvas.width;
    const H = canvas.height;

    // 1. Draw Cached Grid (Optimization)
    if (gridCanvasRef.current) {
      ctx.drawImage(gridCanvasRef.current, 0, 0);
    } else {
      // Fallback if not yet rendered
      ctx.fillStyle = '#050507';
      ctx.fillRect(0, 0, W, H);
    }

    if (vizMode === 'waveform') {
      const data = engine.getTimeDomainData();
      if (data.length === 0) return;

      // Sub-sampling optimization: match data points to canvas width
      const step = Math.ceil(data.length / W);
      const points: {x: number, y: number}[] = [];
      
      for (let i = 0; i < W; i++) {
        let max = 0;
        for (let j = 0; j < step; j++) {
          const val = (data[i * step + j] || 128) - 128;
          if (Math.abs(val) > Math.abs(max)) max = val;
        }
        points.push({ x: i, y: (H / 2) + (max / 128) * (H / 2) });
      }

      const path = new Path2D();
      if (points.length > 0) {
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          path.lineTo(points[i].x, points[i].y);
        }
      }

      // 2. Broad Glow Layer (Alpha-blended strokes instead of shadowBlur)
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      // Outer faint glow
      ctx.strokeStyle = 'rgba(255, 68, 0, 0.1)';
      ctx.lineWidth = 12 * dpr;
      ctx.stroke(path);
      
      // Mid glow
      ctx.strokeStyle = 'rgba(255, 102, 0, 0.2)';
      ctx.lineWidth = 6 * dpr;
      ctx.stroke(path);
      ctx.restore();

      // 3. Molten Fill
      ctx.save();
      const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
      fillGrad.addColorStop(0, 'rgba(255, 102, 0, 0)');
      fillGrad.addColorStop(0.5, 'rgba(255, 68, 0, 0.15)');
      fillGrad.addColorStop(1, 'rgba(255, 102, 0, 0)');
      ctx.fillStyle = fillGrad;
      
      const fillPath = new Path2D(path);
      fillPath.lineTo(W, H);
      fillPath.lineTo(0, H);
      fillPath.closePath();
      ctx.fill(fillPath);
      ctx.restore();

      // 4. Core Layer (Bright Amber)
      ctx.save();
      ctx.strokeStyle = '#ffcc00'; 
      ctx.lineWidth = 1.5 * dpr;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowBlur = 4 * dpr;
      ctx.shadowColor = 'rgba(255, 204, 0, 0.8)';
      ctx.stroke(path);
      ctx.restore();

    } else {
      // Spectrum bars - High Fidelity Embers
      const data = engine.getFrequencyData();
      if (data.length === 0) return;

      const barCount = 64; 
      const step = Math.floor(data.length / barCount);
      const barW = (W / barCount) * 0.75;
      const gap = (W / barCount) * 0.25;

      // Reusable gradient for bars
      const barGrad = ctx.createLinearGradient(0, 0, 0, H);
      barGrad.addColorStop(0, '#ffcc00'); 
      barGrad.addColorStop(0.3, '#FFD700'); 
      barGrad.addColorStop(1, '#ff2200'); 

      // Draw bars
      for (let i = 0; i < barCount; i++) {
        let val = 0;
        for (let j = 0; j < step; j++) {
          val += data[i * step + j];
        }
        val = (val / step) / 255;
        
        const barH = Math.max(2 * dpr, val * H); 
        const bx = i * (barW + gap);
        const by = H - barH;

        if (val > 0.1) {
          ctx.save();
          ctx.fillStyle = barGrad;
          ctx.beginPath();
          ctx.roundRect(bx, by, barW, barH, [4 * dpr, 4 * dpr, 0, 0]);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(255, 102, 0, 0.2)'; 
          ctx.beginPath();
          ctx.roundRect(bx, by, barW, barH, [2 * dpr, 2 * dpr, 0, 0]);
          ctx.fill();
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(drawVisualization);
  }, [vizMode]);

  useEffect(() => {
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(drawVisualization);
    } else {
      cancelAnimationFrame(animFrameRef.current);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, drawVisualization]);

  // ── Output Level Meter ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying) {
      setOutputLevel(0);
      return;
    }

    const tick = () => {
      const engine = engineRef.current;
      if (!engine) return;
      const data = engine.getTimeDomainData();
      if (data.length === 0) { setOutputLevel(0); return; }

      // Compute RMS from time-domain data (byte values 0–255, center=128)
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        const s = (data[i] - 128) / 128;
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / data.length);
      setOutputLevel(rms);
      levelTimerRef.current = requestAnimationFrame(tick);
    };

    levelTimerRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(levelTimerRef.current);
  }, [isPlaying]);

  // ── Transport Controls ────────────────────────────────────────────────

  const handlePlay = async () => {
    await initEngine();
    const engine = engineRef.current!;

    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
      return;
    }

    // Load the selected audio source
    if (uploadedFile) {
      // Buffer is already loaded in engine via handleFileUpload or initEngine
    } else {
      await engine.loadTestTone(selectedTone);
    }

    engine.buildGraph(chain);
    engine.loop = isLooping;
    engine.play();
    setIsPlaying(true);
  };

  const handleToneChange = async (tone: TestToneType) => {
    setSelectedTone(tone);
    setUploadedFile(null);

    if (isPlaying && engineRef.current) {
      engineRef.current.stop();
      await engineRef.current.loadTestTone(tone);
      engineRef.current.buildGraph(chain);
      engineRef.current.loop = isLooping;
      engineRef.current.play();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const assetId = `sample_${Date.now()}`;
    
    // Persist to IndexedDB
    await assetPersistence.saveSample(assetId, file.name, arrayBuffer, file.type);
    await assetPersistence.setMetadata('last_used_sample', assetId);
    
    setUploadedFile({ name: file.name, id: assetId });

    await initEngine();
    if (engineRef.current) {
      const wasPlaying = engineRef.current.isPlaying;
      engineRef.current.stop();
      await engineRef.current.loadAudioBuffer(arrayBuffer);
      engineRef.current.buildGraph(chain);
      engineRef.current.loop = isLooping;
      if (wasPlaying) engineRef.current.play();
    }
  };

  const handleBypassToggle = (mod: DSPChainModule) => {
    const newBypassed = !mod.bypassed;
    onBypassToggle(mod.instanceId, newBypassed);

    if (engineRef.current && isInitialized) {
      engineRef.current.setModuleBypass(mod.instanceId, newBypassed);
    }
  };

  const toggleLoop = () => {
    const newLoop = !isLooping;
    setIsLooping(newLoop);
    if (engineRef.current) {
      engineRef.current.loop = newLoop;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (chain.length === 0) {
    return (
      <div style={styles.emptyState}>
        <span style={{ fontSize: 28 }}>🔇</span>
        <p style={styles.emptyText}>Add modules to the signal chain to enable preview</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>🔊</span>
        <span style={styles.headerTitle}>Live Preview</span>
        <div style={styles.vizToggle}>
          <button
            onClick={() => setVizMode('waveform')}
            style={{
              ...styles.vizBtn,
              ...(vizMode === 'waveform' ? styles.vizBtnActive : {}),
            }}
          >
            〰️
          </button>
          <button
            onClick={() => setVizMode('spectrum')}
            style={{
              ...styles.vizBtn,
              ...(vizMode === 'spectrum' ? styles.vizBtnActive : {}),
            }}
          >
            📊
          </button>
        </div>
      </div>

      {/* ── Waveform Canvas ────────────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        width={600}
        height={100}
        style={styles.canvas}
      />

      {/* ── Transport Controls ─────────────────────────────────────── */}
      <div style={styles.transport}>
        <button onClick={handlePlay} style={styles.playBtn}>
          {isPlaying ? '⏹' : '▶️'} {isPlaying ? 'Stop' : 'Play'}
        </button>

        <button
          onClick={toggleLoop}
          style={{
            ...styles.loopBtn,
            ...(isLooping ? styles.loopBtnActive : {}),
          }}
        >
          🔁 Loop
        </button>

        {/* Tone Selector */}
        <div style={styles.toneGroup}>
          {TONE_OPTIONS.map(tone => (
            <button
              key={tone.id}
              onClick={() => handleToneChange(tone.id)}
              style={{
                ...styles.toneBtn,
                ...(selectedTone === tone.id && !uploadedFile ? styles.toneBtnActive : {}),
              }}
              title={tone.label}
            >
              {tone.icon} {tone.label}
            </button>
          ))}
        </div>

        {/* File Upload */}
        <label style={styles.uploadLabel}>
          📁 {uploadedFile ? uploadedFile.name.slice(0, 16) : 'Audio File'}
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* ── Output Level Meter ────────────────────────────────────────── */}
      {isPlaying && (
        <div style={styles.levelMeterContainer}>
          <span style={styles.levelLabel}>OUTPUT</span>
          <div style={styles.levelTrack}>
            <div
              style={{
                ...styles.levelFill,
                width: `${Math.min(100, outputLevel * 200)}%`,
                background: outputLevel > 0.7
                  ? '#ff2200'
                  : outputLevel > 0.3
                  ? 'linear-gradient(90deg, #FFD700, #ffcc00)'
                  : 'linear-gradient(90deg, #22cc44, #66ff88)',
              }}
            />
          </div>
          <span style={styles.levelDb}>
            {outputLevel > 0.001
              ? `${(20 * Math.log10(outputLevel)).toFixed(1)} dB`
              : '-∞ dB'}
          </span>
        </div>
      )}

      {/* ── Module Bypass Strip ────────────────────────────────────── */}
      <div style={styles.bypassStrip}>
        {chain.map((mod, i) => (
          <React.Fragment key={mod.instanceId}>
            <button
              onClick={() => handleBypassToggle(mod)}
              style={{
                ...styles.moduleChip,
                borderColor: mod.bypassed
                  ? 'rgba(255,255,255,0.15)'
                  : MODULE_COLORS[mod.type],
                background: mod.bypassed
                  ? 'rgba(255,255,255,0.03)'
                  : `${MODULE_COLORS[mod.type]}18`,
                opacity: mod.bypassed ? 0.4 : 1,
              }}
              title={`${mod.bypassed ? 'Enable' : 'Bypass'} ${mod.instanceId}`}
            >
              <span>{MODULE_ICONS[mod.type]}</span>
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: mod.bypassed ? '#666' : MODULE_COLORS[mod.type],
              }}>
                {mod.type}
              </span>
              <span style={{
                fontSize: 8,
                color: mod.bypassed ? '#444' : '#888',
              }}>
                {mod.bypassed ? 'OFF' : 'ON'}
              </span>
            </button>
            {i < chain.length - 1 && (
              <span style={styles.chainArrow}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(10, 10, 12, 0.4)',
    border: '1px solid rgba(255, 102, 0, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginTop: 0,
    backdropFilter: 'blur(16px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 900,
    color: '#FFD700',
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    flex: 1,
  },
  vizToggle: {
    display: 'flex',
    gap: 2,
  },
  vizBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 12,
    cursor: 'pointer',
    color: '#888',
    transition: 'all 0.2s',
  },
  vizBtnActive: {
    background: 'rgba(255, 102, 0, 0.15)',
    borderColor: 'rgba(255, 102, 0, 0.4)',
    color: '#FFD700',
  },
  canvas: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    border: '1px solid rgba(255, 102, 0, 0.1)',
    marginBottom: 12,
  },
  transport: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
    marginBottom: 12,
  },
  playBtn: {
    background: 'linear-gradient(135deg, #FFD700, #ff4400)',
    color: '#000',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 10,
    fontWeight: 900,
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    boxShadow: '0 0 15px rgba(255, 102, 0, 0.2)',
  },
  loopBtn: {
    background: 'rgba(255,255,255,0.05)',
    color: '#888',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textTransform: 'uppercase' as const,
  },
  loopBtnActive: {
    background: 'rgba(255, 102, 0, 0.12)',
    borderColor: 'rgba(255, 102, 0, 0.3)',
    color: '#FFD700',
  },
  toneGroup: {
    display: 'flex',
    gap: 3,
  },
  toneBtn: {
    background: 'rgba(255,255,255,0.04)',
    color: '#777',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 5,
    padding: '4px 8px',
    fontSize: 10,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  },
  toneBtnActive: {
    background: 'rgba(255, 102, 0, 0.1)',
    borderColor: 'rgba(255, 102, 0, 0.3)',
    color: '#FFD700',
  },
  uploadLabel: {
    background: 'rgba(255,255,255,0.04)',
    color: '#777',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textTransform: 'uppercase' as const,
  },
  bypassStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap' as const,
    padding: '12px 0 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  moduleChip: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 2,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: 54,
  },
  chainArrow: {
    color: 'rgba(255, 102, 0, 0.3)',
    fontSize: 11,
    fontWeight: 900,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 8,
    padding: 32,
    background: 'rgba(5, 5, 7, 0.4)',
    border: '1px dashed rgba(255, 102, 0, 0.15)',
    borderRadius: 16,
    marginTop: 0,
  },
  emptyText: {
    fontSize: 11,
    color: '#666',
    margin: 0,
  },

  // ── Output Level Meter ──────────────────────────────────────────────────
  levelMeterContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  levelLabel: {
    fontSize: 8,
    fontWeight: 900,
    color: '#888',
    letterSpacing: '0.12em',
    minWidth: 42,
    textTransform: 'uppercase' as const,
  },
  levelTrack: {
    flex: 1,
    height: 6,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  levelFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 60ms linear',
    boxShadow: '0 0 6px rgba(255,215,0,0.3)',
  },
  levelDb: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#FFD700',
    minWidth: 52,
    textAlign: 'right' as const,
  },
};
