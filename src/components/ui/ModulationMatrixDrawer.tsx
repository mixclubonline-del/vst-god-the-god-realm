import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModulationMatrixDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
}

const SOURCES = [
  { id: 0, name: 'None', color: '#6b7280' },
  { id: 1, name: 'LFO 1', color: '#ffb000' },
  { id: 2, name: 'LFO 2', color: '#ff7700' },
  { id: 3, name: 'Aftertouch', color: '#3b82f6' },
  { id: 4, name: 'Mod Wheel', color: '#10b981' }
];

const TARGETS = [
  { id: 0, name: 'None', color: '#6b7280' },
  { id: 1, name: 'Sampler Decay', color: '#ec4899' },
  { id: 2, name: 'Filter Cutoff', color: '#a855f7' },
  { id: 3, name: 'Saturation Warmth', color: '#f43f5e' },
  { id: 4, name: 'FM Energy', color: '#eab308' }
];

const LFO_SHAPES = [
  { id: 0, name: 'Sine' },
  { id: 1, name: 'Triangle' },
  { id: 2, name: 'Saw' },
  { id: 3, name: 'Square' },
  { id: 4, name: 'S&H' }
];

export const ModulationMatrixDrawer: React.FC<ModulationMatrixDrawerProps> = ({
  isOpen,
  onClose,
  parameterValues,
  update
}) => {
  // LFO Parameter values
  const lfo1Rate = parameterValues.lfo1Rate ?? 1.0;
  const lfo2Rate = parameterValues.lfo2Rate ?? 1.0;
  const lfo1Shape = parameterValues.lfo1Shape ?? 0;
  const lfo2Shape = parameterValues.lfo2Shape ?? 0;

  // LFO Phase trackers for animation
  const [phase1, setPhase1] = useState(0);
  const [phase2, setPhase2] = useState(0);

  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  // Animating the LFO preview waveforms
  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== null) {
        const deltaTime = (time - previousTimeRef.current) / 1000;
        setPhase1((prev) => (prev + deltaTime * lfo1Rate) % 1.0);
        setPhase2((prev) => (prev + deltaTime * lfo2Rate) % 1.0);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    if (isOpen) {
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      previousTimeRef.current = null;
    };
  }, [isOpen, lfo1Rate, lfo2Rate]);

  // Handle HTML5 drag start
  const handleDragStart = (e: React.DragEvent, sourceId: number) => {
    e.dataTransfer.setData('text/plain', sourceId.toString());
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle HTML5 drop on target slot
  const handleDrop = (e: React.DragEvent, slotIdx: number) => {
    e.preventDefault();
    const sourceIdStr = e.dataTransfer.getData('text/plain');
    const sourceId = parseInt(sourceIdStr, 10);
    if (!isNaN(sourceId) && sourceId >= 0 && sourceId <= 4) {
      update(`modSource_${slotIdx}`, sourceId);
      // Auto-assign target if None
      const currentTarget = parameterValues[`modTarget_${slotIdx}`] ?? 0;
      if (currentTarget === 0) {
        update(`modTarget_${slotIdx}`, 2); // Default to Filter Cutoff
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Generate SVG path for previewing LFO shape
  const getLFOWaveformPath = (shape: number, currentPhase: number, rate: number): string => {
    const width = 180;
    const height = 45;
    const midY = height / 2;
    const amp = height * 0.4;
    const points: string[] = [];

    // Draw LFO preview path
    for (let x = 0; x <= width; x += 2) {
      const t = (x / width) * 2.5 + currentPhase * 3.0; // Show ~2.5 cycles
      let y = 0;

      switch (shape) {
        case 0: // Sine
          y = Math.sin(t * 2 * Math.PI);
          break;
        case 1: // Triangle
          y = 1.0 - 4.0 * Math.abs(((t + 0.25) % 1.0) - 0.5);
          break;
        case 2: // Saw
          y = 2.0 * (t % 1.0) - 1.0;
          break;
        case 3: // Square
          y = (t % 1.0) < 0.5 ? 1.0 : -1.0;
          break;
        case 4: // S&H (Step approximation using cosine/sine frequency boundaries)
          const stepIdx = Math.floor(t * 1.5);
          const randVal = Math.sin(stepIdx * 782.13 + Math.cos(stepIdx * 12.39));
          y = Math.max(-1.0, Math.min(1.0, randVal * 1.2));
          break;
        default:
          y = 0;
      }

      const pointY = midY - y * amp;
      points.push(`${x === 0 ? 'M' : 'L'} ${x} ${pointY}`);
    }

    return points.join(' ');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            className="mod-matrix-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sliding Drawer */}
          <motion.div
            className="mod-matrix-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 22, stiffness: 150 }}
          >
            {/* Drawer Header */}
            <div className="mod-matrix-header">
              <div className="mod-matrix-title">
                <span className="gold-glowing-text">GLOBAL MODULATION MATRIX</span>
                <span className="mod-matrix-subtitle">Phase 6 Sacred Router</span>
              </div>
              <button className="mod-matrix-close" onClick={onClose}>
                ✕
              </button>
            </div>

            <div className="mod-matrix-body">
              {/* LFO 1 & LFO 2 Control Center */}
              <div className="mod-matrix-lfos-panel">
                <div className="mod-panel-title">DIVINE OSCILLATORS</div>
                
                {/* LFO 1 */}
                <div className="mod-lfo-row">
                  <div className="mod-lfo-header">
                    <span className="lfo-label lfo-color-1">LFO 1</span>
                    <div className="lfo-shape-buttons">
                      {LFO_SHAPES.map((shape) => (
                        <button
                          key={shape.id}
                          className={`lfo-shape-btn ${lfo1Shape === shape.id ? 'active-1' : ''}`}
                          onClick={() => update('lfo1Shape', shape.id)}
                        >
                          {shape.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mod-lfo-controls">
                    <div className="lfo-wave-preview">
                      <svg width="100%" height="100%" viewBox="0 0 180 45" preserveAspectRatio="none">
                        <path
                          d={getLFOWaveformPath(lfo1Shape, phase1, lfo1Rate)}
                          fill="none"
                          stroke="#ffb000"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div className="lfo-knob-container">
                      <span className="knob-title">RATE (Hz)</span>
                      <input
                        type="range"
                        min="0.1"
                        max="50.0"
                        step="0.1"
                        value={lfo1Rate}
                        onChange={(e) => update('lfo1Rate', parseFloat(e.target.value))}
                        className="lfo-rate-slider glow-orange"
                      />
                      <span className="knob-value">{lfo1Rate.toFixed(1)} Hz</span>
                    </div>
                  </div>
                </div>

                {/* LFO 2 */}
                <div className="mod-lfo-row">
                  <div className="mod-lfo-header">
                    <span className="lfo-label lfo-color-2">LFO 2</span>
                    <div className="lfo-shape-buttons">
                      {LFO_SHAPES.map((shape) => (
                        <button
                          key={shape.id}
                          className={`lfo-shape-btn ${lfo2Shape === shape.id ? 'active-2' : ''}`}
                          onClick={() => update('lfo2Shape', shape.id)}
                        >
                          {shape.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mod-lfo-controls">
                    <div className="lfo-wave-preview">
                      <svg width="100%" height="100%" viewBox="0 0 180 45" preserveAspectRatio="none">
                        <path
                          d={getLFOWaveformPath(lfo2Shape, phase2, lfo2Rate)}
                          fill="none"
                          stroke="#ff7700"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div className="lfo-knob-container">
                      <span className="knob-title">RATE (Hz)</span>
                      <input
                        type="range"
                        min="0.1"
                        max="50.0"
                        step="0.1"
                        value={lfo2Rate}
                        onChange={(e) => update('lfo2Rate', parseFloat(e.target.value))}
                        className="lfo-rate-slider glow-red"
                      />
                      <span className="knob-value">{lfo2Rate.toFixed(1)} Hz</span>
                    </div>
                  </div>
                </div>

                {/* Drag-to-Map Sources Palette */}
                <div className="drag-sources-palette">
                  <span className="palette-title">DRAG SOURCE TO SLOTS:</span>
                  <div className="palette-items">
                    {SOURCES.slice(1).map((src) => (
                      <div
                        key={src.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, src.id)}
                        className="drag-source-badge"
                        style={{ '--badge-color': src.color } as React.CSSProperties}
                      >
                        {src.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4 Routing Slots Modulation Table */}
              <div className="mod-matrix-slots-panel">
                <div className="mod-panel-title">MODULATION MATRIX SLOTS</div>

                <div className="mod-slots-grid">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const activeSrc = parameterValues[`modSource_${slotIdx}`] ?? 0;
                    const activeTgt = parameterValues[`modTarget_${slotIdx}`] ?? 0;
                    const amount = parameterValues[`modAmount_${slotIdx}`] ?? 0.0;

                    const srcObj = SOURCES.find((s) => s.id === activeSrc) || SOURCES[0];
                    const tgtObj = TARGETS.find((t) => t.id === activeTgt) || TARGETS[0];

                    return (
                      <div
                        key={slotIdx}
                        className={`mod-matrix-slot ${activeSrc > 0 && activeTgt > 0 ? 'slot-connected' : ''}`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, slotIdx)}
                      >
                        <div className="slot-index-badge">SLOT {slotIdx + 1}</div>

                        <div className="slot-connector-flow">
                          {/* Source Dropdown */}
                          <div className="slot-selector-wrap">
                            <span className="selector-label">SOURCE</span>
                            <select
                              value={activeSrc}
                              onChange={(e) => update(`modSource_${slotIdx}`, parseInt(e.target.value))}
                              className="slot-dropdown"
                              style={{ color: srcObj.color }}
                            >
                              {SOURCES.map((s) => (
                                <option key={s.id} value={s.id} style={{ color: s.color }}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="connector-arrow">⇾</div>

                          {/* Target Dropdown */}
                          <div className="slot-selector-wrap">
                            <span className="selector-label">TARGET</span>
                            <select
                              value={activeTgt}
                              onChange={(e) => update(`modTarget_${slotIdx}`, parseInt(e.target.value))}
                              className="slot-dropdown"
                              style={{ color: tgtObj.color }}
                            >
                              {TARGETS.map((t) => (
                                <option key={t.id} value={t.id} style={{ color: t.color }}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Modulation Depth Fader */}
                        <div className="slot-depth-control">
                          <div className="depth-labels">
                            <span>DEPTH</span>
                            <span className="depth-val">{Math.round(amount * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="-1.0"
                            max="1.0"
                            step="0.01"
                            value={amount}
                            disabled={activeSrc === 0 || activeTgt === 0}
                            onChange={(e) => update(`modAmount_${slotIdx}`, parseFloat(e.target.value))}
                            className="depth-range-slider"
                            style={{
                              '--slider-glow': tgtObj.color
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
