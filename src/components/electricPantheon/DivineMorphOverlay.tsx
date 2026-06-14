/**
 * DivineMorphOverlay.tsx — The Sacred Crossfade
 * Floating overlay for blending between two gods.
 * X-axis controls the blend ratio, Y-axis controls morph speed.
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ElectricPantheonGod, ElectricPantheonGodId } from '@/data/electricPantheonGods';

interface DivineMorphOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  gods: ElectricPantheonGod[];
  activeGodId: ElectricPantheonGodId;
  onMorphApply: (fromId: ElectricPantheonGodId, toId: ElectricPantheonGodId, blend: number) => void;
  onMorphPreview?: (fromId: ElectricPantheonGodId, toId: ElectricPantheonGodId, blend: number) => void;
}

/* ── Custom Divine Slider ── */
interface DivineSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  trackBackground: string;
  thumbColor: string;
  thumbGlow: string;
}

const DivineSlider: React.FC<DivineSliderProps> = ({
  value,
  min,
  max,
  onChange,
  trackBackground,
  thumbColor,
  thumbGlow,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const pct = ((value - min) / (max - min)) * 100;

  const calcValue = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return value;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(min + ratio * (max - min));
    },
    [min, max, value]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
      onChange(calcValue(e.clientX));
    },
    [calcValue, onChange]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      onChange(calcValue(e.clientX));
    },
    [dragging, calcValue, onChange]
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div
      ref={trackRef}
      className="ep-morph-divine-slider"
      style={{ background: trackBackground }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="ep-morph-divine-thumb"
        style={{
          left: `${pct}%`,
          background: thumbColor,
          boxShadow: `0 0 10px ${thumbGlow}, 0 0 20px ${thumbGlow}40`,
          transform: `translateX(-50%) scale(${dragging ? 1.25 : 1})`,
        }}
      />
    </div>
  );
};

