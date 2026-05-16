/**
 * GodSelector.tsx — The Sacred Registry Panel
 * Left-side god selection cards for the Electric Pantheon.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ElectricPantheonGod, ElectricPantheonGodId } from '@/data/electricPantheonGods';

interface GodSelectorProps {
  gods: ElectricPantheonGod[];
  activeGodId: ElectricPantheonGodId;
  onSelectGod: (id: ElectricPantheonGodId) => void;
  onOpenMorph: () => void;
}

export const GodSelector: React.FC<GodSelectorProps> = ({
  gods,
  activeGodId,
  onSelectGod,
  onOpenMorph,
}) => {
  return (
    <div className="ep-god-selector">
      <div className="ep-god-selector-header">
        <span className="ep-god-selector-title">PANTHEON</span>
        <span className="ep-god-selector-count">{gods.length} GODS</span>
      </div>

      <div className="ep-god-selector-list">
        {gods.map((god, i) => {
          const isActive = god.id === activeGodId;
          return (
            <motion.button
              key={god.id}
              className={`ep-god-card ${isActive ? 'ep-god-card--active' : ''}`}
              onClick={() => onSelectGod(god.id)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              style={{
                '--god-primary': god.colors.primary,
                '--god-secondary': god.colors.secondary,
                '--god-accent': god.colors.accent,
              } as React.CSSProperties}
            >
              {/* Active indicator stripe */}
              <div className="ep-god-card-stripe" />

              {/* God icon */}
              <span className="ep-god-card-icon">{god.icon}</span>

              {/* God info */}
              <div className="ep-god-card-info">
                <span className="ep-god-card-name">{god.name}</span>
                <span className="ep-god-card-title">{god.title}</span>
              </div>

              {/* Active glow ring */}
              {isActive && (
                <motion.div
                  className="ep-god-card-glow"
                  layoutId="god-glow"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Divine Morph Button */}
      <motion.button
        className="ep-morph-btn"
        onClick={onOpenMorph}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        <span className="ep-morph-btn-icon">🌀</span>
        <span className="ep-morph-btn-label">DIVINE MORPH</span>
      </motion.button>
    </div>
  );
};
