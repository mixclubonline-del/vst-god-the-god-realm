/**
 * NerveMonitor — Live Input Status Indicator
 *
 * Shows active input sources, MIDI device info, and last triggered pad.
 * Renders inline in the footer bar.
 */
import React, { useState, useEffect, useRef } from 'react';
import type { WebMidiState } from '../hooks/useWebMidi';
import { PAD_KEY_LABELS } from '../hooks/useKeyboardPads';
import { THRONE_DOMAINS } from '../data/throneDomains';

interface NerveMonitorProps {
  midiState: WebMidiState;
  keyboardActive: boolean;
}

export const NerveMonitor: React.FC<NerveMonitorProps> = React.memo(({
  midiState,
  keyboardActive,
}) => {
  const [lastTrigger, setLastTrigger] = useState<{
    padIndex: number;
    timestamp: number;
  } | null>(null);
  const [pulseActive, setPulseActive] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for throne-trigger events
  useEffect(() => {
    const handler = (e: Event) => {
      const { padIndex } = (e as CustomEvent<{ padIndex: number }>).detail;
      setLastTrigger({ padIndex, timestamp: Date.now() });
      setPulseActive(true);

      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulseActive(false), 300);
    };

    window.addEventListener('throne-trigger', handler);
    return () => {
      window.removeEventListener('throne-trigger', handler);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
  }, []);

  const domain = lastTrigger ? THRONE_DOMAINS[lastTrigger.padIndex] : null;
  const keyLabel = lastTrigger ? PAD_KEY_LABELS[lastTrigger.padIndex] : null;

  return (
    <div className="nerve-monitor">
      {/* Pulse dot */}
      <div className={`nerve-monitor__pulse ${pulseActive ? 'nerve-monitor__pulse--active' : ''}`}
        style={domain ? { '--pulse-color': domain.color } as React.CSSProperties : undefined}
      />

      {/* MIDI Status */}
      <div className={`nerve-monitor__source ${midiState.isConnected ? 'nerve-monitor__source--on' : ''}`}>
        <span className="nerve-monitor__icon">🎹</span>
        <span className="nerve-monitor__label">
          {midiState.isConnected
            ? midiState.activeDevice || `${midiState.devices.length} MIDI`
            : 'NO MIDI'
          }
        </span>
      </div>

      {/* Keyboard Status */}
      <div className={`nerve-monitor__source ${keyboardActive ? 'nerve-monitor__source--on' : ''}`}>
        <span className="nerve-monitor__icon">⌨️</span>
        <span className="nerve-monitor__label">KEYS</span>
      </div>

      {/* Last Triggered Pad */}
      {lastTrigger && domain && (
        <div
          className={`nerve-monitor__last-pad ${pulseActive ? 'nerve-monitor__last-pad--flash' : ''}`}
          style={{ '--pad-color': domain.color } as React.CSSProperties}
        >
          <span className="nerve-monitor__pad-number">
            {String(lastTrigger.padIndex + 1).padStart(2, '0')}
          </span>
          <span className="nerve-monitor__pad-domain">{domain.name}</span>
          {keyLabel && (
            <span className="nerve-monitor__pad-key">[{keyLabel}]</span>
          )}
        </div>
      )}

      {/* MIDI Note (when receiving) */}
      {midiState.lastNote !== null && pulseActive && (
        <span className="nerve-monitor__midi-note">
          N{midiState.lastNote} V{midiState.lastVelocity}
        </span>
      )}
    </div>
  );
});

NerveMonitor.displayName = 'NerveMonitor';
