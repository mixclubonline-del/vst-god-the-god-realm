import React, { useEffect, useRef } from 'react';

interface DivineSpectrometerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color?: string;
  glowColor?: string;
}

export const DivineSpectrometer: React.FC<DivineSpectrometerProps> = ({
  analyser,
  isActive,
  color = '#F5B041',
  glowColor = 'rgba(255, 102, 0, 0.4)'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser?.frequencyBinCount || 128;
    const dataArray = new Uint8Array(bufferLength);

    let animationFrameId: number;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);

      if (analyser && isActive) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Subtle idle motion
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = 10 + Math.sin(Date.now() * 0.002 + i * 0.1) * 10;
        }
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.35;
      
      // Draw circular frequency bars
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * radius * 0.8;
        const angle = (i / bufferLength) * Math.PI * 2;
        
        const xStart = centerX + Math.cos(angle) * radius;
        const yStart = centerY + Math.sin(angle) * radius;
        const xEnd = centerX + Math.cos(angle) * (radius + barHeight);
        const yEnd = centerY + Math.sin(angle) * (radius + barHeight);

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xEnd, yEnd);
        ctx.stroke();

        // Add glow
        if (dataArray[i] > 100) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = glowColor;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Inner ring pulsing
      const pulse = 1 + (dataArray[10] / 255) * 0.1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = `${color}22`;
      ctx.lineWidth = 1;
      ctx.stroke();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, [analyser, isActive, color, glowColor]);

  return (
    <canvas 
      ref={canvasRef} 
      width={800} 
      height={800} 
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
};
