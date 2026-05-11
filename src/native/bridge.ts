export interface ParameterChange {
  id: string;
  value: number | string | boolean;
}

export interface EngineState {
  sampleRate: number;
  bufferSize: number;
  isPlaying: boolean;
  cpuUsage: number;
  memoryUsage: number;
  // Specific to God Realm
  moduleLevels: Record<string, number>;
  slotLevels: number[];
  arpStep: number;
  vortexAnchors: Array<{x: number, y: number, name: string}>;
}

// Ensure window.__juce__ or equivalent is recognized
declare global {
  interface Window {
    __juce__?: {
      postMessage: (message: string) => void;
    };
    sendToJuce?: (message: any) => void;
  }
}

class NativeAudioBridge {
  private listeners: Set<(state: Partial<EngineState>) => void> = new Set();
  
  // Simulated State for Development without actual JUCE backend attached
  private simulatedState: EngineState = {
    sampleRate: 44100,
    bufferSize: 512,
    isPlaying: false,
    cpuUsage: 1.2,
    memoryUsage: 42.8,
    moduleLevels: {},
    slotLevels: new Array(6).fill(0),
    arpStep: 0,
    vortexAnchors: []
  };

  constructor() {
    // Start simulation loop for UI feedback when not inside JUCE
    if (!this.isInJuce()) {
      this.startSimulation();
    }
    
    // Set up incoming message listener from JUCE
    if (typeof window !== 'undefined') {
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
  }

  private isInJuce(): boolean {
    return typeof window !== 'undefined' && 
           (!!window.__juce__ || !!window.sendToJuce);
  }

  private startSimulation() {
    setInterval(() => {
      // Simulate moving levels
      const newLevels = this.simulatedState.slotLevels.map(l => {
        const target = Math.random() > 0.8 ? Math.random() : Math.max(0, l - 0.1);
        return l + (target - l) * 0.5;
      });
      
      this.simulatedState.slotLevels = newLevels;
      this.simulatedState.arpStep = (this.simulatedState.arpStep + 1) % 16;
      
      this.notifyListeners({
        slotLevels: newLevels,
        arpStep: this.simulatedState.arpStep
      });
    }, 100);
  }

  public subscribe(callback: (state: Partial<EngineState>) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
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
