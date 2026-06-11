/**
 * MiniKeyboard.tsx — Compact Piano Keyboard for Plugin Windows
 * 2-octave touch/click keyboard that triggers noteOn/noteOff.
 */

import React, { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

interface MiniKeyboardProps {
  onNoteOn: (midi: number, velocity?: number) => void;
  onNoteOff: (midi: number) => void;
  startNote?: number;  // MIDI number for lowest key (default C3 = 48)
  octaves?: number;    // Number of octaves (default 2)
  color?: string;      // Accent color for pressed state
}

const KEY_PATTERN = [
  { note: 0, black: false, label: 'C' },
  { note: 1, black: true, label: 'C#' },
  { note: 2, black: false, label: 'D' },
  { note: 3, black: true, label: 'D#' },
  { note: 4, black: false, label: 'E' },
  { note: 5, black: false, label: 'F' },
  { note: 6, black: true, label: 'F#' },
  { note: 7, black: false, label: 'G' },
  { note: 8, black: true, label: 'G#' },
  { note: 9, black: false, label: 'A' },
  { note: 10, black: true, label: 'A#' },
  { note: 11, black: false, label: 'B' },
];

export const MiniKeyboard: React.FC<MiniKeyboardProps> = ({
  onNoteOn,
  onNoteOff,
  startNote = 48,
  octaves = 2,
  color = '#B87DFF',
}) => {
  const activeNotes = useRef(new Set<number>());

  const handlePointerDown = useCallback((midi: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    activeNotes.current.add(midi);
    onNoteOn(midi, 100);
  }, [onNoteOn]);

  const handlePointerUp = useCallback((midi: number) => () => {
    if (activeNotes.current.has(midi)) {
      activeNotes.current.delete(midi);
      onNoteOff(midi);
    }
  }, [onNoteOff]);

  const keys: { midi: number; black: boolean; label: string }[] = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (const k of KEY_PATTERN) {
      keys.push({
        midi: startNote + oct * 12 + k.note,
        black: k.black,
        label: k.label,
      });
    }
  }

  const whiteKeys = keys.filter(k => !k.black);
  const blackKeys = keys.filter(k => k.black);

  return (
    <div className="fp-keyboard" style={{ '--kb-accent': color } as React.CSSProperties}>
      <div className="fp-keyboard__whites">
        {whiteKeys.map(k => (
          <motion.div
            key={k.midi}
            className="fp-keyboard__white"
            onPointerDown={handlePointerDown(k.midi)}
            onPointerUp={handlePointerUp(k.midi)}
            onPointerLeave={handlePointerUp(k.midi)}
            whileTap={{ backgroundColor: color, scale: 0.98 }}
          />
        ))}
      </div>
      <div className="fp-keyboard__blacks">
        {blackKeys.map(k => {
          // Calculate black key position
          const whiteIdx = whiteKeys.findIndex(
            w => w.midi === k.midi - 1 || (k.midi % 12 === 1 && w.midi === k.midi - 1)
          );
          const noteInOctave = k.midi % 12;
          // Position black keys between whites
          const offsets: Record<number, number> = { 1: 0.65, 3: 1.65, 6: 3.65, 8: 4.65, 10: 5.65 };
          const octOffset = Math.floor((k.midi - startNote) / 12);
          const xPos = (offsets[noteInOctave] ?? 0) + octOffset * 7;
          const totalWhites = whiteKeys.length;
          const pct = (xPos / totalWhites) * 100;

          return (
            <motion.div
              key={k.midi}
              className="fp-keyboard__black"
              style={{ left: `${pct}%` }}
              onPointerDown={handlePointerDown(k.midi)}
              onPointerUp={handlePointerUp(k.midi)}
              onPointerLeave={handlePointerUp(k.midi)}
              whileTap={{ backgroundColor: color }}
            />
          );
        })}
      </div>
    </div>
  );
};
