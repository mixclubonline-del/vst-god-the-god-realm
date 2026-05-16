/**
 * noteUtils.ts — MIDI Note Name ↔ Number Conversion
 * Converts note names like "C4", "F#3", "Db5", "Ab0" to MIDI numbers and back.
 * Convention: C4 = 60 (middle C).
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Maps flat notation to sharp equivalents for canonical lookup.
 * e.g. "Db" → "C#", "Gb" → "F#"
 */
const FLAT_TO_SHARP: Record<string, string> = {
  'Db': 'C#',
  'Eb': 'D#',
  'Fb': 'E',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#',
  'Cb': 'B',
};

/**
 * Parses a note name string into a MIDI note number.
 * Supports sharps (#) and flats (b).
 *
 * @param name - Note name string, e.g. "C4", "F#3", "Db5", "Ab0"
 * @returns MIDI note number (0-127), or 60 (C4) if unparseable
 *
 * @example
 *   noteNameToMidi("C4")   // 60
 *   noteNameToMidi("A4")   // 69
 *   noteNameToMidi("F#3")  // 54
 *   noteNameToMidi("Db5")  // 73
 *   noteNameToMidi("G0")   // 19 (not 7 — our convention uses C-1 = 0)
 */
export function noteNameToMidi(name: string): number {
  if (!name || name.length < 2) return 60;

  // Extract pitch class and octave
  const match = name.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 60;

  let pitchClass = match[1];
  const octave = parseInt(match[2], 10);

  // Capitalize first letter
  pitchClass = pitchClass.charAt(0).toUpperCase() + pitchClass.slice(1);

  // Convert flat to sharp
  if (FLAT_TO_SHARP[pitchClass]) {
    pitchClass = FLAT_TO_SHARP[pitchClass];
  }

  const semitone = NOTE_NAMES.indexOf(pitchClass);
  if (semitone < 0) return 60;

  // MIDI: C-1 = 0, so C4 = (4+1)*12 + 0 = 60
  const midi = (octave + 1) * 12 + semitone;
  return Math.max(0, Math.min(127, midi));
}

/**
 * Converts a MIDI note number back to a note name string.
 *
 * @param midi - MIDI note number (0-127)
 * @returns Note name string, e.g. "C4", "F#3"
 */
export function midiToNoteName(midi: number): string {
  const clamped = Math.max(0, Math.min(127, Math.round(midi)));
  const octave = Math.floor(clamped / 12) - 1;
  const semitone = clamped % 12;
  return `${NOTE_NAMES[semitone]}${octave}`;
}
