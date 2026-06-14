/**
 * FilterCurve.tsx — Mini Frequency Response Display
 * GUI Forge Paradigm: "Every control is a visualizer."
 * DPR-aware canvas rendering of a lowpass filter response curve.
 */

import React, { useRef, useEffect } from 'react';

interface FilterCurveProps {
  cutoff: number;    // 0-100 (maps to 20Hz-20kHz logarithmically)
  resonance: number; // 0-100
  color?: string;    // accent color
  width?: number;    // default 120
  height?: number;   // default 40
}

/** Map 0-1 normalized frequency to pixel X on log scale */
const freqToX = (freqNorm: number, w: number) => {
  if (freqNorm <= 0) return 0;
  // 20Hz = 0, 20kHz = 1 on log scale
  return Math.log10(freqNorm * 999 + 1) / 3 * w; // log10(1000) = 3
};

/** Map pixel X back to normalized frequency */
const xToFreqNorm = (x: number, w: number) => {
  const logVal = (x / w) * 3; // 0-3
  return (Math.pow(10, logVal) - 1) / 999;
};

export const FilterCurve: React.FC<FilterCurveProps> = ({
  cutoff,
  resonance,
  color = '#38D5FF',
  width = 120,
  height = 40,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = { left: 10, right: 4, top: 4, bottom: 10 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;

    ctx.clearRect(0, 0, width, height);

    // Background grid — horizontal lines at 0dB, -12dB, -24dB
    const dbRange = 40; // 0 to -40dB
    const dbToY = (db: number) => pad.top + (-db / dbRange) * h;

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    [0, -12, -24].forEach((db) => {
      const y = dbToY(db);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
    });

    // Cutoff and resonance parameters
    const cutoffNorm = cutoff / 100;
    const cutoffX = pad.left + cutoffNorm * w;
    const resPeakDb = (resonance / 100) * 12; // 0-12dB peak

    // Build frequency response curve
    const steps = Math.ceil(w);
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i <= steps; i++) {
      const x = pad.left + (i / steps) * w;
      const xNorm = (x - pad.left) / w; // 0-1

      let db: number;
      if (xNorm <= cutoffNorm) {
        // Before cutoff: flat at 0dB with resonance bump near cutoff
        const proximity = cutoffNorm > 0 ? xNorm / cutoffNorm : 0;
        if (proximity > 0.7) {
          // Resonance peak ramps up near cutoff
          const peakBlend = (proximity - 0.7) / 0.3;
          db = peakBlend * peakBlend * resPeakDb;
        } else {
          db = 0;
        }
      } else {
        // After cutoff: -12dB/octave rolloff
        // On log scale, each doubling of frequency = 1 octave = -12dB
        const freqRatio = cutoffNorm > 0 ? xNorm / cutoffNorm : 1;
        const octaves = Math.log2(Math.max(freqRatio, 1));
        db = -12 * octaves;
      }

      // Clamp to display range
      db = Math.max(-dbRange, Math.min(resPeakDb + 2, db));
      const y = dbToY(db);
      points.push({ x, y });
    }

    // Filled gradient beneath curve
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + h);
    gradient.addColorStop(0, color + '26'); // ~15% opacity
    gradient.addColorStop(1, 'transparent');

    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.lineTo(pad.left + w, pad.top + h);
    ctx.lineTo(pad.left, pad.top + h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke the curve
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();

    // Frequency labels
    ctx.font = "4px 'JetBrains Mono', monospace";
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const labelY = pad.top + h + 3;
    // 20Hz at left edge
    ctx.fillText('20', pad.left, labelY);
    // 1kHz at ~midpoint (log scale)
    const x1k = pad.left + freqToX(1000 / 20000, w);
    ctx.fillText('1k', x1k, labelY);
    // 20kHz at right edge
    ctx.fillText('20k', pad.left + w, labelY);
  }, [cutoff, resonance, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="fp-filter-curve"
      style={{ width, height, display: 'block' }}
    />
  );
};
