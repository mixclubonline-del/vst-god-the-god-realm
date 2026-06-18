import { TrackState, StepState } from '../components/sequencer/useSequencerEngine';

interface MidiEvent {
  tick: number;
  type: 'on' | 'off';
  note: number;
  velocity: number;
}

/**
 * Converts a number to a variable-length quantity (VLQ) byte array.
 */
function writeVLQ(value: number): number[] {
  const bytes: number[] = [];
  let buffer = value & 0x7f;
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= ((value & 0x7f) | 0x80);
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }
  return bytes;
}

/**
 * Converts a 32-bit integer to a 4-byte big-endian array.
 */
function writeInt32(value: number): number[] {
  return [
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff
  ];
}

/**
 * Converts a 16-bit integer to a 2-byte big-endian array.
 */
function writeInt16(value: number): number[] {
  return [
    (value >> 8) & 0xff,
    value & 0xff
  ];
}

/**
 * Encodes a string to a byte array.
 */
function writeString(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xff);
  }
  return bytes;
}

/**
 * Determines the default MIDI note for a drum sample track.
 */
function getDrumNote(trackName: string): number {
  const name = trackName.toUpperCase();
  if (name.includes('KICK')) return 36; // C1
  if (name.includes('SNARE')) return 38; // D1
  if (name.includes('HAT') || name.includes('HIHAT') || name.includes('HI-HAT')) return 42; // F#1
  if (name.includes('808')) return 36; // C1 (common for 808s)
  if (name.includes('PERC')) return 48; // C2
  if (name.includes('FX') || name.includes('HIT')) return 52; // E2
  return 60; // Default C4
}

/**
 * Generates a standard multitrack MIDI file (Format 1) from the sequencer state
 * and returns it as a Base64-encoded string.
 */
export function generateMidiBase64(tracks: TrackState[], activePattern: 'A' | 'B', bpm: number): string {
  const PPQ = 96; // Ticks per quarter note
  const TICKS_PER_STEP = PPQ / 4; // 24 ticks for a 16th note step

  const midiBytes: number[] = [];

  // 1. Write MThd Header Chunk
  // Header ID "MThd" (4 bytes)
  midiBytes.push(...writeString('MThd'));
  // Length (6 bytes)
  midiBytes.push(...writeInt32(6));
  // Format 1 (multiple tracks, 2 bytes)
  midiBytes.push(...writeInt16(1));
  // Number of tracks: Conductor Track + Sequencer Tracks
  const activeTracksCount = tracks.length;
  midiBytes.push(...writeInt16(1 + activeTracksCount));
  // Time division (96 PPQ, 2 bytes)
  midiBytes.push(...writeInt16(PPQ));

  // 2. Write Track 0: Conductor Track (Tempo & Time Signature)
  const conductorBytes: number[] = [];
  
  // Time Signature Event: 4/4
  // delta-time 0, meta event type FF 58, length 04, data: num (4), den (2^2 = 4), metronome (24), 32nds (8)
  conductorBytes.push(0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

  // Tempo Event
  // delta-time 0, meta event type FF 51, length 03, microseconds per quarter note
  const microSecondsPerQuarter = Math.round(60000000 / bpm);
  conductorBytes.push(0x00, 0xff, 0x51, 0x03,
    (microSecondsPerQuarter >> 16) & 0xff,
    (microSecondsPerQuarter >> 8) & 0xff,
    microSecondsPerQuarter & 0xff
  );

  // End of Track Event
  conductorBytes.push(0x00, 0xff, 0x2f, 0x00);

  // Write Track 0 to main stream
  midiBytes.push(...writeString('MTrk'));
  midiBytes.push(...writeInt32(conductorBytes.length));
  midiBytes.push(...conductorBytes);

  // 3. Write MIDI Notes Tracks
  tracks.forEach((track, trackIndex) => {
    const trackBytes: number[] = [];
    const events: MidiEvent[] = [];
    const channel = trackIndex % 16; // Wrap channel to valid range (0-15)

    // Track Name Event
    // delta-time 0, meta event type FF 03, length, name string
    const trackNameBytes = writeString(track.name);
    trackBytes.push(0x00, 0xff, 0x03, ...writeVLQ(trackNameBytes.length), ...trackNameBytes);

    const steps = activePattern === 'B' ? track.patternB : track.patternA;

    if (track.sourceType === 'synth' && track.synthConfig) {
      if (track.synthConfig.usePianoRoll) {
        // Parse piano roll notes
        track.synthConfig.pianoRollNotes.forEach((pn) => {
          const startTick = Math.round(pn.startStep * TICKS_PER_STEP);
          const durationTicks = Math.round(pn.duration * TICKS_PER_STEP);
          const endTick = startTick + durationTicks;

          events.push({
            tick: startTick,
            type: 'on',
            note: pn.note,
            velocity: pn.velocity
          });
          events.push({
            tick: endTick,
            type: 'off',
            note: pn.note,
            velocity: 0
          });
        });
      } else {
        // Parse step-sequencer noteMap notes
        steps.forEach((step, stepIndex) => {
          if (step.enabled) {
            const startTick = stepIndex * TICKS_PER_STEP;
            const durationTicks = Math.max(6, Math.round(step.decay * TICKS_PER_STEP));
            const endTick = startTick + durationTicks;
            const baseNote = track.synthConfig?.noteMap[stepIndex] ?? 60;
            const noteNumber = Math.max(0, Math.min(127, baseNote + step.pitch));

            events.push({
              tick: startTick,
              type: 'on',
              note: noteNumber,
              velocity: step.velocity
            });
            events.push({
              tick: endTick,
              type: 'off',
              note: noteNumber,
              velocity: 0
            });
          }
        });
      }
    } else {
      // Parse sample/drum tracks
      steps.forEach((step, stepIndex) => {
        if (step.enabled) {
          const startTick = stepIndex * TICKS_PER_STEP;
          const durationTicks = Math.max(6, Math.round(step.decay * TICKS_PER_STEP));
          const endTick = startTick + durationTicks;
          
          const baseNote = getDrumNote(track.name);
          const noteNumber = Math.max(0, Math.min(127, baseNote + step.pitch));

          events.push({
            tick: startTick,
            type: 'on',
            note: noteNumber,
            velocity: step.velocity
          });
          events.push({
            tick: endTick,
            type: 'off',
            note: noteNumber,
            velocity: 0
          });
        }
      });
    }

    // Sort events by tick (Note-Off before Note-On for identical ticks)
    events.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return a.type === 'off' ? -1 : 1;
    });

    // Write events with delta-times
    let lastTick = 0;
    events.forEach((ev) => {
      const deltaTime = ev.tick - lastTick;
      lastTick = ev.tick;

      // Write delta-time
      trackBytes.push(...writeVLQ(deltaTime));

      // Write midi event status + data
      if (ev.type === 'on') {
        trackBytes.push(0x90 | channel, ev.note, ev.velocity);
      } else {
        trackBytes.push(0x80 | channel, ev.note, 0x40); // 0x40 is standard release velocity
      }
    });

    // End of track event (delta-time 0, FF 2F 00)
    trackBytes.push(0x00, 0xff, 0x2f, 0x00);

    // Write MTrk chunk to main stream
    midiBytes.push(...writeString('MTrk'));
    midiBytes.push(...writeInt32(trackBytes.length));
    midiBytes.push(...trackBytes);
  });

  // 4. Encode to Base64
  const uint8 = new Uint8Array(midiBytes);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return window.btoa(binary);
}
