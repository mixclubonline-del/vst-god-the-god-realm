/**
 * GodHero.tsx — The Divine Presence
 * Center hero panel showing the active god's artwork,
 * name, title, emotional purpose, and sound chips.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ElectricPantheonGod } from '@/data/electricPantheonGods';
import type { VstGodPreset } from '@/data/vstGodElectricPantheonLibrary';

interface GodHeroProps {
  god: ElectricPantheonGod;
  /** Active library preset — provides sound recipe, subtitle, mood */
  preset?: VstGodPreset;
}

export const GodHero: React.FC<GodHeroProps> = ({ god, preset }) => {
  // Use preset's sound recipe for chips when available, else sonic references
  const chipItems = preset?.soundRecipe ?? god.sonicReferences;
  const subtitleText = preset ? preset.subtitle : god.emotionalPurpose;
  const quoteText = preset?.quote ?? god.profile.quote;

  return (
    <div
      className="ep-hero"
      style={{
        '--god-primary': god.colors.primary,
        '--god-secondary': god.colors.secondary,
        '--god-accent': god.colors.accent,
      } as React.CSSProperties}
    >
      {/* Background Hero Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={god.id}
          className="ep-hero-bg"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <img
            src={god.heroImage}
            alt={god.name}
            className="ep-hero-img"
          />
          <div className="ep-hero-gradient" />
        </motion.div>
      </AnimatePresence>

      {/* Divine Rays Effect */}
      <div className="ep-hero-rays" />

      {/* Hero Content Overlay */}
      <AnimatePresence mode="wait">
        <motion.div
          key={god.id + '-content'}
          className="ep-hero-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {/* God Icon Badge */}
          <motion.div
            className="ep-hero-icon-badge"
            animate={{
              boxShadow: [
                `0 0 20px ${god.colors.primary}40`,
                `0 0 40px ${god.colors.primary}80`,
                `0 0 20px ${god.colors.primary}40`,
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <span className="ep-hero-icon">{god.icon}</span>
          </motion.div>

          {/* God Name & Title */}
          <h2 className="ep-hero-name">{god.name}</h2>
          <p className="ep-hero-title">{god.title}</p>

          {/* Preset Subtitle / Emotional Purpose */}
          <p className="ep-hero-purpose">{subtitleText}</p>

          {/* Sound Recipe / Sonic Reference Chips */}
          <div className="ep-hero-chips">
            {chipItems.map((ref, i) => (
              <motion.span
                key={ref}
                className="ep-hero-chip"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.3 }}
              >
                {ref}
              </motion.span>
            ))}
          </div>

          {/* Tone Tags */}
          <div className="ep-hero-tone-tags">
            {god.tone.slice(0, 4).map((t) => (
              <span key={t} className="ep-hero-tone-tag">{t}</span>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
