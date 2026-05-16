/**
 * ALSVision.tsx — Advanced Leveling System Visual
 * Real-time audio-reactive visualization for the Electric Pantheon.
 *
 * Three sections:
 * 1. Signal Meter — 20-segment level meter driven by live RMS/peak data,
 *    with macro-derived baseline when idle
 * 2. Spectral Ring — 4-quadrant Four Anchors (Body/Soul/Air/Silk) radial display
 * 3. Voice Counter — Dot indicator showing active polyphony (0–8)
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ElectricPantheonGod } from '@/data/electricPantheonGods';
import type { PantheonMacroId } from '@/data/pantheonMacros';
import type { PantheonAnalysisData } from '@/audio/PantheonSynthEngine';

interface ALSVisionProps {
  god: ElectricPantheonGod;
  macroValues: Record<PantheonMacroId, number>;
  analysisData?: PantheonAnalysisData;
}

const SPECTRAL_LABELS = [
  { id: 'body', label: 'B', full: 'BODY' },
  { id: 'soul', label: 'S', full: 'SOUL' },
  { id: 'air',  label: 'A', full: 'AIR' },
  { id: 'silk', label: 'K', full: 'SILK' },
] as const;

export const ALSVision: React.FC<ALSVisionProps> = ({ god, macroValues, analysisData }) => {
  // Macro-derived baseline level (used when audio is idle)
  const macroBaseline = useMemo(() => {
    const e = (macroValues.energy ?? 50) / 100;
    const d = (macroValues.divinity ?? 50) / 100;
    const w = (macroValues.width ?? 50) / 100;
    const r = (macroValues.realm ?? 50) / 100;
    return e * 0.3 + d * 0.3 + w * 0.15 + r * 0.25;
  }, [macroValues]);

  // Effective display level: live audio when active, macro baseline when idle
  const isActive = analysisData?.isActive ?? false;
  const liveLevel = analysisData?.rms ?? 0;
  const displayLevel = isActive
    ? Math.max(liveLevel, macroBaseline * 0.3)  // floor at 30% of macro baseline during play
    : macroBaseline * 0.15;  // subtle ambient glow when idle
  const displayPercent = Math.round(displayLevel * 100);

  const peak = analysisData?.peak ?? 0;
  const voiceCount = analysisData?.activeVoiceCount ?? 0;
  const spectral = analysisData?.spectralBands ?? { body: 0, soul: 0, air: 0, silk: 0 };

  const meterSegments = 20;

  return (
    <div
      className="ep-als-vision"
      style={{ '--god-primary': god.colors.primary, '--god-accent': god.colors.accent } as React.CSSProperties}
    >
      {/* ─── Header ─── */}
      <div className="ep-als-header">
        <span className="ep-als-label">ALS VISION</span>
        <span className={`ep-als-level-value ${isActive ? 'ep-als-level-value--active' : ''}`}>
          {displayPercent}%
        </span>
      </div>

      {/* ─── Signal Meter (20 segments) ─── */}
      <div className="ep-als-meter">
        {Array.from({ length: meterSegments }).map((_, i) => {
          const segmentThreshold = (i + 1) / meterSegments;
          const isLit = displayLevel >= segmentThreshold;
          const isPeak = peak >= segmentThreshold && peak < segmentThreshold + (1 / meterSegments);
          const isHot = segmentThreshold > 0.8;
          const isWarm = segmentThreshold > 0.6;

          return (
            <div
              key={i}
              className={`ep-als-segment ${isLit ? 'active' : ''} ${isPeak ? 'peak' : ''} ${isHot ? 'hot' : isWarm ? 'warm' : ''}`}
              style={{
                opacity: isLit ? 1 : isPeak ? 0.7 : 0.12,
                transform: `scaleY(${isLit ? 1 : 0.5})`,
                backgroundColor: isLit
                  ? isHot ? '#ff4444' : isWarm ? god.colors.accent : god.colors.primary
                  : isPeak ? god.colors.primary : undefined,
                boxShadow: isLit && isActive
                  ? `0 0 ${isHot ? 6 : 3}px ${isHot ? '#ff4444' : god.colors.primary}`
                  : undefined,
              }}
            />
          );
        })}
      </div>

      {/* ─── Spectral Ring (Four Anchors) ─── */}
      <div className="ep-als-spectral-ring">
        <div
          className="ep-als-spectral-glow"
          style={{
            background: isActive
              ? `conic-gradient(from 0deg,
                  ${god.colors.primary}${Math.round(spectral.body * 200 + 20).toString(16).padStart(2, '0')} 0deg,
                  ${god.colors.secondary ?? god.colors.primary}${Math.round(spectral.soul * 200 + 20).toString(16).padStart(2, '0')} 90deg,
                  ${god.colors.accent}${Math.round(spectral.air * 200 + 20).toString(16).padStart(2, '0')} 180deg,
                  ${god.colors.primary}${Math.round(spectral.silk * 200 + 20).toString(16).padStart(2, '0')} 270deg,
                  ${god.colors.primary}${Math.round(spectral.body * 200 + 20).toString(16).padStart(2, '0')} 360deg
                )`
              : `radial-gradient(circle, ${god.colors.primary}15 0%, transparent 70%)`,
            filter: isActive ? `blur(${2 + liveLevel * 6}px)` : 'blur(4px)',
          }}
        />

        {/* God Emblem */}
        <motion.div
          className="ep-als-emblem"
          animate={{
            scale: isActive ? [1, 1.08 + liveLevel * 0.15, 1] : [1, 1.03, 1],
          }}
          transition={{ duration: isActive ? 0.8 : 2, repeat: Infinity }}
          style={{
            filter: `drop-shadow(0 0 ${isActive ? 8 + liveLevel * 15 : 6}px ${god.colors.primary})`,
          }}
        >
          <span className="ep-als-emblem-icon">{god.icon}</span>
        </motion.div>

        {/* Quadrant Labels */}
        <div className="ep-als-spectral-labels">
          {SPECTRAL_LABELS.map((band) => {
            const value = spectral[band.id];
            return (
              <div
                key={band.id}
                className={`ep-als-spectral-label ep-als-spectral-label--${band.id}`}
                style={{
                  opacity: isActive ? 0.5 + value * 0.5 : 0.25,
                  color: value > 0.5 ? god.colors.accent : undefined,
                }}
              >
                {band.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Voice Counter ─── */}
      <div className="ep-als-voice-counter">
        <span className="ep-als-voice-label">VOICES</span>
        <div className="ep-als-voice-dots">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`ep-als-voice-dot ${i < voiceCount ? 'active' : ''}`}
              style={i < voiceCount ? {
                backgroundColor: god.colors.primary,
                boxShadow: `0 0 4px ${god.colors.primary}`,
              } : undefined}
            />
          ))}
        </div>
      </div>

      {/* ─── Macro Mini-Bars (Four Anchors) ─── */}
      <div className="ep-als-mini-bars">
        {SPECTRAL_LABELS.map((band) => {
          // Blend macro and spectral data for the mini bars
          const macroKey = band.id === 'body' ? 'energy'
            : band.id === 'soul' ? 'divinity'
            : band.id === 'air' ? 'width'
            : 'realm';
          const macroVal = (macroValues[macroKey] ?? 50) / 100;
          const spectralVal = spectral[band.id];
          const blendedVal = isActive
            ? macroVal * 0.4 + spectralVal * 0.6
            : macroVal;

          return (
            <div key={band.id} className="ep-als-mini-bar">
              <span className="ep-als-mini-label">{band.label}</span>
              <div className="ep-als-mini-track">
                <div
                  className="ep-als-mini-fill"
                  style={{
                    width: `${blendedVal * 100}%`,
                    backgroundColor: god.colors.primary,
                    boxShadow: isActive && spectralVal > 0.4
                      ? `0 0 4px ${god.colors.primary}`
                      : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
