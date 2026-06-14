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
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; alpha: number }>>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const midY = h / 2;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw background grid lines (5% opacity)
    ctx.strokeStyle = `${color}0D`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Vertical grid lines
    for (let i = 1; i < 5; i++) {
      const gridX = (w / 5) * i;
      ctx.moveTo(gridX, 0);
      ctx.lineTo(gridX, h);
    }
    // Horizontal grid lines
    for (let i = 1; i < 4; i++) {
      const gridY = (h / 4) * i;
      ctx.moveTo(0, gridY);
      ctx.lineTo(w, gridY);
    }
    ctx.stroke();

    // Calculate RMS level
    let rms = 0;
    let data = new Float32Array(0);
    if (engine) {
      data = engine.getTimeDomainData();
      if (data.length > 0) {
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          sumSq += data[i] * data[i];
        }
        rms = Math.sqrt(sumSq / data.length);
      }
    }

    // Update and draw background particles when silent/idle
    const isSilent = !engine || rms < 0.005;
    if (isSilent && w > 0 && h > 0) {
      if (particlesRef.current.length === 0) {
        for (let i = 0; i < 5; i++) {
          particlesRef.current.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            alpha: 0.1 + Math.random() * 0.2,
          });
        }
      }

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      particlesRef.current.forEach((p) => {
        // Move particles
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off logical boundaries
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));

        ctx.fillStyle = color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Draw center line
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    if (!engine) {
      // Draw idle sine wave using smooth quadratic curve
      ctx.strokeStyle = `${color}30`;
      ctx.lineWidth = 1.5;

      const points: Array<{ x: number; y: number }> = [];
      for (let x = 0; x <= w; x += 10) {
        const y = midY + Math.sin(x * 0.04 + Date.now() * 0.001) * 8;
        points.push({ x, y });
      }

      if (points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    if (data.length === 0) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    // Set linear gradient for waveform
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, `${color}20`);
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, `${color}20`);

    // Sample data points
    const points: Array<{ x: number; y: number }> = [];
    const sampleStep = 2; // sample every 2 logical pixels
    for (let x = 0; x <= w; x += sampleStep) {
      const i = Math.min(data.length - 1, Math.floor(x * (data.length / w)));
      const sample = data[i] || 0;
      const y = midY + sample * midY * 0.85;
      points.push({ x, y });
    }

    // Draw glowing primary waveform using quadratic curves
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.min(12, 3 + rms * 20);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;

    if (points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    }
    ctx.restore();

    // Draw secondary broad glow layer
    ctx.save();
    ctx.strokeStyle = `${color}15`;
    ctx.lineWidth = 5;
    if (points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    }
    ctx.restore();

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
