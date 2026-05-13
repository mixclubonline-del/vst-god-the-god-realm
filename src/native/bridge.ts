// ═══════════════════════════════════════════════════════════════
// NativeAudioBridge — Bidirectional JUCE ↔ WebView State Sync
// ═══════════════════════════════════════════════════════════════
// When running inside JUCE (standalone/VST3), the engine pushes
// real-time state via window.__godRealmStateUpdate(). In dev mode
// (browser), a simulation loop generates fake data for UI parity.

export interface ParameterChange {
  id: string;
  value: number | string | boolean;
}

// MIDI 2.0 Note Event — high-resolution per-note data
export interface Midi2NoteEvent {
  note: number;
  velocity16: number;    // 0-65535 (MIDI 2.0 16-bit velocity)
  channel: number;       // 0-15
  pressure: number;      // Per-note aftertouch 0.0-1.0
  pitchBend: number;     // Per-note pitch bend -1.0 to 1.0
}

export interface TransportState {
  isPlaying: boolean;
  bpm: number;
  ppq: number;
  currentStep: number;
}

export interface TelemetryState {
  cpuUsage: number;
  sampleRate: number;
  bufferSize: number;
}

export interface EngineState {
  // Metering (30Hz from JUCE)
  slotLevels: number[];
  masterPeakL: number;
  masterPeakR: number;
  
  // Transport
  currentStep: number;
  isPlaying: boolean;
  bpm: number;
  ppq: number;
  
  // MIDI 2.0
  midiNotes: Midi2NoteEvent[];
  
  // Telemetry (10Hz from JUCE)
  cpuUsage: number;
  sampleRate: number;
  bufferSize: number;
  memoryUsage: number;
  
  // Legacy compat
  moduleLevels: Record<string, number>;
  arpStep: number;
  vortexAnchors: Array<{x: number, y: number, name: string}>;
}

// Ensure window globals are recognized
declare global {
  interface Window {
    __juce__?: {
      postMessage: (message: string) => void;
    };
    sendToJuce?: (message: any) => void;
    __godRealmStateUpdate?: (state: any) => void;
    __godRealmTelemetry?: (telemetry: any) => void;
  }
}

class NativeAudioBridge {
  private listeners: Set<(state: Partial<EngineState>) => void> = new Set();
  
  // Current accumulated state
  private currentState: EngineState = {
    slotLevels: new Array(8).fill(0),
    masterPeakL: 0,
    masterPeakR: 0,
    currentStep: 0,
    isPlaying: false,
    bpm: 140,
    ppq: 0,
    midiNotes: [],
    cpuUsage: 1.2,
    sampleRate: 44100,
    bufferSize: 512,
    memoryUsage: 42.8,
    moduleLevels: {},
    arpStep: 0,
    vortexAnchors: []
  };

  constructor() {
    // Register the global callback that JUCE will invoke
    if (typeof window !== 'undefined') {
      // ─── Primary metering callback (30Hz from JUCE) ───
      window.__godRealmStateUpdate = (state: any) => {
        if (state.slotLevels) this.currentState.slotLevels = state.slotLevels;
        if (state.masterPeakL !== undefined) this.currentState.masterPeakL = state.masterPeakL;
        if (state.masterPeakR !== undefined) this.currentState.masterPeakR = state.masterPeakR;
        if (state.currentStep !== undefined) {
          this.currentState.currentStep = state.currentStep;
          this.currentState.arpStep = state.currentStep % 16; // Legacy compat
        }
        if (state.isPlaying !== undefined) this.currentState.isPlaying = state.isPlaying;
        if (state.bpm !== undefined) this.currentState.bpm = state.bpm;
        if (state.ppq !== undefined) this.currentState.ppq = state.ppq;
        if (state.midiNotes) this.currentState.midiNotes = state.midiNotes;

        this.notifyListeners(this.currentState);
      };

      // ─── Telemetry callback (10Hz from JUCE) ───
      window.__godRealmTelemetry = (telemetry: any) => {
        if (telemetry.cpuUsage !== undefined) this.currentState.cpuUsage = telemetry.cpuUsage;
        if (telemetry.sampleRate !== undefined) this.currentState.sampleRate = telemetry.sampleRate;
        if (telemetry.bufferSize !== undefined) this.currentState.bufferSize = telemetry.bufferSize;
        
        // Telemetry is lower priority, don't trigger a full re-render
      };

      // ─── Incoming message listener from JUCE (legacy postMessage path) ───
      window.addEventListener('message', (event) => {
        try {
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            if (data.type === 'STATE_UPDATE' && data.payload) {
              this.notifyListeners(data.payload);
            }
          }
        } catch (e) {
          // ignore parsing errors from non-juce messages
        }
      });
    }

