import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SpectralDataState } from '../native/bridge';

interface SolarDiskProps {
  levels: { peak: number; rms: number; reduction: number };
  moduleLevels: Record<string, number>;
  spectralData?: SpectralDataState | null;
  drive?: number;
  cold?: number;
  gain?: number;
  stereoWidth?: number;
  ceiling?: number;
  attack?: number;
  release?: number;
}

export const SolarDisk: React.FC<SolarDiskProps> = ({ 
  levels, 
  moduleLevels,
  spectralData, 
  drive = 20, 
  cold = 0, 
  gain = 0, 
  stereoWidth = 100, 
  ceiling = -0.1, 
  attack = 30, 
  release = 100 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const paramsRef = useRef({ drive, cold, gain, stereoWidth, ceiling, attack, release, levels });
  useEffect(() => {
    paramsRef.current = { drive, cold, gain, stereoWidth, ceiling, attack, release, levels };
  }, [drive, cold, gain, stereoWidth, ceiling, attack, release, levels]);

  const smoothedBinsRef = useRef<Float32Array>(new Float32Array(256));
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Particle system for Coronal Mass Ejections (Flares)
    const particles: any[] = [];
    
    const render = () => {
      const p = paramsRef.current;
      timeRef.current += 1;
      const t = timeRef.current;

      const driveNorm = p.drive / 100;
      const coldNorm = p.cold / 100;
      const gainDb = Math.max(-24, Math.min(24, p.gain));
      const gainMult = Math.pow(10, gainDb / 20) * 0.8; 
      
      const attackSpeed = Math.max(0.01, 1.0 - (p.attack / 100)); 
      const releaseSpeed = Math.max(0.01, 1.0 - (p.release / 1000)); 

      let currentBins: Uint8Array;
      if (spectralData) {
        currentBins = new Uint8Array(spectralData.fftBins);
      } else {
        currentBins = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            currentBins[i] = Math.max(0, Math.sin(i * 0.1 + t * 0.05) * 128 + (Math.random() * 50));
        }
      }

      const numBins = Math.min(256, currentBins.length);
      const smoothedBins = smoothedBinsRef.current;

      let totalEnergy = 0;
      for (let i = 0; i < numBins; i++) {
        const raw = currentBins[i] / 255.0;
        if (raw > smoothedBins[i]) {
          smoothedBins[i] += (raw - smoothedBins[i]) * attackSpeed;
        } else {
          smoothedBins[i] += (raw - smoothedBins[i]) * releaseSpeed;
        }
        totalEnergy += smoothedBins[i];
      }
      const avgEnergy = totalEnergy / numBins;

      // Base Colors
      const r = Math.floor(255 * (1 - coldNorm));
      const g = Math.floor(215 * (1 - coldNorm) + 200 * coldNorm);
      const b = Math.floor(0 * (1 - coldNorm) + 255 * coldNorm);
      
      const finalR = Math.min(255, r + Math.floor(driveNorm * 100));
      const finalG = Math.max(0, g - Math.floor(driveNorm * 100));

      // Clear
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'screen';
      
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.25; // Base sun size

      // Sun Core Body
      const sunPulse = 1.0 + (Math.max(0, p.levels.rms) * 0.5) + (avgEnergy * gainMult * 0.2);
      const activeRadius = baseRadius * sunPulse;

      // Draw Corona Glow
      const gradient = ctx.createRadialGradient(centerX, centerY, activeRadius * 0.5, centerX, centerY, activeRadius * 2.5);
      gradient.addColorStop(0, `rgba(${finalR}, ${finalG}, ${b}, 0.8)`);
      gradient.addColorStop(0.3, `rgba(${finalR}, ${Math.max(0, finalG - 50)}, ${b}, 0.4)`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, activeRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw FFT Solar Flares
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${finalR}, ${finalG}, ${b}, 0.6)`;
      ctx.lineWidth = 2 + (driveNorm * 4);
      
      for (let i = 0; i < 360; i += 2) { // 180 points around the sun
        const rad = (i * Math.PI) / 180;
        const binIdx = Math.floor((i / 360) * numBins);
        const amp = smoothedBins[binIdx] * gainMult;
        
        // Distortion noise for the edge
        const noise = (Math.random() - 0.5) * driveNorm * 20;
        
        // Flare length extends outward based on amplitude
        const flareLength = activeRadius + (amp * baseRadius * 1.5) + noise;
        
        const x1 = centerX + Math.cos(rad) * activeRadius;
        const y1 = centerY + Math.sin(rad) * activeRadius;
        
        const x2 = centerX + Math.cos(rad) * flareLength;
        const y2 = centerY + Math.sin(rad) * flareLength;

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        // Spawn particles on massive flares
        if (amp > 0.5 && driveNorm > 0.2 && Math.random() < 0.1) {
            particles.push({
                x: x2,
                y: y2,
                vx: Math.cos(rad) * (2 + Math.random() * 5 * driveNorm),
                vy: Math.sin(rad) * (2 + Math.random() * 5 * driveNorm),
                life: 1.0,
                decay: 0.02 + Math.random() * 0.05
            });
        }
      }
      ctx.stroke();

      // Simulate & Draw Particles
      ctx.fillStyle = `rgba(${finalR}, ${finalG}, 255, 0.8)`;
      for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= p.decay;
          
          if (p.life <= 0) {
              particles.splice(i, 1);
          } else {
              ctx.globalAlpha = p.life;
              ctx.beginPath();
              ctx.arc(p.x, p.y, 1.5 + (p.life * 2), 0, Math.PI * 2);
              ctx.fill();
          }
      }
      ctx.globalAlpha = 1.0;

      // Draw the crisp Core Boundary
      ctx.beginPath();
      ctx.arc(centerX, centerY, activeRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, 0.8)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [spectralData]);

  const anchors = [
    { name: 'BODY', freq: '20Hz-200Hz', class: 'body', val: moduleLevels.bodyLevel || 0.3, color: '#ff4400' },
    { name: 'AIR', freq: '10kHz-20kHz', class: 'air', val: moduleLevels.airLevel || 0.4, color: '#00ccff' },
    { name: 'SOUL', freq: '200Hz-2kHz', class: 'soul', val: moduleLevels.soulLevel || 0.5, color: '#FFD700' },
    { name: 'SILK', freq: '2kHz-10kHz', class: 'silk', val: moduleLevels.silkLevel || 0.2, color: '#cc00ff' }
  ];

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 z-0">
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      </div>

      <div className="vg-sun-disk-wrap relative z-10 w-full max-w-[400px] aspect-square flex items-center justify-center">
        <div className="absolute inset-10 rounded-full overflow-hidden opacity-30 mix-blend-overlay pointer-events-none border border-white/5">
          <div className="vg-scanning-grid" />
        </div>

        <svg className="vg-sun-disk-svg relative z-1 vg-chromatic-filter" viewBox="0 0 400 400">
          <circle cx="200" cy="200" r="185" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          
          <path d="M 40 200 A 160 160 0 0 1 360 200" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" strokeLinecap="round" />
          <motion.path 
            d="M 40 200 A 160 160 0 0 1 360 200" 
            fill="none" 
            stroke="url(#peak-gradient)" 
            strokeWidth="16" 
            strokeLinecap="round" 
            strokeDasharray="503"
            animate={{ strokeDashoffset: 503 - (503 * Math.min(Math.max(levels.peak, 0), 1)) }}
            transition={{ type: "spring", bounce: 0, duration: 0.1 }}
            style={{ filter: 'drop-shadow(0 0 16px var(--god-primary))' }}
          />

          <path d="M 70 200 A 130 130 0 0 0 330 200" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
          <motion.path 
            d="M 70 200 A 130 130 0 0 0 330 200" 
            fill="none" 
            stroke="var(--god-secondary)" 
            strokeWidth="10" 
            strokeLinecap="round" 
            strokeDasharray="408"
            animate={{ strokeDashoffset: 408 - (408 * Math.min(Math.max(levels.rms, 0), 1)) }}
            transition={{ type: "tween", ease: "linear", duration: 0.15 }}
            className="opacity-90"
            style={{ filter: 'drop-shadow(0 0 8px var(--god-secondary-glow))' }}
          />

          {Array.from({ length: 11 }).map((_, i) => {
              const angle = (i * 18) - 180;
              const x1 = 200 + 175 * Math.cos((angle * Math.PI) / 180);
              const y1 = 200 + 175 * Math.sin((angle * Math.PI) / 180);
              const x2 = 200 + 185 * Math.cos((angle * Math.PI) / 180);
              const y2 = 200 + 185 * Math.sin((angle * Math.PI) / 180);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />;
          })}
          
          <defs>
            <linearGradient id="peak-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff4400" />
              <stop offset="50%" stopColor="#FFD700" />
              <stop offset="100%" stopColor="#ff2200" />
            </linearGradient>
          </defs>
        </svg>

        <div className="vg-sun-disk-core z-10">
          <motion.div 
            className="vg-sun-active-gem"
            animate={{ 
                opacity: levels.reduction > 0.05 ? [0.6, 1, 0.6] : 0.3,
                scale: levels.reduction > 0.05 ? [1, 1.2, 1] : 1,
                rotate: [45, 405]
            }}
            transition={{ duration: 0.5, repeat: levels.reduction > 0.05 ? Infinity : 0 }}
            style={{ 
                boxShadow: levels.reduction > 0.05 ? '0 0 24px #FFD700, inset 0 0 8px #fff' : 'none',
                backgroundColor: levels.reduction > 0.05 ? '#FFD700' : '#333'
            }}
          />
          <span className="vg-sun-label">ACTIVE</span>
          <span className="vg-sun-sublabel">FINAL OUTPUT LEVEL</span>
          <div className="mt-2 font-mono text-[14px] text-white font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
              {Math.round((Math.max(levels.peak, 0.001) * 24 - 24) * 10) / 10} <span className="text-[8px] opacity-50">dB</span>
          </div>
        </div>

        {anchors.map((a, index) => (
          <div key={a.name} className={`vg-anchor-label ${a.class}`}>
            <motion.div 
              animate={{ 
                  y: [0, -5, 0],
                  filter: [`drop-shadow(0 0 10px ${a.color}44)`, `drop-shadow(0 0 20px ${a.color}88)`, `drop-shadow(0 0 10px ${a.color}44)`]
              }}
              transition={{ duration: 3 + index, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center"
            >
              <span className="vg-anchor-name">{a.name}</span>
              <span className="vg-anchor-freq">{a.freq}</span>
            </motion.div>
            
            <div className="absolute -z-1 w-24 h-24 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                  <motion.circle 
                      cx="50" cy="50"
                      fill="none"
                      stroke={a.color}
                      strokeWidth="0.5"
                      initial={{ r: 25 + (a.val * 20), opacity: 0.1 }}
                      animate={{ 
                          r: [25 + (a.val * 20), 35 + (a.val * 15), 25 + (a.val * 20)],
                          opacity: [0.1, 0.3, 0.1]
                      }}
                      transition={{ duration: 4, repeat: Infinity }}
                  />
                  
                  <motion.circle 
                      cx="50" cy="50" r={30 + (a.val * 15)}
                      fill="none"
                      stroke={a.color}
                      strokeWidth="1.5"
                      strokeDasharray="10 5 2 5"
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 10 + index * 2, repeat: Infinity, ease: "linear" }}
                      style={{ opacity: 0.3 + a.val * 0.5, filter: `drop-shadow(0 0 12px ${a.color})` }}
                  />
                  <motion.circle 
                      cx="50" cy="50" r={40 + (a.val * 10)}
                      fill="none"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="0.5"
                      strokeDasharray="1 4"
                      animate={{ rotate: [360, 0] }}
                      transition={{ duration: 15 + index, repeat: Infinity, ease: "linear" }}
                  />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
