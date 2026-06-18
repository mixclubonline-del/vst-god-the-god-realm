import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { electricPantheonGods, type ElectricPantheonGod } from '@/data/electricPantheonGods';
import { nativeAudio } from '@/native/bridge';

interface PantheonVortexPadProps {
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export const PantheonVortexPad: React.FC<PantheonVortexPadProps> = ({
  parameterValues,
  update,
  onClose,
  isEmbedded = false,
}) => {
  const padRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Read current parameters (default to 0.5, 0.5)
  const xVal = parameterValues.pantheonVortexX !== undefined ? Number(parameterValues.pantheonVortexX) : 0.5;
  const yVal = parameterValues.pantheonVortexY !== undefined ? Number(parameterValues.pantheonVortexY) : 0.5;

  // Deities octagon coordinates (scaled to 0-1)
  const vertices = [
    { id: 'olympus', name: 'Olympus', x: 1.0, y: 0.5, color: '#f8c85a' },
    { id: 'hades', name: 'Hades', x: 0.85355, y: 0.85355, color: '#d64b35' },
    { id: 'zeus', name: 'Zeus', x: 0.5, y: 1.0, color: '#4ecbff' },
    { id: 'athena', name: 'Athena', x: 0.14645, y: 0.85355, color: '#9d65ff' },
    { id: 'poseidon', name: 'Poseidon', x: 0.0, y: 0.5, color: '#29d7e8' },
    { id: 'titan', name: 'Titan', x: 0.14645, y: 0.14645, color: '#ff9f2f' },
    { id: 'apollo', name: 'Apollo', x: 0.5, y: 0.0, color: '#ffd45a' },
    { id: 'chronos', name: 'Chronos', x: 0.85355, y: 0.14645, color: '#7cff9d' },
  ];

  // Calculate weights based on Inverse Distance Weighting
  const getWeights = useCallback((px: number, py: number) => {
    const dSq = vertices.map((v) => {
      const dx = px - v.x;
      const dy = py - v.y;
      return dx * dx + dy * dy;
    });

    const epsilon = 0.00001;
    const exactMatch = dSq.findIndex((d) => d < epsilon);

    if (exactMatch !== -1) {
      return vertices.map((_, i) => (i === exactMatch ? 1.0 : 0.0));
    }

    const weights = dSq.map((d) => 1.0 / d);
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => w / sum);
  }, []);

  const weights = getWeights(xVal, yVal);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging && e.buttons !== 1) return;
    if (!padRef.current) return;

    const rect = padRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = 1.0 - (e.clientY - rect.top) / rect.height; // invert Y for Cartesian

    const boundedX = Math.min(1.0, Math.max(0.0, rawX));
    const boundedY = Math.min(1.0, Math.max(0.0, rawY));

    // Update state & native JUCE layer
    update('pantheonVortexX', boundedX);
    update('pantheonVortexY', boundedY);
    nativeAudio.setParameter('pantheonVortexX', boundedX);
    nativeAudio.setParameter('pantheonVortexY', boundedY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Convert normalized 0-1 values to percentage coordinates for HTML overlay
  const toPercentage = (val: number) => `${val * 100}%`;
  const toPercentageY = (val: number) => `${(1.0 - val) * 100}%`; // Invert Y back for DOM layout (top: 0 is top)

  return (
    <div className={`vortex-pad-container ${isEmbedded ? 'vortex-pad-container--embedded' : ''}`}>
      {!isEmbedded && (
        <div className="vortex-pad-header">
          <h3>PANTHEON VORTEX MORPHER</h3>
          <p className="vortex-subtitle">
            Blend the elements. Drag the nexus node to dynamically morph between the 8 deities.
          </p>
          <button className="vortex-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
      )}

      <div
        className="vortex-pad-area"
        ref={padRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Octagonal Grid Lines */}
        <svg className="vortex-grid-svg">
          <polygon
            points={vertices.map((v) => `${v.x * 100},${(1.0 - v.y) * 100}`).join(' ')}
            className="vortex-outer-ring"
          />
          {/* Inner spokes */}
          {vertices.map((v, i) => (
            <line
              key={`spoke-${i}`}
              x1="50"
              y1="50"
              x2={v.x * 100}
              y2={(1.0 - v.y) * 100}
              className="vortex-spoke-line"
            />
          ))}
          {/* Concentric rings */}
          <circle cx="50" cy="50" r="35" className="vortex-inner-ring" />
          <circle cx="50" cy="50" r="20" className="vortex-inner-ring" />
          <circle cx="50" cy="50" r="5" className="vortex-inner-ring" />
        </svg>

        {/* Deity Nodes */}
        {vertices.map((v, i) => {
          const w = weights[i];
          const godInfo = electricPantheonGods.find((g) => g.id === v.id);
          const icon = godInfo?.icon || '🏛';
          
          return (
            <div
              key={v.id}
              className="vortex-god-node"
              style={{
                left: toPercentage(v.x),
                top: toPercentageY(v.y),
                '--god-color': v.color,
                transform: `translate(-50%, -50%) scale(${1.0 + w * 0.4})`,
                boxShadow: `0 0 ${10 + w * 25}px ${v.color}`,
                opacity: 0.35 + w * 0.65,
              } as React.CSSProperties}
            >
              <div className="vortex-node-icon">{icon}</div>
              <div className="vortex-node-label">
                <span className="vortex-node-name">{v.name}</span>
                <span className="vortex-node-weight">{Math.round(w * 100)}%</span>
              </div>
            </div>
          );
        })}

        {/* Current Blend Cursor (Nexus Node) */}
        <motion.div
          className="vortex-cursor"
          animate={{
            left: toPercentage(xVal),
            top: toPercentageY(yVal),
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <div className="vortex-cursor-pulse" />
          <div className="vortex-cursor-center" />
        </motion.div>
      </div>

      {/* Proximity / Status Bar */}
      <div className="vortex-stats">
        <div className="vortex-stats-labels">
          {vertices.map((v, i) => {
            const w = weights[i];
            if (w < 0.05) return null;
            return (
              <div key={v.id} className="vortex-stat-item" style={{ color: v.color }}>
                <span className="dot" style={{ backgroundColor: v.color }} />
                <span className="name">{v.name}:</span>
                <span className="value">{Math.round(w * 100)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
