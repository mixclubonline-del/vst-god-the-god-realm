/**
 * DivineMorphOverlay.tsx — The Sacred Crossfade
 * Floating overlay for blending between two gods.
 * X-axis controls the blend ratio, Y-axis controls morph speed.
 */

import React, { useState, useCallback } from 'react';
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

  const activeGod = gods.find((g) => g.id === activeGodId) || gods[0];
  const targetGod = gods.find((g) => g.id === targetGodId) || gods[1];

  const handleApply = useCallback(() => {
    onMorphApply(activeGodId, targetGodId, blendAmount);
  }, [activeGodId, targetGodId, blendAmount, onMorphApply]);

  const handleBlendChange = useCallback((val: number) => {
    setBlendAmount(val);
    onMorphPreview?.(activeGodId, targetGodId, val);
  }, [activeGodId, targetGodId, onMorphPreview]);

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
                <span className="ep-morph-blend-percent">{blendAmount}%</span>
              </div>

              {/* Target God Selector */}
              <div className="ep-morph-god-card ep-morph-god-card--target">
                <select
                  className="ep-morph-target-select"
                  value={targetGodId}
                  onChange={(e) => setTargetGodId(e.target.value as ElectricPantheonGodId)}
                >
                  {gods
                    .filter((g) => g.id !== activeGodId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.icon} {g.name}
                      </option>
                    ))}
                </select>
                <span className="ep-morph-god-label">TARGET</span>
              </div>
            </div>

            {/* Blend Slider */}
            <div className="ep-morph-slider-group">
              <label className="ep-morph-slider-label">BLEND</label>
              <input
                type="range"
                min={0}
                max={100}
                value={blendAmount}
                onChange={(e) => handleBlendChange(Number(e.target.value))}
                className="ep-morph-slider"
                style={{
                  background: `linear-gradient(90deg, ${activeGod.colors.primary} ${blendAmount}%, ${targetGod.colors.primary} ${blendAmount}%)`,
                }}
              />
            </div>

            {/* Morph Speed */}
            <div className="ep-morph-slider-group">
              <label className="ep-morph-slider-label">MORPH SPEED</label>
              <input
                type="range"
                min={0}
                max={100}
                value={morphSpeed}
                onChange={(e) => setMorphSpeed(Number(e.target.value))}
                className="ep-morph-slider"
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
