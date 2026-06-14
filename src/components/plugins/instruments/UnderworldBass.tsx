/**
 * UnderworldBass.tsx — 🌋 Volcanic Mono Bass
 * God: Hades | FUI: Spectral Radar
 * "Volcanic mono bass with heavy saturation chain"
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DivineKnob } from '../controls/DivineKnob';
import { HoloFader } from '../controls/HoloFader';
import { MiniKeyboard } from '../controls/MiniKeyboard';
import { usePluginEngine } from '@/hooks/usePluginEngine';
import { useJuceBridge } from '@/hooks/useJuceBridge';
import { SpectralRadarPanner } from '@/components/SpectralRadarPanner';
import { ADSREnvelope } from '../controls/ADSREnvelope';
import { FilterCurve } from '../controls/FilterCurve';
import { OutputMeter } from '../controls/OutputMeter';
import { useEngineMetering } from '@/hooks/useEngineMetering';
import { usePluginStore } from '@/services/pluginStore';
import { nativeAudio } from '@/native/bridge';

const LAVA = '#EF4444';
const EMBER = '#FF8C42';

export const UnderworldBass: React.FC = () => {
  const { engine, noteOn, noteOff, setParam } = usePluginEngine('underworld-bass');
  const bridgeState = useJuceBridge();
  const { level: rmsLevel, peak: peakLevel } = useEngineMetering(engine);

  const { activePlugins, setPluginParameter } = usePluginStore();
  const godPlugin = activePlugins.find(p => p.spec.plugin.name.includes('God Realm'));
  const pluginId = godPlugin?.id;
  const parameterValues = godPlugin?.parameterValues || {};

  // Extract parameter values from the global store (with defaults fallback)
  const subGain = Number(parameterValues['bass_subOscGain'] ?? 60);
  const drive = Number(parameterValues['bass_satDrive'] ?? 45);
  const distort = Number(parameterValues['bass_satMix'] ?? 30);
  const crush = Number(parameterValues['bass_modIndex'] ?? 15);
  const bassLevel = Number(parameterValues['bass_masterGain'] ?? 70);
  const cutoff = Number(parameterValues['bass_filterFreq'] ?? 55);
  const reso = Number(parameterValues['bass_filterQ'] ?? 35);
  const lavaDrip = Number(parameterValues['bass_delayMix'] ?? 25);
  const attack = Number(parameterValues['bass_attack'] ?? 5);
  const decay = Number(parameterValues['bass_decay'] ?? 40);
  const sustain = Number(parameterValues['bass_sustain'] ?? 60);
  const release = Number(parameterValues['bass_release'] ?? 35);

  // Local state for osc type (not automated)
  const [oscType, setOscType] = useState<'MAGMA' | 'VOLCANIC'>('MAGMA');

  // Keep local Web Audio engine in sync with the global parameter store
  useEffect(() => {
    setParam('subOscGain', subGain);
    setParam('satDrive', drive);
    setParam('satMix', distort);
    setParam('modIndex', crush);
    setParam('masterGain', bassLevel);
    setParam('filterFreq', cutoff);
    setParam('filterQ', reso);
    setParam('delayMix', lavaDrip);
    setParam('attack', attack);
    setParam('decay', decay);
    setParam('sustain', sustain);
    setParam('release', release);
  }, [setParam, subGain, drive, distort, crush, bassLevel, cutoff, reso, lavaDrip, attack, decay, sustain, release]);

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
    <div className="fp-instrument fp-instrument--underworld-bass">
      {/* Waveform */}
      <div className="fp-instrument__waveform" style={{ height: '260px' }}>
        <SpectralRadarPanner spectralData={bridgeState.spectralData} />
      </div>

      {/* Main Controls Row */}
      <div className="fp-instrument__section">
        <div className="fp-instrument__row">
          <DivineKnob id="bass_subOscGain" label="SUB GAIN" value={subGain} onChange={updateParam('bass_subOscGain', 'subOscGain')} color={LAVA} />
          <DivineKnob id="bass_satDrive" label="DRIVE" value={drive} onChange={updateParam('bass_satDrive', 'satDrive')} color={EMBER} />
          <DivineKnob id="bass_satMix" label="DISTORT" value={distort} onChange={updateParam('bass_satMix', 'satMix')} color={LAVA} />
          <DivineKnob id="bass_modIndex" label="CRUSH" value={crush} onChange={updateParam('bass_modIndex', 'modIndex')} color={EMBER} />
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

        <DivineKnob id="bass_masterGain" label="BASS LEVEL" value={bassLevel} onChange={updateParam('bass_masterGain', 'masterGain')} color={LAVA} size={64} />

        <div className="fp-instrument__filter-col">
          <span className="fp-instrument__section-label">FILTER</span>
          <FilterCurve cutoff={cutoff} resonance={reso} color={EMBER} />
          <DivineKnob id="bass_filterFreq" label="CUTOFF" value={cutoff} onChange={updateParam('bass_filterFreq', 'filterFreq')} color={EMBER} size={40} />
          <DivineKnob id="bass_filterQ" label="RESO" value={reso} onChange={updateParam('bass_filterQ', 'filterQ')} color={EMBER} size={40} />
          <DivineKnob id="bass_delayMix" label="LAVA DRIP" value={lavaDrip} onChange={updateParam('bass_delayMix', 'delayMix')} color={LAVA} size={40} />
        </div>
      </div>

      {/* ADSR */}
      <div className="fp-instrument__section">
        <span className="fp-instrument__section-label">AMP ENV</span>
        <ADSREnvelope attack={attack} decay={decay} sustain={sustain} release={release} color={LAVA} />
        <div className="fp-instrument__row fp-instrument__row--adsr">
          <HoloFader id="bass_attack" label="ATK" value={attack} onChange={updateParam('bass_attack', 'attack')} color={LAVA} height={60} />
          <HoloFader id="bass_decay" label="DEC" value={decay} onChange={updateParam('bass_decay', 'decay')} color={LAVA} height={60} />
          <HoloFader id="bass_sustain" label="SUS" value={sustain} onChange={updateParam('bass_sustain', 'sustain')} color={EMBER} height={60} />
          <HoloFader id="bass_release" label="REL" value={release} onChange={updateParam('bass_release', 'release')} color={EMBER} height={60} />
        </div>
      </div>

      {/* Mini Keyboard */}
      <MiniKeyboard onNoteOn={noteOn} onNoteOff={noteOff} color={LAVA} startNote={36} octaves={2} />
      <OutputMeter color={LAVA} level={rmsLevel} peak={peakLevel} />
    </div>
  );
};
