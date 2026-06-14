/**
 * SacredChopper — God Realm Sample Slicer & Editor
 *
 * Overhauled: Vanilla CSS, persisted params, Grid/Auto chop modes,
 * add/remove slice markers, slice preview playback, performance-aware animation.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './SacredChopper.css';
import { useJuceBridge } from '@/hooks/useJuceBridge';

export interface SacredChopperProps {
  trackIndex: number;
  trackName: string;
  trackColor: string;
  buffer: AudioBuffer | null;
  sampleParams: {
    start: number;
    end: number;
    reverse: boolean;
    slices: { start: number; end: number }[];
    chopperSpeed: number;
    chopperPitch: number;
    chopperFadeIn: number;
    chopperFadeOut: number;
    chopperGlide: number;
    chopperSensitivity: number;
    chopperTrigger: 'MIDI' | 'Gate' | 'OneShot';
    chopperDryWet: number;
    chopperOutputVolume: number;
    chopMode: 'Manual' | 'Auto' | 'Grid';
    scopeGlobal: boolean;
    snapToTransient: boolean;
    snapToZero: boolean;
  };
  onUpdateParam: (param: string, value: any) => void;
  onClose: () => void;
  onSpreadToPads?: (slices: { start: number; end: number; sliceStart?: number; sliceDuration?: number; buffer: AudioBuffer }[]) => void;
}

/** Detect transient peaks in an AudioBuffer */
function detectTransients(buffer: AudioBuffer, sensitivity: number): number[] {
  const data = buffer.getChannelData(0);
  const blockSize = Math.floor(buffer.sampleRate * 0.01); // 10ms blocks
  const blocks = Math.floor(data.length / blockSize);
  const energies = new Float32Array(blocks);

  for (let b = 0; b < blocks; b++) {
    let sum = 0;
    for (let i = 0; i < blockSize; i++) {
      const s = data[b * blockSize + i];
      sum += s * s;
    }
    energies[b] = sum / blockSize;
  }

  // Find peaks where energy jumps significantly
  const threshold = (101 - sensitivity) * 0.0002; // higher sensitivity = lower threshold
  const transients: number[] = [];
  for (let b = 1; b < blocks; b++) {
    const diff = energies[b] - energies[b - 1];
    if (diff > threshold && energies[b] > 0.0001) {
      const pos = (b * blockSize) / data.length;
      // Don't place too close to previous
      if (transients.length === 0 || pos - transients[transients.length - 1] > 0.03) {
        transients.push(pos);
      }
    }
  }
  return transients;
}

/** Generate evenly-spaced grid markers */
function generateGridMarkers(count: number): number[] {
  const markers: number[] = [];
  for (let i = 1; i < count; i++) {
    markers.push(i / count);
  }
  return markers;
}

/** Find the nearest zero-crossing near a given normalized position */
function findNearestZeroCrossing(buffer: AudioBuffer, pos: number): number {
  const data = buffer.getChannelData(0);
  const sampleIdx = Math.floor(pos * data.length);
  
  // Search within +/- 500 samples
  const searchRange = 500;
  let minDiff = Infinity;
  let bestIdx = sampleIdx;
  
  for (let i = Math.max(1, sampleIdx - searchRange); i < Math.min(data.length - 1, sampleIdx + searchRange); i++) {
    // Zero crossing: sign change
    if ((data[i - 1] < 0 && data[i] >= 0) || (data[i - 1] >= 0 && data[i] < 0)) {
      const diff = Math.abs(i - sampleIdx);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }
  }
  
  return bestIdx / data.length;
}

const CHOP_MODES = ['Manual', 'Auto', 'Grid'] as const;
const GRID_PRESETS = [4, 8, 16, 32] as const;

