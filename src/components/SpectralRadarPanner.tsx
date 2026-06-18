import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { nativeAudio, SpectralDataState } from '@/native/bridge';
import { Navigation } from 'lucide-react';
import './SpectralRadarPanner.css';

interface Point {
  x: number;
  y: number;
}

interface SpectralRadarPannerProps {
  spectralData?: SpectralDataState | null;
}

export const SpectralRadarPanner: React.FC<SpectralRadarPannerProps> = ({ spectralData }) => {
  const [position, setPosition] = useState<Point>({ x: 0, y: -60 }); // Default north
  const [elevation, setElevation] = useState(0.5); 
  const [rms, setRms] = useState(0);
  const [freqData, setFreqData] = useState<Uint8Array>(new Uint8Array(64));
  const containerRef = useRef<HTMLDivElement>(null);
  const lastBridgeCall = useRef<number>(0);
  
  // High-fidelity spring physics
  const springX = useSpring(0, { stiffness: 80, damping: 25 });
  const springY = useSpring(0, { stiffness: 80, damping: 25 });
  const springZ = useSpring(0.5, { stiffness: 120, damping: 20 });
  const springRotateX = useSpring(65, { stiffness: 50, damping: 30 }); // Tilt it more for a map feel
  const springRotateZ = useSpring(0, { stiffness: 30, damping: 40 }); // Slow rotation

  // Mock audio engine
  useEffect(() => {
    if (spectralData) return;

    let rafId: number;
    let frame = 0;
    const update = () => {
      frame++;
      
      const mockLevel = (Math.sin(frame * 0.05) * 0.4 + 0.6) * (0.1 + Math.random() * 0.05);
      setRms(prev => prev * 0.85 + mockLevel * 0.15);
      
      const newData = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        const freqWeight = Math.exp(-Math.abs(i - 10) / 10) * 2;
        const highWeight = Math.exp(-Math.abs(i - 40) / 15) * 1.5;
        newData[i] = (Math.sin(frame * 0.15 + i * 0.2) * 40 + 60) * (freqWeight + highWeight) * (0.8 + mockLevel);
      }
      setFreqData(newData);
      
      // Slowly rotate the astrolabe
      springRotateZ.set(frame * 0.1);

      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [spectralData]);

  // Phase 4: Consume real FFT data
  useEffect(() => {
    if (!spectralData) return;
    setRms(spectralData.rms);
    setFreqData(spectralData.fftBins);
  }, [spectralData]);

  // Bi-directional JUCE param sync
  useEffect(() => {
    const unsubscribe = nativeAudio.subscribeToParams((paramId, value) => {
      if (paramId === 'radar_azimuth') {
        const az = Number(value);
        const r = 60; // visual radius
        const rad = (az - 90) * Math.PI / 180;
        const newX = r * Math.cos(rad);
        const newY = r * Math.sin(rad);
        setPosition({ x: newX, y: newY });
        springX.set(newX);
        springY.set(newY);
      } else if (paramId === 'radar_elevation') {
        const el = Number(value);
        setElevation(el);
        springZ.set(el);
      }
    });
    return () => { unsubscribe(); };
  }, [springX, springY, springZ]);

  // Pointer dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePosition(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    if (e.buttons !== 1 && !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updatePosition(e);
  };

  const updatePosition = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 200 - 100;
    const y = ((e.clientY - rect.top) / rect.height) * 200 - 100;

    const distance = Math.sqrt(x * x + y * y);
    const maxRadius = 90; // Keep it within the rings

    let targetX = x;
    let targetY = y;

    if (distance > maxRadius) {
      const angle = Math.atan2(y, x);
      targetX = maxRadius * Math.cos(angle);
      targetY = maxRadius * Math.sin(angle);
    }

    setPosition({ x: targetX, y: targetY });
    springX.set(targetX);
    springY.set(targetY);

    const azimuth = (Math.atan2(targetY, targetX) * 180 / Math.PI + 450) % 360;
    
    // Throttle bridge calls
    const now = performance.now();
    if (now - lastBridgeCall.current > 33) {
      nativeAudio.updateSpatialPosition(azimuth, elevation, 'NORTH_STAR');
      lastBridgeCall.current = now;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const newElevation = Math.max(0, Math.min(1, elevation - e.deltaY * 0.001));
    setElevation(newElevation);
    springZ.set(newElevation);
    
    // Update audio engine on scroll
    const azimuth = (Math.atan2(position.y, position.x) * 180 / Math.PI + 450) % 360;
    const now = performance.now();
    if (now - lastBridgeCall.current > 33) {
      nativeAudio.updateSpatialPosition(azimuth, newElevation, 'NORTH_STAR');
      lastBridgeCall.current = now;
    }
  };


  return (
    <div className="spectral-radar-3d-wrapper" onWheel={handleScroll}>
      
      {/* Floating Holographic HUD */}
      <div className="holographic-hud">
        <div className="hud-metric">
          <span className="label">AZIMUTH</span>
          <span className="value">{Math.round((Math.atan2(position.y, position.x) * 180 / Math.PI + 450) % 360)}°</span>
        </div>
        <div className="hud-metric">
          <span className="label">ELEVATION</span>
          <span className="value">{Math.round(elevation * 100)}%</span>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="radar-scene"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Massive 3D Astrolabe Surface */}
        <motion.div 
          className="radar-surface-3d"
          style={{ 
            rotateX: springRotateX,
            rotateZ: springRotateZ,
            perspective: '1500px'
          }}
        >
          {/* Background Grid & Rings */}
          <div className="radar-floor">
            <div className="floor-grid" />
            <div className="floor-axis vertical" />
            <div className="floor-axis horizontal" />
            
            {[0.2, 0.4, 0.6, 0.8].map((r, i) => (
              <div 
                key={i} 
                className="floor-ring" 
                style={{ 
                  width: `${r * 100}%`, 
                  height: `${r * 100}%`,
                  opacity: 0.2 + rms * 0.3
                }} 
              />
            ))}
          </div>


          {/* Volumetric Pillar & Star Shadow (Static on floor, follows star X/Y) */}
          <motion.div
            className="star-floor-shadow"
            style={{
              left: useTransform(springX, x => `${50 + x/2}%`),
              top: useTransform(springY, y => `${50 + y/2}%`),
            }}
          />
          <motion.div 
            className="elevation-pillar"
            style={{
              left: useTransform(springX, x => `${50 + x/2}%`),
              top: useTransform(springY, y => `${50 + y/2}%`),
              height: useTransform(springZ, z => `${z * 100}px`),
            }}
          />

          {/* Sound Source Node (Floats on Z axis) */}
          <motion.div
            className="divine-source-star"
            style={{
              left: useTransform(springX, x => `${50 + x/2}%`),
              top: useTransform(springY, y => `${50 + y/2}%`),
              translateZ: useTransform(springZ, z => `${z * 100}px`),
              scale: useTransform(springZ, z => 0.8 + z * 0.6)
            }}
          >
            <div className="northstar-node">
              <Navigation 
                size={32} 
                className="northstar-icon" 
                style={{ 
                  transform: `rotate(${Math.atan2(position.y, position.x) * 180 / Math.PI + 90}deg)`,
                  filter: `drop-shadow(0 0 ${10 + rms * 30}px var(--mixx-accent))`
                }} 
              />
            </div>
            <div className="star-id">NORTH_STAR</div>
          </motion.div>

        </motion.div>

        <div className="radar-overlay-hints">
          <span>DRAG STAR TO PAN</span>
          <span>SCROLL TO ASCEND</span>
        </div>
      </div>
    </div>
  );
};
