import React, { useEffect, useRef } from 'react';

interface CarverSpectralFeedbackProps {
  active: boolean;
}

export const CarverSpectralFeedback: React.FC<CarverSpectralFeedbackProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = canvas.width = canvas.offsetWidth || 800;
    let height = canvas.height = canvas.offsetHeight || 500;

    // Handle resize
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || 800;
      height = canvas.height = canvas.offsetHeight || 500;
    };
    window.addEventListener('resize', handleResize);

    // Particle class
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      decay: number;
      color: string;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        // Float upwards, expand outwards
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = -Math.random() * 3 - 1;
        this.size = Math.random() * 2.5 + 0.5;
        this.alpha = 1.0;
        this.decay = Math.random() * 0.015 + 0.005;
        
        // Gold / Amber color palette
        const hue = Math.random() > 0.35 ? 45 : 30; // 45 = gold, 30 = amber/orange
        const light = 50 + Math.random() * 30;
        this.color = `hsla(${hue}, 100%, ${light}%, `;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
        this.vx += (Math.random() - 0.5) * 0.15;
      }

      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.globalAlpha = this.alpha;
        c.shadowBlur = this.size * 2;
        c.shadowColor = 'rgba(255, 215, 0, 0.4)';
        c.fillStyle = this.color + this.alpha + ')';
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }

    const particles: Particle[] = [];
    
    // Laser scan beam position
    let scanX = 0;
    let scanSpeed = 2.5;

    // Spectrum bars
    const barCount = 40;
    const barHeights = new Array(barCount).fill(0);
    const targetHeights = new Array(barCount).fill(0);

    // Text logs
    const mockLogs = [
      'CARVING PCM DATA BLOCK [0x0F2B]...',
      'IDENTIFYING RIFF/WAVE HEADER...',
      'CARVING AUDIO STREAM: RELIC_01.WAV',
      'APPLYING COGNITIVE FREQUENCY WEIGHTS...',
      'SYNTHESIZING SOUND ALTAR STRUCTURES...',
      'EXTRACTING SPECTRAL FINGERPRINT...',
      'PARSING DAT BANK BLOCK CHUNKS...',
      'LOCKING ZERO-CROSSING PLAYHEAD OFFSET...',
      'ALIGNING TRANSIENT PEAKS...',
      'APPENDING TO AKASHIC RECORD MASTER...'
    ];
    let logIndex = 0;
    const activeLogs: { text: string; alpha: number; y: number }[] = [];
    let logTimer = 0;

    const render = () => {
      // Clear with trailing opacity for motion blur
      ctx.fillStyle = 'rgba(8, 4, 15, 0.18)';
      ctx.fillRect(0, 0, width, height);

      // --- 1. Draw Spectrum (Golden bars at the bottom) ---
      const barWidth = width / barCount;
      for (let i = 0; i < barCount; ++i) {
        if (Math.random() > 0.96) {
          targetHeights[i] = Math.random() * (height * 0.35);
        }
        barHeights[i] += (targetHeights[i] - barHeights[i]) * 0.12;
        targetHeights[i] *= 0.97;

        const grad = ctx.createLinearGradient(0, height, 0, height - barHeights[i]);
        grad.addColorStop(0, 'rgba(124, 58, 237, 0.05)'); // violet base
        grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.25)'); // amber middle
        grad.addColorStop(1, 'rgba(251, 191, 36, 0.75)'); // bright gold top

        ctx.fillStyle = grad;
        ctx.fillRect(i * barWidth + 1, height - barHeights[i], barWidth - 2, barHeights[i]);
      }

      // --- 2. Draw Scanner Beam & Generate Particles ---
      scanX += scanSpeed;
      if (scanX > width) {
        scanX = 0;
      }

      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, height);
      ctx.stroke();
      ctx.restore();

      // Spawn particles along the scanner line
      const currentBarIdx = Math.floor(scanX / barWidth);
      if (currentBarIdx >= 0 && currentBarIdx < barCount) {
        const intersectionY = height - barHeights[currentBarIdx];
        if (barHeights[currentBarIdx] > 10) {
          for (let p = 0; p < 2; p++) {
            particles.push(new Particle(scanX, intersectionY + (Math.random() - 0.5) * 15));
          }
        }
      }

      // Bubble up random background particles
      if (Math.random() > 0.6) {
        particles.push(new Particle(Math.random() * width, height - 5));
      }

      // --- 3. Update & Draw Particles ---
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx);
        if (p.alpha <= 0) {
          particles.splice(i, 1);
        }
      }

      // --- 4. Draw Hacker-style Real-Time Logs ---
      logTimer++;
      if (logTimer > 50) {
        logTimer = 0;
        const logText = mockLogs[logIndex];
        logIndex = (logIndex + 1) % mockLogs.length;

        activeLogs.push({
          text: `[MIX-CARVER] ${logText}`,
          alpha: 1.0,
          y: height - 120
        });

        if (activeLogs.length > 5) {
          activeLogs.shift();
        }
      }

      ctx.save();
      ctx.font = '10px "JetBrains Mono", monospace';
      activeLogs.forEach((log, index) => {
        const targetY = height - 120 - (activeLogs.length - 1 - index) * 20;
        log.y += (targetY - log.y) * 0.1;
        log.alpha = Math.max(0, log.alpha - 0.003);

        ctx.fillStyle = `rgba(251, 191, 36, ${log.alpha * 0.75})`;
        ctx.fillText(log.text, 30, log.y);
      });
      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};

export default CarverSpectralFeedback;
