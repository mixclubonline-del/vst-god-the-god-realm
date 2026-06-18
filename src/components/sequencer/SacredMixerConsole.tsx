import React, { useCallback } from 'react';
import './SacredMixerConsole.css';
import type { TrackState, FXSendState, InsertEffectType } from './useSequencerEngine';
import type { TrackLevels } from './useTrackMetering';
import type { MasterParams } from '../../audio/VelvetCurveEngine';
import type { MasterAnalyzer } from '../../audio/MasterAnalyzer';
import { SacredMasterMeter } from './SacredMasterMeter';
import { DivineKnob } from '../ui/DivineKnob';
import { pluginRegistry } from '../plugins/pluginRegistry';

interface SacredMixerConsoleProps {
  tracks: TrackState[];
  selectedTrack: number;
  levels: TrackLevels;
  onSelectTrack: (index: number) => void;
  onSetVolume: (trackIndex: number, volume: number) => void;
  onSetPan: (trackIndex: number, pan: number) => void;
  onSetFxSend: (trackIndex: number, fx: keyof FXSendState, value: number) => void;
  onSetEQ: (trackIndex: number, band: 'low' | 'mid' | 'high', value: number) => void;
  onToggleMute: (trackIndex: number) => void;
  onToggleSolo: (trackIndex: number) => void;
  onAddInsertFx: (trackIndex: number, slotIndex: number, effectType: InsertEffectType) => void;
  onRemoveInsertFx: (trackIndex: number, slotIndex: number) => void;
  onSetInsertFxParam: (trackIndex: number, slotIndex: number, param: string, value: number) => void;
  onToggleInsertFx: (trackIndex: number, slotIndex: number) => void;
  onOpenPlugin?: (trackIndex: number, slotIndex: number) => void;
  master?: MasterParams;
  onSetMasterParam?: (param: keyof MasterParams, value: number) => void;
  analyzer?: MasterAnalyzer | null;
  isPlaying?: boolean;
  bpm?: number;
  parameterValues?: Record<string, any>;
  update?: (id: string, val: any) => void;
}

const FX_KNOBS: { id: keyof FXSendState; label: string; color: string }[] = [
  { id: 'reverb',     label: 'REV', color: '#FFD700' },
  { id: 'chorus',     label: 'CHR', color: '#00E5FF' }, // Icy Cyan
  { id: 'delay',      label: 'DLY', color: '#22C55E' },
  { id: 'saturation', label: 'SAT', color: '#EF4444' }, // Ember Red
];



export const SacredMixerConsole: React.FC<SacredMixerConsoleProps> = ({
  tracks,
  selectedTrack,
  levels,
  onSelectTrack,
  onSetVolume,
  onSetPan,
  onSetFxSend,
  onSetEQ,
  onToggleMute,
  onToggleSolo,
  onAddInsertFx,
  onRemoveInsertFx,
  onSetInsertFxParam,
  onToggleInsertFx,
  onOpenPlugin,
  master,
  onSetMasterParam,
  analyzer,
  isPlaying = false,
  bpm = 120,
  parameterValues = {},
  update,
}) => {
  return (
    <div className="seq-mixconsole">
      <div className="seq-mixconsole__header">
        <h2>GOD CONSOLE</h2>
        <div className="seq-mixconsole__header-glow" />
      </div>
      <div className="seq-mixconsole__channels">
        {tracks.map((track, idx) => (
          <MixerChannel
            key={track.id}
            track={track}
            trackIndex={idx}
            isSelected={selectedTrack === idx}
            level={levels[idx] || { peak: 0, rms: 0 }}
            onSelect={() => onSelectTrack(idx)}
            onSetVolume={(vol) => onSetVolume(idx, vol)}
            onSetPan={(pan) => onSetPan(idx, pan)}
            onSetFxSend={(fx, val) => onSetFxSend(idx, fx, val)}
            onSetEQ={(band, val) => onSetEQ(idx, band, val)}
            onToggleMute={() => onToggleMute(idx)}
            onToggleSolo={() => onToggleSolo(idx)}
            onAddInsertFx={(slot, type) => onAddInsertFx(idx, slot, type)}
            onRemoveInsertFx={(slot) => onRemoveInsertFx(idx, slot)}
            onSetInsertFxParam={(slot, param, val) => onSetInsertFxParam(idx, slot, param, val)}
            onToggleInsertFx={(slot) => onToggleInsertFx(idx, slot)}
            onOpenPlugin={onOpenPlugin ? (slot) => onOpenPlugin(idx, slot) : undefined}
            parameterValues={parameterValues}
            update={update}
          />
        ))}

        {/* Master Channel Strip */}
        {master && onSetMasterParam && (
          <MasterChannel
            master={master}
            onSetMasterParam={onSetMasterParam}
            analyzer={analyzer}
            isPlaying={isPlaying}
            bpm={bpm}
          />
        )}
      </div>
    </div>
  );
};

