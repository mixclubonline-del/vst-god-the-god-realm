/**
 * SacredMasterMeter — Production-Grade Master Metering Panel
 *
 * Canvas-based rendering for:
 *  1. FFT Spectrum Analyzer (logarithmic frequency scale, dB magnitude)
 *  2. Stereo Peak/RMS LED meters with peak-hold & clip indicators
 *  3. Waveform Oscilloscope / Lissajous Vectorscope
 *  4. Stereo Correlation bar (always visible)
 *
 * Single rAF loop drives all visualizations.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MasterAnalyzer, MeterSnapshot } from '../../audio/MasterAnalyzer';
import './SacredMasterMeter.css';

type MeterView = 'spectrum' | 'meters' | 'scope';

interface SacredMasterMeterProps {
  analyzer: MasterAnalyzer | null;
  isPlaying: boolean;
  bpm?: number;
}

/* ═══ Constants ═══ */
const FREQ_LABELS = [
  { freq: 50, label: '50' },
  { freq: 100, label: '100' },
  { freq: 250, label: '250' },
  { freq: 500, label: '500' },
  { freq: 1000, label: '1k' },
  { freq: 2500, label: '2.5k' },
  { freq: 5000, label: '5k' },
  { freq: 10000, label: '10k' },
  { freq: 20000, label: '20k' },
];

const DB_LABELS = [-48, -36, -24, -12, -6, -3, 0];

// Map a linear bin index to logarithmic X position
function freqToX(freq: number, width: number, minFreq = 20, maxFreq = 20000): number {
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logFreq = Math.log10(Math.max(minFreq, Math.min(maxFreq, freq)));
  return ((logFreq - logMin) / (logMax - logMin)) * width;
}

// Map a dB value to Y position
function dbToY(db: number, height: number, minDb = -90, maxDb = 0): number {
  const clamped = Math.max(minDb, Math.min(maxDb, db));
  return height * (1 - (clamped - minDb) / (maxDb - minDb));
}

