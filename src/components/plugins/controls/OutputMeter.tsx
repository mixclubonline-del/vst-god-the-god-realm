/**
 * OutputMeter.tsx — Compact Vertical Stereo Level Meter
 * GUI Forge Paradigm: "Every control is a visualizer."
 * Pure DOM rendering with CSS transitions for peak hold decay.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface OutputMeterProps {
  level?: number;    // 0-1 RMS level, default 0
  peak?: number;     // 0-1 peak level, default 0
  color?: string;    // accent color
  height?: number;   // default matches parent height
}

/** Convert linear 0-1 to dB position (0dB = 1.0, -48dB floor) */
const linearToDb = (v: number) => {
  if (v <= 0) return -48;
  return 20 * Math.log10(v);
};

/** Map dB value to 0-1 percentage for display (-48dB = 0, 0dB = 1) */
const dbToPercent = (db: number) => Math.max(0, Math.min(1, (db + 48) / 48));

/** dB mark positions */
const DB_MARKS = [0, -6, -12, -24] as const;

export const OutputMeter: React.FC<OutputMeterProps> = ({
  level = 0,
  peak = 0,
  color = '#38D5FF',
  height,
}) => {
  const [peakHold, setPeakHold] = useState(0);
  const [clipping, setClipping] = useState(false);
  const peakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update peak hold — rises instantly, decays via CSS transition
  useEffect(() => {
    if (peak > peakHold) {
      setPeakHold(peak);
      // Reset decay timer
      if (peakTimerRef.current) clearTimeout(peakTimerRef.current);
      peakTimerRef.current = setTimeout(() => setPeakHold(0), 2000);
    }
    return () => {
      if (peakTimerRef.current) clearTimeout(peakTimerRef.current);
    };
  }, [peak]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clip indicator — lights on when peak > 0.95, stays for 2s
  useEffect(() => {
    if (peak > 0.95) {
      setClipping(true);
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
      clipTimerRef.current = setTimeout(() => setClipping(false), 2000);
    }
    return () => {
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    };
  }, [peak]);

  const levelPct = dbToPercent(linearToDb(level)) * 100;
  const peakPct = dbToPercent(linearToDb(peakHold)) * 100;

  const barGradient = 'linear-gradient(to top, #22C55E 0%, #22C55E 40%, #EAB308 60%, #EF4444 95%)';

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    gap: 2,
    height: height ?? '100%',
    alignItems: 'stretch',
    padding: '2px 0',
  };

  const barWrapStyle: React.CSSProperties = {
    position: 'relative',
    width: 4,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  };

  const barFillStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: `${levelPct}%`,
    background: barGradient,
    borderRadius: 2,
    boxShadow: `0 0 4px ${color}40`,
    transition: 'height 0.06s linear',
  };

  const peakLineStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    bottom: `${peakPct}%`,
    background: '#fff',
    borderRadius: 1,
    opacity: peakHold > 0 ? 0.9 : 0,
    transition: 'bottom 1.5s ease-out, opacity 0.3s ease',
    pointerEvents: 'none',
  };

  const renderBar = (key: string) => (
    <div key={key} style={barWrapStyle}>
      <div style={barFillStyle} />
      <div style={peakLineStyle} />
    </div>
  );

  return (
    <div className="fp-output-meter" style={containerStyle}>
      {/* L and R bars */}
      {renderBar('L')}
      {renderBar('R')}

      {/* Clip indicator */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: clipping ? '#EF4444' : 'rgba(255,255,255,0.08)',
          boxShadow: clipping ? '0 0 6px #EF4444' : 'none',
          transition: 'background 0.15s, box-shadow 0.15s',
        }}
      />

      {/* dB markings */}
      {DB_MARKS.map((db) => {
        const pct = dbToPercent(db) * 100;
        return (
          <span
            key={db}
            style={{
              position: 'absolute',
              right: -18,
              bottom: `${pct}%`,
              transform: 'translateY(50%)',
              fontSize: 5,
              fontFamily: "'JetBrains Mono', monospace",
              color: 'rgba(255,255,255,0.20)',
              lineHeight: 1,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {db}
          </span>
        );
      })}
    </div>
  );
};
