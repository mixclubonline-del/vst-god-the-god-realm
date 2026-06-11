/**
 * EtherealPluck.tsx — 💎 Crystal Bell Pluck Synth
 * God: Apollo | FUI: Scanning Grid
 * "Crystal harmonics with shimmer tail"
 */

import React, { useState, useCallback } from 'react';
import { DivineKnob } from '../controls/DivineKnob';
import { WaveformCanvas } from '../controls/WaveformCanvas';
import { MiniKeyboard } from '../controls/MiniKeyboard';
import { usePluginEngine } from '@/hooks/usePluginEngine';

const ACCENT = '#B87DFF';
const ACCENT2 = '#D4A0FF';

export const EtherealPluck: React.FC = () => {
  const { engine, noteOn, noteOff, setParam } = usePluginEngine('ethereal-pluck');

  const [crystalTone, setCrystalTone] = useState(55);
  const [prismResonance, setPrismResonance] = useState(40);
  const [shimmerDecay, setShimmerDecay] = useState(65);
  const [magicalAttack, setMagicalAttack] = useState(20);
  const [bodyLevel, setBodyLevel] = useState(50);
  const [airLevel, setAirLevel] = useState(45);
  const [masterVol, setMasterVol] = useState(70);
  const [stereoWidth, setStereoWidth] = useState(60);

  const handleParam = useCallback((target: string, setter: (v: number) => void) => {
    return (v: number) => { setter(v); setParam(target, v); };
  }, [setParam]);

  return (
    <div className="fp-instrument fp-instrument--ethereal-pluck">
      {/* Top Knob Row */}
      <div className="fp-instrument__section">
        <span className="fp-instrument__section-label">CRYSTAL ENGINE</span>
        <div className="fp-instrument__row">
          <DivineKnob label="CRYSTAL TONE" value={crystalTone} onChange={handleParam('modIndex', setCrystalTone)} color={ACCENT} />
          <DivineKnob label="PRISM RES" value={prismResonance} onChange={handleParam('filterQ', setPrismResonance)} color={ACCENT} />
          <DivineKnob label="SHIMMER DEC" value={shimmerDecay} onChange={handleParam('reverbMix', setShimmerDecay)} color={ACCENT2} />
          <DivineKnob label="MAGIC ATK" value={magicalAttack} onChange={handleParam('attack', setMagicalAttack)} color={ACCENT2} />
        </div>
      </div>

      {/* Waveform Display */}
      <div className="fp-instrument__waveform">
        <WaveformCanvas engine={engine} color={ACCENT} height={90} />
      </div>

      {/* Bottom Knob Row */}
      <div className="fp-instrument__section">
        <span className="fp-instrument__section-label">DIMENSION</span>
        <div className="fp-instrument__row">
          <DivineKnob label="BODY" value={bodyLevel} onChange={handleParam('bodyGain', setBodyLevel)} color={ACCENT} size={42} />
          <DivineKnob label="AIR" value={airLevel} onChange={handleParam('chorusMix', setAirLevel)} color={ACCENT2} size={42} />
          <DivineKnob label="WIDTH" value={stereoWidth} onChange={handleParam('width', setStereoWidth)} color={ACCENT} size={42} />
          <DivineKnob label="MASTER" value={masterVol} onChange={handleParam('masterGain', setMasterVol)} color="#fff" size={42} />
        </div>
      </div>

      {/* Mini Keyboard */}
      <MiniKeyboard onNoteOn={noteOn} onNoteOff={noteOff} color={ACCENT} startNote={60} octaves={2} />
    </div>
  );
};
