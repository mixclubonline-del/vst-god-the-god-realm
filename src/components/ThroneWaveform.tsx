/**
 * ThroneWaveform — Real-time waveform canvas for the Astral Throne detail panel.
 * 
 * Draws actual AudioBuffer data from BufferRegistry. Replaces the fake sine-wave bars.
 * Features: domain-colored waveform, slice markers, trigger flash on playback.
 */
import React, { useRef, useEffect, useCallback } from 'react';

interface ThroneWaveformProps {
  buffer: AudioBuffer | null;
  color: string;
  width?: number;
  height?: number;
  slices?: { start: number; end: number }[];
  sigil?: string;
  lore?: string;
}

export const ThroneWaveform: React.FC<ThroneWaveformProps> = React.memo(({
  buffer,
  color,
  width = 320,
  height = 80,
  slices = [],
  sigil,
  lore,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Draw the waveform
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Set canvas resolution
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);

    if (!buffer) return;

    const data = buffer.getChannelData(0);
    const samples = data.length;
    const step = Math.max(1, Math.floor(samples / w));
    const halfH = h / 2;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, 'rgba(0,0,0,0.15)');
    bgGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Centerline
    ctx.strokeStyle = `${color}15`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, halfH);
    ctx.lineTo(w, halfH);
    ctx.stroke();

    // Draw waveform with fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `${color}60`);
    grad.addColorStop(0.5, `${color}90`);
    grad.addColorStop(1, `${color}60`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, halfH);

    // Upper half
    for (let x = 0; x < w; x++) {
      const idx = Math.floor(x * step);
      let max = 0;
      for (let j = idx; j < Math.min(idx + step, samples); j++) {
        const val = Math.abs(data[j]);
        if (val > max) max = val;
      }
      ctx.lineTo(x, halfH - max * halfH * 0.9);
    }

    // Lower half (mirror)
    for (let x = w - 1; x >= 0; x--) {
      const idx = Math.floor(x * step);
      let max = 0;
      for (let j = idx; j < Math.min(idx + step, samples); j++) {
        const val = Math.abs(data[j]);
        if (val > max) max = val;
      }
      ctx.lineTo(x, halfH + max * halfH * 0.9);
    }

    ctx.closePath();
    ctx.fill();

    // Waveform outline (brighter)
    ctx.strokeStyle = `${color}cc`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const idx = Math.floor(x * step);
      let max = 0;
      for (let j = idx; j < Math.min(idx + step, samples); j++) {
        const val = Math.abs(data[j]);
        if (val > max) max = val;
      }
      const y = halfH - max * halfH * 0.9;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Lower outline
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const idx = Math.floor(x * step);
      let max = 0;
      for (let j = idx; j < Math.min(idx + step, samples); j++) {
        const val = Math.abs(data[j]);
        if (val > max) max = val;
      }
      const y = halfH + max * halfH * 0.9;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Slice markers
    if (slices.length > 0) {
      ctx.strokeStyle = `${color}55`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      for (const slice of slices) {
        const xPos = slice.start * w;
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, h);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Trigger flash overlay
    if (flashRef.current) {
      ctx.fillStyle = `${color}30`;
      ctx.fillRect(0, 0, w, h);
    }
  }, [buffer, color, slices]);

  // Initial draw + redraw on buffer change
  useEffect(() => {
    draw();
  }, [draw]);

  // Listen for trigger flash events
  useEffect(() => {
    const handler = () => {
      flashRef.current = true;
      draw();
      setTimeout(() => {
        flashRef.current = false;
        draw();
      }, 80);
    };

    // We'll listen for a specific pad trigger event later
    // For now, the parent can call redraw via buffer changes

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  if (!buffer) {
    return (
      <div
        className="astral-detail__waveform-empty"
        style={{ width, minHeight: height }}
      >
        <span>{sigil || '🔱'}</span>
        <span>{lore || 'Drop a sample to claim this throne'}</span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="throne-waveform-canvas"
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: '6px',
        display: 'block',
      }}
    />
  );
});

ThroneWaveform.displayName = 'ThroneWaveform';
