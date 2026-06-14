/**
 * SpectralWaterfall — Celestial Forge 3D Waterfall Spectrogram Visualizer
 * Projects real-time FFT frequency data onto a moving 3D wireframe terrain.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { SpectralDataState } from '@/native/bridge';
import './SpectralWaterfall.css';

interface SpectralWaterfallProps {
  spectralData?: SpectralDataState | null;
}

export const SpectralWaterfall: React.FC<SpectralWaterfallProps> = ({ spectralData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // History buffer of spectral frames (fixed size queue)
  const historyRef = useRef<Uint8Array[]>([]);
  const mockFrameCountRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);

  const [rms, setRms] = useState(0);

  // Sync real FFT data from JUCE engine when available
  useEffect(() => {
    if (!spectralData) return;
    
    setRms(spectralData.rms);
    const bins = new Uint8Array(spectralData.fftBins);
    const history = historyRef.current;
    
    history.push(bins);
    if (history.length > 40) {
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
        history.push(mockFrame);
        if (history.length > 40) {
          history.shift();
        }
      }

      const history = historyRef.current;
      const depth = history.length;

      // 2. Clear canvas
      ctx.clearRect(0, 0, width, height);

      if (depth === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // Draw 3D floor grid guidelines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      const cx = width / 2;
      const cy = height * 0.72; // Baseline focus center
      const fov = 260;

      // 3D Bounding grid projection coordinates caching
      const getProjCoord = (xNorm: number, zNorm: number, amp: number) => {
        const zOffset = zNorm * 180 + 40; // zOffset goes from 40 (front) to 220 (back)
        const scale = fov / (fov + zOffset);
        
        const xScale = width * 0.86;
        const yScale = height * 0.32;
        
        const px = cx + xNorm * xScale * scale;
        const py = cy + (zOffset - 110) * 0.45 * scale - amp * yScale * scale;
        return { x: px, y: py, scale };
      };

      // 3. Draw 3D Stage guidelines (Ground Plane Grid)
      ctx.beginPath();
      for (let zG = 0; zG <= 10; zG++) {
        const zNorm = zG / 10;
        const p1 = getProjCoord(-0.5, zNorm, 0);
        const p2 = getProjCoord(0.5, zNorm, 0);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
      for (let xG = 0; xG <= 8; xG++) {
        const xNorm = (xG / 8) - 0.5;
        const p1 = getProjCoord(xNorm, 0, 0);
        const p2 = getProjCoord(xNorm, 1, 0);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();

      // Longitudinal lines bin indices to draw
      const longitudinalBins = [0, 8, 16, 24, 32, 40, 48, 56, 63];

      // 4. Painter's Algorithm: Draw rows from back to front (oldest to newest)
      for (let d = depth - 1; d >= 0; d--) {
        const frameData = history[d];
        const zNorm = d / Math.max(1, depth - 1); // 1 at back (oldest), 0 at front (newest)
        const numBins = frameData.length;

        // Calculate projected points for the current row
        const rowPoints: { x: number; y: number; scale: number }[] = [];
        for (let i = 0; i < numBins; i++) {
          const xNorm = (i / (numBins - 1)) - 0.5;
          const amp = frameData[i] / 255;
          rowPoints.push(getProjCoord(xNorm, zNorm, amp));
        }

        // 4a. Draw connecting longitudinal wireframe segments to the previous (further back) row
        if (d < depth - 1) {
          const prevFrameData = history[d + 1];
          const prevZNorm = (d + 1) / Math.max(1, depth - 1);
          
          ctx.strokeStyle = `rgba(255, 60, 20, ${0.12 * (1 - zNorm)})`;
          ctx.lineWidth = 0.8 * (1 - zNorm);
          ctx.beginPath();
          
          for (const binIdx of longitudinalBins) {
            if (binIdx < numBins) {
              const pCurrent = rowPoints[binIdx];
              const pPrev = getProjCoord(
                (binIdx / (numBins - 1)) - 0.5,
                prevZNorm,
                prevFrameData[binIdx] / 255
              );
              ctx.moveTo(pPrev.x, pPrev.y);
              ctx.lineTo(pCurrent.x, pCurrent.y);
            }
          }
          ctx.stroke();
        }

        // 4b. Fill beneath the transverse curve to mask lines behind it
        ctx.beginPath();
        const baseStart = getProjCoord(-0.5, zNorm, 0);
        ctx.moveTo(rowPoints[0].x, baseStart.y);
        
        ctx.lineTo(rowPoints[0].x, rowPoints[0].y);
        for (let i = 1; i < rowPoints.length; i++) {
          const xc = (rowPoints[i - 1].x + rowPoints[i].x) / 2;
          const yc = (rowPoints[i - 1].y + rowPoints[i].y) / 2;
          ctx.quadraticCurveTo(rowPoints[i - 1].x, rowPoints[i - 1].y, xc, yc);
        }
        ctx.lineTo(rowPoints[rowPoints.length - 1].x, rowPoints[rowPoints.length - 1].y);
        
        const baseEnd = getProjCoord(0.5, zNorm, 0);
        ctx.lineTo(rowPoints[rowPoints.length - 1].x, baseEnd.y);
        ctx.closePath();

        // Dark obsidian backdrop mask (semi-transparent glass overlays)
        ctx.fillStyle = `rgba(13, 6, 15, ${0.82 - zNorm * 0.15})`;
        ctx.fill();

        // 4c. Stroke the actual transverse frequency curve
        ctx.beginPath();
        ctx.moveTo(rowPoints[0].x, rowPoints[0].y);
        for (let i = 1; i < rowPoints.length - 1; i++) {
          const xc = (rowPoints[i].x + rowPoints[i + 1].x) / 2;
          const yc = (rowPoints[i].y + rowPoints[i + 1].y) / 2;
          ctx.quadraticCurveTo(rowPoints[i].x, rowPoints[i].y, xc, yc);
        }
        ctx.lineTo(rowPoints[rowPoints.length - 1].x, rowPoints[rowPoints.length - 1].y);

        // Gradient color logic (Gold in front -> Red/Orange in back)
        const opacity = 1.0 - zNorm * 0.55;
        const colorProgress = 1 - zNorm; // 1 (newest/front), 0 (oldest/back)
        
        const r = 255;
        const g = Math.round(65 + colorProgress * 150); // Blends 65 (red-orange) up to 215 (gold)
        const b = Math.round(20 + colorProgress * -20); // Gold has 0 blue, red-orange has 20

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.lineWidth = 1.4 * (1 - zNorm * 0.5);
        
        // Neon pulse glow on closest peaks
        if (zNorm < 0.3) {
          ctx.shadowBlur = Math.max(0, (5 - zNorm * 10));
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
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
