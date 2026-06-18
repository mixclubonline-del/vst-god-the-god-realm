import React, { useRef, useEffect } from 'react';
import './DivineMatrix.css';
import { SpectralDataState } from '../native/bridge';

interface DivineMatrixProps {
  spectralData?: SpectralDataState | null;
  drive?: number;
  cold?: number;
  gain?: number;
  stereoWidth?: number;
  ceiling?: number;
  attack?: number;
  release?: number;
}

export const DivineMatrix: React.FC<DivineMatrixProps> = ({ 
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

  // Store parameters in a ref to avoid recreating the render loop
  const paramsRef = useRef({ drive, cold, gain, stereoWidth, ceiling, attack, release });
  useEffect(() => {
    paramsRef.current = { drive, cold, gain, stereoWidth, ceiling, attack, release };
  }, [drive, cold, gain, stereoWidth, ceiling, attack, release]);

  // Smoothing buffer for the threads
  const smoothedBinsRef = useRef<Float32Array>(new Float32Array(512));
  const mockTimeRef = useRef(0);
  const mockFrameCountRef = useRef(0);

  // Generate mock data if bridge is disconnected
  const generateMockFrame = (frameCount: number) => {
    const bins = new Uint8Array(256);
    const time = frameCount * 0.05;
    for (let i = 0; i < 256; i++) {
      const freq = i / 256;
      let val = 0;
      val += Math.sin(freq * 10 - time) * 0.5 + 0.5;
      val += Math.sin(freq * 25 + time * 1.5) * 0.3;
      if (i > 10 && i < 20) val += Math.sin(time * 2) * 0.8;
      if (i > 50 && i < 60) val += Math.sin(time * 3) * 0.6;
      if (Math.random() < 0.01) val += 1.0; 
      bins[i] = Math.min(255, Math.max(0, val * 128));
    }
    return bins;
  };

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

    // Create thread configurations (The Aetheric Loom)
    const numThreads = 16;
    const threads = Array.from({ length: numThreads }).map((_, i) => {
      return {
        baseYOffset: (i / (numThreads - 1) - 0.5) * 0.6, // Spread vertically from -30% to +30% of center
        phaseSpeed: 0.02 + Math.random() * 0.03,
        phaseOffset: Math.random() * Math.PI * 2,
        thicknessMult: 0.5 + Math.random() * 1.0,
      };
    });

    const render = () => {
      const p = paramsRef.current;
      
      // Calculate normalized DSP parameters
      const driveNorm = p.drive / 100;
      const coldNorm = p.cold / 100;
      
      // Gain: Maps -24dB to +24dB -> amplitude multiplier
      const gainDb = Math.max(-24, Math.min(24, p.gain));
      const gainMult = Math.pow(10, gainDb / 20) * 0.8; 

      // Ceiling: Visual hard clip
      const ceilDb = Math.max(-24, Math.min(0, p.ceiling));
      const ceilMult = Math.pow(10, ceilDb / 20);

      // Width: 0% to 200% (100% is normal)
      const widthNorm = p.stereoWidth / 100;

      // Envelopes
      const attackSpeed = Math.max(0.01, 1.0 - (p.attack / 100)); // 1ms = fast (0.99), 100ms = slow (0.01)
      const releaseSpeed = Math.max(0.01, 1.0 - (p.release / 1000)); // 10ms = fast (0.99), 1000ms = slow (0.01)

      // Fetch or generate bins
      let currentBins: Uint8Array;
      if (spectralData) {
        currentBins = new Uint8Array(spectralData.fftBins);
      } else {
        mockFrameCountRef.current++;
        currentBins = generateMockFrame(mockFrameCountRef.current);
      }

      const numBins = currentBins.length;
      if (smoothedBinsRef.current.length !== numBins) {
        smoothedBinsRef.current = new Float32Array(numBins);
      }
      const smoothedBins = smoothedBinsRef.current;

      // Apply Attack & Release smoothing to the FFT data
      for (let i = 0; i < numBins; i++) {
        const raw = currentBins[i] / 255.0; // 0.0 to 1.0
        if (raw > smoothedBins[i]) {
          // Attack phase
          smoothedBins[i] += (raw - smoothedBins[i]) * attackSpeed;
        } else {
          // Release phase
          smoothedBins[i] += (raw - smoothedBins[i]) * releaseSpeed;
        }
      }

      // Clear frame with a slight trail effect
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(10, 5, 15, 0.25)'; 
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'screen';
      
      mockTimeRef.current += 1;
      const t = mockTimeRef.current;

      // Determine Base Colors based on Drive and Cold
      // Gold: rgb(255, 215, 0)
      // Orange (Drive): rgb(255, 60, 0)
      // Cyan (Cold): rgb(0, 200, 255)
      const r = Math.floor(255 * (1 - coldNorm));
      const g = Math.floor(215 * (1 - coldNorm) + 200 * coldNorm);
      const b = Math.floor(0 * (1 - coldNorm) + 255 * coldNorm);
      
      // Apply drive shift towards red
      const finalR = Math.min(255, r + Math.floor(driveNorm * 100));
      const finalG = Math.max(0, g - Math.floor(driveNorm * 100));

      const centerY = height / 2;

      // Draw each thread in the loom
      for (let tIdx = 0; tIdx < threads.length; tIdx++) {
        const thread = threads[tIdx];
        
        ctx.beginPath();
        
        // Physics: Tension increases as attack/release get tighter (lower values)
        const tension = 1.0 + (1.0 - attackSpeed) * 2.0;
        
        // Visuals: Colder threads are thinner and sharper, driven threads are thicker and blown out
        const baseThickness = coldNorm > 0.5 ? 0.3 : 1.2;
        ctx.lineWidth = thread.thicknessMult * baseThickness * (1 + driveNorm * 2);
        
        ctx.strokeStyle = `rgba(${finalR}, ${finalG}, ${b}, ${0.5 + (thread.thicknessMult * 0.3)})`;
        ctx.shadowBlur = coldNorm > 0.5 ? 4 : 12 * (1 + driveNorm);
        ctx.shadowColor = `rgb(${finalR}, ${finalG}, ${b})`;

        // Number of horizontal segments to draw
        const segments = Math.max(300, width / 1.5);
        
        let prevX = 0;
        let prevY = centerY + (thread.baseYOffset * height);

        for (let s = 0; s <= segments; s++) {
          const xRatio = s / segments;
          const x = xRatio * width;
          
          // Map xRatio to a frequency bin index, applying Stereo Width stretch
          const centerOffset = (xRatio - 0.5) / Math.max(0.1, widthNorm);
          let binRatio = centerOffset + 0.5;
          
          let amp = 0;
          if (binRatio >= 0 && binRatio <= 1.0) {
            // Use a smoother interpolation between bins for silkier threads
            const exactBin = binRatio * (numBins - 1);
            const bin1 = Math.floor(exactBin);
            const bin2 = Math.min(numBins - 1, bin1 + 1);
            const mix = exactBin - bin1;
            amp = (smoothedBins[bin1] * (1 - mix) + smoothedBins[bin2] * mix) * gainMult;
            amp = Math.min(amp, ceilMult); // Apply visual ceiling
          }

          // Pin the threads at the edges using an eased window
          const windowEdge = Math.pow(Math.sin(xRatio * Math.PI), 1.5);

          // Thread vibration mathematics
          let baseY = centerY + (thread.baseYOffset * height * (1 + widthNorm * 0.2));
          
          // Calculate vibration harmonics
          const phase = t * thread.phaseSpeed + thread.phaseOffset;
          // Fundamental standing wave
          let vibration = Math.sin(xRatio * 15 * tension + phase) * amp * (height * 0.15);
          // Overtone standing wave
          vibration += Math.sin(xRatio * 45 + phase * 2.3) * amp * (height * 0.08);
          
          // Add chaotic drive distortion
          let noiseY = 0;
          if (driveNorm > 0.05) {
             noiseY = (Math.sin(xRatio * 200 + phase * 5) * amp * driveNorm * 30);
          }

          const y = baseY - (vibration * windowEdge) + noiseY;

          if (s === 0) {
            ctx.moveTo(x, y);
          } else {
            // Use bezier curves for ultra-smooth string physics
            const cpX = (prevX + x) / 2;
            ctx.quadraticCurveTo(cpX, prevY, x, y);
          }
          
          prevX = x;
          prevY = y;
          
          // Draw "Aether Dust" flying off highly driven threads
          if (driveNorm > 0.2 && amp > 0.3 && Math.random() < driveNorm * 0.03) {
             ctx.save();
             ctx.fillStyle = `rgba(255, ${Math.random() * 180 + 50}, 50, ${Math.random()})`;
             ctx.shadowBlur = 4;
             ctx.shadowColor = '#FFAA00';
             const size = Math.random() * 2 + 1;
             // Dust flies upwards depending on amplitude
             ctx.fillRect(x + (Math.random()-0.5)*15, y - (Math.random() * 60 * amp), size, size);
             ctx.restore();
          }
        }
        
        ctx.stroke();
      }

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

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
      <div ref={containerRef} className="matrix-glass-container pointer-events-auto">
        <canvas ref={canvasRef} className="matrix-canvas absolute inset-0 pointer-events-none" />
      </div>
    </div>
  );
};
