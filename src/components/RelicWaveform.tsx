import React, { useRef, useEffect, useCallback } from 'react';


interface RelicWaveformProps {
  /** Pre-decoded AudioBuffer to draw */
  buffer?: AudioBuffer | null;
  /** Size variant */
  mode?: 'mini' | 'full';
  /** Amber color for waveform */
  color?: string;
}

export const RelicWaveform: React.FC<RelicWaveformProps> = ({
  buffer,
  mode = 'mini',
  color = '#d4a574'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution dynamically based on devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 100;
    const h = canvas.clientHeight || 40;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (!buffer) {
      // Draw placeholder bars
      const barCount = mode === 'mini' ? 20 : 60;
      const barWidth = w / barCount;
      ctx.fillStyle = 'rgba(194, 150, 35, 0.08)';
      for (let i = 0; i < barCount; i++) {
        const bh = (Math.sin(i * 0.4) * 0.3 + 0.3) * h;
        const bx = i * barWidth + 1;
        const bw = Math.max(1.5, barWidth - 2);
        const by = (h - bh) / 2;
        
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bx, by, bw, bh, bw / 2);
        } else {
          ctx.rect(bx, by, bw, bh);
        }
        ctx.fill();
      }
      return;
    }

    // Draw actual waveform from AudioBuffer
    const data = buffer.getChannelData(0);
    const barCount = mode === 'mini' ? 30 : 80;
    const samplesPerBar = Math.floor(data.length / barCount);
    const barWidth = w / barCount;

    // Create gradient
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(1, '#FFD700');

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      const start = i * samplesPerBar;
      for (let j = 0; j < samplesPerBar; j++) {
        sum += Math.abs(data[start + j] || 0);
      }
      const avg = sum / samplesPerBar;
      const barHeight = Math.max(2, avg * h * 1.8);

      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.6 + avg * 0.4;
      
      const bx = i * barWidth + 1;
      const bw = Math.max(1.5, barWidth - 2);
      const by = (h - barHeight) / 2;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bx, by, bw, barHeight, bw / 2);
      } else {
        ctx.rect(bx, by, bw, barHeight);
      }
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }, [buffer, mode, color]);

  // Initial draw + redraw on props change
  useEffect(() => {
    draw();
  }, [draw]);

  // ResizeObserver to handle bounds/layout adjustments automatically
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      draw();
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};
