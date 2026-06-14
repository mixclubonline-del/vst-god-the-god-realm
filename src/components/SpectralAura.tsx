import React, { useEffect, useRef } from 'react';

interface SpectralAuraProps {
  energy: number;
  decayTime: number;
  spectralCentroid: number;
}

export const SpectralAura: React.FC<SpectralAuraProps> = ({ energy, decayTime, spectralCentroid }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use parent container dimensions
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
      }
    });
    
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }

    let animationFrameId: number;
    let time = 0;

    // Determine colors
    // Low (< 200) -> Magenta/Crimson
    // Mid (200-2000) -> Gold/Orange
    // High (> 2000) -> Cyan/White
    let hue = 30; // default orange
    if (spectralCentroid < 200) hue = 330; // magenta
    else if (spectralCentroid > 2000) hue = 190; // cyan
    else hue = 30 + ((spectralCentroid - 200) / 1800) * 40; // orange to yellow

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Create gradient glow
      const grad = ctx.createLinearGradient(0, height, 0, 0);
      grad.addColorStop(0, `hsla(${hue}, 80%, 30%, 0.6)`);
      grad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw waves
      const lines = 3;
      for (let i = 0; i < lines; i++) {
        ctx.beginPath();
        ctx.moveTo(0, height);

        const amplitude = (energy / 100) * (height / 2) * (i + 1) * 0.4;
        // Speed based on decay: short decay = faster movement
        const speed = (1 / Math.max(0.1, decayTime)) * 0.05;

        for (let x = 0; x <= width; x += 5) {
          const y = height / 2 + Math.sin(x * 0.05 + time * speed + i) * amplitude;
          ctx.lineTo(x, y);
        }
        
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        ctx.fillStyle = `hsla(${hue + i * 20}, 80%, 50%, 0.2)`;
        ctx.fill();

        ctx.strokeStyle = `hsla(${hue + i * 10}, 100%, 70%, 0.8)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Add particles for high energy
      const numParticles = Math.floor(energy / 5);
      for (let p = 0; p < numParticles; p++) {
        const px = (p * 37 + time * (20 * (1/decayTime))) % width;
        const py = height - ((p * 13 + time * 10) % height);
        ctx.beginPath();
        ctx.arc(px, py, 1, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${Math.random() * 0.8})`;
        ctx.fill();
      }

      time += 1;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [energy, decayTime, spectralCentroid]);

  return (
    <canvas 
      ref={canvasRef} 
      className="spectral-aura-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        mixBlendMode: 'screen',
        opacity: 0.9,
        transition: 'opacity 300ms ease-in-out',
        pointerEvents: 'none'
      }}
    />
  );
};
