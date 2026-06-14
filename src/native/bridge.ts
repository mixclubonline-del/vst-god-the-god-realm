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

// Phase 4: Mastering Bridge Params — Celestial Forge → JUCE
export interface MasteringBridgeParams {
  drive: number;
  silk: number;
  body: number;
  soul: number;
  air: number;
  threshold: number;
  ceiling: number;
  width: number;
  imager: number;
  volume: number;
}

// Phase 4: Sequencer Step Bridge Payload — Sacred Sequencer → JUCE
export interface StepBridgePayload {
  velocity: number;
  pitch: number;
  pan: number;
  decay: number;
  sliceIndex: number;
  sourceType: 'sample' | 'synth' | 'bus';
  synthNote?: number;
  synthGodId?: string;
}

// Phase 4: Spectral Data from JUCE → SpectralRadarPanner
export interface SpectralDataState {
  fftBins: Uint8Array;
  rms: number;
  peakFrequency: number;
}

// Phase 4: Waveform Analysis from JUCE → Sample Chopper
export interface WaveformAnalysisState {
  padIndex: number;
  transients: number[];
  spectralFlux?: Float32Array;
  rmsEnvelope?: Float32Array;
}

// Phase 4: Chopper Slice — matches GodRealmSampleChopper Slice interface
export interface BridgeSlice {
  start: number;
  end: number;
  reverse?: boolean;
  loop?: boolean;
  volume?: number;
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
  
  // Phase 4: Real-time spectral data
  spectralData: SpectralDataState | null;
  
  // Phase 4: Waveform analysis results
  waveformAnalysis: WaveformAnalysisState | null;
  
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
    // Phase 2: Parameter updates
    __godRealmParameterUpdate?: (data: { id: string; value: any }) => void;
    __godRealmParametersUpdate?: (params: Record<string, any>) => void;
    // Phase 3: Neural Suggestions
    __godRealmNeuralResponse?: (response: { text: string; params?: Record<string, any> }) => void;
    // Phase 4: New inbound callbacks from JUCE
    __godRealmWaveformAnalysis?: (data: WaveformAnalysisState) => void;
    __godRealmSpectralData?: (data: SpectralDataState) => void;
    // Phase 4.4: Settings & Library Setup
    __godRealmSettingsUpdate?: (settings: any) => void;
    __godRealmLibraryPathSelected?: (path: string) => void;
  }
}

class NativeAudioBridge {
  private listeners: Set<(state: Partial<EngineState>) => void> = new Set();
  private settingsListeners: Set<(settings: any) => void> = new Set();
  private pathListeners: Set<(path: string) => void> = new Set();
  private paramListeners: Set<(paramId: string, value: any) => void> = new Set();
  private paramsListListeners: Set<(params: Record<string, any>) => void> = new Set();
  private neuralListeners: Set<(response: { text: string; params?: Record<string, any> }) => void> = new Set();
  
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
    spectralData: null,
    waveformAnalysis: null,
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

      // ─── Phase 4: Waveform analysis callback (on-demand from JUCE) ───
      window.__godRealmWaveformAnalysis = (data: WaveformAnalysisState) => {
        this.currentState.waveformAnalysis = data;
        this.notifyListeners({ waveformAnalysis: data } as Partial<EngineState>);
      };

      // ─── Phase 4: Spectral data callback (30Hz from JUCE) ───
      window.__godRealmSpectralData = (data: SpectralDataState) => {
        this.currentState.spectralData = data;
        this.notifyListeners({ spectralData: data } as Partial<EngineState>);
      };

      // ─── Phase 4.4: Settings & Library Setup callbacks ───
      window.__godRealmSettingsUpdate = (settings: any) => {
        console.log('[NativeBridge] __godRealmSettingsUpdate invoked with settings:', JSON.stringify(settings));
        this.settingsListeners.forEach(l => l(settings));
      };

      window.__godRealmLibraryPathSelected = (path: string) => {
        console.log('[NativeBridge] __godRealmLibraryPathSelected invoked with path:', path);
        this.pathListeners.forEach(l => l(path));
      };