/* ═══ Individual Mixer Channel ═══ */

interface MixerChannelProps {
  track: TrackState;
  trackIndex: number;
  isSelected: boolean;
  level: { peak: number; rms: number };
  onSelect: () => void;
  onSetVolume: (vol: number) => void;
  onSetPan: (pan: number) => void;
  onSetFxSend: (fx: keyof FXSendState, value: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onAddInsertFx: (slotIndex: number, effectType: InsertEffectType) => void;
  onRemoveInsertFx: (slotIndex: number) => void;
  onSetInsertFxParam: (slotIndex: number, param: string, value: number) => void;
  onToggleInsertFx: (slotIndex: number) => void;
  onOpenPlugin?: (slotIndex: number) => void;
  onSetEQ?: (band: 'low' | 'mid' | 'high', value: number) => void;
  parameterValues?: Record<string, any>;
  update?: (id: string, val: any) => void;
}

const MixerChannel: React.FC<MixerChannelProps> = React.memo(({
  track,
  trackIndex,
  isSelected,
  level,
  onSelect,
  onSetVolume,
  onSetPan,
  onSetFxSend,
  onToggleMute,
  onToggleSolo,
  onAddInsertFx,
  onRemoveInsertFx,
  onSetInsertFxParam,
  onToggleInsertFx,
  onOpenPlugin,
  onSetEQ,
  parameterValues = {},
  update,
}) => {
  const channelClass = [
    'seq-mixconsole__strip',
    isSelected ? 'seq-mixconsole__strip--selected' : '',
    track.muted ? 'seq-mixconsole__strip--muted' : '',
  ].filter(Boolean).join(' ');

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSetVolume(parseFloat(e.target.value));
  }, [onSetVolume]);

  const [expandedSlot, setExpandedSlot] = React.useState<number | null>(null);
  const [selectorSlot, setSelectorSlot] = React.useState<number | null>(null);

  const fxOptions: { type: InsertEffectType; label: string }[] = [
    { type: 'filter', label: 'Filter' },
    { type: 'compressor', label: 'Compressor' },
    { type: 'distortion', label: 'Distortion' },
    { type: 'bitcrusher', label: 'Bitcrusher' },
    { type: 'saturation', label: 'Saturation' },
    { type: 'chorus', label: 'Chorus' },
    { type: 'delay', label: 'Delay' },
    { type: 'reverb', label: 'Reverb' }
  ];

  const handleSlotClick = (e: React.MouseEvent, slotIndex: number, hasEffect: boolean) => {
    e.stopPropagation();
    if (hasEffect) {
      // Open floating plugin window instead of expanding inline
      if (onOpenPlugin) {
        onOpenPlugin(slotIndex);
      } else {
        setExpandedSlot(expandedSlot === slotIndex ? null : slotIndex);
      }
      setSelectorSlot(null);
    } else {
      setSelectorSlot(selectorSlot === slotIndex ? null : slotIndex);
      setExpandedSlot(null);
    }
  };

  const handleSelectFx = (e: React.MouseEvent, slotIndex: number, type: InsertEffectType) => {
    e.stopPropagation();
    onAddInsertFx(slotIndex, type);
    setSelectorSlot(null);
    setExpandedSlot(slotIndex); // Auto-expand new effect
  };

  const handleRemoveFx = (e: React.MouseEvent, slotIndex: number) => {
    e.stopPropagation();
    onRemoveInsertFx(slotIndex);
    setExpandedSlot(null);
  };

