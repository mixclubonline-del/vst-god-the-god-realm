/**
 * AstralDais — The Sacred 4×4 Pad Grid
 *
 * Replaces SamplerEngine.tsx. Split-view: 4×4 throne grid on top,
 * AstralThroneDetail panel below for the selected throne.
 *
 * "Before the First Sound, there was the Dais — sixteen thrones arranged
 * in sacred formation upon the cosmic floor."
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { THRONE_DOMAINS } from '../data/throneDomains';
import { AstralThrone } from './AstralThrone';
import { AstralThroneDetail, type PlayMode } from './AstralThroneDetail';
import './AstralDais.css';
import type { BufferRegistry } from '../audio/BufferRegistry';
import { MiniSequencerStrip } from './MiniSequencerStrip';
import { ContextualPadPicker } from './ContextualPadPicker';
import '@/styles/ContextualPadPicker.css';

interface AstralDaisProps {
  /** GodEngine ref — for triggering pad playback */
  godEngine: React.MutableRefObject<any>;
  /** BufferRegistry ref — for name lookups */
  registry: BufferRegistry;
  /** Reactive buffer record from useBufferRegistry */
  buffers: Record<number, AudioBuffer>;
  /** Sequencer engine state — for checking pattern data per track */
  sequencerState?: {
    tracks: Array<{
      name: string;
      sourceType: string;
      muted: boolean;
      patternA: Array<{ enabled: boolean; velocity: number }>;
      patternB: Array<{ enabled: boolean; velocity: number }>;
    }>;
    activePattern: 'A' | 'B';
    currentStep: number;
    isPlaying: boolean;
    stepCount: number;
  };
  /** Real-time slot audio levels (0-1 per slot) */
  slotLevels: number[];
  /** Parameter values store */
  parameterValues: Record<string, any>;
  /** Parameter update function */
  update: (id: string, val: any) => void;
  /** Trigger flash array — true for pads currently triggered */
  triggerFlash: boolean[];
  /** MIDI note → pad mapping (configurable) */
  midiMap: number[];
  /** Callback to update MIDI map */
  onMidiMapChange: (padIndex: number, note: number) => void;
  /** Navigate to another tab */
  onNavigateToTab: (tabName: string, options?: { padIndex?: number }) => void;
  /** Sequencer dispatch for step toggling */
  onToggleStep?: (trackIndex: number, stepIndex: number) => void;
}

