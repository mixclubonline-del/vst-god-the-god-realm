/**
 * useTrackMetering — Real-time per-track VU metering hook.
 * Reads AnalyserNode data from FXRack at 30fps and returns peak/RMS levels
 * for each track. Auto-pauses when the sequencer is stopped to save CPU.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import type { FXRack, TrackLevel } from '../../audio/FXRack';

const METER_FPS = 30;
const METER_INTERVAL = 1000 / METER_FPS;

export interface TrackLevels {
  [trackIndex: number]: TrackLevel;
}

export function useTrackMetering(
  fxRack: React.MutableRefObject<FXRack | null>,
  isPlaying: boolean,
  trackCount: number
): TrackLevels {
  const [levels, setLevels] = useState<TrackLevels>({});
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  // Peak hold state — decays over time for visual "peak hold" effect
  const peakHoldRef = useRef<Map<number, { value: number; time: number }>>(new Map());

  const updateLevels = useCallback((timestamp: number) => {
    if (timestamp - lastFrameRef.current < METER_INTERVAL) {
      rafRef.current = requestAnimationFrame(updateLevels);
      return;
    }
    lastFrameRef.current = timestamp;

    if (!fxRack.current) {
      rafRef.current = requestAnimationFrame(updateLevels);
      return;
    }

    const rawLevels = fxRack.current.getAllTrackLevels();
    const newLevels: TrackLevels = {};

    rawLevels.forEach((level, trackId) => {
      // Peak hold: retain peak for 1.5s then decay
      const held = peakHoldRef.current.get(trackId);
      let peakHold = level.peak;
      if (held) {
        const elapsed = (timestamp - held.time) / 1000;
        if (elapsed < 1.5 && held.value > level.peak) {
          peakHold = held.value;
        } else if (elapsed >= 1.5) {
          // Decay the held peak
          peakHold = Math.max(level.peak, held.value - (elapsed - 1.5) * 2);
        }
      }
      if (level.peak >= (held?.value ?? 0) || !held) {
        peakHoldRef.current.set(trackId, { value: level.peak, time: timestamp });
      }

      newLevels[trackId] = {
        peak: peakHold,
        rms: level.rms,
      };
    });

    setLevels(newLevels);
    rafRef.current = requestAnimationFrame(updateLevels);
  }, [fxRack]);

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateLevels);
    } else {
      // When stopped, zero out levels gradually
      cancelAnimationFrame(rafRef.current);
      peakHoldRef.current.clear();
      // Zero out after a brief delay so meters visually decay
      const timeout = setTimeout(() => {
        const zeroed: TrackLevels = {};
        for (let i = 0; i < trackCount; i++) {
          zeroed[i] = { peak: 0, rms: 0 };
        }
        setLevels(zeroed);
      }, 200);
      return () => clearTimeout(timeout);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, updateLevels, trackCount]);

  return levels;
}
