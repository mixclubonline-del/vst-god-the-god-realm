import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import './SpectralRadarPanner.css';

interface Point {
  x: number;
  y: number;
}

export const SpectralRadarPanner: React.FC = () => {
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [elevation, setElevation] = useState(0.5); 
  const [rms, setRms] = useState(0);
  const [freqData, setFreqData] = useState<Uint8Array>(new Uint8Array(64));
  const containerRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<SVGSVGElement>(null);
  
  // High-fidelity spring physics
  const springX = useSpring(0, { stiffness: 80, damping: 25 });
  const springY = useSpring(0, { stiffness: 80, damping: 25 });
  const springZ = useSpring(0.5, { stiffness: 120, damping: 20 });
  const springRotateX = useSpring(45, { stiffness: 50, damping: 30 });

  // Mock audio engine for visual feedback
  useEffect(() => {
    let rafId: number;
    let frame = 0;
    const update = () => {
      frame++;
      
      // Dynamic RMS with organic variance
      const mockLevel = (Math.sin(frame * 0.05) * 0.4 + 0.6) * (0.1 + Math.random() * 0.05);
      setRms(prev => prev * 0.85 + mockLevel * 0.15);
      
      // Mock frequency bands (64 bands for the mesh)
      const newData = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        const freqWeight = Math.exp(-Math.abs(i - 10) / 10) * 2; // Bass focus
        const highWeight = Math.exp(-Math.abs(i - 40) / 15) * 1.5; // Mid focus
        newData[i] = (Math.sin(frame * 0.15 + i * 0.2) * 40 + 60) * (freqWeight + highWeight) * (0.8 + mockLevel);
      }
      setFreqData(newData);
      
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current || e.buttons !== 1) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    
    // Convert screen space to local radar space
    const x = ((e.clientX - rect.left) / rect.width) * 200 - 100;
    const y = ((e.clientY - rect.top) / rect.height) * 200 - 100;
    
    // Circular constraint
    const distance = Math.sqrt(x * x + y * y);
    const maxRadius = 90;
    
    if (distance <= maxRadius) {
      setPosition({ x, y });
      springX.set(x);
      springY.set(y);
    } else {
      const angle = Math.atan2(y, x);
      const nx = maxRadius * Math.cos(angle);
      const ny = maxRadius * Math.sin(angle);
      setPosition({ x: nx, y: ny });
      springX.set(nx);
      springY.set(ny);
    }
  };

  const handleScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const newElevation = Math.max(0, Math.min(1, elevation - e.deltaY * 0.001));
    setElevation(newElevation);
    springZ.set(newElevation);
  };

  // Generate the Spectral Mesh Path
  const meshPath = useMemo(() => {
    if (!freqData) return "";
    const points: string[] = [];
    const radius = 100;
    const center = 100;
    
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      const val = freqData[i % 64] / 255;
      const r = radius * (0.8 + val * 0.3 * (1 + rms));
      const px = center + r * Math.cos(angle);
      const py = center + r * Math.sin(angle);
      points.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
    }
    points.push('Z');
    return points.join(' ');
  }, [freqData, rms]);

  return (
    <div className="spectral-radar-3d-wrapper" onWheel={handleScroll}>
      <div className="radar-glass-container">
        <div className="radar-header">
          <div className="divine-title">SPECTRAL RADAR V2</div>
          <div className="radar-metrics">
            <div className="metric-box">
              <span className="label">AZM</span>
              <span className="value">{Math.round((Math.atan2(position.y, position.x) * 180 / Math.PI + 450) % 360)}°</span>
            </div>
            <div className="metric-box">
              <span className="label">ELV</span>
              <span className="value">{Math.round(elevation * 100)}%</span>
            </div>
          </div>
        </div>

        <div 
          ref={containerRef}
          className="radar-scene"
          onPointerMove={handlePointerMove}
        >
          {/* 3D Perspective Surface */}
          <motion.div 
            className="radar-surface-3d"
            style={{ 
              rotateX: springRotateX,
              perspective: '1000px'
            }}
          >
            {/* Background Grid & Rings */}
            <div className="radar-floor">
              <div className="floor-grid" />
              {[0.3, 0.6, 0.9].map((r, i) => (
                <div 
                  key={i} 
                  className="floor-ring" 
                  style={{ 
                    width: `${r * 100}%`, 
                    height: `${r * 100}%`,
                    opacity: 0.1 + rms * 0.2
                  }} 
                />
              ))}
            </div>

            {/* Spectral Mesh Layer */}
            <svg viewBox="0 0 200 200" className="spectral-mesh-svg">
              <defs>
                <linearGradient id="mesh-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--mixx-accent)" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="var(--mixx-accent-glow)" stopOpacity="0.2" />
                </linearGradient>
                <filter id="mesh-glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <motion.path 
                d={meshPath}
                className="mesh-path"
                fill="url(#mesh-gradient)"
                filter="url(#mesh-glow)"
                initial={false}
              />
            </svg>

            {/* Sound Source Orb */}
            <motion.div
              className="divine-source-orb"
              style={{
                left: useTransform(springX, x => `${50 + x/2}%`),
                top: useTransform(springY, y => `${50 + y/2}%`),
                translateZ: useTransform(springZ, z => `${z * 100}px`),
                scale: useTransform(springZ, z => 0.8 + z * 0.6)
              }}
            >
              <div className="orb-core">
                <div className="orb-inner-glow" style={{ opacity: 0.5 + rms }} />
                <motion.div 
                  className="orb-pulse-ring"
                  animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </div>
              <div className="orb-shadow" />
              <div className="orb-id">ALPHA_PRIME</div>
            </motion.div>

          </motion.div>

          <div className="radar-overlay-hints">
            <span>SHIFT + DRAG FOR FINE PAN</span>
            <span>SCROLL TO ASCEND</span>
          </div>
        </div>
      </div>
    </div>
  );
};
