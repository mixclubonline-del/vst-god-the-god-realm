/**
 * GodProfile.tsx — The Sacred Dossier
 * Right sidebar showing the active god's element, domain,
 * energy, mood, best-for tags, and divine quote.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ElectricPantheonGod } from '@/data/electricPantheonGods';
import type { VstGodPreset } from '@/data/vstGodElectricPantheonLibrary';
import { SacredSwitch } from '../ui/SacredSwitch';

interface GodProfileProps {
  god: ElectricPantheonGod;
  /** Active library preset — provides preset-specific mood, bestFor, quote */
  preset?: VstGodPreset;
  parameterValues?: Record<string, any>;
  update?: (id: string, val: any) => void;
}

const PROFILE_ICONS: Record<string, string> = {
  element: '🜂',
  domain: '⚔',
  energy: '⚡',
  mood: '🎭',
};

export const GodProfile: React.FC<GodProfileProps> = ({ god, preset, parameterValues, update }) => {
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

      {/* Routing & Expression Settings */}
      {update && parameterValues && (
        <div className="ep-profile-section" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="ep-profile-section-label" style={{ letterSpacing: '0.1em', fontSize: '8px', color: 'var(--god-primary)' }}>ROUTING & EXPRESSION</span>
          
          {/* MPE Enable toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2px 0' }}>
            <span style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>MIDI MPE</span>
            <SacredSwitch
              isOn={parameterValues.mpeEnabled ?? false}
              onToggle={() => update('mpeEnabled', !(parameterValues.mpeEnabled ?? false))}
              size="sm"
              color={god.colors.primary}
              variant="gem"
            />
          </div>

          {/* Synth Routing dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '2px 0' }}>
            <span style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OUTPUT ROUTING</span>
            <select
              value={parameterValues.synthOutputRoute ?? 0}
              onChange={(e) => update('synthOutputRoute', parseInt(e.target.value, 10))}
              className="slot-dropdown"
              style={{ 
                fontSize: '9px', 
                padding: '4px 6px', 
                border: '1px solid rgba(255, 215, 0, 0.15)', 
                background: 'rgba(10, 8, 25, 0.85)', 
                color: god.colors.primary,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                borderRadius: '4px',
                width: '100%',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={0}>Main Out</option>
              <option value={1}>Out 1-2</option>
              <option value={2}>Out 3-4</option>
              <option value={3}>Out 5-6</option>
              <option value={4}>Out 7-8</option>
              <option value={5}>Out 9-10</option>
              <option value={6}>Out 11-12</option>
              <option value={7}>Out 13-14</option>
              <option value={8}>Out 15-16</option>
            </select>
          </div>

          {/* Chthonic Sub Gain slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CHTHONIC SUB</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--god-primary)' }}>
                {Math.round(parameterValues.pantheonSubGain ?? 40)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={parameterValues.pantheonSubGain ?? 40}
              onChange={(e) => update('pantheonSubGain', parseFloat(e.target.value))}
              style={{
                backgroundImage: `linear-gradient(to right, var(--god-primary) 0%, var(--god-primary) ${parameterValues.pantheonSubGain ?? 40}%, rgba(255, 255, 255, 0.1) ${parameterValues.pantheonSubGain ?? 40}%, rgba(255, 255, 255, 0.1) 100%)`
              }}
              className="ep-chthonic-slider"
            />
          </div>
        </div>
      )}
    </div>
  );
};
