import React, { useState, useRef, useEffect } from 'react';
import { motion, useSpring } from 'framer-motion';
import { GodRealmSamplerEngine } from '../engine/samplerEngine';
import './SpectralRadarPanner.css';

interface Point {
  x: number;
  y: number;
}

interface SpectralRadarPannerProps {
  engineRef?: React.RefObject<GodRealmSamplerEngine>;
}

export const SpectralRadarPanner: React.FC<SpectralRadarPannerProps> = ({ engineRef }) => {
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [elevation, setElevation] = useState(0.5); // 0 to 1
  const [rms, setRms] = useState(0);
  const [freqData, setFreqData] = useState<Uint8Array>(new Uint8Array(0));
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Spring physics for smooth movement
  const springX = useSpring(0, { stiffness: 100, damping: 20 });
  const springY = useSpring(0, { stiffness: 100, damping: 20 });
  const springScale = useSpring(1, { stiffness: 150, damping: 15 });

  // Real-time audio analysis loop
  useEffect(() => {
    let rafId: number;
    const update = () => {
      if (engineRef?.current) {
        const level = engineRef.current.getRMSLevel();
        const data = engineRef.current.getByteFrequencyData();
        
        // Use a small amount of smoothing for the RMS level to prevent jitter
        setRms(prev => prev * 0.7 + level * 0.3);
        setFreqData(data);
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [engineRef]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current || e.buttons !== 1) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;
    
    // Constraint to circle
    const distance = Math.sqrt(x * x + y * y);
    const maxRadius = cx - 20;
    
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
    const newElevation = Math.max(0, Math.min(1, elevation - e.deltaY * 0.001));
    setElevation(newElevation);
    springScale.set(0.8 + newElevation * 0.5);
  };

  // Calculate frequency-based grid brightness (taking average of low/mid bands)
  const getBandEnergy = (start: number, end: number) => {
    if (freqData.length === 0) return 0;
    const slice = freqData.slice(start, end);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / slice.length / 255;
  };

  const lowEnergy = getBandEnergy(0, 10);
  const midEnergy = getBandEnergy(10, 50);

  return (
    <div className="radar-container" onWheel={handleScroll}>
      <div className="radar-header">
        <span className="radar-title">CELESTIAL RADAR</span>
        <div className="radar-stats">
          <span>AZM: {Math.round((Math.atan2(position.y, position.x) * 180 / Math.PI + 450) % 360)}°</span>
          <span>ELV: {Math.round(elevation * 100)}%</span>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="radar-surface"
        onPointerMove={handlePointerMove}
      >
        {/* Background Grid */}
        <svg className="radar-grid">
          <defs>
            <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--mixx-accent)" stopOpacity={0.1 + rms * 0.4} />
              <stop offset="100%" stopColor="var(--mixx-bg)" stopOpacity="0" />
            </radialGradient>
            <filter id="chromatic-aberration">
              <feOffset in="SourceGraphic" dx="1" dy="0" result="red" />
              <feOffset in="SourceGraphic" dx="-1" dy="0" result="blue" />
              <feBlend in="red" in2="blue" mode="screen" />
            </filter>
          </defs>
          
          <circle cx="50%" cy="50%" r="48%" fill="url(#radar-glow)" />
          
          {[0.2, 0.4, 0.6, 0.8].map((r, i) => {
            const pulseIntensity = i === 0 ? lowEnergy : (i === 1 ? midEnergy : rms);
            return (
              <circle 
                key={r}
                cx="50%" 
                cy="50%" 
                r={`${r * 50}%`} 
                className="grid-ring"
                style={{ 
                  opacity: 0.2 + pulseIntensity * 0.5,
                  strokeWidth: 1 + pulseIntensity * 2
                }}
              />
            );
          })}
          
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <line 
              key={angle}
              x1="50%" y1="50%"
              x2={`${50 + 48 * Math.cos(angle * Math.PI / 180)}%`}
              y2={`${50 + 48 * Math.sin(angle * Math.PI / 180)}%`}
              className="grid-line"
              style={{ opacity: 0.1 + midEnergy * 0.3 }}
            />
          ))}
          
          {/* Scanning Sweep */}
          <motion.path
            d="M 50% 50% L 50% 2%"
            className="radar-sweep"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{ 
              transformOrigin: "center",
              opacity: 0.3 + rms * 0.7
            }}
          />
        </svg>

        {/* The Sound Source Orb */}
        <motion.div
          className="source-orb"
          style={{
            x: springX,
            y: springY,
            scale: springScale,
            filter: `drop-shadow(0 0 ${10 + elevation * 20 + rms * 30}px var(--mixx-accent))`
          }}
        >
          <div className="orb-inner" style={{ transform: `scale(${1 + rms * 0.2})` }}>
            <div className="orb-glint" />
          </div>
          <div className="orb-label" style={{ opacity: 0.5 + rms * 0.5 }}>SOURCE_01</div>
          
          {/* Sonic Pulse Rings */}
          <motion.div 
            className="orb-pulse"
            animate={{ 
              scale: [1, 1.5 + rms * 3],
              opacity: [0.6, 0] 
            }}
            transition={{ 
              duration: 1.5 - rms * 0.5, 
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        </motion.div>

        {/* Interaction Hint */}
        <div className="radar-hint">DRAG TO PAN | SCROLL FOR ELEVATION</div>
      </div>
    </div>
  );
};
