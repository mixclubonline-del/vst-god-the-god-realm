/**
 * SacredTrackLane — God Realm Universal Track Lane
 * Supports sample, synth, and bus track types.
 * Sacred Sequence Ascension · Phase 1
 *
 * Visual identity:
 *  - Source type badge (🎵 / ⚡ / 🔊)
 *  - God indicator circle (synth tracks) with divine glow
 *  - FX send mini-knob (all tracks)
 *  - Gear icon → opens TrackSourceSelector
 *  - Note letter display on synth track steps
 */
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { SacredStep } from './SacredStep';
import { MiniWaveform } from './MiniWaveform';
import { TrackSourceSelector } from './TrackSourceSelector';
import { SacredFXPopover } from './SacredFXPopover';
import { SacredAutomationLane, AddAutomationLaneSelector } from './SacredAutomationLane';
import type { TrackState, StepState, TrackSourceType, FXSendState, AutomationParam, AutomationPoint, AutomationLane } from './useSequencerEngine';
import { electricPantheonGods } from '../../data/electricPantheonGods';
import { THRONE_DOMAINS } from '../../data/throneDomains';
import type { ElectricPantheonGodId } from '../../data/electricPantheonGods';
import './SacredTrackBounce.css';

interface SacredTrackLaneProps {
  track: TrackState;
  trackIndex: number;
  currentStep: number;
  isSelected: boolean;
  activePattern: 'A' | 'B';
  isFillMode: boolean;
  stepCount: number;
  swing: number;
  onSelectTrack: () => void;
  onToggleStep: (stepIndex: number) => void;
  onSetVelocity: (stepIndex: number, velocity: number) => void;
  onRandomize?: () => void;
  onClear?: () => void;
  onOpenStepDetail?: (stepIndex: number, position: { x: number; y: number }) => void;
  onOpenChopper?: () => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  // Sacred Sequence Ascension props
  onSetSource?: (trackIndex: number, sourceType: TrackSourceType, godId?: ElectricPantheonGodId) => void;
  onRename?: (trackIndex: number, name: string) => void;
  onSetColor?: (trackIndex: number, color: string) => void;
  onDeleteTrack?: (trackId: string) => void;
  // FX Send control
  onSetFxSend?: (trackIndex: number, fx: keyof FXSendState, value: number) => void;
  // Automation lane controls
  isPlaying?: boolean;
  isRecording?: boolean;
  onAddAutomationLane?: (trackIndex: number, param: AutomationParam) => void;
  onRemoveAutomationLane?: (trackIndex: number, param: AutomationParam) => void;
  onSetAutomationPoint?: (trackIndex: number, param: AutomationParam, point: AutomationPoint) => void;
  onRemoveAutomationPoint?: (trackIndex: number, param: AutomationParam, pointIndex: number) => void;
  onSetAutomationPoints?: (trackIndex: number, param: AutomationParam, points: AutomationPoint[]) => void;
  onToggleAutomationEnabled?: (trackIndex: number, param: AutomationParam) => void;
  onSetAutomationCurveType?: (trackIndex: number, param: AutomationParam, curveType: AutomationLane['curveType']) => void;
  // FL Quality: Track reorder
  onMoveTrackUp?: () => void;
  onMoveTrackDown?: () => void;
  // FL Quality: Humanize / Quantize
  onHumanize?: () => void;
  onQuantize?: () => void;
  // FL Quality: Sample drop
  onSampleDrop?: (file: File) => void;
  // FL Quality: Per-track pan
  trackPan?: number;
  onSetTrackPan?: (pan: number) => void;
  // FL Quality: Per-track swing
  trackSwing?: number;
  onSetTrackSwing?: (swing: number) => void;
  /* Phase C: Multi-step selection */
  selectedSteps?: number[];
  onSelectStep?: (stepIndex: number, additive: boolean, range: boolean) => void;
  /* Phase D: Waveform + Ghost Notes */
  buffer?: AudioBuffer | null;
  ghostSteps?: { color: string; pattern: { enabled: boolean }[] }[];
  /* Track Bounce/Freeze */
  onFreezeTrack?: () => void;
  onUnfreezeTrack?: () => void;
  onToggleRecordArm?: () => void;
  isBouncing?: boolean;
  bounceProgress?: number;
  recordingState?: { isRecording: boolean; duration: number; peakLevel: number } | null;
  /* Phase 5: Polyrhythm Support */
  onSetPolymetricLength?: (len: number) => void;
  /* Phase 5: Pattern clipboard */
  onCopyTrackPattern?: (trackIndex: number) => void;
  onPasteTrackPattern?: (trackIndex: number) => void;
  onSwapPatterns?: (trackIndex: number) => void;
  canPastePattern?: boolean;
}