      // ─── Phase 2: Host Parameter Automation & Sync ───
      window.__godRealmParameterUpdate = (data: { id: string; value: any }) => {
        console.log('[NativeBridge] __godRealmParameterUpdate:', data.id, data.value);
        this.paramListeners.forEach(l => l(data.id, data.value));
      };

      window.__godRealmParametersUpdate = (params: Record<string, any>) => {
        console.log('[NativeBridge] __godRealmParametersUpdate:', JSON.stringify(params));
        this.paramsListListeners.forEach(l => l(params));
      };

      // ─── Phase 3: Neural Suggestion Callback ───
      window.__godRealmNeuralResponse = (response) => {
        console.log('[NativeBridge] __godRealmNeuralResponse invoked');
        this.neuralListeners.forEach(l => l(response));
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
      this.currentState.cpuUsage = 10.0 + Math.random() * 30.0;
      this.currentState.memoryUsage = 40 + Math.random() * 20;
    }, 100);

    // ─── Phase 4: Spectral data simulation (10Hz) ───
    let spectralFrame = 0;
    setInterval(() => {
      spectralFrame++;
      const bins = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        const bassBump = Math.exp(-Math.abs(i - 8) / 8) * 2;
        const midBump = Math.exp(-Math.abs(i - 32) / 12) * 1.5;
        bins[i] = Math.floor((Math.sin(spectralFrame * 0.12 + i * 0.18) * 40 + 80) * (bassBump + midBump) * 0.4);
      }
      const simRms = (Math.sin(spectralFrame * 0.05) * 0.3 + 0.5) * 0.2;
      this.currentState.spectralData = {
        fftBins: bins,
        rms: simRms,
        peakFrequency: 200 + Math.sin(spectralFrame * 0.03) * 150,
      };
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

  public triggerNeuralOrchestration(prompt: string, activeSlots: any[]) {
    const msg = {
      type: 'TRIGGER_NEURAL_ORCHESTRATION',
      payload: { prompt, activeSlots }
    };
    
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Neural orchestration triggered:', prompt);
      setTimeout(() => {
        if (window.__godRealmNeuralResponse) {
          window.__godRealmNeuralResponse({
            text: `🧠 [Simulated Neural Suggestion]: For prompt "${prompt}", we suggest calling Poseidon and increasing Width. {Proposed parameters locked in below.}`,
            params: {
              activeTab: 'Electric Pantheon',
              pantheonGod: 'poseidon',
              masterWidth: 160.0
            }
          });
        }
      }, 1000);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 4: Audio Bridge Integration — 7 New Outbound Methods
  // ═══════════════════════════════════════════════════════════════

  /** Push chopper slice grid to JUCE engine for native sample playback */
  public updateChopperSlices(padIndex: number, slices: BridgeSlice[], samplePath: string) {
    const msg = {
      type: 'UPDATE_CHOPPER_SLICES',
      payload: { padIndex, slices, samplePath }
    };
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Chopper slices updated:', { padIndex, sliceCount: slices.length });
    }
  }

  /** Push 3D spatial position to JUCE panner (azimuth/elevation) */
  public updateSpatialPosition(azimuth: number, elevation: number, sourceId: string) {
    const msg = {
      type: 'UPDATE_SPATIAL_POSITION',
      payload: { azimuth, elevation, sourceId }
    };
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Spatial position:', { azimuth: Math.round(azimuth), elevation: Math.round(elevation * 100) + '%', sourceId });
    }
  }

  /** Push Celestial Forge mastering params to JUCE master chain */
  public updateMasteringParams(params: MasteringBridgeParams) {
    const msg = {
      type: 'UPDATE_MASTERING_PARAMS',
      payload: params
    };
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Mastering params:', { drive: params.drive.toFixed(2), silk: params.silk.toFixed(2), volume: params.volume.toFixed(2) });
    }
  }

  /** Notify JUCE of transport state changes (BPM, play/stop, swing) */
  public updateTransport(transport: { bpm: number; isPlaying: boolean; swing: number }) {
    const msg = {
      type: 'UPDATE_TRANSPORT',
      payload: transport
    };
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Transport:', { bpm: transport.bpm, playing: transport.isPlaying, swing: transport.swing });
    }
  }

  /** Forward sequencer step trigger to JUCE for native playback */
  public triggerStep(trackIndex: number, stepData: StepBridgePayload, time: number) {
    const msg = {
      type: 'TRIGGER_STEP',
      payload: { trackIndex, stepData, time }
    };
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    }
    // Sim mode: silent — steps already play via WebAudio
  }

  /** Push automation lane data to JUCE */
  public updateAutomation(trackIndex: number, paramId: string, curve: number[]) {
    const msg = {
      type: 'UPDATE_AUTOMATION',
      payload: { trackIndex, paramId, curve }
    };
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Automation updated:', { trackIndex, paramId, points: curve.length });
    }
  }

  /** Push Multi-808 sub-oscillator params to JUCE */
  public updateSubOscParams(frequency: number, drive: number, attack: number, decay: number) {
    const msg = {
      type: 'UPDATE_SUB_OSC',
      payload: { frequency, drive, attack, decay }
    };
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      console.log('[NativeBridge Sim] Sub-osc params:', { freq: frequency.toFixed(1), drive: drive.toFixed(2) });
    }
  }

  public subscribeSettings(callback: (settings: any) => void) {
    this.settingsListeners.add(callback);
    return () => {
      this.settingsListeners.delete(callback);
    };
  }

  public subscribePath(callback: (path: string) => void) {
    this.pathListeners.add(callback);
    return () => {
      this.pathListeners.delete(callback);
    };
  }

  public subscribeParameter(callback: (paramId: string, value: any) => void) {
    this.paramListeners.add(callback);
    return () => {
      this.paramListeners.delete(callback);
    };
  }

  public subscribeParametersList(callback: (params: Record<string, any>) => void) {
    this.paramsListListeners.add(callback);
    return () => {
      this.paramsListListeners.delete(callback);
    };
  }

  public subscribeNeuralResponse(callback: (response: { text: string; params?: Record<string, any> }) => void) {
    this.neuralListeners.add(callback);
    return () => {
      this.neuralListeners.delete(callback);
    };
  }

  public getSettings() {
    console.log('[NativeBridge] getSettings() called');
    const msg = { type: 'GET_SETTINGS' };
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      setTimeout(() => {
        try {
          const stored = localStorage.getItem('godRealmSettings') || '{}';
          if (window.__godRealmSettingsUpdate) {
            window.__godRealmSettingsUpdate(JSON.parse(stored));
          }
        } catch (e) {
          if (window.__godRealmSettingsUpdate) {
            window.__godRealmSettingsUpdate({});
          }
        }
      }, 100);
    }
  }

  public saveSettings(settings: any) {
    const msg = { type: 'SAVE_SETTINGS', payload: settings };
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      try {
        localStorage.setItem('godRealmSettings', JSON.stringify(settings));
        console.log('[NativeBridge Sim] Settings saved:', settings);
      } catch (e) {
        console.error('[NativeBridge Sim] Failed to save settings to localStorage:', e);
      }
    }
  }

  public browseLibraryPath() {
    const msg = { type: 'BROWSE_LIBRARY_PATH' };
    if (this.isInJuce()) {
      if (window.__juce__) window.__juce__.postMessage(JSON.stringify(msg));
      else if (window.sendToJuce) window.sendToJuce(msg);
    } else {
      setTimeout(() => {
        const mockPath = '/Users/mockuser/Library/Audio/Samples/VST GOD';
        if (window.__godRealmLibraryPathSelected) {
          window.__godRealmLibraryPathSelected(mockPath);
        }
      }, 500);
    }
  }
}

export const nativeAudio = new NativeAudioBridge();
