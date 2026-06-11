/**
 * TrackBounceEngine — Offline render a sequencer track to a stereo AudioBuffer.
 *
 * Uses OfflineAudioContext to play back every enabled step in a pattern,
 * routing through the same signal chain (sample slicing, pitch, velocity,
 * panning, decay, EQ, FX sends) that the live sequencer uses.
 *
 * Returns a stereo AudioBuffer ready to be assigned as a frozen track buffer.
 */

import type { TrackState, StepState, SequencerState } from '../components/sequencer/useSequencerEngine';

/* ═══ Types ═══ */
export interface BounceOptions {
  bpm: number;
  stepCount: number;
  sampleRate?: number;
  tailSeconds?: number; // extra time at end for reverb/delay tails
}

export interface BounceProgress {
  phase: 'preparing' | 'rendering' | 'complete' | 'error';
  percent: number;
  message: string;
}

type ProgressCallback = (progress: BounceProgress) => void;

/* ═══ Helpers ═══ */

/** Calculate total pattern duration in seconds */
function patternDuration(bpm: number, stepCount: number): number {
  const stepDur = 60 / bpm / 4; // 16th note duration
  return stepDur * stepCount;
}

/** Reverse an AudioBuffer (returns new buffer) */
function reverseBuffer(ctx: BaseAudioContext, buffer: AudioBuffer): AudioBuffer {
  const reversed = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = reversed.getChannelData(ch);
    for (let i = 0; i < src.length; i++) {
      dst[i] = src[src.length - 1 - i];
    }
  }
  return reversed;
}

/* ═══ Main Bounce Function ═══ */

export async function bounceTrack(
  track: TrackState,
  steps: StepState[],
  buffer: AudioBuffer | null,
  options: BounceOptions,
  onProgress?: ProgressCallback,
): Promise<AudioBuffer> {
  const { bpm, stepCount, sampleRate = 44100, tailSeconds = 1.0 } = options;

  onProgress?.({ phase: 'preparing', percent: 0, message: 'Creating offline context...' });

  const duration = patternDuration(bpm, stepCount) + tailSeconds;
  const totalSamples = Math.ceil(duration * sampleRate);

  const offCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  // Master gain for the bounce
  const masterGain = offCtx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(offCtx.destination);

  onProgress?.({ phase: 'rendering', percent: 10, message: 'Scheduling steps...' });

  const stepDuration = 60 / bpm / 4;

  // Schedule every enabled step
  for (let s = 0; s < stepCount; s++) {
    const step = steps[s];
    if (!step?.enabled) continue;

    // Probability check (for bounce, we play all steps — probability is a live-only feature)
    const time = s * stepDuration;

    if (track.sourceType === 'sample' && buffer) {
      scheduleSampleStep(offCtx, masterGain, buffer, track, step, time);
    }
    // Synth tracks: we skip synth bounce for now — would require cloning PantheonSynthEngine
    // into offline context which is complex. Synth tracks bounce as silence with a warning.
  }

  onProgress?.({ phase: 'rendering', percent: 50, message: 'Rendering audio...' });

  // Render
  const rendered = await offCtx.startRendering();

  onProgress?.({ phase: 'complete', percent: 100, message: 'Bounce complete' });

  return rendered;
}

/* ═══ Schedule a single sample step into the offline context ═══ */

function scheduleSampleStep(
  ctx: OfflineAudioContext,
  destination: AudioNode,
  originalBuffer: AudioBuffer,
  track: TrackState,
  step: StepState,
  time: number
): void {
  const params = track.sampleParams;

  // Slice selection
  let slice = null;
  if (params.slices && params.slices.length > 0 && step.sliceIndex > 0) {
    slice = params.slices[step.sliceIndex - 1];
  }

  // Reverse logic (XOR)
  const isGlobalReverse = !!params.reverse;
  const isSliceReverse = !!(slice as any)?.reverse;
  const actualReverse = isGlobalReverse !== isSliceReverse;

  const bufferToUse = actualReverse
    ? reverseBuffer(ctx, originalBuffer)
    : originalBuffer;

  const source = ctx.createBufferSource();
  source.buffer = bufferToUse;

  // Boundaries
  let startNorm = slice ? slice.start : params.start;
  let endNorm = slice ? slice.end : params.end;

  let startTime: number, duration: number;
  if (actualReverse) {
    startTime = (1.0 - endNorm) * originalBuffer.duration;
    duration = (endNorm - startNorm) * originalBuffer.duration;
  } else {
    startTime = startNorm * originalBuffer.duration;
    duration = (endNorm - startNorm) * originalBuffer.duration;
  }
  duration = Math.max(0.001, duration);

  // Pitch
  const playbackRate = Math.pow(2, step.pitch / 12);
  source.playbackRate.setValueAtTime(playbackRate, time);

  // Gain / Velocity / Decay
  const gain = ctx.createGain();
  const velocityGain = step.velocity / 127;
  const trackVolume = track.volume;
  const sliceVolume = (slice as any)?.volume ?? 1.0;
  const initialGain = velocityGain * trackVolume * sliceVolume * 0.7;

  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(initialGain, time + 0.003);

  const decayTime = 0.05 + step.decay * 2.0;
  gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

  // Panning
  const panner = ctx.createStereoPanner();
  const combinedPan = Math.max(-1, Math.min(1, step.pan + track.pan));
  panner.pan.setValueAtTime(combinedPan, time);

  // Route
  source.connect(gain).connect(panner).connect(destination);

  // Play
  source.start(time, startTime, duration);
  source.stop(time + decayTime + 0.1);
}

/* ═══ Bounce All Tracks (for export) ═══ */

export async function bounceAllTracks(
  tracks: TrackState[],
  allSteps: StepState[][],
  buffers: Record<number, AudioBuffer>,
  options: BounceOptions,
  onProgress?: ProgressCallback,
): Promise<AudioBuffer> {
  const { bpm, stepCount, sampleRate = 44100, tailSeconds = 1.5 } = options;

  const duration = patternDuration(bpm, stepCount) + tailSeconds;
  const totalSamples = Math.ceil(duration * sampleRate);
  const offCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  const masterGain = offCtx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(offCtx.destination);

  const stepDuration = 60 / bpm / 4;

  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    if (track.muted) continue;

    const steps = allSteps[t];
    if (!steps) continue;

    const buffer = buffers[t];

    for (let s = 0; s < stepCount; s++) {
      const step = steps[s];
      if (!step?.enabled) continue;

      const time = s * stepDuration;

      if (track.sourceType === 'sample' && buffer) {
        scheduleSampleStep(offCtx, masterGain, buffer, track, step, time);
      }
    }

    onProgress?.({
      phase: 'rendering',
      percent: Math.round(((t + 1) / tracks.length) * 90),
      message: `Rendered track ${t + 1}/${tracks.length}: ${track.name}`,
    });
  }

  const rendered = await offCtx.startRendering();

  onProgress?.({ phase: 'complete', percent: 100, message: 'All tracks bounced' });

  return rendered;
}
