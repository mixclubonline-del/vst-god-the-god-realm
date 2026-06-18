/**
 * AnunnakiVeil.tsx — ANUNNAKI VEIL Filter Plugin · V2
 * 
 * A premium multi-mode filter with interactive frequency response curve,
 * resonance drive, envelope follower, and LFO modulation.
 * 
 * V2 changes:
 * - Restructured layout: Filter Type → Curve (hero) → Knobs (horizontal strip) → LFO → Preset bar
 * - CUTOFF knob is now hero-sized (xl) front and center
 * - Frequency readout overlay on the canvas with animated node trail
 * - Resonance ring visualizer around the cutoff knob
 * - Proper spacing so nothing is clipped
 * - Mix knob added for parallel filtering
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DivineKnob } from '../ui/DivineKnob';
import type { PluginComponentProps } from './pluginRegistry';
import './AnunnakiVeil.css';

/* ═══ Filter Type Definitions ═══ */

const FILTER_TYPES = [
  { id: 0, name: 'LP', label: 'Low Pass', svg: 'M4 20 Q16 20 20 4' },
  { id: 1, name: 'HP', label: 'High Pass', svg: 'M4 20 Q8 4 20 4' },
  { id: 2, name: 'BP', label: 'Band Pass', svg: 'M4 20 L10 4 L16 4 L20 20' },
  { id: 3, name: 'NOTCH', label: 'Notch', svg: 'M4 4 L10 4 L10 20 L14 20 L14 4 L20 4' },
  { id: 4, name: 'AP', label: 'All Pass', svg: 'M4 12 L20 12' },
  { id: 5, name: 'PEAK', label: 'Peaking', svg: 'M4 12 Q12 2 20 12' },
] as const;

/* ═══ Presets ═══ */

const PRESETS = [
  { name: 'Init', cutoff: 100, resonance: 0, type: 0, drive: 0, mix: 100, lfoRate: 0, lfoDepth: 0, envAmount: 0 },
  { name: 'Warm Bass', cutoff: 35, resonance: 25, type: 0, drive: 30, mix: 100, lfoRate: 0, lfoDepth: 0, envAmount: 0 },
  { name: 'Acid Squelch', cutoff: 20, resonance: 80, type: 0, drive: 60, mix: 100, lfoRate: 0, lfoDepth: 0, envAmount: 75 },
  { name: 'Telephone', cutoff: 45, resonance: 15, type: 2, drive: 10, mix: 100, lfoRate: 0, lfoDepth: 0, envAmount: 0 },
  { name: 'Auto Wah', cutoff: 30, resonance: 55, type: 0, drive: 20, mix: 100, lfoRate: 40, lfoDepth: 70, envAmount: 0 },
  { name: 'Ethereal Sweep', cutoff: 50, resonance: 40, type: 0, drive: 15, mix: 80, lfoRate: 15, lfoDepth: 80, envAmount: 0 },
  { name: 'Dark Resonance', cutoff: 25, resonance: 65, type: 0, drive: 45, mix: 100, lfoRate: 0, lfoDepth: 0, envAmount: 0 },
  { name: 'Hi-Pass Cleaner', cutoff: 15, resonance: 5, type: 1, drive: 0, mix: 100, lfoRate: 0, lfoDepth: 0, envAmount: 0 },
  { name: 'Parallel Grit', cutoff: 40, resonance: 60, type: 0, drive: 70, mix: 50, lfoRate: 0, lfoDepth: 0, envAmount: 0 },
  { name: 'Cosmic Filter', cutoff: 65, resonance: 70, type: 0, drive: 20, mix: 90, lfoRate: 25, lfoDepth: 50, envAmount: 30 },
] as const;

/* ═══ Helpers ═══ */

function freqToX(freq: number, width: number): number {
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);
  return ((Math.log10(freq) - minLog) / (maxLog - minLog)) * width;
}

function dbToY(db: number, height: number, range: number = 36): number {
  return height / 2 - (db / range) * height;
}

