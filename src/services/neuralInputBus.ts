import { NeuralInputEvent, KeyboardMap } from './types';

/**
 * NeuralInputBus — The gateway for physical interaction.
 * Handles Computer Keyboard mapping and MIDI 2.0 high-resolution message routing.
 * Incorporates Time-Based Velocity tracking and Mouse Expression tracking.
 */
class NeuralInputBus {
  private listeners: ((event: NeuralInputEvent) => void)[] = [];
  
  private keyboardMap: KeyboardMap = {
    keys: {
      // Row 1: Bottom 8 pads (0-7)
      'z': 0, 'x': 1, 'c': 2, 'v': 3,
      'b': 4, 'n': 5, 'm': 6, ',': 7,
      // Row 2: Top 8 pads (8-15)
      'a': 8, 's': 9, 'd': 10, 'f': 11,
      'g': 12, 'h': 13, 'j': 14, 'k': 15
    },
    commands: {
      'Space': 'toggle_playback',
      'Enter': 'record',
      'ArrowLeft': 'prev_sample',
      'ArrowRight': 'next_sample'
    }
  };

  private activeKeys: Set<string> = new Set();
  private keydownTimes: Map<string, number> = new Map();
  
  // Expression Pedal State
  private expressionMultiplier: number = 0.8; // Default 80% (mapped to 0.0 - 1.0)
  
  // Time-based intensity State (EMA of keyup - keydown duration)
  private runningIntensity: number = 0.8; 

  private midiAccess: MIDIAccess | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown.bind(this));
      window.addEventListener('keyup', this.handleKeyUp.bind(this));
      window.addEventListener('mousemove', this.handleMouseMove.bind(this));
      window.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
      this.initMidi();
    }
  }

  public addListener(callback: (event: NeuralInputEvent) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private emit(event: NeuralInputEvent) {
    this.listeners.forEach(l => l(event));
  }

  private handleMouseMove(e: MouseEvent) {
    // Map Y position to expression (bottom of screen = 0, top of screen = 1.0)
    // We only want this active if the user holds a modifier like Shift or if a toggle is active,
    // but for now, we map it directly as requested.
    const yRatio = 1.0 - (e.clientY / window.innerHeight);
    this.expressionMultiplier = Math.max(0.1, Math.min(1.0, yRatio));
  }

  private handleWheel(e: WheelEvent) {
    // Scroll adjusts expression like a mod wheel
    if (e.ctrlKey || e.metaKey) return; // Ignore zoom
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    this.expressionMultiplier = Math.max(0.1, Math.min(1.0, this.expressionMultiplier + delta));
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.activeKeys.has(e.key)) return; 
    
    // Check for pad mapping
    if (this.keyboardMap.keys[e.key] !== undefined) {
      this.activeKeys.add(e.key);
      this.keydownTimes.set(e.key, performance.now());
      
      const padIndex = this.keyboardMap.keys[e.key];
      
      // Calculate High-Res Velocity
      // Velocity is derived from current running intensity (based on previous strikes) AND current mouse expression.
      // We square the expression to give it an exponential curve for audio volume mapping.
      const finalMultiplier = (this.expressionMultiplier * this.expressionMultiplier) * this.runningIntensity;
      const clampedMultiplier = Math.max(0.01, Math.min(1.0, finalMultiplier));
      
      const velocity16Bit = Math.floor(clampedMultiplier * 65535);

      this.emit({
        type: 'keyboard',
        target: padIndex,
        velocity: velocity16Bit, 
        timestamp: performance.now()
      });
    }

    // Check for commands
    if (this.keyboardMap.commands[e.code]) {
      console.log(`[NeuralBus] Command: ${this.keyboardMap.commands[e.code]}`);
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.activeKeys.delete(e.key);
    
    const downTime = this.keydownTimes.get(e.key);
    if (downTime) {
      const duration = performance.now() - downTime;
      this.keydownTimes.delete(e.key);

      // Map duration to intensity:
      // Fast strike (50ms) -> High intensity (1.0)
      // Slow press (500ms+) -> Low intensity (0.2)
      let intensity = 1.0 - (duration / 500);
      intensity = Math.max(0.2, Math.min(1.0, intensity));

      // Apply Exponential Moving Average (EMA) to smooth the intensity over recent strikes
      this.runningIntensity = (this.runningIntensity * 0.4) + (intensity * 0.6);
    }
  }

  private async initMidi() {
    try {
      if (navigator.requestMIDIAccess) {
        this.midiAccess = await navigator.requestMIDIAccess();
        this.midiAccess.inputs.forEach(input => {
          input.onmidimessage = this.handleMidiMessage.bind(this);
        });
        console.log("[NeuralBus] MIDI Connection Established");
      }
    } catch (err) {
      console.warn("[NeuralBus] MIDI access denied or unavailable");
    }
  }

  private handleMidiMessage(message: MIDIMessageEvent) {
    if (!message.data) return;
    const [status, data1, data2] = message.data;
    const type = status & 0xf0;

    if (type === 0x90 && data2 > 0) { // Note On
      const padIndex = data1 - 36;
      if (padIndex >= 0 && padIndex < 16) {
        this.emit({
          type: 'midi',
          target: padIndex,
          velocity: Math.floor((data2 / 127) * 65535),
          timestamp: performance.now()
        });
      }
    }
  }
}

export const neuralInputBus = new NeuralInputBus();
