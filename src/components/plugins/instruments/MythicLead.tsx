/**
 * MythicLead.tsx — ⚡ Lightning Mono Lead
 * God: Zeus | FUI: Deep-Recessed Hardware
 * "Lightning mono lead with Greek fire transients"
 */

import React, { useEffect, useCallback } from 'react';
import { DivineKnob } from '../controls/DivineKnob';
import { HoloFader } from '../controls/HoloFader';
import { WaveformCanvas } from '../controls/WaveformCanvas';
import { MiniKeyboard } from '../controls/MiniKeyboard';
import { ADSREnvelope } from '../controls/ADSREnvelope';
import { FilterCurve } from '../controls/FilterCurve';
import { OutputMeter } from '../controls/OutputMeter';
import { usePluginEngine } from '@/hooks/usePluginEngine';
import { useEngineMetering } from '@/hooks/useEngineMetering';
import { usePluginStore } from '@/services/pluginStore';
import { nativeAudio } from '@/native/bridge';

const GOLD = '#FFE66D';
const LIGHTNING = '#FFD700';

const DEFAULTS = {
  drive: 40, level: 65, lo: 30, cutoff: 60, res: 35, detune: 20,
  attack: 5, decay: 30, sustain: 50, release: 25, saturation: 30, master: 70,
} as const;

