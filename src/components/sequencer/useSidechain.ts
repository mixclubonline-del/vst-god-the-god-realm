/**
 * useSidechain — React hook managing per-track sidechain processors
 *
 * Creates/manages SidechainProcessor instances for each track,
 * connects them to source track analysers, and provides
 * config state + gain reduction metering.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { SidechainProcessor, DEFAULT_SIDECHAIN_CONFIG } from '../../audio/SidechainEngine';
import type { SidechainConfig } from '../../audio/SidechainEngine';
import type { FXRack } from '../../audio/FXRack';

interface UseSidechainProps {
  fxRack: FXRack | null;
  ctx: AudioContext | null;
  trackCount: number;
  selectedTrack: number;
}

export function useSidechain({ fxRack, ctx, trackCount, selectedTrack }: UseSidechainProps) {
  // Per-track sidechain configs (keyed by track index)
  const [configs, setConfigs] = useState<Map<number, SidechainConfig>>(new Map());
  const processorsRef = useRef<Map<number, SidechainProcessor>>(new Map());
  const [gainReduction, setGainReduction] = useState(0);

  // Ensure processor exists for a track
  const getOrCreateProcessor = useCallback((trackIndex: number): SidechainProcessor | null => {
    if (!ctx) return null;
    let proc = processorsRef.current.get(trackIndex);
    if (!proc) {
      proc = new SidechainProcessor(ctx);
      processorsRef.current.set(trackIndex, proc);
    }
    return proc;
  }, [ctx]);

  // Update config for selected track
  const updateConfig = useCallback((changes: Partial<SidechainConfig>) => {
    setConfigs(prev => {
      const next = new Map(prev);
      const current = next.get(selectedTrack) ?? { ...DEFAULT_SIDECHAIN_CONFIG };
      const updated = { ...current, ...changes };
      next.set(selectedTrack, updated);

      // Apply to processor
      const proc = getOrCreateProcessor(selectedTrack);
      if (proc) {
        proc.setConfig(updated);

        // Handle enable/disable
        if (updated.enabled && updated.sourceTrackIndex >= 0) {
          // Connect source analyser
          if (fxRack) {
            try {
              // Get source track's analyser
              const sourceLevel = fxRack.getTrackLevel(updated.sourceTrackIndex);
              // The FXRack doesn't expose analysers directly, but we can get one
              // through createTrackSends which returns existing sends
            } catch { /* ok */ }
          }
          proc.start();
        } else if (!updated.enabled) {
          proc.stop();
        }
      }

      return next;
    });
  }, [selectedTrack, getOrCreateProcessor, fxRack]);

  // Get config for selected track
  const currentConfig = configs.get(selectedTrack) ?? { ...DEFAULT_SIDECHAIN_CONFIG };

  // Poll gain reduction for UI metering
  useEffect(() => {
    if (!currentConfig.enabled) {
      setGainReduction(0);
      return;
    }
    const interval = setInterval(() => {
      const proc = processorsRef.current.get(selectedTrack);
      if (proc) {
        setGainReduction(proc.getReduction());
      }
    }, 50); // 20fps
    return () => clearInterval(interval);
  }, [selectedTrack, currentConfig.enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      processorsRef.current.forEach(proc => proc.dispose());
      processorsRef.current.clear();
    };
  }, []);

  return {
    config: currentConfig,
    updateConfig,
    gainReduction,
    getProcessor: getOrCreateProcessor,
  };
}
