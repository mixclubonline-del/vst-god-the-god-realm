import React, { useState, useCallback, useRef, useEffect } from 'react';
import { neuralInputBus } from '../services/neuralInputBus';

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

const WHITE_KEYS = PIANO_KEYS.filter(k => !k.isBlack);
const BLACK_KEY_MAP = new Map(PIANO_KEYS.filter(k => k.isBlack).map(k => [k.midi, k]));

interface Props {
  activeTab: string;
}

const GlobalPianoKeyboard: React.FC<Props> = ({ activeTab }) => {
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const isMouseDownRef = useRef(false);

  const noteOn = useCallback((midi: number) => {
    neuralInputBus.emit({ type: 'midi_note_on', note: midi, velocity: 100 * 327 });
    setPressed(prev => { const s = new Set(prev); s.add(midi); return s; });
  }, []);

  const noteOff = useCallback((midi: number) => {
    neuralInputBus.emit({ type: 'midi_note_off', note: midi });
    setPressed(prev => { const s = new Set(prev); s.delete(midi); return s; });
  }, []);

  // Release all notes if mouse leaves piano area
  const releaseAll = useCallback(() => {
    pressed.forEach(n => neuralInputBus.emit({ type: 'midi_note_off', note: n }));
    setPressed(new Set());
    isMouseDownRef.current = false;
  }, [pressed]);

  useEffect(() => {
    const up = () => releaseAll();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [releaseAll]);

  useEffect(() => {
    const removeListener = neuralInputBus.addListener(ev => {
      if (ev.type === 'midi_note_on' && ev.note !== undefined) {
        setPressed(prev => { const s = new Set(prev); s.add(ev.note!); return s; });
      } else if (ev.type === 'midi_note_off' && ev.note !== undefined) {
        setPressed(prev => { const s = new Set(prev); s.delete(ev.note!); return s; });
      }
    });
    return removeListener;
  }, []);

  // Accent color per tab
  const accentColor: Record<string, string> = {
    'Multi-Realm': '#a855f7',
    'Sample Chopper': '#c084fc',
    'Mastering': '#22c55e',
    'Sound Realm': '#3b82f6',
    'Preset Vault': '#f59e0b',
  };
  const accent = accentColor[activeTab] ?? '#a855f7';

  const KEY_W = 22;
  const KEY_H = 72;
  const B_W = 13;
  const B_H = 44;

  return (
    <div
      style={{
        position: 'relative',
        height: KEY_H + 16,
        background: 'rgba(4,4,10,0.9)',
        borderTop: `1px solid ${accent}33`,
        display: 'flex',
        alignItems: 'flex-end',
        padding: '8px 12px',
        overflow: 'hidden',
        userSelect: 'none',
        flexShrink: 0,
      }}
      onMouseLeave={releaseAll}
    >
      {/* Label */}
      <span style={{
        position: 'absolute', left: 14, top: 6,
        fontSize: 8, fontWeight: 900, color: `${accent}99`,
        textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'Orbitron, sans-serif',
      }}>KEYBOARD</span>

      {/* White keys + black key overlays */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
        {WHITE_KEYS.map((wk, i) => {
          const isPressed = pressed.has(wk.midi);
          // find black key that appears after this white key (midi + 1 if black)
          const blackMidi = wk.midi + 1;
          const blackKey = BLACK_KEY_MAP.get(blackMidi);
          // Only draw black key if it belongs to same octave group correctly
          const hasBlack = blackKey !== undefined && ['C','D','F','G','A'].includes(wk.name);

          return (
            <div key={wk.midi} style={{ position: 'relative', marginRight: 1 }}>
              {/* White key */}
              <div
                style={{
                  width: KEY_W, height: KEY_H,
                  background: isPressed
                    ? `linear-gradient(180deg, ${accent}66 0%, ${accent}22 100%)`
                    : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(240,235,245,0.88) 100%)',
                  border: `1px solid ${isPressed ? accent : 'rgba(0,0,0,0.35)'}`,
                  borderRadius: '0 0 4px 4px',
                  cursor: 'pointer',
                  boxShadow: isPressed ? `0 0 8px ${accent}88` : '0 2px 4px rgba(0,0,0,0.5)',
                  transition: 'background 0.05s',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 3,
                }}
                onMouseDown={e => { e.preventDefault(); isMouseDownRef.current = true; noteOn(wk.midi); }}
                onMouseUp={() => noteOff(wk.midi)}
                onMouseEnter={() => { if (isMouseDownRef.current) noteOn(wk.midi); }}
                onMouseLeave={() => noteOff(wk.midi)}
              >
                {wk.name === 'C' && (
                  <span style={{ fontSize: 7, fontWeight: 900, color: 'rgba(80,60,120,0.6)', fontFamily: 'Orbitron, sans-serif' }}>
                    C{wk.octave}
                  </span>
                )}
              </div>
              {/* Black key overlaid */}
              {hasBlack && blackKey && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: KEY_W - B_W / 2 + 1,
                    width: B_W,
                    height: B_H,
                    background: pressed.has(blackKey.midi)
                      ? `linear-gradient(180deg, ${accent}cc 0%, ${accent}66 100%)`
                      : 'linear-gradient(180deg, #1a1020 0%, #0a060f 100%)',
                    border: `1px solid ${pressed.has(blackKey.midi) ? accent : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '0 0 3px 3px',
                    cursor: 'pointer',
                    zIndex: 2,
                    boxShadow: pressed.has(blackKey.midi) ? `0 0 6px ${accent}88` : '1px 2px 6px rgba(0,0,0,0.8)',
                    transition: 'background 0.05s',
                  }}
                  onMouseDown={e => { e.preventDefault(); isMouseDownRef.current = true; noteOn(blackKey.midi); }}
                  onMouseUp={() => noteOff(blackKey.midi)}
                  onMouseEnter={() => { if (isMouseDownRef.current) noteOn(blackKey.midi); }}
                  onMouseLeave={() => noteOff(blackKey.midi)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GlobalPianoKeyboard;
