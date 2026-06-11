/**
 * ArpeggiatorEngine — Sacred Arpeggiator for Synth Tracks
 *
 * Takes held notes and generates rhythmic patterns.
 * Modes: Up, Down, UpDown, Random, Order (as played)
 * Features: Rate (1/4 to 1/32), Octave range (1-4), Gate (note length), Swing
 *
 * Works both with:
 *  - MIDI input (live held notes via useMidiNoteInput)
 *  - Piano Roll notes (arpeggiate chord blocks)
 */

export type ArpMode = 'up' | 'down' | 'upDown' | 'random' | 'order';
export type ArpRate = '1/4' | '1/8' | '1/8T' | '1/16' | '1/16T' | '1/32';

export interface ArpConfig {
  enabled: boolean;
  mode: ArpMode;
  rate: ArpRate;
  octaveRange: number;    // 1-4 octaves
  gate: number;           // 0.1-1.0 (note length as fraction of step)
  swing: number;          // 0-100
  velocity: number;       // 0 = use input velocity, 1-127 = fixed
  pattern: number[];      // Rhythm pattern (1 = play, 0 = rest), e.g. [1,1,1,0] for 3/4
}

export const DEFAULT_ARP_CONFIG: ArpConfig = {
  enabled: false,
  mode: 'up',
  rate: '1/8',
  octaveRange: 1,
  gate: 0.5,
  swing: 0,
  velocity: 0,
  pattern: [1, 1, 1, 1], // All steps play
};

// Arp rate → steps-per-beat multiplier
const RATE_MULTIPLIERS: Record<ArpRate, number> = {
  '1/4': 1,
  '1/8': 2,
  '1/8T': 3,
  '1/16': 4,
  '1/16T': 6,
  '1/32': 8,
};

/** Build the note sequence from held notes + arp mode + octave range */
export function buildArpSequence(
  heldNotes: number[],
  mode: ArpMode,
  octaveRange: number
): number[] {
  if (heldNotes.length === 0) return [];

  // Sort notes ascending
  const sorted = [...heldNotes].sort((a, b) => a - b);

  // Expand across octaves
  const expanded: number[] = [];
  for (let oct = 0; oct < octaveRange; oct++) {
    for (const note of sorted) {
      expanded.push(note + oct * 12);
    }
  }

  switch (mode) {
    case 'up':
      return expanded;
    case 'down':
      return [...expanded].reverse();
    case 'upDown': {
      if (expanded.length <= 1) return expanded;
      const up = expanded;
      const down = expanded.slice(1, -1).reverse();
      return [...up, ...down];
    }
    case 'random':
      // Shuffle
      const shuffled = [...expanded];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    case 'order':
      // Keep original order, expand across octaves
      const ordered: number[] = [];
      for (let oct = 0; oct < octaveRange; oct++) {
        for (const note of heldNotes) {
          ordered.push(note + oct * 12);
        }
      }
      return ordered;
    default:
      return expanded;
  }
}

/**
 * ArpeggiatorEngine — manages timing and note generation.
 * 
 * Call `tick()` on each scheduler frame to get notes to play.
 * The engine maintains its own internal step counter.
 */
export class ArpeggiatorEngine {
  private config: ArpConfig = { ...DEFAULT_ARP_CONFIG };
  private heldNotes: number[] = [];
  private sequence: number[] = [];
  private stepIndex: number = 0;
  private patternIndex: number = 0;
  private isRunning: boolean = false;
  private lastTickTime: number = 0;
  private tickInterval: number = 0;
  private onNoteOn: ((note: number, velocity: number) => void) | null = null;
  private onNoteOff: ((note: number) => void) | null = null;
  private activeNote: number | null = null;
  private timerId: number | null = null;

  setConfig(config: Partial<ArpConfig>) {
    this.config = { ...this.config, ...config };
    this.rebuildSequence();
  }

  getConfig(): ArpConfig {
    return { ...this.config };
  }

  setCallbacks(
    onNoteOn: (note: number, velocity: number) => void,
    onNoteOff: (note: number) => void
  ) {
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
  }

  noteOn(note: number, velocity: number) {
    if (!this.heldNotes.includes(note)) {
      this.heldNotes.push(note);
      this.rebuildSequence();
    }
    if (this.config.enabled && !this.isRunning && this.heldNotes.length > 0) {
      this.start();
    }
  }

  noteOff(note: number) {
    this.heldNotes = this.heldNotes.filter(n => n !== note);
    this.rebuildSequence();
    if (this.heldNotes.length === 0) {
      this.stop();
    }
  }

  /** Set BPM for timing calculations */
  setBPM(bpm: number) {
    this.updateTickInterval(bpm);
  }

  private updateTickInterval(bpm: number) {
    const beatsPerSecond = bpm / 60;
    const stepsPerBeat = RATE_MULTIPLIERS[this.config.rate];
    this.tickInterval = 1000 / (beatsPerSecond * stepsPerBeat);
  }

  private rebuildSequence() {
    this.sequence = buildArpSequence(this.heldNotes, this.config.mode, this.config.octaveRange);
    if (this.stepIndex >= this.sequence.length) {
      this.stepIndex = 0;
    }
  }

  private start() {
    this.isRunning = true;
    this.stepIndex = 0;
    this.patternIndex = 0;
    this.lastTickTime = performance.now();
    this.scheduleTick();
  }

  private stop() {
    this.isRunning = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    // Release active note
    if (this.activeNote !== null && this.onNoteOff) {
      this.onNoteOff(this.activeNote);
      this.activeNote = null;
    }
  }

  private scheduleTick() {
    if (!this.isRunning) return;
    this.timerId = window.setTimeout(() => {
      this.tick();
      this.scheduleTick();
    }, this.tickInterval) as unknown as number;
  }

  private tick() {
    if (!this.isRunning || this.sequence.length === 0) return;

    // Release previous note
    if (this.activeNote !== null && this.onNoteOff) {
      this.onNoteOff(this.activeNote);
      this.activeNote = null;
    }

    // Check rhythm pattern
    const patternStep = this.config.pattern[this.patternIndex % this.config.pattern.length];
    this.patternIndex++;

    if (patternStep === 0) {
      // Rest — skip this step but advance sequence
      this.stepIndex = (this.stepIndex + 1) % this.sequence.length;
      return;
    }

    // Play note
    const note = this.sequence[this.stepIndex % this.sequence.length];
    const velocity = this.config.velocity > 0 ? this.config.velocity : 100;

    if (this.onNoteOn) {
      this.onNoteOn(note, velocity);
      this.activeNote = note;
    }

    // Schedule gate off
    const gateMs = this.tickInterval * this.config.gate;
    setTimeout(() => {
      if (this.activeNote === note && this.onNoteOff) {
        this.onNoteOff(note);
        this.activeNote = null;
      }
    }, gateMs);

    // Advance
    this.stepIndex = (this.stepIndex + 1) % this.sequence.length;

    // Re-shuffle if random mode
    if (this.config.mode === 'random' && this.stepIndex === 0) {
      this.rebuildSequence();
    }
  }

  /** Get held notes (for UI) */
  getHeldNotes(): number[] {
    return [...this.heldNotes];
  }

  /** Get current sequence (for UI visualization) */
  getSequence(): number[] {
    return [...this.sequence];
  }

  /** Get current step index */
  getCurrentStep(): number {
    return this.stepIndex;
  }

  /** Check if running */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /** Force stop and clear */
  dispose() {
    this.stop();
    this.heldNotes = [];
    this.sequence = [];
    this.onNoteOn = null;
    this.onNoteOff = null;
  }
}
