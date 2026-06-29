import React, { useState, useCallback, useRef, useEffect } from 'react';
import { neuralInputBus } from '../services/neuralInputBus';
import './GodVault.css';

const PIANO_KEYS = (() => {
  const keys: { midi: number; name: string; octave: number; isBlack: boolean }[] = [];
  for (let octave = 3; octave <= 6; octave++) {
    const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    for (let n = 0; n < 12; n++) {
      const midi = (octave + 1) * 12 + n;
      keys.push({ midi, name: noteNames[n], octave, isBlack: noteNames[n].includes('#') });
    }
  }
  return keys;
})();

const VaultPianoKeyboard: React.FC = () => {
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  const isMouseDownRef = useRef(false);

  const noteOn = useCallback((note: number) => {
    neuralInputBus.emit({ type: 'midi_note_on', note, velocity: 100 * 327 });
    setPressedKeys(prev => { const s = new Set(prev); s.add(note); return s; });
  }, []);

  const noteOff = useCallback((note: number) => {
    neuralInputBus.emit({ type: 'midi_note_off', note });
    setPressedKeys(prev => { const s = new Set(prev); s.delete(note); return s; });
  }, []);

  const releaseAll = useCallback(() => {
    setPressedKeys(prev => {
      prev.forEach(n => neuralInputBus.emit({ type: 'midi_note_off', note: n }));
      return new Set();
    });
    isMouseDownRef.current = false;
  }, []);

  useEffect(() => {
    const up = () => { if (isMouseDownRef.current) releaseAll(); };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [releaseAll]);

  return (
    <div className="god-vault__piano">
      <div className="god-vault__piano-label">KEYBOARD · C3 – B6</div>
      <div className="god-vault__piano-keys" onMouseLeave={releaseAll}>
        {PIANO_KEYS.filter(k => !k.isBlack).map(whiteKey => {
          const blackAfter = PIANO_KEYS.find(k =>
            k.isBlack && k.midi === whiteKey.midi + 1 &&
            ['C#','D#','F#','G#','A#'].includes(k.name)
          );
          return (
            <div key={whiteKey.midi} className="god-vault__piano-white-group">
              <div
                className={`god-vault__piano-key god-vault__piano-key--white${pressedKeys.has(whiteKey.midi) ? ' god-vault__piano-key--pressed' : ''}`}
                onMouseDown={e => { e.preventDefault(); isMouseDownRef.current = true; noteOn(whiteKey.midi); }}
                onMouseUp={() => noteOff(whiteKey.midi)}
                onMouseLeave={() => { if (!isMouseDownRef.current) noteOff(whiteKey.midi); }}
                onMouseEnter={() => { if (isMouseDownRef.current) noteOn(whiteKey.midi); }}
                title={`${whiteKey.name}${whiteKey.octave} (MIDI ${whiteKey.midi})`}
              >
                {whiteKey.name === 'C' && (
                  <span className="god-vault__piano-note-label">{whiteKey.name}{whiteKey.octave}</span>
                )}
              </div>
              {blackAfter && (
                <div
                  className={`god-vault__piano-key god-vault__piano-key--black${pressedKeys.has(blackAfter.midi) ? ' god-vault__piano-key--pressed' : ''}`}
                  onMouseDown={e => { e.preventDefault(); isMouseDownRef.current = true; noteOn(blackAfter.midi); }}
                  onMouseUp={() => noteOff(blackAfter.midi)}
                  onMouseLeave={() => { if (!isMouseDownRef.current) noteOff(blackAfter.midi); }}
                  onMouseEnter={() => { if (isMouseDownRef.current) noteOn(blackAfter.midi); }}
                  title={`${blackAfter.name}${blackAfter.octave} (MIDI ${blackAfter.midi})`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VaultPianoKeyboard;
