/**
 * SacredScaleChord — Scale Lock & Chord Intelligence Panel
 *
 * Compact panel showing:
 *  - Root note + scale type selection
 *  - Scale lock toggle
 *  - Diatonic chord buttons (click to insert into Piano Roll)
 *  - Common chord progression presets
 *  - Live chord detection display
 */
import React, { useCallback, useMemo } from 'react';
import type { ScaleConfig, ScaleType, RootNote, ChordInfo, ChordProgression } from '../../audio/MusicTheoryEngine';
import {
  ROOT_NOTE_NAMES, SCALE_LABELS,
  getDiatonicChords, resolveProgression,
  COMMON_PROGRESSIONS, chordToMidi,
} from '../../audio/MusicTheoryEngine';
import type { PianoRollNote } from './useSequencerEngine';
import { generatePianoNoteId } from './useSequencerEngine';
import './SacredScaleChord.css';

interface SacredScaleChordProps {
  config: ScaleConfig;
  onConfigChange: (changes: Partial<ScaleConfig>) => void;
  /** Detected chord from current piano roll selection */
  detectedChord: ChordInfo | null;
  /** Insert a chord into the Piano Roll at the given step */
  onInsertChord: (notes: PianoRollNote[]) => void;
  /** Current step for chord insertion */
  insertStep: number;
}

const SCALE_GROUPS: { label: string; types: ScaleType[] }[] = [
  { label: 'BASIC', types: ['major', 'minor', 'harmonicMinor', 'melodicMinor'] },
  { label: 'MODES', types: ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] },
  { label: 'PENTA', types: ['pentatonicMajor', 'pentatonicMinor', 'blues'] },
  { label: 'FREE', types: ['chromatic'] },
];

const DEGREE_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export const SacredScaleChord: React.FC<SacredScaleChordProps> = ({
  config,
  onConfigChange,
  detectedChord,
  onInsertChord,
  insertStep,
}) => {
  const diatonicChords = useMemo(() =>
    getDiatonicChords(config.root, config.type),
    [config.root, config.type]
  );

  const handleToggle = useCallback(() => {
    onConfigChange({ enabled: !config.enabled });
  }, [config.enabled, onConfigChange]);

  const handleRootChange = useCallback((root: RootNote) => {
    onConfigChange({ root });
  }, [onConfigChange]);

  const handleScaleChange = useCallback((type: ScaleType) => {
    onConfigChange({ type });
  }, [onConfigChange]);

  const handleChordInsert = useCallback((chord: ChordInfo) => {
    const midiNotes = chordToMidi(chord, 4); // Octave 4 (C4 = 60)
    const pianoNotes: PianoRollNote[] = midiNotes.map(note => ({
      id: generatePianoNoteId(),
      note,
      startStep: insertStep,
      duration: 4, // 1 beat (4 steps at 1/16)
      velocity: 90,
    }));
    onInsertChord(pianoNotes);
  }, [insertStep, onInsertChord]);

  const handleProgressionInsert = useCallback((prog: ChordProgression) => {
    const chords = resolveProgression(prog, config.root, config.type);
    const allNotes: PianoRollNote[] = [];
    chords.forEach((chord, i) => {
      const midiNotes = chordToMidi(chord, 4);
      midiNotes.forEach(note => {
        allNotes.push({
          id: generatePianoNoteId(),
          note,
          startStep: insertStep + (i * 4), // 1 beat spacing
          duration: 4,
          velocity: 85,
        });
      });
    });
    onInsertChord(allNotes);
  }, [config.root, config.type, insertStep, onInsertChord]);

  return (
    <div className={`sacred-scale ${config.enabled ? 'sacred-scale--active' : ''}`}>
      {/* Header */}
      <div className="sacred-scale__header">
        <button
          className={`sacred-scale__power ${config.enabled ? 'sacred-scale__power--on' : ''}`}
          onClick={handleToggle}
          title={config.enabled ? 'Disable Scale Lock' : 'Enable Scale Lock'}
        >
          {config.enabled ? '🔒' : '○'}
        </button>
        <span className="sacred-scale__title">SCALE &amp; CHORDS</span>
        {config.enabled && (
          <span className="sacred-scale__key">
            {ROOT_NOTE_NAMES[config.root]} {config.type === 'major' ? 'Major' : config.type === 'minor' ? 'Minor' : config.type}
          </span>
        )}
        {detectedChord && (
          <span className="sacred-scale__detected">
            🎵 {detectedChord.name}
          </span>
        )}
      </div>

      <div className="sacred-scale__body">
        {/* Root note selector */}
        <div className="sacred-scale__section">
          <span className="sacred-scale__label">ROOT</span>
          <div className="sacred-scale__root-grid">
            {ROOT_NOTE_NAMES.map((name, i) => (
              <button
                key={i}
                className={`sacred-scale__root-btn ${config.root === i ? 'sacred-scale__root-btn--active' : ''} ${[1,3,6,8,10].includes(i) ? 'sacred-scale__root-btn--sharp' : ''}`}
                onClick={() => handleRootChange(i as RootNote)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Scale type selector */}
        <div className="sacred-scale__section">
          <span className="sacred-scale__label">SCALE</span>
          <div className="sacred-scale__scale-groups">
            {SCALE_GROUPS.map(group => (
              <div key={group.label} className="sacred-scale__scale-group">
                <span className="sacred-scale__group-label">{group.label}</span>
                <div className="sacred-scale__scale-btns">
                  {group.types.map(type => (
                    <button
                      key={type}
                      className={`sacred-scale__scale-btn ${config.type === type ? 'sacred-scale__scale-btn--active' : ''}`}
                      onClick={() => handleScaleChange(type)}
                      title={SCALE_LABELS[type]}
                    >
                      {type === 'pentatonicMajor' ? 'Pent▲' :
                       type === 'pentatonicMinor' ? 'Pent▼' :
                       type === 'harmonicMinor' ? 'H.Min' :
                       type === 'melodicMinor' ? 'M.Min' :
                       type.charAt(0).toUpperCase() + type.slice(1, 4)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Diatonic chords */}
        <div className="sacred-scale__section sacred-scale__chords-section">
          <span className="sacred-scale__label">CHORDS IN KEY</span>
          <div className="sacred-scale__chord-grid">
            {diatonicChords.map((chord, i) => (
              <button
                key={i}
                className="sacred-scale__chord-btn"
                onClick={() => handleChordInsert(chord)}
                title={`Insert ${chord.name} chord at current position`}
              >
                <span className="sacred-scale__chord-degree">{DEGREE_LABELS[i]}</span>
                <span className="sacred-scale__chord-name">{chord.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Progressions */}
        <div className="sacred-scale__section sacred-scale__progs-section">
          <span className="sacred-scale__label">PROGRESSIONS</span>
          <div className="sacred-scale__prog-grid">
            {COMMON_PROGRESSIONS.map(prog => (
              <button
                key={prog.id}
                className="sacred-scale__prog-btn"
                onClick={() => handleProgressionInsert(prog)}
                title={`${prog.name} — ${prog.description}`}
              >
                <span className="sacred-scale__prog-name">{prog.name}</span>
                <span className="sacred-scale__prog-desc">{prog.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
