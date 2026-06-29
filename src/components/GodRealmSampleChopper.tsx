/**
 * SacredChopper — God Realm Sample Slicer & Editor
 *
 * Overhauled: Vanilla CSS, persisted params, Grid/Auto chop modes,
 * add/remove slice markers, slice preview playback, performance-aware animation.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './SacredChopper.css';
import { useJuceBridge } from '@/hooks/useJuceBridge';
import { neuralInputBus } from '../services/neuralInputBus';
import { chopSessionService, ChopSession } from '../services/chopSessionService';
import { audioEngine } from '../services/audioEngine';
import { presetService } from '../services/presetService';
import { nativeAudio } from '../native/bridge';

export interface SacredChopperProps {
  trackIndex: number;
  trackName: string;
  trackColor: string;
  buffer: AudioBuffer | null;
  sampleParams: {
    start: number;
    end: number;
    reverse: boolean;
    slices: { start: number; end: number }[];
    chopperSpeed: number;
    chopperPitch: number;
    chopperFadeIn: number;
    chopperFadeOut: number;
    chopperGlide: number;
    chopperSensitivity: number;
    chopperTrigger: 'MIDI' | 'Gate' | 'OneShot';
    chopperDryWet: number;
    chopperOutputVolume: number;
    chopMode: 'Manual' | 'Auto' | 'Grid';
    scopeGlobal: boolean;
    snapToTransient: boolean;
    snapToZero: boolean;
  };
  onUpdateParam: (param: string, value: any) => void;
  onClose: () => void;
  onSpreadToPads?: (slices: { start: number; end: number; sliceStart?: number; sliceDuration?: number; buffer: AudioBuffer }[]) => void;
  /** Called when the user drops an audio file onto the chopper panel. */
  onFileDropped?: (file: File, buffer: AudioBuffer) => void;
  /** Called when the user clears the loaded sample. */
  onClearSample?: () => void;
  /** Show a toast message */
  showMessage?: (msg: string) => void;
  /** Current DAW/transport BPM — used for auto-stretch */
  bpm?: number;
  /** Whether this tab is currently displayed — gates MIDI triggering */
  isActiveTab?: boolean;
}

/**
 * Trim leading silence from an AudioBuffer.
 * Returns a new AudioBuffer that starts at the first sample above `threshold`.
 */
function trimLeadingSilence(ctx: AudioContext, buf: AudioBuffer, threshold = 0.005): AudioBuffer {
  const data = buf.getChannelData(0);
  let startSample = 0;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) { startSample = Math.max(0, i - Math.floor(buf.sampleRate * 0.002)); break; }
  }
  if (startSample === 0) return buf;
  const newLen = buf.length - startSample;
  if (newLen <= 0) return buf;
  const trimmed = ctx.createBuffer(buf.numberOfChannels, newLen, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch);
    trimmed.copyToChannel(src.slice(startSample), ch);
  }
  return trimmed;
}

/**
 * Calculate playback-rate ratio to match a sample's natural BPM to the current BPM.
 * If we can't detect a tempo, returns 1 (no stretch).
 * This is a simple heuristic: assume the sample is exactly nBeats beats long
 * based on its duration.
 */
function calcBpmStretch(buf: AudioBuffer, targetBpm: number, nBeats = 4): number {
  const durationSec  = buf.duration;
  const naturalBpm   = (nBeats / durationSec) * 60;
  const ratio = targetBpm / naturalBpm;
  // Clamp to sane range (50%–200%)
  return Math.min(2, Math.max(0.5, ratio));
}

/** Detect transient peaks in an AudioBuffer */
function detectTransients(buffer: AudioBuffer, sensitivity: number): number[] {
  const data = buffer.getChannelData(0);
  const blockSize = Math.floor(buffer.sampleRate * 0.01); // 10ms blocks
  const blocks = Math.floor(data.length / blockSize);
  const energies = new Float32Array(blocks);

  for (let b = 0; b < blocks; b++) {
    let sum = 0;
    for (let i = 0; i < blockSize; i++) {
      const s = data[b * blockSize + i];
      sum += s * s;
    }
    energies[b] = sum / blockSize;
  }

  // Find peaks where energy jumps significantly
  const threshold = (101 - sensitivity) * 0.0002; // higher sensitivity = lower threshold
  const transients: number[] = [];
  for (let b = 1; b < blocks; b++) {
    const diff = energies[b] - energies[b - 1];
    if (diff > threshold && energies[b] > 0.0001) {
      const pos = (b * blockSize) / data.length;
      // Don't place too close to previous
      if (transients.length === 0 || pos - transients[transients.length - 1] > 0.03) {
        transients.push(pos);
      }
    }
  }
  return transients;
}

/** Generate evenly-spaced grid markers */
function generateGridMarkers(count: number): number[] {
  const markers: number[] = [];
  for (let i = 1; i < count; i++) {
    markers.push(i / count);
  }
  return markers;
}

/** Find the nearest zero-crossing near a given normalized position */
function findNearestZeroCrossing(buffer: AudioBuffer, pos: number): number {
  const data = buffer.getChannelData(0);
  const sampleIdx = Math.floor(pos * data.length);
  
  // Search within +/- 500 samples
  const searchRange = 500;
  let minDiff = Infinity;
  let bestIdx = sampleIdx;
  
  for (let i = Math.max(1, sampleIdx - searchRange); i < Math.min(data.length - 1, sampleIdx + searchRange); i++) {
    // Zero crossing: sign change
    if ((data[i - 1] < 0 && data[i] >= 0) || (data[i - 1] >= 0 && data[i] < 0)) {
      const diff = Math.abs(i - sampleIdx);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }
  }
  
  return bestIdx / data.length;
}

const CHOP_MODES = ['Manual', 'Auto', 'Grid'] as const;
const GRID_PRESETS = [4, 8, 16, 32] as const;

// ─── Chopper FX Engine ─────────────────────────────────────────────────────

interface ChopFxParams {
  reverbMix: number;    // 0–100
  delayMix: number;     // 0–100
  chorusMix: number;    // 0–100
  distDrive: number;    // 0–100
  compThreshold: number; // 0–100 → -60…0 dB
  eqLow: number;        // -15…+15 dB
  eqMid: number;
  eqHigh: number;
  halftimeEnabled: boolean;
}

const DEFAULT_CHOP_FX: ChopFxParams = {
  reverbMix: 0, delayMix: 0, chorusMix: 0, distDrive: 0, compThreshold: 100,
  eqLow: 0, eqMid: 0, eqHigh: 0, halftimeEnabled: false,
};

function chopDistCurve(drive: number): Float32Array {
  const N = 256; const arr = new Float32Array(N);
  const k = drive * 200;
  for (let i = 0; i < N; i++) {
    const x = (i * 2) / N - 1;
    arr[i] = k === 0 ? x : ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return arr;
}

function chopImpulse(ctx: AudioContext, dur = 2.5): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  }
  return buf;
}

