// ═══════════════════════════════════════════════════════════════
// useJuceBridge — React hook for real-time JUCE engine state
// ═══════════════════════════════════════════════════════════════
// Subscribes to the NativeAudioBridge and returns typed engine
// telemetry. Auto-unsubscribes on unmount. Falls back to
// simulation data when not inside JUCE.

import { useState, useEffect, useRef, useCallback } from 'react';
import { nativeAudio, EngineState, Midi2NoteEvent, TransportState } from '@/native/bridge';

export interface JuceBridgeState {
  /** Per-track peak levels (0.0 – 1.0+), 8 slots */
  slotLevels: number[];
  
  /** Master bus stereo peak */
  masterPeak: { left: number; right: number };
  
  /** Transport state from DAW host */
  transport: TransportState;
  
  /** Recent MIDI 2.0 note events (cleared each frame) */
  midiNotes: Midi2NoteEvent[];
  
  /** Sequencer step (0-15 for legacy compat) */
  arpStep: number;
  
  /** CPU / sample rate / buffer info */
  telemetry: {
    cpuUsage: number;
    sampleRate: number;
    bufferSize: number;
  };
}

const DEFAULT_STATE: JuceBridgeState = {
  slotLevels: new Array(8).fill(0),
  masterPeak: { left: 0, right: 0 },
  transport: { isPlaying: false, bpm: 140, ppq: 0, currentStep: 0 },
  midiNotes: [],
  arpStep: 0,
  telemetry: { cpuUsage: 0, sampleRate: 44100, bufferSize: 512 }
};

/**
 * Hook into the JUCE ↔ WebView state bridge.
 * Returns real engine data when inside JUCE standalone/VST3,
 * or simulated data in the browser dev harness.
 */
export function useJuceBridge(): JuceBridgeState {
  const [state, setState] = useState<JuceBridgeState>(DEFAULT_STATE);
  const stateRef = useRef(state);

  const handleUpdate = useCallback((engineState: Partial<EngineState>) => {
    const next: JuceBridgeState = {
      slotLevels: engineState.slotLevels ?? stateRef.current.slotLevels,
      masterPeak: {
        left: engineState.masterPeakL ?? stateRef.current.masterPeak.left,
        right: engineState.masterPeakR ?? stateRef.current.masterPeak.right,
      },
      transport: {
        isPlaying: engineState.isPlaying ?? stateRef.current.transport.isPlaying,
        bpm: engineState.bpm ?? stateRef.current.transport.bpm,
        ppq: engineState.ppq ?? stateRef.current.transport.ppq,
        currentStep: engineState.currentStep ?? stateRef.current.transport.currentStep,
      },
      midiNotes: engineState.midiNotes ?? [],
      arpStep: engineState.arpStep ?? stateRef.current.arpStep,
      telemetry: {
        cpuUsage: engineState.cpuUsage ?? stateRef.current.telemetry.cpuUsage,
        sampleRate: engineState.sampleRate ?? stateRef.current.telemetry.sampleRate,
        bufferSize: engineState.bufferSize ?? stateRef.current.telemetry.bufferSize,
      }
    };

    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const unsubscribe = nativeAudio.subscribe(handleUpdate);
    return () => { unsubscribe(); };
  }, [handleUpdate]);

  return state;
}

/**
 * Lightweight hook that only returns MIDI note events.
 * Use this for keyboard visualizers or note indicators
 * without subscribing to the full metering state.
 */
export function useJuceMidi(): Midi2NoteEvent[] {
  const { midiNotes } = useJuceBridge();
  return midiNotes;
}
