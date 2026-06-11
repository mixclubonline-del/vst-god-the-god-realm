/**
 * AudioInputRecorder — Capture mic/line-in audio to an AudioBuffer.
 *
 * Uses MediaStream + MediaStreamAudioSourceNode → ScriptProcessorNode
 * to accumulate PCM samples in Float32Arrays, then assembles into
 * an AudioBuffer when recording stops.
 *
 * Supports:
 *  - Mono/stereo capture
 *  - Configurable sample rate
 *  - Real-time level metering callback
 *  - Max duration safety limit
 */

/* ═══ Types ═══ */
export interface RecordingState {
  isRecording: boolean;
  duration: number;       // seconds elapsed
  peakLevel: number;      // 0–1 current peak
  channelCount: number;
}

export type RecordingLevelCallback = (state: RecordingState) => void;

export interface RecorderOptions {
  channelCount?: 1 | 2;
  sampleRate?: number;
  maxDurationSeconds?: number;  // safety limit, default 300s (5 min)
  bufferSize?: number;          // ScriptProcessor buffer size
  onLevel?: RecordingLevelCallback;
}

/* ═══ AudioInputRecorder Class ═══ */

export class AudioInputRecorder {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private recordedChunks: Float32Array[][] = []; // [chunk][channel]
  private isRecording = false;
  private startTime = 0;
  private options: Required<RecorderOptions>;
  private totalSamples = 0;

  constructor(options: RecorderOptions = {}) {
    this.options = {
      channelCount: options.channelCount ?? 1,
      sampleRate: options.sampleRate ?? 44100,
      maxDurationSeconds: options.maxDurationSeconds ?? 300,
      bufferSize: options.bufferSize ?? 4096,
      onLevel: options.onLevel ?? (() => {}),
    };
  }

  /* ─── Request Microphone Access ─── */
  async requestAccess(): Promise<MediaStream> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.options.channelCount,
          sampleRate: this.options.sampleRate,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      return this.stream;
    } catch (err) {
      throw new Error(`Microphone access denied: ${(err as Error).message}`);
    }
  }

  /* ─── Start Recording ─── */
  async start(existingCtx?: AudioContext): Promise<void> {
    if (this.isRecording) {
      console.warn('[AudioInputRecorder] Already recording');
      return;
    }

    if (!this.stream) {
      await this.requestAccess();
    }

    this.audioCtx = existingCtx || new AudioContext({ sampleRate: this.options.sampleRate });

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream!);

    // ScriptProcessorNode for capturing raw PCM
    // (AudioWorklet would be better but ScriptProcessor is simpler and more compatible)
    this.processorNode = this.audioCtx.createScriptProcessor(
      this.options.bufferSize,
      this.options.channelCount,
      this.options.channelCount
    );

    this.recordedChunks = [];
    this.totalSamples = 0;
    this.startTime = performance.now();
    this.isRecording = true;

    const maxSamples = this.options.maxDurationSeconds * this.options.sampleRate;

    this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!this.isRecording) return;

      // Safety limit
      if (this.totalSamples >= maxSamples) {
        this.stop();
        return;
      }

      const chunk: Float32Array[] = [];
      let peak = 0;

      for (let ch = 0; ch < this.options.channelCount; ch++) {
        const input = e.inputBuffer.getChannelData(ch);
        const copy = new Float32Array(input.length);
        copy.set(input);
        chunk.push(copy);

        // Peak detection
        for (let i = 0; i < input.length; i++) {
          const abs = Math.abs(input[i]);
          if (abs > peak) peak = abs;
        }
      }

      this.recordedChunks.push(chunk);
      this.totalSamples += chunk[0].length;

      // Level callback
      const elapsed = (performance.now() - this.startTime) / 1000;
      this.options.onLevel({
        isRecording: true,
        duration: elapsed,
        peakLevel: peak,
        channelCount: this.options.channelCount,
      });
    };

    // Connect: source → processor → destination (must connect to destination for processing to work)
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioCtx.destination);

    console.log(`[AudioInputRecorder] Recording started (${this.options.channelCount}ch, ${this.options.sampleRate}Hz)`);
  }

  /* ─── Stop Recording & Return Buffer ─── */
  stop(): AudioBuffer | null {
    if (!this.isRecording) return null;

    this.isRecording = false;

    // Disconnect nodes
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    // Assemble recorded chunks into a single AudioBuffer
    if (this.totalSamples === 0 || this.recordedChunks.length === 0) {
      console.warn('[AudioInputRecorder] No audio captured');
      return null;
    }

    const sampleRate = this.audioCtx?.sampleRate ?? this.options.sampleRate;
    const channels = this.options.channelCount;

    // Create output buffer (use the live AudioContext for compatibility, not offline)
    const outputBuffer = new AudioBuffer({
      numberOfChannels: channels,
      length: this.totalSamples,
      sampleRate,
    });

    // Copy chunks into output buffer
    for (let ch = 0; ch < channels; ch++) {
      const output = outputBuffer.getChannelData(ch);
      let offset = 0;
      for (const chunk of this.recordedChunks) {
        output.set(chunk[ch], offset);
        offset += chunk[ch].length;
      }
    }

    // Final level callback
    const elapsed = (performance.now() - this.startTime) / 1000;
    this.options.onLevel({
      isRecording: false,
      duration: elapsed,
      peakLevel: 0,
      channelCount: channels,
    });

    // Cleanup
    this.recordedChunks = [];
    this.totalSamples = 0;

    console.log(`[AudioInputRecorder] Recording stopped: ${outputBuffer.duration.toFixed(2)}s, ${channels}ch`);

    return outputBuffer;
  }

  /* ─── Release Resources ─── */
  dispose(): void {
    this.stop();

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    this.sourceNode = null;
    this.processorNode = null;
    // Don't close audioCtx if it was passed in externally
  }

  /* ─── Query State ─── */
  get recording(): boolean {
    return this.isRecording;
  }

  get elapsed(): number {
    if (!this.isRecording) return 0;
    return (performance.now() - this.startTime) / 1000;
  }
}