export const MythicLead: React.FC = () => {
  const { engine, noteOn, noteOff, setParam } = usePluginEngine('mythic-lead');
  const { level: rmsLevel, peak: peakLevel } = useEngineMetering(engine);

  const { activePlugins, setPluginParameter } = usePluginStore();
  const godPlugin = activePlugins.find(p => p.spec.plugin.name.includes('God Realm'));
  const pluginId = godPlugin?.id;
  const parameterValues = godPlugin?.parameterValues || {};

  // Extract parameter values from the global store (with defaults fallback)
  const drive = Number(parameterValues['lead_satDrive'] ?? 40);
  const level = Number(parameterValues['lead_bodyGain'] ?? 65);
  const lo = Number(parameterValues['lead_subOscGain'] ?? 30);
  const cutoff = Number(parameterValues['lead_filterFreq'] ?? 60);
  const res = Number(parameterValues['lead_filterQ'] ?? 35);
  const detune = Number(parameterValues['lead_detuneCents'] ?? 20);
  const attack = Number(parameterValues['lead_attack'] ?? 5);
  const decay = Number(parameterValues['lead_decay'] ?? 30);
  const sustain = Number(parameterValues['lead_sustain'] ?? 50);
  const release = Number(parameterValues['lead_release'] ?? 25);
  const saturation = Number(parameterValues['lead_satMix'] ?? 30);
  const master = Number(parameterValues['lead_masterGain'] ?? 70);

  const rawBypassed = parameterValues['lead_bypassed'] ?? 0;
  const bypassed = typeof rawBypassed === 'boolean' ? rawBypassed : rawBypassed !== 0;

  const rawVoiceMode = parameterValues['lead_voiceMode'] ?? 0;
  const voiceMode = (rawVoiceMode === 1 || rawVoiceMode === 'LEGATO') ? 'LEGATO' : 'MONO';

  // Keep local Web Audio engine parameters in sync with the global parameter store
  useEffect(() => {
    setParam('satDrive', drive);
    setParam('bodyGain', level);
    setParam('subOscGain', lo);
    setParam('filterFreq', cutoff);
    setParam('filterQ', res);
    setParam('detuneCents', detune);
    setParam('attack', attack);
    setParam('decay', decay);
    setParam('sustain', sustain);
    setParam('release', release);
    setParam('satMix', saturation);
    setParam('masterGain', master);
  }, [setParam, drive, level, lo, cutoff, res, detune, attack, decay, sustain, release, saturation, master]);

  // Keep local Web Audio engine voice mode in sync
  useEffect(() => {
    if (engine) {
      engine.setVoiceMode(voiceMode);
    }
  }, [engine, voiceMode]);

  const updateParam = useCallback((paramId: string, targetEngineParam: string) => {
    return (v: number) => {
      setParam(targetEngineParam, v);
      if (pluginId) {
        setPluginParameter(pluginId, paramId, v);
        nativeAudio.setParameter(paramId, v);
      }
    };
  }, [pluginId, setPluginParameter, setParam]);

  const handleVoiceMode = useCallback((mode: 'MONO' | 'LEGATO') => {
    const val = mode === 'MONO' ? 0 : 1;
    if (pluginId) {
      setPluginParameter(pluginId, 'lead_voiceMode', val);
      nativeAudio.setParameter('lead_voiceMode', val);
    }
  }, [pluginId, setPluginParameter]);

  const handleSetBypassed = useCallback((b: boolean) => {
    const val = b ? 1 : 0;
    if (pluginId) {
      setPluginParameter(pluginId, 'lead_bypassed', val);
      nativeAudio.setParameter('lead_bypassed', val);
    }
  }, [pluginId, setPluginParameter]);

  const randomizeAll = useCallback(() => {
    if (!pluginId) return;
    const r = () => Math.round(Math.random() * 100);
    const params: Record<string, number> = {
      lead_satDrive: r(),
      lead_bodyGain: r(),
      lead_subOscGain: r(),
      lead_filterFreq: r(),
      lead_filterQ: r(),
      lead_detuneCents: r(),
      lead_attack: r(),
      lead_decay: r(),
      lead_sustain: r(),
      lead_release: r(),
      lead_satMix: r(),
      lead_masterGain: r(),
    };
    Object.entries(params).forEach(([pId, val]) => {
      setPluginParameter(pluginId, pId, val);
      nativeAudio.setParameter(pId, val);
    });
  }, [pluginId, setPluginParameter]);

  const resetAll = useCallback(() => {
    if (!pluginId) return;
    const params: Record<string, number> = {
      lead_satDrive: DEFAULTS.drive,
      lead_bodyGain: DEFAULTS.level,
      lead_subOscGain: DEFAULTS.lo,
      lead_filterFreq: DEFAULTS.cutoff,
      lead_filterQ: DEFAULTS.res,
      lead_detuneCents: DEFAULTS.detune,
      lead_attack: DEFAULTS.attack,
      lead_decay: DEFAULTS.decay,
      lead_sustain: DEFAULTS.sustain,
      lead_release: DEFAULTS.release,
      lead_satMix: DEFAULTS.saturation,
      lead_masterGain: DEFAULTS.master,
    };
    Object.entries(params).forEach(([pId, val]) => {
      setPluginParameter(pluginId, pId, val);
      nativeAudio.setParameter(pId, val);
    });
  }, [pluginId, setPluginParameter]);

  return (
    <div className="fp-instrument fp-instrument--mythic-lead">
      {/* Top Row: Oscillators + Waveform + Filter */}
      <div className="fp-instrument__top-row">
        {/* Left: Oscillators */}
        <div className="fp-instrument__col">
          <span className="fp-instrument__section-label">OSCILLATORS</span>
          <DivineKnob id="lead_satDrive" label="DRIVE" value={drive} onChange={updateParam('lead_satDrive', 'satDrive')} color={GOLD} />
          <DivineKnob id="lead_bodyGain" label="LVL" value={level} onChange={updateParam('lead_bodyGain', 'bodyGain')} color={GOLD} />
          <DivineKnob id="lead_subOscGain" label="LO" value={lo} onChange={updateParam('lead_subOscGain', 'subOscGain')} color={LIGHTNING} />
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
          <FilterCurve cutoff={cutoff} resonance={res} color={LIGHTNING} />
          <DivineKnob id="lead_filterFreq" label="CUTOFF" value={cutoff} onChange={updateParam('lead_filterFreq', 'filterFreq')} color={LIGHTNING} />
          <DivineKnob id="lead_filterQ" label="RES" value={res} onChange={updateParam('lead_filterQ', 'filterQ')} color={LIGHTNING} />
          <DivineKnob id="lead_detuneCents" label="DETUNE" value={detune} onChange={updateParam('lead_detuneCents', 'detuneCents')} color={GOLD} />
        </div>
      </div>

      {/* Bottom Row: Envelope + ADSR + Effects */}
      <div className="fp-instrument__bottom-row">
        {/* Left: Envelope Buttons */}
        <div className="fp-instrument__col fp-instrument__col--btns">
          <span className="fp-instrument__section-label">ENVELOPE</span>
          <button
            className={`fp-instrument__btn${bypassed ? ' fp-instrument__btn--active' : ''}`}
            style={{ '--btn-color': GOLD } as React.CSSProperties}
            onClick={() => handleSetBypassed(!bypassed)}
          >
            POWER
          </button>
          <button
            className="fp-instrument__btn"
            style={{ '--btn-color': GOLD } as React.CSSProperties}
            onClick={randomizeAll}
          >
            RAND
          </button>
          <button
            className="fp-instrument__btn"
            style={{ '--btn-color': LIGHTNING } as React.CSSProperties}
            onClick={resetAll}
          >
            BOLT
          </button>
        </div>

        {/* Center: ADSR Faders */}
        <div className="fp-instrument__section fp-instrument__section--adsr">
          <span className="fp-instrument__section-label">ADSR</span>
          <ADSREnvelope attack={attack} decay={decay} sustain={sustain} release={release} color={GOLD} />
          <div className="fp-instrument__row fp-instrument__row--adsr">
            <HoloFader id="lead_attack" label="ATK" value={attack} onChange={updateParam('lead_attack', 'attack')} color={GOLD} height={60} />
            <HoloFader id="lead_decay" label="DEC" value={decay} onChange={updateParam('lead_decay', 'decay')} color={GOLD} height={60} />
            <HoloFader id="lead_sustain" label="SUS" value={sustain} onChange={updateParam('lead_sustain', 'sustain')} color={LIGHTNING} height={60} />
            <HoloFader id="lead_release" label="REL" value={release} onChange={updateParam('lead_release', 'release')} color={LIGHTNING} height={60} />
          </div>
        </div>

        {/* Right: Effects */}
        <div className="fp-instrument__col fp-instrument__col--fx">
          <span className="fp-instrument__section-label">EFFECTS</span>
          <DivineKnob id="lead_satMix" label="SAT" value={saturation} onChange={updateParam('lead_satMix', 'satMix')} color={LIGHTNING} size={40} />
          <DivineKnob id="lead_masterGain" label="MASTER" value={master} onChange={updateParam('lead_masterGain', 'masterGain')} color="#fff" size={40} />
        </div>
      </div>

      {/* Mini Keyboard */}
      <MiniKeyboard onNoteOn={noteOn} onNoteOff={noteOff} color={GOLD} startNote={48} octaves={2} />
      <OutputMeter color={GOLD} level={rmsLevel} peak={peakLevel} />
    </div>
  );
};
