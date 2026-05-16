/**
 * PantheonKeyboard.tsx — The Divine Keys
 * 2.5-octave playable keyboard (C3 → F5) with pitch/mod wheels,
 * velocity-from-Y, active note highlighting, voice mode selector,
 * and QWERTY keyboard integration with octave transposition.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ElectricPantheonGod } from '@/data/electricPantheonGods';

interface PantheonKeyboardProps {
  god: ElectricPantheonGod;
  pitchBend: number;
  modWheel: number;
  onPitchBendChange: (value: number) => void;
  onModWheelChange: (value: number) => void;
  onNoteOn?: (note: number, velocity: number) => void;
  onNoteOff?: (note: number) => void;
  onVoiceModeChange?: (mode: VoiceMode) => void;
  /** Set of MIDI notes currently triggered by QWERTY keyboard */
  qwertyActiveNotes?: Set<number>;
  /** Current QWERTY base octave for display */
  currentOctave?: number;
  /** Shift octave up */
  onOctaveUp?: () => void;
  /** Shift octave down */
  onOctaveDown?: () => void;
}

type VoiceMode = 'POLY' | 'MONO' | 'LEGATO';

/* ─── Note Definitions (C3 = MIDI 48 → F5 = MIDI 77) ─── */
interface KeyDef {
  midi: number;
  name: string;
  isBlack: boolean;
  /** Position offset for black keys */
  offset?: number;
}

function buildKeyRange(): KeyDef[] {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keys: KeyDef[] = [];

  // C3 (MIDI 48) through F5 (MIDI 77)
  for (let midi = 48; midi <= 77; midi++) {
    const noteIdx = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    const name = noteNames[noteIdx] + octave;
    const isBlack = [1, 3, 6, 8, 10].includes(noteIdx);
    keys.push({ midi, name, isBlack });
  }

  return keys;
}

const ALL_KEYS = buildKeyRange();
const WHITE_KEYS = ALL_KEYS.filter((k) => !k.isBlack);
const BLACK_KEYS = ALL_KEYS.filter((k) => k.isBlack);

/** Maps a black key MIDI number to its X position relative to the white key layout */
function getBlackKeyPosition(midi: number, whiteKeys: KeyDef[]): number {
  // Find the white key just before this black key
  const prevWhiteIdx = whiteKeys.findIndex((wk) => wk.midi > midi) - 1;
  if (prevWhiteIdx < 0) return 0;
  // Black key sits between two white keys, offset to the right edge of the previous one
  return prevWhiteIdx + 0.65;
}

