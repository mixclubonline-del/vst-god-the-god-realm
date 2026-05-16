import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface DivineSpectrometerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  size?: number;
  color?: string;
  glowColor?: string;
}

/**
 * DivineSpectrometer — A high-fidelity, circular spectral visualizer.
 * Inspired by ancient sun disks and sacred geometry.
 */
export const DivineSpectrometer: React.FC<DivineSpectrometerProps> = ({
  analyser,
  isActive,
  size = 300,
  color = '#F5B041',
  glowColor = 'rgba(255, 102, 0, 0.5)',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      requestRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 3;

      // Clear background
      ctx.clearRect(0, 0, width, height);

      if (!analyser || !isActive) {
        // Draw idle circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.setLineDash([5, 15]);
        ctx.stroke();
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      ctx.setLineDash([]);

      // 1. Draw Outer Aura (Sacred Geometry Rings)
      const bars = 120;
      for (let i = 0; i < bars; i++) {
        const rads = (Math.PI * 2) / bars;
        const index = Math.floor((i / bars) * (bufferLength / 2));
        const barHeight = (dataArray[index] / 255) * 80;

        const x1 = centerX + Math.cos(rads * i) * radius;
        const y1 = centerY + Math.sin(rads * i) * radius;
        const x2 = centerX + Math.cos(rads * i) * (radius + barHeight);
        const y2 = centerY + Math.sin(rads * i) * (radius + barHeight);

        // Draw individual rays
        ctx.strokeStyle = i % 10 === 0 ? color : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = i % 10 === 0 ? 3 : 1;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Particle peak dots
        if (barHeight > 40) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x2, y2, 1.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Peak Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = glowColor;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
      }

      // 2. Inner Circular Waveform
      ctx.beginPath();
      for (let i = 0; i < bars; i++) {
        const rads = (Math.PI * 2) / bars;
        const index = Math.floor((i / bars) * (bufferLength / 4));
        const waveH = (dataArray[index] / 255) * 30;
        const x = centerX + Math.cos(rads * i) * (radius - 10 + waveH);
        const y = centerY + Math.sin(rads * i) * (radius - 10 + waveH);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 102, 0, 0.1)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 3. Central Energy Pulse
      const total = dataArray.reduce((a, b) => a + b, 0);
      const avg = isFinite(total / bufferLength) ? total / bufferLength : 0;
      const pulseSize = (avg / 255) * 20;
      
      const gradRadius = Math.max(0.0001, radius / 2 + pulseSize);
      const grad = ctx.createRadialGradient(centerX, centerY, 0.0001, centerX, centerY, gradRadius);
      grad.addColorStop(0, color);
      grad.addColorStop(0.3, 'rgba(255, 102, 0, 0.4)');
      grad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius / 2 + pulseSize, 0, Math.PI * 2);
      ctx.fill();
    };

    draw();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [analyser, isActive, color, glowColor]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          canvasRef.current.width = parent.clientWidth * window.devicePixelRatio;
          canvasRef.current.height = parent.clientHeight * window.devicePixelRatio;
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      {/* Sacred Geometry Background (Static / Rotating) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")',
          opacity: 0.1,
          pointerEvents: 'none',
          zIndex: -1
        }}
      />
    </div>
  );
};
