/**
 * MasterAnalyzer — Production-grade metering & analysis engine.
 *
 * Taps into the master chain's output to provide:
 *  - FFT spectrum data (logarithmic frequency mapping)
 *  - Per-channel peak & RMS levels
 *  - Integrated LUFS loudness measurement
 *  - Stereo correlation coefficient
 *  - Time-domain waveform data for oscilloscope
 *
 * All data is returned via getSnapshot() which should be called once per rAF.
 */

/* ═══ Types ═══ */
export interface MeterSnapshot {
  /* FFT spectrum (magnitude in dB, log-frequency mapped) */
  spectrum: Float32Array;
  spectrumSize: number;

  /* Per-channel levels */
  peakL: number;     // 0–1
  peakR: number;     // 0–1
  rmsL: number;      // 0–1
  rmsR: number;      // 0–1

  /* Peak hold (slow decay) */
  peakHoldL: number;
  peakHoldR: number;

  /* Clip indicators */
  clipL: boolean;
  clipR: boolean;

  /* Integrated LUFS (running average) */
  lufs: number;

  /* Stereo correlation: -1 (out of phase) → 0 (uncorrelated) → +1 (mono) */
  correlation: number;

  /* Time-domain waveform (interleaved L/R for oscilloscope) */
  waveformL: Float32Array;
  waveformR: Float32Array;
}

/* ═══ Constants ═══ */
const FFT_SIZE = 2048;
const PEAK_HOLD_DECAY = 0.9985;  // ~3dB/s at 60fps
const PEAK_HOLD_RESET_FRAMES = 120; // hold for 2s then decay
const CLIP_HOLD_FRAMES = 30;    // hold clip indicator for 0.5s
const LUFS_WINDOW_SEC = 3;      // 3-second LUFS integration

/* ═══ MasterAnalyzer Class ═══ */

export class MasterAnalyzer {
  private ctx: AudioContext;
  private splitter: ChannelSplitterNode;
  private analyserL: AnalyserNode;
  private analyserR: AnalyserNode;
  private analyserMaster: AnalyserNode;

  // Data buffers
  private freqDataMaster: Float32Array;
  private timeDataL: Float32Array;
  private timeDataR: Float32Array;
  private freqByteData: Uint8Array;

  // Peak hold state
  private peakHoldL = 0;
  private peakHoldR = 0;
  private peakHoldFramesL = 0;
  private peakHoldFramesR = 0;

  // Clip state
  private clipFramesL = 0;
  private clipFramesR = 0;

  // LUFS integration
  private lufsBuffer: number[] = [];
  private lufsFrameCount = 0;

  // Connection tracking
  private inputNode: AudioNode | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    // Stereo splitter for per-channel analysis
    this.splitter = ctx.createChannelSplitter(2);

    // Left channel analyser
    this.analyserL = ctx.createAnalyser();
    this.analyserL.fftSize = FFT_SIZE;
    this.analyserL.smoothingTimeConstant = 0.7;

    // Right channel analyser
    this.analyserR = ctx.createAnalyser();
    this.analyserR.fftSize = FFT_SIZE;
    this.analyserR.smoothingTimeConstant = 0.7;

    // Master spectrum analyser (stereo sum)
    this.analyserMaster = ctx.createAnalyser();
    this.analyserMaster.fftSize = FFT_SIZE;
    this.analyserMaster.smoothingTimeConstant = 0.8;
    this.analyserMaster.minDecibels = -90;
    this.analyserMaster.maxDecibels = 0;

    // Wire splitter → per-channel analysers
    this.splitter.connect(this.analyserL, 0);
    this.splitter.connect(this.analyserR, 1);