export const PantheonKeyboard: React.FC<PantheonKeyboardProps> = ({
  god,
  pitchBend,
  modWheel,
  onPitchBendChange,
  onModWheelChange,
  onNoteOn,
  onNoteOff,
  onVoiceModeChange,
  qwertyActiveNotes,
  currentOctave = 3,
  onOctaveUp,
  onOctaveDown,
}) => {
  const [mouseActiveNotes, setMouseActiveNotes] = useState<Set<number>>(new Set());
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('POLY');
  const keyboardRef = useRef<HTMLDivElement>(null);

  // Merge mouse-triggered and QWERTY-triggered notes for display
  const activeNotes = useMemo(() => {
    const merged = new Set(mouseActiveNotes);
    if (qwertyActiveNotes) {
      for (const n of qwertyActiveNotes) merged.add(n);
    }
    return merged;
  }, [mouseActiveNotes, qwertyActiveNotes]);

  // Pitch wheel drag
  const pitchDragRef = useRef<boolean>(false);
  const modDragRef = useRef<boolean>(false);

  const handleKeyDown = useCallback(
    (midi: number, e: React.MouseEvent) => {
      // Calculate velocity from Y position on the key (top = soft, bottom = hard)
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const yRatio = (e.clientY - rect.top) / rect.height;
      const velocity = Math.round(30 + yRatio * 97); // 30-127 range

      setMouseActiveNotes((prev) => {
        const next = new Set(prev);
        next.add(midi);
        return next;
      });

      onNoteOn?.(midi, Math.min(127, velocity));
    },
    [onNoteOn]
  );

  const handleKeyUp = useCallback(
    (midi: number) => {
      setMouseActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });
      onNoteOff?.(midi);
    },
    [onNoteOff]
  );

  const handleWheelDrag = useCallback(
    (e: React.MouseEvent, type: 'pitch' | 'mod') => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const yRatio = 1 - (e.clientY - rect.top) / rect.height;
      const clamped = Math.max(0, Math.min(1, yRatio));

      if (type === 'pitch') {
        // Pitch: -1 to +1 centered
        onPitchBendChange((clamped - 0.5) * 2);
      } else {
        // Mod: 0 to 127
        onModWheelChange(Math.round(clamped * 127));
      }
    },
    [onPitchBendChange, onModWheelChange]
  );

  const whiteKeyWidth = 100 / WHITE_KEYS.length;

  return (
    <div
      className="ep-keyboard"
      style={{ '--god-primary': god.colors.primary, '--god-accent': god.colors.accent } as React.CSSProperties}
    >
      {/* ── Pitch Wheel ── */}
      <div className="ep-keyboard-wheels">
        <div
          className="ep-wheel-container"
          onMouseDown={() => { pitchDragRef.current = true; }}
          onMouseUp={() => { pitchDragRef.current = false; onPitchBendChange(0); }}
          onMouseLeave={() => { if (pitchDragRef.current) { pitchDragRef.current = false; onPitchBendChange(0); } }}
          onMouseMove={(e) => { if (pitchDragRef.current) handleWheelDrag(e, 'pitch'); }}
        >
          <span className="ep-wheel-label">PITCH</span>
          <div className="ep-wheel-track">
            <motion.div
              className="ep-wheel-thumb"
              animate={{ y: `${(0.5 - pitchBend / 2) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
            <div className="ep-wheel-center-line" />
          </div>
          <span className="ep-wheel-value">
            {pitchBend > 0 ? '+' : ''}{(pitchBend * 24).toFixed(0)} ST
          </span>
        </div>

        <div
          className="ep-wheel-container"
          onMouseDown={() => { modDragRef.current = true; }}
          onMouseUp={() => { modDragRef.current = false; }}
          onMouseLeave={() => { modDragRef.current = false; }}
          onMouseMove={(e) => { if (modDragRef.current) handleWheelDrag(e, 'mod'); }}
        >
          <span className="ep-wheel-label">MOD</span>
          <div className="ep-wheel-track">
            <motion.div
              className="ep-wheel-thumb ep-wheel-thumb--mod"
              animate={{ y: `${(1 - modWheel / 127) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
          <span className="ep-wheel-value">{modWheel}</span>
        </div>
      </div>

      {/* ── Piano Keys ── */}
      <div className="ep-keyboard-keys" ref={keyboardRef}>
        {/* White Keys */}
        <div className="ep-keyboard-whites">
          {WHITE_KEYS.map((key) => {
            const isActive = activeNotes.has(key.midi);
            return (
              <button
                key={key.midi}
                className={`ep-key ep-key--white ${isActive ? 'ep-key--active' : ''}`}
                style={{ width: `${whiteKeyWidth}%` }}
                onMouseDown={(e) => handleKeyDown(key.midi, e)}
                onMouseUp={() => handleKeyUp(key.midi)}
                onMouseLeave={() => { if (mouseActiveNotes.has(key.midi)) handleKeyUp(key.midi); }}
                aria-label={key.name}
              >
                <span className="ep-key-label">{key.name}</span>
                {isActive && (
                  <motion.div
                    className="ep-key-glow"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ backgroundColor: god.colors.primary }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Black Keys */}
        <div className="ep-keyboard-blacks">
          {BLACK_KEYS.map((key) => {
            const isActive = activeNotes.has(key.midi);
            const xPos = getBlackKeyPosition(key.midi, WHITE_KEYS);
            return (
              <button
                key={key.midi}
                className={`ep-key ep-key--black ${isActive ? 'ep-key--active' : ''}`}
                style={{
                  left: `${(xPos / WHITE_KEYS.length) * 100}%`,
                  width: `${whiteKeyWidth * 0.6}%`,
                }}
                onMouseDown={(e) => handleKeyDown(key.midi, e)}
                onMouseUp={() => handleKeyUp(key.midi)}
                onMouseLeave={() => { if (mouseActiveNotes.has(key.midi)) handleKeyUp(key.midi); }}
                aria-label={key.name}
              >
                {isActive && (
                  <motion.div
                    className="ep-key-glow ep-key-glow--black"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ backgroundColor: god.colors.primary }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right Controls ── */}
      <div className="ep-keyboard-controls">
        {/* Voice Mode Selector */}
        <div className="ep-voice-mode">
          <span className="ep-voice-mode-label">VOICE</span>
          {(['POLY', 'MONO', 'LEGATO'] as VoiceMode[]).map((mode) => (
            <button
              key={mode}
              className={`ep-voice-mode-btn ${voiceMode === mode ? 'active' : ''}`}
              onClick={() => { setVoiceMode(mode); onVoiceModeChange?.(mode); }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Octave Controls */}
        <div className="ep-octave-display">
          <button
            className="ep-octave-btn"
            onClick={onOctaveDown}
            disabled={currentOctave <= 1}
            title="Octave Down (Z)"
          >
            ▼
          </button>
          <div className="ep-octave-info">
            <span className="ep-octave-label">C{currentOctave}</span>
            <span className="ep-octave-range">OCT {currentOctave}</span>
          </div>
          <button
            className="ep-octave-btn"
            onClick={onOctaveUp}
            disabled={currentOctave >= 7}
            title="Octave Up (X)"
          >
            ▲
          </button>
        </div>

        {/* QWERTY Indicator */}
        <div className="ep-qwerty-badge">
          <span className="ep-qwerty-badge-icon">⌨</span>
          <span className="ep-qwerty-badge-label">QWERTY</span>
        </div>
      </div>
    </div>
  );
};