export const SacredChopper: React.FC<SacredChopperProps> = ({
  trackIndex,
  trackName,
  trackColor,
  buffer,
  sampleParams,
  onUpdateParam,
  onClose,
  onSpreadToPads,
}) => {
  const bridgeState = useJuceBridge();
  const nativeTransientsRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const [draggingMarker, setDraggingMarker] = useState<number | null>(null);
  const [playingSlice, setPlayingSlice] = useState<number | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const previewStartTimeRef = useRef<number | null>(null);
  const [spreadState, setSpreadState] = useState<'idle' | 'spreading' | 'done'>('idle');
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const [viewWindow, setViewWindow] = useState<[number, number]>([0, 1]);

  const [dimensions, setDimensions] = useState({ width: 1000, height: 280 });
  const [minimapDimensions, setMinimapDimensions] = useState({ width: 800, height: 32 });

  // ResizeObserver for main waveform canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: Math.floor(entry.contentRect.width) || 1000,
          height: Math.floor(entry.contentRect.height) || 280,
        });
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // ResizeObserver for minimap canvas
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setMinimapDimensions({
          width: Math.floor(entry.contentRect.width) || 800,
          height: Math.floor(entry.contentRect.height) || 32,
        });
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Extract current params
  const chopMarkers = useMemo(() =>
    (sampleParams.slices || []).map(s => s.start).filter(v => v > 0 && v < 1),
    [sampleParams.slices]
  );
  const chopMode = sampleParams.chopMode || 'Manual';
  const isReverse = sampleParams.reverse;

  const { width, height } = dimensions;

  // ─── Waveform Rendering ───
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let peaks: Float32Array;

    if (buffer) {
      const data = buffer.getChannelData(0);
      const startIndex = Math.floor(viewWindow[0] * data.length);
      const endIndex = Math.floor(viewWindow[1] * data.length);
      const windowLen = endIndex - startIndex;
      const step = Math.max(1, windowLen / width);
      peaks = new Float32Array(width);
      for (let i = 0; i < width; i++) {
        let peak = 0;
        const count = Math.max(1, Math.floor(step));
        const offset = startIndex + Math.floor(i * step);
        for (let j = 0; j < count; j++) {
          if (offset + j < data.length) {
            peak = Math.max(peak, Math.abs(data[offset + j] || 0));
          }
        }
        peaks[i] = peak;
      }
    } else {
      const nativeAnalysis = bridgeState.waveformAnalysis;
      if (nativeAnalysis && nativeAnalysis.padIndex === trackIndex && nativeAnalysis.rmsEnvelope && nativeAnalysis.rmsEnvelope.length > 0) {
        const env = nativeAnalysis.rmsEnvelope;
        const startIndex = Math.floor(viewWindow[0] * env.length);
        const endIndex = Math.floor(viewWindow[1] * env.length);
        const windowLen = endIndex - startIndex;
        const step = Math.max(1, windowLen / width);
        peaks = new Float32Array(width);
        for (let i = 0; i < width; i++) {
          let peak = 0;
          const count = Math.max(1, Math.floor(step));
          const offset = startIndex + Math.floor(i * step);
          for (let j = 0; j < count; j++) {
            if (offset + j < env.length) {
              peak = Math.max(peak, env[offset + j]);
            }
          }
          peaks[i] = peak;
        }
      } else {
        // Static ambient — no animation loop
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 0.25;
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#a88cff';
        ctx.textAlign = 'center';
        ctx.fillText('DROP OR LOAD A SAMPLE', width / 2, height / 2);
        ctx.globalAlpha = 1;
        return;
      }
    }

    // Single animated frame with reduced jitter (not re-rendering every frame)
    let frame = 0;
    const renderWaveform = () => {
      frame++;
      // Only re-render every 3rd frame to save CPU
      if (frame % 3 !== 0) {
        animFrameRef.current = requestAnimationFrame(renderWaveform);
        return;
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, width, height);

      const drawPath = (color: string, blur: number, isMirror: boolean, jitter: number, alpha: number, lineWidthVal: number) => {
        const points: Array<{ x: number; y: number }> = [];
        const stepSize = 2; // draw every 2 logical pixels
        for (let i = 0; i < width; i += stepSize) {
          const p = peaks[i] || 0;
          const j = (Math.random() - 0.5) * p * jitter;
          const yOff = p * (height / 2 * 0.8) + j;
          points.push({
            x: i,
            y: isMirror ? (height / 2) + yOff : (height / 2) - yOff,
          });
        }
        
        // Final point
        const lastP = peaks[width - 1] || 0;
        const lastJ = (Math.random() - 0.5) * lastP * jitter;
        const lastYOff = lastP * (height / 2 * 0.8) + lastJ;
        points.push({
          x: width,
          y: isMirror ? (height / 2) + lastYOff : (height / 2) - lastYOff,
        });

        if (points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lineWidthVal;
        ctx.shadowBlur = blur;
        ctx.shadowColor = color;
        ctx.globalCompositeOperation = 'screen';
        ctx.stroke();
      };

      drawPath('#a855f7', 18, false, 4, 0.5, 2);
      drawPath('#a855f7', 18, true, 4, 0.5, 2);
      drawPath('#d946ef', 10, false, 12, 0.7, 1.5);
      drawPath('#d946ef', 10, true, 12, 0.7, 1.5);
      drawPath('#ff6600', 5, false, 28, 0.9, 1);
      drawPath('#ff6600', 5, true, 28, 0.9, 1);

      // Reset composite
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Draw slice region shading
      const sortedMarkers = [...chopMarkers].sort((a, b) => a - b);
      const allPositions = [0, ...sortedMarkers, 1];
      for (let i = 0; i < allPositions.length - 1; i++) {
        const x1 = allPositions[i] * width;
        const x2 = allPositions[i + 1] * width;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(168, 85, 247, 0.03)' : 'rgba(255, 102, 0, 0.03)';
        ctx.fillRect(x1, 0, x2 - x1, height);
      }

      // Draw real-time preview playhead
      if (playingSlice !== null && buffer && previewCtxRef.current && previewStartTimeRef.current !== null) {
        const ctxAudio = previewCtxRef.current;
        const elapsed = (ctxAudio.currentTime - previewStartTimeRef.current) * sampleParams.chopperSpeed;
        const sorted = [0, ...[...chopMarkers].sort((a, b) => a - b), 1];
        const start = sorted[playingSlice] ?? 0;
        const end = sorted[playingSlice + 1] ?? 1;
        const sliceDuration = (end - start) * buffer.duration;
        
        if (elapsed <= sliceDuration) {
          const currentPos = start + (elapsed / buffer.duration);
          const playheadX = ((currentPos - viewWindow[0]) / (viewWindow[1] - viewWindow[0])) * width;
          
          if (playheadX >= 0 && playheadX <= width) {
            ctx.save();
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, height);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [buffer, chopMarkers, viewWindow, bridgeState.waveformAnalysis, trackIndex, width, height, playingSlice, sampleParams.chopperSpeed]);

  // ─── Minimap Rendering ───
  const { width: miniW, height: miniH } = minimapDimensions;

  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = miniW * dpr;
    canvas.height = miniH * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, miniW, miniH);
    
    if (buffer) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
      const data = buffer.getChannelData(0);
      const step = Math.floor(data.length / miniW);
      
      ctx.beginPath();
      ctx.moveTo(0, miniH / 2);
      for (let i = 0; i < miniW; i++) {
        let peak = 0;
        for (let j = 0; j < step; j++) {
          peak = Math.max(peak, Math.abs(data[i * step + j] || 0));
        }
        const yOff = peak * (miniH / 2);
        ctx.lineTo(i, miniH / 2 - yOff);
      }
      for (let i = Math.floor(miniW) - 1; i >= 0; i--) {
        let peak = 0;
        for (let j = 0; j < step; j++) {
          peak = Math.max(peak, Math.abs(data[i * step + j] || 0));
        }
        const yOff = peak * (miniH / 2);
        ctx.lineTo(i, miniH / 2 + yOff);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      const nativeAnalysis = bridgeState.waveformAnalysis;
      if (nativeAnalysis && nativeAnalysis.padIndex === trackIndex && nativeAnalysis.rmsEnvelope && nativeAnalysis.rmsEnvelope.length > 0) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
        const env = nativeAnalysis.rmsEnvelope;
        const step = Math.max(1, env.length / miniW);
        
        ctx.beginPath();
        ctx.moveTo(0, miniH / 2);
        for (let i = 0; i < miniW; i++) {
          let peak = 0;
          const offset = Math.floor(i * step);
          for (let j = 0; j < step; j++) {
            if (offset + j < env.length) {
              peak = Math.max(peak, env[offset + j]);
            }
          }
          const yOff = peak * (miniH / 2);
          ctx.lineTo(i, miniH / 2 - yOff);
        }
        for (let i = Math.floor(miniW) - 1; i >= 0; i--) {
          let peak = 0;
          const offset = Math.floor(i * step);
          for (let j = 0; j < step; j++) {
            if (offset + j < env.length) {
              peak = Math.max(peak, env[offset + j]);
            }
          }
          const yOff = peak * (miniH / 2);
          ctx.lineTo(i, miniH / 2 + yOff);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }, [buffer, bridgeState.waveformAnalysis, trackIndex, miniW, miniH]);

  // ─── Interaction & Zooming ───
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!buffer) return;
    const zoomFactor = Math.exp(e.deltaY * 0.003);
    const rect = waveformRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Zoom around mouse cursor
    const mouseX = (e.clientX - rect.left) / rect.width;
    const centerPos = viewWindow[0] + mouseX * (viewWindow[1] - viewWindow[0]);
    
    let newLen = (viewWindow[1] - viewWindow[0]) * zoomFactor;
    newLen = Math.max(0.01, Math.min(1, newLen));
    
    let newStart = centerPos - (mouseX * newLen);
    let newEnd = centerPos + ((1 - mouseX) * newLen);
    
    if (newStart < 0) { newEnd -= newStart; newStart = 0; }
    if (newEnd > 1) { newStart -= (newEnd - 1); newEnd = 1; }
    
    setViewWindow([Math.max(0, newStart), Math.min(1, newEnd)]);
  }, [viewWindow, buffer]);

  const handleMinimapDrag = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    const rect = minimapCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const len = viewWindow[1] - viewWindow[0];
    let center = (e.clientX - rect.left) / rect.width;
    let newStart = center - len / 2;
    let newEnd = center + len / 2;
    if (newStart < 0) { newStart = 0; newEnd = len; }
    if (newEnd > 1) { newEnd = 1; newStart = 1 - len; }
    setViewWindow([newStart, newEnd]);
  }, [viewWindow]);

  // ─── Slice Helpers ───
  const updateSlicesFromMarkers = useCallback((markers: number[]) => {
    const sorted = [...markers].sort((a, b) => a - b);
    const allPos = [0, ...sorted, 1];
    const slices = [];
    for (let i = 0; i < allPos.length - 1; i++) {
      slices.push({ start: allPos[i], end: allPos[i + 1] });
    }
    onUpdateParam('slices', slices);
    onUpdateParam('chopMarkers', sorted);
  }, [onUpdateParam]);

  // Listen to native waveform analysis and store transients
  useEffect(() => {
    if (bridgeState.waveformAnalysis && bridgeState.waveformAnalysis.padIndex === trackIndex) {
      const trans = bridgeState.waveformAnalysis.transients;
      if (trans && trans.length > 0) {
        nativeTransientsRef.current = trans;
        if (chopMode === 'Auto') {
          updateSlicesFromMarkers(trans);
        }
      }
    }
  }, [bridgeState.waveformAnalysis, trackIndex, chopMode, updateSlicesFromMarkers]);

  // ─── Marker Dragging ───
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingMarker === null || !waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const relPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    let pos = viewWindow[0] + relPos * (viewWindow[1] - viewWindow[0]);

    // Calculate a 10-pixel snap threshold in normalized units
    const snapThreshold = 10 / rect.width * (viewWindow[1] - viewWindow[0]);

    // Snap to transient if enabled
    if (sampleParams.snapToTransient && buffer) {
      const transients = detectTransients(buffer, sampleParams.chopperSensitivity);
      let nearest = pos;
      let minDiff = Infinity;
      for (const t of transients) {
        const d = Math.abs(pos - t);
        if (d < minDiff) { minDiff = d; nearest = t; }
      }
      if (minDiff < snapThreshold) pos = nearest;
    }
    
    // Snap to zero crossing if enabled
    if (sampleParams.snapToZero && buffer) {
      pos = findNearestZeroCrossing(buffer, pos);
    }

    const nextMarkers = [...chopMarkers];
    nextMarkers[draggingMarker] = pos;
    updateSlicesFromMarkers(nextMarkers);
  }, [draggingMarker, chopMarkers, sampleParams.snapToTransient, sampleParams.snapToZero, sampleParams.chopperSensitivity, buffer, viewWindow, updateSlicesFromMarkers]);

  const handleMouseUp = useCallback(() => {
    setDraggingMarker(null);
  }, []);

  const handleMarkerDoubleClick = useCallback((index: number) => {
    if (!buffer) return;
    const currentMs = chopMarkers[index] * buffer.duration * 1000;
    const newMsStr = window.prompt(`Enter exact offset for Slice Marker ${index + 1} (ms):`, currentMs.toFixed(2));
    if (!newMsStr) return;
    const newMs = parseFloat(newMsStr);
    if (isNaN(newMs)) return;
    
    // Convert back to normalized 0-1 range
    let newPos = (newMs / 1000) / buffer.duration;
    
    // Optional: still snap to zero crossing if enabled
    if (sampleParams.snapToZero) {
      newPos = findNearestZeroCrossing(buffer, newPos);
    }
    
    // Clamp to valid range so we don't pass the adjacent markers
    const sorted = [...chopMarkers].sort((a, b) => a - b);
    const sortedIdx = sorted.indexOf(chopMarkers[index]);
    
    const prevPos = sortedIdx > 0 ? sorted[sortedIdx - 1] : 0;
    const nextPos = sortedIdx < sorted.length - 1 ? sorted[sortedIdx + 1] : 1;
    
    const clampedPos = Math.max(prevPos + 0.0001, Math.min(newPos, nextPos - 0.0001));
    
    const nextMarkers = [...chopMarkers];
    nextMarkers[index] = clampedPos;
    updateSlicesFromMarkers(nextMarkers);
  }, [buffer, chopMarkers, sampleParams.snapToZero, updateSlicesFromMarkers]);

  const addMarker = useCallback(() => {
    if (chopMarkers.length >= 31) return;
    // Find the largest gap and split it
    const sorted = [0, ...chopMarkers.sort((a, b) => a - b), 1];
    let maxGap = 0, maxIdx = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1] - sorted[i];
      if (gap > maxGap) { maxGap = gap; maxIdx = i; }
    }
    const newPos = (sorted[maxIdx] + sorted[maxIdx + 1]) / 2;
    updateSlicesFromMarkers([...chopMarkers, newPos]);
  }, [chopMarkers, updateSlicesFromMarkers]);

  const removeLastMarker = useCallback(() => {
    if (chopMarkers.length === 0) return;
    const next = [...chopMarkers];
    next.pop();
    updateSlicesFromMarkers(next);
  }, [chopMarkers, updateSlicesFromMarkers]);

  // ─── Grid / Auto Chop ───
  const applyGridChop = useCallback((sliceCount: number) => {
    const markers = generateGridMarkers(sliceCount);
    onUpdateParam('chopMode', 'Grid');
    updateSlicesFromMarkers(markers);
  }, [onUpdateParam, updateSlicesFromMarkers]);

  const applyAutoChop = useCallback(() => {
    onUpdateParam('chopMode', 'Auto');
    if (nativeTransientsRef.current && nativeTransientsRef.current.length > 0) {
      updateSlicesFromMarkers(nativeTransientsRef.current);
      return;
    }

    if (!buffer) return;
    setSpreadState('spreading');
    
    const worker = new Worker(new URL('../workers/chopper.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      updateSlicesFromMarkers(e.data.markers);
      setSpreadState('idle');
      worker.terminate();
    };
    
    worker.postMessage({
      channelData: buffer.getChannelData(0),
      sampleRate: buffer.sampleRate,
      duration: buffer.duration,
      sensitivity: sampleParams.chopperSensitivity,
      minSpacing: 0.1
    });
  }, [buffer, sampleParams.chopperSensitivity, onUpdateParam, updateSlicesFromMarkers]);

  // ─── Slice Preview Playback ───
  const previewSlice = useCallback((sliceIndex: number) => {
    if (!buffer) return;

    // Create or reuse AudioContext
    if (!previewCtxRef.current) {
      previewCtxRef.current = new AudioContext();
    }
    const ctx = previewCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    // Stop previous
    if (previewSourceRef.current) {
      try { previewSourceRef.current.stop(); } catch {}
      previewSourceRef.current = null;
    }

    const sorted = [0, ...[...chopMarkers].sort((a, b) => a - b), 1];
    const start = sorted[sliceIndex] ?? 0;
    const end = sorted[sliceIndex + 1] ?? 1;
    const offset = start * buffer.duration;
    const duration = (end - start) * buffer.duration;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = sampleParams.chopperSpeed;
    source.connect(ctx.destination);
    source.start(0, offset, duration);
    previewSourceRef.current = source;
    setPlayingSlice(sliceIndex);
    previewStartTimeRef.current = ctx.currentTime;

    source.onended = () => {
      setPlayingSlice(null);
      previewSourceRef.current = null;
      previewStartTimeRef.current = null;
    };
  }, [buffer, chopMarkers, sampleParams.chopperSpeed]);

  // Cleanup preview on unmount
  useEffect(() => {
    return () => {
      if (previewSourceRef.current) {
        try { previewSourceRef.current.stop(); } catch {}
      }
    };
  }, []);

  // ─── Sample Info ───
  const sampleInfo = useMemo(() => {
    if (!buffer) return null;
    return {
      duration: buffer.duration.toFixed(2) + 's',
      channels: buffer.numberOfChannels + 'ch',
      rate: (buffer.sampleRate / 1000).toFixed(1) + 'kHz',
    };
  }, [buffer]);

  // ─── Slice Segments for bar ───
  const sliceSegments = useMemo(() => {
    const sorted = [0, ...chopMarkers.sort((a, b) => a - b), 1];
    const segs = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      segs.push({ start: sorted[i], end: sorted[i + 1], width: sorted[i + 1] - sorted[i] });
    }
    return segs;
  }, [chopMarkers]);

  // ─── Knob Helper ───
  const renderKnob = (label: string, paramKey: string, value: number, min: number, max: number, unit: string, color: string, displayOverride?: string) => {
    const pct = (value - min) / (max - min);
    const rotation = -135 + pct * 270;
    return (
      <div className="sacred-chopper__knob">
        <div className="sacred-chopper__knob-ring">
          <div
            className="sacred-chopper__knob-arc"
            style={{ background: `conic-gradient(from 225deg, ${color} ${pct * 270}deg, transparent 0)` }}
          />
          <div
            className="sacred-chopper__knob-pointer"
            style={{ backgroundColor: color, transform: `rotate(${rotation}deg)`, boxShadow: `0 0 5px ${color}` }}
          />
          <input
            type="range"
            className="sacred-chopper__knob-input"
            min={min} max={max} step={max - min > 10 ? 1 : 0.01}
            value={value}
            onChange={e => onUpdateParam(paramKey, +e.target.value)}
            style={{ writingMode: 'vertical-lr' } as any}
          />
        </div>
        <span className="sacred-chopper__knob-label">{label}</span>
        <span className="sacred-chopper__knob-value">{displayOverride ?? value}{unit}</span>
      </div>
    );
  };

  return (
    <div className="sacred-chopper">
      {/* Header */}
      <div className="sacred-chopper__header">
        <span className="sacred-chopper__title">Sample Chopper — {trackName}</span>
        <div className="sacred-chopper__header-info">
          {sampleInfo && (
            <div className="sacred-chopper__sample-info">
              <span>{sampleInfo.duration}</span>
              <span>{sampleInfo.channels}</span>
              <span>{sampleInfo.rate}</span>
            </div>
          )}
          <span className="sacred-chopper__mode-badge">{chopMode}</span>
          <div className="sacred-chopper__status-dot" />
        </div>
      </div>

      {/* Waveform */}
      <div
        className="sacred-chopper__waveform"
        ref={waveformRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="sacred-chopper__canvas" />
        {!buffer && <div className="sacred-chopper__empty-text">Awaiting Sample</div>}

        {/* Slice Markers */}
        <svg className="sacred-chopper__markers-svg" preserveAspectRatio="none">
          {chopMarkers.map((pos, i) => {
            if (pos < viewWindow[0] || pos > viewWindow[1]) return null;
            const viewPos = (pos - viewWindow[0]) / (viewWindow[1] - viewWindow[0]);
            return (
              <g
                key={i}
                className="sacred-chopper__marker"
                onMouseDown={e => { e.stopPropagation(); setDraggingMarker(i); }}
                onDoubleClick={e => { e.stopPropagation(); handleMarkerDoubleClick(i); }}
              >
                <line
                  x1={`${viewPos * 100}%`} y1="0" x2={`${viewPos * 100}%`} y2="100%"
                  stroke={draggingMarker === i ? '#ff6600' : '#a855f7'}
                  strokeWidth={draggingMarker === i ? 2 : 1}
                  strokeOpacity={0.7}
                />
                <rect
                  x={`${viewPos * 100}%`} y="100%"
                  width="20" height="18" rx="3"
                  transform="translate(-10, -26)"
                  fill={draggingMarker === i ? '#ff6600' : 'rgba(20,10,40,0.9)'}
                  stroke={draggingMarker === i ? '#ffaa00' : '#a855f7'}
                  strokeWidth="1"
                />
                <text 
                  x={`${viewPos * 100}%`} y="100%" 
                  transform="translate(0, -13)" 
                  textAnchor="middle"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Minimap */}
      <div 
        className="sacred-chopper__minimap" 
        onMouseDown={handleMinimapDrag} 
        onMouseMove={handleMinimapDrag}
      >
        <canvas ref={minimapCanvasRef} className="sacred-chopper__minimap-canvas" />
        {buffer && (
          <div 
            className="sacred-chopper__minimap-window" 
            style={{ 
              left: `${viewWindow[0] * 100}%`, 
              width: `${(viewWindow[1] - viewWindow[0]) * 100}%` 
            }} 
          />
        )}
      </div>

      {/* Slice Preview Bar */}
      {chopMarkers.length > 0 && (
        <div className="sacred-chopper__slice-bar">
          {sliceSegments.map((seg, i) => (
            <div
              key={i}
              className={`sacred-chopper__slice ${playingSlice === i ? 'sacred-chopper__slice--playing' : ''}`}
              style={{ flex: seg.width }}
              onClick={() => previewSlice(i)}
              title={`Slice ${i + 1}: ${(seg.start * 100).toFixed(0)}% → ${(seg.end * 100).toFixed(0)}%`}
            >
              {i + 1}
            </div>
          ))}
        </div>
      )}

      {/* Marker Controls */}
      <div className="sacred-chopper__marker-controls">
        <button className="sacred-chopper__marker-btn" onClick={addMarker}>+ Add Slice</button>
        <button className="sacred-chopper__marker-btn sacred-chopper__marker-btn--danger" onClick={removeLastMarker}>− Remove</button>
        <div className="sacred-chopper__divider" style={{ height: 16 }} />
        {GRID_PRESETS.map(n => (
          <button key={n} className="sacred-chopper__marker-btn" onClick={() => applyGridChop(n)}>
            {n}
          </button>
        ))}
        <button className="sacred-chopper__marker-btn" onClick={applyAutoChop}>Auto</button>
        <span className="sacred-chopper__marker-count">{chopMarkers.length} markers · {sliceSegments.length} slices</span>
      </div>

      {/* Controls Rail */}
      <div className="sacred-chopper__controls">
        {/* Toggles */}
        <div className="sacred-chopper__section">
          <div className="sacred-chopper__toggles">
            <div className="sacred-chopper__toggle-row">
              <span className="sacred-chopper__toggle-label">Scope</span>
              <div className="sacred-chopper__scope-toggle">
                <button
                  className={`sacred-chopper__scope-btn ${sampleParams.scopeGlobal ? 'sacred-chopper__scope-btn--active' : ''}`}
                  onClick={() => onUpdateParam('scopeGlobal', true)}
                >Global</button>
                <button
                  className={`sacred-chopper__scope-btn ${!sampleParams.scopeGlobal ? 'sacred-chopper__scope-btn--active' : ''}`}
                  onClick={() => onUpdateParam('scopeGlobal', false)}
                >Slice</button>
              </div>
            </div>
            <div className="sacred-chopper__toggle-row">
              <span className="sacred-chopper__toggle-label">Snap (Transient)</span>
              <div
                className={`sacred-chopper__toggle ${sampleParams.snapToTransient ? 'sacred-chopper__toggle--on' : ''}`}
                onClick={() => onUpdateParam('snapToTransient', !sampleParams.snapToTransient)}
              >
                <div className="sacred-chopper__toggle-dot" />
              </div>
            </div>
            <div className="sacred-chopper__toggle-row">
              <span className="sacred-chopper__toggle-label">Snap (Zero-Cross)</span>
              <div
                className={`sacred-chopper__toggle ${sampleParams.snapToZero ? 'sacred-chopper__toggle--on' : ''}`}
                onClick={() => onUpdateParam('snapToZero', !sampleParams.snapToZero)}
              >
                <div className="sacred-chopper__toggle-dot" />
              </div>
            </div>
          </div>
        </div>

        <div className="sacred-chopper__divider" />

        {/* Knobs */}
        <div className="sacred-chopper__knob-group">
          {renderKnob('Speed', 'chopperSpeed', sampleParams.chopperSpeed, 0.25, 2.0, 'x', '#a855f7')}
          {renderKnob('Fade In', 'chopperFadeIn', sampleParams.chopperFadeIn, 0, 500, 'ms', '#ff6600')}
          {renderKnob('Fade Out', 'chopperFadeOut', sampleParams.chopperFadeOut, 0, 1000, 'ms', '#ff6600')}
          {renderKnob('Pitch', 'chopperPitch', sampleParams.chopperPitch, -24, 24, 'st', '#a855f7',
            sampleParams.chopperPitch > 0 ? `+${sampleParams.chopperPitch}` : `${sampleParams.chopperPitch}`)}
          {renderKnob('Glide', 'chopperGlide', sampleParams.chopperGlide, 0, 200, 'ms', '#a855f7')}
        </div>

        <div className="sacred-chopper__divider" />

        {/* Reverse */}
        <button
          className={`sacred-chopper__reverse-btn ${isReverse ? 'sacred-chopper__reverse-btn--active' : ''}`}
          onClick={() => onUpdateParam('reverse', !isReverse)}
        >
          Reverse
        </button>
      </div>

      {/* Bottom Rail */}
      <div className="sacred-chopper__bottom">
        {/* Chop Mode */}
        <div className="sacred-chopper__section">
          <span className="sacred-chopper__section-label">Chop Mode</span>
          <div className="sacred-chopper__mode-selector">
            {CHOP_MODES.map(m => (
              <button
                key={m}
                className={`sacred-chopper__mode-btn ${chopMode === m ? 'sacred-chopper__mode-btn--active' : ''}`}
                onClick={() => {
                  onUpdateParam('chopMode', m);
                  if (m === 'Auto') applyAutoChop();
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Sensitivity */}
        <div className="sacred-chopper__slider-group">
          <span className="sacred-chopper__slider-label">Sensitivity</span>
          <div className="sacred-chopper__slider-row">
            <input
              type="range" className="sacred-chopper__slider" min={0} max={100}
              value={sampleParams.chopperSensitivity}
              onChange={e => onUpdateParam('chopperSensitivity', +e.target.value)}
            />
            <span className="sacred-chopper__slider-value">{sampleParams.chopperSensitivity}</span>
          </div>
        </div>

        {/* Trigger */}
        <div className="sacred-chopper__section">
          <span className="sacred-chopper__section-label">Trigger</span>
          <select
            className="sacred-chopper__select"
            value={sampleParams.chopperTrigger}
            onChange={e => onUpdateParam('chopperTrigger', e.target.value)}
          >
            <option value="MIDI">MIDI</option>
            <option value="Gate">Gate</option>
            <option value="OneShot">One-Shot</option>
          </select>
        </div>

        {/* Dry/Wet */}
        <div className="sacred-chopper__slider-group">
          <span className="sacred-chopper__slider-label">Dry/Wet</span>
          <div className="sacred-chopper__slider-row">
            <input
              type="range" className="sacred-chopper__slider sacred-chopper__slider--purple" min={0} max={100}
              value={sampleParams.chopperDryWet}
              onChange={e => onUpdateParam('chopperDryWet', +e.target.value)}
            />
            <span className="sacred-chopper__slider-value">{sampleParams.chopperDryWet}%</span>
          </div>
        </div>

        {/* Output Volume */}
        <div className="sacred-chopper__slider-group">
          <span className="sacred-chopper__slider-label">Output</span>
          <div className="sacred-chopper__slider-row">
            <input
              type="range" className="sacred-chopper__slider sacred-chopper__slider--purple" min={-24} max={12}
              value={sampleParams.chopperOutputVolume}
              onChange={e => onUpdateParam('chopperOutputVolume', +e.target.value)}
            />
            <span className="sacred-chopper__slider-value">
              {sampleParams.chopperOutputVolume > 0 ? `+${sampleParams.chopperOutputVolume}` : sampleParams.chopperOutputVolume}dB
            </span>
          </div>
        </div>

        {/* Spread to Dais */}
        {onSpreadToPads && buffer && chopMarkers.length > 0 && (
          <button
            className={`sacred-chopper__spread-btn ${spreadState !== 'idle' ? `sacred-chopper__spread-btn--${spreadState}` : ''}`}
            disabled={spreadState === 'spreading'}
            onClick={() => {
              if (!buffer || !onSpreadToPads) return;
              setSpreadState('spreading');
              const sorted = [0, ...chopMarkers.sort((a, b) => a - b), 1];
              const sliceData: { start: number; end: number; sliceStart?: number; sliceDuration?: number; buffer: AudioBuffer }[] = [];
              const ctx = previewCtxRef.current || new AudioContext();
              if (!previewCtxRef.current) previewCtxRef.current = ctx;

              for (let i = 0; i < sorted.length - 1 && i < 16; i++) {
                const sliceStart = sorted[i] * buffer.duration;
                const sliceEnd = sorted[i + 1] * buffer.duration;
                const duration = sliceEnd - sliceStart;
                if (duration <= 0) continue;
                
                sliceData.push({ 
                  start: sorted[i], 
                  end: sorted[i + 1], 
                  sliceStart,
                  sliceDuration: duration,
                  buffer: buffer // Zero-Copy!
                });
              }
              onSpreadToPads(sliceData);
              setSpreadState('done');
              setTimeout(() => setSpreadState('idle'), 2000);
            }}
          >
            <span className="sacred-chopper__spread-icon">
              {spreadState === 'done' ? '✔' : spreadState === 'spreading' ? '⦻' : '🔱'}
            </span>
            <span className="sacred-chopper__spread-label">
              {spreadState === 'done'
                ? `${Math.min(sliceSegments.length, 16)} SLICES → DAIS`
                : spreadState === 'spreading'
                ? 'SPREADING...'
                : `SPREAD TO DAIS (${Math.min(sliceSegments.length, 16)})`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
