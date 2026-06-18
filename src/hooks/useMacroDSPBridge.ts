/**
 * useMacroDSPBridge.ts — Macro Behavior → PantheonSynthEngine Bridge
 * Synchronizes the library's macro state with the synth engine DSP,
 * and provides behavior context for UI tooltip display.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { PantheonSynthEngine } from '@/audio/PantheonSynthEngine';
import type { PantheonMacroId } from '@/data/pantheonMacros';
import type {
  VstGodPreset,
  VstGodMacroBehavior,
  VstGodFaceControl,
} from '@/data/vstGodElectricPantheonLibrary';

/** Describes the current behavior of a single macro for UI display */
export interface MacroBehaviorContext {
  id: PantheonMacroId;
  /** Display name from the behavior map */
  label: string;
  /** What this macro currently controls (brief description) */
  description: string;
  /** Primary DSP parameter target name */
  primaryTarget: string;
  /** All affected parameter names */
  affectedParams: string[];
  /** Current value (0-100) */
  value: number;
}

/** The four face macros that the library defines behavior for */
const FACE_MACROS: PantheonMacroId[] = ['energy', 'divinity', 'width', 'realm'];

/** All macros to sync to the DSP engine */
const SYNCED_MACROS: PantheonMacroId[] = ['energy', 'divinity', 'width', 'realm', 'aura', 'age'];

/**
 * Default behavior descriptions when no preset-specific data is available.
 * These map to the base PantheonSynthEngine.setMacro() routing.
 */
const DEFAULT_BEHAVIORS: Record<string, { label: string; description: string; primaryTarget: string; affectedParams: string[] }> = {
  energy: {
    label: 'ENERGY',
    description: 'Drive intensity + filter aggression',
    primaryTarget: 'waveshaper.amount',
    affectedParams: ['waveshaper.amount', 'filter.frequency', 'filter.Q'],
  },
  divinity: {
    label: 'DIVINITY',
    description: 'Reverb depth + harmonic shimmer',
    primaryTarget: 'reverb.wetLevel',
    affectedParams: ['reverb.wetLevel', 'chorus.depth', 'eq.highGain'],
  },
  width: {
    label: 'WIDTH',
    description: 'Stereo field spread + spatial depth',
    primaryTarget: 'chorus.rate',
    affectedParams: ['chorus.rate', 'chorus.spread', 'reverb.preDelay'],
  },
  realm: {
    label: 'REALM',
    description: 'FM index + FX chain blend + texture',
    primaryTarget: 'oscillator.fmIndex',
    affectedParams: ['oscillator.fmIndex', 'fx.wetMix', 'saturation.character'],
  },
  aura: {
    label: 'AURA',
    description: 'Atmosphere + Reverb + Space',
    primaryTarget: 'reverb.send',
    affectedParams: ['reverb.send', 'delay.feedback'],
  },
  age: {
    label: 'AGE',
    description: 'Vintage + Instability + Wear',
    primaryTarget: 'wowFlutter.amount',
    affectedParams: ['wowFlutter.amount', 'noise.level', 'pitch.drift'],
  },
};

/**
 * Hook that bridges the library's macro behavior map to the synth engine.
 *
 * @param synthRef - Ref to the PantheonSynthEngine instance
 * @param macroValues - Current macro values (0-100 for each PantheonMacroId)
 * @param preset - Currently selected preset (for behavior map context)
 */
export function useMacroDSPBridge(
  synthRef: React.RefObject<PantheonSynthEngine | null>,
  macroValues: Record<PantheonMacroId, number>,
  preset?: VstGodPreset
): { behaviors: MacroBehaviorContext[] } {
  // Debounce ref to avoid over-dispatching to the engine
  const lastApplied = useRef<Record<string, number>>({});

  // Push macro values to the engine whenever they change
  useEffect(() => {
    const synth = synthRef.current;
    if (!synth) return;

    for (const macroId of SYNCED_MACROS) {
      const value = macroValues[macroId] ?? 50;
      const lastVal = lastApplied.current[macroId] ?? -1;

      // Only push if value actually changed (avoids redundant DSP updates)
      if (Math.abs(value - lastVal) > 0.5) {
        synth.setMacro(macroId, value);
        lastApplied.current[macroId] = value;
      }
    }
  }, [synthRef, macroValues]);

  // Build behavior context for UI tooltips
  const behaviors = useMemo<MacroBehaviorContext[]>(() => {
    // Per-preset brief descriptions (e.g. "Drive intensity + filter aggression")
    const presetMacroBrief = preset?.macroBehavior;

    return FACE_MACROS.map((id) => {
      const defaults = DEFAULT_BEHAVIORS[id];
      const faceKey = id.toUpperCase() as VstGodFaceControl;
      const presetDescription = presetMacroBrief?.[faceKey];

      return {
        id,
        label: defaults.label,
        description: presetDescription || defaults.description,
        primaryTarget: defaults.primaryTarget,
        affectedParams: defaults.affectedParams,
        value: macroValues[id] ?? 50,
      };
    });
  }, [preset, macroValues]);

  return { behaviors };
}