export const AstralDais: React.FC<AstralDaisProps> = ({
  godEngine,
  registry,
  buffers,
  sequencerState,
  slotLevels,
  parameterValues,
  update,
  triggerFlash,
  midiMap,
  onMidiMapChange,
  onNavigateToTab,
  onToggleStep,
}) => {
  const [activePad, setActivePad] = useState(0);
  const [miniSeqExpanded, setMiniSeqExpanded] = useState(false);
  const [playModes, setPlayModes] = useState<PlayMode[]>(
    Array(16).fill('layer') as PlayMode[]
  );
  const [midiLearnPad, setMidiLearnPad] = useState<number | null>(null);
  const [isArchivePickerOpen, setIsArchivePickerOpen] = useState(false);

  // Count loaded thrones
  const loadedCount = THRONE_DOMAINS.filter((_, i) => !!buffers[i]).length;

  // Get sample name for a pad
  const getSampleName = useCallback((index: number): string => {
    return registry.getName(index) || '';
  }, [registry]);

  // Check if pad is loaded
  const isPadLoaded = useCallback((index: number): boolean => {
    return !!buffers[index];
  }, [buffers]);

  // Check if sequencer track has pattern data
  const hasPattern = useCallback((index: number): boolean => {
    if (!sequencerState?.tracks?.[index]) return false;
    return sequencerState.tracks[index].patternA.some(s => s.enabled);
  }, [sequencerState]);

  // Trigger pad playback
  const handleTrigger = useCallback((index: number) => {
    if (godEngine.current?.triggerPad) {
      godEngine.current.triggerPad(index);
    }
  }, [godEngine]);

  // Handle file drop onto a pad
  const handleFileDrop = useCallback((index: number, file: File) => {
    // Read the file and load into buffer registry
    const reader = new FileReader();
    reader.onload = async () => {
      if (godEngine.current?.loadSampleToSlot) {
        await godEngine.current.loadSampleToSlot(index, reader.result as ArrayBuffer, file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [godEngine]);

  // Relic drop from Archive
  const handleRelicDrop = useCallback((index: number, relic: { path: string; name: string }) => {
    if (godEngine.current?.loadSampleByPath) {
      godEngine.current.loadSampleByPath(relic.path, index);
      console.log(`📌 Relic dropped: "${relic.name}" → Throne ${index + 1}`);
    }
  }, [godEngine]);

  // Play mode change for a specific pad
  const handlePlayModeChange = useCallback((mode: PlayMode) => {
    setPlayModes(prev => {
      const next = [...prev];
      next[activePad] = mode;
      return next;
    });
  }, [activePad]);

  // MIDI learn
  const handleMidiLearn = useCallback(() => {
    setMidiLearnPad(activePad);
  }, [activePad]);

  // Listen for MIDI learn input
  useEffect(() => {
    if (midiLearnPad === null) return;

    const handleMIDI = (e: Event) => {
      const midiEvent = e as CustomEvent<{ note: number }>;
      if (midiEvent.detail?.note !== undefined) {
        onMidiMapChange(midiLearnPad, midiEvent.detail.note);
        setMidiLearnPad(null);
      }
    };

    window.addEventListener('midi-note-on', handleMIDI);
    // Auto-cancel after 10s
    const timeout = setTimeout(() => setMidiLearnPad(null), 10000);

    return () => {
      window.removeEventListener('midi-note-on', handleMIDI);
      clearTimeout(timeout);
    };
  }, [midiLearnPad, onMidiMapChange]);

  // Clear throne
  const handleClearThrone = useCallback(() => {
    if (godEngine.current?.clearSlot) {
      godEngine.current.clearSlot(activePad);
    }
  }, [godEngine, activePad]);

  // Navigate helpers
  const handleOpenChopper = useCallback(() => {
    onNavigateToTab('Sample Chopper', { padIndex: activePad });
  }, [onNavigateToTab, activePad]);

  const handleOpenSequencer = useCallback(() => {
    onNavigateToTab('Sequencer', { padIndex: activePad });
  }, [onNavigateToTab, activePad]);

  const handleOpenArchivePicker = useCallback(() => {
    setIsArchivePickerOpen(true);
  }, []);

  const handleArchiveAssign = useCallback((samplePath: string, padIndex: number, sampleName: string, category: string) => {
    if (godEngine.current?.loadSampleByPath) {
      godEngine.current.loadSampleByPath(samplePath, padIndex);
      console.log(`📌 Archive Picker: "${sampleName}" → Pad ${padIndex + 1}`);
    }
    update(`slotName_${padIndex}`, sampleName);
    update(`slotCategory_${padIndex}`, category);
    update(`slotPath_${padIndex}`, samplePath);
  }, [godEngine, update]);

  const activeDomain = THRONE_DOMAINS[activePad];

  return (
    <div className="astral-dais">
      {/* Header */}
      <div className="astral-dais__header">
        <h2 className="astral-dais__title">THE ASTRAL DAIS</h2>
        <span className="astral-dais__count">
          {loadedCount}/{THRONE_DOMAINS.length} THRONES CLAIMED
        </span>
      </div>

      {/* 4×4 Pad Grid */}
      <div className="astral-dais__grid">
        {THRONE_DOMAINS.map((domain, i) => (
          <AstralThrone
            key={i}
            index={i}
            domain={domain}
            sampleName={getSampleName(i)}
            isLoaded={isPadLoaded(i)}
            isSelected={activePad === i}
            isTriggered={triggerFlash[i] || false}
            level={slotLevels[i] || 0}
            hasSequencerPattern={hasPattern(i)}
            onSelect={() => setActivePad(i)}
            onTrigger={() => handleTrigger(i)}
            onFileDrop={(file) => handleFileDrop(i, file)}
            onRelicDrop={(relic) => handleRelicDrop(i, relic)}
          />
        ))}
      </div>

      {/* Detail Panel for Selected Throne */}
      <div className="astral-dais__detail">
        <AstralThroneDetail
          index={activePad}
          domain={activeDomain}
          sampleName={getSampleName(activePad)}
          isLoaded={isPadLoaded(activePad)}
          parameterValues={parameterValues}
          update={update}
          playMode={playModes[activePad]}
          onPlayModeChange={handlePlayModeChange}
          midiNote={midiMap[activePad]}
          onMidiLearn={handleMidiLearn}
          onOpenChopper={handleOpenChopper}
          onOpenSequencer={handleOpenSequencer}
          onClearThrone={handleClearThrone}
          onOpenArchivePicker={handleOpenArchivePicker}
          buffer={buffers[activePad] || null}
          slices={registry.getSlices(activePad)}
        />

        {/* MIDI Learn Overlay */}
        {midiLearnPad !== null && (
          <div className="astral-dais__midi-learn-overlay">
            <div className="astral-dais__midi-learn-modal">
              <span className="astral-dais__midi-learn-sigil">
                {THRONE_DOMAINS[midiLearnPad].sigil}
              </span>
              <span className="astral-dais__midi-learn-text">
                Press a MIDI key to assign to {THRONE_DOMAINS[midiLearnPad].name.toUpperCase()}
              </span>
              <button
                className="astral-dais__midi-learn-cancel"
                onClick={() => setMidiLearnPad(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mini Sequencer Strip */}
      {sequencerState && onToggleStep && (
        <MiniSequencerStrip
          tracks={sequencerState.tracks}
          activePattern={sequencerState.activePattern}
          currentStep={sequencerState.currentStep}
          isPlaying={sequencerState.isPlaying}
          stepCount={sequencerState.stepCount}
          isExpanded={miniSeqExpanded}
          onToggle={() => setMiniSeqExpanded(prev => !prev)}
          onToggleStep={onToggleStep}
        />
      )}

      {/* Contextual Archive Pad Picker */}
      <ContextualPadPicker
        isOpen={isArchivePickerOpen}
        onClose={() => setIsArchivePickerOpen(false)}
        targetPadIndex={activePad}
        targetDomain={activeDomain}
        currentSampleName={getSampleName(activePad) || undefined}
        engineRef={godEngine}
        onAssign={handleArchiveAssign}
      />
    </div>
  );
};
