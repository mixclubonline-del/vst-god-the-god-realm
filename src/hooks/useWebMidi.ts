/**
 * useWebMidi — Web MIDI API → Pad Triggering
 *
 * Connects to all available MIDI input devices and routes note-on/off
 * messages to the pad grid via the configurable midiMap.
 *
 * Auto-detects device connect/disconnect.
 * Falls back gracefully when Web MIDI is unavailable (e.g. Firefox, HTTP).
 *
 * FIX: Uses refs for message handler + device state to break the
 *      setState → re-render → new callback → effect re-run → infinite loop.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { GodRealmSamplerEngine } from '../services/samplerEngine';

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export interface WebMidiState {
  /** Whether Web MIDI API is supported */
  isSupported: boolean;
  /** Whether MIDI access was granted */
  isConnected: boolean;
  /** List of detected MIDI input devices */
  devices: MidiDeviceInfo[];
  /** Currently active device (last one that sent data) */
  activeDevice: string | null;
  /** Last received MIDI note number */
  lastNote: number | null;
  /** Last received velocity */
  lastVelocity: number | null;
}

export function useWebMidi(
  godEngine: React.MutableRefObject<GodRealmSamplerEngine | null>,
  midiMap: number[],
  onPadTrigger?: (padIndex: number) => void,
): WebMidiState {
  const isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

  const [state, setState] = useState<WebMidiState>({
    isSupported,
    isConnected: false,
    devices: [],
    activeDevice: null,
    lastNote: null,
    lastVelocity: null,
  });

  const midiAccessRef = useRef<MIDIAccess | null>(null);

  // ═══ Store everything in refs to avoid re-render dependency chains ═══
  const midiMapRef = useRef(midiMap);
  midiMapRef.current = midiMap;

  const onPadTriggerRef = useRef(onPadTrigger);
  onPadTriggerRef.current = onPadTrigger;

  const godEngineRef = godEngine; // already a ref

  // ═══ Stable message handler — never changes identity ═══
  const handleMidiMessage = useCallback((e: MIDIMessageEvent) => {
    const data = e.data;
    if (!data || data.length < 3) return;

    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];

    // Note On (0x90) with velocity > 0
    if (status === 0x90 && velocity > 0) {
      // Reverse map: MIDI note → pad index
      const padIndex = midiMapRef.current.indexOf(note);
      if (padIndex >= 0) {
        // Trigger pad
        if (godEngineRef.current) {
          godEngineRef.current.playBufferPart(padIndex, 0);
        }

        // Emit throne-trigger for visual flash
        window.dispatchEvent(new CustomEvent('throne-trigger', {
          detail: { padIndex, velocity },
        }));

        onPadTriggerRef.current?.(padIndex);
      }

      // Update state (batched by React, won't cause callback re-creation)
      const input = e.target as MIDIInput;
      setState(prev => ({
        ...prev,
        activeDevice: input?.name || 'Unknown MIDI',
        lastNote: note,
        lastVelocity: velocity,
      }));
    }

    // Note Off (0x80, or 0x90 with velocity 0) — future: handle sustained/held pad modes
  }, []); // ← EMPTY deps: uses refs only, never recreated

  // ═══ Initialize Web MIDI — runs exactly ONCE ═══
  useEffect(() => {
    if (!isSupported) {
      console.log('[WebMidi] Web MIDI API not supported in this browser');
      return;
    }

    let cancelled = false;

    const scanAndAttach = (access: MIDIAccess) => {
      const devices: MidiDeviceInfo[] = [];

      access.inputs.forEach((input) => {
        devices.push({
          id: input.id,
          name: input.name || 'Unknown',
          manufacturer: input.manufacturer || '',
          state: input.state,
        });

        // Attach stable message listener (never changes)
        input.onmidimessage = handleMidiMessage;
      });

      if (!cancelled) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          devices,
        }));

        console.log(`[WebMidi] ${devices.length} MIDI input(s) detected:`,
          devices.map(d => d.name).join(', ') || 'none');
      }
    };

    (async () => {
      try {
        const access = await navigator.requestMIDIAccess({ sysex: false });
        if (cancelled) return;

        midiAccessRef.current = access;

        // Initial scan
        scanAndAttach(access);

        // Watch for device connect/disconnect (hot-plug)
        access.onstatechange = () => {
          if (!cancelled) {
            scanAndAttach(access);
          }
        };
      } catch (err) {
        console.warn('[WebMidi] MIDI access denied or failed:', err);
        if (!cancelled) {
          setState(prev => ({ ...prev, isConnected: false }));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (midiAccessRef.current) {
        // Detach all listeners
        midiAccessRef.current.inputs.forEach(input => {
          input.onmidimessage = null;
        });
        midiAccessRef.current.onstatechange = null;
      }
    };
  }, [isSupported, handleMidiMessage]); // handleMidiMessage is stable (empty deps)

  return state;
}
