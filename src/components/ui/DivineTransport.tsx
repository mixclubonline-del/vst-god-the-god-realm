/**
 * DivineTransport — Floating Global Transport for The God Realm
 * A contextual, realm-aware transport bar that morphs its appearance
 * based on the active section. Beat-synced pulse, glassmorphism, sacred geometry.
 *
 * Phase 4: Drag-to-reposition, edge snapping, keyboard shortcut hints.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '@/styles/DivineTransport.css';

/* ─── Types ─── */
export interface DivineTransportProps {
  /* Core transport state */
  isPlaying: boolean;
  isRecording: boolean;
  bpm: number;
  currentStep: number;
  totalSteps: number;
  activePattern: 'A' | 'B';

  /* Handlers */
  onPlay: () => void;
  onStop: () => void;
  onTogglePlay: () => void;
  onToggleRecord: () => void;
  onSetBpm: (bpm: number) => void;

  /* Pattern switching */
  onSetPattern?: (pattern: 'A' | 'B') => void;

  /* Context */
  activeRealm: string;

  /* Optional */
  metronomeOn?: boolean;
  onToggleMetronome?: () => void;

  /* Context-specific data from parent */
  contextData?: TransportContextData;

  /* Children slot for parent-injected realm-specific widgets */
  children?: React.ReactNode;
}

/* Context data that parents can pass for realm-specific displays */
export interface TransportContextData {
  /* Sequencer realm */
  swing?: number;
  stepCount?: number;
  selectedTrackName?: string;
  isFillMode?: boolean;

  /* Export realm */
  exportProgress?: number;
  exportStatus?: string;

  /* Mastering / Forge */
  masteringBypass?: boolean;

  /* Archive */
  sampleCount?: number;

  /* Generic status text */
  statusText?: string;
}

/* ─── Realm Configuration ─── */
interface RealmConfig {
  accent: string;
  icon: string;
  label: string;
}

const REALM_CONFIG: Record<string, RealmConfig> = {
  'Multi-Realm':       { accent: '#FFD700', icon: '🔱', label: 'MULTI-REALM' },
  'Pantheon':          { accent: '#9B59B6', icon: '⚡', label: 'PANTHEON' },
  'Harmonic Pantheon': { accent: '#9B59B6', icon: '⚡', label: 'PANTHEON' },
  'Sample Chopper':    { accent: '#FF6B35', icon: '🔪', label: 'CHOPPER' },
  'Divine Archive':    { accent: '#00BCD4', icon: '📜', label: 'ARCHIVE' },
  'Sequencer':         { accent: '#FF8C00', icon: '🎵', label: 'SEQUENCER' },
  'Mastering':         { accent: '#FFEAA7', icon: '🔨', label: 'FORGE' },
  'Export':            { accent: '#2ECC71', icon: '⚗️', label: 'EXPORT' },
  'Preset Vault':      { accent: '#BDC3C7', icon: '📦', label: 'VAULT' },
  'Electric Pantheon': { accent: '#3498DB', icon: '⚡', label: 'ELECTRIC' },
};

const DEFAULT_REALM: RealmConfig = { accent: '#FFD700', icon: '🔱', label: 'GOD REALM' };

/* ─── Transport Position (Drag-to-Reposition) ─── */
export type TransportAnchor =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'top-left'
  | 'top-right';

const STORAGE_KEY = 'divine-transport-anchor';
const HINT_KEY = 'divine-transport-hint-seen';

const loadAnchor = (): TransportAnchor => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && ['bottom-center','bottom-left','bottom-right','top-center','top-left','top-right'].includes(v)) {
      return v as TransportAnchor;
    }
  } catch { /* noop */ }
  return 'bottom-center';
};

const saveAnchor = (a: TransportAnchor) => {
  try { localStorage.setItem(STORAGE_KEY, a); } catch { /* noop */ }
};

const wasHintSeen = (): boolean => {
  try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return true; }
};

const markHintSeen = () => {
  try { localStorage.setItem(HINT_KEY, '1'); } catch { /* noop */ }
};

