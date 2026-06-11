/**
 * SidechainEngine — True Sidechain Ducking for Per-Track Compression
 *
 * WebAudio doesn't natively support sidechain input on DynamicsCompressorNode,
 * so we implement it manually using an envelope follower on the source track
 * that modulates the target track's gain node.
 *
 * Architecture:
 *   Source Track (e.g., Kick) → AnalyserNode → envelope follower
 *   Target Track (e.g., Bass) → sidechainGain (modulated by envelope)
 *
 * Features:
 *   - Per-track sidechain source selection
 *   - Threshold, Ratio, Attack, Release, Hold
 *   - Depth (how much ducking 0-100%)
 *   - Visual gain reduction metering
 *   - Multiple targets can duck from the same source
 */

export interface SidechainConfig {
  enabled: boolean;
  sourceTrackIndex: number;   // -1 = none
  threshold: number;          // -60 to 0 dB
  ratio: number;              // 1:1 to 20:1
  attack: number;             // 0.1 to 100 ms
  release: number;            // 10 to 1000 ms
  hold: number;               // 0 to 200 ms
  depth: number;              // 0-100% (max gain reduction)
  lookahead: number;          // 0-10 ms
}

export const DEFAULT_SIDECHAIN_CONFIG: SidechainConfig = {
  enabled: false,
  sourceTrackIndex: -1,
  threshold: -24,
  ratio: 4,
  attack: 5,
  release: 150,
  hold: 20,
  depth: 80,
  lookahead: 2,
};

/**
 * SidechainProcessor — manages envelope following and gain modulation.
 *
 * One instance per target track that has sidechain enabled.
 * Reads audio levels from the source track's analyser and modulates
 * the target track's sidechain gain node.
 */
export class SidechainProcessor {
  private ctx: BaseAudioContext;
  private config: SidechainConfig;
  private sourceAnalyser: AnalyserNode | null = null;
  private targetGain: GainNode;
  private analyserBuffer: Float32Array | null = null;
  private currentReduction: number = 0; // 0 to 1 (how much we're ducking)
  private envelope: number = 0;
  private holdCounter: number = 0;
  private animFrameId: number | null = null;
  private isProcessing: boolean = false;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.config = { ...DEFAULT_SIDECHAIN_CONFIG };

    // Create the gain node that will be inserted in the target track's chain
    this.targetGain = ctx.createGain();
    this.targetGain.gain.value = 1.0;
  }

  /** Get the gain node to insert into the target track's audio chain */
  getGainNode(): GainNode {
    return this.targetGain;
  }

  /** Set the source analyser from which to read levels */
  setSourceAnalyser(analyser: AnalyserNode | null) {
    this.sourceAnalyser = analyser;
    if (analyser) {
      this.analyserBuffer = new Float32Array(analyser.fftSize);
    } else {
      this.analyserBuffer = null;
    }
  }

  /** Update sidechain config */
  setConfig(config: Partial<SidechainConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SidechainConfig {
    return { ...this.config };
  }

  /** Start the processing loop */
  start() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.process();
  }

  /** Stop the processing loop */
  stop() {
    this.isProcessing = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    // Reset gain to unity
    this.targetGain.gain.value = 1.0;
    this.currentReduction = 0;
    this.envelope = 0;
  }

  /** Main processing loop — runs at display refresh rate */
  private process = () => {
    if (!this.isProcessing) return;

    if (this.config.enabled && this.sourceAnalyser && this.analyserBuffer) {
      // Read source signal level
      this.sourceAnalyser.getFloatTimeDomainData(this.analyserBuffer);

      // Calculate peak level
      let peak = 0;
      for (let i = 0; i < this.analyserBuffer.length; i++) {
        const abs = Math.abs(this.analyserBuffer[i]);
        if (abs > peak) peak = abs;
      }

      // Convert to dB
      const peakDb = peak > 0 ? 20 * Math.log10(peak) : -100;

      // Envelope follower
      const attackCoeff = 1 - Math.exp(-1 / (this.config.attack * 0.001 * 60)); // ~60fps
      const releaseCoeff = 1 - Math.exp(-1 / (this.config.release * 0.001 * 60));

      if (peakDb > this.config.threshold) {
        // Above threshold — attack
        this.envelope += (1 - this.envelope) * attackCoeff;
        this.holdCounter = this.config.hold * 0.001 * 60; // hold in frames
      } else if (this.holdCounter > 0) {
        // Hold phase
        this.holdCounter--;
      } else {
        // Below threshold — release
        this.envelope *= (1 - releaseCoeff);
      }

      // Calculate gain reduction
      const excessDb = Math.max(0, peakDb - this.config.threshold);
      const reductionDb = excessDb * (1 - 1 / this.config.ratio);
      const maxReductionDb = (this.config.depth / 100) * 40; // depth% of 40dB max
      const appliedReductionDb = Math.min(reductionDb * this.envelope, maxReductionDb);

      // Convert to linear gain
      const gainLinear = Math.pow(10, -appliedReductionDb / 20);
      this.currentReduction = 1 - gainLinear;

      // Apply to gain node with smoothing
      const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
      this.targetGain.gain.setTargetAtTime(gainLinear, t, 0.005);
    } else {
      // Not active — ensure gain is 1.0
      if (this.currentReduction > 0.001) {
        const t = this.ctx instanceof AudioContext ? this.ctx.currentTime : 0;
        this.targetGain.gain.setTargetAtTime(1.0, t, 0.02);
        this.currentReduction *= 0.9;
        if (this.currentReduction < 0.001) this.currentReduction = 0;
      }
    }

    this.animFrameId = requestAnimationFrame(this.process);
  };

  /** Get current gain reduction (0 = no reduction, 1 = full silence) */
  getReduction(): number {
    return this.currentReduction;
  }

  /** Get current gain reduction in dB */
  getReductionDb(): number {
    if (this.currentReduction <= 0) return 0;
    return 20 * Math.log10(1 - this.currentReduction);
  }

  /** Cleanup */
  dispose() {
    this.stop();
    try { this.targetGain.disconnect(); } catch { /* ok */ }
  }
}
