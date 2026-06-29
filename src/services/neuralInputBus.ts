import { NeuralInputEvent, KeyboardMap } from './types';

/**
 * NeuralInputBus — The gateway for physical interaction.
 * Handles Computer Keyboard mapping and MIDI 2.0 high-resolution message routing.
 * Incorporates Time-Based Velocity tracking, Mouse Expression tracking,
 * and full CC (Control Change) message routing for controller mapping.
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

  // ═══ Configurable MIDI note → pad map (default: C1-D#2, notes 36-51) ═══
  private _midiMap: number[] = Array.from({ length: 16 }, (_, i) => 36 + i);

  /** Update the note→pad map at runtime (called from VstgodthegodrealmPlugin when midiMap changes). */
  public updateMidiMap(map: number[]): void {
    this._midiMap = map;
  }

  // ═══ Device tracking ═══
  private _connectedDevices: Map<string, string> = new Map(); // id → name
  private deviceChangeListeners: (() => void)[] = [];

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

  /** Subscribe to MIDI device connect/disconnect events */
  public onDeviceChange(callback: () => void) {
    this.deviceChangeListeners.push(callback);
    return () => {
      this.deviceChangeListeners = this.deviceChangeListeners.filter(l => l !== callback);
    };
  }

  /** Get list of connected MIDI input device names */
  public get connectedDevices(): string[] {
    return Array.from(this._connectedDevices.values());
  }

  private emit(event: NeuralInputEvent) {
    this.listeners.forEach(l => l(event));
  }

  private emitDeviceChange() {
    this.deviceChangeListeners.forEach(l => l());
  }

  private handleMouseMove(e: MouseEvent) {
    const yRatio = 1.0 - (e.clientY / window.innerHeight);
    this.expressionMultiplier = Math.max(0.1, Math.min(1.0, yRatio));
  }

  private handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) return;
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    this.expressionMultiplier = Math.max(0.1, Math.min(1.0, this.expressionMultiplier + delta));
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.activeKeys.has(e.key)) return; 
    
    if (this.keyboardMap.keys[e.key] !== undefined) {
      this.activeKeys.add(e.key);
      this.keydownTimes.set(e.key, performance.now());
      
      const padIndex = this.keyboardMap.keys[e.key];
      
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

      let intensity = 1.0 - (duration / 500);
      intensity = Math.max(0.2, Math.min(1.0, intensity));
      this.runningIntensity = (this.runningIntensity * 0.4) + (intensity * 0.6);
    }
  }

  private async initMidi() {
    try {
      if (navigator.requestMIDIAccess) {
        this.midiAccess = await navigator.requestMIDIAccess();

        // Initial device scan
        this.scanDevices();

        // Hot-plug detection
        this.midiAccess.onstatechange = () => {
          this.scanDevices();
          this.emitDeviceChange();
        };

        console.log("[NeuralBus] MIDI Connection Established");
      }
    } catch (err) {
      console.warn("[NeuralBus] MIDI access denied or unavailable");
    }
  }

  /** Scan all connected MIDI inputs, bind message handlers, and update device list */
  private scanDevices() {
    if (!this.midiAccess) return;

    this._connectedDevices.clear();

    this.midiAccess.inputs.forEach((input, id) => {
      if (input.state === 'connected') {
        const deviceName = input.name || `MIDI Input ${id}`;
        this._connectedDevices.set(id, deviceName);
        input.onmidimessage = (msg) => this.handleMidiMessage(msg, deviceName);

        // Auto-load CC profile for this device
        this.applyDeviceProfile(deviceName);
      }
    });
  }

  /**
   * Apply a CC profile preset based on device name.
   * Emits a custom DOM event so midiMappingService can load the right preset.
   */
  private applyDeviceProfile(deviceName: string): void {
    const lower = deviceName.toLowerCase();
    let profileId = 'generic';
    if (lower.includes('arturia') || lower.includes('keylab')) {
      profileId = 'arturia-keylab';
    } else if (lower.includes('akai') || lower.includes('mpk')) {
      profileId = 'akai-mpk';
    } else if (lower.includes('novation') || lower.includes('launchkey')) {
      profileId = 'novation-launchkey';
    }
    // Broadcast to the rest of the app so midiMappingService can respond
    window.dispatchEvent(new CustomEvent('midi-device-connected', {
      detail: { deviceName, profileId }
    }));
    console.log(`[NeuralBus] Device connected: "${deviceName}" → profile: ${profileId}`);
  }

  /**
   * Trigger a note-on event from JUCE bridge (VST3 mode, no Web MIDI).
   * Routes note to correct pad via midiMap and also emits full-range note-on.
   */
  public triggerMidiNoteOn(note: number, velocity16: number, channel: number = 0, deviceName: string = 'DAW MIDI'): void {
    const padIndex = this._midiMap.indexOf(note);
    if (padIndex >= 0) {
      this.emit({ type: 'midi', target: padIndex, velocity: velocity16, note, channel, deviceName, timestamp: performance.now() });
    }
    this.emit({ type: 'midi_note_on', target: note, velocity: velocity16, note, channel, deviceName, timestamp: performance.now() });
  }

  /**
   * Trigger a note-off event from JUCE bridge.
   */
  public triggerMidiNoteOff(note: number, channel: number = 0, deviceName: string = 'DAW MIDI'): void {
    this.emit({ type: 'midi_note_off', target: note, velocity: 0, note, channel, deviceName, timestamp: performance.now() });
  }

  private handleMidiMessage(message: MIDIMessageEvent, deviceName: string) {
    if (!message.data) return;
    const [status, data1, data2] = message.data;
    const type = status & 0xf0;
    const channel = status & 0x0f;

    // Note On (velocity > 0)
    if (type === 0x90 && data2 > 0) {
      // Look up which pad this note is assigned to
      const padIndex = this._midiMap.indexOf(data1);
      if (padIndex >= 0) {
        this.emit({
          type: 'midi',
          target: padIndex,
          velocity: Math.floor((data2 / 127) * 65535),
          note: data1,
          channel,
          deviceName,
          timestamp: performance.now()
        });
      }

      // Full-range Note On (for Piano Roll recording)
      this.emit({
        type: 'midi_note_on',
        target: data1,
        velocity: Math.floor((data2 / 127) * 65535),
        note: data1,
        channel,
        deviceName,
        timestamp: performance.now()
      });
    }

    // Note Off (0x80, or 0x90 with velocity 0)
    if (type === 0x80 || (type === 0x90 && data2 === 0)) {
      this.emit({
        type: 'midi_note_off',
        target: data1,
        velocity: 0,
        note: data1,
        channel,
        deviceName,
        timestamp: performance.now()
      });
    }

    // Control Change (CC)
    if (type === 0xB0) {
      this.emit({
        type: 'midi_cc',
        target: data1, // CC number as target
        velocity: Math.floor((data2 / 127) * 65535), // 16-bit scaled value
        cc: data1,
        channel,
        deviceName,
        timestamp: performance.now()
      });
    }

    // Pitch Bend
    if (type === 0xE0) {
      const pitchBend = ((data2 << 7) | data1) - 8192; // -8192 to 8191
      this.emit({
        type: 'midi_cc',
        target: 128, // Special: pitch bend pseudo-CC
        velocity: Math.floor(((pitchBend + 8192) / 16383) * 65535),
        cc: 128,
        channel,
        deviceName,
        timestamp: performance.now()
      });
    }
  }

  public triggerMidiCC(cc: number, value: number, channel: number, deviceName: string = 'DAW MIDI') {
    this.emit({
      type: 'midi_cc',
      target: cc,
      velocity: Math.floor((value / 127) * 65535),
      cc,
      channel,
      deviceName,
      timestamp: performance.now()
    });
  }
}

export const neuralInputBus = new NeuralInputBus();
