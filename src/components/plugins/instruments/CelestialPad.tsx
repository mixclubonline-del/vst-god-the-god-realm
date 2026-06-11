/**
 * CelestialPad.tsx — 🌌 Lush Ambient Aurora Pad
 * God: Poseidon | FUI: Holographic Floating Sliders
 * "Lush ambient pad with aurora stereo field"
 */

import React, { useState, useCallback } from 'react';
import { HoloFader } from '../controls/HoloFader';
import { WaveformCanvas } from '../controls/WaveformCanvas';
import { MiniKeyboard } from '../controls/MiniKeyboard';
import { usePluginEngine } from '@/hooks/usePluginEngine';

const CYAN = '#38D5FF';
const ICE = '#67E8F9';

export const CelestialPad: React.FC = () => {
  const { engine, noteOn, noteOff, setParam } = usePluginEngine('celestial-pad');

  const [depth, setDepth] = useState(60);
  const [drift, setDrift] = useState(50);
  const [warmth, setWarmth] = useState(55);
  const [bloom, setBloom] = useState(65);
  const [sustain, setSustain] = useState(80);
  const [release, setRelease] = useState(75);
  const [shimmer, setShimmer] = useState(45);
  const [space, setSpace] = useState(60);
  const [body, setBody] = useState(50);
  const [subLayer, setSubLayer] = useState(30);
  const [master, setMaster] = useState(70);
  const [power, setPower] = useState(true);

  const hp = useCallback((target: string, setter: (v: number) => void) => {
    return (v: number) => { setter(v); setParam(target, v); };
  }, [setParam]);

  return (
    <div className="fp-instrument fp-instrument--celestial-pad">
      {/* Waveform */}
      <div className="fp-instrument__waveform">
        <WaveformCanvas engine={engine} color={CYAN} height={80} />
      </div>

      {/* Fader Row 1 */}
      <div className="fp-instrument__section">
        <span className="fp-instrument__section-label">AURORA FIELD</span>
        <div className="fp-instrument__row fp-instrument__row--faders">
          <HoloFader label="DEPTH" value={depth} onChange={hp('reverbMix', setDepth)} color={CYAN} height={70} />
          <HoloFader label="DRIFT" value={drift} onChange={hp('chorusMix', setDrift)} color={ICE} height={70} />
          <HoloFader label="WARMTH" value={warmth} onChange={hp('filterFreq', setWarmth)} color={CYAN} height={70} />
          <HoloFader label="BLOOM" value={bloom} onChange={hp('attack', setBloom)} color={ICE} height={70} />
          <HoloFader label="SUSTAIN" value={sustain} onChange={hp('sustain', setSustain)} color={CYAN} height={70} />
        </div>
      </div>

      {/* Fader Row 2 */}
      <div className="fp-instrument__section">
        <span className="fp-instrument__section-label">DIMENSION CONTROL</span>
        <div className="fp-instrument__row fp-instrument__row--faders">
          <HoloFader label="RELEASE" value={release} onChange={hp('release', setRelease)} color={CYAN} height={70} />
          <HoloFader label="SHIMMER" value={shimmer} onChange={hp('divinity', setShimmer)} color={ICE} height={70} />
          <HoloFader label="SPACE" value={space} onChange={hp('width', setSpace)} color={CYAN} height={70} />
          <HoloFader label="BODY" value={body} onChange={hp('bodyGain', setBody)} color={ICE} height={70} />
          <HoloFader label="SUB" value={subLayer} onChange={hp('subOscGain', setSubLayer)} color={CYAN} height={70} />
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fp-instrument__bottom-bar">
        <div className="fp-instrument__btn-group">
          <button
            className={`fp-instrument__btn ${power ? 'fp-instrument__btn--active' : ''}`}
            onClick={() => setPower(!power)}
            style={{ '--btn-color': CYAN } as React.CSSProperties}
          >
            ⏻
          </button>
          <button className="fp-instrument__btn" style={{ '--btn-color': ICE } as React.CSSProperties}>∿</button>
          <button className="fp-instrument__btn" style={{ '--btn-color': CYAN } as React.CSSProperties}>△</button>
          <button className="fp-instrument__btn" style={{ '--btn-color': ICE } as React.CSSProperties}>◇</button>
          <button className="fp-instrument__btn" style={{ '--btn-color': CYAN } as React.CSSProperties}>⌇</button>
          <button className="fp-instrument__btn" style={{ '--btn-color': ICE } as React.CSSProperties}>🔇</button>
        </div>

        <HoloFader label="MASTER" value={master} onChange={hp('masterGain', setMaster)} color="#fff" height={50} orientation="horizontal" />
      </div>

      {/* Mini Keyboard */}
      <MiniKeyboard onNoteOn={noteOn} onNoteOff={noteOff} color={CYAN} startNote={48} octaves={2} />
    </div>
  );
};
