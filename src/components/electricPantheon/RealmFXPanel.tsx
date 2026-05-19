/**
 * RealmFXPanel.tsx — The God's Signal Chain
 * Shows the 4 per-god FX modules with knobs and bypass toggles.
 * Center emblem pulses with the god's color.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DivineKnob } from '../ui/DivineKnob';
import type { ElectricPantheonGod } from '@/data/electricPantheonGods';

interface RealmFXPanelProps {
  god: ElectricPantheonGod;
  fxValues: number[];
  onFxChange: (index: number, value: number) => void;
  /** Optional preset-specific FX names override the god's static realmFx */
  presetFxNames?: string[];
}

export const RealmFXPanel: React.FC<RealmFXPanelProps> = ({
  god,
  fxValues,
  onFxChange,
  presetFxNames,
}) => {
  const [bypassed, setBypassed] = useState<boolean[]>([false, false, false, false]);

  const toggleBypass = (idx: number) => {
    setBypassed((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  // Prefer preset-specific names, fallback to static god realmFx
  const fxNames = presetFxNames ?? god.realmFx;

  return (
    <div
      className="ep-realm-fx"
      style={{ '--god-primary': god.colors.primary } as React.CSSProperties}
    >
      <div className="ep-realm-fx-header">
        <span className="ep-realm-fx-label">REALM FX</span>
      </div>

      <div className="ep-realm-fx-grid">
        {fxNames.map((fxName, i) => (
          <motion.div
            key={`${god.id}-${fxName}`}
            className={`ep-realm-fx-module ${bypassed[i] ? 'ep-realm-fx-module--bypassed' : ''}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
          >
            {/* FX Knob */}
            <DivineKnob
              label={fxName}
              min={0}
              max={100}
              value={fxValues[i] ?? 50}
              onChange={(v) => onFxChange(i, v)}
              size="sm"
              suffix="%"
              variant="celestial"
            />

            {/* Bypass Toggle */}
            <button
              className={`ep-realm-fx-bypass ${bypassed[i] ? 'active' : ''}`}
              onClick={() => toggleBypass(i)}
              title={`Bypass ${fxName}`}
            >
              {bypassed[i] ? 'OFF' : 'ON'}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Center Emblem */}
      <motion.div
        className="ep-realm-fx-emblem"
        animate={{
          boxShadow: [
            `0 0 15px ${god.colors.primary}30`,
            `0 0 30px ${god.colors.primary}60`,
            `0 0 15px ${god.colors.primary}30`,
          ],
        }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        <span className="ep-realm-fx-emblem-icon">{god.icon}</span>
      </motion.div>
    </div>
  );
};
