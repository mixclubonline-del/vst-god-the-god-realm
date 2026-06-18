/**
 * PantheonVoice.ts — Single FM Synthesis Voice
 * Each voice has: Carrier Osc + FM Modulator + Body Osc + Sub Osc + Filter + ADSR
 */

import type { GodVoicePreset } from './pantheonVoicePresets';

export class PantheonVoice {
  private ctx: BaseAudioContext;
  private carrier!: OscillatorNode;
  private modulator!: OscillatorNode;
  private modGain!: GainNode;
  private body!: OscillatorNode;
  private bodyGain!: GainNode;
  private sub!: OscillatorNode;
  private subGain!: GainNode;
  private filter!: BiquadFilterNode;
  private envelope!: GainNode;
  private output!: GainNode;

  public midi = -1;
  public active = false;
  public startTime = 0;
  private velocity = 0;
  public pantheonSubGain = 40;
  private releaseTimer: number | null = null;
  private preset: GodVoicePreset | null = null;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.buildGraph();
  }

  private buildGraph(): void {
    const ctx = this.ctx;

    // FM modulator → carrier
    this.modulator = ctx.createOscillator();
    this.modGain = ctx.createGain();
    this.modGain.gain.value = 0;
    this.modulator.connect(this.modGain);

    this.carrier = ctx.createOscillator();
    this.modGain.connect(this.carrier.frequency);

    // Body oscillator
    this.body = ctx.createOscillator();
    this.bodyGain = ctx.createGain();
    this.bodyGain.gain.value = 0;
    this.body.connect(this.bodyGain);

    // Sub oscillator
    this.sub = ctx.createOscillator();
    this.sub.type = 'sine';
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0;
    this.sub.connect(this.subGain);

    // Filter
    this.filter = ctx.createBiquadFilter();

    // Envelope
    this.envelope = ctx.createGain();
    this.envelope.gain.value = 0;

    // Output mixer
    this.output = ctx.createGain();
    this.output.gain.value = 1.0;

    // Routing: carrier + body + sub → filter → envelope → output
    this.carrier.connect(this.filter);
    this.bodyGain.connect(this.filter);
    this.subGain.connect(this.filter);
    this.filter.connect(this.envelope);
    this.envelope.connect(this.output);

    // Start oscillators (they run always; envelope gates sound)
    this.carrier.start();
    this.modulator.start();
    this.body.start();
    this.sub.start();
  }

  connect(dest: AudioNode): void {
    this.output.connect(dest);
  }

  disconnect(): void {
    this.output.disconnect();
  }

  applyPreset(p: GodVoicePreset): void {
    this.preset = p;
    this.carrier.type = p.carrier;
    this.body.type = p.bodyType;
    this.filter.type = p.filterType;
    this.filter.frequency.value = p.filterFreq;
    this.filter.Q.value = p.filterQ;
  }

  get hasPreset(): boolean {
    return this.preset !== null;
  }

  noteOn(midi: number, velocity: number, pitchBend = 0, time?: number): void {
    if (!this.preset) return;
    const p = this.preset;
    const now = time !== undefined ? time : this.ctx.currentTime;
    const freq = 440 * Math.pow(2, (midi - 69 + pitchBend) / 12);
    const vel = velocity / 127;

    if (this.releaseTimer !== null) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }

    this.midi = midi;
    this.active = true;
    this.startTime = now;
    this.velocity = vel;

    // Set frequencies
    this.carrier.frequency.setTargetAtTime(freq, now, 0.003);
    this.modulator.frequency.setTargetAtTime(freq * p.modRatio, now, 0.003);
    this.body.frequency.setTargetAtTime(freq, now, 0.003);
    this.sub.frequency.setTargetAtTime(freq * 0.5, now, 0.003);

    // FM depth
    this.modGain.gain.setTargetAtTime(freq * p.modIndex * vel, now, 0.003);

    // Body + Sub levels
    this.bodyGain.gain.setTargetAtTime(p.bodyGain * vel, now, 0.003);
    const subOscGainScaled = p.subOscGain * (this.pantheonSubGain / 100);
    this.subGain.gain.setTargetAtTime(subOscGainScaled * vel, now, 0.003);

    // Detune
    this.carrier.detune.setTargetAtTime(p.detuneCents * 0.5, now, 0.01);
    this.body.detune.setTargetAtTime(-p.detuneCents * 0.5, now, 0.01);

    // ADSR: Attack → Decay → Sustain
    this.envelope.gain.cancelScheduledValues(now);
    this.envelope.gain.setValueAtTime(0, now);
    this.envelope.gain.linearRampToValueAtTime(vel, now + p.attack);
    this.envelope.gain.linearRampToValueAtTime(vel * p.sustain, now + p.attack + p.decay);
  }

  noteOff(time?: number): void {
    if (!this.preset) return;
    const now = time !== undefined ? time : this.ctx.currentTime;

    // Release
    this.envelope.gain.cancelScheduledValues(now);
    this.envelope.gain.setValueAtTime(this.envelope.gain.value, now);
    this.envelope.gain.linearRampToValueAtTime(0, now + this.preset.release);

    // Mark inactive after release completes
    const releaseDurationMs = this.preset.release * 1000 + 50;
    const timeDeltaMs = Math.max(0, (now - this.ctx.currentTime) * 1000);
    this.releaseTimer = window.setTimeout(() => {
      this.active = false;
      this.midi = -1;
    }, releaseDurationMs + timeDeltaMs);
  }

  glide(midi: number, portaTime: number, pitchBend = 0, time?: number): void {
    if (!this.preset) return;
    const freq = 440 * Math.pow(2, (midi - 69 + pitchBend) / 12);
    const now = time !== undefined ? time : this.ctx.currentTime;
    this.midi = midi;

    this.carrier.frequency.setTargetAtTime(freq, now, portaTime);
    this.modulator.frequency.setTargetAtTime(freq * this.preset.modRatio, now, portaTime);
    this.body.frequency.setTargetAtTime(freq, now, portaTime);
    this.sub.frequency.setTargetAtTime(freq * 0.5, now, portaTime);
  }

  setPitchBend(semitones: number): void {
    if (this.midi < 0) return;
    const freq = 440 * Math.pow(2, (this.midi - 69 + semitones) / 12);
    const now = this.ctx.currentTime;
    this.carrier.frequency.setTargetAtTime(freq, now, 0.01);
    if (this.preset) {
      this.modulator.frequency.setTargetAtTime(freq * this.preset.modRatio, now, 0.01);
    }
    this.body.frequency.setTargetAtTime(freq, now, 0.01);
    this.sub.frequency.setTargetAtTime(freq * 0.5, now, 0.01);
  }

  setSubGain(value: number): void {
    this.pantheonSubGain = value;
    if (this.active && this.preset) {
      const now = this.ctx.currentTime;
      const subOscGainScaled = this.preset.subOscGain * (this.pantheonSubGain / 100);
      this.subGain.gain.setTargetAtTime(subOscGainScaled * this.velocity, now, 0.01);
    }
  }

  dispose(): void {
    if (this.releaseTimer !== null) clearTimeout(this.releaseTimer);
    try {
      this.carrier.stop();
      this.modulator.stop();
      this.body.stop();
      this.sub.stop();
    } catch { /* already stopped */ }
    this.output.disconnect();
  }
}
