import type { DSPChainModule, DSPModuleType } from './types';
import type { BufferRegistry } from '../audio/BufferRegistry';

const CLOCK_WORKLET_CODE = `
class GodRealmClockWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
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
    this.samplesSinceLastTick += 128;

    if (this.samplesSinceLastTick >= this.tickIntervalSamples) {
      this.samplesSinceLastTick -= this.tickIntervalSamples;
      this.port.postMessage({ type: 'tick' });
    }

    return true;
  }
}

registerProcessor('god-realm-clock-worklet', GodRealmClockWorklet);
`;


export interface SamplePreviewController {
  path: string;
  stop: () => void;
  finished: Promise<void>;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ModuleNode {
  instanceId: string;
  type: DSPModuleType;
  inputNode: AudioNode;
  outputNode: AudioNode;
  bypassed: boolean;
  wetGain: GainNode;
  dryGain: GainNode;
  internals: Record<string, AudioNode | AudioParam | AudioNode[] | AudioParam[]>;
  analyser: AnalyserNode;
}

export interface SampleInfo {
  name: string;
  file: string;
  path: string;
}

export interface LibraryManifest {
  name: string;
  categories: Record<string, SampleInfo[]>;
}

function generateSyntheticIR(ctx: AudioContext, duration = 2.0, decay = 3.0): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-decay * t) * (ch === 0 ? 1.0 : 0.95);
    }
  }
  return buffer;
}

function makeTanhCurve(amount: number = 1.0, samples: number = 4096): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

function makeTubeCurve(amount: number = 1.0, samples: number = 4096): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // x - 0.2*x^2 adds even harmonics for a "warmer" tube sound
    const shifted = x - 0.2 * Math.pow(x, 2);
    curve[i] = Math.tanh(shifted * amount);
  }
  return curve;
}

function makeVelvetCurve(amount: number = 1.0, silk: number = 0.5, samples: number = 4096): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Modern Crystal Silk: Use a hybrid atan curve for "expensive" transparency
    // We slightly reduce the drive multiplier to preserve more of the fundamental
    const drive = amount * (1 + silk * 0.05);
    let y = (2 / Math.PI) * Math.atan(x * drive);
    
    // The "Silk" stage: Add subtle even harmonics via a controlled sine-based profile.
    // This adds high-end clarity and sweetness while maintaining phase correlation.
    if (silk > 0) {
      // Harmonic lift that tapers off at the edges to prevent harshness
      const silkHarmonic = silk * 0.06 * Math.sin(Math.PI * y);
      y += silkHarmonic * (1.0 - Math.abs(y));
    }
    
    curve[i] = Math.max(-0.999, Math.min(0.999, y));
  }
  return curve;
}

function makeVelvetLimiterCurve(drive: number, silk: number, threshold: number, ratio: number, samples: number = 4096): Float32Array {
  const curve = new Float32Array(samples);
  const ceiling = 0.891; // Hard-capped at -1.0 dBTP for modern streaming compliance
  
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const absX = Math.abs(x);
    const sign = x >= 0 ? 1 : -1;

    // 1. Velvet Saturation Stage
    const driveScaled = drive * (1 + silk * 0.05);
    let y = (2 / Math.PI) * Math.atan(absX * driveScaled);
    
    // 2. Silk Stage (High-end extension)
    // Only applied to positive cycles to introduce the "expensive" even-harmonic shimmer
    if (x > 0 && silk > 0) {
      y += silk * 0.05 * Math.sin(Math.PI * y) * (1.0 - y);
    }

    // 3. Soft-Knee Limiter Stage (Modern Transparency)
    if (y > threshold) {
      // Use log-based compression for a transparent, non-distorting reduction
      const over = y - threshold;
      y = threshold + (Math.log1p(over * ratio) / ratio);
    }
    
    // Final Ceiling Enforcement
    curve[i] = Math.max(-ceiling, Math.min(ceiling, y * sign));
  }
  return curve;
}

function makeSoftClipCurve(samples: number = 4096): Float32Array {
  const curve = new Float32Array(samples);
  const threshold = 0.85;
  const ceiling = 0.891; // Hard-capped at -1.0 dBTP
  
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const absX = Math.abs(x);
    if (absX < threshold) {
      curve[i] = x;
    } else {
      // Soft knee transition to hard ceiling at -1.0 dBTP
      const val = threshold + (ceiling - threshold) * Math.tanh((absX - threshold) / (ceiling - threshold));
      curve[i] = x > 0 ? val : -val;
    }
  }
  return curve;
}