/** Convert MIDI note number to note name */
function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}

const SOURCE_ICONS: Record<TrackSourceType, string> = {
  sample: '🎵',
  synth: '⚡',
  bus: '🔊',
};

export const SacredTrackLane: React.FC<SacredTrackLaneProps> = React.memo(({
  track,
  trackIndex,
  currentStep,
  isSelected,
  activePattern,
  isFillMode,
  stepCount,
  swing,
  onSelectTrack,
  onToggleStep,
  onSetVelocity,
  onRandomize,
  onClear,
  onOpenStepDetail,
  onOpenChopper,
  onToggleMute,
  onToggleSolo,
  onSetSource,
  onRename,
  onSetColor,
  onDeleteTrack,
  onSetFxSend,
  // Automation
  isPlaying,
  isRecording,
  onAddAutomationLane,
  onRemoveAutomationLane,
  onSetAutomationPoint,
  onRemoveAutomationPoint,
  onSetAutomationPoints,
  onToggleAutomationEnabled,
  onSetAutomationCurveType,
  // FL Quality
  onMoveTrackUp,
  onMoveTrackDown,
  onHumanize,
  onQuantize,
  onSampleDrop,
  trackPan,
  onSetTrackPan,
  trackSwing,
  onSetTrackSwing,
  selectedSteps = [],
  onSelectStep,
  buffer = null,
  ghostSteps = [],
  onFreezeTrack,
  onUnfreezeTrack,
  onToggleRecordArm,
  isBouncing = false,
  bounceProgress = 0,
  recordingState = null,
  onSetPolymetricLength,
  onCopyTrackPattern,
  onPasteTrackPattern,
  onSwapPatterns,
  canPastePattern = false,
}) => {
  const pattern = activePattern === 'A' ? track.patternA : track.patternB;
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorPos, setSelectorPos] = useState({ x: 0, y: 0 });
  const [fxPopoverOpen, setFxPopoverOpen] = useState(false);
  const [fxPopoverPos, setFxPopoverPos] = useState({ x: 0, y: 0 });
  const [autoExpanded, setAutoExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showGhostNotes, setShowGhostNotes] = useState(false);

  // Find god data for synth tracks
  const godData = track.sourceType === 'synth' && track.synthConfig
    ? electricPantheonGods.find(g => g.id === track.synthConfig!.godId)
    : null;

  // Throne domain bridge — link sample tracks to Astral Dais thrones
  const throneDomain = track.sourceType === 'sample' && trackIndex < 16
    ? THRONE_DOMAINS[trackIndex]
    : null;
  const bridgedColor = throneDomain?.color || track.color;

  const laneClass = [
    'seq-lane',
    isSelected ? 'seq-lane--selected' : '',
    track.muted ? 'seq-lane--muted' : '',
    track.isFrozen ? 'seq-lane--frozen' : '',
    `seq-lane--${track.sourceType}`,
    track.isRecordArmed ? 'seq-lane--armed' : '',
    isRecording ? 'seq-lane--recording' : '',
  ].filter(Boolean).join(' ');

  // ─── Polyrhythm Drag Handle Logic ───
  const polyHandleRef = useRef<HTMLDivElement>(null);
  const isDraggingPoly = useRef(false);

  const handlePolyPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingPoly.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePolyPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingPoly.current || !polyHandleRef.current || !onSetPolymetricLength) return;
    const parent = polyHandleRef.current.parentElement;
    if (!parent) return;
    
    const rect = parent.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const stepWidth = rect.width / stepCount;
    let newLen = Math.round(x / stepWidth);
    newLen = Math.max(1, Math.min(stepCount, newLen));
    
    if (newLen !== track.polymetricLength) {
      onSetPolymetricLength(newLen);
    }
  }, [stepCount, track.polymetricLength, onSetPolymetricLength]);

  const handlePolyPointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingPoly.current) {
      isDraggingPoly.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  }, []);

  // ─── Drag to Paint Steps ───
  const paintModeRef = useRef<boolean | null>(null);

  useEffect(() => {
    const handleGlobalUp = () => { paintModeRef.current = null; };
    window.addEventListener('pointerup', handleGlobalUp);
    return () => window.removeEventListener('pointerup', handleGlobalUp);
  }, []);

  const handleStepPointerDown = useCallback((index: number, currentState: boolean) => {
    paintModeRef.current = !currentState;
    onToggleStep(index);
  }, [onToggleStep]);

  const handleStepPointerEnter = useCallback((index: number, currentState: boolean) => {
    if (paintModeRef.current !== null && currentState !== paintModeRef.current) {
      onToggleStep(index);
    }
  }, [onToggleStep]);

  /* ─── Drag & Drop for sample loading ─── */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const hasAudio = e.dataTransfer.types.includes('Files');
    if (hasAudio) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!onSampleDrop) return;
    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(f =>
      f.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|aif|aiff)$/i.test(f.name)
    );
    if (audioFile) {
      onSampleDrop(audioFile);
    }
  }, [onSampleDrop]);

  /* ─── File Picker for loading samples via button click ─── */
  const handleFilePick = useCallback(() => {
    if (!onSampleDrop) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.wav,.mp3,.ogg,.flac,.aif,.aiff';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) onSampleDrop(file);
    };
    input.click();
  }, [onSampleDrop]);

  const handleGearClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectorPos({ x: e.clientX, y: e.clientY });
    setSelectorOpen(true);
  }, []);

  // Calculate total FX send level for the mini indicator
  const totalFx = track.fxSends
    ? (track.fxSends.reverb + track.fxSends.chorus + track.fxSends.delay + track.fxSends.saturation) / 4
    : 0;

  return (
    <div
      className={`${laneClass} ${isDragOver ? 'seq-lane--drag-over' : ''}`}
      style={{
        '--lane-color': bridgedColor,
        '--swing-offset': `${swing * 0.15}px`,
        '--god-color': godData?.colors.primary || bridgedColor,
      } as React.CSSProperties}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop Zone Overlay */}
      {isDragOver && (
        <div className="seq-lane__drop-overlay">
          <span className="seq-lane__drop-text">📂 Drop audio file here</span>
        </div>
      )}
      {/* Track Header */}
      <div className="seq-lane__header" onClick={onSelectTrack}>
        {/* Color bar with source-aware styling */}
        <div className="seq-lane__color-bar" />

        {/* Source Type Badge */}
        <span className="seq-lane__source-badge" title={track.sourceType.toUpperCase()}>
          {SOURCE_ICONS[track.sourceType]}
        </span>

        {/* God Indicator (synth tracks only) */}
        {track.sourceType === 'synth' && godData && (
          <span
            className="seq-lane__god-indicator"
            style={{ '--god-primary': godData.colors.primary } as React.CSSProperties}
            title={`${godData.name} — ${godData.title}`}
          >
            {godData.icon}
          </span>
        )}

        {/* Throne Domain Badge (sample tracks linked to Astral Dais) */}
        {throneDomain && (
          <span
            className="seq-lane__throne-badge"
            style={{ '--throne-badge-color': throneDomain.color } as React.CSSProperties}
            title={`Throne ${trackIndex + 1}: ${throneDomain.name} — ${throneDomain.sonicRole}`}
          >
            <img
              src={throneDomain.sigilImage}
              alt={throneDomain.name}
              className="seq-lane__throne-sigil"
              draggable={false}
            />
            <span className="seq-lane__throne-number">
              {String(trackIndex + 1).padStart(2, '0')}
            </span>
          </span>
        )}

        {/* Track Name + Octave */}
        <div className="seq-lane__name-group">
          <span className="seq-lane__name">{track.name}</span>
          {track.sourceType === 'synth' && track.synthConfig && (
            <span className="seq-lane__octave">
              {midiToNoteName(60 + track.synthConfig.octave * 12)}
            </span>
          )}
          {track.sourceType === 'synth' && godData && (
            <span className="seq-lane__god-name" style={{ color: godData.colors.primary }}>
              {godData.name}
            </span>
          )}
        </div>

        {/* Mini Waveform for sample tracks */}
        {track.sourceType === 'sample' && (
          <MiniWaveform
            buffer={buffer}
            color={bridgedColor}
            width={80}
            height={22}
            sampleStart={track.sampleParams.start}
            sampleEnd={track.sampleParams.end}
          />
        )}

        {/* Ghost Notes Toggle */}
        {ghostSteps.length > 0 && (
          <button
            className={`seq-lane__ghost-btn ${showGhostNotes ? 'seq-lane__ghost-btn--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowGhostNotes(prev => !prev); }}
            title="Toggle ghost notes"
          >
            👻
          </button>
        )}

        {/* Controls */}
        <div className="seq-lane__controls">
          <button
            className={`seq-lane__btn ${track.muted ? 'seq-lane__btn--active-mute' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
            title="Mute"
          >
            M
          </button>
          <button
            className={`seq-lane__btn ${track.soloed ? 'seq-lane__btn--active-solo' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleSolo(); }}
            title="Solo"
          >
            S
          </button>

          {/* FX Send Indicator — clickable to open FX Popover */}
          <div
            className="seq-lane__fx-indicator seq-lane__fx-indicator--clickable"
            title={`FX: R${track.fxSends?.reverb || 0} C${track.fxSends?.chorus || 0} D${track.fxSends?.delay || 0} S${track.fxSends?.saturation || 0}`}
            style={{ '--fx-level': `${totalFx}%` } as React.CSSProperties}
            onClick={(e) => {
              e.stopPropagation();
              setFxPopoverPos({ x: e.clientX, y: e.clientY });
              setFxPopoverOpen(prev => !prev);
            }}
          >
            <span className="seq-lane__fx-label">FX</span>
            <svg className="seq-lane__fx-arc" viewBox="0 0 24 24">
              <circle
                cx="12" cy="12" r="9"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="2"
              />
              <circle
                cx="12" cy="12" r="9"
                fill="none"
                stroke={godData?.colors.primary || bridgedColor}
                strokeWidth="2"
                strokeDasharray={`${totalFx * 0.565} 56.5`}
                strokeLinecap="round"
                transform="rotate(-90 12 12)"
                style={{ filter: `drop-shadow(0 0 3px ${godData?.colors.primary || bridgedColor}66)` }}
              />
            </svg>
          </div>

          {onRandomize && (
            <button
              className="seq-lane__action-btn"
              onClick={(e) => { e.stopPropagation(); onRandomize(); }}
              title="Randomize"
            >
              🎲
            </button>
          )}
          {onClear && (
            <button
              className="seq-lane__action-btn"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              title="Clear Track"
            >
              ✕
            </button>
          )}
          {onHumanize && (
            <button
              className="seq-lane__action-btn"
              onClick={(e) => { e.stopPropagation(); onHumanize(); }}
              title="Humanize (add feel)"
            >
              🌊
            </button>
          )}
          {onQuantize && (
            <button
              className="seq-lane__action-btn"
              onClick={(e) => { e.stopPropagation(); onQuantize(); }}
              title="Quantize (snap to grid)"
            >
              🎯
            </button>
          )}
          {track.sourceType === 'sample' && onOpenChopper && (
            <button
              className="seq-lane__btn seq-lane__btn--chop"
              onClick={(e) => { e.stopPropagation(); onOpenChopper(); }}
              title="Open Sample Chopper"
            >
              ✂️
            </button>
          )}

          {onSampleDrop && (
            <button
              className="seq-lane__action-btn seq-lane__action-btn--load"
              onClick={(e) => { e.stopPropagation(); handleFilePick(); }}
              title="Load Audio Sample"
            >
              📂
            </button>
          )}

          {/* Freeze/Bounce Button */}
          {(onFreezeTrack || onUnfreezeTrack) && (
            <button
              className={`seq-freeze-btn ${track.isFrozen ? 'seq-freeze-btn--frozen' : ''} ${isBouncing ? 'seq-freeze-btn--bouncing' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (track.isFrozen) onUnfreezeTrack?.();
                else onFreezeTrack?.();
              }}
              title={track.isFrozen ? 'Unfreeze Track (restore live processing)' : 'Freeze Track (render to audio)'}
            >
              {track.isFrozen ? '🔥' : '❄️'}
            </button>
          )}

          {/* Record-Arm Button */}
          {onToggleRecordArm && (
            <button
              className={`seq-record-arm-btn ${track.isRecordArmed ? (recordingState?.isRecording ? 'seq-record-arm-btn--recording' : 'seq-record-arm-btn--armed') : ''}`}
              onClick={(e) => { e.stopPropagation(); onToggleRecordArm(); }}
              title={track.isRecordArmed ? 'Disarm recording' : 'Arm for audio recording'}
            >
              🔴
            </button>
          )}

          {/* Gear Icon — Opens TrackSourceSelector */}
          <button
            className="seq-lane__btn seq-lane__btn--gear"
            onClick={handleGearClick}
            title="Track Settings"
          >
            ⚙
          </button>

          {/* Automation Toggle */}
          {onAddAutomationLane && (
            <button
              className={`seq-lane__btn seq-lane__btn--auto ${autoExpanded ? 'seq-lane__btn--auto-active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setAutoExpanded(!autoExpanded); }}
              title="Toggle Automation Lanes"
            >
              📈
            </button>
          )}

          {/* Track Reorder Arrows */}
          {(onMoveTrackUp || onMoveTrackDown) && (
            <div className="seq-lane__reorder">
              <button
                className={`seq-lane__reorder-btn ${!onMoveTrackUp ? 'seq-lane__reorder-btn--disabled' : ''}`}
                onClick={(e) => { e.stopPropagation(); onMoveTrackUp?.(); }}
                disabled={!onMoveTrackUp}
                title="Move track up"
              >
                ▲
              </button>
              <button
                className={`seq-lane__reorder-btn ${!onMoveTrackDown ? 'seq-lane__reorder-btn--disabled' : ''}`}
                onClick={(e) => { e.stopPropagation(); onMoveTrackDown?.(); }}
                disabled={!onMoveTrackDown}
                title="Move track down"
              >
                ▼
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Step Grid */}
      <div className="seq-lane__grid" style={{ gridTemplateColumns: `repeat(${stepCount}, 1fr)` }}>
        {pattern.slice(0, stepCount).map((step, i) => (
          <SacredStep
            key={i}
            step={step}
            stepIndex={i}
            trackIndex={trackIndex}
            trackColor={track.color}
            isPlaying={currentStep === (i % track.polymetricLength)}
            isDownbeat={i % 4 === 0}
            isFillOnly={step.trigCondition === 'fill'}
            onToggle={() => onToggleStep(i)}
            onVelocityChange={(vel) => onSetVelocity(i, vel)}
            onOpenDetail={onOpenStepDetail ? (pos) => onOpenStepDetail(i, pos) : undefined}
            isSelected={selectedSteps.includes(i)}
            onSelect={onSelectStep}
            onPointerDownAction={handleStepPointerDown}
            onPointerEnterAction={handleStepPointerEnter}
          />
        ))}

        {/* Polyrhythm Handle */}
        {track.polymetricLength <= stepCount && (
          <div
            ref={polyHandleRef}
            className="seq-lane__poly-handle"
            style={{
              left: `calc((100% / ${stepCount}) * ${track.polymetricLength})`,
            }}
            onPointerDown={handlePolyPointerDown}
            onPointerMove={handlePolyPointerMove}
            onPointerUp={handlePolyPointerUp}
            title={`Track Loop Length: ${track.polymetricLength} steps`}
          >
            <div className="seq-lane__poly-handle-line" style={{ backgroundColor: track.color }} />
          </div>
        )}
      </div>

      {/* Ghost Notes Overlay — show other tracks' patterns dimly */}
      {showGhostNotes && ghostSteps.length > 0 && (
        <div className="seq-lane__ghost-overlay" style={{ gridTemplateColumns: `repeat(${stepCount}, 1fr)` }}>
          {Array.from({ length: stepCount }, (_, i) => {
            const activeGhosts = ghostSteps.filter(g => g.pattern[i]?.enabled);
            return (
              <div key={i} className="seq-lane__ghost-cell">
                {activeGhosts.map((g, gi) => (
                  <div
                    key={gi}
                    className="seq-lane__ghost-dot"
                    style={{ backgroundColor: g.color + '40' }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
      {track.sourceType === 'synth' && track.synthConfig && (
        <div
          className="seq-lane__note-overlay"
          style={{ gridTemplateColumns: `repeat(${stepCount}, 1fr)` }}
        >
          {pattern.slice(0, stepCount).map((step, i) => (
            <span
              key={i}
              className={`seq-lane__note-label ${step.enabled ? 'seq-lane__note-label--active' : ''}`}
            >
              {step.enabled ? midiToNoteName(track.synthConfig!.noteMap[i] || 60) : ''}
            </span>
          ))}
        </div>
      )}

      {/* TrackSourceSelector Popover */}
      {selectorOpen && (
        <TrackSourceSelector
          track={track}
          trackIndex={trackIndex}
          anchorPosition={selectorPos}
          onSetSource={(type, godId) => {
            onSetSource?.(trackIndex, type, godId);
          }}
          onRename={(name) => onRename?.(trackIndex, name)}
          onSetColor={(color) => onSetColor?.(trackIndex, color)}
          onDelete={() => {
            onDeleteTrack?.(track.id);
            setSelectorOpen(false);
          }}
          onClose={() => setSelectorOpen(false)}
          onCopy={() => {
            onSelectTrack();
            onCopyTrackPattern?.(trackIndex);
          }}
          onPaste={() => {
            onSelectTrack();
            onPasteTrackPattern?.(trackIndex);
          }}
          onSwap={() => {
            onSelectTrack();
            onSwapPatterns?.(trackIndex);
          }}
          canPaste={canPastePattern}
        />
      )}

      {/* FX Send Popover */}
      {fxPopoverOpen && onSetFxSend && (
        <SacredFXPopover
          trackIndex={trackIndex}
          trackName={track.name}
          trackColor={track.color}
          sends={track.fxSends}
          anchorPosition={fxPopoverPos}
          onSetSend={onSetFxSend}
          onClose={() => setFxPopoverOpen(false)}
        />
      )}

      {/* ═══ Automation Lanes Drawer ═══ */}
      {autoExpanded && onAddAutomationLane && (
        <div className="seq-lane__auto-drawer">
          {(track.automationLanes || []).map(lane => (
            <SacredAutomationLane
              key={lane.param}
              lane={lane}
              trackIndex={trackIndex}
              trackColor={track.color}
              stepCount={stepCount}
              currentStep={currentStep}
              isPlaying={isPlaying ?? false}
              isRecording={isRecording ?? false}
              onSetPoint={(param, point) => onSetAutomationPoint?.(trackIndex, param, point)}
              onRemovePoint={(param, idx) => onRemoveAutomationPoint?.(trackIndex, param, idx)}
              onSetPoints={(param, pts) => onSetAutomationPoints?.(trackIndex, param, pts)}
              onToggleEnabled={(param) => onToggleAutomationEnabled?.(trackIndex, param)}
              onSetCurveType={(param, ct) => onSetAutomationCurveType?.(trackIndex, param, ct)}
              onRemoveLane={(param) => onRemoveAutomationLane?.(trackIndex, param)}
            />
          ))}
          <AddAutomationLaneSelector
            existingParams={(track.automationLanes || []).map(l => l.param)}
            trackSourceType={track.sourceType}
            onAddLane={(param) => onAddAutomationLane(trackIndex, param)}
          />
        </div>
      )}

      {/* Frozen Track Overlay */}
      {track.isFrozen && (
        <div className="seq-lane__frozen-overlay">
          <span className="seq-lane__frozen-badge">FROZEN</span>
        </div>
      )}

      {/* Recording Indicator */}
      {recordingState?.isRecording && (
        <div className="seq-lane__recording-indicator">
          <div className="seq-lane__recording-dot" />
          <span className="seq-lane__recording-time">{recordingState.duration.toFixed(1)}s</span>
          <div className="seq-lane__recording-level">
            <div
              className="seq-lane__recording-level-fill"
              style={{ width: `${Math.min(100, recordingState.peakLevel * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Bounce Progress Bar */}
      {isBouncing && (
        <div className="seq-bounce-progress">
          <div className="seq-bounce-progress__fill" style={{ width: `${bounceProgress}%` }} />
        </div>
      )}
    </div>
  );
});

SacredTrackLane.displayName = 'SacredTrackLane';
