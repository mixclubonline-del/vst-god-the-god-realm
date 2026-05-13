import React, { useEffect, useRef } from 'react';

interface SacredVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color?: string;
}

/**
 * SacredVisualizer — High-performance spectral visualizer.
 * Aesthetic: "Midnight Ember" - Glowing amber peaks on a charcoal background.
 */
export const SacredVisualizer: React.FC<SacredVisualizerProps> = ({
  analyser,
  isActive,
  color = '#F5B041', // Default Ember Amber
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();

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

      // Clear with slight trail for "sentient" feel
      ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
      ctx.fillRect(0, 0, width, height);

      if (!analyser || !isActive) {
        // Draw idle line
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = 'rgba(245, 176, 65, 0.1)';
        ctx.stroke();
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      const barWidth = (width / (bufferLength / 2)) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength / 2; i++) {
        barHeight = (dataArray[i] / 255) * height;

        // Create gradient for the "Ember" effect
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, 'rgba(245, 176, 65, 0.2)');
        gradient.addColorStop(0.5, 'rgba(255, 102, 0, 0.8)');
        gradient.addColorStop(1, '#FFFFFF');

        ctx.fillStyle = gradient;
        
        // Draw with rounded tops for premium feel
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, barWidth - 1, barHeight, [2, 2, 0, 0]);
        ctx.fill();

        // Add glow to the peaks
        if (dataArray[i] > 200) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#FF6600';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x, height - barHeight, barWidth - 1, 2);
          ctx.shadowBlur = 0;
        }

        x += barWidth;
      }
    };

    draw();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [analyser, isActive, color]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          canvasRef.current.width = parent.clientWidth;
          canvasRef.current.height = parent.clientHeight;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="sacred-visualizer"
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        borderRadius: '8px',
        background: '#0a0a0a',
      }}
    />
  );
};