function makeNoiseBuffer(ctx: AudioContext, duration: number = 1.0): AudioBuffer {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// ─── Sampler Voice ──────────────────────────────────────────────────────────

interface ADSR {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface FilterParams {
  type: BiquadFilterType;
  frequency: number;
  q: number;
  gain?: number;
}

class SamplerVoice {
  private ctx: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private envelopeNode: GainNode;
  private filterNode: BiquadFilterNode;
  private pannerNode: StereoPannerNode;
  private currentDestination: AudioNode;
  
  public isActive = false;
  public startTime = 0;
  public startOffset = 0;
  public playbackRate = 1.0;
  public padIndex = -1;
  public onEnded: (() => void) | null = null;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.envelopeNode = ctx.createGain();
    this.filterNode = ctx.createBiquadFilter();
    this.pannerNode = ctx.createStereoPanner();
    this.currentDestination = destination;

    // Routing: Source -> Filter -> Envelope -> Panner -> Destination
    this.filterNode.connect(this.envelopeNode);
    this.envelopeNode.connect(this.pannerNode);
    this.pannerNode.connect(destination);

    // Initial state
    this.envelopeNode.gain.setValueAtTime(0, ctx.currentTime);
  }

  /**
   * Dynamically re-routes the voice output to a new destination node.
   * Essential for modular DSP chain changes.
   */
  public setDestination(node: AudioNode): void {
    if (this.currentDestination === node) return;
    try {
      this.pannerNode.disconnect(this.currentDestination);
    } catch (e) {
      // Might not be connected to this specific node, or already disconnected
      try { this.pannerNode.disconnect(); } catch (e2) {}
    }
    
    try {
      this.pannerNode.connect(node);
      this.currentDestination = node;
    } catch (e) {
      console.warn('SamplerVoice: Failed to connect to new destination', e);
    }
  }

  public trigger(
    buffer: AudioBuffer,
    time: number,
    offset: number,
    duration: number | undefined,
    playbackRate: number,
    adsr: ADSR,
    filter: FilterParams,
    pan: number,
    padIndex: number,
    loop: boolean = false
  ): void {
    this.stop(time); // Ensure clean start

    this.isActive = true;
    this.startTime = time;
    this.startOffset = offset;
    this.playbackRate = playbackRate;
    this.padIndex = padIndex;

    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.playbackRate.value = playbackRate;
    this.source.loop = loop;
    
    if (loop && duration) {
      this.source.loopStart = offset;
      this.source.loopEnd = offset + duration;
    }

    this.source.connect(this.filterNode);

    // Apply Filter
    this.filterNode.type = filter.type;
    this.filterNode.frequency.setValueAtTime(filter.frequency, time);
    this.filterNode.Q.setValueAtTime(filter.q, time);
    if (filter.gain !== undefined) this.filterNode.gain.setValueAtTime(filter.gain, time);

    // Apply Pan
    this.pannerNode.pan.setValueAtTime(pan, time);

    // Apply ADSR (Attack & Decay)
    const gain = this.envelopeNode.gain;
    gain.cancelScheduledValues(time);
    gain.setValueAtTime(0, time);
    gain.linearRampToValueAtTime(1.0, time + adsr.attack);
    gain.exponentialRampToValueAtTime(Math.max(0.001, adsr.sustain), time + adsr.attack + adsr.decay);

    this.source.onended = () => {
      if (this.isActive) {
        this.isActive = false;
        if (this.onEnded) this.onEnded();
      }
    };

    if (duration && duration > 0 && !loop) {
      this.source.start(time, offset, duration);
      // Auto-release if duration is specified and not looping
      this.release(time + duration, adsr.release);
    } else {
      this.source.start(time, offset);
    }
  }

  public getPlaybackPosition(): number {
    if (!this.isActive || !this.source || !this.source.buffer) return 0;
    const elapsed = this.ctx.currentTime - this.startTime;
    const position = this.startOffset + elapsed * this.playbackRate;
    return position % this.source.buffer.duration;
  }

  public release(time: number, releaseTime: number): void {
    if (!this.isActive) return;
    
    const gain = this.envelopeNode.gain;
    gain.cancelScheduledValues(time);
    gain.setTargetAtTime(0, time, releaseTime / 4); // setTargetAtTime is smoother for release
    
    // Hard stop after release
    setTimeout(() => {
      if (this.ctx.currentTime >= time + releaseTime) {
        this.stop(this.ctx.currentTime);
      }
    }, releaseTime * 1000 + 100);
  }

  public stop(time: number = this.ctx.currentTime): void {
    if (this.source) {
      try {
        this.source.stop(time);
        this.source.disconnect();
      } catch (e) {
        // Source might already be stopped
      }
      this.source = null;
    }
    this.envelopeNode.gain.cancelScheduledValues(time);
    this.envelopeNode.gain.setValueAtTime(0, time);
    this.isActive = false;
  }

  public disconnect(): void {
    this.stop();
    try {
      this.pannerNode.disconnect();
      this.envelopeNode.disconnect();
      this.filterNode.disconnect();
    } catch (e) {}
  }
}

export class GodRealmSamplerEngine {
  private ctx: AudioContext | null = null;
  private activePreview: AudioBufferSourceNode | null = null;
  private buffers: (AudioBuffer | null)[] = new Array(16).fill(null);
  private reversedBuffers: (AudioBuffer | null)[] = new Array(16).fill(null);
  private voices: SamplerVoice[] = [];
  private activeVoices: Set<SamplerVoice> = new Set();
  private maxVoices = 16;
  public manifest: LibraryManifest | null = null;
  private _registry: BufferRegistry | null = null; // Phase 2: Unified buffer pool
  
  private moduleNodes: ModuleNode[] = [];
  private masterGain: GainNode | null = null;
  private masterBodyFilter: BiquadFilterNode | null = null;
  private masterSoulFilter: BiquadFilterNode | null = null;
  private masterSaturator: WaveShaperNode | null = null;
  private masterSilkFilter: BiquadFilterNode | null = null;
  private msSplitter: ChannelSplitterNode | null = null;
  private midNode: GainNode | null = null;
  private sideNode: GainNode | null = null;
  private widthGain: GainNode | null = null;
  private imagerFilter: BiquadFilterNode | null = null;
  private msMerger: ChannelMergerNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterCeilingGain: GainNode | null = null;
  private masterSoftClipper: WaveShaperNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private slotGains: GainNode[] = [];
  private slotSaturators: WaveShaperNode[] = [];
  private slotPanners: StereoPannerNode[] = [];
  private slotAnalysers: AnalyserNode[] = [];
  private irBuffer: AudioBuffer | null = null;
  private lastParams: Record<string, any> = {};
  private subOscNode: OscillatorNode | null = null;
  private subGainNode: GainNode | null = null;
  
  // Multi-808 Infrastructure
  private m808SubOsc: OscillatorNode | null = null;
  private m808SubGain: GainNode | null = null;
  private m808MidDrive: WaveShaperNode | null = null;
  private m808ClickBuffer: AudioBuffer | null = null;
  private m808MasterGain: GainNode | null = null;
  
  private lastAppliedSaturatorDrive = -1;
  private lastAppliedSaturatorSilk = -1;

  // Aura Link (Modulation)
  private lfos: OscillatorNode[] = [];
  private lfoGains: GainNode[] = [];
  private routingGains: GainNode[] = [];
  private modulationMatrix: Map<string, AudioParam[]> = new Map();

  private currentRoundRobinSlot = 0;
  private lastRoundRobinTime = 0;
  private readonly roundRobinTimeWindow = 30; // 30ms
  private currentRandomSlot = 0;
  private lastRandomTime = 0;
  private readonly randomTimeWindow = 30; // 30ms

  private _detuneCents = 0;
  private _masterVolume = 0.8;
  private _chain: DSPChainModule[] = [];
  private isInitialized = false;
  private _ownsContext = true;  // Phase 1: tracks whether we own the AudioContext
  private abortController: AbortController | null = null;

  // Neural Orchestration
  private vortexMemory: Array<{ x: number, y: number, name: string }> = [];
  
  // Master Envelope
  private masterAttack = 0.01;
  private masterDecay = 0.5;
  private masterSustain = 0.7;
  private masterRelease = 0.3;
  
  // Arp/Gate Engine
  private arpEnabled = false;
  private arpNoteDivision = 0.25; // Phase 5: beat-relative (0.25 = quarter note)
  private arpRate = 0.125; // computed: arpNoteDivision * (60 / _bpm)
  private arpGate = 0.8;
  private arpSwing = 0;
  private arpOctaves = 1;
  private arpSteps: number = 16;
  private currentArpStep = 0;
  private nextStepTime = 0;
  private arpTimerId: any = null;
  private clockNode: AudioWorkletNode | null = null;
  private _bpm = 140; // Phase 5: synced from transport
  private heldPads: Set<number> = new Set();

  /**
   * Initialize the engine.
   * @param externalCtx - Optional shared AudioContext from the plugin.
   *                      If provided, the engine uses it instead of creating its own.
   *                      The caller is responsible for closing it.
   */
  async init(externalCtx?: AudioContext, registry?: BufferRegistry): Promise<void> {
    if (this.isInitialized) return;
    this.abortController = new AbortController();

    // Phase 2: Store reference to the shared buffer registry
    if (registry) {
      this._registry = registry;
    }

    // Phase 1: Use shared AudioContext if provided
    if (externalCtx) {
      this.ctx = externalCtx;
      this._ownsContext = false;
    } else {
      this.ctx = new AudioContext();
      this._ownsContext = true;
    }

    try {
      const blob = new Blob([CLOCK_WORKLET_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      if (this.ctx.state === 'closed') return; // Component unmounted, abort init
      
      this.clockNode = new AudioWorkletNode(this.ctx, 'god-realm-clock-worklet');
      this.clockNode.port.onmessage = (e) => {
        if (e.data.type === 'tick') {
          if (this.arpEnabled) this.scheduler();
        }
      };
      this.clockNode.connect(this.ctx.destination);
    } catch (err: any) {
      if (err.name !== 'AbortError' && this.ctx?.state !== 'closed') {
        console.warn('GodRealmSamplerEngine failed to load Clock Worklet, falling back to setTimeout', err);
      }
    }
    
    if (this.ctx.state === 'closed') return; // Final check before massive node creation

    this.irBuffer = generateSyntheticIR(this.ctx, 2.5, 2.8);
    
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._masterVolume;
    
    this.masterBodyFilter = this.ctx.createBiquadFilter();
    this.masterBodyFilter.type = 'lowshelf';
    this.masterBodyFilter.frequency.value = 150;
    this.masterBodyFilter.gain.value = 0;

    this.masterSoulFilter = this.ctx.createBiquadFilter();
    this.masterSoulFilter.type = 'peaking';
    this.masterSoulFilter.frequency.value = 800; // Soul center
    this.masterSoulFilter.Q.value = 0.7;
    this.masterSoulFilter.gain.value = 0;

    this.masterSaturator = this.ctx.createWaveShaper();
    this.masterSaturator.curve = makeVelvetCurve(1.0, 0.5);
    
    this.masterSilkFilter = this.ctx.createBiquadFilter();
    this.masterSilkFilter.type = 'highshelf';
    this.masterSilkFilter.frequency.value = 12000;
    this.masterSilkFilter.gain.value = 0;

    this.masterLimiter = this.ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -0.5;
    this.masterLimiter.ratio.value = 20;
    this.masterLimiter.attack.value = 0.0005; // Ultra-fast for master
    this.masterLimiter.release.value = 0.08;

    this.masterCeilingGain = this.ctx.createGain();
    this.masterCeilingGain.gain.value = 1.0;

    this.masterSoftClipper = this.ctx.createWaveShaper();
    this.masterSoftClipper.curve = makeSoftClipCurve();

    // M/S Processing Setup
    this.msSplitter = this.ctx.createChannelSplitter(2);
    
    this.midNode = this.ctx.createGain();
    this.midNode.gain.value = 0.5; // (L+R)*0.5

    this.sideNode = this.ctx.createGain();
    this.sideNode.gain.value = 0.5; // (L-R)*0.5
    
    const invertR = this.ctx.createGain(); 
    invertR.gain.value = -1;

    this.widthGain = this.ctx.createGain();
    this.widthGain.gain.value = 1.2; // default width

    this.imagerFilter = this.ctx.createBiquadFilter();
    this.imagerFilter.type = 'highshelf';
    this.imagerFilter.frequency.value = 3000;
    this.imagerFilter.gain.value = 0; // default imager

    this.msMerger = this.ctx.createChannelMerger(2);

    // Split and form Mid/Side
    this.msSplitter.connect(this.midNode, 0); // L -> Mid
    this.msSplitter.connect(this.midNode, 1); // R -> Mid
    
    this.msSplitter.connect(this.sideNode, 0); // L -> Side
    this.msSplitter.connect(invertR, 1);       // R -> invertR
    invertR.connect(this.sideNode);            // -R -> Side
    
    // Process Side
    this.sideNode.connect(this.widthGain);
    this.widthGain.connect(this.imagerFilter);

    // Recombine to Stereo: L = M + S, R = M - S
    const lOut = this.ctx.createGain();
    const rOut = this.ctx.createGain();
    const invertProcessedSide = this.ctx.createGain();
    invertProcessedSide.gain.value = -1;

    this.midNode.connect(lOut);
    this.imagerFilter.connect(lOut);

    this.midNode.connect(rOut);
    this.imagerFilter.connect(invertProcessedSide);
    invertProcessedSide.connect(rOut);

    lOut.connect(this.msMerger, 0, 0);
    rOut.connect(this.msMerger, 0, 1);

    // Signal Flow: Gain -> Body -> Soul -> Saturation -> Silk -> M/S -> Limiter -> Ceiling -> Soft Clipper -> Analyser
    this.masterGain.connect(this.masterBodyFilter);
    this.masterBodyFilter.connect(this.masterSoulFilter);
    this.masterSoulFilter.connect(this.masterSaturator);
    this.masterSaturator.connect(this.masterSilkFilter);
    this.masterSilkFilter.connect(this.msSplitter);
    this.msMerger.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterCeilingGain);
    this.masterCeilingGain.connect(this.masterSoftClipper);
    this.masterSoftClipper.connect(this.analyserNode);
    // ─── Slot Infrastructure (16 Slots — Phase 3: expanded to match sequencer tracks 1:1) ───
    for (let i = 0; i < 16; i++) {
      const g = this.ctx.createGain();
      const s = this.ctx.createWaveShaper();
      s.curve = makeVelvetCurve(1.0, 0.5);
      const p = this.ctx.createStereoPanner();
      const a = this.ctx.createAnalyser();
      a.fftSize = 256;
      
      g.connect(s);
      s.connect(p);
      p.connect(a);
      a.connect(this.masterGain!);
      
      this.slotGains.push(g);
      this.slotSaturators.push(s);
      this.slotPanners.push(p);
      this.slotAnalysers.push(a);
    }

    this.analyserNode.connect(this.ctx.destination);
    
    // Initialize Polyphonic Voices
    this.voices = [];
    for (let i = 0; i < this.maxVoices; i++) {
      // Connect to masterGain initially; playBufferPart will re-route if needed
      this.voices.push(new SamplerVoice(this.ctx, this.masterGain!));
    }

    // ─── Multi-808 Engine Setup ───
    this.m808MasterGain = this.ctx.createGain();
    this.m808MasterGain.gain.value = 0; // Silent until triggered
    this.m808SubGain = this.ctx.createGain();
    this.m808SubGain.gain.value = 0;    // Silent until triggered
    this.m808SubOsc = this.ctx.createOscillator();
    this.m808SubOsc.type = 'sine';
    this.m808MidDrive = this.ctx.createWaveShaper();
    this.m808MidDrive.curve = makeTubeCurve(2.0);
    
    this.m808SubOsc.connect(this.m808SubGain);
    this.m808SubGain.connect(this.m808MidDrive);
    this.m808MidDrive.connect(this.m808MasterGain);
    this.m808MasterGain.connect(this.masterGain!);
    this.m808SubOsc.start();
    
    // Create a sharp click transient
    this.m808ClickBuffer = makeNoiseBuffer(this.ctx, 0.05);

    // ─── Aura Link LFOs ───
    this.lfos = [];
    this.lfoGains = [];
    this.routingGains = [];
    for (let i = 0; i < 4; i++) {
      const lfo = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.5 + i * 0.2;
      gain.gain.value = 0; // Depth starts at 0
      lfo.connect(gain);
      lfo.start();
      this.lfos.push(lfo);
      this.lfoGains.push(gain);

      // Create intermediate routing gain node
      const rGain = this.ctx.createGain();
      rGain.gain.value = 0; // Routing amount starts at 0, updated by parameters
      gain.connect(rGain);
      this.routingGains.push(rGain);
    }

    // Connect routing gains to their target AudioParams
    if (this.masterBodyFilter) {
      this.routingGains[0].connect(this.masterBodyFilter.gain);
    }
    if (this.masterSoulFilter) {
      this.routingGains[1].connect(this.masterSoulFilter.gain);
    }
    if (this.masterSilkFilter) {
      this.routingGains[2].connect(this.masterSilkFilter.gain);
    }
    if (this.widthGain) {
      this.routingGains[3].connect(this.widthGain.gain);
    }

    await this.loadManifest();
    await this.loadSamples(this.abortController.signal);
    this.isInitialized = true;
  }

  private async loadManifest(): Promise<void> {
    try {
      const response = await fetch('/library_manifest.json');
      if (!response.ok) throw new Error('Failed to load manifest');
      this.manifest = await response.json();
      console.log('Divine Manifest Loaded:', this.manifest?.name);
    } catch (err) {
      console.error('Error loading divine manifest:', err);
    }
  }

  private async loadSamples(signal: AbortSignal): Promise<void> {
    if (!this.ctx || !this.manifest) return;
    
    // Default load: take first sample from first 16 categories or just flat list
    let sampleCount = 0;
    const categories = Object.keys(this.manifest.categories);
    
    for (const cat of categories) {
      const samples = this.manifest.categories[cat];
      for (const s of samples) {
        if (sampleCount >= 16) break;
        await this.loadSampleByPath(s.path, sampleCount, signal);
        sampleCount++;
      }
      if (sampleCount >= 16) break;
    }
  }

  public async loadSampleByPath(path: string, slotIndex: number, signal?: AbortSignal): Promise<void> {
    if (!this.ctx || slotIndex < 0 || slotIndex >= 16) return;

    // Phase 2: Delegate to BufferRegistry when available
    if (this._registry) {
      const buf = await this._registry.loadFromPath(this.ctx, path, slotIndex, undefined, signal);
      if (buf) {
        // Keep internal array in sync for voice playback lookups
        this.buffers[slotIndex] = buf;
        this.reversedBuffers[slotIndex] = null; // invalidate cached reverse
      }
      return;
    }

    // Legacy fallback: direct loading
    try {
      const response = await fetch(path, { signal });
      if (!response.ok) throw new Error(`Failed to load sample at ${path}`);
      const arrayBuffer = await response.arrayBuffer();
      if (signal?.aborted || !this.ctx) return;
      this.buffers[slotIndex] = await this.ctx.decodeAudioData(arrayBuffer);
      this.reversedBuffers[slotIndex] = null;
      console.log(`Divine Sound Assigned to Slot ${slotIndex}:`, path.split('/').pop());
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(`Error loading sample ${path}:`, err);
      }
    }
  }

  /**
   * Load a sample from a File object (e.g., from directory picker or drag-and-drop).
   * Used by the Kontakt Kit Loader.
   */
  public async loadSampleFromFile(file: File, slotIndex: number): Promise<void> {
    if (!this.ctx || slotIndex < 0 || slotIndex >= 16) return;

    // Phase 2: Delegate to BufferRegistry when available
    if (this._registry) {
      const buf = await this._registry.loadFromFile(this.ctx, file, slotIndex);
      if (buf) {
        this.buffers[slotIndex] = buf;
        this.reversedBuffers[slotIndex] = null;
      }
      return;
    }

    // Legacy fallback
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (!this.ctx) return;
      this.buffers[slotIndex] = await this.ctx.decodeAudioData(arrayBuffer);
      this.reversedBuffers[slotIndex] = null;
      console.log(`Kit Sample Loaded to Slot ${slotIndex}:`, file.name);
    } catch (err) {
      console.error(`Error loading sample file ${file.name}:`, err);
    }
  }

  /**
   * Batch-load multiple samples from File objects into their target slots.
   * Used by the Kontakt Kit Loader for one-click kit loading.
   */
  public async loadKit(samples: { file: File; slotIndex: number }[]): Promise<void> {
    await Promise.all(samples.map(s => this.loadSampleFromFile(s.file, s.slotIndex)));
    console.log(`Kit Loaded: ${samples.length} samples assigned`);
  }

  /**
   * Preview a sample from a File object (e.g., kit browser audition).
   */
  public async previewFile(file: File): Promise<void> {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.stopPreview();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(arrayBuffer);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);
      this.activePreview = source;

      source.onended = () => {
        if (this.activePreview === source) this.activePreview = null;
        try { source.disconnect(); } catch {}
      };

      source.start(0);
    } catch (err) {
      console.error('Kit Preview Failed:', err);
    }
  }

  public stopPreview(): void {
    if (!this.activePreview) return;
    const preview = this.activePreview;
    this.activePreview = null;
    try {
      preview.onended = null;
      preview.stop();
    } catch {
      // The source may already be stopped; clearing activePreview is still correct.
    }
    try {
      preview.disconnect();
    } catch {
      // Disconnect can fail after the node has already been released.
    }
  }

  public async previewSample(path: string): Promise<SamplePreviewController | null> {
    if (!this.ctx || !this.masterGain) return null;
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.stopPreview();

    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Failed to fetch preview ${path}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(arrayBuffer);

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);
      this.activePreview = source;

      let resolveFinished!: () => void;
      const finished = new Promise<void>((resolve) => {
        resolveFinished = resolve;
      });

      source.onended = () => {
        if (this.activePreview === source) this.activePreview = null;
        try {
          source.disconnect();
        } catch {
          // Source may already be disconnected by stopPreview.
        }
        resolveFinished();
      };

      source.start(0);

      return {
        path,
        finished,
        stop: () => {
          if (this.activePreview === source) {
            this.stopPreview();
            resolveFinished();
          }
        }
      };
    } catch (err) {
      console.error('Audition Failed:', err);
      return null;
    }
  }

  public async triggerMidiNote(note: number, velocity: number): Promise<void> {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    // 1. Gather active/powered slots
    const activeSlots: number[] = [];
    for (let i = 0; i < 6; i++) {
      const isPowered = this.lastParams[`slotPower_${i}`] !== false;
      const hasBuffer = this.buffers[i] !== null;
      if (isPowered && hasBuffer) {
        activeSlots.push(i);
      }
    }

    if (activeSlots.length === 0) return;

    // 2. Select slot(s) to play based on slotPlayMode
    const playMode = this.lastParams.slotPlayMode !== undefined ? this.lastParams.slotPlayMode : 1; // 0 = Layer, 1 = RR, 2 = Random
    let slotsToPlay: number[] = [];

    if (playMode === 0) {
      // Layer Mode: Play all active slots
      slotsToPlay = activeSlots;
    } else if (playMode === 1) {
      // Round Robin: Cycle through active slots, grouped within 30ms window
      const now = performance.now();
      if (now - this.lastRoundRobinTime > this.roundRobinTimeWindow) {
        if (this.lastRoundRobinTime > 0) {
          this.currentRoundRobinSlot = (this.currentRoundRobinSlot + 1) % activeSlots.length;
        }
        this.lastRoundRobinTime = now;
      }
      const slot = activeSlots[this.currentRoundRobinSlot % activeSlots.length];
      slotsToPlay = [slot];
    } else {
      // Random: Pick one active slot at random, grouped within 30ms window
      const now = performance.now();
      if (now - this.lastRandomTime > this.randomTimeWindow) {
        this.currentRandomSlot = activeSlots[Math.floor(Math.random() * activeSlots.length)];
        this.lastRandomTime = now;
      }
      // Safeguard in case activeSlots changed and currentRandomSlot is no longer valid
      if (this.currentRandomSlot === undefined || !activeSlots.includes(this.currentRandomSlot)) {
        this.currentRandomSlot = activeSlots[Math.floor(Math.random() * activeSlots.length)];
      }
      slotsToPlay = [this.currentRandomSlot];
    }

    // 3. Trigger each selected slot at the pitch of the MIDI note
    // MIDI note 60 (C3) is baseline (no transpose).
    const pitchOffset = note - 60;
    const globalTune = this.lastParams.tuneSemitones || 0;

    for (const slotIdx of slotsToPlay) {
      const voice = this.findFreeVoice();
      const { adsr, filter, pan, rate } = this.getVoiceParams(slotIdx);
      
      const tune = this.lastParams[`slotTune_${slotIdx}`] || 50;
      const fine = this.lastParams[`slotFine_${slotIdx}`] || 50;
      const slotTuneSemitones = (tune - 50) * 0.48 + (fine - 50) * 0.02;
      
      const totalPitchShift = pitchOffset + slotTuneSemitones + globalTune;
      const finalRate = rate * Math.pow(2, totalPitchShift / 12);

      // Route voice through the slot's DSP chain
      const slotIdxBounded = slotIdx % this.slotGains.length;
      if (this.slotGains[slotIdxBounded]) {
        voice.setDestination(this.slotGains[slotIdxBounded]);
      }

      const sliceStart = this.lastParams[`slot${slotIdx}_sliceStart`] as number | undefined;
      const sliceDuration = this.lastParams[`slot${slotIdx}_sliceDuration`] as number | undefined;

      voice.trigger(
        this.buffers[slotIdx]!,
        this.ctx.currentTime,
        sliceStart ?? 0, // start offset
        sliceDuration, // duration (play full sample if undefined)
        finalRate,
        adsr,
        filter,
        pan,
        slotIdx,
        false // loop
      );

      // Trigger sub-layers for this slot
      this.triggerSubOsc(slotIdx);
      this.triggerMulti808(slotIdx);
      this.triggerCelestialKeys(slotIdx);
    }
  }

  public dispose(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    this.stopPreview();
    this.stopArp();
    if (this.clockNode) {
      this.clockNode.disconnect();
    }
    
    // Properly stop and disconnect all voices
    for (const voice of this.voices) {
      try {
        voice.disconnect();
      } catch (e) {}
    }
    
    this.activeVoices.clear();
    this.teardownGraph();

    // Stop engine-wide oscillators
    if (this.m808SubOsc) { try { this.m808SubOsc.stop(); } catch(e){} }
    this.lfos.forEach(lfo => { try { lfo.stop(); } catch(e){} });
    this.routingGains.forEach(gain => { try { gain.disconnect(); } catch(e){} });
    this.routingGains = [];

    if (this.ctx) {
      // Phase 1: Only close the context if we created it ourselves
      if (this._ownsContext) {
        this.ctx.close();
      }
      this.ctx = null;
    }
    this.isInitialized = false;
  }

  /**
   * Phase 3: Route the engine's final output to an external destination
   * (e.g., the Celestial Forge MasterChain input) instead of ctx.destination.
   *
   * The God Engine's internal processing chain (body/soul/saturator/silk/M-S/limiter)
   * acts as a "sampler bus", and the external destination is the sovereign master.
   */
  routeOutput(destination: AudioNode): void {
    if (!this.ctx || !this.analyserNode) return;
    try {
      this.analyserNode.disconnect(this.ctx.destination);
    } catch (_) {
      // May not be connected to destination yet
    }
    this.analyserNode.connect(destination);
    console.log('[God Engine] Output routed to Celestial Forge');
  }

  /**
   * Phase 5: Sync BPM from the unified transport.
   * Recalculates arp timing to stay locked to the beat.
   */
  setBpm(bpm: number): void {
    this._bpm = Math.max(20, Math.min(300, bpm));
    // Recalculate arpRate from the stored note division
    this.arpRate = this.arpNoteDivision * (60 / this._bpm);
  }
  


  private findFreeVoice(): SamplerVoice {
    // 1. Look for inactive voice
    const freeVoice = this.voices.find(v => !v.isActive);
    if (freeVoice) return freeVoice;

    // 2. Voice Stealing (Oldest First)
    let oldestVoice = this.voices[0];
    for (let i = 1; i < this.voices.length; i++) {
      if (this.voices[i].startTime < oldestVoice.startTime) {
        oldestVoice = this.voices[i];
      }
    }
    return oldestVoice;
  }

  private getVoiceParams(index: number) {
    const adsr: ADSR = {
      attack: this.lastParams[`slot${index}_attack`] ?? this.masterAttack,
      decay: this.lastParams[`slot${index}_decay`] ?? this.masterDecay,
      sustain: this.lastParams[`slot${index}_sustain`] ?? this.masterSustain,
      release: this.lastParams[`slot${index}_release`] ?? this.masterRelease,
    };

    const filter: FilterParams = {
      type: (this.lastParams[`slot${index}_filterType`] as BiquadFilterType) ?? 'lowpass',
      frequency: this.lastParams[`slot${index}_filterFreq`] ?? 20000,
      q: this.lastParams[`slot${index}_filterQ`] ?? 1.0,
    };

    const pan = this.lastParams[`slot${index}_pan`] ?? 0;
    const rate = this.lastParams[`slot${index}_tune`] ?? 1.0;

    return { adsr, filter, pan, rate };
  }

  private reverseAudioBuffer(buffer: AudioBuffer): AudioBuffer {
    const reversed = this.ctx!.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      const srcData = buffer.getChannelData(i);
      const destData = reversed.getChannelData(i);
      for (let j = 0; j < buffer.length; j++) {
        destData[j] = srcData[buffer.length - 1 - j];
      }
    }
    return reversed;
  }

  async playBufferPart(index: number, startTime: number, duration?: number): Promise<void> {
    if (!this.ctx || (!this.buffers[index] && !this.reversedBuffers[index])) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const voice = this.findFreeVoice();
    let { adsr, filter, pan, rate } = this.getVoiceParams(index);

    // --- Divine Chopper Integration ---
    const activePad = this.lastParams.activePad ?? 0;
    const isChopperPad = (index === activePad);

    const isReverse = this.lastParams.chopperReverse ?? false;
    const chopperSpeed = this.lastParams.chopperSpeed ?? 1.0;
    const chopperPitch = this.lastParams.chopperPitch ?? 0;
    const chopperLoop = this.lastParams.chopperLoop ?? false;
    
    // Combine base rate with chopper speed and pitch
    const pitchShift = Math.pow(2, chopperPitch / 12);
    const finalRate = rate * chopperSpeed * pitchShift;

    // Use chopper-specific ADSR if it's the active pad being chopped
    if (isChopperPad) {
      adsr = {
        attack: (this.lastParams.chopperFadeIn ?? 25) / 1000,
        decay: 0.1, 
        sustain: 1.0, 
        release: (this.lastParams.chopperFadeOut ?? 150) / 1000
      };
    }

    // Zero-Copy Playback Logic
    const sliceStartParam = this.lastParams[`slot${index}_sliceStart`] as number | undefined;
    const sliceDurParam = this.lastParams[`slot${index}_sliceDuration`] as number | undefined;

    let playStart = Math.max(0, startTime);
    let playDuration = duration;
    
    const sourceBuffer = (isReverse && this.reversedBuffers[index]) 
      ? this.reversedBuffers[index]! 
      : this.buffers[index]!;

    if (sliceStartParam !== undefined && sliceDurParam !== undefined) {
      playStart = sliceStartParam;
      playDuration = sliceDurParam;
    }

    // If reversed, the start point needs to be flipped relative to the buffer end
    if (isReverse && sourceBuffer) {
      const totalDur = sourceBuffer.duration;
      const originalEnd = playStart + (playDuration || (totalDur - playStart));
      playStart = Math.max(0, totalDur - originalEnd);
    }

    // Route voice through the slot's DSP chain so the slot analyser picks up signal
    const slotIdx = index % this.slotGains.length;
    if (this.slotGains[slotIdx]) {
      voice.setDestination(this.slotGains[slotIdx]);
    }

    voice.trigger(
      sourceBuffer,
      this.ctx.currentTime,
      playStart,
      playDuration,
      finalRate,
      adsr,
      filter,
      pan,
      index,
      isChopperPad ? chopperLoop : false
    );

    // Trigger sub-layers
    this.triggerSubOsc(index);
    this.triggerMulti808(index);
    this.triggerCelestialKeys(index);
  }

  private triggerSubOsc(index: number): void {
    if (!this.subOscNode || !this.subGainNode || !this.ctx) return;
    
    // Simple mapping: Pad 0-15 -> MIDI 24-39 (C1-D#2)
    const midi = 24 + index;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    
    const now = this.ctx.currentTime;
    this.subOscNode.frequency.setTargetAtTime(freq, now, 0.01);
    
    // Quick envelope for the sub
    this.subGainNode.gain.cancelScheduledValues(now);
    this.subGainNode.gain.setValueAtTime(0, now);
    this.subGainNode.gain.linearRampToValueAtTime(1.0, now + 0.02);
    this.subGainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  }

  private triggerMulti808(index: number): void {
    if (!this.ctx || !this.m808SubOsc || !this.m808SubGain || !this.m808MasterGain) return;
    
    const now = this.ctx.currentTime;
    const freq = 440 * Math.pow(2, ((24 + index) - 69) / 12);
    
    // Pitch Slide (Transient Punch)
    this.m808SubOsc.frequency.cancelScheduledValues(now);
    this.m808SubOsc.frequency.setValueAtTime(freq * 2.5, now);
    this.m808SubOsc.frequency.exponentialRampToValueAtTime(freq, now + 0.04);

    // Sub Envelope
    this.m808SubGain.gain.cancelScheduledValues(now);
    this.m808SubGain.gain.setValueAtTime(0, now);
    this.m808SubGain.gain.linearRampToValueAtTime(1.0, now + 0.005);
    this.m808SubGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    // Master 808 Bus Envelope (gate open then decay to silence)
    this.m808MasterGain.gain.cancelScheduledValues(now);
    this.m808MasterGain.gain.setValueAtTime(1.0, now);
    this.m808MasterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    // Click Layer
    if (this.m808ClickBuffer) {
      const click = this.ctx.createBufferSource();
      click.buffer = this.m808ClickBuffer;
      const clickGain = this.ctx.createGain();
      clickGain.gain.setValueAtTime(0.4, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      click.connect(clickGain);
      clickGain.connect(this.m808MasterGain);
      click.start(now);
    }
  }

  private triggerCelestialKeys(index: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    for (const mn of this.moduleNodes) {
      if (mn.type === 'celestialKeys') {
        const tineGain = mn.internals['tineGain'];
        const modDepth = mn.internals['modDepth'];
        const bodyGain = mn.internals['bodyGain'];
        const tineOsc = mn.internals['tineOsc'];
        const modOsc = mn.internals['modOsc'];
        const bodyOsc = mn.internals['bodyOsc'];

        if (tineGain instanceof AudioParam && tineOsc instanceof OscillatorNode) {
          const midi = 48 + index; // C3 baseline for keys
          const freq = 440 * Math.pow(2, (midi - 69) / 12);
          
          tineOsc.frequency.setTargetAtTime(freq, now, 0.005);
          if (modOsc instanceof OscillatorNode) {
            modOsc.frequency.setTargetAtTime(freq * 3.501, now, 0.005); // Slightly detuned harmonic
          }
          if (bodyOsc instanceof OscillatorNode) {
            bodyOsc.frequency.setTargetAtTime(freq, now, 0.005);
          }

          // Tine Envelope (Bell-like)
          tineGain.cancelScheduledValues(now);
          tineGain.setValueAtTime(0, now);
          tineGain.linearRampToValueAtTime(1.0, now + 0.005);
          tineGain.exponentialRampToValueAtTime(0.001, now + 1.2);

          // Modulator (Transient FM)
          if (modDepth instanceof AudioParam) {
            modDepth.cancelScheduledValues(now);
            modDepth.setValueAtTime(0, now);
            modDepth.linearRampToValueAtTime(freq * 2.5, now + 0.002);
            modDepth.exponentialRampToValueAtTime(0.001, now + 0.1);
          }
        }

        if (bodyGain instanceof AudioParam) {
          // Body Envelope (Sustained)
          bodyGain.cancelScheduledValues(now);
          bodyGain.setValueAtTime(0, now);
          bodyGain.linearRampToValueAtTime(0.6, now + 0.04);
          bodyGain.exponentialRampToValueAtTime(0.001, now + 2.0);
        }
      }
    }
  }

  getTransients(index: number, threshold?: number, minSpacing = 0.1): number[] {
    const sensitivity = this.lastParams.chopperSensitivity ?? 50;
    // Map 0-100 sensitivity to 0.5-0.005 threshold (inverted)
    const effectiveThreshold = threshold ?? (0.5 * Math.pow(0.1, sensitivity / 50)); 
    return this.autoChop(index, effectiveThreshold, minSpacing);
  }

  autoChop(index: number, threshold = 0.15, minSpacing = 0.1): number[] {
    const buffer = this.buffers[index];
    if (!buffer) return [];

    const data = buffer.getChannelData(0);
    const step = Math.floor(buffer.sampleRate * 0.01); // 10ms windows
    const markers: number[] = [];
    let lastMarkerTime = -minSpacing;

    for (let i = 0; i < data.length; i += step) {
      const time = i / buffer.sampleRate;
      let peak = 0;
      for (let j = 0; j < step && i + j < data.length; j++) {
        peak = Math.max(peak, Math.abs(data[i + j]));
      }

      if (peak > threshold && (time - lastMarkerTime) > minSpacing) {
        markers.push(time / buffer.duration); // Normalized
        lastMarkerTime = time;
      }
    }

    // Return at most 16 markers (to fit pads or UI)
    return markers.slice(0, 16);
  }

  public sliceToPads(sourceIndex: number): void {
    const buffer = this.buffers[sourceIndex];
    if (!buffer || !this.ctx) return;

    const markers = this.lastParams.chopMarkers || [];
    const sortedMarkers = [0, ...markers, 1.0].sort((a, b) => a - b);
    
    // We can only fill up to 16 pads
    const sliceCount = Math.min(16, sortedMarkers.length - 1);

    for (let i = 0; i < sliceCount; i++) {
      const start = sortedMarkers[i] * buffer.duration;
      const end = sortedMarkers[i+1] * buffer.duration;
      const duration = end - start;

      if (duration <= 0) continue;

      // Zero-Copy: Assign the original buffer reference
      this.buffers[i] = buffer;
      this.reversedBuffers[i] = this.reversedBuffers[sourceIndex] || null;
      
      // Update pad specific params for zero-copy playback
      this.lastParams[`slot${i}_sliceStart`] = start;
      this.lastParams[`slot${i}_sliceDuration`] = duration;
      this.lastParams[`slot${i}_name`] = `Slice ${i+1}`;
    }
    
    console.log(`Sliced ${sliceCount} parts to pads 0-${sliceCount-1} (Zero-Copy)`);
  }

  getBuffer(index: number): AudioBuffer | null {
    // Phase 2: Delegate to registry when available
    if (this._registry) {
      return this._registry.getBuffer(index);
    }
    return this.buffers[index];
  }

  public getChopperPlaybackPosition(padIndex: number): number {
    const activeVoice = this.voices.find(v => v.isActive && v.padIndex === padIndex);
    if (!activeVoice) return -1;
    return activeVoice.getPlaybackPosition();
  }

  // ─── State Management ─────────────────────────────────────────────────────

  getState(): any {
    return {
      chain: this._chain,
      params: this.lastParams,
      detune: this._detuneCents,
      masterVolume: this._masterVolume
    };
  }

  setState(state: any): void {
    if (!state) return;
    if (state.chain) {
      this.buildGraph(state.chain);
    }
    if (state.params) {
      this.updateFromParameters(state.params);
    }
    if (state.detune !== undefined) {
      this._detuneCents = state.detune;
    }
    if (state.masterVolume !== undefined) {
      this._masterVolume = state.masterVolume;
    }
  }

  // ─── Graph and Routing ────────────────────────────────────────────────────

  buildGraph(chain: DSPChainModule[]): void {
    if (!this.ctx || !this.masterGain) return;
    this.teardownGraph();
    this._chain = chain;

    for (const mod of chain) {
      const moduleNode = this.createModuleNode(mod);
      if (moduleNode) {
        this.moduleNodes.push(moduleNode);
      }
    }

    for (let i = 0; i < this.moduleNodes.length - 1; i++) {
      this.moduleNodes[i].outputNode.connect(this.moduleNodes[i + 1].inputNode);
    }

    if (this.moduleNodes.length > 0) {
      this.moduleNodes[this.moduleNodes.length - 1].outputNode.connect(this.masterGain);
    }

    // --- CRITICAL: Dynamic Re-routing ---
    // Ensure all existing voices are now pointing to the new chain input
    const chainInput = this.getChainInput();
    if (chainInput) {
      for (const voice of this.voices) {
        voice.setDestination(chainInput);
      }
    }
  }

  private teardownGraph(): void {
    for (const mn of this.moduleNodes) {
      try {
        mn.inputNode.disconnect();
        mn.outputNode.disconnect();
        mn.wetGain.disconnect();
        mn.dryGain.disconnect();
        
        const cleanupNode = (node: any) => {
          if (node instanceof AudioNode) {
            // Stop scheduled sources to prevent memory leaks and ghost audio
            if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
              try { node.stop(); } catch (e) {}
            }
            try { node.disconnect(); } catch (_e) {}
          } else if (Array.isArray(node)) {
            node.forEach(cleanupNode);
          }
        };

        // Deep cleanup of all internal nodes
        Object.values(mn.internals).forEach(cleanupNode);
        mn.analyser.disconnect();
      } catch (_e) {}
    }

    // Reset class-level references that might have been tied to specific modules
    this.subOscNode = null;
    this.subGainNode = null;
    
    this.moduleNodes = [];
  }

  getChainInput(): AudioNode | null {
    if (this.moduleNodes.length > 0) return this.moduleNodes[0].inputNode;
    return this.masterGain;
  }

  getModuleLevels(): Record<string, number> {
    const levels: Record<string, number> = {};
    const buffer = new Uint8Array(1);
    
    // Module levels
    for (const mn of this.moduleNodes) {
      mn.analyser.getByteTimeDomainData(buffer);
      const level = Math.abs(buffer[0] - 128) / 128;
      levels[mn.instanceId] = level;
    }
    
    // Master reduction (in dB)
    if (this.masterLimiter) {
      // reduction is a float property representing dB of reduction
      levels['masterReduction'] = Math.abs(this.masterLimiter.reduction);
    }
    
    // Master output level
    if (this.analyserNode) {
      this.analyserNode.getByteTimeDomainData(buffer);
      levels['masterOutput'] = Math.abs(buffer[0] - 128) / 128;
    }
    
    return levels;
  }

  getMasterReduction(): number {
    return this.masterLimiter ? Math.abs(this.masterLimiter.reduction) : 0;
  }

  getDivinePower(): number {
    // Re-calculate or return cached divine power
    const totalInvoke = Object.entries(this.lastParams)
      .filter(([id]) => id.startsWith('god_') && id.endsWith('_invoke'))
      .reduce((sum, [_, val]) => sum + (val as number), 0);
    const godCount = 8; // We have 8 gods fixed in this engine
    const avgInvoke = godCount > 0 ? totalInvoke / godCount : 0;
    return Math.pow(avgInvoke / 100, 1.5);
  }

  private createModuleNode(mod: DSPChainModule): ModuleNode | null {
    if (!this.ctx) return null;
    const ctx = this.ctx;

    const inputNode = ctx.createGain();
    const outputNode = ctx.createGain();
    const wetGain = ctx.createGain();
    const dryGain = ctx.createGain();

    wetGain.gain.value = mod.bypassed ? 0.0 : 1.0;
    dryGain.gain.value = mod.bypassed ? 1.0 : 0.0;

    inputNode.connect(wetGain);
    inputNode.connect(dryGain);
    dryGain.connect(outputNode);

    const internals: Record<string, AudioNode | AudioParam | AudioNode[] | AudioParam[]> = {};
    let processorInput: AudioNode | null = null;
    let processorOutput: AudioNode | null = null;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 32; // Small size for peak detection

    switch (mod.type) {
      case 'eq': {
        // Ra (Harmonics) or Anubis (Sub-Bass)
        if (mod.instanceId === 'anubis') {
          // Anubis: Deep Underworld Sub-Processor
          const input = ctx.createGain();
          
          // Rumble: Resonant Low-Shelf (Lowshelf + Peaking for resonance)
          const rumbleShelf = ctx.createBiquadFilter();
          rumbleShelf.type = 'lowshelf';
          rumbleShelf.frequency.value = 65;
          
          const rumblePeak = ctx.createBiquadFilter();
          rumblePeak.type = 'peaking';
          rumblePeak.frequency.value = 65;
          rumblePeak.Q.value = 2.5;
          
          // Darkness: Tilt-filter (Low-shelf boost + High-shelf cut) + Saturation
          const darkLow = ctx.createBiquadFilter();
          darkLow.type = 'lowshelf';
          darkLow.frequency.value = 400;
          
          const darkHigh = ctx.createBiquadFilter();
          darkHigh.type = 'highshelf';
          darkHigh.frequency.value = 1200;
          
          const satBias = ctx.createGain();
          const darknessSat = ctx.createWaveShaper();
          darknessSat.curve = makeTubeCurve(1.5);
          
          const depthGain = ctx.createGain();
          
          input.connect(rumbleShelf);
          rumbleShelf.connect(rumblePeak);
          rumblePeak.connect(darkLow);
          darkLow.connect(darkHigh);
          darkHigh.connect(satBias);
          satBias.connect(darknessSat);
          
          const output = ctx.createGain();
          darknessSat.connect(output);
          
          processorInput = input;
          processorOutput = output;
          
          internals['rumble'] = [rumbleShelf.gain, rumblePeak.gain];
          internals['darknessLow'] = darkLow.gain;
          internals['darknessHigh'] = darkHigh.gain;
          internals['bias'] = satBias.gain;
          internals['depth'] = output.gain;

          // Sub-Harmonic Oscillator
          const subOsc = ctx.createOscillator();
          subOsc.type = 'triangle'; 
          const subGain = ctx.createGain();
          subGain.gain.value = 0;
          subOsc.connect(subGain);
          subGain.connect(output);
          subOsc.start();
          
          this.subOscNode = subOsc;
          this.subGainNode = subGain;
          
          internals['subOsc'] = subOsc;
          internals['subGain'] = subGain;
        } else {
          // Ra focuses on mid-high harmonic enhancement
          const input = ctx.createGain();
          const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 200;
          const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000;
          const presence = ctx.createBiquadFilter(); presence.type = 'peaking'; presence.frequency.value = 3500;
          const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 8000;
          
          // Multi-band Saturation for Ra's "Harmonics"
          const satGain = ctx.createGain();
          const sat = ctx.createWaveShaper();
          sat.curve = makeTanhCurve(2.5); // Grittier for Ra
          
          const crossover = ctx.createBiquadFilter();
          crossover.type = 'highpass';
          crossover.frequency.value = 1200; // Focus on upper mids
          
          const sheen = ctx.createBiquadFilter();
          sheen.type = 'highshelf';
          sheen.frequency.value = 10000;
          sheen.gain.value = 0; // Controlled by "High" parameter
          
          input.connect(low);
          low.connect(mid);
          mid.connect(presence);
          presence.connect(high);
          high.connect(sheen);
          
          // Parallel saturation path
          input.connect(crossover);
          crossover.connect(satGain);
          satGain.connect(sat);
          
          const output = ctx.createGain();
          sheen.connect(output);
          sat.connect(output);
          
          processorInput = input;
          processorOutput = output;
          
          internals['low'] = low.gain;
          internals['mid'] = mid.gain;
          internals['high'] = high.gain;
          internals['sheen'] = sheen.gain;
          internals['presence'] = presence.gain;
          internals['harmonics'] = satGain.gain;
        }
        break;
      }
      case 'compressor': {
        // Zeus (Transients) - Transient Shaper style Compression
        const input = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.ratio.value = 4;
        comp.knee.value = 12;
        comp.attack.value = 0.005;
        comp.release.value = 0.05;
        
        // "Snap" stage: Parallel High-pass transient boost
        const snapFilter = ctx.createBiquadFilter();
        snapFilter.type = 'highpass';
        snapFilter.frequency.value = 2500;
        const snapGain = ctx.createGain();
        snapGain.gain.value = 0;
        
        const makeup = ctx.createGain();
        makeup.gain.value = 1.0;

        input.connect(comp);
        input.connect(snapFilter);
        snapFilter.connect(snapGain);
        
        const sum = ctx.createGain();
        comp.connect(sum);
        snapGain.connect(sum);
        sum.connect(makeup);

        processorInput = input;
        processorOutput = makeup;
        
        internals['compressor'] = comp;
        internals['threshold'] = comp.threshold;
        internals['ratio'] = comp.ratio;
        internals['attack'] = comp.attack;
        internals['release'] = comp.release;
        internals['snap'] = snapGain.gain;
        internals['makeup'] = makeup.gain;
        break;
      }
      case 'distortion': {
        // Agni (Saturation) - Multi-stage with "Sizzle" and internal Mix
        const input = ctx.createGain();
        const preGain = ctx.createGain();
        
        // Sizzle Pre-emphasis (High shelf boost before distortion)
        const sizzle = ctx.createBiquadFilter();
        sizzle.type = 'highshelf';
        sizzle.frequency.value = 5000;
        sizzle.gain.value = 6;
        
        const shaper1 = ctx.createWaveShaper();
        shaper1.curve = makeTubeCurve(2.0);
        
        const shaper2 = ctx.createWaveShaper();
        shaper2.curve = makeTubeCurve(1.4);
        
        const warmthFilter = ctx.createBiquadFilter();
        warmthFilter.type = 'lowpass';
        warmthFilter.frequency.value = 8000;
        
        const postGain = ctx.createGain();
        postGain.gain.value = 1.0;

        const mixWet = ctx.createGain();
        const mixDry = ctx.createGain();
        
        input.connect(preGain);
        input.connect(mixDry);
        
        preGain.connect(sizzle);
        sizzle.connect(shaper1);
        shaper1.connect(shaper2);
        shaper2.connect(warmthFilter);
        warmthFilter.connect(mixWet);
        
        const output = ctx.createGain();
        mixWet.connect(output);
        mixDry.connect(output);
        
        processorInput = input;
        processorOutput = output;
        
        internals['shaper'] = shaper1;
        internals['drive'] = preGain.gain;
        internals['warmth'] = warmthFilter.frequency;
        internals['sizzle'] = sizzle.gain;
        internals['mixWet'] = mixWet.gain;
        internals['mixDry'] = mixDry.gain;
        break;
      }
      case 'chorus': {
        // Artemis (Stereo) - Multi-voice Lush Chorus with Frequency Crossover
        const input = ctx.createGain();
        const output = ctx.createGain();
        
        // Crossover
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 200;
        
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 200;
        
        const monoLow = ctx.createGain(); // For centered low end
        
        const chorusBus = ctx.createGain();
        
        input.connect(hp);
        input.connect(lp);
        
        lp.connect(monoLow);
        monoLow.connect(output);
        
        hp.connect(chorusBus);

        const lfos: OscillatorNode[] = [];
        const voices = 4;
        for (let i = 0; i < voices; i++) {
          const delay = ctx.createDelay(0.1);
          delay.delayTime.value = 0.02 + i * 0.015;
          
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.value = 0.15 + i * 0.25;
          lfoGain.gain.value = 0.0025;
          lfo.connect(lfoGain);
          lfoGain.connect(delay.delayTime);
          lfo.start();
          lfos.push(lfo);
          
          const pan = ctx.createStereoPanner();
          // Wide spread
          pan.pan.value = ((i / (voices - 1)) * 2 - 1) * 0.8;
          
          chorusBus.connect(delay);
          delay.connect(pan);
          pan.connect(output);
        }
        
        const finalPanner = ctx.createStereoPanner();
        finalPanner.pan.value = 0;
        output.connect(finalPanner);

        processorInput = input;
        processorOutput = finalPanner;
        
        internals['lfos'] = lfos;
        internals['width'] = chorusBus.gain;
        internals['focus'] = [hp.frequency, lp.frequency];
        internals['pan'] = finalPanner.pan;
        break;
      }
      case 'delay': {
        // Loki (Delay) - Modulated Tape Delay with Cross-Feedback (Ping-Pong)
        const input = ctx.createGain();
        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        
        const delayL = ctx.createDelay(2.0);
        const delayR = ctx.createDelay(2.0);
        
        const fbL = ctx.createGain();
        const fbR = ctx.createGain();
        
        const crossL = ctx.createGain(); // Cross from L to R
        const crossR = ctx.createGain(); // Cross from R to L
        const straightL = ctx.createGain(); // Feedback L to L
        const straightR = ctx.createGain(); // Feedback R to R
        
        const filterL = ctx.createBiquadFilter();
        const filterR = ctx.createBiquadFilter();
        
        const limiterL = ctx.createWaveShaper();
        limiterL.curve = makeTanhCurve(1.2);
        const limiterR = ctx.createWaveShaper();
        limiterR.curve = makeTanhCurve(1.2);

        delayL.delayTime.value = 0.35;
        delayR.delayTime.value = 0.35;
        fbL.gain.value = 0.5;
        fbR.gain.value = 0.5;
        
        // Initialize as 50/50 stereo/ping-pong
        crossL.gain.value = 0.5;
        crossR.gain.value = 0.5;
        straightL.gain.value = 0.5;
        straightR.gain.value = 0.5;

        filterL.type = 'lowpass'; filterL.frequency.value = 3000;
        filterR.type = 'lowpass'; filterR.frequency.value = 3000;
        
        // Modulator for "Chaos" (Wow/Flutter)
        const wow = ctx.createOscillator();
        const wowGain = ctx.createGain();
        wow.frequency.value = 0.5;
        wowGain.gain.value = 0.002;
        wow.connect(wowGain);
        wowGain.connect(delayL.delayTime);
        wowGain.connect(delayR.delayTime);
        wow.start();

        // Jitter (Chaos/Tape Flutter)
        const jitterBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const jitterData = jitterBuffer.getChannelData(0);
        for (let i = 0; i < jitterData.length; i++) jitterData[i] = Math.random() * 2 - 1;
        
        const jitterSource = ctx.createBufferSource();
        jitterSource.buffer = jitterBuffer;
        jitterSource.loop = true;
        
        const jitterFilter = ctx.createBiquadFilter();
        jitterFilter.type = 'lowpass';
        jitterFilter.frequency.value = 2.5; // Very slow jitter
        
        const jitterGain = ctx.createGain();
        jitterGain.gain.value = 0.0015; // Subtle
        
        jitterSource.connect(jitterFilter);
        jitterFilter.connect(jitterGain);
        jitterGain.connect(delayL.delayTime);
        jitterGain.connect(delayR.delayTime);
        jitterSource.start();

        // Routing
        input.connect(splitter);
        
        // Left Path
        splitter.connect(delayL, 0);
        delayL.connect(filterL);
        filterL.connect(limiterL);
        limiterL.connect(fbL);
        fbL.connect(straightL);
        fbL.connect(crossL);
        straightL.connect(delayL);
        crossL.connect(delayR);
        
        // Right Path
        splitter.connect(delayR, 1);
        delayR.connect(filterR);
        filterR.connect(limiterR);
        limiterR.connect(fbR);
        fbR.connect(straightR);
        fbR.connect(crossR);
        straightR.connect(delayR);
        crossR.connect(delayL);
        
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        
        processorInput = input;
        processorOutput = merger;
        
        internals['wow'] = wow;
        internals['wowOsc'] = wow;
        internals['jitterSource'] = jitterSource;
        internals['delayTime'] = [delayL.delayTime, delayR.delayTime];
        internals['feedback'] = [fbL.gain, fbR.gain];
        internals['chaos'] = [filterL.frequency, filterR.frequency];
        internals['cross'] = [crossL.gain, crossR.gain];
        internals['straight'] = [straightL.gain, straightR.gain];
        internals['wow'] = wow.frequency;
        break;
      }
      case 'reverb': {
        // Poseidon (Reverb) - Lush multi-tap modulated diffusion with All-Pass stages
        const input = ctx.createGain();
        const output = ctx.createGain();
        
        // Crossover to keep sub-frequencies out of reverb
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 180;
        input.connect(hp);
        
        // Diffusion Stages: Series All-Pass Filters
        const ap1 = ctx.createBiquadFilter(); ap1.type = 'allpass'; ap1.frequency.value = 450; ap1.Q.value = 0.7;
        const ap2 = ctx.createBiquadFilter(); ap2.type = 'allpass'; ap2.frequency.value = 1200; ap2.Q.value = 0.7;
        const ap3 = ctx.createBiquadFilter(); ap3.type = 'allpass'; ap3.frequency.value = 2800; ap3.Q.value = 0.7;
        
        hp.connect(ap1);
        ap1.connect(ap2);
        ap2.connect(ap3);

        const feedbackNodes: GainNode[] = [];
        const modGainNodes: GainNode[] = [];

        const reverbMods: OscillatorNode[] = [];
        // 8 taps for denser field
        const taps = [0.029, 0.037, 0.048, 0.059, 0.078, 0.094, 0.117, 0.145];
        const tapNodes = taps.map((t, i) => {
          const d = ctx.createDelay(0.5);
          d.delayTime.value = t;
          const f = ctx.createGain();
          f.gain.value = 0.6; // Initial size
          feedbackNodes.push(f);
          
          const mod = ctx.createOscillator();
          // Prime numbers for modulation frequencies to avoid resonance peaks
          mod.frequency.value = (0.2 + (i * 0.13)) * (i % 2 === 0 ? 1 : -1);
          const modGain = ctx.createGain();
          modGain.gain.value = 0.002;
          modGainNodes.push(modGain);
          
          mod.connect(modGain);
          modGain.connect(d.delayTime);
          mod.start();
          reverbMods.push(mod);
          
          const panner = ctx.createStereoPanner();
          panner.pan.value = (i / (taps.length - 1)) * 2 - 1;
          
          d.connect(f);
          f.connect(d);
          ap3.connect(d);
          
          d.connect(panner);
          return panner;
        });
        
        const merger = ctx.createGain();
        tapNodes.forEach(t => t.connect(merger));
        
        const tone = ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = 5500;
        
        merger.connect(tone);
        tone.connect(output);
        
        processorInput = input;
        processorOutput = output;
        
        internals['mods'] = reverbMods;
        internals['size'] = feedbackNodes;
        internals['depth'] = tone.frequency;
        internals['tide'] = modGainNodes;
        break;
      }
      case 'limiter': {
        // Odin (Limiter) - Adaptive Release with Soft Clipping
        const preGain = ctx.createGain();
        const lim = ctx.createDynamicsCompressor();
        lim.threshold.value = -0.5;
        lim.ratio.value = 20;
        lim.attack.value = 0.0005; // Instant attack for Odin
        lim.release.value = 0.1;
        
        const clipper = ctx.createWaveShaper();
        clipper.curve = makeSoftClipCurve(); // High-fidelity Velvet Soft Clip
        
        preGain.connect(lim);
        lim.connect(clipper);
        
        processorInput = preGain;
        processorOutput = clipper;
        
        internals['limiter'] = lim;
        internals['threshold'] = lim.threshold;
        internals['wisdom'] = lim.release; // Map Wisdom to release
        internals['ceiling'] = preGain.gain;
        break;
      }
      case 'multi808': {
        // Multi-808 Engine (The Sonic Backbone)
        const input = ctx.createGain();
        const output = ctx.createGain();
        
        // --- Layer 1: Sub-Tone (Fundamental) ---
        const subOsc = ctx.createOscillator();
        subOsc.type = 'sine';
        const subGain = ctx.createGain();
        subGain.gain.value = 0;
        const subPhase = ctx.createDelay(0.1);
        subPhase.delayTime.value = 0;
        
        subOsc.connect(subPhase);
        subPhase.connect(subGain);
        subGain.connect(output);
        subOsc.start();
        
        // --- Layer 2: Mid-Body (Harmonics & Weight) ---
        const midInput = ctx.createGain();
        const midPhase = ctx.createDelay(0.1);
        midPhase.delayTime.value = 0;
        const midSat = ctx.createWaveShaper();
        midSat.curve = makeTubeCurve(1.5);
        const midFilter = ctx.createBiquadFilter();
        midFilter.type = 'lowpass';
        midFilter.frequency.value = 2000;
        
        input.connect(midInput);
        midInput.connect(midPhase);
        midPhase.connect(midSat);
        midSat.connect(midFilter);
        midFilter.connect(output);
        
        // --- Layer 3: Attack/Click (Transient Punch) ---
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = makeNoiseBuffer(ctx, 0.5);
        noiseSource.loop = true;
        const clickFilter = ctx.createBiquadFilter();
        clickFilter.type = 'highpass';
        clickFilter.frequency.value = 3000;
        const clickGain = ctx.createGain();
        clickGain.gain.value = 0;
        
        noiseSource.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(output);
        noiseSource.start();
        
        processorInput = input;
        processorOutput = output;
        
        internals['subOsc'] = subOsc;
        internals['noiseSource'] = noiseSource;
        internals['subGain'] = subGain.gain;
        internals['subPhase'] = subPhase.delayTime;
        internals['midDrive'] = midInput.gain;
        internals['midPhase'] = midPhase.delayTime;
        internals['midFilter'] = midFilter.frequency;
        internals['clickGain'] = clickGain.gain;
        internals['clickFilter'] = clickFilter.frequency;
        break;
      }
      case 'celestialKeys': {
        // Celestial Keys (FM Tines + Ethereal Body)
        const input = ctx.createGain();
        const output = ctx.createGain();
        
        // --- Layer 1: The Tines (FM Synthesis) ---
        const carrier = ctx.createOscillator();
        carrier.type = 'sine';
        const modulator = ctx.createOscillator();
        modulator.type = 'sine';
        const modGain = ctx.createGain();
        modGain.gain.value = 0; // Controlled by ADSR
        
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        
        const tineGain = ctx.createGain();
        tineGain.gain.value = 0;
        carrier.connect(tineGain);
        tineGain.connect(output);
        
        carrier.start();
        modulator.start();
        
        // --- Layer 2: The Body (Warm Foundation) ---
        const bodyOsc = ctx.createOscillator();
        bodyOsc.type = 'triangle'; 
        const bodyFilter = ctx.createBiquadFilter();
        bodyFilter.type = 'lowpass';
        bodyFilter.frequency.value = 2500;
        const bodyGain = ctx.createGain();
        bodyGain.gain.value = 0;
        
        bodyOsc.connect(bodyFilter);
        bodyFilter.connect(bodyGain);
        bodyGain.connect(output);
        bodyOsc.start();
        
        // --- Layer 3: Celestial Luster (Spectral Diffusion) ---
        const lusterDelay = ctx.createDelay(0.5);
        lusterDelay.delayTime.value = 0.15;
        const lusterFeedback = ctx.createGain();
        lusterFeedback.gain.value = 0.4;
        const lusterFilter = ctx.createBiquadFilter();
        lusterFilter.type = 'highpass';
        lusterFilter.frequency.value = 4000;
        
        output.connect(lusterDelay);
        lusterDelay.connect(lusterFilter);
        lusterFilter.connect(lusterFeedback);
        lusterFeedback.connect(lusterDelay);
        lusterFeedback.connect(output);
        
        processorInput = input;
        processorOutput = output;
        
        internals['tineOsc'] = carrier;
        internals['modOsc'] = modulator;
        internals['modDepth'] = modGain.gain;
        internals['tineGain'] = tineGain.gain;
        internals['bodyOsc'] = bodyOsc;
        internals['bodyGain'] = bodyGain.gain;
        internals['bodyFilter'] = bodyFilter.frequency;
        internals['lusterMix'] = lusterFeedback.gain;
        break;
      }
      case 'gain': {
        const g = ctx.createGain();
        g.gain.value = 1.0;
        processorInput = g;
        processorOutput = g;
        internals['gain'] = g.gain;
        break;
      }
      default: {
        processorInput = ctx.createGain();
        processorOutput = processorInput;
      }
    }

    if (processorInput && processorOutput) {
      wetGain.connect(processorInput);
      processorOutput.connect(outputNode);
      outputNode.connect(analyser); // Peak analysis on the wet signal
    }

    internals['wetGain'] = wetGain.gain;
    internals['dryGain'] = dryGain.gain;

    return {
      instanceId: mod.instanceId,
      type: mod.type,
      inputNode,
      outputNode,
      wetGain,
      dryGain,
      bypassed: mod.bypassed,
      internals,
      analyser
    };
  }

  // ─── Parameters ───────────────────────────────────────────────────────────

  setModuleBypass(instanceId: string, bypassed: boolean): void {
    const mn = this.moduleNodes.find(m => m.instanceId === instanceId);
    if (!mn || !this.ctx) return;
    mn.bypassed = bypassed;
    const now = this.ctx.currentTime;
    const fadeTime = 0.02;
    if (bypassed) {
      mn.wetGain.gain.setTargetAtTime(0, now, fadeTime);
      mn.dryGain.gain.setTargetAtTime(1, now, fadeTime);
    } else {
      mn.wetGain.gain.setTargetAtTime(1, now, fadeTime);
      mn.dryGain.gain.setTargetAtTime(0, now, fadeTime);
    }
  }

  setModuleInvoke(instanceId: string, intensity: number): void {
    const mn = this.moduleNodes.find(m => m.instanceId === instanceId);
    if (!mn || !this.ctx) return;
    const now = this.ctx.currentTime;
    const wet = intensity / 100;
    mn.wetGain.gain.setTargetAtTime(wet, now, 0.05);
    mn.dryGain.gain.setTargetAtTime(1 - wet, now, 0.05);
  }

  setParameter(instanceId: string, paramName: string, value: number): void {
    const mn = this.moduleNodes.find(m => m.instanceId === instanceId);
    if (!mn || !this.ctx) return;
    const param = mn.internals[paramName];
    const now = this.ctx.currentTime;
    const timeConstant = 0.05;
    if (param instanceof AudioParam) {
      param.setTargetAtTime(value, now, timeConstant);
    } else if (param instanceof GainNode) {
      param.gain.setTargetAtTime(value, now, timeConstant);
    } else if (Array.isArray(param)) {
      param.forEach(p => {
        if (p instanceof AudioParam) {
          p.setTargetAtTime(value, now, timeConstant);
        } else if (p instanceof GainNode) {
          p.gain.setTargetAtTime(value, now, timeConstant);
        }
      });
    }
  }

  setDistortionDrive(instanceId: string, driveDb: number): void {
    const mn = this.moduleNodes.find(m => m.instanceId === instanceId);
    if (!mn || !this.ctx) return;
    const shaper = mn.internals['shaper'];
    if (shaper instanceof WaveShaperNode) {
      const amount = Math.pow(10, driveDb / 20);
      // Agni gets the special tube curve
      shaper.curve = instanceId === 'agni' ? makeTubeCurve(amount) : makeTanhCurve(amount);
    }
    const preGain = mn.internals['drive'];
    if (preGain instanceof AudioParam) {
      preGain.setTargetAtTime(Math.pow(10, driveDb / 40), this.ctx.currentTime, 0.05);
    }
  }

  getSlotLevels(): number[] {
    return this.slotAnalysers.map(analyser => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let max = 0;
      for (let i = 0; i < data.length; i++) {
        const val = Math.abs(data[i] - 128);
        if (val > max) max = val;
      }
      return max / 128;
    });
  }

  getArpStep(): number {
    return this.currentArpStep;
  }

  private startArp(): void {
    if (!this.ctx) return;
    this.currentArpStep = 0;
    this.nextStepTime = this.ctx.currentTime;
    
    // If we have a Worklet, it's ticking already, but we need to run an initial scheduling pass
    this.scheduler();
  }

  private stopArp(): void {
    if (this.arpTimerId) {
      clearTimeout(this.arpTimerId);
      this.arpTimerId = null;
    }
  }

  private scheduler(): void {
    if (!this.ctx || !this.arpEnabled) return;
    
    while (this.nextStepTime < this.ctx.currentTime + 0.1) {
      this.scheduleStep(this.currentArpStep, this.nextStepTime);
      this.nextStepTime += this.arpRate;
      this.currentArpStep = (this.currentArpStep + 1) % this.arpSteps;
    }
    
    if (!this.clockNode) {
      if (this.arpTimerId) clearTimeout(this.arpTimerId);
      this.arpTimerId = setTimeout(() => this.scheduler(), 25);
    }
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx) return;
    
    // Cycle through octaves: e.g. 0, +1, +2 depending on arpOctaves
    const octCycle = this.arpOctaves > 0 ? (Math.floor(step / 4) % (this.arpOctaves + 1)) : 0;
    const detuneShift = octCycle * 1200;

    // Trigger any held pads or active sequence
    this.heldPads.forEach(padIdx => {
      this.playBufferPartAtTime(padIdx, time, this.arpRate * this.arpGate, detuneShift);
    });
  }

  async playBufferPartAtTime(index: number, time: number, duration: number, detuneShift: number = 0): Promise<void> {
    if (!this.ctx || !this.buffers[index]) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const voice = this.findFreeVoice();
    const { adsr, filter, pan, rate } = this.getVoiceParams(index);
    
    // Combine base rate with detuneShift (cents)
    const finalRate = rate * Math.pow(2, detuneShift / 1200);

    // Route voice through the slot's DSP chain for metering
    const slotIdx = index % this.slotGains.length;
    if (this.slotGains[slotIdx]) {
      voice.setDestination(this.slotGains[slotIdx]);
    }

    voice.trigger(
      this.buffers[index]!,
      time,
      0, // offset
      duration,
      finalRate,
      adsr,
      filter,
      pan,
      index
    );
  }

  /**
   * Phase 6: Cross-Engine Voice Routing.
   * The sequencer calls this to trigger a pad/slot at a precisely scheduled time.
   * All per-slot DSP (gain → saturator → panner → analyser) is applied.
   *
   * @param padIndex - Pad/track index (0-15)
   * @param time     - AudioContext scheduled time (from sequencer scheduler)
   * @param velocity - 0-127 velocity
   * @param pitch    - Semitone offset (-24 to +24, default 0)
   * @param decay    - Decay factor (0-1, default 0.5)
  /**
   * Triggers a pad immediately (used by UI buttons and MPC-style clicks).
   */
  public triggerPad(padIndex: number): void {
    if (!this.ctx) return;
    this.triggerPadAtTime(padIndex, this.ctx.currentTime);
  }

  triggerPadAtTime(
    padIndex: number,
    time: number,
    velocity: number = 127,
    pitch: number = 0,
    decay: number = 0.5,
    reverse: boolean = false,
    sliceIndex: number = 0
  ): void {
    if (!this.ctx || !this.buffers[padIndex]) return;

    const voice = this.findFreeVoice();
    const { adsr, filter, pan, rate } = this.getVoiceParams(padIndex);

    // Pitch shift from sequencer step
    const pitchRate = rate * Math.pow(2, pitch / 12);

    // Velocity scaling
    const velGain = velocity / 127;

    // Route through slot DSP chain
    const slotIdx = padIndex % this.slotGains.length;
    if (this.slotGains[slotIdx]) {
      voice.setDestination(this.slotGains[slotIdx]);
    }

    // Decay duration
    const decayDuration = 0.05 + decay * 2.0;

    // Ensure we have a reversed buffer if requested
    if (reverse && !this.reversedBuffers[padIndex] && this.buffers[padIndex]) {
      this.reversedBuffers[padIndex] = this.reverseAudioBuffer(this.buffers[padIndex]!);
    }

    const bufferToUse = reverse && this.reversedBuffers[padIndex] 
      ? this.reversedBuffers[padIndex]! 
      : this.buffers[padIndex]!;

    // Basic slicing calculation (assuming 16 equal slices if not using full slice data)
    let offset = 0;
    if (sliceIndex > 0) {
      const sliceLength = bufferToUse.duration / 16;
      offset = (sliceIndex - 1) * sliceLength;
      // If reversed, the start point needs to be flipped relative to the buffer end
      if (reverse) {
        offset = bufferToUse.duration - offset - sliceLength;
      }
    }

    voice.trigger(
      bufferToUse,
      time,
      offset,
      decayDuration,
      pitchRate,
      { ...adsr, sustain: adsr.sustain * velGain },
      filter,
      pan,
      padIndex
    );
  }

  updateFromParameters(params: Record<string, any>): void {
    if (!this.ctx) return;
    this.lastParams = { ...this.lastParams, ...params };

    // Arp Controls
    if (params['arpEnabled'] !== undefined) {
      this.arpEnabled = params['arpEnabled'];
      if (this.arpEnabled && !this.arpTimerId && !this.clockNode) {
        this.startArp();
      } else if (!this.arpEnabled && this.arpTimerId) {
        this.stopArp();
      }
    }

    if (params['arpRate'] !== undefined) {
      // Phase 5: Store as beat-relative division, compute actual rate from BPM
      const divisions = [4, 2, 1, 0.5, 0.25]; // whole, half, quarter, 8th, 16th (in beats)
      const idx = Math.floor((params['arpRate'] / 100) * (divisions.length - 1));
      this.arpNoteDivision = divisions[idx];
      this.arpRate = this.arpNoteDivision * (60 / this._bpm);
    }
    if (params['arpGate'] !== undefined) this.arpGate = params['arpGate'] / 100;
    if (params['arpSwing'] !== undefined) this.arpSwing = params['arpSwing'] / 100;
    if (params['arpOct'] !== undefined) this.arpOctaves = Math.floor((params['arpOct'] / 100) * 3);

    // Master Volume
    if (params['masterVolume'] !== undefined) {
      const db = -60 + (params['masterVolume'] / 100) * 66;
      const gain = params['masterVolume'] === 0 ? 0 : Math.pow(10, db / 20);
      this._masterVolume = gain;
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
      }
    }

    // Master Dynamics / Limiter
    if (params['masterDynamicsThreshold'] !== undefined && this.masterLimiter) {
      this.masterLimiter.threshold.setTargetAtTime(params['masterDynamicsThreshold'], this.ctx.currentTime, 0.05);
    }
    if (params['masterDynamicsRatio'] !== undefined && this.masterLimiter) {
      this.masterLimiter.ratio.setTargetAtTime(params['masterDynamicsRatio'], this.ctx.currentTime, 0.05);
    }
    if (params['masterDynamicsAttack'] !== undefined && this.masterLimiter) {
      this.masterLimiter.attack.setTargetAtTime(params['masterDynamicsAttack'] / 1000, this.ctx.currentTime, 0.05); // ms -> s
    }
    if (params['masterDynamicsRelease'] !== undefined && this.masterLimiter) {
      this.masterLimiter.release.setTargetAtTime(params['masterDynamicsRelease'] / 1000, this.ctx.currentTime, 0.05); // ms -> s
    }

    // --- Slot & God Module Updates ---
    for (const [id, value] of Object.entries(params)) {
      // Slot logic
      if (id.startsWith('slotPower_')) {
        const idx = parseInt(id.split('_')[1]);
        if (this.slotGains[idx]) this.slotGains[idx].gain.setTargetAtTime(value ? 1 : 0, this.ctx.currentTime, 0.05);
      }
      if (id.startsWith('slotVol_')) {
        const idx = parseInt(id.split('_')[1]);
        if (this.slotGains[idx]) this.slotGains[idx].gain.setTargetAtTime(value / 100, this.ctx.currentTime, 0.05);
      }
      if (id.startsWith('slotPan_')) {
        const idx = parseInt(id.split('_')[1]);
        if (this.slotPanners[idx]) this.slotPanners[idx].pan.setTargetAtTime((value / 100) * 2 - 1, this.ctx.currentTime, 0.05);
      }
      // Slot texture logic: Handled by Neural Orchestration for blended intelligence
      if (id.startsWith('slotTexture_')) {
        // No manual update here anymore, applyNeuralOrchestration will handle it
      }

      // Per-slot ADSR envelope — map from UI params (slotAttack_N) to engine format (slotN_attack)
      if (id.startsWith('slotAttack_')) {
        const idx = parseInt(id.split('_')[1]);
        // Map 0-100 → 0.001s – 2.0s (exponential for musical feel)
        this.lastParams[`slot${idx}_attack`] = 0.001 + (value / 100) * (value / 100) * 2.0;
      }
      if (id.startsWith('slotDecay_')) {
        const idx = parseInt(id.split('_')[1]);
        // Map 0-100 → 0.01s – 3.0s
        this.lastParams[`slot${idx}_decay`] = 0.01 + (value / 100) * (value / 100) * 3.0;
      }
      if (id.startsWith('slotSustain_')) {
        const idx = parseInt(id.split('_')[1]);
        // Map 0-100 → 0.0 – 1.0 (linear)
        this.lastParams[`slot${idx}_sustain`] = value / 100;
      }
      if (id.startsWith('slotRelease_')) {
        const idx = parseInt(id.split('_')[1]);
        // Map 0-100 → 0.01s – 5.0s
        this.lastParams[`slot${idx}_release`] = 0.01 + (value / 100) * (value / 100) * 5.0;
      }

      // Per-slot Filter — map from UI (slotFilterFreq_N) to engine (slotN_filterFreq)
      if (id.startsWith('slotFilterType_')) {
        const idx = parseInt(id.split('_')[1]);
        this.lastParams[`slot${idx}_filterType`] = value; // BiquadFilterType string
      }
      if (id.startsWith('slotFilterFreq_')) {
        const idx = parseInt(id.split('_')[1]);
        // Map 0-100 → 20Hz – 20000Hz (logarithmic for musical frequency sweep)
        const minF = Math.log(20);
        const maxF = Math.log(20000);
        const freq = Math.exp(minF + (value / 100) * (maxF - minF));
        this.lastParams[`slot${idx}_filterFreq`] = freq;
      }
      if (id.startsWith('slotFilterQ_')) {
        const idx = parseInt(id.split('_')[1]);
        // Map 0-100 → 0.5 – 20 (logarithmic for resonance)
        this.lastParams[`slot${idx}_filterQ`] = 0.5 + (value / 100) * 19.5;
      }

      // Per-slot FX Sends — store normalized 0-1 for send bus routing
      if (id.startsWith('slotFxRev_')) {
        const idx = parseInt(id.split('_')[1]);
        this.lastParams[`slot${idx}_fxRev`] = value / 100;
      }
      if (id.startsWith('slotFxChr_')) {
        const idx = parseInt(id.split('_')[1]);
        this.lastParams[`slot${idx}_fxChr`] = value / 100;
      }
      if (id.startsWith('slotFxDly_')) {
        const idx = parseInt(id.split('_')[1]);
        this.lastParams[`slot${idx}_fxDly`] = value / 100;
      }
      if (id.startsWith('slotFxSat_')) {
        const idx = parseInt(id.split('_')[1]);
        this.lastParams[`slot${idx}_fxSat`] = value / 100;
      }

      // Bypass toggles
      if (typeof value === 'boolean' && id.endsWith('_bypass')) {
        const instanceId = id.split('_')[1];
        if (instanceId) this.setModuleBypass(instanceId, value);
      }

      // God parameters mapping
      const parts = id.split('_');
      if (parts.length >= 3 && parts[0] === 'god' && typeof value === 'number') {
        const instanceId = parts[1];
        const param = parts[2].toLowerCase();
        
        if (param === 'invoke') {
          this.setModuleInvoke(instanceId, value);
          continue;
        }

        const moduleType = this.moduleNodes.find(m => m.instanceId === instanceId)?.type;
        if (!moduleType) continue;

        switch (moduleType) {
          case 'eq':
            if (instanceId === 'anubis') {
              if (param === 'rumble') this.setParameter(instanceId, 'rumble', (value / 100) * 12);
              else if (param === 'darkness') {
                this.setParameter(instanceId, 'darknessLow', (value / 100) * 8);
                this.setParameter(instanceId, 'darknessHigh', -(value / 100) * 12);
                this.setParameter(instanceId, 'bias', 1.0 + (value / 100) * 1.5);
              } else if (param === 'depth') {
                this.setParameter(instanceId, 'depth', 0.5 + (value / 100) * 1.8);
                const subGain = this.moduleNodes.find(m => m.instanceId === instanceId)?.internals['subGain'];
                if (subGain instanceof GainNode) subGain.gain.setTargetAtTime((value / 100) * 0.8, this.ctx.currentTime, 0.05);
              }
            } else { // Ra
              if (param === 'low') this.setParameter(instanceId, 'low', (value / 100) * 18 - 6);
              else if (param === 'mid') this.setParameter(instanceId, 'mid', (value / 100) * 14 - 7);
              else if (param === 'high') {
                this.setParameter(instanceId, 'high', (value / 100) * 16 - 8);
                this.setParameter(instanceId, 'sheen', (value / 100) * 10);
              } else if (param === 'presence') {
                this.setParameter(instanceId, 'presence', (value / 100) * 12 - 6);
                this.setParameter(instanceId, 'harmonics', (value / 100) * 2.5);
              }
            }
            break;
          case 'compressor': // Zeus
            if (param === 'threshold') this.setParameter(instanceId, 'threshold', -60 + (value / 100) * 60);
            else if (param === 'attack') this.setParameter(instanceId, 'attack', 0.001 + (value / 100) * 0.1);
            else if (param === 'punch') {
              this.setParameter(instanceId, 'ratio', 1 + (value / 100) * 39); 
              this.setParameter(instanceId, 'snap', (value / 100) * 2.0);
              this.setParameter(instanceId, 'attack', 0.02 * (1 - value / 100) + 0.0005);
            } else if (param === 'sustain') this.setParameter(instanceId, 'release', 0.02 + (value / 100) * 1.5);
            break;
          case 'distortion': // Agni
            if (param === 'drive') this.setDistortionDrive(instanceId, (value / 100) * 50);
            else if (param === 'warmth') {
              this.setParameter(instanceId, 'warmth', 800 + (1 - value / 100) * 19200);
              this.setParameter(instanceId, 'sizzle', (value / 100) * 15);
            } else if (param === 'mix') {
              this.setParameter(instanceId, 'mixWet', value / 100);
              this.setParameter(instanceId, 'mixDry', 1 - (value / 100));
            }
            break;
          case 'delay': // Loki
            if (param === 'time') this.setParameter(instanceId, 'delayTime', 0.05 + (value / 100) * 1.95);
            else if (param === 'feedback') this.setParameter(instanceId, 'feedback', (value / 100) * 0.98);
            else if (param === 'chaos') {
              this.setParameter(instanceId, 'chaos', 250 + (1 - value / 100) * 15000);
              this.setParameter(instanceId, 'wow', 0.1 + (value / 100) * 6.0);
              this.setParameter(instanceId, 'cross', value / 100);
              this.setParameter(instanceId, 'straight', 1 - (value / 100));
            }
            break;
          case 'chorus':
            if (param === 'width') this.setParameter(instanceId, 'width', (value / 100) * 3.0);
            else if (param === 'focus') this.setParameter(instanceId, 'focus', 20 + (value / 100) * 3480);
            else if (param === 'pan') this.setParameter(instanceId, 'pan', (value / 100) * 2 - 1);
            break;
          case 'reverb': // Poseidon
            if (param === 'size') this.setParameter(instanceId, 'size', 0.5 + (value / 100) * 0.48);
            else if (param === 'depth') this.setParameter(instanceId, 'depth', 300 + (value / 100) * 16000);
            else if (param === 'tide') this.setParameter(instanceId, 'tide', (value / 100) * 0.015);
            break;
          case 'limiter': // Odin
            if (param === 'ceiling') this.setParameter(instanceId, 'ceiling', 1.0 + (value / 100) * 1.5);
            else if (param === 'wisdom') this.setParameter(instanceId, 'wisdom', 0.01 + (1 - value / 100) * 0.8);
            break;
          case 'multi808':
            if (param === 'sub') this.setParameter(instanceId, 'subGain', value / 100);
            else if (param === 'mid') this.setParameter(instanceId, 'midDrive', (value / 100) * 2.0);
            else if (param === 'click') this.setParameter(instanceId, 'clickGain', (value / 100) * 0.5);
            else if (param === 'phase') this.setParameter(instanceId, 'subPhase', (value / 100) * 0.02);
            else if (param === 'drive') this.setParameter(instanceId, 'midDrive', 1.0 + (value / 100) * 3.0);
            break;
          case 'celestialKeys': // Artemis
            if (param === 'tines') this.setParameter(instanceId, 'tineGain', value / 100);
            else if (param === 'hammer') this.setParameter(instanceId, 'modDepth', (value / 100) * 1000);
            else if (param === 'drift') {
              const mn = this.moduleNodes.find(m => m.instanceId === instanceId);
              const tineOsc = mn?.internals['tineOsc'];
              if (tineOsc instanceof OscillatorNode) {
                const driftAmount = (value / 100) * 2;
                tineOsc.detune.setTargetAtTime(Math.sin(Date.now() / 500) * driftAmount, this.ctx.currentTime, 0.1);
              }
            } else if (param === 'luster') this.setParameter(instanceId, 'lusterMix', (value / 100) * 0.8);
            break;
        }
      }
    }

    // --- Divine Chopper Updates ---
    if (params['chopperReverse'] !== undefined) {
      const activePad = params['activePad'] ?? 0;
      if (params['chopperReverse'] && !this.reversedBuffers[activePad] && this.buffers[activePad]) {
        this.reversedBuffers[activePad] = this.reverseAudioBuffer(this.buffers[activePad]!);
      }
    }

    // --- LFO & Aura Modulation Matrix Updates ---
    for (let i = 0; i < 4; i++) {
      if (params[`lfoRate_${i}`] !== undefined) {
        const rateVal = params[`lfoRate_${i}`];
        const minHz = Math.log(0.1);
        const maxHz = Math.log(20);
        const hz = Math.exp(minHz + (rateVal / 100) * (maxHz - minHz));
        if (this.lfos[i]) {
          this.lfos[i].frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.05);
        }
      }

      if (params[`lfoDepth_${i}`] !== undefined) {
        const depthVal = params[`lfoDepth_${i}`];
        if (this.lfoGains[i]) {
          this.lfoGains[i].gain.setTargetAtTime(depthVal / 100, this.ctx.currentTime, 0.05);
        }
      }

      if (params[`lfoShape_${i}`] !== undefined) {
        const shapeVal = params[`lfoShape_${i}`];
        const shapes: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];
        const targetShape = shapes[shapeVal] || 'sine';
        if (this.lfos[i]) {
          this.lfos[i].type = targetShape;
        }
      }

      const actKey = `routingActive_${i}`;
      const amtKey = `routingAmt_${i}`;
      if (params[actKey] !== undefined || params[amtKey] !== undefined) {
        const active = params[actKey] !== undefined ? params[actKey] : (this.lastParams[actKey] ?? (i === 1 ? false : true));
        const amt = params[amtKey] !== undefined ? params[amtKey] : (this.lastParams[amtKey] ?? (i === 0 ? 45 : i === 1 ? 12 : i === 2 ? 68 : 92));
        
        let scale = 1.0;
        if (i < 3) {
          scale = 12.0; // Modulate EQ gain by up to +/- 12 dB
        } else {
          scale = 1.0;  // Modulate width by up to +/- 1.0
        }
        
        const targetGain = active ? (amt / 100) * scale : 0;
        if (this.routingGains[i]) {
          this.routingGains[i].gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
        }
      }
    }

    // --- Apply Neural Orchestration ---
    this.applyNeuralOrchestration(params);
  }

  // --- Neural Orchestration (Phase 5) ---

  /**
   * Morphs the entire engine state between two preset states.
   * This is used for the "Super-Macro" morphing between Heaven and Hell.
   */
  public morphPresets(stateA: any, stateB: any, factor: number): void {
    if (!stateA || !stateB) return;
    
    const morphedParams: Record<string, any> = {};
    const allKeys = new Set([...Object.keys(stateA.params || {}), ...Object.keys(stateB.params || {})]);

    allKeys.forEach(key => {
      const valA = stateA.params?.[key] ?? (key.startsWith('slotVol') ? 80 : 50);
      const valB = stateB.params?.[key] ?? (key.startsWith('slotVol') ? 80 : 50);

      if (typeof valA === 'number' && typeof valB === 'number') {
        morphedParams[key] = valA + (valB - valA) * factor;
      } else {
        // For non-numeric (booleans, strings), snap at 0.5
        morphedParams[key] = factor < 0.5 ? valA : valB;
      }
    });

    this.updateFromParameters(morphedParams);
  }

  /**
   * Stores a sonic anchor point in the Vortex Memory.
   */
  public saveVortexAnchor(x: number, y: number, name: string): void {
    this.vortexMemory.push({ x, y, name });
    if (this.vortexMemory.length > 8) this.vortexMemory.shift(); // Keep last 8
  }

  public getVortexAnchors() {
    return this.vortexMemory;
  }

  /**
   * Auto-Mixing Semantic Logic: Adjusts the mix based on semantic analysis
   * of the Four Anchors to maintain professional "Velvet Score" balance.
   */
  /**
   * Auto-Mixing Semantic Logic: Adjusts the mix based on semantic analysis
   * of the Four Anchors to maintain professional "Velvet Score" balance.
   * This is the "Master Intelligence" of the Modern Crystal Silk aesthetic.
   */
  public applyNeuralOrchestration(params: Record<string, any> = {}): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // 1. Extract Core Macros & Stats
    const energy = this.lastParams['macro_energy'] ?? 50;
    const divinity = this.lastParams['macro_divinity'] ?? 50;
    const widthMacro = this.lastParams['macro_width'] ?? 50;
    const realm = this.lastParams['macro_realm'] ?? 50;
    
    const energyFactor = energy / 100;
    const divinityFactor = divinity / 100;
    const widthFactor = widthMacro / 100;
    const realmFactor = realm / 100;

    // 2. Calculate Divine Power (Average of all God Invokes)
    let totalInvoke = 0;
    let godCount = 0;
    for (const [id, value] of Object.entries(this.lastParams)) {
      if (id.startsWith('god_') && id.includes('_invoke')) {
        totalInvoke += (value as number);
        godCount++;
      }
    }
    const avgInvoke = godCount > 0 ? totalInvoke / godCount : 0;
    // Weighted combination of specific macros and general divine power
    const divinePower = Math.pow((avgInvoke * 0.4 + divinity * 0.6) / 100, 1.2);

    // --- Modern Crystal Silk Intelligence ---
    
    // 1. Soul Intelligence (Mid-range Warmth & Clarity)
    if (this.masterSoulFilter) {
      this.masterSoulFilter.type = 'peaking';
      
      // The "De-clutter" logic: High energy often brings mud in the 300-500Hz range.
      // Divinity (and divinePower) brings "Soul" but needs transparency.
      const mudDip = energyFactor * -4.5;
      const soulBoost = divinePower * 4.2; // Use divinePower for a more global intelligence
      const targetGain = mudDip + soulBoost;
      
      // Dynamic frequency: Shift from 350Hz (mud) to 2.8kHz (soul) based on divine influence
      const targetFreq = 350 * (1 - divinePower) + 2800 * divinePower;
      const targetQ = 0.65 + (energyFactor * 0.55); // Tighter Q at high energy
      
      this.masterSoulFilter.frequency.setTargetAtTime(targetFreq, now, 0.8);
      this.masterSoulFilter.gain.setTargetAtTime(targetGain, now, 0.6);
      this.masterSoulFilter.Q.setTargetAtTime(targetQ, now, 0.5);
    }

    // 2. Crystal Silk (High-end Extension & Protection)
    if (this.masterSilkFilter) {
      // Silk Protection: Prevent brittleness when both energy and divinity are pushed.
      // This is the core of the Modern Crystal Silk transparency.
      const harshness = (energyFactor * 0.65) + (divinePower * 0.35);
      
      // Frequency slides higher for "Air" as harshness increases, avoiding the 3-6kHz "pain zone"
      const crystalFreq = 11000 + (divinityFactor * 5000) + (harshness * 3000);
      this.masterSilkFilter.frequency.setTargetAtTime(crystalFreq, now, 1.0);
      
      // Gain: Boost for air, but attenuate slightly if harshness is extreme (HEP)
      // This targets the "Pain Zone" (3-6kHz) indirectly via the shelf response
      let targetSilkGain = (divinePower * 14.5) + (energyFactor * 4.0) - (realmFactor * 5.0);
      
      if (harshness > 0.7) {
        // High-end Excitation Protection: Smooth logarithmic roll-off
        const excess = harshness - 0.7;
        const reduction = Math.log10(1 + excess * 15) * 6; // Damping in dB
        targetSilkGain -= reduction;
      }
      
      this.masterSilkFilter.gain.setTargetAtTime(Math.max(-4, targetSilkGain), now, 0.7);
    }

    // 3. Spatial Air (Stereo Field Intelligence)
    if (this.widthGain && this.imagerFilter) {
      // High divinity = Wider, Airy. High energy = Focused Center.
      const baseWidth = 1.0 + (divinityFactor * 0.6) + (widthFactor * 0.4);
      const adaptiveWidth = baseWidth * (1.0 - (energyFactor * 0.3));
      this.widthGain.gain.setTargetAtTime(Math.min(2.0, adaptiveWidth), now, 1.0);
      
      // Imager: Boost high-end width specifically (Spatial Air Cross-over at 3.5kHz)
      this.imagerFilter.frequency.setTargetAtTime(3500 + (energyFactor * 1500), now, 1.2);
      const imagerGain = (divinityFactor * 9.0) + (widthFactor * 5.0) - (energyFactor * 2.0);
      this.imagerFilter.gain.setTargetAtTime(Math.max(0, imagerGain), now, 0.8);
    }

    // 4. Intelligent Body Tightness (Low-end Control)
    if (this.masterBodyFilter) {
      // Shift low-shelf up at high energy to keep it "tight"
      const targetFreq = 120 + (energyFactor * 80) - (divinityFactor * 30); 
      this.masterBodyFilter.frequency.setTargetAtTime(targetFreq, now, 1.0);
      
      // Body Gain: Punchy but never muddy
      const bodyGain = (energyFactor * 8.5) - (divinityFactor * 3.0);
      const targetQ = 0.6 + (energyFactor * 0.4); // Increase Q for "tightness"
      
      this.masterBodyFilter.gain.setTargetAtTime(bodyGain, now, 0.5);
      this.masterBodyFilter.Q.setTargetAtTime(targetQ, now, 0.5);
    }

    // 5. Adaptive Saturation (The "Silk" Harmonic Stage)
    if (this.masterSaturator) {
      const baseDrive = 1.0 + (energyFactor * 6.0) + (realmFactor * 3.0);
      const adaptiveDrive = baseDrive * (1.0 - divinityFactor * 0.25);
      const silkAmount = 0.2 + (divinityFactor * 0.8);
      
      // Threshold for regenerating expensive WaveShaper curves
      const slotTextureChanged = Object.keys(this.lastParams).some(k => k.startsWith('slotTexture_') && params[k] !== undefined);
      
      if (Math.abs(adaptiveDrive - this.lastAppliedSaturatorDrive) > 0.05 || 
          Math.abs(silkAmount - this.lastAppliedSaturatorSilk) > 0.03 ||
          slotTextureChanged) {
        
        this.masterSaturator.curve = makeVelvetCurve(adaptiveDrive, silkAmount);
        this.lastAppliedSaturatorDrive = adaptiveDrive;
        this.lastAppliedSaturatorSilk = silkAmount;
        
        // Soft clipper curve calibration for consolidated limiting
        if (this.masterSoftClipper) {
          const limThreshold = 0.85 - (energyFactor * 0.15);
          // Increase ratio for harder energy, smoother for silk profile
          const limRatio = 15 + (energyFactor * 20) - (divinePower * 8);
          this.masterSoftClipper.curve = makeVelvetLimiterCurve(adaptiveDrive, silkAmount, limThreshold, limRatio);
        }

        // Modular Intelligence: Also modulate individual slot saturators for sonic coherence
        this.slotSaturators.forEach((sat, idx) => {
          if (sat) {
            // Blended Logic: Combine user-defined grit with global master intelligence
            const manualTexture = (this.lastParams[`slotTexture_${idx}`] as number) ?? 50;
            const slotBaseDrive = 1.0 + (manualTexture / 100) * 5.0;
            
            // Slots get a fraction of the master drive for "creamy" saturation "glue"
            const slotDrive = slotBaseDrive * (1.0 + (adaptiveDrive - 1.0) * 0.35);
            const slotSilk = 0.3 + (silkAmount * 0.6);
            sat.curve = makeVelvetCurve(slotDrive, slotSilk);
          }
        });
      }
    }

    // 6. Sentient Dynamics (Master Limiter)
    if (this.masterLimiter) {
      // Transparent release: Fast for energy (punch), smooth for divinity (silk)
      const release = 0.12 * (1 - energyFactor) + 0.08 * (1 + divinityFactor) + (realmFactor * 0.1);
      this.masterLimiter.release.setTargetAtTime(release, now, 0.4);
      
      // Adaptive Attack: Faster to catch transients in high energy, slower for silk clarity
      const attack = 0.0003 * (1 - energyFactor) + 0.003 * divinePower;
      this.masterLimiter.attack.setTargetAtTime(Math.max(0.0001, attack), now, 0.2);
      
      // Knee: Soften the knee as divinity increases for maximum transparency
      const knee = 3 + (divinityFactor * 27);
      this.masterLimiter.knee.setTargetAtTime(knee, now, 0.4);
      
      // Threshold: Calibrated for "Flow" loudness target (-12 LUFS base, -8 LUFS extreme)
      // We push the threshold lower as energy increases to drive into the soft-clipper stage.
      const thresholdDb = -1.0 - (energyFactor * 10.5) - (divinePower * 2.5);
      this.masterLimiter.threshold.setTargetAtTime(thresholdDb, now, 0.3);
      
      // Ratio: Dynamic from 4:1 (transparent) to 20:1 (brickwall max for Web Audio API)
      const ratio = Math.min(20, 4 + (energyFactor * 16));
      this.masterLimiter.ratio.setTargetAtTime(ratio, now, 0.4);
    }

    // 7. Intelligent Auto-Gain (Level Smoothing)
    if (this.masterGain) {
      // Makeup gain to keep perceived loudness consistent, respecting the -1.0 dB peak
      const driveCompensation = 0.9 / (1.0 + (energyFactor * 0.8) + (realmFactor * 0.4));
      const targetGain = this._masterVolume * driveCompensation;
      this.masterGain.gain.setTargetAtTime(targetGain, now, 0.5);
    }

    // 8. Modular Macro Orchestration
    this.moduleNodes.forEach(mn => {
      if (mn.type === 'chorus') {
        const chorusWidth = (widthFactor * 3.5) + (divinityFactor * 2.0);
        this.setParameter(mn.instanceId, 'width', chorusWidth);
      }
      if (mn.type === 'reverb') {
        const reverbSize = 0.4 + (divinityFactor * 0.55) + (realmFactor * 0.2);
        this.setParameter(mn.instanceId, 'size', reverbSize);
        // Link divinity to reverb brightness (shimmer feel)
        this.setParameter(mn.instanceId, 'damping', 1.0 - (divinityFactor * 0.5));
      }
    });
  }
}
