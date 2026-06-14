/**
 * CelestialPad.tsx — 🌌 Lush Ambient Aurora Pad
 * God: Poseidon | FUI: Holographic Floating Sliders
 * "Lush ambient pad with aurora stereo field"
 */

import React, { useEffect, useCallback } from 'react';
import { HoloFader } from '../controls/HoloFader';
import { WaveformCanvas } from '../controls/WaveformCanvas';
import { MiniKeyboard } from '../controls/MiniKeyboard';
import { OutputMeter } from '../controls/OutputMeter';
import { ADSREnvelope } from '../controls/ADSREnvelope';
import { FilterCurve } from '../controls/FilterCurve';
import { usePluginEngine } from '@/hooks/usePluginEngine';
import { useEngineMetering } from '@/hooks/useEngineMetering';
import { usePluginStore } from '@/services/pluginStore';
import { nativeAudio } from '@/native/bridge';

const CYAN = '#38D5FF';
const ICE = '#67E8F9';
const WAVE_TYPES = ['sine', 'triangle', 'square', 'saw'];

export const CelestialPad: React.FC = () => {
  const { engine, noteOn, noteOff, setParam } = usePluginEngine('celestial-pad');
  const { level: rmsLevel, peak: peakLevel } = useEngineMetering(engine);

  const { activePlugins, setPluginParameter } = usePluginStore();
  const godPlugin = activePlugins.find(p => p.spec.plugin.name.includes('God Realm'));
  const pluginId = godPlugin?.id;
  const parameterValues = godPlugin?.parameterValues || {};

  // Extract parameter values from the global store (with defaults fallback)
  const depth = Number(parameterValues['pad_reverbMix'] ?? 60);
  const drift = Number(parameterValues['pad_chorusMix'] ?? 50);
  const warmth = Number(parameterValues['pad_filterFreq'] ?? 55);
  const bloom = Number(parameterValues['pad_attack'] ?? 65);
  const sustain = Number(parameterValues['pad_sustain'] ?? 80);
  const release = Number(parameterValues['pad_release'] ?? 75);
  const shimmer = Number(parameterValues['pad_divinity'] ?? 45);
  const space = Number(parameterValues['pad_width'] ?? 60);
  const body = Number(parameterValues['pad_bodyGain'] ?? 50);
  const subLayer = Number(parameterValues['pad_subOscGain'] ?? 30);
  const master = Number(parameterValues['pad_masterGain'] ?? 70);

  const powerVal = parameterValues['pad_power'] ?? 1;
  const power = typeof powerVal === 'boolean' ? powerVal : powerVal !== 0;

  const rawWaveType = parameterValues['pad_waveType'];
  const waveTypeVal = typeof rawWaveType === 'number'
    ? rawWaveType
    : (typeof rawWaveType === 'string' ? WAVE_TYPES.indexOf(rawWaveType) : 0);
  const waveType = WAVE_TYPES[waveTypeVal >= 0 && waveTypeVal < 4 ? waveTypeVal : 0] || 'sine';

  // Keep the local Web Audio engine in sync with the global parameter store
  useEffect(() => {
    setParam('reverbMix', depth);
    setParam('chorusMix', drift);
    setParam('filterFreq', warmth);
    setParam('attack', bloom);
    setParam('sustain', sustain);
    setParam('release', release);
    setParam('divinity', shimmer);
    setParam('width', space);
    setParam('bodyGain', body);
    setParam('subOscGain', subLayer);
    setParam('masterGain', master);
  }, [setParam, depth, drift, warmth, bloom, sustain, release, shimmer, space, body, subLayer, master]);

  const updateParam = useCallback((paramId: string, targetEngineParam: string) => {
    return (v: number) => {
      setParam(targetEngineParam, v);
      if (pluginId) {
        setPluginParameter(pluginId, paramId, v);
        nativeAudio.setParameter(paramId, v);
      }
    };
  }, [pluginId, setPluginParameter, setParam]);

  const handleSetPower = useCallback((p: boolean) => {
    const numericVal = p ? 1 : 0;
    if (pluginId) {
      setPluginParameter(pluginId, 'pad_power', numericVal);
      nativeAudio.setParameter('pad_power', numericVal);
    }
  }, [pluginId, setPluginParameter]);

  const handleSetWaveType = useCallback((type: string) => {
    const idx = WAVE_TYPES.indexOf(type);
    if (idx !== -1 && pluginId) {
      setPluginParameter(pluginId, 'pad_waveType', idx);
      nativeAudio.setParameter('pad_waveType', idx);
    }
  }, [pluginId, setPluginParameter]);

  return (
    <div className="fp-instrument fp-instrument--celestial-pad">
      {/* Waveform & Visual Curves */}
      <div className="fp-instrument__waveform" style={{ display: 'flex', gap: '8px', alignItems: 'stretch', marginBottom: '8px' }}>
        <div style={{ flex: 1.5 }}>
          <WaveformCanvas engine={engine} color={CYAN} height={70} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span className="fp-instrument__section-label" style={{ marginBottom: '2px', display: 'block' }}>FILTER</span>
          <FilterCurve cutoff={warmth} resonance={30} color={CYAN} height={50} width={120} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span className="fp-instrument__section-label" style={{ marginBottom: '2px', display: 'block' }}>ENV</span>
          <ADSREnvelope attack={bloom} decay={50} sustain={sustain} release={release} color={ICE} height={50} width={120} />
        </div>
      </div>

      {/* Fader Row 1 */}
      <div className="fp-instrument__section">
        <span className="fp-instrument__section-label">AURORA FIELD</span>
        <div className="fp-instrument__row fp-instrument__row--faders">
          <HoloFader id="pad_reverbMix" label="DEPTH" value={depth} onChange={updateParam('pad_reverbMix', 'reverbMix')} color={CYAN} height={70} />
          <HoloFader id="pad_chorusMix" label="DRIFT" value={drift} onChange={updateParam('pad_chorusMix', 'chorusMix')} color={ICE} height={70} />
          <HoloFader id="pad_filterFreq" label="WARMTH" value={warmth} onChange={updateParam('pad_filterFreq', 'filterFreq')} color={CYAN} height={70} />
          <HoloFader id="pad_attack" label="BLOOM" value={bloom} onChange={updateParam('pad_attack', 'attack')} color={ICE} height={70} />
          <HoloFader id="pad_sustain" label="SUSTAIN" value={sustain} onChange={updateParam('pad_sustain', 'sustain')} color={CYAN} height={70} />
        </div>
      </div>

      {/* Fader Row 2 */}
      <div className="fp-instrument__section">
        <span className="fp-instrument__section-label">DIMENSION CONTROL</span>
        <div className="fp-instrument__row fp-instrument__row--faders">
          <HoloFader id="pad_release" label="RELEASE" value={release} onChange={updateParam('pad_release', 'release')} color={CYAN} height={70} />
          <HoloFader id="pad_divinity" label="SHIMMER" value={shimmer} onChange={updateParam('pad_divinity', 'divinity')} color={ICE} height={70} />
          <HoloFader id="pad_width" label="SPACE" value={space} onChange={updateParam('pad_width', 'width')} color={CYAN} height={70} />
          <HoloFader id="pad_bodyGain" label="BODY" value={body} onChange={updateParam('pad_bodyGain', 'bodyGain')} color={ICE} height={70} />
          <HoloFader id="pad_subOscGain" label="SUB" value={subLayer} onChange={updateParam('pad_subOscGain', 'subOscGain')} color={CYAN} height={70} />
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fp-instrument__bottom-bar">
        <div className="fp-instrument__btn-group">
          <button
            className={`fp-instrument__btn ${power ? 'fp-instrument__btn--active' : ''}`}
            onClick={() => handleSetPower(!power)}
            style={{ '--btn-color': CYAN } as React.CSSProperties}
          >
            ⏻
          </button>
          <button className={`fp-instrument__btn ${waveType === 'sine' ? 'fp-instrument__btn--active' : ''}`} onClick={() => handleSetWaveType('sine')} style={{ '--btn-color': ICE } as React.CSSProperties}>∿</button>
          <button className={`fp-instrument__btn ${waveType === 'triangle' ? 'fp-instrument__btn--active' : ''}`} onClick={() => handleSetWaveType('triangle')} style={{ '--btn-color': CYAN } as React.CSSProperties}>△</button>
          <button className={`fp-instrument__btn ${waveType === 'square' ? 'fp-instrument__btn--active' : ''}`} onClick={() => handleSetWaveType('square')} style={{ '--btn-color': ICE } as React.CSSProperties}>◇</button>
          <button className={`fp-instrument__btn ${waveType === 'saw' ? 'fp-instrument__btn--active' : ''}`} onClick={() => handleSetWaveType('saw')} style={{ '--btn-color': CYAN } as React.CSSProperties}>⌇</button>
          <button className={`fp-instrument__btn ${!power ? 'fp-instrument__btn--active' : ''}`} onClick={() => handleSetPower(false)} style={{ '--btn-color': ICE } as React.CSSProperties}>🔇</button>
        </div>

        <HoloFader id="pad_masterGain" label="MASTER" value={master} onChange={updateParam('pad_masterGain', 'masterGain')} color="#fff" height={50} orientation="horizontal" />
      </div>

      {/* Mini Keyboard */}
      <MiniKeyboard onNoteOn={noteOn} onNoteOff={noteOff} color={CYAN} startNote={48} octaves={2} />
      <OutputMeter color={CYAN} level={rmsLevel} peak={peakLevel} />
    </div>
  );
};
