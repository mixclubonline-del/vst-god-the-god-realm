/**
 * useMidiNoteInput — MIDI Note Recording into Piano Roll
 *
 * Listens for MIDI note_on/note_off events from the NeuralInputBus.
 * When recording is active and a synth track is selected:
 *  - Plays notes through PantheonSynthEngine in real-time (live monitoring)
 *  - Records notes into the Piano Roll with proper timing and duration
 *
 * Records during playback: notes are quantized to the current step position.
 * Records while stopped: notes stack on step 0 (free-play / audition mode).
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { neuralInputBus } from '../../services/neuralInputBus';
import type { NeuralInputEvent } from '../../services/types';
import type { PianoRollNote } from './useSequencerEngine';
import { generatePianoNoteId } from './useSequencerEngine';
import type { PantheonSynthEngine } from '../../audio/PantheonSynthEngine';
import type { ScaleConfig } from '../../audio/MusicTheoryEngine';
import { snapToScale } from '../../audio/MusicTheoryEngine';

interface UseMidiNoteInputProps {
  /** Whether MIDI note input is armed for this track */
  isArmed: boolean;
  /** Whether the sequencer is recording */
  isRecording: boolean;
  /** Whether the sequencer is playing */
  isPlaying: boolean;
  /** Current step position (for recording) */
  currentStep: number;
  /** Step count for wrapping */
  stepCount: number;
  /** BPM for duration calculation */
  bpm: number;
  /** Octave offset from the synth track config */
  octave: number;
  /** Synth engine for live audition */
  synthEngine: PantheonSynthEngine | null;
  /** Callback to add a recorded note to the Piano Roll */
  onAddNote: (note: PianoRollNote) => void;
  /** Scale config for note snapping during recording */
  scaleConfig?: ScaleConfig;
}

interface ActiveMidiNote {
  midiNote: number;
  startStep: number;
  startTime: number;
  velocity: number;
}

export function useMidiNoteInput({
  isArmed,
  isRecording,
  isPlaying,
  currentStep,
  stepCount,
  bpm,
  octave,
  synthEngine,
  onAddNote,
  scaleConfig,
}: UseMidiNoteInputProps) {
  // Track active notes (held down, awaiting note off)
  const activeNotes = useRef<Map<number, ActiveMidiNote>>(new Map());
  // Track latest step for recording (since currentStep changes between renders)
  const currentStepRef = useRef(currentStep);
  const isPlayingRef = useRef(isPlaying);
  const isRecordingRef = useRef(isRecording);
  const bpmRef = useRef(bpm);
  const octaveRef = useRef(octave);

  // Live input indicator
  const [liveNotes, setLiveNotes] = useState<number[]>([]);

  // Keep refs in sync
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { octaveRef.current = octave; }, [octave]);

  const handleMidiEvent = useCallback((event: NeuralInputEvent) => {
    if (!isArmed) return;
    if (event.note === undefined) return;

    const midiNote = event.note;

    // ─── Note On ───
    if (event.type === 'midi_note_on') {
      const velocity7bit = Math.round((event.velocity / 65535) * 127);

      // Live audition: play through synth engine immediately
      if (synthEngine) {
        const adjustedNote = midiNote + (octaveRef.current * 12);
        synthEngine.noteOn(adjustedNote, velocity7bit);
      }

      // Track for live input indicator
      setLiveNotes(prev => [...prev, midiNote]);

      // Record: store start info
      const recordStep = isPlayingRef.current ? Math.max(0, currentStepRef.current) : 0;
      activeNotes.current.set(midiNote, {
        midiNote,
        startStep: recordStep,
        startTime: performance.now(),
        velocity: velocity7bit,
      });
    }

    // ─── Note Off ───
    if (event.type === 'midi_note_off') {
      // Live audition: release note
      if (synthEngine) {
        const adjustedNote = midiNote + (octaveRef.current * 12);
        synthEngine.noteOff(adjustedNote);
      }

      // Remove from live indicator
      setLiveNotes(prev => prev.filter(n => n !== midiNote));

      // Record: calculate duration and create PianoRollNote
      const active = activeNotes.current.get(midiNote);
      if (active && isRecordingRef.current) {
        activeNotes.current.delete(midiNote);

        // Calculate duration in steps
        const elapsedMs = performance.now() - active.startTime;
        const stepDurationMs = (60 / bpmRef.current / 4) * 1000; // ms per step
        const durationSteps = Math.max(0.25, Math.round((elapsedMs / stepDurationMs) * 4) / 4); // Quantize to 1/16

        const newNote: PianoRollNote = {
          id: generatePianoNoteId(),
          note: scaleConfig?.enabled
            ? snapToScale(midiNote, scaleConfig.root, scaleConfig.type)
            : midiNote,
          startStep: active.startStep,
          duration: Math.min(durationSteps, stepCount), // Clamp to pattern length
          velocity: active.velocity,
        };

        onAddNote(newNote);
      } else {
        activeNotes.current.delete(midiNote);
      }
    }
  }, [isArmed, synthEngine, onAddNote, stepCount]);

  // Subscribe to NeuralInputBus
  useEffect(() => {
    if (!isArmed) return;
    const unsub = neuralInputBus.addListener(handleMidiEvent);
    return () => {
      unsub();
      // Release any stuck notes on cleanup
      if (synthEngine) {
        activeNotes.current.forEach((active) => {
          synthEngine.noteOff(active.midiNote + (octaveRef.current * 12));
        });
      }
      activeNotes.current.clear();
      setLiveNotes([]);
    };
  }, [isArmed, handleMidiEvent, synthEngine]);

  return {
    /** MIDI notes currently held down (for UI feedback) */
    liveNotes,
    /** Whether any notes are currently active */
    hasActiveInput: liveNotes.length > 0,
  };
}
