/**
 * usePantheonQwerty.ts — QWERTY-to-MIDI Keyboard Input Hook
 * Maps computer keyboard keys to MIDI notes using the standard DAW two-row layout.
 *
 * Layout:
 *   Upper row:  W E   T Y U   O P      → C# D#   F# G# A#   C# D#  (sharps)
 *   Home row:  A S D F G H J K L ; '   → C  D  E  F  G  A  B  C  D  E  F  (naturals)
 *
 * Features:
 * - Z/X: Octave down/up (range C1–C7)
 * - Shift: Soft velocity (50), Normal: Medium (90), Ctrl/Cmd: Hard (127)
 * - Focus-aware: Only fires when the container has focus
 * - Proper note-off tracking to prevent stuck notes
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/** The QWERTY key → semitone offset mapping (relative to current octave's C) */
const QWERTY_MAP: Record<string, number> = {
  // Home row: naturals
  'a': 0,   // C
  's': 2,   // D
  'd': 4,   // E
  'f': 5,   // F
  'g': 7,   // G
  'h': 9,   // A
  'j': 11,  // B
  'k': 12,  // C+1
  'l': 14,  // D+1
  ';': 16,  // E+1
  "'": 17,  // F+1

  // Upper row: sharps
  'w': 1,   // C#
  'e': 3,   // D#
  't': 6,   // F#
  'y': 8,   // G#
  'u': 10,  // A#
  'o': 13,  // C#+1
  'p': 15,  // D#+1
};

interface UsePantheonQwertyOptions {
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
  /** Ref to the container element for focus detection */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Whether QWERTY input is enabled */
  enabled?: boolean;
}

interface UsePantheonQwertyReturn {
  /** Current base octave (C of the home-row 'A' key) */
  octave: number;
  /** Set of currently active MIDI notes from QWERTY */
  activeQwertyNotes: Set<number>;
  /** Shift octave up */
  octaveUp: () => void;
  /** Shift octave down */
  octaveDown: () => void;
}

export function usePantheonQwerty({
  onNoteOn,
  onNoteOff,
  containerRef,
  enabled = true,
}: UsePantheonQwertyOptions): UsePantheonQwertyReturn {
  const [octave, setOctave] = useState(3); // C3 = MIDI 48
  const [activeQwertyNotes, setActiveQwertyNotes] = useState<Set<number>>(new Set());

  // Refs for stable callback access
  const octaveRef = useRef(octave);
  octaveRef.current = octave;

  // Track which physical keys are held → MIDI note they triggered
  const heldKeysRef = useRef<Map<string, number>>(new Map());

  const octaveUp = useCallback(() => {
    setOctave(prev => Math.min(prev + 1, 7));
  }, []);

  const octaveDown = useCallback(() => {
    setOctave(prev => Math.max(prev - 1, 1));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const getVelocity = (e: KeyboardEvent): number => {
      if (e.shiftKey) return 50;   // Soft
      if (e.ctrlKey || e.metaKey) return 127; // Hard
      return 90; // Normal
    };

    const keyToMidi = (key: string, currentOctave: number): number | null => {
      const semitone = QWERTY_MAP[key.toLowerCase()];
      if (semitone === undefined) return null;
      // MIDI note: (octave + 1) * 12 + semitone → C3 = (3+1)*12 = 48
      const midi = (currentOctave + 1) * 12 + semitone;
      // Clamp to valid MIDI range
      if (midi < 0 || midi > 127) return null;
      return midi;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Check focus: only fire if our container or its descendants are focused
      const container = containerRef.current;
      if (!container) return;
      if (!container.contains(document.activeElement) && document.activeElement !== container) return;

      const key = e.key.toLowerCase();

      // Octave controls
      if (key === 'z') {
        e.preventDefault();
        setOctave(prev => Math.max(prev - 1, 1));
        return;
      }
      if (key === 'x') {
        e.preventDefault();
        setOctave(prev => Math.min(prev + 1, 7));
        return;
      }

      // Prevent key repeat from re-triggering
      if (e.repeat) return;

      const midi = keyToMidi(key, octaveRef.current);
      if (midi === null) return;

      e.preventDefault();

      // Track the physical key → MIDI mapping so we release the right note
      // even if the octave changed while the key was held
      heldKeysRef.current.set(key, midi);

      setActiveQwertyNotes(prev => {
        const next = new Set(prev);
        next.add(midi);
        return next;
      });

      onNoteOn(midi, getVelocity(e));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Look up which MIDI note this physical key triggered
      const midi = heldKeysRef.current.get(key);
      if (midi === undefined) return;

      e.preventDefault();
      heldKeysRef.current.delete(key);

      setActiveQwertyNotes(prev => {
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });

      onNoteOff(midi);
    };

    // Handle window blur (release all held notes to prevent stuck notes)
    const handleBlur = () => {
      for (const [key, midi] of heldKeysRef.current.entries()) {
        onNoteOff(midi);
      }
      heldKeysRef.current.clear();
      setActiveQwertyNotes(new Set());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);

      // Release any still-held notes on cleanup
      for (const [, midi] of heldKeysRef.current.entries()) {
        onNoteOff(midi);
      }
      heldKeysRef.current.clear();
    };
  }, [enabled, onNoteOn, onNoteOff, containerRef]);

  return { octave, activeQwertyNotes, octaveUp, octaveDown };
}