/** Determine anchor based on where the element was dropped */
const resolveAnchor = (x: number, y: number): TransportAnchor => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isTop = y < vh / 2;
  const xThird = vw / 3;
  const xPos = x < xThird ? 'left' : x > xThird * 2 ? 'right' : 'center';
  return `${isTop ? 'top' : 'bottom'}-${xPos}` as TransportAnchor;
};

/** CSS position object for a given anchor */
const anchorStyles = (anchor: TransportAnchor): React.CSSProperties => {
  const base: React.CSSProperties = { position: 'fixed', zIndex: 1000 };
  switch (anchor) {
    case 'bottom-center': return { ...base, bottom: 24, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-left':   return { ...base, bottom: 24, left: 24 };
    case 'bottom-right':  return { ...base, bottom: 24, right: 24 };
    case 'top-center':    return { ...base, top: 24, left: '50%', transform: 'translateX(-50%)' };
    case 'top-left':      return { ...base, top: 24, left: 24 };
    case 'top-right':     return { ...base, top: 24, right: 24 };
  }
};

/* ─── SVG Icons ─── */
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <polygon points="3.5,1.5 12.5,7 3.5,12.5" fill="currentColor" />
  </svg>
);

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="currentColor" />
  </svg>
);

const PauseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="2" y="1.5" width="3" height="9" rx="0.75" fill="currentColor" />
    <rect x="7" y="1.5" width="3" height="9" rx="0.75" fill="currentColor" />
  </svg>
);