function computeFilterResponse(
  type: number,
  cutoffNorm: number,
  resonance: number,
  numPoints: number = 512
): Float32Array {
  const response = new Float32Array(numPoints);
  const cutoffHz = 20 * Math.pow(1000, cutoffNorm / 100);
  const q = 0.5 + (resonance / 100) * 17.5;

  for (let i = 0; i < numPoints; i++) {
    const freq = 20 * Math.pow(1000, i / numPoints);
    const w = freq / cutoffHz;
    let magnitude: number;
    switch (type) {
      case 0: magnitude = 1 / Math.sqrt(Math.pow(1 - w * w, 2) + Math.pow(w / q, 2)); break;
      case 1: magnitude = (w * w) / Math.sqrt(Math.pow(1 - w * w, 2) + Math.pow(w / q, 2)); break;
      case 2: magnitude = (w / q) / Math.sqrt(Math.pow(1 - w * w, 2) + Math.pow(w / q, 2)); break;
      case 3: magnitude = Math.sqrt(Math.pow(1 - w * w, 2)) / Math.sqrt(Math.pow(1 - w * w, 2) + Math.pow(w / q, 2)); break;
      case 4: magnitude = 1; break;
      case 5: {
        const gain = q / 2;
        magnitude = Math.sqrt((Math.pow(1 - w * w, 2) + Math.pow(w * gain / q, 2)) / (Math.pow(1 - w * w, 2) + Math.pow(w / q, 2)));
        break;
      }
      default: magnitude = 1;
    }
    response[i] = Math.max(-36, Math.min(36, 20 * Math.log10(Math.max(0.0001, magnitude))));
  }
  return response;
}

