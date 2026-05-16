/**
 * WaveformScope.tsx — Mini Oscilloscope
 * Canvas-based real-time waveform display that draws the synth engine's
 * time-domain data. Zero-crossing triggered for stable display.
 *
 * Design: Compact display next to ALS Vision, god-colored waveform line
 * with subtle glow. Flatlines gracefully when idle.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import type { PantheonSynthEngine } from '@/audio/PantheonSynthEngine';

interface WaveformScopeProps {
  /** God primary color for the waveform line */
  color: string;
  /** Ref to the synth engine to pull time-domain data */
  engineRef: React.RefObject<PantheonSynthEngine | null>;
  /** Width in CSS pixels */
  width?: number;
  /** Height in CSS pixels */
  height?: number;
}

export const WaveformScope: React.FC<WaveformScopeProps> = ({
  color,
  engineRef,
  width = 120,
  height = 48,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const colorRef = useRef(color);
  colorRef.current = color;

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

    const draw = () => {
      const engine = engineRef.current;
      const data = engine?.getTimeDomainData();
      const w = width;
      const h = height;
      const midY = h / 2;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Background grid lines (very subtle)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.moveTo(0, midY - h * 0.25);
      ctx.lineTo(w, midY - h * 0.25);
      ctx.moveTo(0, midY + h * 0.25);
      ctx.lineTo(w, midY + h * 0.25);
      ctx.stroke();

      if (!data || data.length === 0) {
        // Idle: faint center line
        ctx.strokeStyle = `${colorRef.current}30`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();
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
        // No signal: faint flat line
        ctx.strokeStyle = `${colorRef.current}30`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Find trigger point for stable display
      const triggerIdx = findTriggerPoint(data);

      // How many samples to display (show ~2 cycles worth)
      const samplesToShow = Math.min(data.length - triggerIdx, Math.floor(data.length * 0.5));
      const step = samplesToShow / w;

      // Glow effect
      ctx.shadowColor = colorRef.current;
      ctx.shadowBlur = 6;

      // Draw waveform
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (let px = 0; px < w; px++) {
        const sampleIdx = triggerIdx + Math.floor(px * step);
        if (sampleIdx >= data.length) break;

        const sample = data[sampleIdx];
        // Amplify slightly for visual presence, clamp to ±1
        const amplified = Math.max(-1, Math.min(1, sample * 2.5));
        const y = midY - amplified * (midY * 0.85);

        if (px === 0) {
          ctx.moveTo(px, y);
        } else {
          ctx.lineTo(px, y);
        }
      }

      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(draw);
    };

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
