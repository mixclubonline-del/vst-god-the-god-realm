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
import { motion } from 'framer-motion';
import { electricPantheonGods, getGodById } from '@/data/electricPantheonGods';
import type { ElectricPantheonGodId } from '@/data/electricPantheonGods';
import type { PantheonMacroId } from '@/data/pantheonMacros';
import { PantheonSynthEngine } from '@/audio/PantheonSynthEngine';
import type { VoiceMode } from '@/audio/pantheonVoicePresets';
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
  engine?: { audioCtx: React.MutableRefObject<AudioContext | null> };
}

export const ElectricPantheon: React.FC<ElectricPantheonProps> = ({
  parameterValues,
  update,
  engine: sequencerEngine,
}) => {
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

  const activeGod = getGodById(activeGodId);

  // ─── Phase 3: PantheonSynthEngine Lifecycle ───
  const synthRef = useRef<PantheonSynthEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      setFxValues([50, 50, 50, 50]);
      // Wire to synth engine
      synthRef.current?.setGod(id);
    },
    [update]
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
        outline: 'none',
      } as React.CSSProperties}
    >
      {/* ═══ TOP: GLOBAL MACROS ═══ */}
      <PantheonMacros
        god={activeGod}
        macroValues={macroValues}
        onMacroChange={handleMacroChange}
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
          <GodHero god={activeGod} />

          <div className="ep-center-bottom">
            <RealmFXPanel
              god={activeGod}
              fxValues={fxValues}
              onFxChange={handleFxChange}
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
        <GodProfile god={activeGod} />
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
