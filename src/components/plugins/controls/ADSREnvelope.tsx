/**
 * ADSREnvelope.tsx — Canvas ADSR Curve Display
 * GUI Forge Paradigm: "Every control is a visualizer."
 * DPR-aware canvas rendering with smooth Bézier segments.
 */

import React, { useRef, useEffect } from 'react';

interface ADSREnvelopeProps {
  attack: number;    // 0-100
  decay: number;     // 0-100
  sustain: number;   // 0-100
  release: number;   // 0-100
  color?: string;    // accent color, default '#FFE66D'
  width?: number;    // default 160
  height?: number;   // default 60
}

export const ADSREnvelope: React.FC<ADSREnvelopeProps> = ({
  attack,
  decay,
  sustain,
  release,
  color = '#FFE66D',
  width = 160,
  height = 60,
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

    const pad = 8;
    const w = width - pad * 2;
    const h = height - pad * 2;

    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    const gridRows = 4;
    const gridCols = 6;
    for (let i = 0; i <= gridRows; i++) {
      const y = pad + (h / gridRows) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + w, y);
      ctx.stroke();
    }
    for (let i = 0; i <= gridCols; i++) {
      const x = pad + (w / gridCols) * i;
      ctx.beginPath();
      ctx.moveTo(x, pad);
      ctx.lineTo(x, pad + h);
      ctx.stroke();
    }

    // Compute breakpoints
    const aNorm = attack / 100;
    const dNorm = decay / 100;
    const sNorm = sustain / 100;
    const rNorm = release / 100;

    // Time allocation: A gets aNorm * 30% of width, D gets dNorm * 25%, S is fixed 25%, R gets rNorm * 20%
    const aW = aNorm * w * 0.3;
    const dW = dNorm * w * 0.25;
    const sW = w * 0.25;
    const rW = rNorm * w * 0.2;
    const totalW = aW + dW + sW + rW;
    const scale = totalW > 0 ? w / totalW : 1;

    const aX = aW * scale;
    const dX = dW * scale;
    const sX = sW * scale;
    const rX = rW * scale;

    const sustainY = 1 - sNorm;

    // Breakpoint coordinates (in canvas space)
    const p0 = { x: pad, y: pad + h };                          // start
    const p1 = { x: pad + aX, y: pad };                          // peak (after attack)
    const p2 = { x: pad + aX + dX, y: pad + sustainY * h };      // sustain start
    const p3 = { x: pad + aX + dX + sX, y: pad + sustainY * h }; // sustain end
    const p4 = { x: pad + aX + dX + sX + rX, y: pad + h };       // release end

    const breakpoints = [p0, p1, p2, p3, p4];

    // Build curve path with quadratic Bézier for smooth corners
    const buildPath = () => {
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);

      // Attack: rise from 0 to peak
      const aCpX = p0.x + (p1.x - p0.x) * 0.4;
      const aCpY = p0.y - (p0.y - p1.y) * 0.7;
      ctx.quadraticCurveTo(aCpX, aCpY, p1.x, p1.y);

      // Decay: fall from peak to sustain
      const dCpX = p1.x + (p2.x - p1.x) * 0.6;
      const dCpY = p1.y + (p2.y - p1.y) * 0.3;
      ctx.quadraticCurveTo(dCpX, dCpY, p2.x, p2.y);

      // Sustain: horizontal
      ctx.lineTo(p3.x, p3.y);

      // Release: fall to zero
      const rCpX = p3.x + (p4.x - p3.x) * 0.4;
      const rCpY = p3.y + (p4.y - p3.y) * 0.3;
      ctx.quadraticCurveTo(rCpX, rCpY, p4.x, p4.y);
    };

    // Filled gradient beneath curve
    const gradient = ctx.createLinearGradient(0, pad, 0, pad + h);
    gradient.addColorStop(0, color + '40'); // 25% opacity
    gradient.addColorStop(1, 'transparent');

    buildPath();
    ctx.lineTo(p4.x, pad + h);
    ctx.lineTo(p0.x, pad + h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke the envelope
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    buildPath();
    ctx.stroke();
    ctx.restore();

    // Breakpoint dots with glow
    breakpoints.forEach((p) => {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Stage labels
    ctx.font = "6px 'JetBrains Mono', monospace";
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const segments: [typeof p0, typeof p0, string][] = [
      [p0, p1, 'A'],
      [p1, p2, 'D'],
      [p2, p3, 'S'],
      [p3, p4, 'R'],
    ];
    segments.forEach(([a, b, label]) => {
      const mx = (a.x + b.x) / 2;
      ctx.fillText(label, mx, pad + h + 2);
    });
  }, [attack, decay, sustain, release, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="fp-adsr-envelope"
      style={{ width, height, display: 'block' }}
    />
  );
};
