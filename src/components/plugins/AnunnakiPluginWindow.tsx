/**
 * AnunnakiPluginWindow.tsx — Insert FX Plugin Window Shell
 * ═══════════════════════════════════════════════════════════
 * Draggable, resizable, z-indexed container for ALL Anunnaki
 * insert-effect plugins. Pointer-capture drag, 8-handle resize,
 * bypass overlay, track indicator, and premium window chrome.
 *
 * This is the FX counterpart to FloatingPluginWindow (instruments).
 * Every Anunnaki insert plugin (Veil, Throne, Nebula, etc.)
 * renders its UI as a child of this container.
 *
 * Design: Forged Obsidian × Midnight Ember
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './AnunnakiPluginWindow.css';

/* ═══ Z-Index Management ════════════════════════ */
let globalZCounter = 500;
const getNextZ = () => ++globalZCounter;

/* ═══ Position offset for cascading new windows ═ */
let windowOpenCount = 0;

/* ═══ Types ═════════════════════════════════════ */

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface ResizeState {
  active: boolean;
  dir: ResizeDir;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originW: number;
  originH: number;
}

/* ═══ Props ═════════════════════════════════════ */

export interface AnunnakiPluginWindowProps {
  /** Unique window ID */
  id: string;
  /** Plugin name e.g. "ANUNNAKI VEIL" */
  title: string;
  /** Emoji or icon (default: cuneiform DINGIR 𒀭) */
  icon?: string;
  /** Default width in px */
  width?: number;
  /** Default height in px */
  height?: number;
  /** Minimum resize width */
  minWidth?: number;
  /** Minimum resize height */
  minHeight?: number;
  /** Which mixer track this belongs to */
  trackIndex: number;
  /** Which insert slot (0-3) */
  slotIndex: number;
  /** Track's accent color */
  trackColor?: string;
  /** Close callback */
  onClose: () => void;
  /** Bypass toggle callback */
  onBypass?: (bypassed: boolean) => void;
  /** Current bypass state */
  bypassed?: boolean;
  /** The plugin UI content */
  children: React.ReactNode;
}

/* ═══ Component ═════════════════════════════════ */