    // Allocate data buffers
    const binCount = this.analyserMaster.frequencyBinCount;
    this.freqDataMaster = new Float32Array(binCount);
    this.timeDataL = new Float32Array(FFT_SIZE);
    this.timeDataR = new Float32Array(FFT_SIZE);
    this.freqByteData = new Uint8Array(binCount);
  }

  /** Connect to the master chain's output node */
  connect(sourceNode: AudioNode): void {
    this.inputNode = sourceNode;
    sourceNode.connect(this.splitter);
    sourceNode.connect(this.analyserMaster);
  }

  /** Disconnect from the master chain */
  disconnect(): void {
    if (this.inputNode) {
      try {
        this.inputNode.disconnect(this.splitter);
        this.inputNode.disconnect(this.analyserMaster);
      } catch { /* already disconnected */ }
      this.inputNode = null;
    }
  }

  /** Get all meter data for one frame (call once per rAF) */
  getSnapshot(): MeterSnapshot {
    // Get frequency data for spectrum
    this.analyserMaster.getFloatFrequencyData(this.freqDataMaster);

    // Get time-domain data for per-channel metering + oscilloscope
    this.analyserL.getFloatTimeDomainData(this.timeDataL);
    this.analyserR.getFloatTimeDomainData(this.timeDataR);

    // ─── Peak & RMS calculation ───
    let sumSqL = 0, sumSqR = 0;
    let maxL = 0, maxR = 0;

    const len = this.timeDataL.length;
    for (let i = 0; i < len; i++) {
      const sL = Math.abs(this.timeDataL[i]);
      const sR = Math.abs(this.timeDataR[i]);
      if (sL > maxL) maxL = sL;
      if (sR > maxR) maxR = sR;
      sumSqL += this.timeDataL[i] * this.timeDataL[i];
      sumSqR += this.timeDataR[i] * this.timeDataR[i];
    }

    const rmsL = Math.sqrt(sumSqL / len);
    const rmsR = Math.sqrt(sumSqR / len);
    const peakL = maxL;
    const peakR = maxR;

    // ─── Peak hold with decay ───
    if (peakL >= this.peakHoldL) {
      this.peakHoldL = peakL;
      this.peakHoldFramesL = 0;
    } else {
      this.peakHoldFramesL++;
      if (this.peakHoldFramesL > PEAK_HOLD_RESET_FRAMES) {
        this.peakHoldL *= PEAK_HOLD_DECAY;
      }
    }

    if (peakR >= this.peakHoldR) {
      this.peakHoldR = peakR;
      this.peakHoldFramesR = 0;
    } else {
      this.peakHoldFramesR++;
      if (this.peakHoldFramesR > PEAK_HOLD_RESET_FRAMES) {
        this.peakHoldR *= PEAK_HOLD_DECAY;
      }
    }

    // ─── Clip detection ───
    if (peakL >= 0.99) this.clipFramesL = CLIP_HOLD_FRAMES;
    else if (this.clipFramesL > 0) this.clipFramesL--;

    if (peakR >= 0.99) this.clipFramesR = CLIP_HOLD_FRAMES;
    else if (this.clipFramesR > 0) this.clipFramesR--;

    // ─── LUFS (simplified: RMS-based integrated loudness) ───
    const monoRms = Math.sqrt((sumSqL + sumSqR) / (len * 2));
    const instantLufs = monoRms > 0.0001 ? 20 * Math.log10(monoRms) - 0.691 : -Infinity;

    if (isFinite(instantLufs)) {
      this.lufsBuffer.push(instantLufs);
      const maxSamples = Math.ceil(LUFS_WINDOW_SEC * 60); // ~60fps
      if (this.lufsBuffer.length > maxSamples) {
        this.lufsBuffer.shift();
      }
    }

    const lufs = this.lufsBuffer.length > 0
      ? this.lufsBuffer.reduce((a, b) => a + b, 0) / this.lufsBuffer.length
      : -Infinity;

    // ─── Stereo correlation ───
    let sumLR = 0, sumLL = 0, sumRR = 0;
    for (let i = 0; i < len; i++) {
      sumLR += this.timeDataL[i] * this.timeDataR[i];
      sumLL += this.timeDataL[i] * this.timeDataL[i];
      sumRR += this.timeDataR[i] * this.timeDataR[i];
    }
    const denom = Math.sqrt(sumLL * sumRR);
    const correlation = denom > 0.0001 ? sumLR / denom : 1;

    return {
      spectrum: this.freqDataMaster,
      spectrumSize: this.freqDataMaster.length,
      peakL, peakR,
      rmsL, rmsR,
      peakHoldL: this.peakHoldL,
      peakHoldR: this.peakHoldR,
      clipL: this.clipFramesL > 0,
      clipR: this.clipFramesR > 0,
      lufs,
      correlation,
      waveformL: this.timeDataL,
      waveformR: this.timeDataR,
    };
  }

  /** Cleanup */
  dispose(): void {
    this.disconnect();
    try {
      this.splitter.disconnect();
      this.analyserL.disconnect();
      this.analyserR.disconnect();
      this.analyserMaster.disconnect();
    } catch { /* noop */ }
  }
}
