/**
 * EtherealPluck.tsx — 💎 Crystal Bell Pluck Synth
 * God: Apollo | FUI: Scanning Grid
 * "Crystal harmonics with shimmer tail"
 */

import React, { useEffect, useCallback } from 'react';
import { DivineKnob } from '../controls/DivineKnob';
import { WaveformCanvas } from '../controls/WaveformCanvas';
import { MiniKeyboard } from '../controls/MiniKeyboard';
import { OutputMeter } from '../controls/OutputMeter';
import { ADSREnvelope } from '../controls/ADSREnvelope';
import { FilterCurve } from '../controls/FilterCurve';
import { usePluginEngine } from '@/hooks/usePluginEngine';
import { useEngineMetering } from '@/hooks/useEngineMetering';
import { usePluginStore } from '@/services/pluginStore';
import { nativeAudio } from '@/native/bridge';

const ACCENT = '#B87DFF';
const ACCENT2 = '#D4A0FF';

export const EtherealPluck: React.FC = () => {
  const { engine, noteOn, noteOff, setParam } = usePluginEngine('ethereal-pluck');
  const { level: rmsLevel, peak: peakLevel } = useEngineMetering(engine);

  const { activePlugins, setPluginParameter } = usePluginStore();
  const godPlugin = activePlugins.find(p => p.spec.plugin.name.includes('God Realm'));
  const pluginId = godPlugin?.id;
  const parameterValues = godPlugin?.parameterValues || {};

  // Extract parameter values from the global store (with defaults fallback)
  const crystalTone = Number(parameterValues['pluck_modIndex'] ?? 55);
  const prismResonance = Number(parameterValues['pluck_filterQ'] ?? 40);
  const shimmerDecay = Number(parameterValues['pluck_reverbMix'] ?? 65);
  const magicalAttack = Number(parameterValues['pluck_attack'] ?? 20);
  const bodyLevel = Number(parameterValues['pluck_bodyGain'] ?? 50);
  const airLevel = Number(parameterValues['pluck_chorusMix'] ?? 45);
  const stereoWidth = Number(parameterValues['pluck_width'] ?? 60);
  const masterVol = Number(parameterValues['pluck_masterGain'] ?? 70);

  // Keep local Web Audio engine in sync with the global parameter store
  useEffect(() => {
    setParam('modIndex', crystalTone);
    setParam('filterQ', prismResonance);
    setParam('reverbMix', shimmerDecay);
    setParam('attack', magicalAttack);
    setParam('bodyGain', bodyLevel);
    setParam('chorusMix', airLevel);
    setParam('width', stereoWidth);
    setParam('masterGain', masterVol);
  }, [setParam, crystalTone, prismResonance, shimmerDecay, magicalAttack, bodyLevel, airLevel, stereoWidth, masterVol]);

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
    <div className="fp-instrument fp-instrument--ethereal-pluck">
      {/* Top Knob Row */}
      <div className="fp-instrument__section">
        <span className="fp-instrument__section-label">CRYSTAL ENGINE</span>
        <div className="fp-instrument__row">
          <DivineKnob id="pluck_modIndex" label="CRYSTAL TONE" value={crystalTone} onChange={updateParam('pluck_modIndex', 'modIndex')} color={ACCENT} />
          <DivineKnob id="pluck_filterQ" label="PRISM RES" value={prismResonance} onChange={updateParam('pluck_filterQ', 'filterQ')} color={ACCENT} />
          <DivineKnob id="pluck_reverbMix" label="SHIMMER DEC" value={shimmerDecay} onChange={updateParam('pluck_reverbMix', 'reverbMix')} color={ACCENT2} />
          <DivineKnob id="pluck_attack" label="MAGIC ATK" value={magicalAttack} onChange={updateParam('pluck_attack', 'attack')} color={ACCENT2} />
        </div>
      </div>

      {/* Waveform Display & Curves */}
      <div className="fp-instrument__waveform" style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <div style={{ flex: 1.5 }}>
          <WaveformCanvas engine={engine} color={ACCENT} height={90} />
        </div>
        <div style={{ width: '120px', display: 'flex', flexDirection: 'column' }}>
          <span className="fp-instrument__section-label" style={{ marginBottom: '2px' }}>FILTER</span>
          <FilterCurve cutoff={crystalTone} resonance={prismResonance} color={ACCENT} height={70} width={120} />
        </div>
        <div style={{ width: '120px', display: 'flex', flexDirection: 'column' }}>
          <span className="fp-instrument__section-label" style={{ marginBottom: '2px' }}>ENV</span>
          <ADSREnvelope attack={magicalAttack} decay={30} sustain={0} release={40} color={ACCENT2} height={70} width={120} />
        </div>
      </div>

      {/* Bottom Knob Row */}
      <div className="fp-instrument__section">
        <span className="fp-instrument__section-label">DIMENSION</span>
        <div className="fp-instrument__row">
          <DivineKnob id="pluck_bodyGain" label="BODY" value={bodyLevel} onChange={updateParam('pluck_bodyGain', 'bodyGain')} color={ACCENT} size={42} />
          <DivineKnob id="pluck_chorusMix" label="AIR" value={airLevel} onChange={updateParam('pluck_chorusMix', 'chorusMix')} color={ACCENT2} size={42} />
          <DivineKnob id="pluck_width" label="WIDTH" value={stereoWidth} onChange={updateParam('pluck_width', 'width')} color={ACCENT} size={42} />
          <DivineKnob id="pluck_masterGain" label="MASTER" value={masterVol} onChange={updateParam('pluck_masterGain', 'masterGain')} color="#fff" size={42} />
        </div>
      </div>

      {/* Mini Keyboard */}
      <MiniKeyboard onNoteOn={noteOn} onNoteOff={noteOff} color={ACCENT} startNote={60} octaves={2} />
      <OutputMeter color={ACCENT} level={rmsLevel} peak={peakLevel} />
    </div>
  );
};