export const AnunnakiPluginWindow: React.FC<AnunnakiPluginWindowProps> = ({
  id,
  title,
  icon = '𒀭',
  width: defaultWidth = 520,
  height: defaultHeight = 480,
  minWidth = 360,
  minHeight = 300,
  trackIndex,
  slotIndex,
  trackColor = '#d4a853',
  onClose,
  onBypass,
  bypassed = false,
  children,
}) => {
  /* ── Position & Size state ── */
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -1, y: -1 });
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight });
  const [zIndex, setZIndex] = useState(() => getNextZ());
  const [isFocused, setIsFocused] = useState(true);

  /* ── Refs for drag/resize (mutable, no re-render) ── */
  const dragRef = useRef<DragState>({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const resizeRef = useRef<ResizeState>({
    active: false,
    dir: 'se',
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    originW: 0,
    originH: 0,
  });

  const windowRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  /* ═══════════════════════════════════════════════
     INITIAL CENTERING
     ═══════════════════════════════════════════════ */
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cascade = (windowOpenCount++ % 6) * 28;

    const cx = Math.max(20, Math.round((vw - defaultWidth) / 2) + cascade);
    const cy = Math.max(20, Math.round((vh - defaultHeight) / 2) + cascade);

    setPos({ x: cx, y: cy });
  }, [defaultWidth, defaultHeight]);

  /* ═══════════════════════════════════════════════
     Z-INDEX — Bring to front
     ═══════════════════════════════════════════════ */
  const bringToFront = useCallback(() => {
    const z = getNextZ();
    setZIndex(z);
    setIsFocused(true);
  }, []);

  /* ═══════════════════════════════════════════════
     CLAMP — Keep within viewport bounds
     ═══════════════════════════════════════════════ */
  const clampPosition = useCallback(
    (x: number, y: number, w: number, _h: number) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        x: Math.max(0, Math.min(vw - Math.min(w, 100), x)),
        y: Math.max(0, Math.min(vh - 40, y)),
      };
    },
    []
  );

  /* ═══════════════════════════════════════════════
     DRAG — Title bar pointer-capture
     ═══════════════════════════════════════════════ */
  const onDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Don't start drag on buttons inside titlebar
      if ((e.target as HTMLElement).closest('button')) return;

      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };

      bringToFront();
    },
    [pos.x, pos.y, bringToFront]
  );

  const onDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.active) return;

      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      const newX = dragRef.current.originX + dx;
      const newY = dragRef.current.originY + dy;

      const clamped = clampPosition(newX, newY, size.w, size.h);
      setPos(clamped);
    },
    [size.w, size.h, clampPosition]
  );

  const onDragPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current.active = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  /* ═══════════════════════════════════════════════
     RESIZE — Edge/corner pointer-capture
     ═══════════════════════════════════════════════ */
  const onResizePointerDown = useCallback(
    (dir: ResizeDir) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      resizeRef.current = {
        active: true,
        dir,
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
        originW: size.w,
        originH: size.h,
      };

      bringToFront();
    },
    [pos.x, pos.y, size.w, size.h, bringToFront]
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const r = resizeRef.current;
      if (!r.active) return;

      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      const { dir, originX, originY, originW, originH } = r;

      let newX = originX;
      let newY = originY;
      let newW = originW;
      let newH = originH;

      // East edge
      if (dir === 'e' || dir === 'ne' || dir === 'se') {
        newW = Math.max(minWidth, originW + dx);
      }
      // West edge
      if (dir === 'w' || dir === 'nw' || dir === 'sw') {
        const dw = Math.min(dx, originW - minWidth);
        newW = originW - dw;
        newX = originX + dw;
      }
      // South edge
      if (dir === 's' || dir === 'se' || dir === 'sw') {
        newH = Math.max(minHeight, originH + dy);
      }
      // North edge
      if (dir === 'n' || dir === 'ne' || dir === 'nw') {
        const dh = Math.min(dy, originH - minHeight);
        newH = originH - dh;
        newY = originY + dh;
      }

      setSize({ w: newW, h: newH });
      setPos(clampPosition(newX, newY, newW, newH));
    },
    [minWidth, minHeight, clampPosition]
  );

  const onResizePointerUp = useCallback((e: React.PointerEvent) => {
    resizeRef.current.active = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  /* ── Window pointerdown → focus ── */
  const onWindowPointerDown = useCallback(() => {
    bringToFront();
  }, [bringToFront]);

  /* ── Bypass toggle ── */
  const toggleBypass = useCallback(() => {
    onBypass?.(!bypassed);
  }, [onBypass, bypassed]);

  /* ── Build resize handles ── */
  const RESIZE_DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  const renderResizeHandle = (dir: ResizeDir) => (
    <div
      key={dir}
      className={`aw-resize-handle aw-resize-handle--${dir}`}
      onPointerDown={onResizePointerDown(dir)}
      onPointerMove={onResizePointerMove}
      onPointerUp={onResizePointerUp}
    />
  );

  /* ── Don't render until position is computed ── */
  if (pos.x < 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={windowRef}
        key={id}
        className={`anunnaki-window ${
          isFocused ? 'anunnaki-window--focused' : 'anunnaki-window--blurred'
        }`}
        style={{
          left: pos.x,
          top: pos.y,
          width: size.w,
          height: size.h,
          zIndex,
          '--track-accent': trackColor,
        } as React.CSSProperties}
        /* ── Entry / Exit animations ── */
        initial={{ opacity: 0, scale: 0.88, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 20 }}
        transition={{
          type: 'spring',
          stiffness: 350,
          damping: 28,
          mass: 0.8,
        }}
        onPointerDown={onWindowPointerDown}
      >
        {/* ── Resize Handles ── */}
        {RESIZE_DIRS.map(renderResizeHandle)}

        {/* ══════════════════════════════════════════
            TITLE BAR
            ══════════════════════════════════════════ */}
        <div
          className="aw-titlebar"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
        >
          {/* Branding Icon */}
          <span className="aw-titlebar__icon">{icon}</span>

          {/* Plugin Name */}
          <span className="aw-titlebar__name">{title}</span>

          {/* Track Indicator */}
          <div className="aw-titlebar__track">
            <div
              className="aw-titlebar__track-dot"
              style={{ background: trackColor, boxShadow: `0 0 6px ${trackColor}` }}
            />
            <span className="aw-titlebar__track-num">TRK {trackIndex + 1}</span>
          </div>

          {/* Bypass Toggle */}
          {onBypass && (
            <motion.button
              className={`aw-titlebar__bypass ${
                bypassed ? 'aw-titlebar__bypass--bypassed' : 'aw-titlebar__bypass--active'
              }`}
              onClick={toggleBypass}
              title={bypassed ? 'Enable plugin' : 'Bypass plugin'}
              whileTap={{ scale: 0.85 }}
            >
              ⏻
            </motion.button>
          )}

          {/* Close Button */}
          <motion.button
            className="aw-titlebar__close"
            onClick={onClose}
            title="Close plugin"
            whileTap={{ scale: 0.8 }}
            whileHover={{ scale: 1.15 }}
          >
            ✕
          </motion.button>
        </div>

        {/* ══════════════════════════════════════════
            CONTENT AREA
            ══════════════════════════════════════════ */}
        <div className="aw-content">
          {/* Corner accent sacred geometry markers (⌝ top-right, ⌞ bottom-left) */}
          <span className="aw-content__corner aw-content__corner--tr" aria-hidden="true">⌝</span>
          <span className="aw-content__corner aw-content__corner--bl" aria-hidden="true">⌞</span>

          {children}

          {/* ── Bypass Overlay ── */}
          <AnimatePresence>
            {bypassed && (
              <motion.div
                className="aw-bypass-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <motion.span
                  className="aw-bypass-overlay__text"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.1, duration: 0.25 }}
                >
                  BYPASSED
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ══════════════════════════════════════════
            BOTTOM BAR — Slot indicator + branding
            ══════════════════════════════════════════ */}
        <div className="aw-bottom-bar">
          <span className="aw-bottom-bar__slot">
            {/* Active pulse dot */}
            <span
              className={`aw-bottom-bar__pulse ${
                bypassed ? 'aw-bottom-bar__pulse--bypassed' : 'aw-bottom-bar__pulse--active'
              }`}
              aria-hidden="true"
            />
            SLOT {slotIndex + 1} · INSERT
          </span>
          <span className="aw-bottom-bar__brand">ANUNNAKI</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AnunnakiPluginWindow;
