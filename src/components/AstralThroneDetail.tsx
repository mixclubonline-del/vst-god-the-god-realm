/**
 * AstralThroneDetail — Detail panel for the currently selected throne
 *
 * Shows waveform, knobs (Vol/Pan/Tune/Texture/Fine), play mode (Layer/RR/Random),
 * domain lore, MIDI mapping, and quick actions.
 *
 * Absorbs all controls from SoundSlot.tsx into the new split-view layout.
 */
import React, { useCallback, useState } from 'react';
import type { ThroneDomain } from '../data/throneDomains';
import { DivineKnob } from './ui/DivineKnob';
import { ThroneWaveform } from './ThroneWaveform';
import { Scissors, Music, Trash2, Keyboard, Zap, Layers, FolderOpen } from 'lucide-react';
import type { SliceData } from '../audio/BufferRegistry';
import { electricPantheonGods, type ElectricPantheonGodId } from '../data/electricPantheonGods';
import { usePluginWindows } from '@/contexts/PluginWindowContext';
import { PLUGIN_LIST } from '@/data/pluginRegistry';
import type { PluginId } from '@/data/pluginRegistry';

export type PlayMode = 'layer' | 'roundrobin' | 'random';

interface AstralThroneDetailProps {
  index: number;
  domain: ThroneDomain;
  sampleName: string;
  isLoaded: boolean;
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  playMode: PlayMode;
  onPlayModeChange: (mode: PlayMode) => void;
  rrPosition?: number;      // current round-robin position (e.g. 2)
  rrTotal?: number;          // total round-robin variations (e.g. 4)
  midiNote: number;         // currently mapped MIDI note
  onMidiLearn: () => void;   // enter MIDI learn mode
  onOpenChopper: () => void;
  onOpenSequencer: () => void;
  onClearThrone: () => void;
  onOpenArchivePicker?: () => void;
  /** Real AudioBuffer from BufferRegistry for live waveform */
  buffer?: AudioBuffer | null;
  /** Chopper slice data */
  slices?: SliceData[];
}

const PLAY_MODES: { mode: PlayMode; label: string; abbr: string }[] = [
  { mode: 'layer', label: 'Layer', abbr: 'LYR' },
  { mode: 'roundrobin', label: 'Round Robin', abbr: 'RR' },
  { mode: 'random', label: 'Random', abbr: 'RND' },
];

const FILTER_TYPES: { type: BiquadFilterType; label: string }[] = [
  { type: 'lowpass', label: 'LP' },
  { type: 'highpass', label: 'HP' },
  { type: 'bandpass', label: 'BP' },
  { type: 'notch', label: 'NTCH' },
];

const FX_SENDS = [
  { id: 'Rev', label: 'REV', color: '#FFD700', god: 'Poseidon' },
  { id: 'Chr', label: 'CHR', color: '#60A5FA', god: 'Athena' },
  { id: 'Dly', label: 'DLY', color: '#22C55E', god: 'Chronos' },
  { id: 'Sat', label: 'SAT', color: '#EF4444', god: 'Hades' },
] as const;

/** Compact god picker data for synth layer */
const GOD_OPTIONS = electricPantheonGods.map(g => ({
  id: g.id,
  name: g.name,
  icon: g.icon,
  color: g.colors.primary,
}));

/** Convert MIDI note number to note name */
function midiNoteName(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  return `${names[note % 12]}${octave}`;
}