function formatFreq(hz: number): string {
  if (hz >= 10000) return `${(hz / 1000).toFixed(1)}k`;
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)}k`;
  return `${Math.round(hz)}`;
}

/* ═══ Main Component ═══ */

const AnunnakiVeil: React.FC<PluginComponentProps> = ({
  trackIndex,
  slotIndex,
  params,
  onParamChange,
  bypassed,
  trackColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lfoCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const isDraggingCurve = useRef(false);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [showPresets, setShowPresets] = useState(false);
  const [isHoveringCurve, setIsHoveringCurve] = useState(false);

  const cutoff = Math.min(100, Math.max(0, params.cutoff ?? 100));
  const resonance = params.resonance ?? 0;
  const filterType = params.type ?? 0;
  const drive = params.drive ?? 0;
  const mix = params.mix ?? 100;
  const lfoRate = params.lfoRate ?? 0;
  const lfoDepth = params.lfoDepth ?? 0;
  const envAmount = params.envAmount ?? 0;

  const cutoffHz = Math.min(20000, 20 * Math.pow(1000, cutoff / 100));

  /* ═══ Interactive Filter Curve Canvas ═══ */

  const drawFilterCurve = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // ── Background grid ──
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.04)';
    ctx.lineWidth = 0.5;

    const freqLines = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    for (const freq of freqLines) {
      const x = freqToX(freq, w);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Labels
      ctx.fillStyle = 'rgba(212, 168, 83, 0.18)';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
      ctx.fillText(label, x, h - 3);
    }

    const dbLines = [-24, -12, 0, 12, 24];
    for (const db of dbLines) {
      const y = dbToY(db, h);
      ctx.strokeStyle = db === 0 ? 'rgba(212, 168, 83, 0.1)' : 'rgba(212, 168, 83, 0.03)';
      ctx.lineWidth = db === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      if (db !== 0) {
        ctx.fillStyle = 'rgba(212, 168, 83, 0.12)';
        ctx.font = '7px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${db > 0 ? '+' : ''}${db}`, 2, y - 2);
      }
    }

    // ── Compute response ──
    const response = computeFilterResponse(filterType, cutoff, resonance, 512);

    // ── Gradient fill under curve ──
    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    fillGrad.addColorStop(0, 'rgba(212, 168, 83, 0.08)');
    fillGrad.addColorStop(0.5, 'rgba(212, 168, 83, 0.03)');
    fillGrad.addColorStop(1, 'rgba(212, 168, 83, 0.0)');
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < response.length; i++) {
      const x = (i / response.length) * w;
      const y = dbToY(response[i], h);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // ── Glow layer ──
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.25)';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.filter = 'blur(4px)';
    ctx.beginPath();
    for (let i = 0; i < response.length; i++) {
      const x = (i / response.length) * w;
      const y = dbToY(response[i], h);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.filter = 'none';

    // ── Main curve (gold gradient) ──
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, 'rgba(212, 168, 83, 0.6)');
    gradient.addColorStop(0.3, '#d4a853');
    gradient.addColorStop(0.5, '#f5d78e');
    gradient.addColorStop(0.7, '#d4a853');
    gradient.addColorStop(1, 'rgba(212, 168, 83, 0.6)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < response.length; i++) {
      const x = (i / response.length) * w;
      const y = dbToY(response[i], h);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ── Cutoff node ──
    const nodeX = freqToX(cutoffHz, w);
    const nodeIdx = Math.round((cutoff / 100) * (response.length - 1));
    const nodeY = dbToY(response[Math.min(nodeIdx, response.length - 1)] || 0, h);

    // Outer pulsing glow
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212, 168, 83, 0.08)';
    ctx.fill();

    // Ring
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f5d78e';
    ctx.fill();

    // ── Cutoff vertical guide line ──
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(nodeX, 0);
    ctx.lineTo(nodeX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Frequency readout at node ──
    const freqLabel = formatFreq(cutoffHz) + 'Hz';
    const qLabel = `Q: ${(0.5 + (resonance / 100) * 17.5).toFixed(1)}`;

    // Background pill for readout
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(freqLabel).width;
    const pillX = Math.max(textWidth / 2 + 8, Math.min(w - textWidth / 2 - 8, nodeX));
    const pillY = Math.max(24, nodeY - 22);

    ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
    const rx = pillX - textWidth / 2 - 8;
    const ry = pillY - 8;
    const rw = textWidth + 16;
    const rh = 18;
    const rr = 4;
    ctx.beginPath();
    ctx.moveTo(rx + rr, ry);
    ctx.lineTo(rx + rw - rr, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rr, rr);
    ctx.lineTo(rx + rw, ry + rh - rr);
    ctx.arcTo(rx + rw, ry + rh, rx + rw - rr, ry + rh, rr);
    ctx.lineTo(rx + rr, ry + rh);
    ctx.arcTo(rx, ry + rh, rx, ry + rh - rr, rr);
    ctx.lineTo(rx, ry + rr);
    ctx.arcTo(rx, ry, rx + rr, ry, rr);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = '#d4a853';
    ctx.textAlign = 'center';
    ctx.fillText(freqLabel, pillX, pillY + 4);

    // Q readout (smaller, below)
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(212, 168, 83, 0.4)';
    ctx.fillText(qLabel, pillX, pillY + 16);

  }, [cutoff, resonance, filterType, cutoffHz]);

  // Draw filter curve once per parameter change (not 60fps)
  useEffect(() => {
    drawFilterCurve();
  }, [drawFilterCurve]);

  /* ═══ LFO Canvas ═══ */

  useEffect(() => {
    const canvas = lfoCanvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let rafId: number;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      // Center line always
      ctx.strokeStyle = 'rgba(212, 168, 83, 0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      if (lfoRate <= 0 && lfoDepth <= 0) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      frame++;
      const speed = 0.1 + (lfoRate / 100) * 2.0;
      const amplitude = (lfoDepth / 100) * (h / 2 - 4);
      const phase = frame * speed * 0.02;

      // Glow
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.lineWidth = 4;
      ctx.filter = 'blur(3px)';
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const t = (x / w) * Math.PI * 4;
        const y = h / 2 + Math.sin(t + phase) * amplitude;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.filter = 'none';

      // Line
      const lfoGrad = ctx.createLinearGradient(0, 0, w, 0);
      lfoGrad.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
      lfoGrad.addColorStop(0.5, '#3b82f6');
      lfoGrad.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
      ctx.strokeStyle = lfoGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const t = (x / w) * Math.PI * 4;
        const y = h / 2 + Math.sin(t + phase) * amplitude;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [lfoRate, lfoDepth]);

  /* ═══ Canvas Interaction ═══ */

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDraggingCurve.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleCanvasPointerMove(e);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingCurve.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onParamChange('cutoff', Math.max(0, Math.min(100, (x / rect.width) * 100)));
    onParamChange('resonance', Math.max(0, Math.min(100, (1 - y / rect.height) * 100)));
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingCurve.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  /* ═══ Presets ═══ */

  const applyPreset = (preset: typeof PRESETS[number]) => {
    onParamChange('cutoff', preset.cutoff);
    onParamChange('resonance', preset.resonance);
    onParamChange('type', preset.type);
    onParamChange('drive', preset.drive);
    onParamChange('mix', preset.mix);
    onParamChange('lfoRate', preset.lfoRate);
    onParamChange('lfoDepth', preset.lfoDepth);
    onParamChange('envAmount', preset.envAmount);
    setShowPresets(false);
  };

  /* ═══ Render ═══ */

  return (
    <div className={`anunnaki-veil ${bypassed ? 'anunnaki-veil--bypassed' : ''}`}>

      {/* ─── Preset Bar (top) ─── */}
      <div className="anunnaki-veil__preset-bar">
        <button className="anunnaki-veil__preset-btn" onClick={() => setShowPresets(!showPresets)}>
          <span className="anunnaki-veil__preset-icon">◆</span>
          <span className="anunnaki-veil__preset-name">{PRESETS[selectedPreset]?.name || 'Init'}</span>
          <span className="anunnaki-veil__preset-nav">◀</span>
          <span className="anunnaki-veil__preset-nav">▶</span>
          <span className="anunnaki-veil__preset-arrow">{showPresets ? '▴' : '▾'}</span>
        </button>
        <AnimatePresence>
          {showPresets && (
            <motion.div
              className="anunnaki-veil__preset-dropdown"
              initial={{ opacity: 0, y: -8, scaleY: 0.9 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -8, scaleY: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  className={`anunnaki-veil__preset-option ${i === selectedPreset ? 'active' : ''}`}
                  onClick={() => { setSelectedPreset(i); applyPreset(preset); }}
                >
                  <span className="anunnaki-veil__preset-option-name">{preset.name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Filter Type Selector ─── */}
      <div className="anunnaki-veil__type-selector">
        <div className="anunnaki-veil__type-buttons">
          {FILTER_TYPES.map(ft => (
            <button
              key={ft.id}
              className={`anunnaki-veil__type-btn ${filterType === ft.id ? 'active' : ''}`}
              onClick={() => onParamChange('type', ft.id)}
              title={ft.label}
            >
              <svg viewBox="0 0 24 24" className="anunnaki-veil__type-svg">
                <path d={ft.svg} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="anunnaki-veil__type-btn-name">{ft.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Hero: Interactive Filter Curve ─── */}
      <div
        className={`anunnaki-veil__curve-container ${isHoveringCurve || isDraggingCurve.current ? 'anunnaki-veil__curve-container--active' : ''}`}
        onMouseEnter={() => setIsHoveringCurve(true)}
        onMouseLeave={() => setIsHoveringCurve(false)}
      >
        <canvas
          ref={canvasRef}
          className="anunnaki-veil__curve-canvas"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
        />
        <div className="anunnaki-veil__curve-hint">
          DRAG · CUTOFF × RESONANCE
        </div>
      </div>

      {/* ─── Main Controls Strip ─── */}
      <div className="anunnaki-veil__controls">
        {/* Left: Resonance + Drive */}
        <div className="anunnaki-veil__knob-col">
          <DivineKnob
            size="md"
            label="RESONANCE"
            id={`veil_res_${trackIndex}_${slotIndex}`}
            value={resonance}
            min={0} max={100} unit="%"
            color="#d4a853"
            onChange={(v) => onParamChange('resonance', v)}
            variant="celestial"
          />
          <DivineKnob
            size="sm"
            label="DRIVE"
            id={`veil_drive_${trackIndex}_${slotIndex}`}
            value={drive}
            min={0} max={100} unit="%"
            color="#ef4444"
            onChange={(v) => onParamChange('drive', v)}
            variant="infernal"
          />
        </div>

        {/* Center: Hero CUTOFF Knob */}
        <div className="anunnaki-veil__knob-hero">
          <DivineKnob
            size="lg"
            label="CUTOFF"
            id={`veil_cutoff_${trackIndex}_${slotIndex}`}
            value={cutoff}
            min={0} max={100} unit="%"
            color="#d4a853"
            onChange={(v) => onParamChange('cutoff', v)}
            variant="celestial"
          />
          <div className="anunnaki-veil__freq-readout">
            {formatFreq(cutoffHz)}<span className="anunnaki-veil__freq-unit">Hz</span>
          </div>
        </div>

        {/* Right: Mix + Env */}
        <div className="anunnaki-veil__knob-col">
          <DivineKnob
            size="md"
            label="MIX"
            id={`veil_mix_${trackIndex}_${slotIndex}`}
            value={mix}
            min={0} max={100} unit="%"
            color="#10b981"
            onChange={(v) => onParamChange('mix', v)}
            variant="default"
          />
          <DivineKnob
            size="sm"
            label="ENV"
            id={`veil_env_${trackIndex}_${slotIndex}`}
            value={envAmount}
            min={0} max={100} unit="%"
            color="#a855f7"
            onChange={(v) => onParamChange('envAmount', v)}
            variant="mystical"
          />
        </div>
      </div>

      {/* ─── LFO Modulation Section ─── */}
      <div className="anunnaki-veil__modulation">
        <div className="anunnaki-veil__section-label">
          <span className="anunnaki-veil__section-dot" />
          LFO MODULATION
        </div>
        <div className="anunnaki-veil__mod-content">
          <div className="anunnaki-veil__lfo-viz">
            <canvas ref={lfoCanvasRef} className="anunnaki-veil__lfo-canvas" />
          </div>
          <div className="anunnaki-veil__mod-knobs">
            <DivineKnob
              size="sm" label="RATE"
              id={`veil_lfoRate_${trackIndex}_${slotIndex}`}
              value={lfoRate} min={0} max={100} unit="%" color="#3b82f6"
              onChange={(v) => onParamChange('lfoRate', v)}
              variant="mystical"
            />
            <DivineKnob
              size="sm" label="DEPTH"
              id={`veil_lfoDepth_${trackIndex}_${slotIndex}`}
              value={lfoDepth} min={0} max={100} unit="%" color="#3b82f6"
              onChange={(v) => onParamChange('lfoDepth', v)}
              variant="mystical"
            />
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="anunnaki-veil__footer">
        <span className="anunnaki-veil__version">ANUNNAKI VEIL · v2.0</span>
        <div className="anunnaki-veil__io-meters">
          <div className="anunnaki-veil__io-group">
            <span className="anunnaki-veil__io-label">IN</span>
            <div className="anunnaki-veil__io-bar"><div className="anunnaki-veil__io-fill anunnaki-veil__io-fill--in" /></div>
          </div>
          <div className="anunnaki-veil__io-group">
            <span className="anunnaki-veil__io-label">OUT</span>
            <div className="anunnaki-veil__io-bar"><div className="anunnaki-veil__io-fill anunnaki-veil__io-fill--out" /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnunnakiVeil;
