/**
 * PantheonMacros.tsx — The Sacred 4 Controls
 * Top macro row: ENERGY / DIVINITY / WIDTH / REALM
 * Each knob dynamically re-labels per god.
 * Phase 5: Now renders behavior tooltips from useMacroDSPBridge context.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DivineKnob } from '../ui/DivineKnob';
import type { ElectricPantheonGod } from '@/data/electricPantheonGods';
import { getVisibleMacros } from '@/data/pantheonMacros';
import type { PantheonMacroId } from '@/data/pantheonMacros';
import type { MacroBehaviorContext } from '@/hooks/useMacroDSPBridge';

interface PantheonMacrosProps {
  god: ElectricPantheonGod;
  macroValues: Record<PantheonMacroId, number>;
  onMacroChange: (id: PantheonMacroId, value: number) => void;
  /** Behavior context from useMacroDSPBridge — drives tooltips */
  behaviorContext?: MacroBehaviorContext[];
}

export const PantheonMacros: React.FC<PantheonMacrosProps> = ({
  god,
  macroValues,
  onMacroChange,
  behaviorContext,
}) => {
  const visibleMacros = getVisibleMacros();

  return (
    <div
      className="ep-macros"
      style={{ '--god-primary': god.colors.primary } as React.CSSProperties}
    >
      <div className="ep-macros-row">
        {visibleMacros.map((macro, i) => {
          const godBehavior = god.macroBehavior[macro.id as keyof typeof god.macroBehavior];
          const behavior = behaviorContext?.find((b) => b.id === macro.id);

          return (
            <motion.div
              key={macro.id}
              className="ep-macro-slot"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
            >
              {/* Macro Icon */}
              <span className="ep-macro-icon">{macro.icon}</span>

              {/* DivineKnob */}
              <DivineKnob
                label={macro.label}
                min={0}
                max={100}
                value={macroValues[macro.id] ?? macro.value}
                onChange={(v) => onMacroChange(macro.id, v)}
                unit="%"
                size="lg"
                color={god.colors.primary}
                variant="celestial"
              />

              {/* Dynamic Sub-Label */}
              <span className="ep-macro-sub" title={godBehavior}>
                {macro.description}
              </span>

              {/* ─── Behavior Tooltip (from DSP Bridge) ─── */}
              {behavior && (
                <div className="ep-macro-tooltip">
                  <span className="ep-macro-tooltip-label">
                    {behavior.label}
                  </span>
                  <span className="ep-macro-tooltip-desc">
                    {behavior.description}
                  </span>
                  <span className="ep-macro-tooltip-targets">
                    → {behavior.affectedParams.join(' · ')}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
