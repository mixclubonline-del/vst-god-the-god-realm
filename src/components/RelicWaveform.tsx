import React, { useRef, useEffect } from 'react';

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (!buffer) {
      // Draw placeholder bars
      const barCount = mode === 'mini' ? 20 : 60;
      const barWidth = w / barCount;
      ctx.fillStyle = 'rgba(194,150,35,0.08)';
      for (let i = 0; i < barCount; i++) {
        const bh = (Math.sin(i * 0.4) * 0.3 + 0.3) * h;
        ctx.fillRect(i * barWidth + 1, (h - bh) / 2, barWidth - 2, bh);
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
      ctx.fillRect(
        i * barWidth + 1,
        (h - barHeight) / 2,
        barWidth - 2,
        barHeight
      );
    }

    ctx.globalAlpha = 1;
  }, [buffer, mode, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};
