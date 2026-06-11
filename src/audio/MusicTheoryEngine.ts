/**
 * MusicTheoryEngine — Scale & Chord Intelligence
 *
 * Provides scale-aware note filtering, chord detection, and chord suggestions
 * for the Piano Roll and MIDI input systems.
 */

// ─── Scale Definitions ───

export type ScaleType =
  | 'major' | 'minor' | 'harmonicMinor' | 'melodicMinor'
  | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'
  | 'pentatonicMajor' | 'pentatonicMinor' | 'blues'
  | 'chromatic';

export type RootNote = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface ScaleConfig {
  root: RootNote;
  type: ScaleType;
  enabled: boolean;
}

export const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  root: 0, // C
  type: 'minor',
  enabled: false,
};

export const ROOT_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const SCALE_LABELS: Record<ScaleType, string> = {
  major: 'Major (Ionian)',
  minor: 'Natural Minor (Aeolian)',
  harmonicMinor: 'Harmonic Minor',
  melodicMinor: 'Melodic Minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  locrian: 'Locrian',
  pentatonicMajor: 'Pentatonic Major',
  pentatonicMinor: 'Pentatonic Minor',
  blues: 'Blues',
  chromatic: 'Chromatic',
};

// Intervals from root (semitones)
const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major:           [0, 2, 4, 5, 7, 9, 11],
  minor:           [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor:   [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:    [0, 2, 3, 5, 7, 9, 11],
  dorian:          [0, 2, 3, 5, 7, 9, 10],
  phrygian:        [0, 1, 3, 5, 7, 8, 10],
  lydian:          [0, 2, 4, 6, 7, 9, 11],
  mixolydian:      [0, 2, 4, 5, 7, 9, 10],
  locrian:         [0, 1, 3, 5, 6, 8, 10],
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],
  blues:           [0, 3, 5, 6, 7, 10],
  chromatic:       [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

// ─── Scale Functions ───

/** Get the pitch classes (0-11) in a given scale */
export function getScaleNotes(root: RootNote, type: ScaleType): number[] {
  return SCALE_INTERVALS[type].map(interval => (root + interval) % 12);
}

/** Check if a MIDI note belongs to the given scale */
export function isNoteInScale(midiNote: number, root: RootNote, type: ScaleType): boolean {
  const pitchClass = midiNote % 12;
  return getScaleNotes(root, type).includes(pitchClass);
}

/** Snap a MIDI note to the nearest note in the scale */
export function snapToScale(midiNote: number, root: RootNote, type: ScaleType): number {
  if (isNoteInScale(midiNote, root, type)) return midiNote;

  const scaleNotes = getScaleNotes(root, type);
  const pitchClass = midiNote % 12;
  const octave = Math.floor(midiNote / 12);

  // Find closest scale pitch class
  let bestDist = Infinity;
  let bestPC = pitchClass;
  for (const spc of scaleNotes) {
    const dist = Math.min(
      Math.abs(spc - pitchClass),
      12 - Math.abs(spc - pitchClass)
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestPC = spc;
    }
  }

  let result = octave * 12 + bestPC;
  // If the closest was below our pitch class, it might be in the octave above
  if (Math.abs(result - midiNote) > 6) {
    result = result < midiNote ? result + 12 : result - 12;
  }
  return result;
}

/** Get the scale degree (1-7) for a note, or 0 if not in scale */
export function getScaleDegree(midiNote: number, root: RootNote, type: ScaleType): number {
  const pitchClass = midiNote % 12;
  const scaleNotes = getScaleNotes(root, type);
  const idx = scaleNotes.indexOf(pitchClass);
  return idx >= 0 ? idx + 1 : 0;
}


// ─── Chord Definitions ───

export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented' | 'sus2' | 'sus4' |
  'major7' | 'minor7' | 'dominant7' | 'diminished7' | 'halfDiminished7';

export interface ChordInfo {
  root: number;       // pitch class 0-11
  quality: ChordQuality;
  name: string;       // e.g. "Cm", "G7"
  notes: number[];    // pitch classes
}

const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  major:            [0, 4, 7],
  minor:            [0, 3, 7],
  diminished:       [0, 3, 6],
  augmented:        [0, 4, 8],
  sus2:             [0, 2, 7],
  sus4:             [0, 5, 7],
  major7:           [0, 4, 7, 11],
  minor7:           [0, 3, 7, 10],
  dominant7:        [0, 4, 7, 10],
  diminished7:      [0, 3, 6, 9],
  halfDiminished7:  [0, 3, 6, 10],
};

const CHORD_SUFFIXES: Record<ChordQuality, string> = {
  major: '', minor: 'm', diminished: 'dim', augmented: 'aug',
  sus2: 'sus2', sus4: 'sus4',
  major7: 'maj7', minor7: 'm7', dominant7: '7',
  diminished7: 'dim7', halfDiminished7: 'm7♭5',
};

/** Build a chord from root pitch class and quality */
export function buildChord(root: RootNote, quality: ChordQuality): ChordInfo {
  const intervals = CHORD_INTERVALS[quality];
  const notesPCs = intervals.map(i => (root + i) % 12);
  return {
    root,
    quality,
    name: `${ROOT_NOTE_NAMES[root]}${CHORD_SUFFIXES[quality]}`,
    notes: notesPCs,
  };
}

/** Get MIDI notes for a chord at a specific octave */
export function chordToMidi(chord: ChordInfo, octave: number): number[] {
  const base = (octave + 1) * 12; // C at that octave
  return chord.notes.map(pc => {
    const midi = base + pc;
    return midi;
  });
}


// ─── Diatonic Chord Suggestions ───

// Triad qualities for each scale degree in major/minor
const MAJOR_TRIADS: ChordQuality[] = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
const MINOR_TRIADS: ChordQuality[] = ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'];

/** Get diatonic chords for a scale (triads built on each scale degree) */
export function getDiatonicChords(root: RootNote, type: ScaleType): ChordInfo[] {
  const scaleNotes = getScaleNotes(root, type);
  const qualities = type === 'major' || type === 'lydian' || type === 'mixolydian'
    ? MAJOR_TRIADS
    : type === 'minor' || type === 'dorian' || type === 'phrygian'
    ? MINOR_TRIADS
    : MAJOR_TRIADS; // fallback

  return scaleNotes.slice(0, 7).map((pc, i) => {
    const quality = qualities[i % qualities.length];
    return buildChord(pc as RootNote, quality);
  });
}


// ─── Chord Detection ───

/** Detect what chord is formed by a set of MIDI notes */
export function detectChord(midiNotes: number[]): ChordInfo | null {
  if (midiNotes.length < 3) return null;

  const pitchClasses = [...new Set(midiNotes.map(n => n % 12))].sort((a, b) => a - b);
  if (pitchClasses.length < 3) return null;

  // Try each pitch class as potential root
  for (const rootPC of pitchClasses) {
    const intervals = pitchClasses.map(pc => (pc - rootPC + 12) % 12).sort((a, b) => a - b);
    const intervalKey = intervals.join(',');

    // Check against known chord shapes
    for (const [quality, shape] of Object.entries(CHORD_INTERVALS)) {
      const shapeKey = shape.join(',');
      if (intervalKey === shapeKey) {
        return buildChord(rootPC as RootNote, quality as ChordQuality);
      }
    }
  }

  return null;
}


// ─── Common Progressions ───

export interface ChordProgression {
  id: string;
  name: string;
  degrees: number[]; // 1-indexed scale degrees
  description: string;
}

export const COMMON_PROGRESSIONS: ChordProgression[] = [
  { id: '1-4-5', name: 'I-IV-V', degrees: [1, 4, 5], description: 'Classic rock/pop' },
  { id: '1-5-6-4', name: 'I-V-vi-IV', degrees: [1, 5, 6, 4], description: 'Pop anthem' },
  { id: '2-5-1', name: 'ii-V-I', degrees: [2, 5, 1], description: 'Jazz standard' },
  { id: '1-6-4-5', name: 'I-vi-IV-V', degrees: [1, 6, 4, 5], description: '50s progression' },
  { id: '6-4-1-5', name: 'vi-IV-I-V', degrees: [6, 4, 1, 5], description: 'Emotional pop' },
  { id: '1-4-6-5', name: 'I-IV-vi-V', degrees: [1, 4, 6, 5], description: 'Modern pop' },
  { id: '4-5-3-6', name: 'IV-V-iii-vi', degrees: [4, 5, 3, 6], description: 'Royal Road (J-pop)' },
  { id: '1-3-4-4m', name: 'I-III-IV', degrees: [1, 3, 4], description: 'Blues feeling' },
  { id: '6-5-4-5', name: 'vi-V-IV-V', degrees: [6, 5, 4, 5], description: 'Trap/hip-hop' },
];

/** Get a chord progression as concrete chords in a given key */
export function resolveProgression(
  progression: ChordProgression,
  root: RootNote,
  scaleType: ScaleType
): ChordInfo[] {
  const diatonic = getDiatonicChords(root, scaleType);
  return progression.degrees.map(deg => diatonic[(deg - 1) % diatonic.length]);
}