class ChopFxChain {
  readonly input: GainNode;
  private tabGain: GainNode; // muted when Chopper is not the active tab
  private rev: ConvolverNode;
  private revSend: GainNode;
  private dly: DelayNode;
  private dlyFB: GainNode;
  private dlyMix: GainNode;
  private chorus: DelayNode;
  private chorusLFO: OscillatorNode;
  private chorusMixG: GainNode;
  private dist: WaveShaperNode;
  private eqLow: BiquadFilterNode;
  private eqMid: BiquadFilterNode;
  private eqHigh: BiquadFilterNode;
  private comp: DynamicsCompressorNode;
  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -12; this.comp.ratio.value = 4;
    this.eqLow  = ctx.createBiquadFilter(); this.eqLow.type  = 'lowshelf';  this.eqLow.frequency.value  = 120;
    this.eqMid  = ctx.createBiquadFilter(); this.eqMid.type  = 'peaking';   this.eqMid.frequency.value  = 1000; this.eqMid.Q.value = 1;
    this.eqHigh = ctx.createBiquadFilter(); this.eqHigh.type = 'highshelf'; this.eqHigh.frequency.value = 8000;
    // tabGain sits between the EQ and masterBus so tab isolation cuts everything,
    // including reverb/delay tails, the moment the user switches away.
    this.tabGain = ctx.createGain(); this.tabGain.gain.value = 1;
    this.comp.connect(this.eqLow); this.eqLow.connect(this.eqMid); this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.tabGain); this.tabGain.connect(audioEngine.masterBus);

    this.rev = ctx.createConvolver(); this.rev.buffer = chopImpulse(ctx);
    this.revSend = ctx.createGain(); this.revSend.gain.value = 0;
    this.rev.connect(this.revSend); this.revSend.connect(this.comp);

    this.dly = ctx.createDelay(1); this.dly.delayTime.value = 0.375;
    this.dlyFB = ctx.createGain(); this.dlyFB.gain.value = 0.3;
    this.dlyMix = ctx.createGain(); this.dlyMix.gain.value = 0;
    this.dly.connect(this.dlyFB); this.dlyFB.connect(this.dly); this.dlyMix.connect(this.dly);
    this.dlyMix.connect(this.comp);

    this.chorus = ctx.createDelay(0.03); this.chorus.delayTime.value = 0.015;
    this.chorusLFO = ctx.createOscillator(); this.chorusLFO.frequency.value = 0.6;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.005;
    this.chorusLFO.connect(lfoG); lfoG.connect(this.chorus.delayTime as unknown as AudioParam);
    this.chorusLFO.start();
    this.chorusMixG = ctx.createGain(); this.chorusMixG.gain.value = 0;
    this.chorus.connect(this.chorusMixG); this.chorusMixG.connect(this.comp);

    this.dist = ctx.createWaveShaper(); this.dist.curve = chopDistCurve(0); this.dist.oversample = '4x';
    this.dist.connect(this.comp);

    this.input = ctx.createGain(); this.input.gain.value = 1;
    this.input.connect(this.dist);
    this.input.connect(this.rev);
    this.input.connect(this.dlyMix);
    this.input.connect(this.chorus);
  }

  setParams(p: ChopFxParams): void {
    const t = this.ctx.currentTime;
    this.revSend.gain.setTargetAtTime(p.reverbMix / 100 * 0.85, t, 0.05);
    this.dlyMix.gain.setTargetAtTime(p.delayMix / 100 * 0.55, t, 0.05);
    this.chorusMixG.gain.setTargetAtTime(p.chorusMix / 100, t, 0.05);
    this.dist.curve = chopDistCurve(p.distDrive / 100);
    this.comp.threshold.setTargetAtTime(-60 + (p.compThreshold / 100) * 60, t, 0.05);
    this.eqLow.gain.setTargetAtTime(p.eqLow, t, 0.05);
    this.eqMid.gain.setTargetAtTime(p.eqMid, t, 0.05);
    this.eqHigh.gain.setTargetAtTime(p.eqHigh, t, 0.05);
  }

  updateDelayTime(bpm: number): void {
    const t = this.ctx.currentTime;
    this.dly.delayTime.setTargetAtTime(Math.min(60 / bpm * 0.75, 0.99), t, 0.1);
  }

  setTabActive(active: boolean): void {
    // Fast ramp so reverb/delay tails are cut cleanly without a click
    this.tabGain.gain.setTargetAtTime(active ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  dispose(): void {
    try { this.chorusLFO.stop(); } catch {}
  }
}

export const SacredChopper: React.FC<SacredChopperProps> = ({
  trackIndex,
  trackName,
  trackColor,
  buffer,
  sampleParams,
  onUpdateParam,
  onClose,
  onSpreadToPads,
  onFileDropped,
  onClearSample,
  showMessage,
  bpm = 120,
  isActiveTab = true,
}) => {
  const bridgeState = useJuceBridge();
  const nativeTransientsRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const [draggingMarker, setDraggingMarker] = useState<number | null>(null);
  const [playingSlice, setPlayingSlice] = useState<number | null>(null);
  const playingSliceRef = useRef<number | null>(null); // kept in sync; avoids waveform effect restarts on each key press
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const previewStartTimeRef = useRef<number | null>(null);
  const chopFxRef = useRef<ChopFxChain | null>(null);
  const [chopFx, setChopFx] = useState<ChopFxParams>(DEFAULT_CHOP_FX);
  const chopFxStateRef = useRef<ChopFxParams>(DEFAULT_CHOP_FX);
  const [showChopFx, setShowChopFx] = useState(false);
  // ─── Per-chop FX ──────────────────────────────────────────────────────────
  // fxScope: -1 = ALL chops (the global chain); >=0 = a specific slice index.
  // Slices with their own entry in sliceFx route through their own FX chain;
  // slices without one fall back to the global chain.
  const [fxScope, setFxScope] = useState<number>(-1);
  const [sliceFx, setSliceFx] = useState<Record<number, ChopFxParams>>(() => {
    try {
      const raw = (sampleParams as any).chopperSliceFx;
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const sliceFxRef = useRef<Record<number, ChopFxParams>>({});
  const sliceFxChainsRef = useRef<Map<number, ChopFxChain>>(new Map());
  useEffect(() => { sliceFxRef.current = sliceFx; }, [sliceFx]);
  const [sliceReversed, setSliceReversed] = useState<boolean[]>([]);
  const [spreadState, setSpreadState] = useState<'idle' | 'spreading' | 'done'>('idle');
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const [viewWindow, setViewWindow] = useState<[number, number]>([0, 1]);
  // Persist the buffer locally so waveform survives if the parent prop goes null (tab switches)
  const [stableBuffer, setStableBuffer] = useState<AudioBuffer | null>(null);
  useEffect(() => { if (buffer) setStableBuffer(buffer); }, [buffer]);
  const displayBuffer = stableBuffer ?? buffer;

  // Register JUCE file-picker callback so "Open File" button works
  useEffect(() => {
    (window as any).__godRealmFileSelected = async (path: string) => {
      const id = `chopper_open_${Date.now()}`;
      try {
        (window as any).chrome?.webview?.postMessage(JSON.stringify({ type: 'LOAD_FILE_PATH', payload: { id, path } }));
      } catch {}
      const handler = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'FILE_DATA' && msg.payload?.id === id) {
            window.removeEventListener('message', handler);
            const raw = atob(msg.payload.base64);
            const ab = new ArrayBuffer(raw.length);
            const view = new Uint8Array(ab);
            for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
            nativeAudio.loadSampleBytes(5, ab.slice(0));
            const ctx = audioEngine.ctx;
            ctx.decodeAudioData(ab).then(decoded => {
              const trimmed = trimLeadingSilence(ctx, decoded);
              localBufferRef.current = trimmed;
              setStableBuffer(trimmed);
              // Reconstruct a minimal File-like object for the parent callback
              const name = path.split(/[\\/]/).pop() ?? 'sample.wav';
              const fakeFile = Object.assign(new File([], name), { path });
              if (onFileDropped) onFileDropped(fakeFile as any, trimmed);
              const filePath = path;
              onUpdateParam('samplePath', filePath);
              try { localStorage.setItem('chopper_autosave_path', filePath); } catch {}
              try {
                (window as any).chrome?.webview?.postMessage(JSON.stringify({
                  type: 'LOAD_SAMPLE',
                  payload: { trackIdx: 0, filePath: path },
                }));
              } catch {}
            }).catch(console.error);
          }
        } catch {}
      };
      window.addEventListener('message', handler);
    };
    return () => { delete (window as any).__godRealmFileSelected; };
  }, [onFileDropped, onUpdateParam]);

  // On mount: restore the last file from path if the registry buffer is missing
  useEffect(() => {
    if (buffer) return; // parent already provided the buffer, no need to restore
    const savedPath = localStorage.getItem('chopper_autosave_path');
    if (!savedPath) return;
    // Try to reload via JUCE (WebView2 env)
    const id = `chopper_restore_${Date.now()}`;
    try {
      (window as any).chrome?.webview?.postMessage(JSON.stringify({ type: 'LOAD_FILE_PATH', payload: { id, path: savedPath } }));
    } catch {}
    // Listen for the decoded audio from JUCE
    const handler = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'FILE_DATA' && msg.payload?.id === id) {
          window.removeEventListener('message', handler);
          const raw = atob(msg.payload.base64);
          const ab = new ArrayBuffer(raw.length);
          const view = new Uint8Array(ab);
          for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
          nativeAudio.loadSampleBytes(5, ab.slice(0));
          const ctx = audioEngine.ctx;
          ctx.decodeAudioData(ab).then(decoded => {
            const trimmed = trimLeadingSilence(ctx, decoded);
            localBufferRef.current = trimmed;
            setStableBuffer(trimmed);
            if (onFileDropped) {
              const fakeFile = new File([], savedPath.split(/[\\/]/).pop() || 'sample') as any;
              fakeFile.path = savedPath;
              onFileDropped(fakeFile, trimmed);
            }
          }).catch(() => {});
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    const cleanup = setTimeout(() => { window.removeEventListener('message', handler); }, 6000);
    return () => { clearTimeout(cleanup); window.removeEventListener('message', handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chop Sessions (own storage, not Preset Vault)
  const [sessions, setSessions] = useState<ChopSession[]>(() => chopSessionService.getAll());
  const [showSessions, setShowSessions] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  useEffect(() => chopSessionService.onChange(() => setSessions(chopSessionService.getAll())), []);

  // Piano keyboard state (C4=slice 0)
  const [kbdPressedKeys, setKbdPressedKeys] = useState<Set<number>>(new Set());

  // ─── Drag-and-Drop State ───
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const dragCounterRef = useRef(0); // tracks nested enter/leave events
  /** Buffer decoded in our own previewCtx — guaranteed same-context for playback */
  const localBufferRef = useRef<AudioBuffer | null>(null);

  const [dimensions, setDimensions] = useState({ width: 1000, height: 280 });
  const [minimapDimensions, setMinimapDimensions] = useState({ width: 800, height: 32 });

  // ResizeObserver for main waveform canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: Math.floor(entry.contentRect.width) || 1000,
          height: Math.floor(entry.contentRect.height) || 280,
        });
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // ResizeObserver for minimap canvas
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setMinimapDimensions({
          width: Math.floor(entry.contentRect.width) || 800,
          height: Math.floor(entry.contentRect.height) || 32,
        });
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // ─── Drag-and-Drop Handlers ───
  const ACCEPTED_AUDIO = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/aiff', 'audio/x-aiff',
    'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/flac', 'audio/x-flac', 'audio/x-sf2'];

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    setDropError(null);

    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(f =>
      ACCEPTED_AUDIO.includes(f.type) ||
      /\.(wav|aif|aiff|mp3|ogg|flac|m4a|sf2)$/i.test(f.name)
    );

    if (!audioFile) {
      setDropError('Not a supported audio file (WAV, AIFF, MP3, OGG, FLAC)');
      setTimeout(() => setDropError(null), 3000);
      return;
    }

    setIsDecoding(true);
    try {
      previewCtxRef.current = audioEngine.ctx;
      const ctx = previewCtxRef.current;
      audioEngine.resume();

      const arrayBuffer = await audioFile.arrayBuffer();
      nativeAudio.loadSampleBytes(5, arrayBuffer.slice(0));
      const decoded = await ctx.decodeAudioData(arrayBuffer);

      // ── Auto-trim leading silence / noise ───────────────────────────────
      const trimmed = trimLeadingSilence(ctx, decoded);

      // Store in localBufferRef so previewSlice always uses the same AudioContext
      localBufferRef.current = trimmed;
      setStableBuffer(trimmed);

      // ── Auto-stretch: compute playback rate to match DAW BPM ────────────
      // Store the ratio in a parameter so JUCE can also apply it
      // Default to 1.0x speed (no auto-stretch). User can adjust manually.
      onUpdateParam('chopperSpeed', 1.0);

      // Notify parent (replaces the buffer prop so waveform renders)
      if (onFileDropped) {
        onFileDropped(audioFile, trimmed);
      }

      // Update the sample path param for JUCE bridge
      const filePath: string = (audioFile as any).path ?? audioFile.name;
      onUpdateParam('samplePath', filePath);
      // Auto-save path so we can restore the file after plugin restart
      try { localStorage.setItem('chopper_autosave_path', filePath); } catch {}
      onUpdateParam('chopMode', 'Manual');

      // Load sample into JUCE native sampler (track 0) for DAW recording playback sync.
      // WebView2 on Windows exposes file.path for files dragged from Explorer.
      if ((audioFile as any).path) {
        try {
          (window as any).chrome?.webview?.postMessage(JSON.stringify({
            type: 'LOAD_SAMPLE',
            payload: { trackIdx: 0, filePath: (audioFile as any).path },
          }));
        } catch { /* ignore if webview not ready */ }
      }
    } catch (err) {
      console.error('[SacredChopper] Failed to decode dropped file:', err);
      setDropError('Could not decode audio file');
      setTimeout(() => setDropError(null), 4000);
    } finally {
      setIsDecoding(false);
    }
  }, [onFileDropped, onUpdateParam, bpm]);

  // Extract current params
  const chopMarkers = useMemo(() =>
    (sampleParams.slices || []).map(s => s.start).filter(v => v > 0 && v < 1),
    [sampleParams.slices]
  );

  // ─── Slice Segments — must be declared early so all callbacks below can use it ───
  const sliceSegments = useMemo(() => {
    const sorted = [0, ...chopMarkers.slice().sort((a, b) => a - b), 1];
    const segs = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      segs.push({ start: sorted[i], end: sorted[i + 1], width: sorted[i + 1] - sorted[i] });
    }
    return segs;
  }, [chopMarkers]);

  const chopMode = sampleParams.chopMode || 'Manual';
  const isReverse = sampleParams.reverse;

  const { width, height } = dimensions;

  // ─── Waveform Rendering ───
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let peaks: Float32Array;

    if (displayBuffer) {
      const data = displayBuffer.getChannelData(0);
      const startIndex = Math.floor(viewWindow[0] * data.length);
      const endIndex = Math.floor(viewWindow[1] * data.length);
      const windowLen = endIndex - startIndex;
      const step = Math.max(1, windowLen / width);
      peaks = new Float32Array(width);
      for (let i = 0; i < width; i++) {
        let peak = 0;
        const count = Math.max(1, Math.floor(step));
        const offset = startIndex + Math.floor(i * step);
        for (let j = 0; j < count; j++) {
          if (offset + j < data.length) {
            peak = Math.max(peak, Math.abs(data[offset + j] || 0));
          }
        }
        peaks[i] = peak;
      }
    } else {
      const nativeAnalysis = bridgeState.waveformAnalysis;
      if (nativeAnalysis && nativeAnalysis.padIndex === trackIndex && nativeAnalysis.rmsEnvelope && nativeAnalysis.rmsEnvelope.length > 0) {
        const env = nativeAnalysis.rmsEnvelope;
        const startIndex = Math.floor(viewWindow[0] * env.length);
        const endIndex = Math.floor(viewWindow[1] * env.length);
        const windowLen = endIndex - startIndex;
        const step = Math.max(1, windowLen / width);
        peaks = new Float32Array(width);
        for (let i = 0; i < width; i++) {
          let peak = 0;
          const count = Math.max(1, Math.floor(step));
          const offset = startIndex + Math.floor(i * step);
          for (let j = 0; j < count; j++) {
            if (offset + j < env.length) {
              peak = Math.max(peak, env[offset + j]);
            }
          }
          peaks[i] = peak;
        }
      } else {
        // Static ambient — no animation loop
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 0.25;
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#a88cff';
        ctx.textAlign = 'center';
        ctx.fillText('DROP OR LOAD A SAMPLE', width / 2, height / 2);
        ctx.globalAlpha = 1;
        return;
      }
    }

    // Single animated frame — steady render, no skipping
    let frame = 0;
    const renderWaveform = () => {
      frame++;

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, width, height);

      const drawPath = (color: string, blur: number, isMirror: boolean, jitter: number, alpha: number, lineWidthVal: number) => {
        const points: Array<{ x: number; y: number }> = [];
        const stepSize = 2; // draw every 2 logical pixels
        for (let i = 0; i < width; i += stepSize) {
          const p = peaks[i] || 0;
          const j = (Math.random() - 0.5) * p * jitter;
          const yOff = p * (height / 2 * 0.8) + j;
          points.push({
            x: i,
            y: isMirror ? (height / 2) + yOff : (height / 2) - yOff,
          });
        }
        
        // Final point
        const lastP = peaks[width - 1] || 0;
        const lastJ = (Math.random() - 0.5) * lastP * jitter;
        const lastYOff = lastP * (height / 2 * 0.8) + lastJ;
        points.push({
          x: width,
          y: isMirror ? (height / 2) + lastYOff : (height / 2) - lastYOff,
        });

        if (points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lineWidthVal;
        ctx.shadowBlur = blur;
        ctx.shadowColor = color;
        ctx.globalCompositeOperation = 'screen';
        ctx.stroke();
      };

      drawPath('#a855f7', 14, false, 1.0, 0.65, 1.5);
      drawPath('#a855f7', 14, true, 1.0, 0.65, 1.5);
      drawPath('#d946ef', 8, false, 2.5, 0.80, 1.2);
      drawPath('#d946ef', 8, true, 2.5, 0.80, 1.2);
      drawPath('#ff6600', 4, false, 5.0, 0.90, 0.8);
      drawPath('#ff6600', 4, true, 5.0, 0.90, 0.8);

      // Reset composite
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Draw slice region shading
      const sortedMarkers = [...chopMarkers].sort((a, b) => a - b);
      const allPositions = [0, ...sortedMarkers, 1];
      for (let i = 0; i < allPositions.length - 1; i++) {
        const x1 = allPositions[i] * width;
        const x2 = allPositions[i + 1] * width;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(168, 85, 247, 0.03)' : 'rgba(255, 102, 0, 0.03)';
        ctx.fillRect(x1, 0, x2 - x1, height);
      }

      // Draw real-time preview playhead
      if (playingSliceRef.current !== null && displayBuffer && previewCtxRef.current && previewStartTimeRef.current !== null) {
        const ctxAudio = previewCtxRef.current;
        const elapsed = (ctxAudio.currentTime - previewStartTimeRef.current) * sampleParams.chopperSpeed;
        const sorted = [0, ...[...chopMarkers].sort((a, b) => a - b), 1];
        const start = sorted[playingSliceRef.current] ?? 0;
        const end = sorted[playingSliceRef.current + 1] ?? 1;
        const sliceDuration = (end - start) * displayBuffer.duration;
        
        if (elapsed <= sliceDuration) {
          const currentPos = start + (elapsed / displayBuffer.duration);
          const playheadX = ((currentPos - viewWindow[0]) / (viewWindow[1] - viewWindow[0])) * width;
          
          if (playheadX >= 0 && playheadX <= width) {
            ctx.save();
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, height);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();
    return () => cancelAnimationFrame(animFrameRef.current);
  // NOTE: playingSlice intentionally excluded — use playingSliceRef.current inside RAF to avoid restarting the animation loop on every key press
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayBuffer, chopMarkers, viewWindow, bridgeState.waveformAnalysis, trackIndex, width, height, sampleParams.chopperSpeed]);

  // ─── Minimap Rendering ───
  const { width: miniW, height: miniH } = minimapDimensions;

  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = miniW * dpr;
    canvas.height = miniH * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, miniW, miniH);
    
    if (displayBuffer) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
      const data = displayBuffer.getChannelData(0);
      const step = Math.floor(data.length / miniW);
      
      ctx.beginPath();
      ctx.moveTo(0, miniH / 2);
      for (let i = 0; i < miniW; i++) {
        let peak = 0;
        for (let j = 0; j < step; j++) {
          peak = Math.max(peak, Math.abs(data[i * step + j] || 0));
        }
        const yOff = peak * (miniH / 2);
        ctx.lineTo(i, miniH / 2 - yOff);
      }
      for (let i = Math.floor(miniW) - 1; i >= 0; i--) {
        let peak = 0;
        for (let j = 0; j < step; j++) {
          peak = Math.max(peak, Math.abs(data[i * step + j] || 0));
        }
        const yOff = peak * (miniH / 2);
        ctx.lineTo(i, miniH / 2 + yOff);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      const nativeAnalysis = bridgeState.waveformAnalysis;
      if (nativeAnalysis && nativeAnalysis.padIndex === trackIndex && nativeAnalysis.rmsEnvelope && nativeAnalysis.rmsEnvelope.length > 0) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
        const env = nativeAnalysis.rmsEnvelope;
        const step = Math.max(1, env.length / miniW);
        
        ctx.beginPath();
        ctx.moveTo(0, miniH / 2);
        for (let i = 0; i < miniW; i++) {
          let peak = 0;
          const offset = Math.floor(i * step);
          for (let j = 0; j < step; j++) {
            if (offset + j < env.length) {
              peak = Math.max(peak, env[offset + j]);
            }
          }
          const yOff = peak * (miniH / 2);
          ctx.lineTo(i, miniH / 2 - yOff);
        }
        for (let i = Math.floor(miniW) - 1; i >= 0; i--) {
          let peak = 0;
          const offset = Math.floor(i * step);
          for (let j = 0; j < step; j++) {
            if (offset + j < env.length) {
              peak = Math.max(peak, env[offset + j]);
            }
          }
          const yOff = peak * (miniH / 2);
          ctx.lineTo(i, miniH / 2 + yOff);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }, [displayBuffer, bridgeState.waveformAnalysis, trackIndex, miniW, miniH]);

  // ─── Interaction & Zooming ───
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!buffer) return;
    const zoomFactor = Math.exp(e.deltaY * 0.003);
    const rect = waveformRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Zoom around mouse cursor
    const mouseX = (e.clientX - rect.left) / rect.width;
    const centerPos = viewWindow[0] + mouseX * (viewWindow[1] - viewWindow[0]);
    
    let newLen = (viewWindow[1] - viewWindow[0]) * zoomFactor;
    newLen = Math.max(0.01, Math.min(1, newLen));
    
    let newStart = centerPos - (mouseX * newLen);
    let newEnd = centerPos + ((1 - mouseX) * newLen);
    
    if (newStart < 0) { newEnd -= newStart; newStart = 0; }
    if (newEnd > 1) { newStart -= (newEnd - 1); newEnd = 1; }
    
    setViewWindow([Math.max(0, newStart), Math.min(1, newEnd)]);
  }, [viewWindow, buffer]);

  const handleMinimapDrag = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    const rect = minimapCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const len = viewWindow[1] - viewWindow[0];
    let center = (e.clientX - rect.left) / rect.width;
    let newStart = center - len / 2;
    let newEnd = center + len / 2;
    if (newStart < 0) { newStart = 0; newEnd = len; }
    if (newEnd > 1) { newEnd = 1; newStart = 1 - len; }
    setViewWindow([newStart, newEnd]);
  }, [viewWindow]);

  // ─── Slice Helpers ───
  const updateSlicesFromMarkers = useCallback((markers: number[]) => {
    const sorted = [...markers].sort((a, b) => a - b);
    const allPos = [0, ...sorted, 1];
    const slices = [];
    for (let i = 0; i < allPos.length - 1; i++) {
      slices.push({ start: allPos[i], end: allPos[i + 1] });
    }
    onUpdateParam('slices', slices);
    onUpdateParam('chopMarkers', sorted);
  }, [onUpdateParam]);

  // Listen to native waveform analysis and store transients
  useEffect(() => {
    if (bridgeState.waveformAnalysis && bridgeState.waveformAnalysis.padIndex === trackIndex) {
      const trans = bridgeState.waveformAnalysis.transients;
      if (trans && trans.length > 0) {
        nativeTransientsRef.current = trans;
        if (chopMode === 'Auto') {
          updateSlicesFromMarkers(trans);
        }
      }
    }
  }, [bridgeState.waveformAnalysis, trackIndex, chopMode, updateSlicesFromMarkers]);

  // ─── Marker Dragging ───
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingMarker === null || !waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const relPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    let pos = viewWindow[0] + relPos * (viewWindow[1] - viewWindow[0]);

    // Calculate a 10-pixel snap threshold in normalized units
    const snapThreshold = 10 / rect.width * (viewWindow[1] - viewWindow[0]);

    // Snap to transient if enabled
    if (sampleParams.snapToTransient && displayBuffer) {
      const transients = detectTransients(displayBuffer, sampleParams.chopperSensitivity);
      let nearest = pos;
      let minDiff = Infinity;
      for (const t of transients) {
        const d = Math.abs(pos - t);
        if (d < minDiff) { minDiff = d; nearest = t; }
      }
      if (minDiff < snapThreshold) pos = nearest;
    }
    
    // Snap to zero crossing if enabled
    if (sampleParams.snapToZero && displayBuffer) {
      pos = findNearestZeroCrossing(displayBuffer, pos);
    }

    const nextMarkers = [...chopMarkers];
    nextMarkers[draggingMarker] = pos;
    updateSlicesFromMarkers(nextMarkers);
  }, [draggingMarker, chopMarkers, sampleParams.snapToTransient, sampleParams.snapToZero, sampleParams.chopperSensitivity, displayBuffer, viewWindow, updateSlicesFromMarkers]);

  const handleMouseUp = useCallback(() => {
    setDraggingMarker(null);
  }, []);

  const handleMarkerDoubleClick = useCallback((index: number) => {
    if (!displayBuffer) return;
    const currentMs = chopMarkers[index] * displayBuffer.duration * 1000;
    const newMsStr = window.prompt(`Enter exact offset for Slice Marker ${index + 1} (ms):`, currentMs.toFixed(2));
    if (!newMsStr) return;
    const newMs = parseFloat(newMsStr);
    if (isNaN(newMs)) return;
    
    // Convert back to normalized 0-1 range
    let newPos = (newMs / 1000) / displayBuffer.duration;
    
    // Optional: still snap to zero crossing if enabled
    if (sampleParams.snapToZero) {
      newPos = findNearestZeroCrossing(displayBuffer, newPos);
    }
    
    // Clamp to valid range so we don't pass the adjacent markers
    const sorted = [...chopMarkers].sort((a, b) => a - b);
    const sortedIdx = sorted.indexOf(chopMarkers[index]);
    
    const prevPos = sortedIdx > 0 ? sorted[sortedIdx - 1] : 0;
    const nextPos = sortedIdx < sorted.length - 1 ? sorted[sortedIdx + 1] : 1;
    
    const clampedPos = Math.max(prevPos + 0.0001, Math.min(newPos, nextPos - 0.0001));
    
    const nextMarkers = [...chopMarkers];
    nextMarkers[index] = clampedPos;
    updateSlicesFromMarkers(nextMarkers);
  }, [displayBuffer, chopMarkers, sampleParams.snapToZero, updateSlicesFromMarkers]);

  const addMarker = useCallback(() => {
    if (chopMarkers.length >= 31) return;
    // Find the largest gap and split it
    const sorted = [0, ...chopMarkers.sort((a, b) => a - b), 1];
    let maxGap = 0, maxIdx = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1] - sorted[i];
      if (gap > maxGap) { maxGap = gap; maxIdx = i; }
    }
    const newPos = (sorted[maxIdx] + sorted[maxIdx + 1]) / 2;
    updateSlicesFromMarkers([...chopMarkers, newPos]);
  }, [chopMarkers, updateSlicesFromMarkers]);

  const removeLastMarker = useCallback(() => {
    if (chopMarkers.length === 0) return;
    const next = [...chopMarkers];
    next.pop();
    updateSlicesFromMarkers(next);
  }, [chopMarkers, updateSlicesFromMarkers]);

  // ─── Grid / Auto Chop ───
  const applyGridChop = useCallback((sliceCount: number) => {
    const markers = generateGridMarkers(sliceCount);
    onUpdateParam('chopMode', 'Grid');
    updateSlicesFromMarkers(markers);
  }, [onUpdateParam, updateSlicesFromMarkers]);

  const applyAutoChop = useCallback(() => {
    onUpdateParam('chopMode', 'Auto');
    if (nativeTransientsRef.current && nativeTransientsRef.current.length > 0) {
      updateSlicesFromMarkers(nativeTransientsRef.current);
      return;
    }

    if (!displayBuffer) return;
    setSpreadState('spreading');
    
    const worker = new Worker(new URL('../workers/chopper.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      updateSlicesFromMarkers(e.data.markers);
      setSpreadState('idle');
      worker.terminate();
    };
    
    worker.postMessage({
      channelData: displayBuffer.getChannelData(0),
      sampleRate: displayBuffer.sampleRate,
      duration: displayBuffer.duration,
      sensitivity: sampleParams.chopperSensitivity,
      minSpacing: 0.1
    });
  }, [displayBuffer, sampleParams.chopperSensitivity, onUpdateParam, updateSlicesFromMarkers]);

  // ─── Slice Preview Playback ───
  const updateChopFx = useCallback((patch: Partial<ChopFxParams>) => {
    if (fxScope < 0) {
      // Global (ALL chops)
      setChopFx(prev => {
        const next = { ...prev, ...patch };
        chopFxStateRef.current = next;
        chopFxRef.current?.setParams(next);
        return next;
      });
    } else {
      // Per-slice override
      setSliceFx(prev => {
        const base = prev[fxScope] ?? { ...chopFxStateRef.current };
        const nextFx = { ...base, ...patch };
        const next = { ...prev, [fxScope]: nextFx };
        sliceFxRef.current = next;
        sliceFxChainsRef.current.get(fxScope)?.setParams(nextFx);
        onUpdateParam('chopperSliceFx', JSON.stringify(next));
        return next;
      });
    }
  }, [fxScope, onUpdateParam]);

  // The FX values currently shown/edited (global or the selected slice's).
  const activeFx: ChopFxParams = fxScope < 0 ? chopFx : (sliceFx[fxScope] ?? chopFx);

  // Keep delay time in sync with DAW BPM (global + all per-slice chains)
  useEffect(() => {
    if (bpm && bpm > 0) {
      chopFxRef.current?.updateDelayTime(bpm);
      sliceFxChainsRef.current.forEach(chain => chain.updateDelayTime(bpm));
    }
  }, [bpm]);

  // Resolve which FX chain a slice should play through. Slices with their own
  // FX override get a dedicated lazily-created chain; the rest share the global.
  const resolveSliceChain = useCallback((ctx: AudioContext, sliceIndex: number): ChopFxChain => {
    const override = sliceFxRef.current[sliceIndex];
    if (override) {
      let chain = sliceFxChainsRef.current.get(sliceIndex);
      if (!chain) {
        chain = new ChopFxChain(ctx);
        sliceFxChainsRef.current.set(sliceIndex, chain);
        if (bpm && bpm > 0) chain.updateDelayTime(bpm);
      }
      chain.setParams(override);
      return chain;
    }
    if (!chopFxRef.current) {
      chopFxRef.current = new ChopFxChain(ctx);
      chopFxRef.current.setParams(chopFxStateRef.current);
    }
    return chopFxRef.current;
  }, [bpm]);

  const previewSlice = useCallback((sliceIndex: number) => {
    // No chop markers yet: let C4 (slice 0) play the WHOLE loaded sample so the
    // Chopper is audible immediately; other keys wait until chops are made.
    if (chopMarkers.length === 0 && sliceIndex > 0) return;

    // Use our own-context buffer; if null try to copy channel data from prop buffer
    let safeBuffer = localBufferRef.current;
    if (!safeBuffer && buffer) {
      // Buffer might be decoded in a different AudioContext (e.g. godEngine).
      // Copy channel data into our own context so playback works.
      previewCtxRef.current = audioEngine.ctx;
      const ctx = previewCtxRef.current;
      {
        const nb = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          nb.copyToChannel(buffer.getChannelData(ch), ch);
        }
        localBufferRef.current = nb;
        safeBuffer = nb;
      }
    }
    if (!safeBuffer) return;

    previewCtxRef.current = audioEngine.ctx;
    const ctx = previewCtxRef.current;
    audioEngine.resume();

    // Stop previous
    if (previewSourceRef.current) {
      try { previewSourceRef.current.stop(); } catch {}
      previewSourceRef.current = null;
    }

    const sorted = [0, ...[...chopMarkers].sort((a, b) => a - b), 1];
    const start = sorted[sliceIndex] ?? 0;
    const end = sorted[sliceIndex + 1] ?? 1;
    const offset = start * safeBuffer.duration;
    const duration = (end - start) * safeBuffer.duration;

    // Per-slice reverse: copy the slice samples in reverse into a short buffer
    let playBuffer: AudioBuffer = safeBuffer;
    let playOffset = offset;
    let playDuration: number | undefined = duration;
    if (sliceReversed[sliceIndex]) {
      const startSample = Math.floor(start * safeBuffer.length);
      const endSample   = Math.min(Math.floor(end * safeBuffer.length), safeBuffer.length);
      const len = Math.max(1, endSample - startSample);
      const revBuf = ctx.createBuffer(safeBuffer.numberOfChannels, len, safeBuffer.sampleRate);
      for (let ch = 0; ch < safeBuffer.numberOfChannels; ch++) {
        const src = safeBuffer.getChannelData(ch);
        const dst = revBuf.getChannelData(ch);
        for (let i = 0; i < len; i++) dst[i] = src[endSample - 1 - i];
      }
      playBuffer = revBuf;
      playOffset = 0;
      playDuration = undefined; // buffer is exact slice length
    }

    // Resolve the FX chain: a slice with its own FX override routes through its
    // own chain; otherwise it uses the global chain.
    const fxChain = resolveSliceChain(ctx, sliceIndex);

    const source = ctx.createBufferSource();
    source.buffer = playBuffer;
    source.playbackRate.value = sampleParams.chopperSpeed;
    source.connect(fxChain.input);
    source.start(0, playOffset, playDuration);
    previewSourceRef.current = source;
    playingSliceRef.current = sliceIndex;
    setPlayingSlice(sliceIndex);
    previewStartTimeRef.current = ctx.currentTime;

    source.onended = () => {
      playingSliceRef.current = null;
      setPlayingSlice(null);
      previewSourceRef.current = null;
      previewStartTimeRef.current = null;
    };
  }, [buffer, chopMarkers, sampleParams.chopperSpeed, sliceReversed, resolveSliceChain]);

  // Cleanup preview on unmount
  useEffect(() => {
    return () => {
      if (previewSourceRef.current) {
        try { previewSourceRef.current.stop(); } catch {}
      }
    };
  }, []);

  // ─── MIDI → Slice keyboard mapping ───
  // C4 (MIDI 60) = Slice 1, C#4 = Slice 2, D4 = Slice 3 … chromatic upward
  const previewSliceRef = useRef(previewSlice);
  useEffect(() => { previewSliceRef.current = previewSlice; }, [previewSlice]);
  const sliceSegmentsRef = useRef<{ start: number; end: number; width: number }[]>([]);

  // Strict tab isolation: mute FX chain + stop preview when leaving Chopper.
  useEffect(() => {
    // Mute/unmute the entire FX output so reverb/delay tails don't bleed into
    // other tabs. chopFxRef is the main chain; sliceFxChainsRef holds per-slice chains.
    chopFxRef.current?.setTabActive(!!isActiveTab);
    sliceFxChainsRef.current.forEach(c => c.setTabActive(!!isActiveTab));
    if (!isActiveTab) {
      try { previewSourceRef.current?.stop(); } catch {}
      previewSourceRef.current = null;
    }
  }, [isActiveTab]);

  useEffect(() => {
    if (!isActiveTab) return; // no listener when not on this tab
    const BASE_NOTE = 60; // C4 — matches on-screen keyboard and JUCE sampler mapping
    const unsub = neuralInputBus.addListener(ev => {
      if (ev.type === 'midi_note_on' && ev.note !== undefined) {
        const sliceIdx = ev.note - BASE_NOTE;
        const segs = sliceSegmentsRef.current;
        // Trigger any existing slice; if no chops are made yet, C4 (slice 0)
        // still plays the whole sample (previewSlice handles that case).
        if (sliceIdx >= 0 && sliceIdx < Math.max(1, segs.length)) {
          previewSliceRef.current(sliceIdx);
        }
      } else if (ev.type === 'midi_note_off' && ev.note !== undefined) {
        const sliceIdx = ev.note - BASE_NOTE;
        if (sliceIdx >= 0 && playingSlice === sliceIdx) {
          try { previewSourceRef.current?.stop(); } catch {}
        }
      }
    });
    return unsub;
  }, [isActiveTab]); // only re-subscribe on tab active change

  // ─── Save Chop Session (dedicated session store, NOT preset vault) ─────────
  const handleSaveChops = useCallback(() => {
    const hasBuffer = localBufferRef.current || buffer;
    if (!hasBuffer) { showMessage?.('No sample loaded — drop a file first'); return; }
    const safeName = (trackName.replace(/[^\w\s-]/g, '').trim() || 'My Chops');
    setSessionName(`${safeName} — ${chopMarkers.length + 1} slices`);
    setShowSaveModal(true);
  }, [trackName, chopMarkers, buffer, showMessage]);

  const commitSaveSession = useCallback((name: string) => {
    if (!name.trim()) return;
    const session = chopSessionService.save({
      name: name.trim(),
      sampleName: trackName,
      chopMarkers: [...chopMarkers],
      slices: sliceSegmentsRef.current.map(s => ({ start: s.start, end: s.end })),
      params: {
        chopMode: sampleParams.chopMode,
        snapToTransient: sampleParams.snapToTransient,
        snapToZero: sampleParams.snapToZero,
        chopperSpeed: sampleParams.chopperSpeed,
        chopperPitch: sampleParams.chopperPitch,
        chopperFadeIn: sampleParams.chopperFadeIn,
        chopperFadeOut: sampleParams.chopperFadeOut,
        chopperGlide: sampleParams.chopperGlide,
        chopperSensitivity: sampleParams.chopperSensitivity,
        chopperTrigger: sampleParams.chopperTrigger,
        chopperDryWet: sampleParams.chopperDryWet,
        chopperOutputVolume: sampleParams.chopperOutputVolume,
      },
    });
    // Also save into the unified Preset Vault under the "Chopper" category so it
    // shows up alongside other presets and is backed up to disk (presetVaultFS).
    presetService.saveAs({
      name: name.trim(),
      type: 'Chopper',
      tags: ['chopper', 'chop-session'],
      state: {
        params: {
          sampleName: trackName,
          chopMarkers: [...chopMarkers],
          slices: sliceSegmentsRef.current.map(s => ({ start: s.start, end: s.end })),
          chopMode: sampleParams.chopMode,
          snapToTransient: sampleParams.snapToTransient,
          snapToZero: sampleParams.snapToZero,
          chopperSpeed: sampleParams.chopperSpeed,
          chopperPitch: sampleParams.chopperPitch,
          chopperFadeIn: sampleParams.chopperFadeIn,
          chopperFadeOut: sampleParams.chopperFadeOut,
          chopperGlide: sampleParams.chopperGlide,
          chopperSensitivity: sampleParams.chopperSensitivity,
          chopperTrigger: sampleParams.chopperTrigger,
          chopperDryWet: sampleParams.chopperDryWet,
          chopperOutputVolume: sampleParams.chopperOutputVolume,
        },
      },
    });
    showMessage?.(`SAVED TO VAULT (Chopper): "${session.name}"`);
    setShowSaveModal(false);
  }, [trackName, chopMarkers, sampleParams, showMessage]);

  // ─── Load Chop Session ────────────────────────────────────────────────────
  const handleLoadSession = useCallback((session: ChopSession) => {
    onUpdateParam('chopMarkers', session.chopMarkers);
    onUpdateParam('chopMode', session.params.chopMode);
    onUpdateParam('chopperSpeed', session.params.chopperSpeed);
    onUpdateParam('chopperPitch', session.params.chopperPitch);
    onUpdateParam('chopperFadeIn', session.params.chopperFadeIn);
    onUpdateParam('chopperFadeOut', session.params.chopperFadeOut);
    onUpdateParam('chopperDryWet', session.params.chopperDryWet);
    onUpdateParam('chopperOutputVolume', session.params.chopperOutputVolume);
    setShowSessions(false);
    showMessage?.(`SESSION LOADED: "${session.name}"`);
  }, [onUpdateParam, showMessage]);

  // ─── Sample Info ───
  const sampleInfo = useMemo(() => {
    if (!displayBuffer) return null;
    return {
      duration: displayBuffer.duration.toFixed(2) + 's',
      channels: displayBuffer.numberOfChannels + 'ch',
      rate: (displayBuffer.sampleRate / 1000).toFixed(1) + 'kHz',
    };
  }, [displayBuffer]);

  // Keep sliceSegmentsRef in sync for use inside event callbacks
  useEffect(() => { sliceSegmentsRef.current = sliceSegments; }, [sliceSegments]);

  // ─── Knob Helper ───
  const renderKnob = (label: string, paramKey: string, value: number, min: number, max: number, unit: string, color: string, displayOverride?: string) => {
    const pct = (value - min) / (max - min);
    const rotation = -135 + pct * 270;
    return (
      <div className="sacred-chopper__knob">
        <div className="sacred-chopper__knob-ring">
          <div
            className="sacred-chopper__knob-arc"
            style={{ background: `conic-gradient(from 225deg, ${color} ${pct * 270}deg, transparent 0)` }}
          />
          <div
            className="sacred-chopper__knob-pointer"
            style={{ backgroundColor: color, transform: `rotate(${rotation}deg)`, boxShadow: `0 0 5px ${color}` }}
          />
          <input
            type="range"
            className="sacred-chopper__knob-input"
            min={min} max={max} step={max - min > 10 ? 1 : 0.01}
            value={value}
            onChange={e => onUpdateParam(paramKey, +e.target.value)}
            style={{ writingMode: 'vertical-lr' } as any}
          />
        </div>
        <span className="sacred-chopper__knob-label">{label}</span>
        <span className="sacred-chopper__knob-value">{displayOverride ?? value}{unit}</span>
      </div>
    );
  };

  return (
    <div
      className={`sacred-chopper${isDragOver ? ' sacred-chopper--drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ─── Drop Overlay ─── */}
      {isDragOver && (
        <div className="sacred-chopper__drop-overlay">
          <div className="sacred-chopper__drop-target">
            <div className="sacred-chopper__drop-icon">⬇</div>
            <div className="sacred-chopper__drop-label">Drop Audio File</div>
            <div className="sacred-chopper__drop-sub">WAV · AIFF · MP3 · OGG · FLAC · SF2</div>
          </div>
        </div>
      )}

      {/* ─── Save Session Modal ─── */}
      {showSaveModal && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#0c0c1a', border: '1px solid rgba(168,85,247,0.5)', borderRadius: 12,
            padding: '24px 28px', width: 340,
          }}>
            <p style={{ margin: '0 0 12px', fontWeight: 800, fontSize: 13, color: '#c084fc', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              💾 Save to Preset Vault — Chopper
            </p>
            <input
              type="text"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitSaveSession(sessionName); if (e.key === 'Escape') setShowSaveModal(false); }}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6,
                border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(0,0,0,0.5)', color: '#fff',
                fontSize: 12, outline: 'none',
              }}
            />
            <p style={{ margin: '6px 0 14px', fontSize: 9, color: 'rgba(255, 255, 255, 0.52)' }}>
              {chopMarkers.length + 1} slices · {trackName}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => commitSaveSession(sessionName)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer', fontWeight: 800,
                  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                  border: '1px solid rgba(168,85,247,0.5)', background: 'rgba(168,85,247,0.2)', color: '#c084fc',
                }}
              >SAVE</button>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{
                  padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 700,
                  fontSize: 11, border: '1px solid rgba(255, 255, 255, 0.32)', background: 'transparent', color: 'rgba(255,255,255,0.4)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Decode / Error Toast ─── */}
      {isDecoding && (
        <div className="sacred-chopper__toast sacred-chopper__toast--loading">
          Decoding audio…
        </div>
      )}
      {dropError && (
        <div className="sacred-chopper__toast sacred-chopper__toast--error">
          {dropError}
        </div>
      )}

      {/* Header */}
      <div className="sacred-chopper__header">
        <span className="sacred-chopper__title">Sample Chopper — {trackName}</span>
        <button
          onClick={() => {
            try {
              (window as any).chrome?.webview?.postMessage(JSON.stringify({ type: 'OPEN_FILE_BROWSER' }));
            } catch {}
          }}
          title="Browse for an audio file"
          style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontSize: 10, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >📂 Open File</button>
        <button
          onClick={handleSaveChops}
          title="Save this chop to the Preset Vault (Chopper category) — backed up to your preset folder"
          style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.12)', color: '#c084fc', fontSize: 10, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >💾 Save to Vault</button>
        {(localBufferRef.current || buffer) && (
          <>
            <button
              onClick={() => {
                // Stop any preview
                if (previewSourceRef.current) { try { previewSourceRef.current.stop(); } catch {} previewSourceRef.current = null; }
                playingSliceRef.current = null;
                setPlayingSlice(null);
                localBufferRef.current = null;
                // Clear markers
                onUpdateParam('chopMarkers', []);
                // Notify parent to clear the buffer
                onClearSample?.();
                showMessage?.('Sample cleared');
              }}
              title="Clear the loaded sample"
              style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 10, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >✕ Clear Sample</button>
          </>
        )}
        <button
          onClick={() => setShowChopFx(s => !s)}
          style={{
            padding: '3px 10px', borderRadius: 6, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10, fontWeight: 800,
            border: showChopFx ? '1px solid rgba(168,85,247,0.6)' : '1px solid rgba(168,85,247,0.3)',
            background: showChopFx ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.08)', color: '#c084fc',
          }}
        >✦ FX</button>
        <button
          onClick={() => setShowSessions(s => !s)}
          style={{
            padding: '3px 10px', borderRadius: 6, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10, fontWeight: 800,
            border: showSessions ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(245,158,11,0.3)',
            background: showSessions ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)', color: '#f59e0b',
          }}
        >📁 Sessions ({sessions.length})</button>
        <div className="sacred-chopper__header-info">
          {sampleInfo && (
            <div className="sacred-chopper__sample-info">
              <span>{sampleInfo.duration}</span>
              <span>{sampleInfo.channels}</span>
              <span>{sampleInfo.rate}</span>
            </div>
          )}
          <span className="sacred-chopper__mode-badge">{chopMode}</span>
          <div className="sacred-chopper__status-dot" />
        </div>
      </div>

      {/* Waveform */}
      <div
        className="sacred-chopper__waveform"
        ref={waveformRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="sacred-chopper__canvas" />
        {!displayBuffer && <div className="sacred-chopper__empty-text">Awaiting Sample</div>}

        {/* Slice Markers */}
        <svg className="sacred-chopper__markers-svg" preserveAspectRatio="none">
          {chopMarkers.map((pos, i) => {
            if (pos < viewWindow[0] || pos > viewWindow[1]) return null;
            const viewPos = (pos - viewWindow[0]) / (viewWindow[1] - viewWindow[0]);
            return (
              <g
                key={i}
                className="sacred-chopper__marker"
                onMouseDown={e => { e.stopPropagation(); setDraggingMarker(i); }}
                onDoubleClick={e => { e.stopPropagation(); handleMarkerDoubleClick(i); }}
              >
                <line
                  x1={`${viewPos * 100}%`} y1="0" x2={`${viewPos * 100}%`} y2="100%"
                  stroke={draggingMarker === i ? '#ff6600' : '#a855f7'}
                  strokeWidth={draggingMarker === i ? 2 : 1}
                  strokeOpacity={0.7}
                />
                <rect
                  x={`${viewPos * 100}%`} y="100%"
                  width="20" height="18" rx="3"
                  transform="translate(-10, -26)"
                  fill={draggingMarker === i ? '#ff6600' : 'rgba(20,10,40,0.9)'}
                  stroke={draggingMarker === i ? '#ffaa00' : '#a855f7'}
                  strokeWidth="1"
                />
                <text 
                  x={`${viewPos * 100}%`} y="100%" 
                  transform="translate(0, -13)" 
                  textAnchor="middle"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Minimap */}
      <div 
        className="sacred-chopper__minimap" 
        onMouseDown={handleMinimapDrag} 
        onMouseMove={handleMinimapDrag}
      >
        <canvas ref={minimapCanvasRef} className="sacred-chopper__minimap-canvas" />
        {displayBuffer && (
          <div 
            className="sacred-chopper__minimap-window" 
            style={{ 
              left: `${viewWindow[0] * 100}%`, 
              width: `${(viewWindow[1] - viewWindow[0]) * 100}%` 
            }} 
          />
        )}
      </div>

      {/* Slice Preview Bar — only visible when chop markers exist */}
      {(localBufferRef.current || buffer) && chopMarkers.length === 0 && (
        <div className="sacred-chopper__slice-bar" style={{ justifyContent: 'center', alignItems: 'center', color: '#6b5d8a', fontSize: 10, letterSpacing: '0.1em' }}>
          ADD SLICE MARKERS TO CREATE PADS
        </div>
      )}
      {(localBufferRef.current || buffer) && chopMarkers.length > 0 && (
        <div className="sacred-chopper__slice-bar">
          {sliceSegments.map((seg, i) => {
            const noteName = (['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'])[i % 12];
            const octave = Math.floor(i / 12) + 2;
            return (
              <div
                key={i}
                className={`sacred-chopper__slice ${playingSlice === i ? 'sacred-chopper__slice--playing' : ''}`}
                style={{ flex: seg.width, position: 'relative', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', paddingTop: 2 }}
                onClick={() => previewSlice(i)}
                title={`Slice ${i + 1} · ${noteName}${octave} (MIDI ${36 + i})`}
              >
                <span style={{ fontSize: 8, opacity: 0.7 }}>{noteName}{octave}</span>
                <button
                  onClick={e => { e.stopPropagation(); setSliceReversed(prev => { const n = [...prev]; n[i] = !n[i]; return n; }); }}
                  style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 7, padding: '1px 3px', borderRadius: 3, border: 'none', cursor: 'pointer', background: sliceReversed[i] ? 'rgba(168,85,247,0.5)' : 'rgba(255, 255, 255, 0.28)', color: sliceReversed[i] ? '#d8b4fe' : 'rgba(255, 255, 255, 0.52)', lineHeight: 1 }}
                  title="Reverse this slice"
                >R</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Marker Controls */}
      <div className="sacred-chopper__marker-controls">
        <button className="sacred-chopper__marker-btn" onClick={addMarker}>+ Add Slice</button>
        <button className="sacred-chopper__marker-btn sacred-chopper__marker-btn--danger" onClick={removeLastMarker}>− Remove</button>
        <div className="sacred-chopper__divider" style={{ height: 16 }} />
        {GRID_PRESETS.map(n => (
          <button key={n} className="sacred-chopper__marker-btn" onClick={() => applyGridChop(n)}>
            {n}
          </button>
        ))}
        <button className="sacred-chopper__marker-btn" onClick={applyAutoChop}>Auto</button>
        <span className="sacred-chopper__marker-count">{chopMarkers.length} markers · {sliceSegments.length} slices</span>
      </div>

      {/* Controls Rail */}
      <div className="sacred-chopper__controls">
        {/* Toggles */}
        <div className="sacred-chopper__section">
          <div className="sacred-chopper__toggles">
            <div className="sacred-chopper__toggle-row">
              <span className="sacred-chopper__toggle-label">Scope</span>
              <div className="sacred-chopper__scope-toggle">
                <button
                  className={`sacred-chopper__scope-btn ${sampleParams.scopeGlobal ? 'sacred-chopper__scope-btn--active' : ''}`}
                  onClick={() => onUpdateParam('scopeGlobal', true)}
                >Global</button>
                <button
                  className={`sacred-chopper__scope-btn ${!sampleParams.scopeGlobal ? 'sacred-chopper__scope-btn--active' : ''}`}
                  onClick={() => onUpdateParam('scopeGlobal', false)}
                >Slice</button>
              </div>
            </div>
            <div className="sacred-chopper__toggle-row">
              <span className="sacred-chopper__toggle-label">Snap (Transient)</span>
              <div
                className={`sacred-chopper__toggle ${sampleParams.snapToTransient ? 'sacred-chopper__toggle--on' : ''}`}
                onClick={() => onUpdateParam('snapToTransient', !sampleParams.snapToTransient)}
              >
                <div className="sacred-chopper__toggle-dot" />
              </div>
            </div>
            <div className="sacred-chopper__toggle-row">
              <span className="sacred-chopper__toggle-label">Snap (Zero-Cross)</span>
              <div
                className={`sacred-chopper__toggle ${sampleParams.snapToZero ? 'sacred-chopper__toggle--on' : ''}`}
                onClick={() => onUpdateParam('snapToZero', !sampleParams.snapToZero)}
              >
                <div className="sacred-chopper__toggle-dot" />
              </div>
            </div>
          </div>
        </div>

        <div className="sacred-chopper__divider" />

        {/* Knobs */}
        <div className="sacred-chopper__knob-group">
          {renderKnob('Speed', 'chopperSpeed', sampleParams.chopperSpeed, 0.25, 2.0, 'x', '#a855f7')}
          {renderKnob('Fade In', 'chopperFadeIn', sampleParams.chopperFadeIn, 0, 500, 'ms', '#ff6600')}
          {renderKnob('Fade Out', 'chopperFadeOut', sampleParams.chopperFadeOut, 0, 1000, 'ms', '#ff6600')}
          {renderKnob('Pitch', 'chopperPitch', sampleParams.chopperPitch, -24, 24, 'st', '#a855f7',
            sampleParams.chopperPitch > 0 ? `+${sampleParams.chopperPitch}` : `${sampleParams.chopperPitch}`)}
          {renderKnob('Glide', 'chopperGlide', sampleParams.chopperGlide, 0, 200, 'ms', '#a855f7')}
        </div>

        <div className="sacred-chopper__divider" />
      </div>

      {/* Bottom Rail */}
      <div className="sacred-chopper__bottom">
        {/* Chop Mode */}
        <div className="sacred-chopper__section">
          <span className="sacred-chopper__section-label">Chop Mode</span>
          <div className="sacred-chopper__mode-selector">
            {CHOP_MODES.map(m => (
              <button
                key={m}
                className={`sacred-chopper__mode-btn ${chopMode === m ? 'sacred-chopper__mode-btn--active' : ''}`}
                onClick={() => {
                  onUpdateParam('chopMode', m);
                  if (m === 'Auto') applyAutoChop();
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Sensitivity */}
        <div className="sacred-chopper__slider-group">
          <span className="sacred-chopper__slider-label">Sensitivity</span>
          <div className="sacred-chopper__slider-row">
            <input
              type="range" className="sacred-chopper__slider" min={0} max={100}
              value={sampleParams.chopperSensitivity}
              onChange={e => onUpdateParam('chopperSensitivity', +e.target.value)}
            />
            <span className="sacred-chopper__slider-value">{sampleParams.chopperSensitivity}</span>
          </div>
        </div>

        {/* Trigger */}
        <div className="sacred-chopper__section">
          <span className="sacred-chopper__section-label">Trigger</span>
          <select
            className="sacred-chopper__select"
            value={sampleParams.chopperTrigger}
            onChange={e => onUpdateParam('chopperTrigger', e.target.value)}
          >
            <option value="MIDI">MIDI</option>
            <option value="Gate">Gate</option>
            <option value="OneShot">One-Shot</option>
          </select>
        </div>

        {/* Dry/Wet */}
        <div className="sacred-chopper__slider-group">
          <span className="sacred-chopper__slider-label">Dry/Wet</span>
          <div className="sacred-chopper__slider-row">
            <input
              type="range" className="sacred-chopper__slider sacred-chopper__slider--purple" min={0} max={100}
              value={sampleParams.chopperDryWet}
              onChange={e => onUpdateParam('chopperDryWet', +e.target.value)}
            />
            <span className="sacred-chopper__slider-value">{sampleParams.chopperDryWet}%</span>
          </div>
        </div>

        {/* Output Volume */}
        <div className="sacred-chopper__slider-group">
          <span className="sacred-chopper__slider-label">Output</span>
          <div className="sacred-chopper__slider-row">
            <input
              type="range" className="sacred-chopper__slider sacred-chopper__slider--purple" min={-24} max={12}
              value={sampleParams.chopperOutputVolume}
              onChange={e => onUpdateParam('chopperOutputVolume', +e.target.value)}
            />
            <span className="sacred-chopper__slider-value">
              {sampleParams.chopperOutputVolume > 0 ? `+${sampleParams.chopperOutputVolume}` : sampleParams.chopperOutputVolume}dB
            </span>
          </div>
        </div>

        {/* Spread to Dais */}
        {onSpreadToPads && displayBuffer && chopMarkers.length > 0 && (
          <button
            className={`sacred-chopper__spread-btn ${spreadState !== 'idle' ? `sacred-chopper__spread-btn--${spreadState}` : ''}`}
            disabled={spreadState === 'spreading'}
            onClick={() => {
              if (!displayBuffer || !onSpreadToPads) return;
              setSpreadState('spreading');
              const sorted = [0, ...chopMarkers.sort((a, b) => a - b), 1];
              const sliceData: { start: number; end: number; sliceStart?: number; sliceDuration?: number; displayBuffer: AudioBuffer }[] = [];
              const ctx = audioEngine.ctx;
              previewCtxRef.current = ctx;

              for (let i = 0; i < sorted.length - 1 && i < 16; i++) {
                const sliceStart = sorted[i] * displayBuffer.duration;
                const sliceEnd = sorted[i + 1] * displayBuffer.duration;
                const duration = sliceEnd - sliceStart;
                if (duration <= 0) continue;
                
                sliceData.push({ 
                  start: sorted[i], 
                  end: sorted[i + 1], 
                  sliceStart,
                  sliceDuration: duration,
                  buffer: buffer // Zero-Copy!
                });
              }
              onSpreadToPads(sliceData);
              setSpreadState('done');
              setTimeout(() => setSpreadState('idle'), 2000);
            }}
          >
            <span className="sacred-chopper__spread-icon">
              {spreadState === 'done' ? '✔' : spreadState === 'spreading' ? '⦻' : '🔱'}
            </span>
            <span className="sacred-chopper__spread-label">
              {spreadState === 'done'
                ? `${Math.min(sliceSegments.length, 16)} SLICES → DAIS`
                : spreadState === 'spreading'
                ? 'SPREADING...'
                : `SPREAD TO DAIS (${Math.min(sliceSegments.length, 16)})`}
            </span>
          </button>
        )}
      </div>

      {/* ─── Chop FX Panel ─────────────────────────────────────────────────── */}
      {showChopFx && (
        <div style={{
          position: 'absolute', top: 48, left: 12, width: 340,
          background: '#0a0a18', border: '1px solid rgba(168,85,247,0.4)',
          borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.8)', zIndex: 50, padding: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#c084fc', letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}>✦ CHOPPER FX</span>
            <button onClick={() => setShowChopFx(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>

          {/* ── FX scope selector: ALL chops, or a specific chop ── */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Apply FX to
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <button onClick={() => setFxScope(-1)}
                style={{ padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                  background: fxScope < 0 ? '#a855f7' : 'rgba(255,255,255,0.08)', color: fxScope < 0 ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                All Chops
              </button>
              {sliceSegments.map((_seg, i) => {
                const hasOverride = sliceFx[i] != null;
                const sel = fxScope === i;
                return (
                  <button key={i} onClick={() => setFxScope(i)}
                    style={{ padding: '3px 8px', borderRadius: 5, border: hasOverride ? '1px solid #34d399' : '1px solid transparent', cursor: 'pointer', fontSize: 9, fontWeight: 800,
                      background: sel ? '#a855f7' : 'rgba(255,255,255,0.08)', color: sel ? '#fff' : hasOverride ? '#34d399' : 'rgba(255,255,255,0.5)' }}>
                    {i + 1}{hasOverride ? '•' : ''}
                  </button>
                );
              })}
            </div>
            {fxScope >= 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 8, color: '#34d399', flex: 1 }}>
                  Editing Chop {fxScope + 1} — overrides the global FX for this chop only.
                </span>
                {sliceFx[fxScope] != null && (
                  <button onClick={() => {
                    setSliceFx(prev => {
                      const next = { ...prev }; delete next[fxScope];
                      sliceFxRef.current = next;
                      onUpdateParam('chopperSliceFx', JSON.stringify(next));
                      return next;
                    });
                    try { sliceFxChainsRef.current.delete(fxScope); } catch {}
                  }}
                    style={{ padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(248,113,113,0.5)', cursor: 'pointer', fontSize: 8, fontWeight: 800, background: 'transparent', color: '#f87171', textTransform: 'uppercase' }}>
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Halftime toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.25)', border: `1px solid ${activeFx.halftimeEnabled ? 'rgba(245,158,11,0.4)' : 'rgba(255, 255, 255, 0.28)'}` }}>
            <div style={{ width: 3, height: 22, borderRadius: 2, background: '#f59e0b', flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>HALFTIME</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>0.5× speed · pitch drops one octave</div>
            </div>
            <button onClick={() => updateChopFx({ halftimeEnabled: !activeFx.halftimeEnabled })} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', background: activeFx.halftimeEnabled ? 'rgba(245,158,11,0.25)' : 'rgba(255, 255, 255, 0.27)', color: activeFx.halftimeEnabled ? '#f59e0b' : 'rgba(255, 255, 255, 0.42)' }}>
              {activeFx.halftimeEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {([
            { k: 'reverbMix'     as keyof ChopFxParams, label: 'REVERB',     color: '#818cf8', min: 0,   max: 100, step: 1   },
            { k: 'delayMix'      as keyof ChopFxParams, label: 'DELAY',      color: '#60a5fa', min: 0,   max: 100, step: 1   },
            { k: 'chorusMix'     as keyof ChopFxParams, label: 'CHORUS',     color: '#34d399', min: 0,   max: 100, step: 1   },
            { k: 'distDrive'     as keyof ChopFxParams, label: 'OVERDRIVE',  color: '#f87171', min: 0,   max: 100, step: 1   },
            { k: 'compThreshold' as keyof ChopFxParams, label: 'COMPRESS',   color: '#fbbf24', min: 0,   max: 100, step: 1   },
            { k: 'eqLow'         as keyof ChopFxParams, label: 'EQ LOW',     color: '#a78bfa', min: -15, max: 15,  step: 0.5 },
            { k: 'eqMid'         as keyof ChopFxParams, label: 'EQ MID',     color: '#c084fc', min: -15, max: 15,  step: 0.5 },
            { k: 'eqHigh'        as keyof ChopFxParams, label: 'EQ HIGH',    color: '#e879f9', min: -15, max: 15,  step: 0.5 },
          ] as const).map(({ k, label, color, min, max, step }) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 3, height: 22, borderRadius: 2, background: color, flexShrink: 0 }}/>
              <span style={{ width: 70, fontSize: 9, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{label}</span>
              <input type="range" min={min} max={max} step={step} value={activeFx[k] as number}
                onChange={e => updateChopFx({ [k]: +e.target.value })}
                style={{ flex: 1, accentColor: color, cursor: 'pointer' }}/>
              <span style={{ width: 30, textAlign: 'right', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {(activeFx[k] as number).toFixed(step < 1 ? 1 : 0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Sessions Panel ─────────────────────────────────────────────────── */}
      {showSessions && (
        <div style={{
          position: 'absolute', top: 48, right: 12, width: 320, maxHeight: 400,
          background: '#0a0a18', border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.8)', zIndex: 50,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.29)', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}>📁 Chop Sessions</span>
            <label style={{ fontSize: 9, cursor: 'pointer', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255, 255, 255, 0.32)', borderRadius: 4, padding: '2px 6px' }}>
              Import
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  const s = chopSessionService.import(ev.target?.result as string);
                  if (s) showMessage?.(`IMPORTED: "${s.name}"`);
                };
                reader.readAsText(file);
                e.target.value = '';
              }} />
            </label>
            <button onClick={() => setShowSessions(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sessions.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255, 255, 255, 0.47)', fontSize: 11 }}>
                No saved sessions yet.<br />Save a session with 💾 Save Session.
              </div>
            ) : sessions.map(session => (
              <div key={session.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.27)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 9, color: 'rgba(255, 255, 255, 0.52)' }}>
                    {session.sampleName} · {session.slices.length} slices · {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => handleLoadSession(session)} style={{
                  fontSize: 9, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 700,
                  border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.1)', color: '#c084fc',
                }}>Load</button>
                <button onClick={() => {
                  const json = chopSessionService.export(session.id);
                  if (!json) return;
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
                  a.download = `${session.name}.chopSession.json`;
                  a.click();
                }} style={{
                  fontSize: 9, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.32)', background: 'transparent', color: 'rgba(255, 255, 255, 0.52)',
                }}>↓</button>
                <button onClick={() => { chopSessionService.delete(session.id); showMessage?.('Session deleted'); }} style={{
                  fontSize: 9, padding: '3px 6px', borderRadius: 4, cursor: 'pointer', fontWeight: 700,
                  border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#f87171',
                }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MIDI Keyboard (C4=slice 0, C#4=slice 1, ...) ──────────────────── */}
      {(localBufferRef.current || buffer) && sliceSegments.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(168,85,247,0.2)', padding: '6px 8px 4px', background: '#070710', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#c084fc', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              🎹 Chop Keyboard
            </span>
            <span style={{ fontSize: 8, color: 'rgba(255, 255, 255, 0.47)' }}>C4 = Slice 1 · C#4 = Slice 2 · ...</span>
            {isActiveTab && <span style={{ marginLeft: 'auto', fontSize: 8, color: '#34d399' }}>● MIDI ACTIVE</span>}
          </div>
          {(() => {
            const chopKeys: { midi: number; name: string; isBlack: boolean; sliceIdx: number }[] = [];
            const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
            let midi = 60; // C4 start
            for (let i = 0; i < Math.min(sliceSegments.length, 24); i++) {
              const n = (midi - 60) % 12;
              chopKeys.push({ midi, name: noteNames[n], isBlack: noteNames[n].includes('#'), sliceIdx: i });
              midi++;
            }
            const whiteKeys = chopKeys.filter(k => !k.isBlack);
            return (
              <div style={{ display: 'flex', height: 44, gap: 0 }}>
                {whiteKeys.map(wk => {
                  const blackAfter = chopKeys.find(k => k.isBlack && k.midi === wk.midi + 1);
                  const isPressed = kbdPressedKeys.has(wk.midi);
                  const triggerSlice = (k: typeof wk) => {
                    const seg = sliceSegments[k.sliceIdx];
                    if (!seg) return;
                    const buf = localBufferRef.current || buffer;
                    if (!buf) return;
                    const ctx = audioEngine.ctx; previewCtxRef.current = ctx;
                    audioEngine.resume();
                    // Per-chop FX: route through this slice's own chain if it
                    // has an override, else the global chain.
                    const fxChain = resolveSliceChain(ctx, k.sliceIdx);
                    const sliceParams = sliceFxRef.current[k.sliceIdx] ?? chopFxStateRef.current;
                    if (previewSourceRef.current) { try { previewSourceRef.current.stop(); } catch {} }
                    const src = ctx.createBufferSource();
                    src.buffer = buf;
                    src.playbackRate.value = sliceParams.halftimeEnabled ? 0.5 : 1.0;
                    const startOffset = seg.start * buf.duration;
                    const endOffset = seg.end * buf.duration;
                    const gainNode = ctx.createGain();
                    gainNode.gain.value = 0.85;
                    src.connect(gainNode);
                    gainNode.connect(fxChain.input);
                    src.start(0, startOffset, endOffset - startOffset);
                    previewSourceRef.current = src;
                    setKbdPressedKeys(prev => new Set(prev).add(k.midi));
                    src.onended = () => setKbdPressedKeys(prev => { const s = new Set(prev); s.delete(k.midi); return s; });
                  };
                  return (
                    <div key={wk.midi} style={{ position: 'relative', flex: 1, height: '100%' }}>
                      <div
                        style={{
                          position: 'absolute', inset: 0,
                          background: isPressed ? '#a855f7' : wk.sliceIdx < sliceSegments.length ? `hsl(${(wk.sliceIdx * 47) % 360},50%,88%)` : 'rgba(228,215,248,0.7)',
                          border: '1px solid rgba(120,80,200,0.3)', borderTop: 'none',
                          borderRadius: '0 0 4px 4px', cursor: 'pointer', transition: 'background 0.04s',
                          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2,
                          boxSizing: 'border-box',
                        }}
                        onMouseDown={e => { e.preventDefault(); triggerSlice(wk); }}
                        onMouseUp={() => setKbdPressedKeys(prev => { const s = new Set(prev); s.delete(wk.midi); return s; })}
                        onMouseLeave={() => setKbdPressedKeys(prev => { const s = new Set(prev); s.delete(wk.midi); return s; })}
                        title={`Slice ${wk.sliceIdx + 1} (${(sliceSegments[wk.sliceIdx]?.start * 100).toFixed(0)}%–${(sliceSegments[wk.sliceIdx]?.end * 100).toFixed(0)}%)`}
                      >
                        <span style={{ fontSize: 6, color: 'rgba(0,0,0,0.4)', pointerEvents: 'none', fontWeight: 700 }}>
                          {wk.sliceIdx + 1}
                        </span>
                      </div>
                      {blackAfter && (
                        <div
                          style={{
                            position: 'absolute', top: 0, right: '-28%', width: '56%', height: '62%',
                            background: kbdPressedKeys.has(blackAfter.midi) ? '#7c3aed' : '#1a0d2e',
                            border: '1px solid rgba(168,85,247,0.4)', borderTop: 'none',
                            borderRadius: '0 0 3px 3px', cursor: 'pointer', zIndex: 2, transition: 'background 0.04s',
                            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2,
                          }}
                          onMouseDown={e => { e.preventDefault(); triggerSlice(blackAfter); }}
                          onMouseUp={() => setKbdPressedKeys(prev => { const s = new Set(prev); s.delete(blackAfter.midi); return s; })}
                          onMouseLeave={() => setKbdPressedKeys(prev => { const s = new Set(prev); s.delete(blackAfter.midi); return s; })}
                          title={`Slice ${blackAfter.sliceIdx + 1}`}
                        >
                          <span style={{ fontSize: 5, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none', fontWeight: 700 }}>
                            {blackAfter.sliceIdx + 1}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
