/**
 * VelvetCurveEngine — The God Realm Master Signal Chain
 * High-fidelity saturation, silk extension, and transparent limiting.
 * Based on the MixxTech Doctrine for "sentient" audio processing.
 */

export interface MasterParams {
  drive: number;      // 0 to 4 (saturation amount)
  silk: number;       // 0 to 1 (high-end harmonics/saturation blend)
  body: number;       // -12 to 12 dB (low-end foundation)
  soul: number;       // -12 to 12 dB (mid-range warmth)
  air: number;        // -12 to 12 dB (high-end brightness)
  threshold: number;  // -24 to 0 (limiter threshold in dB)
  ceiling: number;    // -3 to 0 (hard ceiling in dB)
  volume: number;     // 0 to 1.5 (final make-up gain)
}

/**
 * Generates the proprietary Velvet Curve.
 * A hybrid atan-based shaper that adds warmth and even harmonics.
 */
export function makeVelvetCurve(drive: number, silk: number, samples: number = 4096): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    
    // Core saturation: hybrid atan for expensive-sounding transparency
    const driveScaled = drive * (1 + silk * 0.1);
    let y = (2 / Math.PI) * Math.atan(x * driveScaled);
    
    // Silk Stage: Add subtle even harmonics for high-end shimmer
    // This adds that "expensive" hardware sheen
    if (silk > 0) {
      const silkHarmonic = silk * 0.08 * Math.sin(Math.PI * y * 0.5);
      y += silkHarmonic * (1.0 - Math.abs(y));
    }
    
    curve[i] = Math.max(-0.999, Math.min(0.999, y));
  }
  return curve;
}

/**
 * Soft Clipper for master ceiling protection.
 */
export function makeSoftClipCurve(samples: number = 4096): Float32Array {
  const curve = new Float32Array(samples);
  const threshold = 0.85;
  const ceiling = 0.98; // Close to 0 dB but safe
  
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const absX = Math.abs(x);
    if (absX < threshold) {
      curve[i] = x;
    } else {
      const val = threshold + (ceiling - threshold) * Math.tanh((absX - threshold) / (ceiling - threshold));
      curve[i] = x > 0 ? val : -val;
    }
  }
  return curve;
}

export class MasterChain {
  private ctx: BaseAudioContext;
  public input: GainNode;
  public output: GainNode;
  
  private saturator: WaveShaperNode;
  
  // Silk EQ Bands (Four Anchors)
  private bodyFilter: BiquadFilterNode;
  private soulFilter: BiquadFilterNode;
  private airFilter: BiquadFilterNode;
  
  private limiter: DynamicsCompressorNode;
  private clipper: WaveShaperNode;
  private makeup: GainNode;
  public analyser: AnalyserNode;

  private lastDrive: number = -1;
  private lastSilk: number = -1;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    
    this.input = ctx.createGain();
    this.saturator = ctx.createWaveShaper();
    
    // Four Anchors EQ
    this.bodyFilter = ctx.createBiquadFilter();
    this.bodyFilter.type = 'lowshelf';
    this.bodyFilter.frequency.value = 200;
    
    this.soulFilter = ctx.createBiquadFilter();
    this.soulFilter.type = 'peaking';
    this.soulFilter.frequency.value = 1000;
    this.soulFilter.Q.value = 0.7;

    this.airFilter = ctx.createBiquadFilter();
    this.airFilter.type = 'highshelf';
    this.airFilter.frequency.value = 8000;

    this.limiter = ctx.createDynamicsCompressor();
    this.clipper = ctx.createWaveShaper();
    this.makeup = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.output = ctx.createGain();

    // Default Settings
    this.saturator.curve = makeVelvetCurve(1.0, 0.5);
    
    this.limiter.threshold.value = -0.5;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;

    this.clipper.curve = makeSoftClipCurve();
    this.analyser.fftSize = 4096; // Higher res for God Realm visuals

    // Routing: Input -> Body -> Soul -> Air -> Saturator -> Limiter -> Clipper -> Makeup -> Analyser -> Output
    this.input.connect(this.bodyFilter);
    this.bodyFilter.connect(this.soulFilter);
    this.soulFilter.connect(this.airFilter);
    this.airFilter.connect(this.saturator);
    this.saturator.connect(this.limiter);
    this.limiter.connect(this.clipper);
    this.clipper.connect(this.makeup);
    this.makeup.connect(this.analyser);
    this.analyser.connect(this.output);
  }

  public updateParams(params: MasterParams) {
    const time = this.ctx.currentTime;
    
    // Update Saturator Curve if params have changed
    if (params.drive !== this.lastDrive || params.silk !== this.lastSilk) {
      this.saturator.curve = makeVelvetCurve(params.drive, params.silk);
      this.lastDrive = params.drive;
      this.lastSilk = params.silk;
    }
    
    // Update EQ Bands
    this.bodyFilter.gain.setTargetAtTime(params.body, time, 0.1);
    this.soulFilter.gain.setTargetAtTime(params.soul, time, 0.1);
    this.airFilter.gain.setTargetAtTime(params.air, time, 0.1);
    
    // Update Limiter
    this.limiter.threshold.setTargetAtTime(params.threshold, time, 0.1);
    
    // Update Volume
    this.makeup.gain.setTargetAtTime(params.volume, time, 0.1);
  }

  public connect(destination: AudioNode) {
    this.output.connect(destination);
  }

  public disconnect() {
    this.output.disconnect();
  }
}

