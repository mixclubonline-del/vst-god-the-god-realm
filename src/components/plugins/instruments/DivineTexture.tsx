/**
 * DivineTexture.tsx — 🌿 Evolving Organic Texture Synth
 * God: Poseidon + Chronos morph | FUI: Fluid Orb
 * "Evolving organic texture with dual-god morph"
 */

import React, { useState, useCallback } from 'react';
import { DivineKnob } from '../controls/DivineKnob';
import { WaveformCanvas } from '../controls/WaveformCanvas';
import { MiniKeyboard } from '../controls/MiniKeyboard';
import { usePluginEngine } from '@/hooks/usePluginEngine';

const GREEN = '#22C55E';
const MOSS = '#4ADE80';

export const DivineTexture: React.FC = () => {
  const { engine, noteOn, noteOff, setParam } = usePluginEngine('divine-texture');

  const [organic, setOrganic] = useState(50);
  const [growth, setGrowth] = useState(45);
  const [resonance, setResonance] = useState(40);
  const [roots, setRoots] = useState(55);
  const [harmonics, setHarmonics] = useState(50);
  const [mystic, setMystic] = useState(35);
  const [vine, setVine] = useState(40);
  const [divine, setDivine] = useState(50);
  const [layerBlend, setLayerBlend] = useState(50);
  const [filterCutoff, setFilterCutoff] = useState(65);
  const [reverbMix, setReverbMix] = useState(55);
  const [outputLevel, setOutputLevel] = useState(70);
  const [layer1, setLayer1] = useState(true);
  const [layer2, setLayer2] = useState(true);

  const hp = useCallback((target: string, setter: (v: number) => void) => {
    return (v: number) => { setter(v); setParam(target, v); };
  }, [setParam]);

  return (
    <div className="fp-instrument fp-instrument--divine-texture">
      {/* Left: Layer Controls */}
      <div className="fp-instrument__sidebar">
        <button
          className={`fp-instrument__btn ${layer1 ? 'fp-instrument__btn--active' : ''}`}
          onClick={() => setLayer1(!layer1)}
          style={{ '--btn-color': GREEN } as React.CSSProperties}
        >
          LIFE
        </button>
        <button
          className={`fp-instrument__btn ${layer2 ? 'fp-instrument__btn--active' : ''}`}
          onClick={() => setLayer2(!layer2)}
          style={{ '--btn-color': MOSS } as React.CSSProperties}
        >
          BLOOM
        </button>
        <DivineKnob label="FILTER" value={filterCutoff} onChange={hp('filterFreq', setFilterCutoff)} color={GREEN} size={40} />
        <DivineKnob label="BLEND" value={layerBlend} onChange={hp('morphBlend', setLayerBlend)} color={MOSS} size={40} />
        <DivineKnob label="REVERB" value={reverbMix} onChange={hp('reverbMix', setReverbMix)} color={GREEN} size={40} />
        <DivineKnob label="OUTPUT" value={outputLevel} onChange={hp('masterGain', setOutputLevel)} color="#fff" size={40} />
      </div>

      {/* Center */}
      <div className="fp-instrument__main">
        {/* Waveform */}
        <div className="fp-instrument__waveform">
          <WaveformCanvas engine={engine} color={GREEN} height={100} />
        </div>

        {/* 8 Macro Knobs */}
        <div className="fp-instrument__section">
          <div className="fp-instrument__row">
            <DivineKnob label="ORGANIC" value={organic} onChange={hp('energy', setOrganic)} color={GREEN} />
            <DivineKnob label="GROWTH" value={growth} onChange={hp('divinity', setGrowth)} color={MOSS} />
            <DivineKnob label="RESONANCE" value={resonance} onChange={hp('filterQ', setResonance)} color={GREEN} />
            <DivineKnob label="ROOTS" value={roots} onChange={hp('subOscGain', setRoots)} color={MOSS} />
          </div>
          <div className="fp-instrument__row">
            <DivineKnob label="HARMONICS" value={harmonics} onChange={hp('modIndex', setHarmonics)} color={MOSS} />
            <DivineKnob label="MYSTIC" value={mystic} onChange={hp('chorusMix', setMystic)} color={GREEN} />
            <DivineKnob label="VINE" value={vine} onChange={hp('delayMix', setVine)} color={MOSS} />
            <DivineKnob label="DIVINE" value={divine} onChange={hp('realm', setDivine)} color={GREEN} />
          </div>
        </div>

        {/* Mini Keyboard */}
        <MiniKeyboard onNoteOn={noteOn} onNoteOff={noteOff} color={GREEN} startNote={48} octaves={2} />
      </div>
    </div>
  );
};