  const renderFxParams = (slotIndex: number) => {
    const fx = track.insertFx?.[slotIndex];
    if (!fx || !fx.params) return null;
    return (
      <div className="seq-mixconsole__fx-params" onClick={(e) => e.stopPropagation()}>
        {Object.entries(fx.params).map(([paramName, val]) => (
          <div key={paramName} className="seq-mixconsole__fx-param">
            <span className="seq-mixconsole__fx-param-label">{paramName.substring(0, 4).toUpperCase()}</span>
            <input
              type="range"
              min={paramName === 'threshold' ? -60 : 0}
              max={paramName === 'threshold' ? 0 : paramName === 'cutoff' ? 20000 : paramName === 'type' ? 2 : paramName === 'ratio' ? 20 : paramName === 'attack' ? 100 : paramName === 'release' ? 1000 : paramName === 'time' ? 1000 : 100}
              value={val}
              onChange={(e) => onSetInsertFxParam(slotIndex, paramName, parseFloat(e.target.value))}
              className="seq-mixconsole__fx-param-slider"
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className={channelClass}
      style={{ '--strip-color': track.color } as React.CSSProperties}
      onClick={onSelect}
    >
      <div className="seq-mixconsole__strip-glass" />
      
      {/* Top Routing & Track Info */}
      <div className="seq-mixconsole__strip-top">
        <div className="seq-mixconsole__color-bar" style={{ background: track.color, boxShadow: `0 0 10px ${track.color}66` }} />
        <div className="seq-mixconsole__track-index">{String(trackIndex + 1).padStart(2, '0')}</div>
        {update && (
          <select
            value={parameterValues[`slotOutputRoute_${trackIndex}`] ?? 0}
            onChange={(e) => update(`slotOutputRoute_${trackIndex}`, parseInt(e.target.value, 10))}
            className="seq-mixconsole__route-select"
            title="Output Route"
            onClick={(e) => e.stopPropagation()}
          >
            <option value={0}>Main Out</option>
            <option value={1}>Out 1-2</option>
            <option value={2}>Out 3-4</option>
            <option value={3}>Out 5-6</option>
            <option value={4}>Out 7-8</option>
            <option value={5}>Out 9-10</option>
            <option value={6}>Out 11-12</option>
            <option value={7}>Out 13-14</option>
            <option value={8}>Out 15-16</option>
          </select>
        )}
      </div>

      {/* Insert FX Section */}
      <div className="seq-mixconsole__section seq-mixconsole__inserts">
        <div className="seq-mixconsole__section-label">INSERTS</div>
        {[0, 1, 2, 3].map((slotIndex) => {
          const fx = track.insertFx?.[slotIndex];
          const hasEffect = fx && fx.enabled !== undefined;
          const isExpanded = expandedSlot === slotIndex;
          const isSelecting = selectorSlot === slotIndex;

          return (
            <div key={slotIndex} className={`seq-mixconsole__insert-slot ${hasEffect ? 'has-fx' : ''} ${isExpanded ? 'expanded' : ''}`}>
              <div 
                className="seq-mixconsole__insert-header"
                onClick={(e) => handleSlotClick(e, slotIndex, !!hasEffect)}
              >
                {hasEffect ? (
                  <>
                    <button 
                      className={`seq-mixconsole__insert-power ${fx.enabled ? 'on' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggleInsertFx(slotIndex); }}
                    />
                    <span className="seq-mixconsole__insert-name">
                      {pluginRegistry[fx.type]?.shortName || fx.type.toUpperCase()}
                    </span>
                    <button 
                      className="seq-mixconsole__insert-remove"
                      onClick={(e) => handleRemoveFx(e, slotIndex)}
                    >×</button>
                  </>
                ) : (
                  <span className="seq-mixconsole__insert-empty">+</span>
                )}
              </div>
              
              {isSelecting && !hasEffect && (
                <div className="seq-mixconsole__fx-selector" onClick={(e) => e.stopPropagation()}>
                  {fxOptions.map(opt => (
                    <div 
                      key={opt.type} 
                      className="seq-mixconsole__fx-option"
                      onClick={(e) => handleSelectFx(e, slotIndex, opt.type)}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}

              {isExpanded && hasEffect && renderFxParams(slotIndex)}
            </div>
          );
        })}
      </div>

      {/* EQ Section */}
      {onSetEQ && (
        <div className="seq-mixconsole__section seq-mixconsole__eq">
          <div className="seq-mixconsole__section-label">EQ</div>
          <div className="seq-mixconsole__eq-grid">
            {(['high', 'mid', 'low'] as const).map(band => {
              const val = band === 'low' ? track.eqLow : band === 'mid' ? track.eqMid : track.eqHigh;
              const label = band === 'low' ? 'LO' : band === 'mid' ? 'MID' : 'HI';
              return (
                <div key={band} className="seq-mixconsole__eq-band">
                  <DivineKnob 
                    size="sm" 
                    label={label} 
                    value={val} 
                    min={-12} 
                    max={12} 
                    unit="dB" 
                    color={track.color} 
                    onChange={(v) => onSetEQ && onSetEQ(band, v)} 
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FX Sends Section */}
      <div className="seq-mixconsole__section seq-mixconsole__fx">
        <div className="seq-mixconsole__section-label">SENDS</div>
        <div className="seq-mixconsole__fx-grid">
          {FX_KNOBS.map(knob => (
            <div key={knob.id} className="seq-mixconsole__knob-wrap">
              <DivineKnob 
                size="sm" 
                label={knob.label} 
                value={track.fxSends[knob.id]} 
                min={0} 
                max={100} 
                unit="%" 
                color={knob.color} 
                onChange={(v) => onSetFxSend(knob.id, v)} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pan Section */}
      <div className="seq-mixconsole__section seq-mixconsole__pan">
        <div className="seq-mixconsole__pan-wrap">
          <DivineKnob 
            size="sm" 
            label="PAN" 
            value={track.pan} 
            min={-1} 
            max={1} 
            color={track.color} 
            onChange={(v) => onSetPan(v)} 
          />
        </div>
        <span className="seq-mixconsole__pan-value">
          {track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 100))}` : `R${Math.round(track.pan * 100)}`}
        </span>
      </div>

      {/* Fader & Meter Section */}
      <div className="seq-mixconsole__fader-area">
        {/* Mute / Solo */}
        <div className="seq-mixconsole__ms-buttons">
          <button
            className={`seq-mixconsole__ms-btn ${track.muted ? 'seq-mixconsole__ms-btn--mute' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          >
            MUTE
          </button>
          <button
            className={`seq-mixconsole__ms-btn ${track.soloed ? 'seq-mixconsole__ms-btn--solo' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleSolo(); }}
          >
            SOLO
          </button>
        </div>

        <div className="seq-mixconsole__fader-wrap">
          {/* Fader Track & Thumb */}
          <div className="seq-mixconsole__fader-slot">
            <div className="seq-mixconsole__fader-groove" />
            <div className="seq-mixconsole__fader-ticks">
              <div className="fader-tick fader-tick--0" />
              <div className="fader-tick" />
              <div className="fader-tick fader-tick--12" />
              <div className="fader-tick" />
              <div className="fader-tick fader-tick--24" />
            </div>
            <input
              type="range"
              className="seq-mixconsole__fader-input"
              min={0}
              max={1.5}
              step={0.01}
              value={track.volume}
              onChange={handleVolumeChange}
              title={`Volume: ${Math.round(track.volume * 100)}%`}
            />
            {/* Custom Fader Cap */}
            <div 
              className="seq-mixconsole__fader-cap"
              style={{ bottom: `${(track.volume / 1.5) * 100}%` }}
            >
              <div className="seq-mixconsole__fader-cap-line" style={{ background: track.color, boxShadow: `0 0 8px ${track.color}` }} />
              <div className="seq-mixconsole__fader-cap-base" />
            </div>
          </div>
          
          {/* LED Meter */}
          <div className="seq-mixconsole__meter">
            <div className="seq-mixconsole__meter-glass">
              <div
                className="seq-mixconsole__meter-rms"
                style={{ height: `${level.rms * 100}%`, background: `linear-gradient(to top, #10B981, #F59E0B 80%, #EF4444 95%)` }}
              />
              <div
                className="seq-mixconsole__meter-peak"
                style={{ bottom: `${level.peak * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Label */}
      <div className="seq-mixconsole__bottom-label">
        <div className="seq-mixconsole__vol-value">{Math.round(track.volume * 100)}%</div>
        <div className="seq-mixconsole__track-name">{track.name}</div>
      </div>
    </div>
  );
});

MixerChannel.displayName = 'MixerChannel';



/* ═══ Master Channel Component ═══ */

interface MasterChannelProps {
  master: MasterParams;
  onSetMasterParam: (param: keyof MasterParams, value: number) => void;
  analyzer?: MasterAnalyzer | null;
  isPlaying: boolean;
  bpm: number;
}

const MasterChannel: React.FC<MasterChannelProps> = React.memo(({
  master,
  onSetMasterParam,
  analyzer,
  isPlaying,
  bpm,
}) => {
  return (
    <div className="seq-mixconsole__strip seq-mixconsole__strip--master">
      <div className="seq-mixconsole__strip-glass" />
      
      {/* Top Section */}
      <div className="seq-mixconsole__strip-top">
        <div className="seq-mixconsole__color-bar seq-mixconsole__color-bar--master" />
        <div className="seq-mixconsole__track-index" style={{ color: '#ef4444' }}>MASTER</div>
      </div>

      {/* Velvet Curve Saturation Section */}
      <div className="seq-mixconsole__section seq-mixconsole__eq">
        <div className="seq-mixconsole__section-label">VELVET CURVE</div>
        <div className="seq-mixconsole__fx-grid">
          <div className="seq-mixconsole__knob-wrap">
            <DivineKnob size="sm" label="DRIVE" value={master.drive} min={0} max={4} color="#ef4444" onChange={(v) => onSetMasterParam('drive', v)} />
          </div>
          <div className="seq-mixconsole__knob-wrap">
            <DivineKnob size="sm" label="SILK" value={master.silk} min={0} max={1} color="#f59e0b" onChange={(v) => onSetMasterParam('silk', v)} />
          </div>
        </div>
      </div>

      {/* Master EQ Section */}
      <div className="seq-mixconsole__section seq-mixconsole__eq">
        <div className="seq-mixconsole__section-label">MASTER EQ</div>
        <div className="seq-mixconsole__eq-grid">
          {(['air', 'soul', 'body'] as const).map(band => {
            const val = master[band];
            const label = band === 'body' ? 'BODY' : band === 'soul' ? 'SOUL' : 'AIR';
            const color = band === 'body' ? '#10b981' : band === 'soul' ? '#3b82f6' : '#d946ef';
            return (
              <div key={band} className="seq-mixconsole__eq-band">
                <DivineKnob size="sm" label={label} value={val} min={-12} max={12} unit="dB" color={color} onChange={(v) => onSetMasterParam(band, v)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Limiter Section */}
      <div className="seq-mixconsole__section seq-mixconsole__pan">
        <div className="seq-mixconsole__section-label">LIMITER</div>
        <div className="seq-mixconsole__fx-grid">
          <div className="seq-mixconsole__knob-wrap">
            <DivineKnob size="sm" label="THRESH" value={master.threshold} min={-24} max={0} unit="dB" color="#6366f1" onChange={(v) => onSetMasterParam('threshold', v)} />
          </div>
          <div className="seq-mixconsole__knob-wrap">
            <DivineKnob size="sm" label="CEIL" value={master.ceiling} min={-3} max={0} unit="dB" color="#14b8a6" onChange={(v) => onSetMasterParam('ceiling', v)} />
          </div>
        </div>
      </div>

      {/* Fader & Master Meter Section */}
      <div className="seq-mixconsole__fader-area seq-mixconsole__fader-area--master">
        <div className="seq-mixconsole__master-meter-container">
          <SacredMasterMeter analyzer={analyzer || null} isPlaying={isPlaying} bpm={bpm} />
        </div>
        
        <div className="seq-mixconsole__fader-wrap seq-mixconsole__fader-wrap--master">
          <div className="seq-mixconsole__fader-slot">
            <div className="seq-mixconsole__fader-groove" />
            <div className="seq-mixconsole__fader-ticks">
              <div className="fader-tick fader-tick--0" />
              <div className="fader-tick" />
              <div className="fader-tick fader-tick--12" />
              <div className="fader-tick" />
              <div className="fader-tick fader-tick--24" />
            </div>
            <input
              type="range"
              className="seq-mixconsole__fader-input"
              min={0}
              max={1.5}
              step={0.01}
              value={master.volume}
              onChange={(e) => onSetMasterParam('volume', parseFloat(e.target.value))}
              title={`Master Vol: ${Math.round(master.volume * 100)}%`}
            />
            {/* Red Fader Cap for Master */}
            <div 
              className="seq-mixconsole__fader-cap"
              style={{ bottom: `${(master.volume / 1.5) * 100}%` }}
            >
              <div className="seq-mixconsole__fader-cap-line" style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
              <div className="seq-mixconsole__fader-cap-base" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Label */}
      <div className="seq-mixconsole__bottom-label seq-mixconsole__bottom-label--master">
        <div className="seq-mixconsole__vol-value" style={{ color: '#ef4444' }}>{Math.round(master.volume * 100)}%</div>
        <div className="seq-mixconsole__track-name" style={{ color: '#fff' }}>MASTER</div>
      </div>
    </div>
  );
});

MasterChannel.displayName = 'MasterChannel';
