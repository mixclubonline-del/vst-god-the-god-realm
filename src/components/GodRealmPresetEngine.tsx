/**
 * GodRealmPresetEngine — Multi-Layer Preset Engine
 * Full layer editor, global FX, macro assignments, preset browser.
 * God Realm aesthetic: dark, gold, mythological.
 */
import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Copy, ChevronUp, ChevronDown, Eye, EyeOff,
  Save, Download, Upload, Search, Heart, Star, Tag, Zap,
  Settings, Layers, Music, Activity, Filter as FilterIcon,
  Volume2, Sliders, Package, X, Check, MoreVertical,
  Database, Lock, Unlock,
} from 'lucide-react';
import {
  LayeredPreset, Layer, LayerType, OscWaveform, FilterType,
  defaultLayer, defaultGlobalFX, defaultMacro,
  createDefaultPreset,
} from '../types/layeredPreset';
import { layeredPresetService, useLayeredPresets } from '../services/layeredPresetService';

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_TYPES = ['ALL', 'Keys', 'Bass', 'Lead', 'Pad', 'Pluck', 'FX', 'Arp', 'Perc', 'Texture'];
const OSC_WAVEFORMS: OscWaveform[] = ['sine', 'saw', 'square', 'triangle', 'noise', 'pulse'];
const FILTER_TYPES: FilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch', 'peak'];
const DISTORTION_TYPES = ['soft', 'hard', 'tube', 'fuzz'] as const;

const WAVEFORM_ICONS: Record<OscWaveform, string> = {
  sine: '∿', saw: '⊿', square: '⊓', triangle: '△', noise: '≋', pulse: '⊓̃',
};

// ─── Tiny UI helpers ──────────────────────────────────────────────────────────

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  decimals?: number;
  unit?: string;
  color?: string;
  onChange: (v: number) => void;
}

const Knob: React.FC<KnobProps> = ({ label, value, min, max, decimals = 0, unit = '', color = '#f59e0b', onChange }) => {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      const dy = startY.current - me.clientY;
      const range = max - min;
      const newVal = Math.min(max, Math.max(min, startVal.current + (dy / 150) * range));
      onChange(newVal);
    };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none cursor-ns-resize" onMouseDown={onMouseDown}>
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <circle cx="20" cy="20" r="16" fill="none" stroke="#1a1a2e" strokeWidth="3" />
          <circle cx="20" cy="20" r="16" fill="none" stroke={color + '33'} strokeWidth="3"
            strokeDasharray={`${pct * 100.5} 100.5`}
            strokeLinecap="round"
            transform="rotate(-225 20 20)" />
          <line x1="20" y1="20" x2="20" y2="6"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(${angle} 20 20)`} />
          <circle cx="20" cy="20" r="6" fill="#0d0d1a" stroke={color + '44'} strokeWidth="1" />
        </svg>
      </div>
      <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider text-center leading-none">{label}</span>
      <span className="text-[8px] font-mono" style={{ color }}>{value.toFixed(decimals)}{unit}</span>
    </div>
  );
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  decimals?: number;
  unit?: string;
  color?: string;
  onChange: (v: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({ label, value, min, max, decimals = 0, unit = '', color = '#f59e0b', onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-[9px] text-white/40 uppercase tracking-wider w-16 shrink-0">{label}</span>
    <input
      type="range" min={min} max={max} step={(max - min) / 1000}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
      style={{ accentColor: color }}
    />
    <span className="text-[9px] font-mono w-12 text-right shrink-0" style={{ color }}>
      {value.toFixed(decimals)}{unit}
    </span>
  </div>
);

interface ToggleProps { active: boolean; label: string; color?: string; onClick: () => void; }
const Toggle: React.FC<ToggleProps> = ({ active, label, color = '#f59e0b', onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
    style={{
      background: active ? color + '22' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? color + '66' : 'rgba(255,255,255,0.08)'}`,
      color: active ? color : 'rgba(255,255,255,0.3)',
    }}
  >
    <span className="w-2 h-2 rounded-full" style={{ background: active ? color : 'rgba(255,255,255,0.15)' }} />
    {label}
  </button>
);

// ─── Waveform shape SVG ───────────────────────────────────────────────────────

