/**
 * useEngineMetering.ts — Real-time metering hook for instrument plugins
 * Queries the active PantheonSynthEngine's AnalyserNode in a requestAnimationFrame loop,
 * applying exponential attack/release smoothing for fluid visual updates.
 */

import { useEffect, useState, useRef } from 'react';
import type { PantheonSynthEngine } from '@/audio/PantheonSynthEngine';

const ATTACK = 0.3;
const RELEASE = 0.15;

function smooth(current: number, target: number, isRising: boolean): number {
  const factor = isRising ? ATTACK : RELEASE;
  return current + (target - current) * factor;
}

export function useEngineMetering(engine: PantheonSynthEngine | null) {
  const [meter, setMeter] = useState({ level: 0, peak: 0 });
  const smoothedRef = useRef({ level: 0, peak: 0 });

  useEffect(() => {
    if (!engine) {
      // Smoothly decay to zero when engine is null/unloaded
      let frameId: number;
      const decay = () => {
        const current = smoothedRef.current;
        if (current.level < 0.001 && current.peak < 0.001) {
          setMeter({ level: 0, peak: 0 });
          return;
        }
        const nextLevel = smooth(current.level, 0, false);
        const nextPeak = smooth(current.peak, 0, false);
        smoothedRef.current = { level: nextLevel, peak: nextPeak };
        setMeter({ level: nextLevel, peak: nextPeak });
        frameId = requestAnimationFrame(decay);
      };
      frameId = requestAnimationFrame(decay);
      return () => cancelAnimationFrame(frameId);
    }

    let frameId: number;
    const update = () => {
      const data = engine.getAnalysisData();
      const prev = smoothedRef.current;
      const nextLevel = smooth(prev.level, data.rms, data.rms > prev.level);
      const nextPeak = smooth(prev.peak, data.peak, data.peak > prev.peak);

      smoothedRef.current = { level: nextLevel, peak: nextPeak };
      setMeter({ level: nextLevel, peak: nextPeak });

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [engine]);

  return meter;
}
