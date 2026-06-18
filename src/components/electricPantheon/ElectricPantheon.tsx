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
import { nativeAudio } from '@/native/bridge';
import { PantheonVortexPad } from './PantheonVortexPad';
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
  const [activeControlTab, setActiveControlTab] = useState<'shapers' | 'fx' | 'vortex' | 'visuals'>('shapers');
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

  // Track dominant god from vortex coordinates in real-time
  const xVal = parameterValues.pantheonVortexX !== undefined ? Number(parameterValues.pantheonVortexX) : 0.5;
  const yVal = parameterValues.pantheonVortexY !== undefined ? Number(parameterValues.pantheonVortexY) : 0.5;

  useEffect(() => {
    const vertices = [
      { id: 'olympus', x: 1.0, y: 0.5 },
      { id: 'hades', x: 0.85355, y: 0.85355 },
      { id: 'zeus', x: 0.5, y: 1.0 },
      { id: 'athena', x: 0.14645, y: 0.85355 },
      { id: 'poseidon', x: 0.0, y: 0.5 },
      { id: 'titan', x: 0.14645, y: 0.14645 },
      { id: 'apollo', x: 0.5, y: 0.0 },
      { id: 'chronos', x: 0.85355, y: 0.14645 },
    ];

    let minDistance = 999.0;
    let closestGodId = activeGodId;

    vertices.forEach((v) => {
      const dx = xVal - v.x;
      const dy = yVal - v.y;
      const dist = dx * dx + dy * dy;
      if (dist < minDistance) {
        minDistance = dist;
        closestGodId = v.id as ElectricPantheonGodId;
      }
    });

    if (closestGodId !== activeGodId) {
      setActiveGodId(closestGodId);
      librarySelectGod(closestGodId);
      synthRef.current?.setGod(closestGodId);
    }
  }, [xVal, yVal, activeGodId, librarySelectGod]);

  // Sync Chthonic Sub Gain to local Web Audio synth
  const subGainVal = parameterValues.pantheonSubGain !== undefined ? Number(parameterValues.pantheonSubGain) : 40;
  useEffect(() => {
    synthRef.current?.setSubGain(subGainVal);
  }, [subGainVal]);

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
    if (nativeAudio.isInJuce()) {
      return null;
    }
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
      librarySelectGod(id);
      synthRef.current?.setGod(id);

      // Snap Vortex coordinates to this god's vertex
      const vertices: Record<ElectricPantheonGodId, { x: number; y: number }> = {
        olympus: { x: 1.0, y: 0.5 },
        hades: { x: 0.85355, y: 0.85355 },
        zeus: { x: 0.5, y: 1.0 },
        athena: { x: 0.14645, y: 0.85355 },
        poseidon: { x: 0.0, y: 0.5 },
        titan: { x: 0.14645, y: 0.14645 },
        apollo: { x: 0.5, y: 0.0 },
        chronos: { x: 0.85355, y: 0.14645 },
      };

      const coords = vertices[id];
      if (coords) {
        update('pantheonVortexX', coords.x);
        update('pantheonVortexY', coords.y);
        nativeAudio.setParameter('pantheonVortexX', coords.x);
        nativeAudio.setParameter('pantheonVortexY', coords.y);
      }
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

  // Phase 3: X/Y Vortex maps to AURA and AGE
  const lastAuraAge = useRef({ aura: 50, age: 50 });
  useEffect(() => {
    const newAura = Math.round(xVal * 100);
    const newAge = Math.round(yVal * 100);
    
    if (lastAuraAge.current.aura !== newAura || lastAuraAge.current.age !== newAge) {
      lastAuraAge.current = { aura: newAura, age: newAge };
      handleMacroChange('aura', newAura);
      handleMacroChange('age', newAge);
    }
  }, [xVal, yVal, handleMacroChange]);

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

      {/* Top macro row removed for expanded keyboard layout */}

      {/* ═══ MIDDLE: 3-COLUMN LAYOUT ═══ */}
      <div className="ep-body">
        {/* LEFT: God Selector */}
        <GodSelector
          gods={electricPantheonGods}
          activeGodId={activeGodId}
          onSelectGod={handleSelectGod}
          onOpenMorph={() => setIsMorphOpen(true)}
          onOpenVortex={() => setActiveControlTab('vortex')}
        />

        {/* CENTER: Hero + Tabbed Control Deck */}
        <div className="ep-center">
          <GodHero
            god={activeGod}
            preset={selectedPreset}
          />

          <div className="ep-control-deck">
            <div className="ep-control-deck-tabs">
              {(['shapers', 'fx', 'vortex', 'visuals'] as const).map((tab) => {
                const labels: Record<string, string> = {
                  shapers: 'SHAPERS',
                  fx: 'REALM FX',
                  vortex: 'VORTEX PAD',
                  visuals: 'AETHER SCOPE',
                };
                const activeColor = activeGod.colors.primary;
                const isActive = activeControlTab === tab;
                return (
                  <button
                    key={tab}
                    className={`ep-control-deck-tab ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveControlTab(tab)}
                    style={{
                      '--active-color': activeColor,
                    } as React.CSSProperties}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            <div className="ep-control-deck-content">
              {activeControlTab === 'shapers' && (
                <PantheonMacros
                  god={activeGod}
                  macroValues={macroValues}
                  onMacroChange={handleMacroChange}
                  behaviorContext={macroBehaviors}
                />
              )}
              {activeControlTab === 'fx' && (
                <RealmFXPanel
                  god={activeGod}
                  fxValues={fxValues}
                  onFxChange={handleFxChange}
                  presetFxNames={selectedPreset.realmFx.map((fx) => fx.name)}
                />
              )}
              {activeControlTab === 'vortex' && (
                <PantheonVortexPad
                  parameterValues={parameterValues}
                  update={update}
                  isEmbedded={true}
                />
              )}
              {activeControlTab === 'visuals' && (
                <div className="ep-visuals-deck">
                  <ALSVision
                    god={activeGod}
                    macroValues={macroValues}
                    analysisData={analysisData}
                  />
                  <WaveformScope
                    color={activeGod.colors.primary}
                    colorSecondary={activeGod.colors.secondary}
                    colorAccent={activeGod.colors.accent}
                    engineRef={synthRef}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: God Profile */}
        <GodProfile
          god={activeGod}
          preset={selectedPreset}
          parameterValues={parameterValues}
          update={update}
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

      {/* Floating Vortex Pad removed in favor of embedded Control Deck tab */}
    </div>
  );
};
