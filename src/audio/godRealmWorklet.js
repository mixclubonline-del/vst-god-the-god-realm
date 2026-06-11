/**
 * GodRealmClockWorklet
 * 
 * An AudioWorkletProcessor that acts as a highly stable tick generator.
 * Unlike `setInterval` on the main thread, this clock runs on the Audio Thread.
 * It perfectly bypasses main-thread background tab throttling and UI jitter.
 * 
 * It sends a 'tick' message back to the main thread every N milliseconds.
 * The main thread uses this tick to drive the lookahead scheduler (Option A).
 */

class GodRealmClockWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    // Default tick interval: 25ms (standard for lookahead schedulers)
    // sampleRate is a global variable in AudioWorkletGlobalScope
    this.tickIntervalSamples = Math.floor(sampleRate * 0.025); 
    this.samplesSinceLastTick = 0;

    this.port.onmessage = (event) => {
      if (event.data.type === 'SET_INTERVAL') {
        const ms = event.data.intervalMs || 25;
        this.tickIntervalSamples = Math.floor(sampleRate * (ms / 1000));
      }
    };
  }

  process(inputs, outputs, parameters) {
    // We don't care about audio input/output here, just the passage of time.
    // process() is called every 128 samples.
    
    this.samplesSinceLastTick += 128; // standard Web Audio block size

    if (this.samplesSinceLastTick >= this.tickIntervalSamples) {
      this.samplesSinceLastTick -= this.tickIntervalSamples;
      
      // Post a tick to the main thread
      this.port.postMessage({ type: 'tick' });
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor('god-realm-clock-worklet', GodRealmClockWorklet);
