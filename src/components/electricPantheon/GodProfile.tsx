/**
 * GodProfile.tsx — The Sacred Dossier
 * Right sidebar showing the active god's element, domain,
 * energy, mood, best-for tags, and divine quote.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ElectricPantheonGod } from '@/data/electricPantheonGods';
import type { VstGodPreset } from '@/data/vstGodElectricPantheonLibrary';

interface GodProfileProps {
  god: ElectricPantheonGod;
  /** Active library preset — provides preset-specific mood, bestFor, quote */
  preset?: VstGodPreset;
}

const PROFILE_ICONS: Record<string, string> = {
  element: '🜂',
  domain: '⚔',
  energy: '⚡',
  mood: '🎭',
};

export const GodProfile: React.FC<GodProfileProps> = ({ god, preset }) => {
  const profileEntries = [
    { key: 'element', label: 'ELEMENT', value: god.profile.element },
    { key: 'domain', label: 'DOMAIN', value: god.profile.domain },
    { key: 'energy', label: 'ENERGY', value: god.profile.energy },
    { key: 'mood', label: 'MOOD', value: god.profile.mood },
  ];

  // Prefer preset-specific data when available
  const bestForTags = preset?.bestFor ?? god.bestFor;
  const quoteText = preset?.quote ?? god.profile.quote;

  return (
    <div
      className="ep-profile"
      style={{
        '--god-primary': god.colors.primary,
        '--god-secondary': god.colors.secondary,
      } as React.CSSProperties}
    >
      <div className="ep-profile-header">
        <span className="ep-profile-label">GOD PROFILE</span>
        {preset && (
          <span className="ep-profile-preset-badge">{preset.category.toUpperCase()}</span>
        )}
      </div>

      {/* Profile Stats */}
      <AnimatePresence mode="wait">
        <motion.div
          key={god.id + '-profile'}
          className="ep-profile-stats"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {profileEntries.map((entry, i) => (
            <motion.div
              key={entry.key}
              className="ep-profile-stat"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.25 }}
            >
              <span className="ep-profile-stat-icon">{PROFILE_ICONS[entry.key]}</span>
              <div className="ep-profile-stat-content">
                <span className="ep-profile-stat-label">{entry.label}</span>
                <span className="ep-profile-stat-value">{entry.value}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Preset Mood Tags */}
      {preset && (
        <div className="ep-profile-section">
          <span className="ep-profile-section-label">MOOD</span>
          <div className="ep-profile-tags">
            {preset.mood.map((tag) => (
              <span key={tag} className="ep-profile-tag ep-profile-tag--mood">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Best For Tags */}
      <div className="ep-profile-section">
        <span className="ep-profile-section-label">BEST FOR</span>
        <div className="ep-profile-tags">
          {bestForTags.map((tag) => (
            <span key={tag} className="ep-profile-tag">{tag}</span>
          ))}
        </div>
      </div>

      {/* Key Behavior */}
      <div className="ep-profile-section">
        <span className="ep-profile-section-label">KEY BEHAVIOR</span>
        <ul className="ep-profile-behaviors">
          {god.keyBehavior.map((b) => (
            <li key={b} className="ep-profile-behavior">{b}</li>
          ))}
        </ul>
      </div>

      {/* God Quote */}
      <motion.blockquote
        className="ep-profile-quote"
        key={god.id + (preset?.id ?? '') + '-quote'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <span className="ep-profile-quote-mark">"</span>
        {quoteText}
        <span className="ep-profile-quote-mark">"</span>
      </motion.blockquote>
    </div>
  );
};
