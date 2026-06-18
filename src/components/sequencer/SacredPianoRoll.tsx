/**
 * SacredPianoRoll — FL Studio-Class Piano Roll Editor
 *
 * Grid-based melodic note editor for synth tracks.
 * Supports click-to-create, drag-to-move, resize-duration,
 * right-click delete, and multi-note chords.
 */
import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import type { PianoRollNote } from './useSequencerEngine';
import { generatePianoNoteId } from './useSequencerEngine';
import type { ScaleConfig } from '../../audio/MusicTheoryEngine';
import { isNoteInScale, snapToScale } from '../../audio/MusicTheoryEngine';
import './SacredPianoRoll.css';

/** Ghost notes from other tracks */
export interface GhostTrackNotes {
  trackIndex: number;
  trackName: string;
  trackColor: string;
  notes: PianoRollNote[];
}

interface SacredPianoRollProps {
  notes: PianoRollNote[];
  stepCount: number;
  currentStep: number;
  isPlaying: boolean;
  trackColor: string;
  trackIndex: number;
  octave: number;
  /** MIDI notes currently held down (for live input visualization) */
  liveNotes?: number[];
  /** Scale config for highlighting and snapping */
  scaleConfig?: ScaleConfig;
  /** Ghost notes from other tracks */
  ghostNotes?: GhostTrackNotes[];
  onAddNote: (note: PianoRollNote) => void;
  onRemoveNote: (noteId: string) => void;
  onUpdateNote: (noteId: string, changes: Partial<Omit<PianoRollNote, 'id'>>) => void;
}

// Piano keyboard config
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIN_NOTE = 36;  // C2
const MAX_NOTE = 84;  // C6
const NOTE_RANGE = MAX_NOTE - MIN_NOTE; // 48 notes (4 octaves)
const ROW_HEIGHT = 14;
const DEFAULT_NOTE_DURATION = 1;
const MIN_NOTE_DURATION = 0.25;
const SNAP_RESOLUTION = 0.25; // 1/16th note (quarter of a step)
const RESIZE_HANDLE_WIDTH = 8;

function isBlackKey(note: number): boolean {
  const n = note % 12;
  return [1, 3, 6, 8, 10].includes(n);
}

function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

function snapToGrid(value: number, resolution: number): number {
  return Math.round(value / resolution) * resolution;
}

type DragMode = 'none' | 'move' | 'resize' | 'create';

