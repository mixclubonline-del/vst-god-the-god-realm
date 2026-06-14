/**
 * DivineTexture.tsx — 🌿 Evolving Organic Texture Synth
 * God: Poseidon + Chronos morph | FUI: Fluid Orb
 * "Evolving organic texture with dual-god morph"
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DivineKnob } from '../controls/DivineKnob';
import { WaveformCanvas } from '../controls/WaveformCanvas';
import { MiniKeyboard } from '../controls/MiniKeyboard';
import { OutputMeter } from '../controls/OutputMeter';
import { FilterCurve } from '../controls/FilterCurve';
import { usePluginEngine } from '@/hooks/usePluginEngine';
import { useEngineMetering } from '@/hooks/useEngineMetering';
import { usePluginStore } from '@/services/pluginStore';
import { nativeAudio } from '@/native/bridge';

const GREEN = '#22C55E';
const MOSS = '#4ADE80';

export const DivineTexture: React.FC = () => {
  const { engine, noteOn, noteOff, setParam } = usePluginEngine('divine-texture');
  const { level: rmsLevel, peak: peakLevel } = useEngineMetering(engine);

  const { activePlugins, setPluginParameter } = usePluginStore();
  const godPlugin = activePlugins.find(p => p.spec.plugin.name.includes('God Realm'));
  const pluginId = godPlugin?.id;
  const parameterValues = godPlugin?.parameterValues || {};

  // Extract parameter values from the global store (with defaults fallback)
  const organic = Number(parameterValues['texture_energy'] ?? 50);
  const growth = Number(parameterValues['texture_divinity'] ?? 45);
  const resonance = Number(parameterValues['texture_filterQ'] ?? 40);
  const roots = Number(parameterValues['texture_subOscGain'] ?? 55);
  const harmonics = Number(parameterValues['texture_modIndex'] ?? 50);
  const mystic = Number(parameterValues['texture_chorusMix'] ?? 35);
  const vine = Number(parameterValues['texture_delayMix'] ?? 40);
  const divine = Number(parameterValues['texture_realm'] ?? 50);
  const filterCutoff = Number(parameterValues['texture_filterFreq'] ?? 65);
  const layerBlend = Number(parameterValues['texture_morphBlend'] ?? 50);
  const reverbMix = Number(parameterValues['texture_reverbMix'] ?? 55);
  const outputLevel = Number(parameterValues['texture_masterGain'] ?? 70);

  // Local state for layers (not automated)
  const [layer1, setLayer1] = useState(true);
  const [layer2, setLayer2] = useState(true);

  // Keep local Web Audio engine in sync with the global parameter store
  useEffect(() => {
    setParam('energy', organic);
    setParam('divinity', growth);
    setParam('filterQ', resonance);
    setParam('subOscGain', roots);
    setParam('modIndex', harmonics);
    setParam('chorusMix', mystic);
    setParam('delayMix', vine);
    setParam('realm', divine);
    setParam('filterFreq', filterCutoff);
    setParam('morphBlend', layerBlend);
    setParam('reverbMix', reverbMix);
    setParam('masterGain', outputLevel);
  }, [setParam, organic, growth, resonance, roots, harmonics, mystic, vine, divine, filterCutoff, layerBlend, reverbMix, outputLevel]);

  const updateParam = useCallback((paramId: string, targetEngineParam: string) => {
    return (v: number) => {
      setParam(targetEngineParam, v);
      if (pluginId) {
        setPluginParameter(pluginId, paramId, v);
        nativeAudio.setParameter(paramId, v);
      }
    };
  }, [pluginId, setPluginParameter, setParam]);

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
        <DivineKnob id="texture_filterFreq" label="FILTER" value={filterCutoff} onChange={updateParam('texture_filterFreq', 'filterFreq')} color={GREEN} size={40} />
        <DivineKnob id="texture_morphBlend" label="BLEND" value={layerBlend} onChange={updateParam('texture_morphBlend', 'morphBlend')} color={MOSS} size={40} />
        <DivineKnob id="texture_reverbMix" label="REVERB" value={reverbMix} onChange={updateParam('texture_reverbMix', 'reverbMix')} color={GREEN} size={40} />
        <DivineKnob id="texture_masterGain" label="OUTPUT" value={outputLevel} onChange={updateParam('texture_masterGain', 'masterGain')} color="#fff" size={40} />
      </div>

      {/* Center */}
      <div className="fp-instrument__main">
        {/* Waveform & Filter Curve */}
        <div className="fp-instrument__waveform" style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
          <div style={{ flex: 1.5 }}>
            <WaveformCanvas engine={engine} color={GREEN} height={100} />
          </div>
          <div style={{ width: '120px', display: 'flex', flexDirection: 'column' }}>
            <span className="fp-instrument__section-label" style={{ marginBottom: '2px' }}>FILTER</span>
            <FilterCurve cutoff={filterCutoff} resonance={resonance} color={GREEN} height={80} width={120} />
          </div>
        </div>

        {/* 8 Macro Knobs */}
        <div className="fp-instrument__section">
          <div className="fp-instrument__row">
            <DivineKnob id="texture_energy" label="ORGANIC" value={organic} onChange={updateParam('texture_energy', 'energy')} color={GREEN} />
            <DivineKnob id="texture_divinity" label="GROWTH" value={growth} onChange={updateParam('texture_divinity', 'divinity')} color={MOSS} />
            <DivineKnob id="texture_filterQ" label="RESONANCE" value={resonance} onChange={updateParam('texture_filterQ', 'filterQ')} color={GREEN} />
            <DivineKnob id="texture_subOscGain" label="ROOTS" value={roots} onChange={updateParam('texture_subOscGain', 'subOscGain')} color={MOSS} />
          </div>
          <div className="fp-instrument__row">
            <DivineKnob id="texture_modIndex" label="HARMONICS" value={harmonics} onChange={updateParam('texture_modIndex', 'modIndex')} color={MOSS} />
            <DivineKnob id="texture_chorusMix" label="MYSTIC" value={mystic} onChange={updateParam('texture_chorusMix', 'chorusMix')} color={GREEN} />
            <DivineKnob id="texture_delayMix" label="VINE" value={vine} onChange={updateParam('texture_delayMix', 'delayMix')} color={MOSS} />
            <DivineKnob id="texture_realm" label="DIVINE" value={divine} onChange={updateParam('texture_realm', 'realm')} color={GREEN} />
          </div>
        </div>

        {/* Mini Keyboard */}
        <MiniKeyboard onNoteOn={noteOn} onNoteOff={noteOff} color={GREEN} startNote={48} octaves={2} />
      </div>
      <OutputMeter color={GREEN} level={rmsLevel} peak={peakLevel} />
    </div>
  );
};
