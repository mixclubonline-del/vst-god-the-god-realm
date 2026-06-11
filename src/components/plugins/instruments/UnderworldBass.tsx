/**
 * UnderworldBass.tsx — 🌋 Volcanic Mono Bass
 * God: Hades | FUI: Spectral Radar
 * "Volcanic mono bass with heavy saturation chain"
 */

import React, { useState, useCallback } from 'react';
import { DivineKnob } from '../controls/DivineKnob';
import { HoloFader } from '../controls/HoloFader';
import { MiniKeyboard } from '../controls/MiniKeyboard';
import { usePluginEngine } from '@/hooks/usePluginEngine';
import { useJuceBridge } from '@/hooks/useJuceBridge';
import { SpectralRadarPanner } from '@/components/SpectralRadarPanner';

const LAVA = '#EF4444';
const EMBER = '#FF8C42';

export const UnderworldBass: React.FC = () => {
  const { engine, noteOn, noteOff, setParam } = usePluginEngine('underworld-bass');
  const bridgeState = useJuceBridge();

  const [subGain, setSubGain] = useState(60);
  const [drive, setDrive] = useState(45);
  const [distort, setDistort] = useState(30);
  const [crush, setCrush] = useState(15);
  const [bassLevel, setBassLevel] = useState(70);
  const [cutoff, setCutoff] = useState(55);
  const [reso, setReso] = useState(35);
  const [lavaDrip, setLavaDrip] = useState(25);
  const [attack, setAttack] = useState(5);
  const [decay, setDecay] = useState(40);
  const [sustain, setSustain] = useState(60);
  const [release, setRelease] = useState(35);
  const [oscType, setOscType] = useState<'MAGMA' | 'VOLCANIC'>('MAGMA');

  const hp = useCallback((target: string, setter: (v: number) => void) => {
    return (v: number) => { setter(v); setParam(target, v); };
  }, [setParam]);

  return (
    <div className="fp-instrument fp-instrument--underworld-bass">
      {/* Waveform */}
      <div className="fp-instrument__waveform" style={{ height: '260px' }}>
        <SpectralRadarPanner spectralData={bridgeState.spectralData} />
      </div>

      {/* Main Controls Row */}
      <div className="fp-instrument__section">
        <div className="fp-instrument__row">
          <DivineKnob label="SUB GAIN" value={subGain} onChange={hp('subOscGain', setSubGain)} color={LAVA} />
          <DivineKnob label="DRIVE" value={drive} onChange={hp('satDrive', setDrive)} color={EMBER} />
          <DivineKnob label="DISTORT" value={distort} onChange={hp('satMix', setDistort)} color={LAVA} />
          <DivineKnob label="CRUSH" value={crush} onChange={hp('modIndex', setCrush)} color={EMBER} />
        </div>
      </div>

      {/* Center: Osc Select + Bass Level */}
      <div className="fp-instrument__center-row">
        <div className="fp-instrument__osc-select">
          <span className="fp-instrument__section-label">OSC</span>
          <button
            className={`fp-instrument__btn ${oscType === 'MAGMA' ? 'fp-instrument__btn--active' : ''}`}
            onClick={() => setOscType('MAGMA')}
            style={{ '--btn-color': LAVA } as React.CSSProperties}
          >
            MAGMA
          </button>
          <button
            className={`fp-instrument__btn ${oscType === 'VOLCANIC' ? 'fp-instrument__btn--active' : ''}`}
            onClick={() => setOscType('VOLCANIC')}
            style={{ '--btn-color': EMBER } as React.CSSProperties}
          >
            VOLCANIC
          </button>
        </div>

        <DivineKnob label="BASS LEVEL" value={bassLevel} onChange={hp('masterGain', setBassLevel)} color={LAVA} size={64} />

        <div className="fp-instrument__filter-col">
          <span className="fp-instrument__section-label">FILTER</span>
          <DivineKnob label="CUTOFF" value={cutoff} onChange={hp('filterFreq', setCutoff)} color={EMBER} size={40} />
          <DivineKnob label="RESO" value={reso} onChange={hp('filterQ', setReso)} color={EMBER} size={40} />
          <DivineKnob label="LAVA DRIP" value={lavaDrip} onChange={hp('delayMix', setLavaDrip)} color={LAVA} size={40} />
        </div>
      </div>

      {/* ADSR */}
      <div className="fp-instrument__section">
        <span className="fp-instrument__section-label">AMP ENV</span>
        <div className="fp-instrument__row fp-instrument__row--adsr">
          <HoloFader label="ATK" value={attack} onChange={hp('attack', setAttack)} color={LAVA} height={60} />
          <HoloFader label="DEC" value={decay} onChange={hp('decay', setDecay)} color={LAVA} height={60} />
          <HoloFader label="SUS" value={sustain} onChange={hp('sustain', setSustain)} color={EMBER} height={60} />
          <HoloFader label="REL" value={release} onChange={hp('release', setRelease)} color={EMBER} height={60} />
        </div>
      </div>

      {/* Mini Keyboard */}
      <MiniKeyboard onNoteOn={noteOn} onNoteOff={noteOff} color={LAVA} startNote={36} octaves={2} />
    </div>
  );
};