export const SacredPianoRoll: React.FC<SacredPianoRollProps> = ({
  notes,
  stepCount,
  currentStep,
  isPlaying,
  trackColor,
  trackIndex,
  octave,
  liveNotes = [],
  scaleConfig,
  ghostNotes = [],
  onAddNote,
  onRemoveNote,
  onUpdateNote,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ note: number; step: number } | null>(null);
  const [showGhostNotes, setShowGhostNotes] = useState(true);

  /* FL Quality: Event Editor */
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [activeEventParam, setActiveEventParam] = useState<'velocity' | 'pan' | 'pitchBend' | 'probability' | 'microTiming'>('velocity');

  // Zoom
  const [stepWidth, setStepWidth] = useState(40);
  const GRID_WIDTH = stepCount * stepWidth;
  const GRID_HEIGHT = NOTE_RANGE * ROW_HEIGHT;

  // Drag state
  const dragState = useRef<{
    mode: DragMode;
    noteId: string | null;
    startNote: number;
    startStep: number;
    startDuration: number;
    originX: number;
    originY: number;
    hasMoved: boolean;
  }>({
    mode: 'none', noteId: null, startNote: 0, startStep: 0,
    startDuration: 1, originX: 0, originY: 0, hasMoved: false,
  });

  // Scroll to middle octave on mount + sync keyboard scroll
  useEffect(() => {
    const grid = gridRef.current;
    const keyboard = keyboardRef.current;
    if (grid) {
      const midNote = 60 - MIN_NOTE; // C4
      grid.scrollTop = (NOTE_RANGE - midNote - 6) * ROW_HEIGHT;
    }
    // Sync keyboard rail with grid vertical scroll
    const handleScroll = () => {
      if (grid && keyboard) {
        keyboard.scrollTop = grid.scrollTop;
      }
    };
    grid?.addEventListener('scroll', handleScroll);
    return () => grid?.removeEventListener('scroll', handleScroll);
  }, []);

  // Convert pixel position to grid coordinates
  const pixelToGrid = useCallback((clientX: number, clientY: number): { step: number; note: number } => {
    if (!gridRef.current) return { step: 0, note: 60 };
    const rect = gridRef.current.getBoundingClientRect();
    const scrollLeft = gridRef.current.scrollLeft;
    const scrollTop = gridRef.current.scrollTop;
    const x = clientX - rect.left + scrollLeft;
    const y = clientY - rect.top + scrollTop;
    const step = snapToGrid(x / stepWidth, SNAP_RESOLUTION);
    const noteFromTop = Math.floor(y / ROW_HEIGHT);
    const note = MAX_NOTE - 1 - noteFromTop;
    return {
      step: Math.max(0, Math.min(stepCount - SNAP_RESOLUTION, step)),
      note: Math.max(MIN_NOTE, Math.min(MAX_NOTE - 1, note)),
    };
  }, [stepWidth, stepCount]);

  // Find note at position
  const findNoteAt = useCallback((step: number, note: number): PianoRollNote | null => {
    return notes.find(n =>
      n.note === note && step >= n.startStep && step < n.startStep + n.duration
    ) ?? null;
  }, [notes]);

  // Check if position is on the resize handle (right edge)
  const isOnResizeHandle = useCallback((clientX: number, noteObj: PianoRollNote): boolean => {
    if (!gridRef.current) return false;
    const rect = gridRef.current.getBoundingClientRect();
    const scrollLeft = gridRef.current.scrollLeft;
    const x = clientX - rect.left + scrollLeft;
    const noteRight = (noteObj.startStep + noteObj.duration) * stepWidth;
    return Math.abs(x - noteRight) < RESIZE_HANDLE_WIDTH;
  }, [stepWidth]);

  // ─── Pointer Handlers ───

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.button === 2) return; // right-click handled by context menu

    const { step, note } = pixelToGrid(e.clientX, e.clientY);
    const hitNote = findNoteAt(step, note);

    if (hitNote) {
      // Hit an existing note
      setSelectedNoteId(hitNote.id);

      if (isOnResizeHandle(e.clientX, hitNote)) {
        // Resize mode
        dragState.current = {
          mode: 'resize',
          noteId: hitNote.id,
          startNote: hitNote.note,
          startStep: hitNote.startStep,
          startDuration: hitNote.duration,
          originX: e.clientX,
          originY: e.clientY,
          hasMoved: false,
        };
      } else {
        // Move mode
        dragState.current = {
          mode: 'move',
          noteId: hitNote.id,
          startNote: hitNote.note,
          startStep: hitNote.startStep,
          startDuration: hitNote.duration,
          originX: e.clientX,
          originY: e.clientY,
          hasMoved: false,
        };
      }
    } else {
      // Empty space — create a new note
      // Scale lock: snap to nearest scale note if enabled
      const finalNote = scaleConfig?.enabled
        ? snapToScale(note, scaleConfig.root, scaleConfig.type)
        : note;
      const newNote: PianoRollNote = {
        id: generatePianoNoteId(),
        note: finalNote,
        startStep: snapToGrid(step, SNAP_RESOLUTION),
        duration: DEFAULT_NOTE_DURATION,
        velocity: 100,
      };
      onAddNote(newNote);
      setSelectedNoteId(newNote.id);

      // Enter resize mode immediately for the new note
      dragState.current = {
        mode: 'create',
        noteId: newNote.id,
        startNote: note,
        startStep: newNote.startStep,
        startDuration: DEFAULT_NOTE_DURATION,
        originX: e.clientX,
        originY: e.clientY,
        hasMoved: false,
      };
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pixelToGrid, findNoteAt, isOnResizeHandle, onAddNote]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();

    // Update hover info
    const { step, note } = pixelToGrid(e.clientX, e.clientY);
    setHoverInfo({ note, step: snapToGrid(step, SNAP_RESOLUTION) });

    // Update cursor based on what we're hovering
    if (dragState.current.mode === 'none' && gridRef.current) {
      const hitNote = findNoteAt(step, note);
      if (hitNote && isOnResizeHandle(e.clientX, hitNote)) {
        gridRef.current.style.cursor = 'ew-resize';
      } else if (hitNote) {
        gridRef.current.style.cursor = 'grab';
      } else {
        gridRef.current.style.cursor = 'crosshair';
      }
    }

    const ds = dragState.current;
    if (ds.mode === 'none' || !ds.noteId) return;

    ds.hasMoved = true;

    if (ds.mode === 'move') {
      const dx = (e.clientX - ds.originX) / stepWidth;
      const dy = -(e.clientY - ds.originY) / ROW_HEIGHT;
      const newStep = snapToGrid(Math.max(0, ds.startStep + dx), SNAP_RESOLUTION);
      const newNote = Math.max(MIN_NOTE, Math.min(MAX_NOTE - 1, Math.round(ds.startNote + dy)));
      onUpdateNote(ds.noteId, { startStep: newStep, note: newNote });
    } else if (ds.mode === 'resize' || ds.mode === 'create') {
      const dx = (e.clientX - ds.originX) / stepWidth;
      const newDuration = Math.max(MIN_NOTE_DURATION, snapToGrid(ds.startDuration + dx, SNAP_RESOLUTION));
      onUpdateNote(ds.noteId, { duration: newDuration });
    }
  }, [pixelToGrid, findNoteAt, isOnResizeHandle, onUpdateNote, stepWidth]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragState.current = {
      mode: 'none', noteId: null, startNote: 0, startStep: 0,
      startDuration: 1, originX: 0, originY: 0, hasMoved: false,
    };
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { step, note } = pixelToGrid(e.clientX, e.clientY);
    const hitNote = findNoteAt(step, note);
    if (hitNote) {
      onRemoveNote(hitNote.id);
      if (selectedNoteId === hitNote.id) setSelectedNoteId(null);
    }
  }, [pixelToGrid, findNoteAt, onRemoveNote, selectedNoteId]);

  /* FL Quality: Advanced Tools */
  const handleStrum = useCallback(() => {
    // Group notes by startStep to identify chords
    const stepGroups: Record<number, PianoRollNote[]> = {};
    notes.forEach(n => {
      if (!stepGroups[n.startStep]) stepGroups[n.startStep] = [];
      stepGroups[n.startStep].push(n);
    });

    Object.values(stepGroups).forEach(group => {
      if (group.length > 1) {
        // Sort from lowest note to highest
        group.sort((a, b) => a.note - b.note);
        group.forEach((n, i) => {
          if (i > 0) {
            // Apply micro-timing stagger (strum effect)
            const staggerAmount = i * 15; // 15% micro-timing shift per note
            onUpdateNote(n.id, { microTiming: staggerAmount });
          }
        });
      }
    });
  }, [notes, onUpdateNote]);

  const handleChop = useCallback(() => {
    if (!selectedNoteId) return;
    const targetNote = notes.find(n => n.id === selectedNoteId);
    if (!targetNote) return;

    // Chop note into 1/16ths (duration 0.25)
    const chopDuration = 0.25;
    const numChops = Math.floor(targetNote.duration / chopDuration);
    
    if (numChops > 1) {
      // Remove original note
      onRemoveNote(targetNote.id);
      setSelectedNoteId(null);
      // Create chopped notes
      for (let i = 0; i < numChops; i++) {
        const newNote: PianoRollNote = {
          ...targetNote,
          id: generatePianoNoteId(),
          startStep: targetNote.startStep + (i * chopDuration),
          duration: chopDuration,
        };
        onAddNote(newNote);
      }
    }
  }, [selectedNoteId, notes, onRemoveNote, onAddNote]);

  // Zoom controls
  const handleZoomIn = useCallback(() => setStepWidth(w => Math.min(100, w + 10)), []);
  const handleZoomOut = useCallback(() => setStepWidth(w => Math.max(15, w - 10)), []);

  // Keyboard labels for left rail
  const keyboardLabels = useMemo(() => {
    const labels: { note: number; name: string; isBlack: boolean; isC: boolean }[] = [];
    for (let n = MAX_NOTE - 1; n >= MIN_NOTE; n--) {
      labels.push({
        note: n,
        name: midiToName(n),
        isBlack: isBlackKey(n),
        isC: n % 12 === 0,
      });
    }
    return labels;
  }, []);

  // Playhead position
  const playheadX = useMemo(() => {
    if (currentStep < 0 || !isPlaying) return null;
    return currentStep * stepWidth;
  }, [currentStep, isPlaying, stepWidth]);

  return (
    <div className="piano-roll" ref={containerRef}>
      {/* Toolbar */}
      <div className="piano-roll__toolbar">
        <span className="piano-roll__title">🎹 PIANO ROLL</span>
        <div className="piano-roll__toolbar-info">
          {hoverInfo && (
            <span className="piano-roll__hover-info">
              {midiToName(hoverInfo.note)} • Step {hoverInfo.step.toFixed(2)}
            </span>
          )}
        </div>
        {/* Toolbar */}
        <div className="piano-roll__toolbar">
          <div className="piano-roll__tools-left">
            <button className="piano-roll__tool-btn" onClick={handleZoomIn} title="Zoom In (Z)">🔍+</button>
            <button className="piano-roll__tool-btn" onClick={handleZoomOut} title="Zoom Out (X)">🔍-</button>
            <button className="piano-roll__tool-btn" onClick={() => setShowGhostNotes(s => !s)} title="Toggle Ghost Notes">👻</button>
          </div>
          <div className="piano-roll__tools-right">
            <button className="piano-roll__tool-btn" onClick={handleStrum} title="Strum Chords (Alt+S)">🎸 Strum</button>
            <button className="piano-roll__tool-btn" onClick={handleChop} disabled={!selectedNoteId} title="Chop Selected Note (Alt+U)">🔪 Chop</button>
          </div>
        </div>
        <div className="piano-roll__toolbar-actions">
          <span className="piano-roll__note-count">{notes.length} notes</span>
          {ghostNotes.length > 0 && (
            <button
              className={`piano-roll__ghost-btn ${showGhostNotes ? 'piano-roll__ghost-btn--active' : ''}`}
              onClick={() => setShowGhostNotes(prev => !prev)}
              title={showGhostNotes ? 'Hide Ghost Notes' : 'Show Ghost Notes'}
            >
              👻 {ghostNotes.length}
            </button>
          )}
        </div>
      </div>

      {/* Main area: keyboard + grid */}
      <div className="piano-roll__body">
        {/* Keyboard rail */}
        <div className="piano-roll__keyboard" ref={keyboardRef}>
          {keyboardLabels.map(k => {
            const isLive = liveNotes.includes(k.note);
            return (
            <div
              key={k.note}
              className={`piano-roll__key ${k.isBlack ? 'piano-roll__key--black' : 'piano-roll__key--white'} ${k.isC ? 'piano-roll__key--c' : ''} ${isLive ? 'piano-roll__key--live' : ''}`}
              style={{ height: ROW_HEIGHT }}
            >
              <span className="piano-roll__key-label">{k.isC || k.name.includes('F') || k.name.includes('A') ? k.name : ''}</span>
            </div>
            );
          })}
        </div>

        {/* Scrollable grid area */}
        <div
          className="piano-roll__grid-scroll"
          ref={gridRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={handleContextMenu}
        >
          <div
            className="piano-roll__grid"
            style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}
          >
            {/* Row backgrounds */}
            {keyboardLabels.map(k => {
              const inScale = scaleConfig?.enabled
                ? isNoteInScale(k.note, scaleConfig.root, scaleConfig.type)
                : true;
              return (
              <div
                key={k.note}
                className={`piano-roll__row ${k.isBlack ? 'piano-roll__row--black' : ''} ${k.isC ? 'piano-roll__row--c' : ''} ${scaleConfig?.enabled && inScale ? 'piano-roll__row--in-scale' : ''} ${scaleConfig?.enabled && !inScale ? 'piano-roll__row--out-scale' : ''}`}
                style={{
                  top: (MAX_NOTE - 1 - k.note) * ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  width: GRID_WIDTH,
                }}
              />
              );
            })}

            {/* Step grid lines */}
            {Array.from({ length: stepCount + 1 }, (_, i) => (
              <div
                key={i}
                className={`piano-roll__gridline ${i % 4 === 0 ? 'piano-roll__gridline--bar' : ''}`}
                style={{ left: i * stepWidth, height: GRID_HEIGHT }}
              />
            ))}

            {/* Ghost Notes — translucent notes from other tracks */}
            {showGhostNotes && ghostNotes.map(ghost =>
              ghost.notes.map(n => {
                const top = (MAX_NOTE - 1 - n.note) * ROW_HEIGHT;
                const left = n.startStep * stepWidth;
                const width = n.duration * stepWidth;
                return (
                  <div
                    key={`ghost-${ghost.trackIndex}-${n.id}`}
                    className="piano-roll__ghost-note"
                    style={{
                      top: top + 2,
                      left,
                      width: Math.max(3, width - 2),
                      height: ROW_HEIGHT - 4,
                      backgroundColor: ghost.trackColor,
                      borderColor: ghost.trackColor,
                    }}
                    title={`${ghost.trackName}: ${midiToName(n.note)}`}
                  />
                );
              })
            )}

            {/* Notes */}
            {notes.map(n => {
              const top = (MAX_NOTE - 1 - n.note) * ROW_HEIGHT;
              const left = n.startStep * stepWidth;
              const width = n.duration * stepWidth;
              const isSelected = n.id === selectedNoteId;
              const velocityOpacity = 0.4 + (n.velocity / 127) * 0.6;

              return (
                <div
                  key={n.id}
                  className={`piano-roll__note ${isSelected ? 'piano-roll__note--selected' : ''}`}
                  style={{
                    top: top + 1,
                    left,
                    width: Math.max(4, width - 1),
                    height: ROW_HEIGHT - 2,
                    backgroundColor: trackColor,
                    opacity: velocityOpacity,
                    '--note-color': trackColor,
                  } as React.CSSProperties}
                >
                  {width > 24 && (
                    <span className="piano-roll__note-label">{midiToName(n.note)}</span>
                  )}
                  <div className="piano-roll__note-resize" />
                </div>
              );
            })}

            {/* Playhead */}
            {playheadX !== null && (
              <div
                className="piano-roll__playhead"
                style={{ left: playheadX, height: GRID_HEIGHT }}
              />
            )}
          </div>
        </div>
      </div>

      {/* FL Quality: Bottom Event Editor Pane */}
      <div className={`piano-roll__event-editor ${showEventEditor ? 'piano-roll__event-editor--open' : ''}`}>
        <div className="piano-roll__event-editor-header">
          <button className="piano-roll__event-editor-toggle" onClick={() => setShowEventEditor(!showEventEditor)}>
            {showEventEditor ? '▼' : '▲'} Event Editor
          </button>
          {showEventEditor && (
            <div className="piano-roll__event-editor-tabs">
              <button className={activeEventParam === 'velocity' ? 'active' : ''} onClick={() => setActiveEventParam('velocity')}>Velocity</button>
              <button className={activeEventParam === 'pan' ? 'active' : ''} onClick={() => setActiveEventParam('pan')}>Pan</button>
              <button className={activeEventParam === 'pitchBend' ? 'active' : ''} onClick={() => setActiveEventParam('pitchBend')}>Pitch</button>
              <button className={activeEventParam === 'probability' ? 'active' : ''} onClick={() => setActiveEventParam('probability')}>Prob</button>
              <button className={activeEventParam === 'microTiming' ? 'active' : ''} onClick={() => setActiveEventParam('microTiming')}>Shift</button>
            </div>
          )}
        </div>
        {showEventEditor && (
          <div className="piano-roll__event-editor-graph">
            {notes.map(n => {
              const isSelected = n.id === selectedNoteId;
              let val = 0;
              let min = 0, max = 1;
              if (activeEventParam === 'velocity') { val = n.velocity || 100; min = 0; max = 127; }
              if (activeEventParam === 'pan') { val = n.pan || 0; min = -1; max = 1; }
              if (activeEventParam === 'pitchBend') { val = n.pitchBend || 0; min = -1; max = 1; }
              if (activeEventParam === 'probability') { val = n.probability !== undefined ? n.probability : 100; min = 0; max = 100; }
              if (activeEventParam === 'microTiming') { val = n.microTiming || 0; min = -50; max = 50; }
              
              const normalized = (val - min) / (max - min);
              const heightPct = Math.max(5, normalized * 100);
              
              return (
                <div
                  key={`event-${n.id}`}
                  className={`piano-roll__event-bar ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: n.startStep * stepWidth,
                    width: Math.max(4, (n.duration * stepWidth) - 2),
                  }}
                >
                  <div className="piano-roll__event-bar-fill" style={{ height: `${heightPct}%`, backgroundColor: isSelected ? '#fff' : trackColor }} />
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={activeEventParam === 'pan' || activeEventParam === 'pitchBend' ? 0.01 : 1}
                    value={val}
                    onChange={(e) => onUpdateNote(n.id, { [activeEventParam]: Number(e.target.value) })}
                    className="piano-roll__event-slider"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