const RecIcon = ({ active }: { active: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle
      cx="7" cy="7" r="4.5"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const MetronomeIcon = () => (
  <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
    <path d="M2 13L5 1h2l3 12H2z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
    <line x1="6" y1="5" x2="10" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const ChevronIcon = ({ flipped }: { flipped?: boolean }) => (
  <svg
    width="10" height="10" viewBox="0 0 10 10" fill="none"
    style={{ transform: flipped ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
  >
    <polyline points="3,2 7,5 3,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─── Context-Specific Realm Controls ─── */
const RealmContextControls: React.FC<{
  realm: string;
  data?: TransportContextData;
  activePattern: 'A' | 'B';
  onSetPattern?: (p: 'A' | 'B') => void;
  isFillMode?: boolean;
}> = ({ realm, data, activePattern, onSetPattern, isFillMode }) => {
  // Sequencer realm: show pattern A/B toggle + swing + fill indicator
  if (realm === 'Sequencer' && onSetPattern) {
    return (
      <div className="divine-transport__context">
        <div className="divine-transport__context-patterns">
          <button
            className={`divine-transport__context-pat ${activePattern === 'A' ? 'divine-transport__context-pat--active' : ''}`}
            onClick={() => onSetPattern('A')}
            title="Pattern A"
          >A</button>
          <button
            className={`divine-transport__context-pat ${activePattern === 'B' ? 'divine-transport__context-pat--active' : ''}`}
            onClick={() => onSetPattern('B')}
            title="Pattern B"
          >B</button>
        </div>
        {data?.swing !== undefined && data.swing > 0 && (
          <span className="divine-transport__context-tag">SW {data.swing}%</span>
        )}
        {isFillMode && (
          <span className="divine-transport__context-tag divine-transport__context-tag--fill">FILL</span>
        )}
        {data?.selectedTrackName && (
          <span className="divine-transport__context-tag divine-transport__context-tag--track">
            {data.selectedTrackName}
          </span>
        )}
      </div>
    );
  }

  // Export realm: show progress bar
  if (realm === 'Export' && data?.exportProgress !== undefined) {
    return (
      <div className="divine-transport__context">
        <div className="divine-transport__context-progress">
          <div
            className="divine-transport__context-progress-bar"
            style={{ width: `${Math.round(data.exportProgress * 100)}%` }}
          />
        </div>
        <span className="divine-transport__context-tag">
          {data.exportStatus || `${Math.round(data.exportProgress * 100)}%`}
        </span>
      </div>
    );
  }

  // Mastering realm: bypass indicator
  if (realm === 'Mastering' && data?.masteringBypass !== undefined) {
    return (
      <div className="divine-transport__context">
        <span className={`divine-transport__context-tag ${data.masteringBypass ? 'divine-transport__context-tag--warn' : ''}`}>
          {data.masteringBypass ? 'BYPASSED' : 'ACTIVE'}
        </span>
      </div>
    );
  }

  // Archive realm: sample count
  if (realm === 'Divine Archive' && data?.sampleCount !== undefined) {
    return (
      <div className="divine-transport__context">
        <span className="divine-transport__context-tag">{data.sampleCount} SAMPLES</span>
      </div>
    );
  }

  // Generic status text fallback
  if (data?.statusText) {
    return (
      <div className="divine-transport__context">
        <span className="divine-transport__context-tag">{data.statusText}</span>
      </div>
    );
  }

  return null;
};

/* ─── Component ─── */
export const DivineTransport: React.FC<DivineTransportProps> = ({
  isPlaying,
  isRecording,
  bpm,
  currentStep,
  totalSteps,
  activePattern,
  onPlay,
  onStop,
  onTogglePlay,
  onToggleRecord,
  onSetBpm,
  onSetPattern,
  activeRealm,
  metronomeOn,
  onToggleMetronome,
  contextData,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const bpmInputRef = useRef<HTMLInputElement>(null);
  const bpmDragRef = useRef({ isDragging: false, startY: 0, startBpm: 0 });
  const tapTimesRef = useRef<number[]>([]);

  /* ─── Drag-to-Reposition ─── */
  const [anchor, setAnchor] = useState<TransportAnchor>(loadAnchor);
  const [isDraggingTransport, setIsDraggingTransport] = useState(false);
  const transportRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });

  const handleTransportDragStart = useCallback((e: React.PointerEvent) => {
    // Only start drag from the grip area (data-drag-handle)
    if (!(e.target as HTMLElement).closest('[data-drag-handle]')) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = transportRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left - rect.width / 2,
      offsetY: e.clientY - rect.top - rect.height / 2,
    };
    setIsDraggingTransport(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleTransportDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.active || !transportRef.current) return;
    e.stopPropagation();
    const el = transportRef.current;
    // Free-move positioning while dragging
    el.style.position = 'fixed';
    el.style.left = `${e.clientX - dragState.current.offsetX}px`;
    el.style.top = `${e.clientY - dragState.current.offsetY}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.transform = 'translate(-50%, -50%)';
  }, []);

  const handleTransportDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    setIsDraggingTransport(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    // Snap to nearest edge anchor
    const newAnchor = resolveAnchor(e.clientX, e.clientY);
    setAnchor(newAnchor);
    saveAnchor(newAnchor);
    // Clear inline styles so CSS anchor takes over
    if (transportRef.current) {
      transportRef.current.style.left = '';
      transportRef.current.style.top = '';
      transportRef.current.style.right = '';
      transportRef.current.style.bottom = '';
      transportRef.current.style.transform = '';
      transportRef.current.style.position = '';
    }
  }, []);

  /* ─── Keyboard Shortcut Hint ─── */
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!wasHintSeen()) {
      const timer = setTimeout(() => setShowHint(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    markHintSeen();
  }, []);

  /* ─── Realm config ─── */
  const realmConfig = REALM_CONFIG[activeRealm] || DEFAULT_REALM;
  const beatDuration = 60 / Math.max(20, bpm);

  /* ─── BPM Handlers ─── */
  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 4) tapTimesRef.current.shift();
    if (tapTimesRef.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avg);
      onSetBpm(Math.max(20, Math.min(300, newBpm)));
    }
    // Reset if gap > 2s
    setTimeout(() => {
      if (
        tapTimesRef.current.length > 0 &&
        performance.now() - tapTimesRef.current[tapTimesRef.current.length - 1] > 2000
      ) {
        tapTimesRef.current = [];
      }
    }, 2100);
  }, [onSetBpm]);

  const handleBpmDoubleClick = useCallback(() => {
    setIsEditingBpm(true);
    requestAnimationFrame(() => bpmInputRef.current?.select());
  }, []);

  const handleBpmSubmit = useCallback(() => {
    setIsEditingBpm(false);
    if (bpmInputRef.current) {
      const val = parseFloat(bpmInputRef.current.value);
      if (!isNaN(val)) onSetBpm(Math.max(20, Math.min(300, val)));
    }
  }, [onSetBpm]);

  const handleBpmWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      const step = e.shiftKey ? 10 : 1;
      onSetBpm(Math.max(20, Math.min(300, bpm + delta * step)));
    },
    [onSetBpm, bpm]
  );

  const handleBpmDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (isEditingBpm) return;
      e.preventDefault();
      e.stopPropagation();
      bpmDragRef.current = { isDragging: true, startY: e.clientY, startBpm: bpm };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isEditingBpm, bpm]
  );

  const handleBpmDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!bpmDragRef.current.isDragging) return;
      e.stopPropagation();
      const delta = bpmDragRef.current.startY - e.clientY;
      const sensitivity = e.shiftKey ? 0.5 : 0.2;
      const newBpm = Math.round(bpmDragRef.current.startBpm + delta * sensitivity);
      onSetBpm(Math.max(20, Math.min(300, newBpm)));
    },
    [onSetBpm]
  );

  const handleBpmDragEnd = useCallback((e: React.PointerEvent) => {
    bpmDragRef.current.isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  /* ─── CSS Classes ─── */
  const containerClasses = [
    'divine-transport',
    isPlaying && 'divine-transport--playing',
    isRecording && 'divine-transport--recording',
    isCollapsed && 'divine-transport--collapsed',
    isDraggingTransport && 'divine-transport--dragging',
    `divine-transport--${anchor}`,
  ]
    .filter(Boolean)
    .join(' ');

  /* ─── Step Display ─── */
  const stepDisplay =
    isPlaying && currentStep >= 0
      ? `${String(currentStep + 1).padStart(2, '0')} / ${totalSteps}`
      : `-- / ${totalSteps}`;

  return (
    <>
    <motion.div
      ref={transportRef}
      className={containerClasses}
      style={{
        ...anchorStyles(anchor),
        '--transport-accent': realmConfig.accent,
        '--beat-duration': `${beatDuration}s`,
      } as React.CSSProperties}
      initial={{ y: anchor.startsWith('top') ? -40 : 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.3 }}
      onPointerDown={handleTransportDragStart}
      onPointerMove={handleTransportDragMove}
      onPointerUp={handleTransportDragEnd}
    >
      {/* ═══ Drag Grip ═══ */}
      <div
        className="divine-transport__grip"
        data-drag-handle
        title="Drag to reposition"
      >
        <span className="divine-transport__grip-dots">
          <span /><span /><span />
          <span /><span /><span />
        </span>
      </div>

      {/* ═══ Transport Core ═══ */}
      <div className="divine-transport__core">
        {/* Stop */}
        <button
          className="divine-transport__btn divine-transport__btn--stop"
          onClick={onStop}
          title="Stop"
        >
          <StopIcon />
        </button>

        {/* Play / Pause */}
        <button
          className={`divine-transport__btn divine-transport__btn--play ${
            isPlaying ? 'divine-transport__btn--active' : ''
          }`}
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Record */}
        <button
          className={`divine-transport__btn divine-transport__btn--rec ${
            isRecording ? 'divine-transport__btn--active' : ''
          }`}
          onClick={onToggleRecord}
          title={isRecording ? 'Disarm Record (R)' : 'Arm Record (R)'}
        >
          <RecIcon active={isRecording} />
        </button>
      </div>

      <div className="divine-transport__divider" />

      {/* ═══ BPM Display ═══ */}
      <div className="divine-transport__tempo">
        <div
          className="divine-transport__bpm-group"
          onDoubleClick={handleBpmDoubleClick}
          onWheel={handleBpmWheel}
          onPointerDown={handleBpmDragStart}
          onPointerMove={handleBpmDragMove}
          onPointerUp={handleBpmDragEnd}
          title="BPM — Scroll or drag to adjust, double-click to type"
        >
          {isEditingBpm ? (
            <input
              ref={bpmInputRef}
              className="divine-transport__bpm-input"
              type="number"
              defaultValue={bpm}
              onBlur={handleBpmSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleBpmSubmit()}
              autoFocus
            />
          ) : (
            <>
              <span className="divine-transport__bpm-value">{bpm}</span>
              <span className="divine-transport__bpm-label">BPM</span>
            </>
          )}
        </div>
        <button className="divine-transport__tap" onClick={handleTapTempo} title="Tap Tempo">
          TAP
        </button>
      </div>

      <div className="divine-transport__divider" />

      {/* ═══ Position Display ═══ */}
      <div className="divine-transport__position">
        <span className="divine-transport__step-display">
          STEP{' '}
          <span className="divine-transport__step-current">{stepDisplay}</span>
        </span>
        <span
          className={`divine-transport__pattern-badge divine-transport__pattern-badge--${activePattern.toLowerCase()}`}
        >
          {activePattern}
        </span>
      </div>

      <div className="divine-transport__divider" />

      {/* ═══ Realm Badge ═══ */}
      <div className="divine-transport__realm-section">
        <div className="divine-transport__realm">
          <span className="divine-transport__realm-icon">{realmConfig.icon}</span>
          {realmConfig.label}
        </div>
      </div>

      {/* ═══ Context-Specific Controls ═══ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeRealm}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.15 }}
        >
          <RealmContextControls
            realm={activeRealm}
            data={contextData}
            activePattern={activePattern}
            onSetPattern={onSetPattern}
            isFillMode={contextData?.isFillMode}
          />
        </motion.div>
      </AnimatePresence>

      {/* ═══ Injected children from parent ═══ */}
      {children}

      {/* ═══ Metronome ═══ */}
      {onToggleMetronome && (
        <>
          <div className="divine-transport__divider" />
          <button
            className={`divine-transport__btn divine-transport__btn--metronome ${
              metronomeOn ? 'divine-transport__btn--metronome-active' : ''
            }`}
            onClick={onToggleMetronome}
            title={metronomeOn ? 'Metronome OFF (click track)' : 'Metronome ON (click track)'}
          >
            <MetronomeIcon />
          </button>
        </>
      )}

      {/* ═══ Status LED ═══ */}
      <div className="divine-transport__status">
        <div
          className={`divine-transport__status-led ${
            !isPlaying ? 'divine-transport__status-led--idle' : ''
          }`}
          title={isPlaying ? 'Engine Active' : 'Engine Idle'}
        />
      </div>

      {/* ═══ Collapse Toggle ═══ */}
      <button
        className="divine-transport__collapse"
        onClick={() => setIsCollapsed((prev) => !prev)}
        title={isCollapsed ? 'Expand Transport' : 'Collapse Transport'}
      >
        <ChevronIcon flipped={isCollapsed} />
      </button>
    </motion.div>

    {/* ═══ Keyboard Shortcut Hint ═══ */}
    <AnimatePresence>
      {showHint && (
        <motion.div
          className="divine-transport-hint"
          style={{
            ...(anchor.startsWith('top')
              ? { top: 80 }
              : { bottom: 80 }),
            left: '50%',
            transform: 'translateX(-50%)',
          }}
          initial={{ opacity: 0, y: anchor.startsWith('top') ? -10 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: anchor.startsWith('top') ? -10 : 10 }}
          transition={{ duration: 0.3 }}
          onClick={dismissHint}
        >
          <div className="divine-transport-hint__content">
            <span className="divine-transport-hint__key">Space</span>
            <span className="divine-transport-hint__label">Play / Stop</span>
            <span className="divine-transport-hint__sep">·</span>
            <span className="divine-transport-hint__key">R</span>
            <span className="divine-transport-hint__label">Record</span>
            <span className="divine-transport-hint__sep">·</span>
            <span className="divine-transport-hint__label divine-transport-hint__label--dim">Drag grip to reposition</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default DivineTransport;
