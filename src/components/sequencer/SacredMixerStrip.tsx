/**
 * SacredMixerStrip — FL Studio-style per-track mixer panel.
 * Horizontal row of vertical channel strips with:
 *  - Volume fader (0–150%)
 *  - Pan knob (-100 to 100)
 *  - FX send mini-knobs (REV / CHR / DLY / SAT)
 *  - Track color bar + label
 *
 * Toggleable via mixer button in the sequencer header.
 */
import React, { useCallback } from 'react';
import type { TrackState, FXSendState } from './useSequencerEngine';
import type { TrackLevels } from './useTrackMetering';

interface SacredMixerStripProps {
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
}

const FX_KNOBS: { id: keyof FXSendState; label: string; color: string }[] = [
  { id: 'reverb',     label: 'REV', color: '#FFD700' },
  { id: 'chorus',     label: 'CHR', color: '#60A5FA' },
  { id: 'delay',      label: 'DLY', color: '#22C55E' },
  { id: 'saturation', label: 'SAT', color: '#EF4444' },
];

/** Convert 0–100 knob value to a rotation angle (-135° to 135°) */
function knobRotation(value: number): number {
  return -135 + (value / 100) * 270;
}

export const SacredMixerStrip: React.FC<SacredMixerStripProps> = ({
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
}) => {
  return (
    <div className="seq-mixer">
      <div className="seq-mixer__label">MIXER</div>
      <div className="seq-mixer__channels">
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
          />
        ))}
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
  onSetEQ?: (band: 'low' | 'mid' | 'high', value: number) => void;
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
  onSetEQ,
}) => {
  const channelClass = [
    'seq-mixer__strip',
    isSelected ? 'seq-mixer__strip--selected' : '',
    track.muted ? 'seq-mixer__strip--muted' : '',
  ].filter(Boolean).join(' ');

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSetVolume(parseFloat(e.target.value));
  }, [onSetVolume]);

  return (
    <div
      className={channelClass}
      style={{ '--strip-color': track.color } as React.CSSProperties}
      onClick={onSelect}
    >
      {/* Track Color Bar */}
      <div className="seq-mixer__color-bar" style={{ background: track.color }} />

      {/* FX Send Knobs */}
      <div className="seq-mixer__fx-knobs">
        {FX_KNOBS.map(knob => (
          <div key={knob.id} className="seq-mixer__knob-wrap">
            <div
              className="seq-mixer__knob"
              style={{
                '--knob-color': knob.color,
                '--knob-rotation': `${knobRotation(track.fxSends[knob.id])}deg`,
              } as React.CSSProperties}
            >
              <input
                type="range"
                className="seq-mixer__knob-input"
                min={0}
                max={100}
                value={track.fxSends[knob.id]}
                onChange={(e) => onSetFxSend(knob.id, parseInt(e.target.value))}
                title={`${knob.label}: ${track.fxSends[knob.id]}%`}
              />
              <svg className="seq-mixer__knob-svg" viewBox="0 0 36 36">
                {/* Background arc */}
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="2.5"
                  strokeDasharray="66 22"
                  strokeLinecap="round"
                  transform="rotate(135 18 18)"
                />
                {/* Value arc */}
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke={knob.color}
                  strokeWidth="2.5"
                  strokeDasharray={`${(track.fxSends[knob.id] / 100) * 66} 88`}
                  strokeLinecap="round"
                  transform="rotate(135 18 18)"
                  style={{ filter: `drop-shadow(0 0 3px ${knob.color}66)` }}
                />
                {/* Pointer */}
                <line
                  x1="18" y1="18" x2="18" y2="7"
                  stroke={knob.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  transform={`rotate(${knobRotation(track.fxSends[knob.id])} 18 18)`}
                  opacity={0.8}
                />
              </svg>
            </div>
            <span className="seq-mixer__knob-label">{knob.label}</span>
          </div>
        ))}
      </div>

      {/* Pan Knob */}
      <div className="seq-mixer__pan-wrap">
        <div
          className="seq-mixer__knob"
          style={{
            '--knob-color': track.color,
            '--knob-rotation': `${knobRotation(((track.pan + 1) / 2) * 100)}deg`,
          } as React.CSSProperties}
        >
          <input
            type="range"
            className="seq-mixer__knob-input"
            min={-100}
            max={100}
            value={Math.round(track.pan * 100)}
            onChange={(e) => onSetPan(parseInt(e.target.value) / 100)}
            title={`Pan: ${track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 100))}` : `R${Math.round(track.pan * 100)}`}`}
          />
          <svg className="seq-mixer__knob-svg" viewBox="0 0 36 36">
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="2.5"
              strokeDasharray="66 22"
              strokeLinecap="round"
              transform="rotate(135 18 18)"
            />
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              stroke={track.color}
              strokeWidth="2.5"
              strokeDasharray={`${((track.pan + 1) / 2) * 66} 88`}
              strokeLinecap="round"
              transform="rotate(135 18 18)"
              style={{ filter: `drop-shadow(0 0 3px ${track.color}66)` }}
            />
            <line
              x1="18" y1="18" x2="18" y2="7"
              stroke={track.color}
              strokeWidth="1.5"
              strokeLinecap="round"
              transform={`rotate(${knobRotation(((track.pan + 1) / 2) * 100)} 18 18)`}
              opacity={0.8}
            />
          </svg>
        </div>
        <span className="seq-mixer__knob-label">PAN</span>
      </div>

      {/* 3-Band EQ Mini Sliders */}
      {onSetEQ && (
        <div className="seq-mixer__eq-wrap">
          {(['low', 'mid', 'high'] as const).map(band => {
            const val = band === 'low' ? track.eqLow : band === 'mid' ? track.eqMid : track.eqHigh;
            const label = band === 'low' ? 'LO' : band === 'mid' ? 'MID' : 'HI';
            return (
              <div key={band} className="seq-mixer__eq-band">
                <input
                  type="range"
                  className="seq-mixer__eq-slider"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={val}
                  onChange={(e) => onSetEQ(band, parseFloat(e.target.value))}
                  title={`${label}: ${val > 0 ? '+' : ''}${val.toFixed(1)} dB`}
                  style={{ '--eq-color': track.color } as React.CSSProperties}
                />
                <span className="seq-mixer__eq-label">{label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Volume Fader */}
      <div className="seq-mixer__fader-wrap">
        <div className="seq-mixer__fader-track">
          <div
            className="seq-mixer__fader-fill"
            style={{
              height: `${(track.volume / 1.5) * 100}%`,
              background: `linear-gradient(to top, ${track.color}44, ${track.color}aa)`,
            }}
          />
        </div>
        {/* VU Meter */}
        <div className="seq-mixer__meter">
          <div
            className="seq-mixer__meter-rms"
            style={{ height: `${level.rms * 100}%` }}
          />
          <div
            className="seq-mixer__meter-peak"
            style={{ bottom: `${level.peak * 100}%` }}
          />
        </div>
        <input
          type="range"
          className="seq-mixer__fader"
          min={0}
          max={1.5}
          step={0.01}
          value={track.volume}
          onChange={handleVolumeChange}
          title={`Volume: ${Math.round(track.volume * 100)}%`}
        />
      </div>

      {/* Volume Value */}
      <div className="seq-mixer__vol-value">
        {Math.round(track.volume * 100)}%
      </div>

      {/* Mute / Solo */}
      <div className="seq-mixer__ms-buttons">
        <button
          className={`seq-mixer__ms-btn ${track.muted ? 'seq-mixer__ms-btn--mute' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
        >
          M
        </button>
        <button
          className={`seq-mixer__ms-btn ${track.soloed ? 'seq-mixer__ms-btn--solo' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleSolo(); }}
        >
          S
        </button>
      </div>

      {/* Track Label */}
      <div className="seq-mixer__track-label">{track.name}</div>
    </div>
  );
});

MixerChannel.displayName = 'MixerChannel';
