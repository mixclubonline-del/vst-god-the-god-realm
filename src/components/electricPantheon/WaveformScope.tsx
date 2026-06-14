/**
 * WaveformScope.tsx — Mini Oscilloscope
 * Canvas-based real-time waveform display that draws the synth engine's
 * time-domain data. Zero-crossing triggered for stable display.
 *
 * Design: Compact display next to ALS Vision, god-colored waveform line
 * with subtle glow. Flatlines gracefully when idle.
 *
 * Visual features:
 * - Gradient amplitude coloring (secondary → primary → accent)
 * - Bézier curve interpolation for smooth rendering
 * - Audio-reactive shadowBlur driven by RMS
 * - God-colored frequency grid lines
 * - Idle Brownian-motion particle effect
 */

import React, { useRef, useEffect, useCallback } from 'react';
import type { PantheonSynthEngine } from '@/audio/PantheonSynthEngine';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface WaveformScopeProps {
  /** God primary color for the waveform line */
  color: string;
  /** God secondary color (gradient bottom) */
  colorSecondary?: string;
  /** God accent color (gradient top) */
  colorAccent?: string;
  /** Ref to the synth engine to pull time-domain data */
  engineRef: React.RefObject<PantheonSynthEngine | null>;
  /** Width in CSS pixels */
  width?: number;
  /** Height in CSS pixels */
  height?: number;
}

export const WaveformScope: React.FC<WaveformScopeProps> = ({
  color,
  colorSecondary,
  colorAccent,
  engineRef,
  width = 120,
  height = 48,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const colorRef = useRef(color);
  const colorSecondaryRef = useRef(colorSecondary ?? color);
  const colorAccentRef = useRef(colorAccent ?? color);
  colorRef.current = color;
  colorSecondaryRef.current = colorSecondary ?? color;
  colorAccentRef.current = colorAccent ?? color;

  /** Persistent idle particles — initialized lazily */
  const particlesRef = useRef<Particle[] | null>(null);

  /**
   * Find the first zero-crossing point in the buffer for stable triggering.
   * Looks for a rising zero-cross (negative → positive).
   */
  const findTriggerPoint = useCallback((data: Float32Array): number => {
    const threshold = 0.01;
    // Search from 10% into the buffer to avoid edge artifacts
    const start = Math.floor(data.length * 0.1);
    const end = Math.floor(data.length * 0.5); // only search first half

    for (let i = start; i < end - 1; i++) {
      if (data[i] < -threshold && data[i + 1] >= -threshold) {
        return i;
      }
    }
    return 0; // no trigger found, start at beginning
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Lazily initialize idle particles
    if (!particlesRef.current) {
      particlesRef.current = Array.from({ length: 4 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      }));
    }

    const draw = () => {
      const engine = engineRef.current;
      const data = engine?.getTimeDomainData();
      const w = width;
      const h = height;
      const midY = h / 2;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // --- Background grid lines (very subtle, god-primary at 4% opacity) ---
      ctx.strokeStyle = `${colorRef.current}0A`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      // 3 horizontal lines
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.moveTo(0, midY - h * 0.25);
      ctx.lineTo(w, midY - h * 0.25);
      ctx.moveTo(0, midY + h * 0.25);
      ctx.lineTo(w, midY + h * 0.25);
      // 8 vertical frequency grid lines
      for (let i = 1; i < 8; i++) {
        const x = (w / 8) * i;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      ctx.stroke();

      if (!data || data.length === 0) {
        // Idle: faint center line
        ctx.strokeStyle = `${colorRef.current}30`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();
        // Draw idle particles
        drawIdleParticles(ctx, w, h);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Check if signal is present (RMS above noise floor)
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        sumSq += data[i] * data[i];
      }
      const rms = Math.sqrt(sumSq / data.length);
      const isActive = rms > 0.005;

      if (!isActive) {
        // No signal: faint flat line + idle particles
        ctx.strokeStyle = `${colorRef.current}30`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();
        drawIdleParticles(ctx, w, h);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Find trigger point for stable display
      const triggerIdx = findTriggerPoint(data);

      // How many samples to display (show ~2 cycles worth)
      const samplesToShow = Math.min(data.length - triggerIdx, Math.floor(data.length * 0.5));
      const step = samplesToShow / w;

      // --- Build vertical gradient: secondary (bottom) → primary (center) → accent (top) ---
      const gradient = ctx.createLinearGradient(0, h, 0, 0);
      gradient.addColorStop(0, colorSecondaryRef.current);
      gradient.addColorStop(0.5, colorRef.current);
      gradient.addColorStop(1, colorAccentRef.current);

      // Audio-reactive glow effect (capped at 14)
      ctx.shadowColor = colorRef.current;
      ctx.shadowBlur = Math.min(14, 4 + rms * 20);

      // Draw waveform with gradient and Bézier interpolation
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      let prevX = 0;
      let prevY = midY;

      for (let px = 0; px < w; px++) {
        const sampleIdx = triggerIdx + Math.floor(px * step);
        if (sampleIdx >= data.length) break;

        const sample = data[sampleIdx];
        // Amplify slightly for visual presence, clamp to ±1
        const amplified = Math.max(-1, Math.min(1, sample * 2.5));
        const y = midY - amplified * (midY * 0.85);

        if (px === 0) {
          ctx.moveTo(px, y);
        } else if (px === 1) {
          // First segment — straight line to establish curve basis
          ctx.lineTo(px, y);
        } else {
          // Bézier interpolation: use midpoint for smooth curves
          const midX = (prevX + px) / 2;
          const midPtY = (prevY + y) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, midPtY);
        }

        prevX = px;
        prevY = y;
      }

      // Final segment to last point
      ctx.lineTo(prevX, prevY);
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(draw);
    };

    /**
     * Draw slow-drifting Brownian particles when the scope is idle.
     * Particles persist across frames via particlesRef.
     */
    function drawIdleParticles(
      renderCtx: CanvasRenderingContext2D,
      w: number,
      h: number,
    ) {
      const particles = particlesRef.current;
      if (!particles) return;

      for (const p of particles) {
        // Brownian nudge
        p.vx += (Math.random() - 0.5) * 0.15;
        p.vy += (Math.random() - 0.5) * 0.15;
        // Dampen
        p.vx *= 0.96;
        p.vy *= 0.96;
        // Move
        p.x += p.vx;
        p.y += p.vy;
        // Bounce off edges
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > w) { p.x = w; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > h) { p.y = h; p.vy *= -1; }

        // Tiny glow
        renderCtx.shadowColor = colorRef.current;
        renderCtx.shadowBlur = 3;

        renderCtx.fillStyle = `${colorRef.current}40`;
        renderCtx.beginPath();
        renderCtx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        renderCtx.fill();

        renderCtx.shadowBlur = 0;
      }
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [engineRef, width, height, findTriggerPoint]);

  return (
    <div className="ep-scope-container">
      <span className="ep-scope-label">SCOPE</span>
      <canvas
        ref={canvasRef}
        className="ep-scope-canvas"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    </div>
  );
};
