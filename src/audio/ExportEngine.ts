/**
 * ExportEngine — High-quality WAV rendering for Sacred Sequencer.
 * Uses OfflineAudioContext to render the loop at high resolution.
 * Supports both sample and synth tracks with full FXRack processing.
 */

import { SequencerState, StepState, TrackState } from '../components/sequencer/useSequencerEngine';
import { MasterChain } from './VelvetCurveEngine';
import { FXRack } from './FXRack';
import { PantheonSynthEngine } from './PantheonSynthEngine';
import { sampleManager } from '../components/sequencer/SampleManager';

export class ExportEngine {
  /**
   * Renders the current pattern to a WAV blob.
   * Handles sample tracks, synth tracks, and FX processing.
   */
  static async renderToWav(
    state: SequencerState,
    buffers: Record<number, AudioBuffer>
  ): Promise<Blob> {
    const { bpm, stepCount, tracks, activePattern } = state;
    const sampleRate = 48000; // Divine resolution
    const stepDuration = 60 / bpm / 4;
    const totalDuration = stepCount * stepDuration;
    
    // Create Offline Context (extra tail for reverb/delay)
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * (totalDuration + 2)), sampleRate);

    // Setup Master Chain in Offline Context
    const masterChain = new MasterChain(offlineCtx);
    masterChain.updateParams(state.master);
    masterChain.connect(offlineCtx.destination);

    // Setup FX Rack in Offline Context
    const fxRack = new FXRack(offlineCtx, masterChain.input);
    fxRack.updateBPM(bpm);

    // Collect synth engines for cleanup
    const synthEngines: PantheonSynthEngine[] = [];

    // Schedule Triggers
    tracks.forEach((track, trackIdx) => {
      if (track.muted) return;
      
      const pattern = activePattern === 'A' ? track.patternA : track.patternB;
      const polyLength = track.polymetricLength;

      // Create per-track FX sends
      const sends = fxRack.createTrackSends(trackIdx, track.fxSends);

      // ═══ SYNTH TRACK ═══
      if (track.sourceType === 'synth' && track.synthConfig) {
        const engine = new PantheonSynthEngine();
        engine.init(offlineCtx, sends.dry); // Route through FX sends dry bus
        engine.setGod(track.synthConfig.godId);
        synthEngines.push(engine);

        for (let stepIdx = 0; stepIdx < stepCount; stepIdx++) {
          const polyStep = stepIdx % polyLength;
          const step = pattern[polyStep];
          
          if (step.enabled) {
            const time = stepIdx * stepDuration;
            const baseNote = track.synthConfig.noteMap[step.sliceIndex] ?? 60;
            const midiNote = baseNote + (track.synthConfig.octave * 12);
            const decaySec = Math.max(0.05, step.decay * 2.0);

            // Schedule noteOn
            const noteOnTime = time;
            const noteOffTime = time + decaySec;

            // For offline rendering, we use direct scheduling via setTimeout equivalent
            // In OfflineAudioContext, we need to schedule notes at exact times
            // The engine's noteOn/noteOff use currentTime internally,
            // so we schedule them using OfflineAudioContext timing
            this.scheduleOfflineSynth(
              offlineCtx, engine, midiNote, step.velocity, noteOnTime, noteOffTime
            );
          }
        }
        return;
      }

      // ═══ SAMPLE TRACK ═══
      const originalBuffer = buffers[trackIdx];
      if (!originalBuffer) return;

      for (let stepIdx = 0; stepIdx < stepCount; stepIdx++) {
        const polyStep = stepIdx % polyLength;
        const step = pattern[polyStep];
        
        if (step.enabled) {
          const time = stepIdx * stepDuration;
          
          // Handle Retrigs
          if (step.retrigRate) {
            const divisions: Record<string, number> = {
              '1/2': 2, '1/4': 4, '1/8': 8, '1/16': 16, '1/32': 32
            };
            const count = divisions[step.retrigRate] || 1;
            const subStepDuration = stepDuration / count;

            for (let i = 0; i < count; i++) {
              const subTime = time + (i * subStepDuration);
              let subVelocity = step.velocity;
              
              if (step.retrigVelocityCurve === 'rampUp') {
                subVelocity = step.velocity * (0.3 + (0.7 * (i / (count - 1 || 1))));
              } else if (step.retrigVelocityCurve === 'rampDown') {
                subVelocity = step.velocity * (1.0 - (0.7 * (i / (count - 1 || 1))));
              } else if (step.retrigVelocityCurve === 'random') {
                subVelocity = step.velocity * (0.5 + Math.random() * 0.5);
              }

              const subStep = { ...step, velocity: subVelocity };
              this.scheduleSample(offlineCtx, originalBuffer, subStep, subTime, track, sends);
            }
          } else {
            this.scheduleSample(offlineCtx, originalBuffer, step, time, track, sends);
          }
        }
      }
    });

    const renderedBuffer = await offlineCtx.startRendering();

    // Cleanup
    synthEngines.forEach(e => e.dispose());
    fxRack.dispose();

    return this.audioBufferToWav(renderedBuffer);
  }

  /**
   * Renders a single track to a WAV blob (for stem export).
   */
  static async renderStem(
    state: SequencerState,
    trackIdx: number,
    buffer?: AudioBuffer
  ): Promise<Blob> {
    const { bpm, stepCount, tracks, activePattern } = state;
    const sampleRate = 48000;
    const stepDuration = 60 / bpm / 4;
    const totalDuration = stepCount * stepDuration;
    const track = tracks[trackIdx];
    
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * (totalDuration + 2)), sampleRate);

    const masterChain = new MasterChain(offlineCtx);
    masterChain.updateParams({ ...state.master, volume: 1.0 }); // Full volume for stems
    masterChain.connect(offlineCtx.destination);

    // FX Rack for stems too
    const fxRack = new FXRack(offlineCtx, masterChain.input);
    fxRack.updateBPM(bpm);
    const sends = fxRack.createTrackSends(trackIdx, track.fxSends);

    const pattern = activePattern === 'A' ? track.patternA : track.patternB;
    const polyLength = track.polymetricLength;

    const synthEngines: PantheonSynthEngine[] = [];

    // ═══ SYNTH STEM ═══
    if (track.sourceType === 'synth' && track.synthConfig) {
      const engine = new PantheonSynthEngine();
      engine.init(offlineCtx, sends.dry);
      engine.setGod(track.synthConfig.godId);
      synthEngines.push(engine);

      for (let stepIdx = 0; stepIdx < stepCount; stepIdx++) {
        const polyStep = stepIdx % polyLength;
        const step = pattern[polyStep];
        if (step.enabled) {
          const time = stepIdx * stepDuration;
          const baseNote = track.synthConfig.noteMap[step.sliceIndex] ?? 60;
          const midiNote = baseNote + (track.synthConfig.octave * 12);
          const decaySec = Math.max(0.05, step.decay * 2.0);
          this.scheduleOfflineSynth(offlineCtx, engine, midiNote, step.velocity, time, time + decaySec);
        }
      }
    }

    // ═══ SAMPLE STEM ═══
    if (track.sourceType !== 'synth' && buffer) {
      for (let stepIdx = 0; stepIdx < stepCount; stepIdx++) {
        const polyStep = stepIdx % polyLength;
        const step = pattern[polyStep];
        if (step.enabled) {
          const time = stepIdx * stepDuration;
          this.scheduleSample(offlineCtx, buffer, step, time, track, sends);
        }
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    synthEngines.forEach(e => e.dispose());
    fxRack.dispose();
    return this.audioBufferToWav(renderedBuffer);
  }

  /**
   * Schedule a synth note at exact offline times.
   * Uses suspend/resume to trigger noteOn/Off at the right moments.
   */
  private static scheduleOfflineSynth(
    ctx: OfflineAudioContext,
    engine: PantheonSynthEngine,
    midi: number,
    velocity: number,
    onTime: number,
    offTime: number
  ): void {
    // OfflineAudioContext.suspend() schedules a callback at exact sample frame
    // We queue noteOn and noteOff at their respective times
    const safeOnTime = Math.max(0, onTime);
    const safeOffTime = Math.max(safeOnTime + 0.01, offTime);

    ctx.suspend(safeOnTime).then(() => {
      engine.noteOn(midi, velocity);
      ctx.resume();
    });

    ctx.suspend(safeOffTime).then(() => {
      engine.noteOff(midi);
      ctx.resume();
    });
  }

  private static scheduleSample(
    ctx: BaseAudioContext,
    originalBuffer: AudioBuffer,
    step: StepState,
    time: number,
    track: TrackState,
    sends: { dry: GainNode; reverb: GainNode; chorus: GainNode; delay: GainNode; saturation: GainNode }
  ) {
    const params = track.sampleParams;
    let slice = null;
    if (params.slices && params.slices.length > 0 && step.sliceIndex > 0) {
      slice = params.slices[step.sliceIndex - 1];
    }

    const isGlobalReverse = !!params.reverse;
    const isSliceReverse = !!slice?.reverse;
    const actualReverse = isGlobalReverse !== isSliceReverse;

    // Use sampleManager to get reversed buffer
    const bufferToUse = actualReverse 
      ? sampleManager.reverseBuffer(ctx as any, originalBuffer)
      : originalBuffer;

    const source = ctx.createBufferSource();
    source.buffer = bufferToUse;

    let startNorm = slice ? slice.start : params.start;
    let endNorm = slice ? slice.end : params.end;

    let startTime, duration;
    if (actualReverse) {
      startTime = (1.0 - endNorm) * originalBuffer.duration;
      duration = (endNorm - startNorm) * originalBuffer.duration;
    } else {
      startTime = startNorm * originalBuffer.duration;
      duration = (endNorm - startNorm) * originalBuffer.duration;
    }

    duration = Math.max(0.001, duration);

    // Pitch
    let playbackRate = Math.pow(2, step.pitch / 12);
    source.playbackRate.setValueAtTime(playbackRate, time);

    // Looping
    const shouldLoop = slice ? !!slice.loop : !!params.loop;
    if (shouldLoop) {
      source.loop = true;
      if (actualReverse) {
        source.loopStart = (1.0 - endNorm) * originalBuffer.duration;
        source.loopEnd = (1.0 - startNorm) * originalBuffer.duration;
      } else {
        source.loopStart = startNorm * originalBuffer.duration;
        source.loopEnd = endNorm * originalBuffer.duration;
      }
    }

    // Gain / Velocity / Decay
    const gain = ctx.createGain();
    const velocityGain = step.velocity / 127;
    const sliceVolume = slice?.volume ?? 1.0;
    const initialGain = velocityGain * track.volume * sliceVolume * 0.7;
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(initialGain, time + 0.003);
    
    const decayTime = 0.05 + step.decay * 2.0; 
    gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

    // Panning (step pan + track-level pan)
    const panner = ctx.createStereoPanner();
    const combinedPan = Math.max(-1, Math.min(1, step.pan + (track.pan ?? 0)));
    panner.pan.setValueAtTime(combinedPan, time);

    // Route through per-track FX sends
    source.connect(gain).connect(panner);
    panner.connect(sends.dry);
    panner.connect(sends.reverb);
    panner.connect(sends.chorus);
    panner.connect(sends.delay);
    panner.connect(sends.saturation);

    source.start(time, startTime, shouldLoop ? undefined : duration);
    source.stop(time + decayTime + 0.1);
  }

  /**
   * Encodes AudioBuffer to WAV format (32-bit Float).
   */
  private static audioBufferToWav(buffer: AudioBuffer): Blob {
    // Divine Normalization to -0.1dB
    this.normalizeBuffer(buffer, -0.1);

    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 3; // IEEE Float
    const bitDepth = 32;

    const blockAlign = numChannels * (bitDepth / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;

    const headerSize = 44;
    const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(arrayBuffer);

    // RIFF identifier
    this.writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + dataSize, true);
    // WAVE identifier
    this.writeString(view, 8, 'WAVE');
    // format chunk identifier
    this.writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (3 = IEEE Float)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, byteRate, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, blockAlign, true);
    // bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    this.writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataSize, true);

    const offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        view.setFloat32(offset + (i * blockAlign) + (channel * 4), sample, true);
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  private static writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  private static normalizeBuffer(buffer: AudioBuffer, targetDb: number): void {
    const targetGain = Math.pow(10, targetDb / 20);
    let maxPeak = 0;
    
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      const data = buffer.getChannelData(i);
      for (let j = 0; j < data.length; j++) {
        const abs = Math.abs(data[j]);
        if (abs > maxPeak) maxPeak = abs;
      }
    }
    
    if (maxPeak > 0) {
      const ratio = targetGain / maxPeak;
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        const data = buffer.getChannelData(i);
        for (let j = 0; j < data.length; j++) {
          data[j] *= ratio;
        }
      }
    }
  }
}