    // Start simulation loop for UI feedback when not inside JUCE
    if (!this.isInJuce()) {
      this.startSimulation();
    }
  }

  private isInJuce(): boolean {
    return typeof window !== 'undefined' && 
           (!!window.__juce__ || !!window.sendToJuce);
  }

  private startSimulation() {
    // ─── Metering simulation (30Hz) ───
    setInterval(() => {
      const newLevels = this.currentState.slotLevels.map(l => {
        const target = Math.random() > 0.8 ? Math.random() : Math.max(0, l - 0.1);
        return l + (target - l) * 0.5;
      });
      
      // Simulate master peaks from slot activity
      const masterEnergy = newLevels.reduce((a, b) => a + b, 0) / newLevels.length;
      const masterPeakL = Math.min(1, masterEnergy * 1.2 + Math.random() * 0.05);
      const masterPeakR = Math.min(1, masterEnergy * 1.2 + Math.random() * 0.05);

      // Simulate MIDI 2.0 note events (occasional random notes)
      const midiNotes: Midi2NoteEvent[] = [];
      if (Math.random() > 0.85) {
        midiNotes.push({
          note: 36 + Math.floor(Math.random() * 48), // C2 to C6
          velocity16: Math.floor(Math.random() * 65535),
          channel: 0,
          pressure: Math.random() * 0.3,
          pitchBend: 0
        });
      }

      this.currentState.slotLevels = newLevels;
      this.currentState.masterPeakL = masterPeakL;
      this.currentState.masterPeakR = masterPeakR;
      this.currentState.arpStep = (this.currentState.arpStep + 1) % 16;
      this.currentState.currentStep = (this.currentState.currentStep + 1) % 64;
      this.currentState.midiNotes = midiNotes;

      this.notifyListeners(this.currentState);
    }, 33); // ~30Hz

    // ─── Telemetry simulation (10Hz) ───
    setInterval(() => {
      this.currentState.cpuUsage = 1.0 + Math.random() * 3.0;
      this.currentState.memoryUsage = 40 + Math.random() * 20;
    }, 100);
  }

  public subscribe(callback: (state: Partial<EngineState>) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /** Get current snapshot without subscribing */
  public getState(): Readonly<EngineState> {
    return this.currentState;
  }

  private notifyListeners(state: Partial<EngineState>) {
    this.listeners.forEach(l => l(state));
  }

  public setParameter(paramId: string, value: number | string | boolean) {
    const msg = {
      type: 'SET_PARAMETER',
      payload: { id: paramId, value }
    };
    
    if (this.isInJuce()) {
      if (window.__juce__) {
        window.__juce__.postMessage(JSON.stringify(msg));
      } else if (window.sendToJuce) {
        window.sendToJuce(msg);
      }
    } else {
      console.log('[NativeBridge Sim] Parameter changed:', paramId, value);
    }
  }

  public updateSequencerStep(trackIdx: number, patternName: 'A' | 'B', stepIdx: number, stepData: any) {
    const msg = {
      type: 'UPDATE_STEP',
      payload: { trackIdx, patternName, stepIdx, stepData }
    };
    
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Step updated:', { trackIdx, patternName, stepIdx });
    }
  }

  public loadSample(trackIdx: number, filePath: string) {
    const msg = {
      type: 'LOAD_SAMPLE',
      payload: { trackIdx, filePath }
    };
    
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Load sample:', { trackIdx, filePath });
    }
  }

  public updateTrackSlices(trackIdx: number, slices: { start: number; end: number }[]) {
    const msg = {
      type: 'UPDATE_TRACK_SLICES',
      payload: { trackIdx, slices }
    };
    
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Track slices updated:', { trackIdx, sliceCount: slices.length });
    }
  }

  public updateRoutingChain(chain: any[]) {
    const msg = {
      type: 'UPDATE_ROUTING_CHAIN',
      payload: { chain }
    };
    
    if (this.isInJuce()) {
      if (window.__juce__) {
        window.__juce__.postMessage(JSON.stringify(msg));
      } else if (window.sendToJuce) {
        window.sendToJuce(msg);
      }
    } else {
      console.log('[NativeBridge Sim] Routing chain updated:', chain.length, 'modules');
    }
  }

  public triggerNeuralOrchestration() {
    if (this.isInJuce()) {
      const msg = { type: 'TRIGGER_NEURAL_ORCHESTRATION' };
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Neural orchestration triggered');
    }
  }
}

export const nativeAudio = new NativeAudioBridge();
