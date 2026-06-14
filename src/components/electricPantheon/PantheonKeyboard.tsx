/**
 * PantheonKeyboard.tsx — The Electrified Divine Keys ⚡
 * 2.5-octave playable keyboard (C3 → F5) with pitch/mod wheels,
 * velocity-from-Y, active note highlighting, voice mode selector,
 * QWERTY keyboard integration, and ELECTRIFIED visual effects:
 *   • Plasma underglow per key
 *   • Velocity burst particles
 *   • Lightning arcs between held notes (canvas)
 *   • Energy grid floor + holographic reflection
 *   • LED wheel trail effects
 *   • Breathing halo glows
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ElectricPantheonGod } from '@/data/electricPantheonGods';

interface PantheonKeyboardProps {
  god: ElectricPantheonGod;
  pitchBend: number;
  modWheel: number;
  onPitchBendChange: (value: number) => void;
  onModWheelChange: (value: number) => void;
  onNoteOn?: (note: number, velocity: number) => void;
  onNoteOff?: (note: number) => void;
  onVoiceModeChange?: (mode: VoiceMode) => void;
  /** Set of MIDI notes currently triggered by QWERTY keyboard */
  qwertyActiveNotes?: Set<number>;
  /** Current QWERTY base octave for display */
  currentOctave?: number;
  /** Shift octave up */
  onOctaveUp?: () => void;
  /** Shift octave down */
  onOctaveDown?: () => void;
}

type VoiceMode = 'POLY' | 'MONO' | 'LEGATO';

/* ─── Note Definitions (C3 = MIDI 48 → F5 = MIDI 77) ─── */
interface KeyDef {
  midi: number;
  name: string;
  isBlack: boolean;
}

function buildKeyRange(): KeyDef[] {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keys: KeyDef[] = [];
  for (let midi = 48; midi <= 77; midi++) {
    const noteIdx = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    const name = noteNames[noteIdx] + octave;
    const isBlack = [1, 3, 6, 8, 10].includes(noteIdx);
    keys.push({ midi, name, isBlack });
  }
  return keys;
}

const ALL_KEYS = buildKeyRange();
const WHITE_KEYS = ALL_KEYS.filter((k) => !k.isBlack);
const BLACK_KEYS = ALL_KEYS.filter((k) => k.isBlack);

/** Maps a black key MIDI number to its X position relative to the white key layout */
function getBlackKeyPosition(midi: number, whiteKeys: KeyDef[]): number {
  const prevWhiteIdx = whiteKeys.findIndex((wk) => wk.midi > midi) - 1;
  if (prevWhiteIdx < 0) return 0;
  return prevWhiteIdx + 0.65;
}

/* ─── Particle type ─── */
interface Particle {
  id: number;
  x: number;
  y: number;
  px: number;  // CSS custom prop --px
  py: number;  // CSS custom prop --py
}

let particleIdCounter = 0;

/* ═══════════════════════════════════════════
   Lightning Arc Drawing
   ═══════════════════════════════════════════ */

function drawLightningBolt(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  segments = 8,
  jitter = 12,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);

  const dx = (x2 - x1) / segments;
  const dy = (y2 - y1) / segments;

  for (let i = 1; i < segments; i++) {
    const px = x1 + dx * i + (Math.random() - 0.5) * jitter;
    const py = y1 + dy * i + (Math.random() - 0.5) * jitter * 0.6;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x2, y2);

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.stroke();

  // Faint secondary bolt
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segments; i++) {
    const px = x1 + dx * i + (Math.random() - 0.5) * jitter * 1.5;
    const py = y1 + dy * i + (Math.random() - 0.5) * jitter * 0.8;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x2, y2);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */

export const PantheonKeyboard: React.FC<PantheonKeyboardProps> = ({
  god,
  pitchBend,
  modWheel,
  onPitchBendChange,
  onModWheelChange,
  onNoteOn,
  onNoteOff,
  onVoiceModeChange,
  qwertyActiveNotes,
  currentOctave = 3,
  onOctaveUp,
  onOctaveDown,
}) => {
  const [mouseActiveNotes, setMouseActiveNotes] = useState<Set<number>>(new Set());
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('POLY');
  const [particles, setParticles] = useState<Particle[]>([]);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const keysContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keyRefsMap = useRef<Map<number, HTMLButtonElement>>(new Map());
  const arcRafRef = useRef<number>(0);
  const dimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // ─── ResizeObserver for Keys Container ───
  useEffect(() => {
    const container = keysContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        dimensionsRef.current = { width, height };

        const canvas = canvasRef.current;
        if (canvas) {
          const dpr = window.devicePixelRatio || 1;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }
      }
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);


  // Merge mouse-triggered and QWERTY-triggered notes for display
  const activeNotes = useMemo(() => {
    const merged = new Set(mouseActiveNotes);
    if (qwertyActiveNotes) {
      for (const n of qwertyActiveNotes) merged.add(n);
    }
    return merged;
  }, [mouseActiveNotes, qwertyActiveNotes]);

  // ─── Velocity Particle Spawner ───
  const spawnParticles = useCallback((midi: number, velocity: number) => {
    const keyEl = keyRefsMap.current.get(midi);
    const container = keysContainerRef.current;
    if (!keyEl || !container) return;

    const keyRect = keyEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const cx = keyRect.left + keyRect.width / 2 - containerRect.left;
    const cy = keyRect.top + keyRect.height * 0.3 - containerRect.top;

    // More particles for harder velocity (3–10)
    const count = Math.round(3 + (velocity / 127) * 7);
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = 15 + Math.random() * 25 + (velocity / 127) * 15;
      newParticles.push({
        id: ++particleIdCounter,
        x: cx,
        y: cy,
        px: Math.cos(angle) * dist,
        py: Math.sin(angle) * dist - 10, // bias upward
      });
    }

    setParticles((prev) => [...prev, ...newParticles]);
    // Cleanup after animation
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 650);
  }, []);

  // ─── Note handlers ───
  const pitchDragRef = useRef<boolean>(false);
  const modDragRef = useRef<boolean>(false);

  const handleKeyDown = useCallback(
    (midi: number, e: React.MouseEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const yRatio = (e.clientY - rect.top) / rect.height;
      const velocity = Math.round(30 + yRatio * 97);

      setMouseActiveNotes((prev) => {
        const next = new Set(prev);
        next.add(midi);
        return next;
      });

      onNoteOn?.(midi, Math.min(127, velocity));
      spawnParticles(midi, Math.min(127, velocity));
    },
    [onNoteOn, spawnParticles]
  );

  const handleKeyUp = useCallback(
    (midi: number) => {
      setMouseActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });
      onNoteOff?.(midi);
    },
    [onNoteOff]
  );

  const handleWheelDrag = useCallback(
    (e: React.MouseEvent, type: 'pitch' | 'mod') => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const yRatio = 1 - (e.clientY - rect.top) / rect.height;
      const clamped = Math.max(0, Math.min(1, yRatio));

      if (type === 'pitch') {
        onPitchBendChange((clamped - 0.5) * 2);
      } else {
        onModWheelChange(Math.round(clamped * 127));
      }
    },
    [onPitchBendChange, onModWheelChange]
  );

  // ─── Lightning Arc Rendering Loop ───
  useEffect(() => {
    let running = true;
    let frameCount = 0;

    const render = () => {
      if (!running) return;

      const canvas = canvasRef.current;
      if (!canvas) {
        arcRafRef.current = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        arcRafRef.current = requestAnimationFrame(render);
        return;
      }

      const { width, height } = dimensionsRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (width === 0 || height === 0) {
        arcRafRef.current = requestAnimationFrame(render);
        return;
      }

      const dpr = window.devicePixelRatio || 1;

      // Gather active key positions mathematically without layout thrashing
      const positions: { x: number; y: number }[] = [];
      const whiteKeyWidthPx = width / WHITE_KEYS.length;

      for (const midi of activeNotes) {
        const key = ALL_KEYS.find((k) => k.midi === midi);
        if (!key) continue;

        let x = 0;
        let y = 0;

        if (!key.isBlack) {
          const whiteIdx = WHITE_KEYS.findIndex((wk) => wk.midi === midi);
          if (whiteIdx !== -1) {
            x = whiteIdx * whiteKeyWidthPx + whiteKeyWidthPx / 2;
            y = height * 0.7;
          }
        } else {
          const xPos = getBlackKeyPosition(midi, WHITE_KEYS);
          x = (xPos / WHITE_KEYS.length) * width + (whiteKeyWidthPx * 0.6) / 2;
          y = height * 0.45;
        }

        positions.push({ x, y });
      }

      // Draw lightning between adjacent held notes
      if (positions.length >= 2) {
        positions.sort((a, b) => a.x - b.x);

        ctx.save();
        ctx.scale(dpr, dpr);

        // Only redraw bolts every few frames for a flickering effect
        if (frameCount % 3 === 0) {
          for (let i = 0; i < positions.length - 1; i++) {
            drawLightningBolt(
              ctx,
              positions[i].x, positions[i].y,
              positions[i + 1].x, positions[i + 1].y,
              god.colors.primary,
              6 + Math.floor(Math.random() * 4),
              8 + Math.random() * 10,
            );
          }
        }

        ctx.restore();
      }

      frameCount++;
      arcRafRef.current = requestAnimationFrame(render);
    };

    arcRafRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(arcRafRef.current);
    };
  }, [activeNotes, god.colors.primary]);

  const whiteKeyWidth = 100 / WHITE_KEYS.length;

  // Wheel LED heights
  const pitchLedHeight = `${Math.abs(pitchBend) * 50}%`;
  const modLedHeight = `${(modWheel / 127) * 100}%`;

  return (
    <div
      className="ep-keyboard"
      ref={keyboardRef}
      style={{ '--god-primary': god.colors.primary, '--god-accent': god.colors.accent } as React.CSSProperties}
    >
      {/* ── Energy Grid Floor ── */}
      <div className="ep-keyboard-grid" />

      {/* ── Holographic Reflection ── */}
      <div className="ep-keyboard-reflection">
        <div className="ep-keyboard-reflection-inner" />
      </div>

      {/* ── Pitch Wheel ── */}
      <div className="ep-keyboard-wheels">
        <div
          className="ep-wheel-container"
          onMouseDown={() => { pitchDragRef.current = true; }}
          onMouseUp={() => { pitchDragRef.current = false; onPitchBendChange(0); }}
          onMouseLeave={() => { if (pitchDragRef.current) { pitchDragRef.current = false; onPitchBendChange(0); } }}
          onMouseMove={(e) => { if (pitchDragRef.current) handleWheelDrag(e, 'pitch'); }}
        >
          <span className="ep-wheel-label">PITCH</span>
          <div className="ep-wheel-track">
            <div
              className={`ep-wheel-led ${pitchDragRef.current ? 'ep-wheel-led--active' : ''}`}
              style={{ height: pitchLedHeight }}
            />
            <motion.div
              className="ep-wheel-thumb"
              animate={{ y: `${(0.5 - pitchBend / 2) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
            <div className="ep-wheel-center-line" />
          </div>
          <span className="ep-wheel-value">
            {pitchBend > 0 ? '+' : ''}{(pitchBend * 24).toFixed(0)} ST
          </span>
        </div>

        <div
          className="ep-wheel-container"
          onMouseDown={() => { modDragRef.current = true; }}
          onMouseUp={() => { modDragRef.current = false; }}
          onMouseLeave={() => { modDragRef.current = false; }}
          onMouseMove={(e) => { if (modDragRef.current) handleWheelDrag(e, 'mod'); }}
        >
          <span className="ep-wheel-label">MOD</span>
          <div className="ep-wheel-track">
            <div
              className={`ep-wheel-led ${modDragRef.current ? 'ep-wheel-led--active' : ''}`}
              style={{ height: modLedHeight }}
            />
            <motion.div
              className="ep-wheel-thumb ep-wheel-thumb--mod"
              animate={{ y: `${(1 - modWheel / 127) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
          <span className="ep-wheel-value">{modWheel}</span>
        </div>
      </div>

      {/* ── Piano Keys ── */}
      <div className="ep-keyboard-keys" ref={keysContainerRef}>
        {/* Lightning Arc Canvas */}
        <canvas className="ep-arc-canvas" ref={canvasRef} />

        {/* Velocity Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="ep-particle"
            style={{
              left: p.x,
              top: p.y,
              '--px': `${p.px}px`,
              '--py': `${p.py}px`,
            } as React.CSSProperties}
          />
        ))}

        {/* White Keys */}
        <div className="ep-keyboard-whites">
          {WHITE_KEYS.map((key) => {
            const isActive = activeNotes.has(key.midi);
            return (
              <button
                key={key.midi}
                ref={(el) => { if (el) keyRefsMap.current.set(key.midi, el); }}
                className={`ep-key ep-key--white ${isActive ? 'ep-key--active' : ''}`}
                style={{ width: `${whiteKeyWidth}%` }}
                onMouseDown={(e) => handleKeyDown(key.midi, e)}
                onMouseUp={() => handleKeyUp(key.midi)}
                onMouseLeave={() => { if (mouseActiveNotes.has(key.midi)) handleKeyUp(key.midi); }}
                aria-label={key.name}
              >
                {/* Plasma Underglow */}
                <div className="ep-key-plasma" />

                <span className="ep-key-label">{key.name}</span>
                {isActive && (
                  <motion.div
                    className="ep-key-glow"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ backgroundColor: 'transparent' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Black Keys */}
        <div className="ep-keyboard-blacks">
          {BLACK_KEYS.map((key) => {
            const isActive = activeNotes.has(key.midi);
            const xPos = getBlackKeyPosition(key.midi, WHITE_KEYS);
            return (
              <button
                key={key.midi}
                ref={(el) => { if (el) keyRefsMap.current.set(key.midi, el); }}
                className={`ep-key ep-key--black ${isActive ? 'ep-key--active' : ''}`}
                style={{
                  left: `${(xPos / WHITE_KEYS.length) * 100}%`,
                  width: `${whiteKeyWidth * 0.6}%`,
                }}
                onMouseDown={(e) => handleKeyDown(key.midi, e)}
                onMouseUp={() => handleKeyUp(key.midi)}
                onMouseLeave={() => { if (mouseActiveNotes.has(key.midi)) handleKeyUp(key.midi); }}
                aria-label={key.name}
              >
                {/* Plasma Underglow */}
                <div className="ep-key-plasma" />

                {isActive && (
                  <motion.div
                    className="ep-key-glow ep-key-glow--black"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ backgroundColor: 'transparent' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right Controls ── */}
      <div className="ep-keyboard-controls">
        {/* Voice Mode Selector */}
        <div className="ep-voice-mode">
          <span className="ep-voice-mode-label">VOICE</span>
          {(['POLY', 'MONO', 'LEGATO'] as VoiceMode[]).map((mode) => (
            <button
              key={mode}
              className={`ep-voice-mode-btn ${voiceMode === mode ? 'active' : ''}`}
              onClick={() => { setVoiceMode(mode); onVoiceModeChange?.(mode); }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Octave Controls */}
        <div className="ep-octave-display">
          <button
            className="ep-octave-btn"
            onClick={onOctaveDown}
            disabled={currentOctave <= 1}
            title="Octave Down (Z)"
          >
            ▼
          </button>
          <div className="ep-octave-info">
            <span className="ep-octave-label">C{currentOctave}</span>
            <span className="ep-octave-range">OCT {currentOctave}</span>
          </div>
          <button
            className="ep-octave-btn"
            onClick={onOctaveUp}
            disabled={currentOctave >= 7}
            title="Octave Up (X)"
          >
            ▲
          </button>
        </div>

        {/* QWERTY Indicator */}
        <div className="ep-qwerty-badge">
          <span className="ep-qwerty-badge-icon">⌨</span>
          <span className="ep-qwerty-badge-label">QWERTY</span>
        </div>
      </div>
    </div>
  );
};
