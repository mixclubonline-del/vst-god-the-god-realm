/**
 * SpectralWaterfall — Celestial Forge 3D Waterfall Spectrogram Visualizer
 * Projects real-time FFT frequency data onto a moving 3D wireframe terrain.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { SpectralDataState } from '@/native/bridge';
import './SpectralWaterfall.css';

interface SpectralWaterfallProps {
  spectralData?: SpectralDataState | null;
  drive?: number;
  cold?: number;
  gain?: number;
  stereoWidth?: number;
  ceiling?: number;
  attack?: number;
  release?: number;
}

export const SpectralWaterfall: React.FC<SpectralWaterfallProps> = ({ spectralData, drive = 20, cold = 0, gain = 0, stereoWidth = 100, ceiling = -0.1, attack = 30, release = 100 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // History buffer of spectral frames (fixed size queue)
  const historyRef = useRef<Uint8Array[]>([]);
  const mockFrameCountRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);

  // Store parameters in a ref to avoid recreating the render loop
  const paramsRef = useRef({ drive, cold, gain, stereoWidth, ceiling, attack, release });
  useEffect(() => {
    paramsRef.current = { drive, cold, gain, stereoWidth, ceiling, attack, release };
  }, [drive, cold, gain, stereoWidth, ceiling, attack, release]);

  const [rms, setRms] = useState(0);

  // Sync real FFT data from JUCE engine when available
  useEffect(() => {
    if (!spectralData) return;
    
    setRms(spectralData.rms);
    const bins = new Uint8Array(spectralData.fftBins);
    const history = historyRef.current;
    
    // Release time controls gravity/history length (10ms = 10 frames, 1000ms = 120 frames)
    const maxHistory = Math.max(10, Math.floor((paramsRef.current.release / 1000) * 110 + 10));
    
    history.push(bins);
    while (history.length > maxHistory) {
      history.shift();
    }
  }, [spectralData]);

  // Mock signal generator for standalone dev mode
  const generateMockFrame = (frame: number) => {
    const mockLevel = (Math.sin(frame * 0.05) * 0.4 + 0.6) * (0.1 + Math.random() * 0.05);
    const newData = new Uint8Array(64);
    
    // Generate organic peak bands that slide and pulse
    const peak1 = Math.round(20 + Math.sin(frame * 0.02) * 10);
    const peak2 = Math.round(45 + Math.cos(frame * 0.04) * 8);
    
    for (let i = 0; i < 64; i++) {
      const lowWeight = Math.exp(-Math.abs(i - 8) / 6) * 2.0; // Bass presence
      const mid1Weight = Math.exp(-Math.abs(i - peak1) / 5) * 1.8; // Dynamic peaks
      const mid2Weight = Math.exp(-Math.abs(i - peak2) / 6) * 1.2;
      const highWeight = Math.exp(-Math.abs(i - 55) / 12) * 0.5; // High end
      
      const wave = Math.sin(frame * 0.15 + i * 0.2) * 30 + 50;
      newData[i] = Math.max(0, Math.min(255, 
        wave * (lowWeight + mid1Weight + mid2Weight + highWeight) * (0.7 + mockLevel * 1.2)
      ));
    }
    return newData;
  };

  // Main canvas animation and resize lifecycle loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPI Resolution Handling
    let dpr = window.devicePixelRatio || 1;
    let width = container.clientWidth;
    let height = container.clientHeight;

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

    const render = () => {
      // 1. Manage history queue if in mock mode
      if (!spectralData) {
        mockFrameCountRef.current++;
        const mockFrame = generateMockFrame(mockFrameCountRef.current);
        
        // Calculate mock RMS level for displays
        let sum = 0;
        for (let i = 0; i < mockFrame.length; i++) {
          sum += mockFrame[i];
        }
        const avg = sum / (mockFrame.length * 255);
        setRms(prev => prev * 0.8 + avg * 0.2);

        const history = historyRef.current;
        const maxHistory = Math.max(10, Math.floor((paramsRef.current.release / 1000) * 110 + 10));
        history.push(mockFrame);
        while (history.length > maxHistory) {
          history.shift();
        }
      }

      const history = historyRef.current;
      const depth = history.length;

      // Clear canvas so the celestial background breathes through
      ctx.clearRect(0, 0, width, height);

      if (depth === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // 3. Celestial Tapestry Plotting
      // Draw from oldest (0) to newest (depth - 1) or vice versa.
      for (let d = depth - 1; d >= 0; d--) {
        const frameData = history[d];
        const progress = (depth - 1 - d) / Math.max(1, depth - 1); // 0 = top (newest), 1 = bottom (oldest)
        const y = progress * height;
        const numBins = frameData.length;

        const p = paramsRef.current;
        const gainMult = Math.pow(10, p.gain / 20);
        const ceilLinear = Math.pow(10, p.ceiling / 20);
        const driveNorm = Math.min(1, Math.max(0, p.drive / 100));
        const coldNorm = Math.min(1, Math.max(0, p.cold / 100));
        const widthNorm = p.stereoWidth / 100;

        for (let i = 0; i < numBins; i++) {
          let amp = (frameData[i] / 255) * gainMult;
          
          // Apply ceiling clip
          if (amp > ceilLinear) amp = ceilLinear;
          
          // Add some chaos based on drive
          if (driveNorm > 0.1 && amp > 0.1) {
            amp += (Math.random() - 0.5) * 0.2 * driveNorm * amp;
          }
          
          if (amp < 0.05) continue; // Only draw significant peaks

          const centerOffset = (i / (numBins - 1) - 0.5);
          const x = (0.5 + centerOffset * widthNorm) * width;

          // Attack phase logic: at high attack (100ms), the newest frames (progress ~0) fade in slowly.
          // Attack ranges from 1ms to 100ms.
          const attackNorm = p.attack / 100; // 0.01 to 1
          let attackEnv = 1.0;
          if (attackNorm > 0.1 && progress < attackNorm * 0.2) {
             // If within the attack phase, ramp up the envelope
             attackEnv = progress / (attackNorm * 0.2);
          }

          // Glowing star physics
          const baseRadius = coldNorm > 0.5 ? 2.0 : 4.0; // Cold makes stars sharper/smaller
          const radius = amp * (baseRadius + driveNorm * 2.0) * attackEnv; 
          const opacity = amp * (1 - progress) * attackEnv; // Fade out as it falls

          // Draw vertical stardust trails (history connection)
          if (d < depth - 1) {
            const prevFrameData = history[d + 1];
            let prevAmp = (prevFrameData[i] / 255) * gainMult;
            if (prevAmp > ceilLinear) prevAmp = ceilLinear;

            if (prevAmp > 0.05) {
              const prevProgress = (depth - 1 - (d + 1)) / Math.max(1, depth - 1);
              const prevY = prevProgress * height;
              const prevX = (0.5 + centerOffset * widthNorm) * width;
              
              ctx.beginPath();
              ctx.moveTo(prevX, prevY);
              ctx.lineTo(x, y);
              
              const trailOpacity = Math.min(1, (amp + prevAmp) * 0.5 * (1 - progress));
              
              // Color shifting logic based on Drive (Red/Fire) and Cold (Ice/Cyan)
              let r = 157, g = 0, b = 255; // Default Purple
              if (driveNorm > 0.1) {
                 r = 157 + driveNorm * 98; // -> 255
                 g = driveNorm * 100;     // -> 100
                 b = 255 - driveNorm * 255; // -> 0 (Fiery Orange/Red)
              }
              if (coldNorm > 0.1) {
                 r = r * (1 - coldNorm);
                 g = g + (200 - g) * coldNorm;
                 b = b + (255 - b) * coldNorm; // -> Cyan/Ice Blue
              }
              
              ctx.strokeStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${trailOpacity})`; 
              
              const widthMultiplier = coldNorm > 0.5 ? 1.0 : 2.5;
              ctx.lineWidth = Math.max(1.0, (amp + prevAmp) * widthMultiplier * (1 + driveNorm));
              ctx.stroke();
            }
          }

          // Draw horizontal constellation lines
          if (i > 0 && amp > 0.4) {
            let prevBinAmp = (frameData[i - 1] / 255) * gainMult;
            if (prevBinAmp > ceilLinear) prevBinAmp = ceilLinear;
            if (prevBinAmp > 0.4) {
              const prevCenterOffset = ((i - 1) / (numBins - 1) - 0.5);
              const prevX = (0.5 + prevCenterOffset * widthNorm) * width;
              ctx.beginPath();
              ctx.moveTo(prevX, y);
              ctx.lineTo(x, y);
              
              let cr = 255, cg = 215, cb = 0; // Default Gold
              if (coldNorm > 0.5) { cr = 100; cg = 255; cb = 255; } // Ice
              else if (driveNorm > 0.5) { cr = 255; cg = 50; cb = 0; } // Fire

              ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${opacity * 0.3})`;
              ctx.lineWidth = coldNorm > 0.5 ? 0.2 : 0.5;
              ctx.stroke();
            }
          }

          // Draw the star core
          if (amp > 0.1) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.shadowBlur = coldNorm > 0.5 ? radius * 2 : radius * 4;
            
            let shadowColor = amp > 0.6 ? 'rgba(255, 215, 0, 1)' : 'rgba(0, 229, 255, 0.8)';
            if (coldNorm > 0.5) shadowColor = 'rgba(200, 255, 255, 0.9)';
            if (driveNorm > 0.5 && amp > 0.6) shadowColor = 'rgba(255, 50, 0, 1)';
            
            ctx.shadowColor = shadowColor;
            ctx.fill();
            ctx.shadowBlur = 0; // reset
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    animationFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      resizeObserver.disconnect();
    };
  }, [spectralData]);

  return (
    <div className="spectral-waterfall-3d-wrapper">
      <div className="waterfall-glass-container" ref={containerRef}>
        <div className="waterfall-header">
          <div className="divine-title">SPECTRAL WATERFALL 3D</div>
          <div className="waterfall-metrics">
            <div className="metric-box">
              <span className="label">FFT BINS</span>
              <span className="value">64 BANDS</span>
            </div>
            <div className="metric-box">
              <span className="label">ENERGY</span>
              <span className="value">{(rms * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="waterfall-scene">
          <canvas ref={canvasRef} className="waterfall-canvas" />
          <div className="waterfall-overlay-hints">
            <span>OBSIDIAN MASK SHIELD ACTIVE</span>
            <span>CELESTIAL FFT DECODE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
