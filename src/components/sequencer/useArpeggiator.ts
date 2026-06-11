/**
 * useArpeggiator — React hook wrapping ArpeggiatorEngine
 *
 * Manages arp engine lifecycle, config state, and bridges
 * MIDI note input to the synth engine through the arpeggiator.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArpeggiatorEngine, DEFAULT_ARP_CONFIG } from '../../audio/ArpeggiatorEngine';
import type { ArpConfig } from '../../audio/ArpeggiatorEngine';
import type { PantheonSynthEngine } from '../../audio/PantheonSynthEngine';

interface UseArpeggiatorProps {
  synthEngine: PantheonSynthEngine | null;
  bpm: number;
  octave: number;
  enabled: boolean;
}

export function useArpeggiator({ synthEngine, bpm, octave, enabled }: UseArpeggiatorProps) {
  const engineRef = useRef<ArpeggiatorEngine | null>(null);
  const [config, setConfig] = useState<ArpConfig>({ ...DEFAULT_ARP_CONFIG });
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [heldNoteCount, setHeldNoteCount] = useState(0);
  const octaveRef = useRef(octave);

  useEffect(() => { octaveRef.current = octave; }, [octave]);

  // Initialize engine
  useEffect(() => {
    const engine = new ArpeggiatorEngine();
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Connect synth engine callbacks
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !synthEngine) return;

    engine.setCallbacks(
      (note, velocity) => {
        const adjusted = note + (octaveRef.current * 12);
        synthEngine.noteOn(adjusted, velocity);
      },
      (note) => {
        const adjusted = note + (octaveRef.current * 12);
        synthEngine.noteOff(adjusted);
      }
    );
  }, [synthEngine]);

  // Sync BPM
  useEffect(() => {
    engineRef.current?.setBPM(bpm);
  }, [bpm]);

  // Sync config
  useEffect(() => {
    engineRef.current?.setConfig(config);
  }, [config]);

  // UI state polling (for visualization)
  useEffect(() => {
    if (!enabled || !config.enabled) return;
    const interval = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      setIsRunning(engine.getIsRunning());
      setCurrentStep(engine.getCurrentStep());
      setSequence(engine.getSequence());
      setHeldNoteCount(engine.getHeldNotes().length);
    }, 50); // 20fps UI update
    return () => clearInterval(interval);
  }, [enabled, config.enabled]);

  // Update config
  const updateConfig = useCallback((changes: Partial<ArpConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...changes };
      engineRef.current?.setConfig(next);
      return next;
    });
  }, []);

  // Note input methods (called by useMidiNoteInput when arp is active)
  const arpNoteOn = useCallback((note: number, velocity: number) => {
    engineRef.current?.noteOn(note, velocity);
    setHeldNoteCount(engineRef.current?.getHeldNotes().length ?? 0);
  }, []);

  const arpNoteOff = useCallback((note: number) => {
    engineRef.current?.noteOff(note);
    setHeldNoteCount(engineRef.current?.getHeldNotes().length ?? 0);
  }, []);

  return {
    config,
    isRunning,
    currentStep,
    sequence,
    heldNoteCount,
    updateConfig,
    arpNoteOn,
    arpNoteOff,
  };
}