const WaveShape: React.FC<{ waveform: OscWaveform; active: boolean; color: string; onClick: () => void }> = ({ waveform, active, color, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 px-2 py-1.5 rounded transition-all"
    style={{
      background: active ? color + '22' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? color + '66' : 'rgba(255,255,255,0.06)'}`,
    }}
  >
    <span className="text-base leading-none" style={{ color: active ? color : 'rgba(255,255,255,0.3)' }}>
      {WAVEFORM_ICONS[waveform]}
    </span>
    <span className="text-[7px] uppercase tracking-wider" style={{ color: active ? color : 'rgba(255,255,255,0.25)' }}>
      {waveform}
    </span>
  </button>
);

// ─── Layer Editor ─────────────────────────────────────────────────────────────

type LayerEditorTab = 'osc' | 'sample' | 'adsr' | 'filter' | 'pitch';

const LayerEditor: React.FC<{ layer: Layer; onChange: (l: Layer) => void }> = ({ layer, onChange }) => {
  const [tab, setTab] = useState<LayerEditorTab>('osc');
  const c = layer.color;

  const upd = useCallback(<K extends keyof Layer>(key: K, val: Layer[K]) => onChange({ ...layer, [key]: val }), [layer, onChange]);
  const updOsc = useCallback((key: string, val: any) => onChange({ ...layer, osc: { ...layer.osc, [key]: val } }), [layer, onChange]);
  const updAdsr = useCallback((key: string, val: any) => onChange({ ...layer, adsr: { ...layer.adsr, [key]: val } }), [layer, onChange]);
  const updFilter = useCallback((key: string, val: any) => onChange({ ...layer, filter: { ...layer.filter, [key]: val } }), [layer, onChange]);
  const updFilterAdsr = useCallback((key: string, val: any) => onChange({ ...layer, filterAdsr: { ...layer.filterAdsr, [key]: val } }), [layer, onChange]);

  const tabs: { id: LayerEditorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'osc', label: 'OSC', icon: <Music size={10} /> },
    { id: 'sample', label: 'SAMPLE', icon: <Activity size={10} /> },
    { id: 'adsr', label: 'ADSR', icon: <Sliders size={10} /> },
    { id: 'filter', label: 'FILTER', icon: <FilterIcon size={10} /> },
    { id: 'pitch', label: 'PITCH', icon: <Volume2 size={10} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 p-2 border-b border-white/5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
            style={{
              background: tab === t.id ? c + '22' : 'transparent',
              border: `1px solid ${tab === t.id ? c + '55' : 'transparent'}`,
              color: tab === t.id ? c : 'rgba(255,255,255,0.3)',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* ── OSC tab ── */}
        {tab === 'osc' && (
          <>
            <div>
              <p className="text-[9px] text-white/30 uppercase tracking-wider mb-2">Waveform</p>
              <div className="flex gap-1 flex-wrap">
                {OSC_WAVEFORMS.map(wf => (
                  <WaveShape key={wf} waveform={wf} active={layer.osc.waveform === wf} color={c}
                    onClick={() => updOsc('waveform', wf)} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 pt-2">
              <Knob label="OCT" value={layer.osc.octave} min={-2} max={2} color={c} onChange={v => updOsc('octave', Math.round(v))} />
              <Knob label="SEMI" value={layer.osc.semitone} min={-12} max={12} color={c} onChange={v => updOsc('semitone', Math.round(v))} />
              <Knob label="DETUNE" value={layer.osc.detune} min={-100} max={100} unit="¢" color={c} onChange={v => updOsc('detune', v)} />
              <Knob label="PHASE" value={layer.osc.phase} min={0} max={360} unit="°" color={c} onChange={v => updOsc('phase', v)} />
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="text-[9px] text-white/30 uppercase tracking-wider">Unison</p>
              <SliderRow label="Voices" value={layer.osc.unisonVoices} min={1} max={8} color={c}
                onChange={v => updOsc('unisonVoices', Math.round(v))} />
              <SliderRow label="Detune" value={layer.osc.unisonDetune} min={0} max={100} color={c}
                onChange={v => updOsc('unisonDetune', v)} />
              <SliderRow label="Width" value={layer.osc.unisonWidth} min={0} max={100} unit="%" color={c}
                onChange={v => updOsc('unisonWidth', v)} />
              {layer.osc.waveform === 'pulse' && (
                <SliderRow label="PW" value={layer.osc.pulseWidth * 100} min={5} max={95} unit="%" color={c}
                  onChange={v => updOsc('pulseWidth', v / 100)} />
              )}
            </div>
          </>
        )}

        {/* ── SAMPLE tab ── */}
        {tab === 'sample' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded border border-white/10 bg-white/5">
              <Activity size={12} className="text-white/40" />
              <span className="text-[10px] text-white/50 truncate flex-1">
                {layer.sample.name || 'No sample loaded'}
              </span>
              <button
                className="text-[9px] px-2 py-1 rounded uppercase tracking-wider font-bold transition-all"
                style={{ background: c + '22', border: `1px solid ${c}44`, color: c }}
                onClick={() => {/* file picker via JUCE bridge */}}
              >
                Load
              </button>
            </div>
            <div className="space-y-1.5">
              <SliderRow label="Start" value={layer.sample.startPoint * 100} min={0} max={100} unit="%" color={c}
                onChange={v => onChange({ ...layer, sample: { ...layer.sample, startPoint: v / 100 } })} />
              <SliderRow label="End" value={layer.sample.endPoint * 100} min={0} max={100} unit="%" color={c}
                onChange={v => onChange({ ...layer, sample: { ...layer.sample, endPoint: v / 100 } })} />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Toggle active={layer.sample.loopEnabled} label="Loop" color={c}
                onClick={() => onChange({ ...layer, sample: { ...layer.sample, loopEnabled: !layer.sample.loopEnabled } })} />
              <Toggle active={layer.sample.reverse} label="Reverse" color={c}
                onClick={() => onChange({ ...layer, sample: { ...layer.sample, reverse: !layer.sample.reverse } })} />
              <Toggle active={layer.sample.pitchTrack} label="Pitch Track" color={c}
                onClick={() => onChange({ ...layer, sample: { ...layer.sample, pitchTrack: !layer.sample.pitchTrack } })} />
            </div>
          </div>
        )}

        {/* ── ADSR tab ── */}
        {tab === 'adsr' && (
          <div className="space-y-2">
            {/* Visual ADSR shape */}
            <svg viewBox="0 0 200 60" className="w-full h-14 rounded" style={{ background: '#0a0a12' }}>
              {(() => {
                const { attack: a, decay: d, sustain: s, release: r } = layer.adsr;
                const aw = (a / 100) * 40;
                const dw = (d / 100) * 50;
                const rw = (r / 100) * 55;
                const sh = 55 - (s / 100) * 45;
                const sw = 200 - aw - dw - rw - 10;
                return (
                  <polyline
                    points={`5,55 ${5 + aw},5 ${5 + aw + dw},${sh} ${5 + aw + dw + Math.max(sw, 5)},${sh} ${5 + aw + dw + Math.max(sw, 5) + rw},55`}
                    fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  />
                );
              })()}
            </svg>
            <div className="grid grid-cols-4 gap-3">
              <Knob label="ATK" value={layer.adsr.attack} min={0} max={100} color={c} onChange={v => updAdsr('attack', v)} />
              <Knob label="DEC" value={layer.adsr.decay} min={0} max={100} color={c} onChange={v => updAdsr('decay', v)} />
              <Knob label="SUS" value={layer.adsr.sustain} min={0} max={100} unit="%" color={c} onChange={v => updAdsr('sustain', v)} />
              <Knob label="REL" value={layer.adsr.release} min={0} max={100} color={c} onChange={v => updAdsr('release', v)} />
            </div>
          </div>
        )}

        {/* ── FILTER tab ── */}
        {tab === 'filter' && (
          <div className="space-y-3">
            <div>
              <p className="text-[9px] text-white/30 uppercase tracking-wider mb-2">Filter Type</p>
              <div className="flex gap-1">
                {FILTER_TYPES.map(ft => (
                  <button key={ft} onClick={() => updFilter('type', ft)}
                    className="px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: layer.filter.type === ft ? c + '22' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${layer.filter.type === ft ? c + '66' : 'rgba(255,255,255,0.06)'}`,
                      color: layer.filter.type === ft ? c : 'rgba(255,255,255,0.3)',
                    }}>
                    {ft.slice(0, 2).toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Knob label="FREQ" value={layer.filter.frequency} min={20} max={20000} decimals={0} unit="Hz" color={c}
                onChange={v => updFilter('frequency', v)} />
              <Knob label="RESO" value={layer.filter.resonance} min={0} max={100} unit="%" color={c}
                onChange={v => updFilter('resonance', v)} />
              <Knob label="DRIVE" value={layer.filter.drive} min={0} max={100} unit="%" color={c}
                onChange={v => updFilter('drive', v)} />
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="text-[9px] text-white/30 uppercase tracking-wider">Modulation</p>
              <SliderRow label="Env Amt" value={layer.filter.envAmount} min={-100} max={100} color={c}
                onChange={v => updFilter('envAmount', v)} />
              <SliderRow label="LFO Amt" value={layer.filter.lfoAmount} min={-100} max={100} color={c}
                onChange={v => updFilter('lfoAmount', v)} />
              <SliderRow label="Keytrack" value={layer.filter.keytrack} min={0} max={100} unit="%" color={c}
                onChange={v => updFilter('keytrack', v)} />
            </div>
            <div>
              <p className="text-[9px] text-white/30 uppercase tracking-wider mb-2">Filter Envelope</p>
              <div className="grid grid-cols-4 gap-3">
                <Knob label="ATK" value={layer.filterAdsr.attack} min={0} max={100} color={c + 'cc'} onChange={v => updFilterAdsr('attack', v)} />
                <Knob label="DEC" value={layer.filterAdsr.decay} min={0} max={100} color={c + 'cc'} onChange={v => updFilterAdsr('decay', v)} />
                <Knob label="SUS" value={layer.filterAdsr.sustain} min={0} max={100} color={c + 'cc'} onChange={v => updFilterAdsr('sustain', v)} />
                <Knob label="REL" value={layer.filterAdsr.release} min={0} max={100} color={c + 'cc'} onChange={v => updFilterAdsr('release', v)} />
              </div>
            </div>
          </div>
        )}

        {/* ── PITCH tab ── */}
        {tab === 'pitch' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Knob label="VOL" value={layer.volume} min={0} max={100} unit="%" color={c} onChange={v => upd('volume', v)} />
              <Knob label="PAN" value={layer.pan} min={-100} max={100} color={c} onChange={v => upd('pan', v)} />
              <Knob label="PITCH" value={layer.pitch} min={-24} max={24} unit="st" color={c} onChange={v => upd('pitch', Math.round(v))} />
            </div>
            <SliderRow label="Fine" value={layer.finePitch} min={-100} max={100} unit="¢" color={c}
              onChange={v => upd('finePitch', v)} />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Global FX Panel ──────────────────────────────────────────────────────────

const FXPanel: React.FC<{ preset: LayeredPreset; onChange: (p: LayeredPreset) => void }> = ({ preset, onChange }) => {
  const [tab, setTab] = useState<'reverb' | 'delay' | 'chorus' | 'dist' | 'eq' | 'comp'>('reverb');
  const fx = preset.globalFX;
  const updFX = (section: keyof typeof fx, key: string, val: any) => {
    onChange({ ...preset, globalFX: { ...fx, [section]: { ...fx[section], [key]: val } } });
  };

  const fxTabs = [
    { id: 'reverb' as const, label: 'REV', active: fx.reverb.enabled },
    { id: 'delay' as const, label: 'DLY', active: fx.delay.enabled },
    { id: 'chorus' as const, label: 'CHR', active: fx.chorus.enabled },
    { id: 'dist' as const, label: 'DIST', active: fx.distortion.enabled },
    { id: 'eq' as const, label: 'EQ', active: fx.eq.enabled },
    { id: 'comp' as const, label: 'COMP', active: fx.compressor.enabled },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-2 border-b border-white/5 flex-wrap">
        {fxTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
            style={{
              background: tab === t.id ? '#f59e0b22' : 'transparent',
              border: `1px solid ${tab === t.id ? '#f59e0b55' : t.active ? '#f59e0b22' : 'transparent'}`,
              color: tab === t.id ? '#f59e0b' : t.active ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.25)',
            }}>
            {t.active && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tab === 'reverb' && (
          <>
            <Toggle active={fx.reverb.enabled} label="Reverb On" onClick={() => updFX('reverb', 'enabled', !fx.reverb.enabled)} />
            <div className="grid grid-cols-4 gap-3 pt-1">
              <Knob label="MIX" value={fx.reverb.mix} min={0} max={100} unit="%" color="#818cf8" onChange={v => updFX('reverb', 'mix', v)} />
              <Knob label="SIZE" value={fx.reverb.size} min={0} max={100} unit="%" color="#818cf8" onChange={v => updFX('reverb', 'size', v)} />
              <Knob label="DAMP" value={fx.reverb.damping} min={0} max={100} unit="%" color="#818cf8" onChange={v => updFX('reverb', 'damping', v)} />
              <Knob label="PRE" value={fx.reverb.predelay} min={0} max={100} unit="ms" color="#818cf8" onChange={v => updFX('reverb', 'predelay', v)} />
            </div>
          </>
        )}
        {tab === 'delay' && (
          <>
            <div className="flex gap-2">
              <Toggle active={fx.delay.enabled} label="Delay On" onClick={() => updFX('delay', 'enabled', !fx.delay.enabled)} />
              <Toggle active={fx.delay.sync} label="Sync" color="#38bdf8" onClick={() => updFX('delay', 'sync', !fx.delay.sync)} />
              <Toggle active={fx.delay.pingpong} label="Ping Pong" color="#38bdf8" onClick={() => updFX('delay', 'pingpong', !fx.delay.pingpong)} />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <Knob label="MIX" value={fx.delay.mix} min={0} max={100} unit="%" color="#38bdf8" onChange={v => updFX('delay', 'mix', v)} />
              <Knob label="TIME" value={fx.delay.time} min={0} max={100} color="#38bdf8" onChange={v => updFX('delay', 'time', v)} />
              <Knob label="FDBK" value={fx.delay.feedback} min={0} max={100} unit="%" color="#38bdf8" onChange={v => updFX('delay', 'feedback', v)} />
            </div>
          </>
        )}
        {tab === 'chorus' && (
          <>
            <Toggle active={fx.chorus.enabled} label="Chorus On" onClick={() => updFX('chorus', 'enabled', !fx.chorus.enabled)} />
            <div className="grid grid-cols-3 gap-3 pt-1">
              <Knob label="MIX" value={fx.chorus.mix} min={0} max={100} unit="%" color="#34d399" onChange={v => updFX('chorus', 'mix', v)} />
              <Knob label="RATE" value={fx.chorus.rate} min={0} max={100} color="#34d399" onChange={v => updFX('chorus', 'rate', v)} />
              <Knob label="DEPTH" value={fx.chorus.depth} min={0} max={100} unit="%" color="#34d399" onChange={v => updFX('chorus', 'depth', v)} />
            </div>
            <SliderRow label="Voices" value={fx.chorus.voices} min={2} max={4} color="#34d399" onChange={v => updFX('chorus', 'voices', Math.round(v))} />
          </>
        )}
        {tab === 'dist' && (
          <>
            <Toggle active={fx.distortion.enabled} label="Distortion On" onClick={() => updFX('distortion', 'enabled', !fx.distortion.enabled)} />
            <div className="flex gap-1 pt-1">
              {DISTORTION_TYPES.map(dt => (
                <button key={dt} onClick={() => updFX('distortion', 'type', dt)}
                  className="px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: fx.distortion.type === dt ? '#f8717122' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${fx.distortion.type === dt ? '#f8717166' : 'rgba(255,255,255,0.06)'}`,
                    color: fx.distortion.type === dt ? '#f87171' : 'rgba(255,255,255,0.3)',
                  }}>{dt}</button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <Knob label="DRIVE" value={fx.distortion.drive} min={0} max={100} unit="%" color="#f87171" onChange={v => updFX('distortion', 'drive', v)} />
              <Knob label="TONE" value={fx.distortion.tone} min={0} max={100} unit="%" color="#f87171" onChange={v => updFX('distortion', 'tone', v)} />
              <Knob label="MIX" value={fx.distortion.mix} min={0} max={100} unit="%" color="#f87171" onChange={v => updFX('distortion', 'mix', v)} />
            </div>
          </>
        )}
        {tab === 'eq' && (
          <>
            <Toggle active={fx.eq.enabled} label="EQ On" onClick={() => updFX('eq', 'enabled', !fx.eq.enabled)} />
            <div className="grid grid-cols-4 gap-3 pt-1">
              <Knob label="LOW" value={fx.eq.low} min={-12} max={12} decimals={1} unit="dB" color="#fbbf24" onChange={v => updFX('eq', 'low', v)} />
              <Knob label="L-MID" value={fx.eq.lowMid} min={-12} max={12} decimals={1} unit="dB" color="#fbbf24" onChange={v => updFX('eq', 'lowMid', v)} />
              <Knob label="H-MID" value={fx.eq.highMid} min={-12} max={12} decimals={1} unit="dB" color="#fbbf24" onChange={v => updFX('eq', 'highMid', v)} />
              <Knob label="HIGH" value={fx.eq.high} min={-12} max={12} decimals={1} unit="dB" color="#fbbf24" onChange={v => updFX('eq', 'high', v)} />
            </div>
          </>
        )}
        {tab === 'comp' && (
          <>
            <Toggle active={fx.compressor.enabled} label="Comp On" onClick={() => updFX('compressor', 'enabled', !fx.compressor.enabled)} />
            <div className="grid grid-cols-3 gap-3 pt-1">
              <Knob label="THR" value={fx.compressor.threshold} min={-60} max={0} decimals={1} unit="dB" color="#a78bfa" onChange={v => updFX('compressor', 'threshold', v)} />
              <Knob label="RATIO" value={fx.compressor.ratio} min={1} max={20} decimals={1} color="#a78bfa" onChange={v => updFX('compressor', 'ratio', v)} />
              <Knob label="GAIN" value={fx.compressor.makeupGain} min={0} max={30} decimals={1} unit="dB" color="#a78bfa" onChange={v => updFX('compressor', 'makeupGain', v)} />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <SliderRow label="Attack" value={fx.compressor.attack} min={0} max={100} color="#a78bfa" onChange={v => updFX('compressor', 'attack', v)} />
              <SliderRow label="Release" value={fx.compressor.release} min={0} max={100} color="#a78bfa" onChange={v => updFX('compressor', 'release', v)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Macro Panel ──────────────────────────────────────────────────────────────

const MacroPanel: React.FC<{ preset: LayeredPreset; onChange: (p: LayeredPreset) => void }> = ({ preset, onChange }) => {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="p-3 space-y-2">
      <p className="text-[9px] text-white/30 uppercase tracking-wider font-bold">Macro Assignments</p>
      <div className="grid grid-cols-4 gap-2">
        {preset.macros.map((macro, mi) => (
          <div key={macro.id} className="flex flex-col items-center gap-1.5">
            <Knob
              label={macro.name.split(' ').slice(-1)[0]}
              value={macro.value}
              min={0}
              max={100}
              color={macro.color}
              onChange={v => {
                const updated = preset.macros.map((m, i) => i === mi ? { ...m, value: v } : m);
                onChange({ ...preset, macros: updated });
              }}
            />
            <button
              onClick={() => setEditing(editing === macro.id ? null : macro.id)}
              className="text-[7px] px-1.5 py-0.5 rounded uppercase tracking-wider transition-all"
              style={{
                background: editing === macro.id ? macro.color + '22' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${editing === macro.id ? macro.color + '55' : 'rgba(255,255,255,0.08)'}`,
                color: editing === macro.id ? macro.color : 'rgba(255,255,255,0.3)',
              }}
            >
              {macro.targets.length > 0 ? `${macro.targets.length} targets` : 'assign'}
            </button>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {editing && (() => {
          const macro = preset.macros.find(m => m.id === editing);
          if (!macro) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded border p-3 space-y-2"
              style={{ background: '#0a0a12', borderColor: macro.color + '33' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: macro.color }}>{macro.name}</p>
                <button onClick={() => setEditing(null)} className="text-white/30 hover:text-white/60">
                  <X size={10} />
                </button>
              </div>
              <p className="text-[8px] text-white/30">Targets: {macro.targets.length === 0 ? 'None assigned' : macro.targets.map(t => `${t.layerId || 'FX'}.${t.param}`).join(', ')}</p>
              <div className="flex gap-2">
                <button
                  className="text-[9px] px-2 py-1 rounded uppercase tracking-wider font-bold"
                  style={{ background: macro.color + '22', border: `1px solid ${macro.color}44`, color: macro.color }}
                  onClick={() => {
                    // Add a sample target: layer 0, volume
                    const target = { layerId: preset.layers[0]?.id || '', param: 'volume', min: 0, max: 100, curve: 'linear' as const };
                    const updated = preset.macros.map(m => m.id === macro.id
                      ? { ...m, targets: [...m.targets, target] } : m);
                    onChange({ ...preset, macros: updated });
                  }}
                >
                  + Add Target
                </button>
                {macro.targets.length > 0 && (
                  <button
                    className="text-[9px] px-2 py-1 rounded uppercase tracking-wider font-bold"
                    style={{ background: '#f8717122', border: '1px solid #f8717144', color: '#f87171' }}
                    onClick={() => {
                      const updated = preset.macros.map(m => m.id === macro.id ? { ...m, targets: [] } : m);
                      onChange({ ...preset, macros: updated });
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

// ─── Preset Browser ───────────────────────────────────────────────────────────

interface PresetBrowserProps {
  selected: LayeredPreset | null;
  onSelect: (p: LayeredPreset) => void;
  onClose: () => void;
}

const PresetBrowser: React.FC<PresetBrowserProps> = ({ selected, onSelect, onClose }) => {
  const service = useLayeredPresets();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const [favOnly, setFavOnly] = useState(false);

  const presets = service.search(query, type === 'ALL' ? undefined : type, favOnly);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="flex items-center gap-2 p-2 border-b border-white/5">
        <Search size={12} className="text-white/30 shrink-0" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search rituals..."
          className="flex-1 bg-transparent text-[11px] text-white/70 placeholder-white/20 outline-none"
        />
        <button onClick={() => setFavOnly(f => !f)} className="transition-colors" title="Favorites only">
          <Heart size={12} className={favOnly ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'} />
        </button>
        <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={12} /></button>
      </div>

      {/* Type filter */}
      <div className="flex gap-1 p-2 border-b border-white/5 overflow-x-auto">
        {PRESET_TYPES.map(t => (
          <button key={t} onClick={() => setType(t)}
            className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider whitespace-nowrap transition-all"
            style={{
              background: type === t ? '#f59e0b22' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${type === t ? '#f59e0b66' : 'rgba(255,255,255,0.06)'}`,
              color: type === t ? '#f59e0b' : 'rgba(255,255,255,0.3)',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Preset list */}
      <div className="flex-1 overflow-y-auto">
        {presets.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-white/20 text-[11px]">No rituals found</div>
        ) : presets.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full flex items-center gap-3 px-3 py-2 border-b border-white/5 hover:bg-white/5 transition-colors text-left"
            style={{ background: selected?.id === p.id ? 'rgba(245,158,11,0.08)' : undefined }}
          >
            <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: `hsl(${p.energyLevel * 2.4},50%,15%)`, border: `1px solid hsl(${p.energyLevel * 2.4},50%,35%)40` }}>
              {p.type.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white/80 truncate">{p.name}</p>
              <p className="text-[9px] text-white/30 truncate">{p.author} · {p.type}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {p.fav && <Heart size={8} className="text-yellow-400 fill-yellow-400" />}
              <span className="text-[8px] text-white/20">{p.layers.length}L</span>
              {selected?.id === p.id && <Check size={10} className="text-yellow-400" />}
            </div>
          </button>
        ))}
      </div>

      {/* Action bar */}
      <div className="p-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[9px] text-white/30">{presets.length} rituals</span>
        <button
          onClick={() => { const p = service.createNew(); onSelect(p); }}
          className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider"
          style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b' }}
        >
          <Plus size={10} /> New Ritual
        </button>
      </div>
    </div>
  );
};

// ─── Save Modal ───────────────────────────────────────────────────────────────

const SaveModal: React.FC<{
  preset: LayeredPreset;
  onSave: (p: LayeredPreset) => void;
  onClose: () => void;
}> = ({ preset, onSave, onClose }) => {
  const [name, setName] = useState(preset.name);
  const [type, setType] = useState(preset.type);
  const [tags, setTags] = useState(preset.tags.join(', '));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="rounded-xl border p-6 w-80 space-y-4"
        style={{ background: '#0a0a18', borderColor: '#f59e0b44' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[13px] font-black uppercase tracking-widest text-yellow-400">Save Ritual</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider block mb-1">Name</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-yellow-400/40"
            />
          </div>
          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider block mb-1">Type</label>
            <div className="flex gap-1 flex-wrap">
              {PRESET_TYPES.slice(1).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: type === t ? '#f59e0b22' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${type === t ? '#f59e0b66' : 'rgba(255,255,255,0.06)'}`,
                    color: type === t ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                  }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider block mb-1">Tags (comma separated)</label>
            <input
              value={tags} onChange={e => setTags(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-yellow-400/40"
              placeholder="Dark, Warm, Aggressive..."
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-wider border border-white/10 text-white/40 hover:text-white/60 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...preset, name, type, tags: tags.split(',').map(t => t.trim()).filter(Boolean) })}
            className="flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{ background: '#f59e0b22', border: '1px solid #f59e0b66', color: '#f59e0b' }}
          >
            Save Ritual
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface GodRealmPresetEngineProps {
  showMessage?: (msg: string) => void;
}

export const GodRealmPresetEngine: React.FC<GodRealmPresetEngineProps> = ({ showMessage }) => {
  const service = useLayeredPresets();
  const allPresets = service.getAll();

  const [activePreset, setActivePreset] = useState<LayeredPreset>(
    allPresets[0] ?? createDefaultPreset()
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string>(activePreset.layers[0]?.id || '');
  const [rightPanel, setRightPanel] = useState<'fx' | 'macro'>('fx');
  const [showBrowser, setShowBrowser] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const selectedLayer = activePreset.layers.find(l => l.id === selectedLayerId) ?? activePreset.layers[0];

  const updateLayer = useCallback((updated: Layer) => {
    setActivePreset(p => ({
      ...p,
      layers: p.layers.map(l => l.id === updated.id ? updated : l),
    }));
  }, []);

  const addLayer = () => {
    const newLayer = defaultLayer(activePreset.layers.length);
    setActivePreset(p => ({ ...p, layers: [...p.layers, newLayer] }));
    setSelectedLayerId(newLayer.id);
  };

  const removeLayer = (id: string) => {
    if (activePreset.layers.length <= 1) return;
    const remaining = activePreset.layers.filter(l => l.id !== id);
    setActivePreset(p => ({ ...p, layers: remaining }));
    if (selectedLayerId === id) setSelectedLayerId(remaining[0].id);
  };

  const moveLayer = (id: string, dir: -1 | 1) => {
    const idx = activePreset.layers.findIndex(l => l.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= activePreset.layers.length) return;
    const arr = [...activePreset.layers];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setActivePreset(p => ({ ...p, layers: arr }));
  };

  const handleSave = (updated: LayeredPreset) => {
    service.save(updated);
    setActivePreset(updated);
    setShowSaveModal(false);
    showMessage?.(`RITUAL "${updated.name}" SAVED TO THE VAULT`);
  };

  const handleSelectPreset = (p: LayeredPreset) => {
    setActivePreset(JSON.parse(JSON.stringify(p)));
    setSelectedLayerId(p.layers[0]?.id || '');
    setShowBrowser(false);
  };

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden select-none"
      style={{ background: 'linear-gradient(135deg, #050508 0%, #0a0a18 50%, #05050a 100%)' }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 shrink-0"
        style={{ background: 'rgba(0,0,0,0.4)' }}>

        {/* God Realm icon + title */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 12px #f59e0b44' }}>
            <Layers size={14} className="text-black" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-400/80">Divine Forge</p>
            <p className="text-[7px] text-white/20 uppercase tracking-wider">Multi-Layer Engine</p>
          </div>
        </div>

        {/* Preset name — click to open browser */}
        <button
          onClick={() => setShowBrowser(s => !s)}
          className="flex items-center gap-2 px-3 py-1.5 rounded transition-all flex-1 max-w-xs"
          style={{
            background: showBrowser ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${showBrowser ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <Database size={11} className="text-yellow-400/60 shrink-0" />
          <span className="text-[11px] font-bold text-white/80 truncate">{activePreset.name}</span>
          <span className="text-[9px] text-white/30 uppercase ml-auto">{activePreset.type}</span>
        </button>

        {/* Prev/Next */}
        <div className="flex">
          {['prev', 'next'].map(dir => (
            <button key={dir}
              onClick={() => {
                const all = service.getAll();
                const idx = all.findIndex(p => p.id === activePreset.id);
                const next = dir === 'next' ? all[(idx + 1) % all.length] : all[(idx - 1 + all.length) % all.length];
                if (next) handleSelectPreset(next);
              }}
              className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-yellow-400 transition-colors">
              {dir === 'prev' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          ))}
        </div>

        {/* Star favorite */}
        <button onClick={() => {
          service.toggleFav(activePreset.id);
          setActivePreset(p => ({ ...p, fav: !p.fav }));
        }}>
          <Heart size={13} className={activePreset.fav ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'} />
        </button>

        <div className="flex-1" />

        {/* Action buttons */}
        <button onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
          style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b' }}>
          <Save size={10} /> Save
        </button>

        <button onClick={() => {
          const json = service.export(activePreset.id);
          if (json) {
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${activePreset.name.replace(/\s/g, '-')}.gpre`;
            a.click();
            showMessage?.('RITUAL EXPORTED');
          }
        }}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
          <Download size={10} /> Export
        </button>

        <label className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
          <Upload size={10} /> Import
          <input type="file" accept=".gpre,.json" className="hidden" onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
              const p = service.import(ev.target?.result as string);
              if (p) { handleSelectPreset(p); showMessage?.(`RITUAL "${p.name}" IMPORTED`); }
              else showMessage?.('FAILED TO IMPORT RITUAL');
            };
            reader.readAsText(file);
            e.target.value = '';
          }} />
        </label>
      </div>

      {/* ── Main 3-column layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─ LEFT: Layer list ─ */}
        <div className="w-52 shrink-0 flex flex-col border-r border-white/5" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/40">Layers</p>
            <button onClick={addLayer} disabled={activePreset.layers.length >= 8}
              className="w-5 h-5 rounded flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b' }}>
              <Plus size={10} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5 p-1.5">
            {activePreset.layers.map((layer, li) => {
              const isActive = layer.id === selectedLayerId;
              return (
                <motion.div key={layer.id} layout
                  className="rounded flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-all group"
                  style={{
                    background: isActive ? layer.color + '18' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? layer.color + '44' : 'rgba(255,255,255,0.05)'}`,
                  }}
                  onClick={() => setSelectedLayerId(layer.id)}
                >
                  {/* Color dot + layer type icon */}
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: layer.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold truncate" style={{ color: isActive ? layer.color : 'rgba(255,255,255,0.6)' }}>
                      {layer.name}
                    </p>
                    <p className="text-[8px] text-white/25 uppercase">{layer.type} · {layer.enabled ? 'ON' : 'OFF'}</p>
                  </div>
                  {/* Level bar */}
                  <div className="w-1 h-6 rounded-full overflow-hidden bg-white/5 shrink-0">
                    <div className="w-full rounded-full transition-all" style={{ height: `${layer.volume}%`, background: layer.color, marginTop: `${100 - layer.volume}%` }} />
                  </div>
                  {/* Quick controls */}
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); moveLayer(layer.id, -1); }}
                      className="text-white/30 hover:text-white/70"><ChevronUp size={9} /></button>
                    <button onClick={e => { e.stopPropagation(); moveLayer(layer.id, 1); }}
                      className="text-white/30 hover:text-white/70"><ChevronDown size={9} /></button>
                  </div>
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); updateLayer({ ...layer, enabled: !layer.enabled }); }}
                      className="transition-colors" style={{ color: layer.enabled ? layer.color : 'rgba(255,255,255,0.2)' }}>
                      {layer.enabled ? <Eye size={9} /> : <EyeOff size={9} />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); removeLayer(layer.id); }}
                      className="text-white/20 hover:text-red-400 transition-colors">
                      <Trash2 size={9} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Layer count indicator */}
          <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-[8px] text-white/20">{activePreset.layers.length}/8 layers</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ background: i < activePreset.layers.length ? activePreset.layers[i].color : 'rgba(255,255,255,0.08)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* ─ CENTER: Layer editor ─ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedLayer ? (
            <>
              <div className="flex items-center gap-3 px-3 py-2 border-b border-white/5"
                style={{ background: selectedLayer.color + '08' }}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: selectedLayer.color, boxShadow: `0 0 8px ${selectedLayer.color}66` }} />
                <input
                  value={selectedLayer.name}
                  onChange={e => updateLayer({ ...selectedLayer, name: e.target.value })}
                  className="bg-transparent text-[12px] font-bold text-white/80 outline-none flex-1"
                />
                <span className="text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                  style={{ background: selectedLayer.color + '22', border: `1px solid ${selectedLayer.color}44`, color: selectedLayer.color }}>
                  {selectedLayer.type}
                </span>
                <button
                  onClick={() => updateLayer({ ...selectedLayer, type: selectedLayer.type === 'oscillator' ? 'sample' : 'oscillator' })}
                  className="text-[8px] text-white/30 hover:text-white/60 uppercase tracking-wider"
                >
                  switch
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <LayerEditor layer={selectedLayer} onChange={updateLayer} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/20 text-[12px]">
              Select a layer
            </div>
          )}
        </div>

        {/* ─ RIGHT: FX + Macros ─ */}
        <div className="w-64 shrink-0 flex flex-col border-l border-white/5" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="flex border-b border-white/5">
            {(['fx', 'macro'] as const).map(p => (
              <button key={p} onClick={() => setRightPanel(p)}
                className="flex-1 py-2 text-[9px] font-black uppercase tracking-wider transition-all"
                style={{
                  background: rightPanel === p ? 'rgba(245,158,11,0.08)' : 'transparent',
                  color: rightPanel === p ? '#f59e0b' : 'rgba(255,255,255,0.25)',
                  borderBottom: rightPanel === p ? '2px solid #f59e0b' : '2px solid transparent',
                }}>
                {p === 'fx' ? '⚡ Global FX' : '🎛 Macros'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {rightPanel === 'fx' ? (
              <FXPanel preset={activePreset} onChange={setActivePreset} />
            ) : (
              <MacroPanel preset={activePreset} onChange={setActivePreset} />
            )}
          </div>
        </div>
      </div>

      {/* ── Preset Browser overlay ── */}
      <AnimatePresence>
        {showBrowser && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 left-4 w-72 rounded-xl border overflow-hidden z-40 flex flex-col"
            style={{ background: '#0a0a18', borderColor: 'rgba(245,158,11,0.3)', height: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
          >
            <PresetBrowser
              selected={activePreset}
              onSelect={handleSelectPreset}
              onClose={() => setShowBrowser(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Save modal ── */}
      <AnimatePresence>
        {showSaveModal && (
          <SaveModal
            preset={activePreset}
            onSave={handleSave}
            onClose={() => setShowSaveModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GodRealmPresetEngine;
