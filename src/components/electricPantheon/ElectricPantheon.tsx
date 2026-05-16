/**
 * ElectricPantheon.tsx — The Sacred Keys Interface
 * Main layout container for the Electric Pantheon module.
 * Composes all sub-components into the full Pantheon tab view.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────┐
 * │                    GLOBAL MACROS                        │
 * ├────────┬──────────────────────────────────┬─────────────┤
 * │  GOD   │         GOD HERO                │  GOD        │
 * │  LIST  │    Artwork + Name + Tagline     │  PROFILE    │
 * ├────────┼──────────┬───────────┬──────────┤             │
 * │        │ REALM FX │           │ALS VISION│             │
 * ├────────┴──────────┴───────────┴──────────┴─────────────┤
 * │ [PIT][MOD] ████ KEYBOARD (2.5 octaves) ████ VEL VOICE  │
 * └─────────────────────────────────────────────────────────┘
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { electricPantheonGods, getGodById } from '@/data/electricPantheonGods';
import type { ElectricPantheonGodId } from '@/data/electricPantheonGods';
import type { PantheonMacroId } from '@/data/pantheonMacros';
import { PantheonSynthEngine } from '@/audio/PantheonSynthEngine';
import type { VoiceMode } from '@/audio/pantheonVoicePresets';
import { useVstGodLibrary } from '@/hooks/useVstGodLibrary';
import { useMidiKitBridge } from '@/hooks/useMidiKitBridge';
import { useMacroDSPBridge } from '@/hooks/useMacroDSPBridge';
import { getGodVisualStyle } from '@/data/vstGodElectricPantheonLibrary';
import type { SequencerState } from '@/components/sequencer/useSequencerEngine';
import { GodSelector } from './GodSelector';
import { GodHero } from './GodHero';
import { GodProfile } from './GodProfile';
import { PantheonMacros } from './PantheonMacros';
import { RealmFXPanel } from './RealmFXPanel';
import { ALSVision } from './ALSVision';
import { PantheonKeyboard } from './PantheonKeyboard';
import { WaveformScope } from './WaveformScope';
import { DivineMorphOverlay } from './DivineMorphOverlay';
import { usePantheonAnalysis } from '@/hooks/usePantheonAnalysis';
import { usePantheonQwerty } from '@/hooks/usePantheonQwerty';
import '@/styles/ElectricPantheon.css';

interface ElectricPantheonProps {
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  engine?: {
    audioCtx: React.MutableRefObject<AudioContext | null>;
    state?: SequencerState;
    dispatch?: React.Dispatch<any>;
  };
}

export const ElectricPantheon: React.FC<ElectricPantheonProps> = ({
  parameterValues,
  update,
  engine: sequencerEngine,
}) => {
  // ─── Preset Library Hook ───
  const {
    selectedPreset,
    selectedGod: vstGod,
    midiKit,
    godPresets,
    selectGod: librarySelectGod,
    selectNextPreset,
    selectPreviousPreset,
  } = useVstGodLibrary();

  // State
  const [activeGodId, setActiveGodId] = useState<ElectricPantheonGodId>('olympus');
  const [isMorphOpen, setIsMorphOpen] = useState(false);
  const [macroValues, setMacroValues] = useState<Record<PantheonMacroId, number>>({
    energy: 50,
    divinity: 50,
    width: 50,
    realm: 50,
    aura: 50,
    age: 50,
  });
  const [fxValues, setFxValues] = useState<number[]>([50, 50, 50, 50]);
  const [pitchBend, setPitchBend] = useState(0);
  const [modWheel, setModWheel] = useState(0);
  const [kitLoaded, setKitLoaded] = useState(false);

  const activeGod = getGodById(activeGodId);

  // Sync FX knob defaults when preset changes
  useEffect(() => {
    if (selectedPreset?.realmFx) {
      setFxValues(selectedPreset.realmFx.map((fx) => Math.round(fx.default * 100)));
    }
  }, [selectedPreset?.id]);

  // ─── Phase 3: PantheonSynthEngine Lifecycle ───
  const synthRef = useRef<PantheonSynthEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Phase 3: MIDI Kit → Sequencer Bridge ───
  const { loadKit, kitSummary, canLoadKit } = useMidiKitBridge(
    midiKit,
    selectedPreset,
    sequencerEngine?.state,
    sequencerEngine?.dispatch
  );

  // ─── Phase 3: Macro DSP Bridge ───
  const { behaviors: macroBehaviors } = useMacroDSPBridge(
    synthRef,
    macroValues,
    selectedPreset
  );

  // ─── Phase 4: Real-time Audio Analysis ───
  const analysisData = usePantheonAnalysis(synthRef);

  /**
   * Ensures an AudioContext exists (creates one if the sequencer hasn't yet)
   * and initializes the PantheonSynthEngine on first use.
   * Returns the AudioContext.
   */
  const ensureAudioReady = useCallback(() => {
    // 1. Get or create AudioContext
    let ctx = sequencerEngine?.audioCtx?.current ?? null;
    if (!ctx) {
      ctx = new AudioContext();
      // Share it back to the sequencer so both systems use the same context
      if (sequencerEngine?.audioCtx) {
        sequencerEngine.audioCtx.current = ctx;
      }
      console.log('[Electric Pantheon] Created shared AudioContext');
    }

    // 2. Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();

    // 3. Init synth engine if not yet created
    if (!synthRef.current) {
      const synth = new PantheonSynthEngine();
      synth.init(ctx);
      synth.setGod(activeGodId);
      synthRef.current = synth;
      console.log('[Electric Pantheon] Synth Engine initialized');
    }

    return ctx;
  }, [sequencerEngine, activeGodId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
        console.log('[Electric Pantheon] Synth Engine disposed');
      }
    };
  }, []);

  // Handlers
  const handleSelectGod = useCallback(
    (id: ElectricPantheonGodId) => {
      setActiveGodId(id);
      update('pantheonGod', id);
      // Also sync the library hook (loads first preset for this god)
      librarySelectGod(id);
      // Wire to synth engine
      synthRef.current?.setGod(id);
    },
    [update, librarySelectGod]
  );

  const handleMacroChange = useCallback(
    (id: PantheonMacroId, value: number) => {
      setMacroValues((prev) => ({ ...prev, [id]: value }));
      update(`pantheonMacro_${id}`, value);
      synthRef.current?.setMacro(id, value);
    },
    [update]
  );

  const handleFxChange = useCallback(
    (index: number, value: number) => {
      setFxValues((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });
      update(`pantheonFx_${index}`, value);
      synthRef.current?.setFx(index, value);
    },
    [update]
  );

  const handleMorphApply = useCallback(
    (fromId: ElectricPantheonGodId, toId: ElectricPantheonGodId, blend: number) => {
      synthRef.current?.setMorph(fromId, toId, blend);
      if (blend >= 95) {
        synthRef.current?.applyMorph();
        setActiveGodId(toId);
      }
      update('pantheonMorph', { from: fromId, to: toId, blend });
      setIsMorphOpen(false);
    },
    [update]
  );

  const handleNoteOn = useCallback(
    (note: number, velocity: number) => {
      // Lazy-init audio on first key press (handles browser autoplay)
      ensureAudioReady();

      synthRef.current?.noteOn(note, velocity);
      update('pantheonNoteOn', { note, velocity, god: activeGodId });
    },
    [update, activeGodId, ensureAudioReady]
  );

  const handleNoteOff = useCallback(
    (note: number) => {
      synthRef.current?.noteOff(note);
      update('pantheonNoteOff', { note });
    },
    [update]
  );

  // Wire pitch bend + mod wheel to engine
  const handlePitchBendChange = useCallback((value: number) => {
    setPitchBend(value);
    synthRef.current?.setPitchBend(value);
  }, []);

  const handleModWheelChange = useCallback((value: number) => {
    setModWheel(value);
    synthRef.current?.setModWheel(value);
  }, []);

  // Wire voice mode to engine
  const handleVoiceModeChange = useCallback((mode: 'POLY' | 'MONO' | 'LEGATO') => {
    synthRef.current?.setVoiceMode(mode);
    update('pantheonVoiceMode', mode);
  }, [update]);

  // Real-time morph preview (fires as slider moves)
  const handleMorphPreview = useCallback(
    (fromId: ElectricPantheonGodId, toId: ElectricPantheonGodId, blend: number) => {
      synthRef.current?.setMorph(fromId, toId, blend);
    },
    []
  );

  // ─── Phase 5: QWERTY Keyboard Input ───
  const { octave, activeQwertyNotes, octaveUp, octaveDown } = usePantheonQwerty({
    onNoteOn: handleNoteOn,
    onNoteOff: handleNoteOff,
    containerRef,
  });

  return (
    <div
      className="ep-container"
      ref={containerRef}
      tabIndex={0}
      style={{
        '--god-primary': activeGod.colors.primary,
        '--god-secondary': activeGod.colors.secondary,
        '--god-accent': activeGod.colors.accent,
        ...(vstGod ? getGodVisualStyle(vstGod.id) : {}),
        outline: 'none',
      } as React.CSSProperties}
    >
      {/* ═══ PRESET NAVIGATOR ═══ */}
      <div className="ep-preset-nav">
        <button className="ep-preset-nav-btn" onClick={selectPreviousPreset} title="Previous Preset">◀</button>
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedPreset.id}
            className="ep-preset-nav-info"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
          >
            <span className="ep-preset-nav-name">{selectedPreset.displayName}</span>
            <span className="ep-preset-nav-sub">{selectedPreset.subtitle}</span>
          </motion.div>
        </AnimatePresence>
        <button className="ep-preset-nav-btn" onClick={selectNextPreset} title="Next Preset">▶</button>
        {midiKit && (
          <span className="ep-preset-nav-midi">
            {midiKit.key} · {midiKit.bpm} BPM
          </span>
        )}
        {canLoadKit && (
          <button
            className={`ep-preset-nav-load-kit ${kitLoaded ? 'ep-load-kit--success' : ''}`}
            onClick={() => {
              loadKit();
              setKitLoaded(true);
              setTimeout(() => setKitLoaded(false), 1800);
            }}
            title={kitSummary ? `Load ${kitSummary.trackCount} tracks to Sequencer` : 'Load Kit'}
            disabled={kitLoaded}
          >
            <span className="ep-load-kit-icon">{kitLoaded ? '✓' : '🎹'}</span>
            <span className="ep-load-kit-label">{kitLoaded ? 'LOADED' : 'LOAD KIT'}</span>
          </button>
        )}
      </div>

      {/* ═══ TOP: GLOBAL MACROS ═══ */}
      <PantheonMacros
        god={activeGod}
        macroValues={macroValues}
        onMacroChange={handleMacroChange}
        behaviorContext={macroBehaviors}
      />

      {/* ═══ MIDDLE: 3-COLUMN LAYOUT ═══ */}
      <div className="ep-body">
        {/* LEFT: God Selector */}
        <GodSelector
          gods={electricPantheonGods}
          activeGodId={activeGodId}
          onSelectGod={handleSelectGod}
          onOpenMorph={() => setIsMorphOpen(true)}
        />

        {/* CENTER: Hero + FX */}
        <div className="ep-center">
          <GodHero
            god={activeGod}
            preset={selectedPreset}
          />

          <div className="ep-center-bottom">
            <RealmFXPanel
              god={activeGod}
              fxValues={fxValues}
              onFxChange={handleFxChange}
              presetFxNames={selectedPreset.realmFx.map((fx) => fx.name)}
            />
            <ALSVision
              god={activeGod}
              macroValues={macroValues}
              analysisData={analysisData}
            />
            <WaveformScope
              color={activeGod.colors.primary}
              engineRef={synthRef}
            />
          </div>
        </div>

        {/* RIGHT: God Profile */}
        <GodProfile
          god={activeGod}
          preset={selectedPreset}
        />
      </div>

      {/* ═══ BOTTOM: KEYBOARD ═══ */}
      <PantheonKeyboard
        god={activeGod}
        pitchBend={pitchBend}
        modWheel={modWheel}
        onPitchBendChange={handlePitchBendChange}
        onModWheelChange={handleModWheelChange}
        onNoteOn={handleNoteOn}
        onNoteOff={handleNoteOff}
        onVoiceModeChange={handleVoiceModeChange}
        qwertyActiveNotes={activeQwertyNotes}
        currentOctave={octave}
        onOctaveUp={octaveUp}
        onOctaveDown={octaveDown}
      />

      {/* ═══ FLOATING: DIVINE MORPH ═══ */}
      <DivineMorphOverlay
        isOpen={isMorphOpen}
        onClose={() => setIsMorphOpen(false)}
        gods={electricPantheonGods}
        activeGodId={activeGodId}
        onMorphApply={handleMorphApply}
        onMorphPreview={handleMorphPreview}
      />
    </div>
  );
};
