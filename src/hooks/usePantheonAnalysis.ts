/**
 * usePantheonAnalysis.ts — Real-time Audio Analysis Hook
 * Polls the PantheonSynthEngine's AnalyserNode at ~30fps and returns
 * smoothed analysis data for visual synchronization.
 *
 * Features:
 * - Exponential smoothing (attack: 0.3, release: 0.15) for fluid meter movement
 * - Auto-pauses polling when engine is null (CPU-friendly)
 * - Graceful decay to zero when audio stops
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PantheonSynthEngine, PantheonAnalysisData } from '@/audio/PantheonSynthEngine';

const EMPTY_DATA: PantheonAnalysisData = {
  rms: 0,
  peak: 0,
  spectralBands: { body: 0, soul: 0, air: 0, silk: 0 },
  isActive: false,
  activeVoiceCount: 0,
};

/** Smoothing factors — higher = faster response */
const ATTACK = 0.3;
const RELEASE = 0.15;

/** Target frame interval (~30fps) */
const FRAME_INTERVAL = 1000 / 30;

function smooth(current: number, target: number, isRising: boolean): number {
  const factor = isRising ? ATTACK : RELEASE;
  return current + (target - current) * factor;
}

export function usePantheonAnalysis(
  synthRef: React.RefObject<PantheonSynthEngine | null>
): PantheonAnalysisData {
  const [data, setData] = useState<PantheonAnalysisData>(EMPTY_DATA);
  const smoothedRef = useRef<PantheonAnalysisData>({ ...EMPTY_DATA });
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  const tick = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastFrameRef.current;

    // Throttle to ~30fps
    if (elapsed < FRAME_INTERVAL) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    lastFrameRef.current = now;

    const synth = synthRef.current;
    if (!synth) {
      // Decay smoothly to zero when engine is gone
      const s = smoothedRef.current;
      const allZero = s.rms < 0.001 && s.peak < 0.001;
      if (!allZero) {
        smoothedRef.current = {
          rms: smooth(s.rms, 0, false),
          peak: smooth(s.peak, 0, false),
          spectralBands: {
            body: smooth(s.spectralBands.body, 0, false),
            soul: smooth(s.spectralBands.soul, 0, false),
            air: smooth(s.spectralBands.air, 0, false),
            silk: smooth(s.spectralBands.silk, 0, false),
          },
          isActive: false,
          activeVoiceCount: 0,
        };
        setData({ ...smoothedRef.current });
      }
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // Get raw analysis from engine
    const raw = synth.getAnalysisData();
    const prev = smoothedRef.current;

    // Apply exponential smoothing
    const smoothed: PantheonAnalysisData = {
      rms: smooth(prev.rms, raw.rms, raw.rms > prev.rms),
      peak: smooth(prev.peak, raw.peak, raw.peak > prev.peak),
      spectralBands: {
        body: smooth(prev.spectralBands.body, raw.spectralBands.body, raw.spectralBands.body > prev.spectralBands.body),
        soul: smooth(prev.spectralBands.soul, raw.spectralBands.soul, raw.spectralBands.soul > prev.spectralBands.soul),
        air: smooth(prev.spectralBands.air, raw.spectralBands.air, raw.spectralBands.air > prev.spectralBands.air),
        silk: smooth(prev.spectralBands.silk, raw.spectralBands.silk, raw.spectralBands.silk > prev.spectralBands.silk),
      },
      isActive: raw.isActive,
      activeVoiceCount: raw.activeVoiceCount,
    };

    smoothedRef.current = smoothed;
    setData({ ...smoothed });

    rafRef.current = requestAnimationFrame(tick);
  }, [synthRef]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  return data;
}
