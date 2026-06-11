/**
 * WaveformCanvas.tsx — Hardware-Accelerated Waveform Display
 * Canvas-based oscilloscope following GUI Forge directive:
 * "For complex visualizers, prefer Canvas over DOM elements."
 */

import React, { useRef, useEffect, useCallback } from 'react';
import type { PantheonSynthEngine } from '@/audio/PantheonSynthEngine';

interface WaveformCanvasProps {
  engine: PantheonSynthEngine | null;
  color?: string;
  height?: number;
  className?: string;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  engine,
  color = '#B87DFF',
  height = 100,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const midY = h / 2;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw center line
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    if (!engine) {
      // Draw idle sine wave
      ctx.strokeStyle = `${color}30`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = midY + Math.sin(x * 0.04 + Date.now() * 0.001) * 8;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    // Get real waveform data
    const data = engine.getTimeDomainData();
    if (data.length === 0) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    // Draw waveform with gradient
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, `${color}20`);
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, `${color}20`);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const step = data.length / w;
    for (let x = 0; x < w; x++) {
      const i = Math.floor(x * step);
      const sample = data[i] || 0;
      const y = midY + sample * midY * 0.8;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Glow layer
    ctx.strokeStyle = `${color}20`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const i = Math.floor(x * step);
      const sample = data[i] || 0;
      const y = midY + sample * midY * 0.8;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    rafRef.current = requestAnimationFrame(draw);
  }, [engine, color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas resolution to match display size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`fp-waveform ${className}`}
      style={{ width: '100%', height }}
    />
  );
};
