/**
 * useKeyboardPads — QWERTY Keyboard → Pad Triggering
 *
 * Maps computer keyboard keys to the 16-pad grid using the classic MPC layout:
 *   Row 1 (pads 13-16): 1  2  3  4
 *   Row 2 (pads  9-12): Q  W  E  R
 *   Row 3 (pads  5-8):  A  S  D  F
 *   Row 4 (pads  1-4):  Z  X  C  V
 *
 * This mirrors the bottom-up layout of a physical MPC where the bottom row
 * is pads 1-4, matching the Astral Dais grid read top-to-bottom but played
 * bottom-to-top on a keyboard.
 *
 * Emits 'throne-trigger' CustomEvent for visual flash + sets activePad.
 */
import { useEffect, useRef, useCallback } from 'react';
import type { GodRealmSamplerEngine } from '../services/samplerEngine';

// MPC-style bottom-up layout — keyboard bottom row = pads 1-4
const QWERTY_MAP: Record<string, number> = {
  // Bottom row → Pads 1-4 (Throne 0-3)
  KeyZ: 0,  KeyX: 1,  KeyC: 2,  KeyV: 3,
  // Third row → Pads 5-8 (Throne 4-7)
  KeyA: 4,  KeyS: 5,  KeyD: 6,  KeyF: 7,
  // Second row → Pads 9-12 (Throne 8-11)
  KeyQ: 8,  KeyW: 9,  KeyE: 10, KeyR: 11,
  // Top row → Pads 13-16 (Throne 12-15)
  Digit1: 12, Digit2: 13, Digit3: 14, Digit4: 15,
};

// Input elements that should block pad triggering
const BLOCKED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export interface KeyboardPadState {
  /** Currently held keys (pad indices) */
  heldPads: Set<number>;
  /** Whether keyboard input is active */
  isActive: boolean;
  /** Last triggered pad index */
  lastPad: number | null;
}

export function useKeyboardPads(
  godEngine: React.MutableRefObject<GodRealmSamplerEngine | null>,
  onPadTrigger?: (padIndex: number) => void,
): KeyboardPadState {
  const heldPadsRef = useRef<Set<number>>(new Set());
  const isActiveRef = useRef(false);
  const lastPadRef = useRef<number | null>(null);
  // Force re-render state
  const stateRef = useRef<KeyboardPadState>({
    heldPads: new Set(),
    isActive: false,
    lastPad: null,
  });

  const triggerPad = useCallback((padIndex: number) => {
    if (!godEngine.current) return;

    // Play the buffer
    godEngine.current.playBufferPart(padIndex, 0);

    // Emit throne-trigger for visual flash
    window.dispatchEvent(new CustomEvent('throne-trigger', {
      detail: { padIndex },
    }));

    // Notify parent
    onPadTrigger?.(padIndex);

    lastPadRef.current = padIndex;
    isActiveRef.current = true;
  }, [godEngine, onPadTrigger]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in form fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (BLOCKED_TAGS.has(tag)) return;

      // Check if this key maps to a pad
      const padIndex = QWERTY_MAP[e.code];
      if (padIndex === undefined) return;

      // Prevent repeat triggers from key hold
      if (e.repeat) return;

      e.preventDefault();

      // Track held state
      heldPadsRef.current.add(padIndex);

      // Trigger playback
      triggerPad(padIndex);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const padIndex = QWERTY_MAP[e.code];
      if (padIndex === undefined) return;

      heldPadsRef.current.delete(padIndex);

      if (heldPadsRef.current.size === 0) {
        isActiveRef.current = false;
      }
    };

    // Blur handler — release all held pads if window loses focus
    const handleBlur = () => {
      heldPadsRef.current.clear();
      isActiveRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [triggerPad]);

  return stateRef.current;
}

/** Exported map for UI display (NerveMonitor key labels) */
export const QWERTY_PAD_MAP = QWERTY_MAP;

/** Reverse map: pad index → key label */
export const PAD_KEY_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(QWERTY_MAP).map(([code, pad]) => [
    pad,
    code.replace('Key', '').replace('Digit', ''),
  ])
);