export const SacredMasterMeter: React.FC<SacredMasterMeterProps> = ({
  analyzer,
  isPlaying,
  bpm = 140,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [activeView, setActiveView] = useState<MeterView>('spectrum');
  const [isExpanded, setIsExpanded] = useState(true);
  const [lastSnapshot, setLastSnapshot] = useState<MeterSnapshot | null>(null);

  /* ═══ Resize observer to match canvas to container ═══ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
    });

    observer.observe(canvas.parentElement!);
    return () => observer.disconnect();
  }, []);

  /* ═══ Main render loop ═══ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyzer) return;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      const snapshot = analyzer.getSnapshot();
      setLastSnapshot(snapshot);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx2d.save();
      ctx2d.scale(dpr, dpr);

      // Clear
      ctx2d.clearRect(0, 0, w, h);
      ctx2d.fillStyle = 'rgba(8, 2, 2, 0.95)';
      ctx2d.fillRect(0, 0, w, h);

      switch (activeView) {
        case 'spectrum':
          drawSpectrum(ctx2d, snapshot, w, h);
          break;
        case 'meters':
          drawMeters(ctx2d, snapshot, w, h);
          break;
        case 'scope':
          drawScope(ctx2d, snapshot, w, h);
          break;
      }

      ctx2d.restore();
    };

    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyzer, activeView]);

  /* ═══ Spectrum Analyzer ═══ */
  const drawSpectrum = useCallback((ctx: CanvasRenderingContext2D, snap: MeterSnapshot, w: number, h: number) => {
    const sampleRate = 44100; // assumed
    const binCount = snap.spectrumSize;
    const freqPerBin = sampleRate / (binCount * 2);

    const PAD_L = 28;
    const PAD_R = 4;
    const PAD_T = 4;
    const PAD_B = 14;
    const plotW = w - PAD_L - PAD_R;
    const plotH = h - PAD_T - PAD_B;

    // ─── Grid lines (dB) ───
    ctx.font = '7px JetBrains Mono, monospace';
    ctx.textAlign = 'right';

    for (const db of DB_LABELS) {
      const y = PAD_T + dbToY(db, plotH);
      ctx.strokeStyle = db === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = db === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(w - PAD_R, y);
      ctx.stroke();

      ctx.fillStyle = db === 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.15)';
      ctx.fillText(`${db}`, PAD_L - 3, y + 3);
    }

    // ─── Grid lines (frequency) ───
    ctx.textAlign = 'center';
    for (const fl of FREQ_LABELS) {
      const x = PAD_L + freqToX(fl.freq, plotW);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, PAD_T);
      ctx.lineTo(x, h - PAD_B);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillText(fl.label, x, h - 2);
    }

    // ─── Spectrum curve ───
    const grad = ctx.createLinearGradient(0, PAD_T, 0, h - PAD_B);
    grad.addColorStop(0, 'rgba(255, 102, 0, 0.8)');
    grad.addColorStop(0.3, 'rgba(255, 215, 0, 0.6)');
    grad.addColorStop(1, 'rgba(255, 215, 0, 0.05)');

    // Fill under curve
    ctx.beginPath();
    ctx.moveTo(PAD_L, h - PAD_B);

    let prevX = PAD_L;
    for (let bin = 1; bin < binCount; bin++) {
      const freq = bin * freqPerBin;
      if (freq < 20 || freq > 20000) continue;

      const x = PAD_L + freqToX(freq, plotW);
      if (x - prevX < 0.5) continue; // skip sub-pixel bins
      prevX = x;

      const db = snap.spectrum[bin];
      const y = PAD_T + dbToY(db, plotH);

      ctx.lineTo(x, y);
    }

    ctx.lineTo(w - PAD_R, h - PAD_B);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke the curve
    ctx.beginPath();
    prevX = PAD_L;
    for (let bin = 1; bin < binCount; bin++) {
      const freq = bin * freqPerBin;
      if (freq < 20 || freq > 20000) continue;

      const x = PAD_L + freqToX(freq, plotW);
      if (x - prevX < 0.5) continue;
      prevX = x;

      const db = snap.spectrum[bin];
      const y = PAD_T + dbToY(db, plotH);

      if (bin === 1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#FF660066';
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, []);

  /* ═══ Stereo Meters ═══ */
  const drawMeters = useCallback((ctx: CanvasRenderingContext2D, snap: MeterSnapshot, w: number, h: number) => {
    const PAD = 8;
    const meterW = 20;
    const gap = 6;
    const totalW = meterW * 2 + gap;
    const startX = (w - totalW) / 2;
    const meterH = h - PAD * 2;

    // Draw each meter
    const drawMeter = (x: number, peak: number, rms: number, peakHold: number, clip: boolean, label: string) => {
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.roundRect(x, PAD, meterW, meterH, 3);
      ctx.fill();

      // Segmented LED bars (from bottom to top)
      const segments = 48;
      const segH = meterH / segments;
      const segGap = 1;

      for (let s = 0; s < segments; s++) {
        const segVal = s / segments;
        const segDb = -90 + segVal * 90; // -90 to 0 dB
        const segY = PAD + meterH - (s + 1) * segH;

        // RMS fill
        const rmsDb = rms > 0.0001 ? 20 * Math.log10(rms) : -90;
        const peakDb = peak > 0.0001 ? 20 * Math.log10(peak) : -90;

        let color: string;
        if (segDb >= -3) color = clip ? '#EF4444' : '#EF4444aa';
        else if (segDb >= -6) color = '#FBBF24';
        else if (segDb >= -12) color = '#FFD700';
        else color = '#22C55E';

        const isRmsLit = segDb <= rmsDb;
        const isPeakLit = segDb <= peakDb;

        if (isRmsLit) {
          ctx.fillStyle = color;
        } else if (isPeakLit) {
          ctx.fillStyle = color + '44';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
        }

        ctx.fillRect(x + 1, segY + segGap / 2, meterW - 2, segH - segGap);
      }

      // Peak hold line
      const peakHoldDb = peakHold > 0.0001 ? 20 * Math.log10(peakHold) : -90;
      const holdY = PAD + meterH * (1 - (peakHoldDb + 90) / 90);
      if (holdY >= PAD && holdY <= PAD + meterH) {
        ctx.fillStyle = '#FFD700';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#FFD70066';
        ctx.fillRect(x, holdY, meterW, 2);
        ctx.shadowBlur = 0;
      }

      // Clip indicator
      if (clip) {
        ctx.fillStyle = '#EF4444';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#EF4444';
        ctx.beginPath();
        ctx.roundRect(x, PAD - 1, meterW, 4, 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + meterW / 2, h - 1);
    };

    drawMeter(startX, snap.peakL, snap.rmsL, snap.peakHoldL, snap.clipL, 'L');
    drawMeter(startX + meterW + gap, snap.peakR, snap.rmsR, snap.peakHoldR, snap.clipR, 'R');

    // ─── dB scale labels on left ───
    ctx.textAlign = 'right';
    ctx.font = '7px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (const db of [-48, -24, -12, -6, -3, 0]) {
      const y = PAD + meterH * (1 - (db + 90) / 90);
      ctx.fillText(`${db}`, startX - 4, y + 3);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + totalW, y);
      ctx.stroke();
    }

    // ─── Peak dB readout ───
    const peakDbL = snap.peakL > 0.0001 ? (20 * Math.log10(snap.peakL)).toFixed(1) : '-∞';
    const peakDbR = snap.peakR > 0.0001 ? (20 * Math.log10(snap.peakR)).toFixed(1) : '-∞';
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.fillStyle = snap.clipL ? '#EF4444' : '#FFD700';
    ctx.fillText(`${peakDbL}`, startX + meterW / 2, PAD - 5);
    ctx.fillStyle = snap.clipR ? '#EF4444' : '#FFD700';
    ctx.fillText(`${peakDbR}`, startX + meterW + gap + meterW / 2, PAD - 5);
  }, []);

  /* ═══ Oscilloscope / Vectorscope ═══ */
  const [scopeMode, setScopeMode] = useState<'wave' | 'vector'>('wave');

  const drawScope = useCallback((ctx: CanvasRenderingContext2D, snap: MeterSnapshot, w: number, h: number) => {
    if (scopeMode === 'wave') {
      // Waveform oscilloscope
      const PAD = 8;
      const plotW = w - PAD * 2;
      const plotH = h - PAD * 2;
      const centerY = PAD + plotH / 2;

      // Center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD, centerY);
      ctx.lineTo(PAD + plotW, centerY);
      ctx.stroke();

      // ±25% and ±50% grid
      for (const frac of [0.25, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(PAD, centerY - plotH * frac);
        ctx.lineTo(PAD + plotW, centerY - plotH * frac);
        ctx.moveTo(PAD, centerY + plotH * frac);
        ctx.lineTo(PAD + plotW, centerY + plotH * frac);
        ctx.stroke();
      }

      // Draw L channel
      const samples = snap.waveformL.length;
      const step = Math.max(1, Math.floor(samples / plotW));

      ctx.beginPath();
      for (let i = 0; i < plotW; i++) {
        const sIdx = Math.floor((i / plotW) * samples);
        const val = snap.waveformL[sIdx] || 0;
        const y = centerY - val * plotH * 0.5;
        if (i === 0) ctx.moveTo(PAD + i, y);
        else ctx.lineTo(PAD + i, y);
      }
      ctx.strokeStyle = '#FFD700aa';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Draw R channel
      ctx.beginPath();
      for (let i = 0; i < plotW; i++) {
        const sIdx = Math.floor((i / plotW) * samples);
        const val = snap.waveformR[sIdx] || 0;
        const y = centerY - val * plotH * 0.5;
        if (i === 0) ctx.moveTo(PAD + i, y);
        else ctx.lineTo(PAD + i, y);
      }
      ctx.strokeStyle = '#A855F766';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Labels
      ctx.font = '7px JetBrains Mono, monospace';
      ctx.fillStyle = '#FFD70066';
      ctx.textAlign = 'left';
      ctx.fillText('L', PAD + 2, PAD + 10);
      ctx.fillStyle = '#A855F766';
      ctx.fillText('R', PAD + 14, PAD + 10);

    } else {
      // Lissajous vectorscope (X=L+R, Y=L-R → stereo field)
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 8;

      // Circle guide
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Cross guides
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.stroke();

      // Labels
      ctx.font = '7px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.textAlign = 'center';
      ctx.fillText('M', cx, cy - radius - 3);
      ctx.fillText('S', cx + radius + 6, cy + 3);

      // Plot dots
      const samples = snap.waveformL.length;
      const step = Math.max(1, Math.floor(samples / 512));

      ctx.fillStyle = '#FFD70018';
      for (let i = 0; i < samples; i += step) {
        const l = snap.waveformL[i] || 0;
        const r = snap.waveformR[i] || 0;
        const mid = (l + r) * 0.5;
        const side = (l - r) * 0.5;
        const x = cx + side * radius;
        const y = cy - mid * radius;
        ctx.fillRect(x, y, 1.5, 1.5);
      }

      // Brighter recent dots
      ctx.fillStyle = '#FFD70066';
      const recentStart = Math.max(0, samples - 256);
      for (let i = recentStart; i < samples; i += Math.max(1, step / 2)) {
        const l = snap.waveformL[i] || 0;
        const r = snap.waveformR[i] || 0;
        const mid = (l + r) * 0.5;
        const side = (l - r) * 0.5;
        const x = cx + side * radius;
        const y = cy - mid * radius;
        ctx.fillRect(x - 0.5, y - 0.5, 2, 2);
      }
    }
  }, [scopeMode]);

  /* ═══ Correlation bar values ═══ */
  const corr = lastSnapshot?.correlation ?? 1;
  const corrPercent = ((corr + 1) / 2) * 100; // map -1..+1 to 0..100%
  const corrColor = corr < 0 ? '#EF4444' : corr < 0.3 ? '#FBBF24' : '#22C55E';

  /* ═══ LUFS display ═══ */
  const lufs = lastSnapshot?.lufs ?? -Infinity;
  const lufsDisplay = isFinite(lufs) ? `${lufs.toFixed(1)} LUFS` : '— LUFS';
  const lufsQuiet = !isFinite(lufs) || lufs < -60;

  return (
    <div className={`sacred-meter ${isExpanded ? 'sacred-meter--expanded' : 'sacred-meter--compact'}`}>
      {/* Tab bar */}
      <div className="sacred-meter__tabs">
        {(['spectrum', 'meters', 'scope'] as MeterView[]).map(view => (
          <button
            key={view}
            className={`sacred-meter__tab ${activeView === view ? 'sacred-meter__tab--active' : ''}`}
            onClick={() => setActiveView(view)}
          >
            {view === 'spectrum' ? '📊' : view === 'meters' ? '📏' : '〰️'}{' '}
            {view.toUpperCase()}
          </button>
        ))}

        {activeView === 'scope' && (
          <button
            className={`sacred-meter__tab ${scopeMode === 'vector' ? 'sacred-meter__tab--active' : ''}`}
            onClick={() => setScopeMode(scopeMode === 'wave' ? 'vector' : 'wave')}
            style={{ marginLeft: 4 }}
          >
            {scopeMode === 'wave' ? '⊕ XY' : '〰 WAVE'}
          </button>
        )}

        <span className="sacred-meter__tab-spacer" />

        <span className={`sacred-meter__lufs-readout ${lufsQuiet ? 'sacred-meter__lufs-readout--quiet' : ''}`}>
          {lufsDisplay}
        </span>

        <button
          className="sacred-meter__expand-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Compact' : 'Expand'}
        >
          {isExpanded ? '▾' : '▴'}
        </button>
      </div>

      {/* Canvas */}
      <div className="sacred-meter__canvas-wrap">
        <canvas ref={canvasRef} className="sacred-meter__canvas" />
      </div>

      {/* Stereo Correlation Bar */}
      <div className="sacred-meter__correlation">
        <span className="sacred-meter__corr-label">C/R</span>
        <div className="sacred-meter__corr-track">
          <div className="sacred-meter__corr-center" />
          <div
            className="sacred-meter__corr-fill"
            style={{
              left: corr >= 0 ? '50%' : `${corrPercent}%`,
              width: `${Math.abs(corr) * 50}%`,
              background: corrColor,
              boxShadow: `0 0 6px ${corrColor}44`,
            }}
          />
        </div>
        <span className="sacred-meter__corr-value" style={{ color: corrColor }}>
          {corr.toFixed(2)}
        </span>
      </div>
    </div>
  );
};