export const DivineMorphOverlay: React.FC<DivineMorphOverlayProps> = ({
  isOpen,
  onClose,
  gods,
  activeGodId,
  onMorphApply,
  onMorphPreview,
}) => {
  const [targetGodId, setTargetGodId] = useState<ElectricPantheonGodId>(
    gods.find((g) => g.id !== activeGodId)?.id || 'hades'
  );
  const [blendAmount, setBlendAmount] = useState(50);
  const [morphSpeed, setMorphSpeed] = useState(50);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [blendDragging, setBlendDragging] = useState(false);

  const activeGod = gods.find((g) => g.id === activeGodId) || gods[0];
  const targetGod = gods.find((g) => g.id === targetGodId) || gods[1];
  const availableGods = gods.filter((g) => g.id !== activeGodId);

  const handleApply = useCallback(() => {
    onMorphApply(activeGodId, targetGodId, blendAmount);
  }, [activeGodId, targetGodId, blendAmount, onMorphApply]);

  const handleBlendChange = useCallback((val: number) => {
    setBlendAmount(val);
    onMorphPreview?.(activeGodId, targetGodId, val);
  }, [activeGodId, targetGodId, onMorphPreview]);

  const handleSelectTarget = useCallback((id: ElectricPantheonGodId) => {
    setTargetGodId(id);
    setDropdownOpen(false);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ep-morph-overlay-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <motion.div
            className="ep-morph-overlay"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="ep-morph-header">
              <span className="ep-morph-title">🌀 DIVINE MORPH</span>
              <button className="ep-morph-close" onClick={onClose}>✕</button>
            </div>

            {/* God Selection Row */}
            <div className="ep-morph-gods">
              {/* Source God */}
              <div className="ep-morph-god-card ep-morph-god-card--source">
                <span className="ep-morph-god-icon">{activeGod.icon}</span>
                <span className="ep-morph-god-name">{activeGod.name}</span>
                <span className="ep-morph-god-label">SOURCE</span>
              </div>

              {/* Blend Visual */}
              <div className="ep-morph-blend-visual">
                <motion.div
                  className="ep-morph-blend-line"
                  style={{
                    background: `linear-gradient(90deg, ${activeGod.colors.primary}, ${targetGod.colors.primary})`,
                  }}
                />
                <motion.span
                  className="ep-morph-blend-percent"
                  animate={blendDragging ? { textShadow: [
                    `0 0 8px ${activeGod.colors.primary}80, 0 0 16px ${targetGod.colors.primary}60`,
                    `0 0 16px ${activeGod.colors.primary}CC, 0 0 30px ${targetGod.colors.primary}AA`,
                    `0 0 8px ${activeGod.colors.primary}80, 0 0 16px ${targetGod.colors.primary}60`,
                  ] } : {}}
                  transition={blendDragging ? { duration: 1.2, repeat: Infinity } : {}}
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    background: `linear-gradient(90deg, ${activeGod.colors.primary}, ${targetGod.colors.primary})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    textShadow: 'none',
                  }}
                >
                  {blendAmount}%
                </motion.span>
              </div>

              {/* Target God — Custom Dropdown */}
              <div className="ep-morph-god-card ep-morph-god-card--target" style={{ position: 'relative' }}>
                <button
                  className="ep-morph-god-dropdown-trigger"
                  onClick={() => setDropdownOpen((v) => !v)}
                  style={{ borderLeftColor: targetGod.colors.primary }}
                >
                  <span className="ep-morph-god-dropdown-stripe" style={{ background: targetGod.colors.primary }} />
                  <span style={{ fontSize: 18 }}>{targetGod.icon}</span>
                  <span className="ep-morph-god-dropdown-name">{targetGod.name}</span>
                  <span style={{ fontSize: 10, opacity: 0.4, marginLeft: 'auto' }}>▾</span>
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <>
                      {/* Backdrop to close dropdown on outside click */}
                      <div
                        className="ep-morph-god-dropdown-backdrop"
                        onClick={() => setDropdownOpen(false)}
                      />
                      <motion.div
                        className="ep-morph-god-dropdown"
                        initial={{ opacity: 0, y: -6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                      >
                        {availableGods.map((g) => (
                          <button
                            key={g.id}
                            className={`ep-morph-god-option${g.id === targetGodId ? ' ep-morph-god-option--active' : ''}`}
                            onClick={() => handleSelectTarget(g.id)}
                          >
                            <span
                              className="ep-morph-god-option-stripe"
                              style={{ background: g.colors.primary }}
                            />
                            <span style={{ fontSize: 16 }}>{g.icon}</span>
                            <span className="ep-morph-god-option-name">{g.name}</span>
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                <span className="ep-morph-god-label">TARGET</span>
              </div>
            </div>

            {/* Blend Slider */}
            <div className="ep-morph-slider-group">
              <label className="ep-morph-slider-label">BLEND</label>
              <DivineSlider
                value={blendAmount}
                min={0}
                max={100}
                onChange={(val) => {
                  setBlendDragging(true);
                  handleBlendChange(val);
                }}
                trackBackground={`linear-gradient(90deg, ${activeGod.colors.primary}, ${targetGod.colors.primary})`}
                thumbColor={`color-mix(in srgb, ${activeGod.colors.primary} ${100 - blendAmount}%, ${targetGod.colors.primary})`}
                thumbGlow={`color-mix(in srgb, ${activeGod.colors.primary} ${100 - blendAmount}%, ${targetGod.colors.primary})`}
              />
            </div>

            {/* Morph Speed */}
            <div className="ep-morph-slider-group">
              <label className="ep-morph-slider-label">MORPH SPEED</label>
              <DivineSlider
                value={morphSpeed}
                min={0}
                max={100}
                onChange={setMorphSpeed}
                trackBackground={`linear-gradient(90deg, ${activeGod.colors.primary}20, ${activeGod.colors.primary})`}
                thumbColor={activeGod.colors.primary}
                thumbGlow={activeGod.colors.primary}
              />
            </div>

            {/* Apply Button */}
            <motion.button
              className="ep-morph-apply"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleApply}
              style={{
                background: `linear-gradient(135deg, ${activeGod.colors.primary}, ${targetGod.colors.primary})`,
              }}
            >
              APPLY DIVINE MORPH
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
