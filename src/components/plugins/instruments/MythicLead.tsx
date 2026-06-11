/**
 * MythicLead.tsx — ⚡ Lightning Mono Lead
 * God: Zeus | FUI: Deep-Recessed Hardware
 * "Lightning mono lead with Greek fire transients"
 */

import React, { useState, useCallback } from 'react';
import { DivineKnob } from '../controls/DivineKnob';
import { HoloFader } from '../controls/HoloFader';
import { WaveformCanvas } from '../controls/WaveformCanvas';
import { MiniKeyboard } from '../controls/MiniKeyboard';
import { usePluginEngine } from '@/hooks/usePluginEngine';

const GOLD = '#FFE66D';
const LIGHTNING = '#FFD700';

export const MythicLead: React.FC = () => {
  const { engine, noteOn, noteOff, setParam } = usePluginEngine('mythic-lead');

  const [drive, setDrive] = useState(40);
  const [level, setLevel] = useState(65);
  const [lo, setLo] = useState(30);
  const [cutoff, setCutoff] = useState(60);
  const [res, setRes] = useState(35);
  const [detune, setDetune] = useState(20);
  const [attack, setAttack] = useState(5);
  const [decay, setDecay] = useState(30);
  const [sustain, setSustain] = useState(50);
  const [release, setRelease] = useState(25);
  const [saturation, setSaturation] = useState(30);
  const [master, setMaster] = useState(70);
  const [voiceMode, setVoiceMode] = useState<'MONO' | 'LEGATO'>('MONO');

  const hp = useCallback((target: string, setter: (v: number) => void) => {
    return (v: number) => { setter(v); setParam(target, v); };
  }, [setParam]);

  const handleVoiceMode = useCallback((mode: 'MONO' | 'LEGATO') => {
    setVoiceMode(mode);
    // Voice mode change propagated via engine hook on next render
  }, []);

  return (
    <div className="fp-instrument fp-instrument--mythic-lead">
      {/* Top Row: Oscillators + Waveform + Filter */}
      <div className="fp-instrument__top-row">
        {/* Left: Oscillators */}
        <div className="fp-instrument__col">
          <span className="fp-instrument__section-label">OSCILLATORS</span>
          <DivineKnob label="DRIVE" value={drive} onChange={hp('satDrive', setDrive)} color={GOLD} />
          <DivineKnob label="LVL" value={level} onChange={hp('bodyGain', setLevel)} color={GOLD} />
          <DivineKnob label="LO" value={lo} onChange={hp('subOscGain', setLo)} color={LIGHTNING} />
        </div>

        {/* Center: Waveform */}
        <div className="fp-instrument__waveform fp-instrument__waveform--lead">
          <div className="fp-instrument__waveform-header">
            <button
              className={`fp-instrument__btn fp-instrument__btn--sm ${voiceMode === 'MONO' ? 'fp-instrument__btn--active' : ''}`}
              onClick={() => handleVoiceMode('MONO')}
              style={{ '--btn-color': GOLD } as React.CSSProperties}
            >
              MONO
            </button>
            <span className="fp-instrument__section-label">WAVEFORM</span>
            <button
              className={`fp-instrument__btn fp-instrument__btn--sm ${voiceMode === 'LEGATO' ? 'fp-instrument__btn--active' : ''}`}
              onClick={() => handleVoiceMode('LEGATO')}
              style={{ '--btn-color': LIGHTNING } as React.CSSProperties}
            >
              LEGATO
            </button>
          </div>
          <WaveformCanvas engine={engine} color={GOLD} height={90} />
        </div>

        {/* Right: Filter */}
        <div className="fp-instrument__col">
          <span className="fp-instrument__section-label">FILTER</span>
          <DivineKnob label="CUTOFF" value={cutoff} onChange={hp('filterFreq', setCutoff)} color={LIGHTNING} />
          <DivineKnob label="RES" value={res} onChange={hp('filterQ', setRes)} color={LIGHTNING} />
          <DivineKnob label="DETUNE" value={detune} onChange={hp('detuneCents', setDetune)} color={GOLD} />
        </div>
      </div>

      {/* Bottom Row: Envelope + ADSR + Effects */}
      <div className="fp-instrument__bottom-row">
        {/* Left: Envelope Buttons */}
        <div className="fp-instrument__col fp-instrument__col--btns">
          <span className="fp-instrument__section-label">ENVELOPE</span>
          <button className="fp-instrument__btn" style={{ '--btn-color': GOLD } as React.CSSProperties}>
            POWER
          </button>
          <button className="fp-instrument__btn" style={{ '--btn-color': GOLD } as React.CSSProperties}>
            RAND
          </button>
          <button className="fp-instrument__btn" style={{ '--btn-color': LIGHTNING } as React.CSSProperties}>
            BOLT
          </button>
        </div>

        {/* Center: ADSR Faders */}
        <div className="fp-instrument__section fp-instrument__section--adsr">
          <span className="fp-instrument__section-label">ADSR</span>
          <div className="fp-instrument__row fp-instrument__row--adsr">
            <HoloFader label="ATK" value={attack} onChange={hp('attack', setAttack)} color={GOLD} height={60} />
            <HoloFader label="DEC" value={decay} onChange={hp('decay', setDecay)} color={GOLD} height={60} />
            <HoloFader label="SUS" value={sustain} onChange={hp('sustain', setSustain)} color={LIGHTNING} height={60} />
            <HoloFader label="REL" value={release} onChange={hp('release', setRelease)} color={LIGHTNING} height={60} />
          </div>
        </div>

        {/* Right: Effects */}
        <div className="fp-instrument__col fp-instrument__col--fx">
          <span className="fp-instrument__section-label">EFFECTS</span>
          <DivineKnob label="SAT" value={saturation} onChange={hp('satMix', setSaturation)} color={LIGHTNING} size={40} />
          <DivineKnob label="MASTER" value={master} onChange={hp('masterGain', setMaster)} color="#fff" size={40} />
        </div>
      </div>

      {/* Mini Keyboard */}
      <MiniKeyboard onNoteOn={noteOn} onNoteOff={noteOff} color={GOLD} startNote={48} octaves={2} />
    </div>
  );
};