export const AstralThroneDetail: React.FC<AstralThroneDetailProps> = React.memo(({
  index,
  domain,
  sampleName,
  isLoaded,
  parameterValues,
  update,
  playMode,
  onPlayModeChange,
  rrPosition = 0,
  rrTotal = 0,
  midiNote,
  onMidiLearn,
  onOpenChopper,
  onOpenSequencer,
  onClearThrone,
  onOpenArchivePicker,
  buffer = null,
  slices = [],
}) => {
  const id = index;
  const vol = parameterValues[`slotVol_${id}`] ?? 75;
  const pan = parameterValues[`slotPan_${id}`] ?? 50;
  const tune = parameterValues[`slotTune_${id}`] ?? 50;
  const texture = parameterValues[`slotTexture_${id}`] ?? 40;
  const fine = parameterValues[`slotFine_${id}`] ?? 50;

  // ADSR envelope — reads from parameterValues, defaults to musical values
  const attack = parameterValues[`slotAttack_${id}`] ?? 5;
  const decay = parameterValues[`slotDecay_${id}`] ?? 30;
  const sustain = parameterValues[`slotSustain_${id}`] ?? 80;
  const release = parameterValues[`slotRelease_${id}`] ?? 25;

  // Filter — reads from parameterValues
  const filterType = (parameterValues[`slotFilterType_${id}`] ?? 'lowpass') as BiquadFilterType;
  const filterFreq = parameterValues[`slotFilterFreq_${id}`] ?? 100; // 0-100 knob range
  const filterQ = parameterValues[`slotFilterQ_${id}`] ?? 15;        // 0-100 knob range

  // FX Sends
  const fxRev = parameterValues[`slotFxRev_${id}`] ?? 0;
  const fxChr = parameterValues[`slotFxChr_${id}`] ?? 0;
  const fxDly = parameterValues[`slotFxDly_${id}`] ?? 0;
  const fxSat = parameterValues[`slotFxSat_${id}`] ?? 0;
  const fxValues: Record<string, number> = { Rev: fxRev, Chr: fxChr, Dly: fxDly, Sat: fxSat };

  // Synth Layer
  const synthLayerEnabled = parameterValues[`slotSynthLayer_${id}`] ?? false;
  const synthGodId = (parameterValues[`slotSynthGod_${id}`] ?? 'olympus') as ElectricPantheonGodId;
  const [showGodPicker, setShowGodPicker] = useState(false);
  const [showPluginPicker, setShowPluginPicker] = useState(false);
  const { openPlugin } = usePluginWindows();

  const handlePlayModeClick = useCallback(() => {
    const currentIdx = PLAY_MODES.findIndex(m => m.mode === playMode);
    const next = PLAY_MODES[(currentIdx + 1) % PLAY_MODES.length];
    onPlayModeChange(next.mode);
  }, [playMode, onPlayModeChange]);

  if (!domain) return null;

  return (
    <div
      className="astral-detail"
      style={{ '--throne-color': domain.color } as React.CSSProperties}
    >
      {/* Header: Sigil + Domain Name + Lore */}
      <div className="astral-detail__header">
        <img
          className="astral-detail__header-sigil"
          src={domain.sigilImage}
          alt={domain.name}
          draggable={false}
        />
        <div className="astral-detail__header-info">
          <div className="astral-detail__throne-name">
            <span className="astral-detail__throne-number">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="astral-detail__domain-name">{domain.name.toUpperCase()}</span>
          </div>
          {isLoaded ? (
            <div className="astral-detail__sample-name">{sampleName}</div>
          ) : (
            <div className="astral-detail__lore">{domain.lore}</div>
          )}
        </div>

        {/* MIDI Note Badge */}
        <button
          className="astral-detail__midi-badge"
          onClick={onMidiLearn}
          title="Click to enter MIDI Learn mode"
        >
          <Keyboard size={10} />
          <span>{midiNoteName(midiNote)}</span>
        </button>
      </div>

      {/* Live Waveform from BufferRegistry */}
      <div className="astral-detail__waveform">
        <ThroneWaveform
          buffer={buffer}
          color={domain.color}
          height={72}
          slices={slices}
          sigil={domain.sigil}
          lore={domain.lore}
        />
      </div>

      {/* Knob Row — Migrated from SoundSlot */}
      <div className="astral-detail__knobs">
        <DivineKnob
          label="Vol"
          size="sm"
          value={vol}
          onChange={(v) => update(`slotVol_${id}`, v)}
          unit="dB"
          color={domain.color}
        />
        <DivineKnob
          label="Pan"
          size="sm"
          value={pan}
          onChange={(v) => update(`slotPan_${id}`, v)}
          color={domain.color}
        />
        <DivineKnob
          label="Tune"
          size="sm"
          value={tune}
          onChange={(v) => update(`slotTune_${id}`, v)}
          color={domain.color}
        />
        <DivineKnob
          label="Txture"
          size="sm"
          value={texture}
          onChange={(v) => update(`slotTexture_${id}`, v)}
          color={domain.color}
        />
        <DivineKnob
          label="Fine"
          size="sm"
          value={fine}
          onChange={(v) => update(`slotFine_${id}`, v)}
          color={domain.color}
        />
      </div>

      {/* ADSR Envelope Row */}
      <div className="astral-detail__knobs astral-detail__knobs--adsr">
        <DivineKnob
          label="Atk"
          size="sm"
          value={attack}
          onChange={(v) => update(`slotAttack_${id}`, v)}
          color={domain.color}
          min={0}
          max={100}
        />
        <DivineKnob
          label="Dec"
          size="sm"
          value={decay}
          onChange={(v) => update(`slotDecay_${id}`, v)}
          color={domain.color}
          min={0}
          max={100}
        />
        <DivineKnob
          label="Sus"
          size="sm"
          value={sustain}
          onChange={(v) => update(`slotSustain_${id}`, v)}
          color={domain.color}
          min={0}
          max={100}
        />
        <DivineKnob
          label="Rel"
          size="sm"
          value={release}
          onChange={(v) => update(`slotRelease_${id}`, v)}
          color={domain.color}
          min={0}
          max={100}
        />
      </div>

      {/* Filter Section */}
      <div className="astral-detail__filter-row">
        <button
          className="astral-detail__filter-type-btn"
          onClick={() => {
            const currentIdx = FILTER_TYPES.findIndex(f => f.type === filterType);
            const next = FILTER_TYPES[(currentIdx + 1) % FILTER_TYPES.length];
            update(`slotFilterType_${id}`, next.type);
          }}
          title={`Filter: ${filterType}`}
          style={{ color: domain.color }}
        >
          {FILTER_TYPES.find(f => f.type === filterType)?.label || 'LP'}
        </button>
        <DivineKnob
          label="Freq"
          size="sm"
          value={filterFreq}
          onChange={(v) => update(`slotFilterFreq_${id}`, v)}
          color={domain.color}
          min={0}
          max={100}
        />
        <DivineKnob
          label="Res"
          size="sm"
          value={filterQ}
          onChange={(v) => update(`slotFilterQ_${id}`, v)}
          color={domain.color}
          min={0}
          max={100}
        />
      </div>

      {/* FX Send Row — Pantheon God Sends */}
      <div className="astral-detail__knobs astral-detail__knobs--fx">
        {FX_SENDS.map(fx => (
          <DivineKnob
            key={fx.id}
            label={fx.label}
            size="sm"
            value={fxValues[fx.id]}
            onChange={(v) => update(`slotFx${fx.id}_${id}`, v)}
            color={fx.color}
            min={0}
            max={100}
          />
        ))}
      </div>

      {/* Actions Row */}
      <div className="astral-detail__actions">
        {/* Play Mode Toggle */}
        <button
          className="astral-detail__playmode-btn"
          onClick={handlePlayModeClick}
          title={`Play Mode: ${PLAY_MODES.find(m => m.mode === playMode)?.label}`}
        >
          <span className="astral-detail__playmode-label">
            {PLAY_MODES.find(m => m.mode === playMode)?.abbr}
          </span>
          {playMode === 'roundrobin' && rrTotal > 0 && (
            <span className="astral-detail__rr-counter">{rrPosition}/{rrTotal}</span>
          )}
        </button>

        <div className="astral-detail__action-group">
          {/* Browse Archive */}
          <button
            className="astral-detail__action-btn"
            onClick={onOpenArchivePicker}
            title="Browse archive for samples"
          >
            <FolderOpen size={12} />
            <span>Browse</span>
          </button>

          {/* Open in Chopper */}
          <button
            className="astral-detail__action-btn"
            onClick={onOpenChopper}
            disabled={!isLoaded}
            title="Open in Sample Chopper"
          >
            <Scissors size={12} />
            <span>Chop</span>
          </button>

          {/* Open in Sequencer */}
          <button
            className="astral-detail__action-btn"
            onClick={onOpenSequencer}
            title="Show in Sequencer"
          >
            <Music size={12} />
            <span>Seq</span>
          </button>

          {/* Clear Throne */}
          <button
            className="astral-detail__action-btn astral-detail__action-btn--danger"
            onClick={onClearThrone}
            disabled={!isLoaded}
            title="Clear this throne"
          >
            <Trash2 size={12} />
          </button>

          {/* Synth Layer Toggle */}
          <button
            className={`astral-detail__action-btn ${synthLayerEnabled ? 'astral-detail__action-btn--active' : ''}`}
            onClick={() => update(`slotSynthLayer_${id}`, !synthLayerEnabled)}
            title={synthLayerEnabled ? 'Disable Synth Layer' : 'Enable Synth Layer'}
            style={synthLayerEnabled ? { color: GOD_OPTIONS.find(g => g.id === synthGodId)?.color } : undefined}
          >
            <Zap size={12} />
            <span>Synth</span>
          </button>

          {/* Open Floating Plugin */}
          <button
            className="astral-detail__action-btn"
            onClick={() => setShowPluginPicker(!showPluginPicker)}
            title="Open Plugin Instrument"
          >
            <Layers size={12} />
            <span>Plugin</span>
          </button>
        </div>

        {/* Synth Layer God Picker (shown when layer is enabled) */}
        {synthLayerEnabled && (
          <div className="astral-detail__synth-layer">
            <button
              className="astral-detail__god-picker-btn"
              onClick={() => setShowGodPicker(!showGodPicker)}
              style={{ '--god-color': GOD_OPTIONS.find(g => g.id === synthGodId)?.color } as React.CSSProperties}
            >
              <span>{GOD_OPTIONS.find(g => g.id === synthGodId)?.icon}</span>
              <span>{GOD_OPTIONS.find(g => g.id === synthGodId)?.name}</span>
              <span className="astral-detail__god-picker-arrow">▼</span>
            </button>
            {showGodPicker && (
              <div className="astral-detail__god-dropdown">
                {GOD_OPTIONS.map(god => (
                  <button
                    key={god.id}
                    className={`astral-detail__god-option ${god.id === synthGodId ? 'astral-detail__god-option--active' : ''}`}
                    onClick={() => {
                      update(`slotSynthGod_${id}`, god.id);
                      setShowGodPicker(false);
                    }}
                    style={{ '--god-color': god.color } as React.CSSProperties}
                  >
                    <span>{god.icon}</span>
                    <span>{god.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Plugin Picker (quick list of available plugins) */}
        {showPluginPicker && (
          <div className="astral-detail__plugin-picker">
            {PLUGIN_LIST.map(p => (
              <button
                key={p.id}
                className="astral-detail__plugin-option"
                onClick={() => {
                  openPlugin(p.id as PluginId);
                  setShowPluginPicker(false);
                }}
                style={{ '--plugin-color': p.theme.primary } as React.CSSProperties}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

AstralThroneDetail.displayName = 'AstralThroneDetail';
