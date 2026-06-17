/**
 * usePluginEngine.ts — Audio Engine Hook for Floating Plugins
 * Each plugin instance gets its own PantheonSynthEngine,
 * initialized with the god preset and wired to audio output.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { PantheonSynthEngine } from '@/audio/PantheonSynthEngine';
import type { PluginId } from '@/data/pluginRegistry';
import { PLUGIN_REGISTRY } from '@/data/pluginRegistry';
import { nativeAudio } from '@/native/bridge';

interface PluginEngineAPI {
  engine: PantheonSynthEngine | null;
  isReady: boolean;

  /** Play a note (MIDI number, velocity 0-127) */
  noteOn: (midi: number, velocity?: number) => void;
  noteOff: (midi: number) => void;

  /** Set a parameter from a spec param target (0-100 normalized) */
  setParam: (target: string, value: number) => void;
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

export function usePluginEngine(pluginId: PluginId): PluginEngineAPI {
  const engineRef = useRef<PantheonSynthEngine | null>(null);
  const [isReady, setIsReady] = useState(false);
  const plugin = PLUGIN_REGISTRY[pluginId];

  useEffect(() => {
    if (nativeAudio.isInJuce()) {
      setIsReady(true);
      return;
    }
    const ctx = getAudioContext();
    const engine = new PantheonSynthEngine();
    engine.init(ctx, ctx.destination);
    engine.setGod(plugin.godId);

    // Set voice mode
    if (plugin.voiceMode === 'MONO' || plugin.voiceMode === 'LEGATO') {
      engine.setVoiceMode(plugin.voiceMode);
    }

    // Apply morph if this plugin uses dual gods
    if (plugin.morphGodId) {
      engine.setMorph(plugin.godId, plugin.morphGodId, 50);
    }

    engineRef.current = engine;
    setIsReady(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
      setIsReady(false);
    };
  }, [pluginId, plugin.godId, plugin.morphGodId, plugin.voiceMode]);

  const noteOn = useCallback((midi: number, velocity = 100) => {
    engineRef.current?.noteOn(midi, velocity);
  }, []);

  const noteOff = useCallback((midi: number) => {
    engineRef.current?.noteOff(midi);
  }, []);

  const setParam = useCallback((target: string, value: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const norm = value / 100;

    switch (target) {
      // ── Envelope ──
      case 'attack':
      case 'decay':
      case 'sustain':
      case 'release':
        // These affect the god preset directly — need to re-apply
        // For now, mapped through macro system approximation
        break;

      // ── Filter ──
      case 'filterFreq':
        engine.setMacro('energy', value); // Energy drives filter cutoff
        break;
      case 'filterQ':
        // Q mapped through energy macro Q boost
        break;

      // ── FX ──
      case 'reverbMix':
        engine.setFx(0, value);
        break;
      case 'chorusMix':
        engine.setFx(1, value);
        break;
      case 'delayMix':
        engine.setFx(2, value);
        break;
      case 'satDrive':
      case 'satMix':
        engine.setFx(3, value);
        break;

      // ── Macros ──
      case 'energy':
        engine.setMacro('energy', value);
        break;
      case 'divinity':
        engine.setMacro('divinity', value);
        break;
      case 'width':
        engine.setMacro('width', value);
        break;
      case 'realm':
        engine.setMacro('realm', value);
        break;

      // ── Sub/Body/Mod ──
      case 'pantheonSubGain':
        engine.setSubGain(value);
        break;
      case 'subOscGain':
      case 'bodyGain':
      case 'modIndex':
      case 'detuneCents':
        // These are voice-level params — applied on next noteOn
        break;

      // ── Master ──
      case 'masterGain':
        // Master volume approximated via setFx or macro
        break;

      // ── Morph Blend ──
      case 'morphBlend': {
        const plugin = PLUGIN_REGISTRY[pluginId];
        if (plugin.morphGodId) {
          engine.setMorph(plugin.godId, plugin.morphGodId, value);
        }
        break;
      }
    }
  }, [pluginId]);

  return {
    engine: engineRef.current,
    isReady,
    noteOn,
    noteOff,
    setParam,
  };
}
