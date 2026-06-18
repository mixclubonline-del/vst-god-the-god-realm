import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { PluginComponentProps } from './pluginRegistry';
import { DivineKnob } from '../ui/DivineKnob';
import './AnunnakiThrone.css';

/* ═══════════════════════════════════════════════════════════════
   ANUNNAKI THRONE — Divine Dynamics Compressor
   Hybrid design: VU needle hero + compression curve + character modes
   ═══════════════════════════════════════════════════════════════ */

type CompMode = 'optical' | 'vca' | 'fet' | 'varimu';

const MODES: { key: CompMode; label: string; color: string }[] = [
  { key: 'optical', label: 'OPTICAL', color: '#d4a853' },
  { key: 'vca',     label: 'VCA',     color: '#b4bed2' },
  { key: 'fet',     label: 'FET',     color: '#ef4444' },
  { key: 'varimu',  label: 'VARI-MU', color: '#a855f7' },
];

const PRESETS = [
  { name: 'Init', params: { threshold: -20, ratio: 40, attack: 30, release: 40, makeup: 50, mix: 100, character: 0 } },
  { name: 'Vocal Throne', params: { threshold: -18, ratio: 30, attack: 40, release: 50, makeup: 55, mix: 100, character: 0 } },
  { name: 'Drum Crush', params: { threshold: -12, ratio: 80, attack: 10, release: 20, makeup: 60, mix: 100, character: 2 } },
  { name: 'Bus Glue', params: { threshold: -24, ratio: 20, attack: 60, release: 60, makeup: 52, mix: 50, character: 3 } },
  { name: '808 Pump', params: { threshold: -16, ratio: 60, attack: 5, release: 15, makeup: 55, mix: 100, character: 1 } },
  { name: 'Master Limiter', params: { threshold: -6, ratio: 100, attack: 0, release: 30, makeup: 56, mix: 100, character: 1 } },
  { name: 'Lo-Fi Squeeze', params: { threshold: -30, ratio: 70, attack: 50, release: 70, makeup: 65, mix: 60, character: 0 } },
];

/* ═══ Utility: map 0-100 param to real dB/ms values ═══ */
const paramToThreshDB  = (v: number) => -60 + v * 0.6;              // 0→-60dB, 100→0dB
const paramToRatioDsp  = (v: number) => 1 + (v / 100) * 19;         // 0→1:1, 100→20:1
const paramToAttackMs  = (v: number) => 0.01 + (v / 100) * 99.99;   // 0→0.01ms, 100→100ms
const paramToReleaseMs = (v: number) => 10 + (v / 100) * 1990;      // 0→10ms, 100→2000ms
const paramToMakeupDB  = (v: number) => -12 + (v / 100) * 36;       // 0→-12dB, 100→+24dB

/* ═══ Format display values ═══ */
const fmtThresh  = (v: number) => `${paramToThreshDB(v).toFixed(1)} dB`;
const fmtRatio   = (v: number) => { const r = paramToRatioDsp(v); return r >= 19.5 ? '∞:1' : `${r.toFixed(1)}:1`; };
const fmtAttack  = (v: number) => { const ms = paramToAttackMs(v); return ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : `${ms.toFixed(1)} ms`; };
const fmtRelease = (v: number) => { const ms = paramToReleaseMs(v); return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(0)} ms`; };
const fmtMakeup  = (v: number) => { const db = paramToMakeupDB(v); return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`; };

const AnunnakiThrone: React.FC<PluginComponentProps> = ({
  trackIndex, slotIndex, params, onParamChange, bypassed, trackColor,
}) => {
  const vuCanvasRef = useRef<HTMLCanvasElement>(null);
  const curveCanvasRef = useRef<HTMLCanvasElement>(null);
  const needleAngleRef = useRef(0);
  const needleVelocityRef = useRef(0);
  const animFrameRef = useRef(0);
  const [selectedPreset, setSelectedPreset] = useState(0);

  // ── Extract params with defaults ──
  const threshold = Math.min(100, Math.max(0, params.threshold ?? 33));  // ~-20dB default
  const ratio     = Math.min(100, Math.max(0, params.ratio ?? 40));      // ~4:1
  const attack    = Math.min(100, Math.max(0, params.attack ?? 30));
  const release   = Math.min(100, Math.max(0, params.release ?? 40));
  const makeup    = Math.min(100, Math.max(0, params.makeup ?? 50));
  const mix       = Math.min(100, Math.max(0, params.mix ?? 100));
  const character = Math.min(3, Math.max(0, Math.round(params.character ?? 0)));

  const threshDB = paramToThreshDB(threshold);
  const ratioDsp = paramToRatioDsp(ratio);
  const activeMode = MODES[character] ?? MODES[0];

  /* ═══ Simulated gain reduction (visual only — real DSP in audio engine) ═══ */
  const simulatedGR = useMemo(() => {
    // Simulate gain reduction based on threshold/ratio for visual feedback
    // In reality this would come from the audio engine's envelope follower
    const inputLevel = -12; // simulated average input level dB
    if (inputLevel > threshDB) {
      const excess = inputLevel - threshDB;
      return -(excess - excess / ratioDsp);
    }
    return 0;
  }, [threshDB, ratioDsp]);

  /* ═══════════════════════════════════════════
     VU NEEDLE CANVAS — The Hero
     ═══════════════════════════════════════════ */
  const drawVU = useCallback(() => {
    const canvas = vuCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width * dpr;
    const h = rect.height * dpr;
    canvas.width = w;
    canvas.height = h;
    ctx.scale(dpr, dpr);
    const cw = rect.width;
    const ch = rect.height;

    ctx.clearRect(0, 0, cw, ch);

    // ── VU Meter Face Background ──
    const centerX = cw / 2;
    const centerY = ch - 8;
    const radius = Math.min(cw / 2 - 20, ch - 24);

    // Amber backlight glow (intensifies with compression)
    const glowIntensity = Math.min(1, Math.abs(simulatedGR) / 20);
    const backGlow = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius);
    backGlow.addColorStop(0, `rgba(212, 168, 83, ${0.03 + glowIntensity * 0.08})`);
    backGlow.addColorStop(0.6, `rgba(212, 168, 83, ${0.01 + glowIntensity * 0.03})`);
    backGlow.addColorStop(1, 'rgba(10, 10, 15, 0)');
    ctx.fillStyle = backGlow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 0);
    ctx.fill();

    // ── Tick marks and labels (-30 to 0 dB) ──
    const dbValues = [-30, -20, -15, -10, -5, -3, -1, 0];
    const startAngle = Math.PI;  // left side (180°)
    const totalSweep = Math.PI;  // 180° sweep

    dbValues.forEach(db => {
      // Map dB to angle: -30dB → left (π), 0dB → right (2π)
      const t = (db + 30) / 30;
      const angle = startAngle + t * totalSweep; 
      const isMajor = db === -30 || db === -20 || db === -10 || db === -5 || db === 0;
      const tickLen = isMajor ? 14 : 8;

      const innerR = radius - tickLen;
      const outerR = radius - 2;

      ctx.strokeStyle = `rgba(212, 168, 83, ${isMajor ? 0.6 : 0.3})`;
      ctx.lineWidth = isMajor ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * innerR, centerY + Math.sin(angle) * innerR);
      ctx.lineTo(centerX + Math.cos(angle) * outerR, centerY + Math.sin(angle) * outerR);
      ctx.stroke();

      // Labels for major ticks
      if (isMajor) {
        const labelR = radius - 24;
        const lx = centerX + Math.cos(angle) * labelR;
        const ly = centerY + Math.sin(angle) * labelR;
        ctx.fillStyle = `rgba(212, 168, 83, 0.5)`;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${db}`, lx, ly);
      }
    });

    // Draw connecting arc for the ticks
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 2, startAngle, startAngle + totalSweep);
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── The VU Needle ──
    const targetGR = Math.max(-30, Math.min(0, simulatedGR));
    const targetT = (targetGR + 30) / 30;
    const targetAngle = startAngle + targetT * totalSweep;

    // Spring physics for smooth overshoot
    const springK = 0.08;
    const damp = 0.85;
    const force = targetAngle - needleAngleRef.current;
    needleVelocityRef.current = (needleVelocityRef.current + force * springK) * damp;
    needleAngleRef.current += needleVelocityRef.current;

    const needleAngle = needleAngleRef.current;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    const nx = centerX + Math.cos(needleAngle) * (radius - 4);
    const ny = centerY + Math.sin(needleAngle) * (radius - 4);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // ── Digital Readout ──
    ctx.fillStyle = '#d4a853';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${simulatedGR.toFixed(1)} dB`, centerX, centerY - 30);
  }, [simulatedGR]);

  /* ═══════════════════════════════════════════
     COMPRESSION CURVE CANVAS
     ═══════════════════════════════════════════ */
  const drawCurve = useCallback(() => {
    const canvas = curveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width * dpr;
    const h = rect.height * dpr;
    canvas.width = w;
    canvas.height = h;
    ctx.scale(dpr, dpr);
    const cw = rect.width;
    const ch = rect.height;

    ctx.clearRect(0, 0, cw, ch);

    const pad = 8;
    const plotW = cw - pad * 2;
    const plotH = ch - pad * 2;

    // ── Grid ──
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 6; i++) {
      const x = pad + (plotW / 6) * i;
      const y = pad + (plotH / 6) * i;
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + plotH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + plotW, y); ctx.stroke();
    }

    // ── 1:1 reference line ──
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.1)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pad, pad + plotH);
    ctx.lineTo(pad + plotW, pad);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Compression transfer curve ──
    const dbMin = -60;
    const dbMax = 0;
    const dbRange = dbMax - dbMin;
    const kneeDB = 6; // soft knee width

    const inputToOutput = (inputDB: number): number => {
      if (inputDB <= threshDB - kneeDB / 2) {
        return inputDB; // below threshold — unity gain
      } else if (inputDB >= threshDB + kneeDB / 2) {
        return threshDB + (inputDB - threshDB) / ratioDsp; // above threshold — compressed
      } else {
        // Soft knee region
        const x = inputDB - threshDB + kneeDB / 2;
        return inputDB + ((1 / ratioDsp - 1) * x * x) / (2 * kneeDB);
      }
    };

    // Draw the curve
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const inputDB = dbMin + (px / plotW) * dbRange;
      const outputDB = inputToOutput(inputDB);
      const oy = pad + plotH - ((outputDB - dbMin) / dbRange) * plotH;
      if (px === 0) ctx.moveTo(pad + px, oy);
      else ctx.lineTo(pad + px, oy);
    }

    // Gradient fill under curve
    const gradient = ctx.createLinearGradient(0, pad, 0, pad + plotH);
    gradient.addColorStop(0, `rgba(${activeMode.key === 'fet' ? '239, 68, 68' : activeMode.key === 'varimu' ? '168, 85, 247' : activeMode.key === 'vca' ? '180, 190, 210' : '212, 168, 83'}, 0.1)`);
    gradient.addColorStop(1, 'rgba(10, 10, 15, 0)');
    ctx.lineTo(pad + plotW, pad + plotH);
    ctx.lineTo(pad, pad + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke the curve
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const inputDB = dbMin + (px / plotW) * dbRange;
      const outputDB = inputToOutput(inputDB);
      const oy = pad + plotH - ((outputDB - dbMin) / dbRange) * plotH;
      if (px === 0) ctx.moveTo(pad + px, oy);
      else ctx.lineTo(pad + px, oy);
    }
    ctx.strokeStyle = activeMode.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Threshold marker ──
    const threshX = pad + ((threshDB - dbMin) / dbRange) * plotW;
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(threshX, pad);
    ctx.lineTo(threshX, pad + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Threshold label
    ctx.fillStyle = 'rgba(212, 168, 83, 0.5)';
    ctx.font = '8px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${threshDB.toFixed(0)} dB`, threshX, pad + plotH + 2);

    // ── Operating point (simulated) ──
    const opInputDB = -12;
    const opOutputDB = inputToOutput(opInputDB);
    const opX = pad + ((opInputDB - dbMin) / dbRange) * plotW;
    const opY = pad + plotH - ((opOutputDB - dbMin) / dbRange) * plotH;

    ctx.fillStyle = activeMode.color;
    ctx.beginPath();
    ctx.arc(opX, opY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `${activeMode.color}40`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(opX, opY, 4, 0, Math.PI * 2);
    ctx.stroke();

    // ── Axis labels ──
    ctx.fillStyle = 'rgba(212, 168, 83, 0.25)';
    ctx.font = '7px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('INPUT', cw / 2, pad + plotH + 10);
    ctx.save();
    ctx.translate(6, ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('OUTPUT', 0, 0);
    ctx.restore();
  }, [threshDB, ratioDsp, activeMode]);

  /* ═══ VU Animation Loop (needs to be animated for needle physics) ═══ */
  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;
      drawVU();
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [drawVU]);

  /* ═══ Compression curve redraws on param change only ═══ */
  useEffect(() => {
    drawCurve();
  }, [drawCurve]);

  /* ═══ Preset navigation ═══ */
  const handlePresetPrev = () => setSelectedPreset(p => (p - 1 + PRESETS.length) % PRESETS.length);
  const handlePresetNext = () => setSelectedPreset(p => (p + 1) % PRESETS.length);

  const handlePresetApply = useCallback((idx: number) => {
    const preset = PRESETS[idx];
    if (!preset) return;
    Object.entries(preset.params).forEach(([key, val]) => {
      onParamChange(key, val);
    });
  }, [onParamChange]);

  useEffect(() => {
    handlePresetApply(selectedPreset);
  }, [selectedPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══ Mode change ═══ */
  const handleModeChange = (mode: CompMode) => {
    const idx = MODES.findIndex(m => m.key === mode);
    if (idx >= 0) onParamChange('character', idx);
  };

  /* ═══ I/O Meter heights (simulated) ═══ */
  const inputLevel = 70;  // simulated — would come from audio engine
  const outputLevel = Math.max(0, inputLevel + simulatedGR * (100 / 60) + paramToMakeupDB(makeup) * (100 / 36));

  return (
    <div className="anunnaki-throne">
      {/* ── Preset Bar ── */}
      <div className="anunnaki-throne__preset-bar">
        <span className="anunnaki-throne__preset-name">
          <span className="anunnaki-throne__preset-diamond">◆</span>
          {PRESETS[selectedPreset]?.name ?? 'Init'}
        </span>
        <div className="anunnaki-throne__preset-nav">
          <button className="anunnaki-throne__preset-arrow" onClick={handlePresetPrev}>◀</button>
          <button className="anunnaki-throne__preset-arrow" onClick={handlePresetNext}>▶</button>
        </div>
      </div>

      {/* ── VU Needle Hero ── */}
      <div className="anunnaki-throne__vu-section">
        <canvas ref={vuCanvasRef} className="anunnaki-throne__vu-canvas" />
        <span className="anunnaki-throne__vu-label">GAIN REDUCTION</span>
      </div>

      {/* ── Compression Curve ── */}
      <div className="anunnaki-throne__curve-section">
        <canvas ref={curveCanvasRef} className="anunnaki-throne__curve-canvas" />
      </div>

      {/* ── Compression Character Mode Selector ── */}
      <div className="anunnaki-throne__mode-selector">
        {MODES.map((mode) => (
          <button
            key={mode.key}
            className={`anunnaki-throne__mode-btn anunnaki-throne__mode-btn--${mode.key} ${character === MODES.indexOf(mode) ? 'anunnaki-throne__mode-btn--active' : ''}`}
            style={{ '--mode-color': mode.color } as React.CSSProperties}
            onClick={() => handleModeChange(mode.key)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* ── Controls: Meters + Knobs ── */}
      <div className="anunnaki-throne__controls-row">
        {/* Input Meter */}
        <div className="anunnaki-throne__meter">
          <div className="anunnaki-throne__meter-track">
            <div className="anunnaki-throne__meter-fill" style={{ height: `${inputLevel}%` }} />
          </div>
          <span className="anunnaki-throne__meter-label">IN</span>
        </div>

        {/* Knob Row */}
        <div className="anunnaki-throne__controls">
          <div className="anunnaki-throne__knob-hero">
            <DivineKnob
              size="lg"
              label="THRESH"
              id={`throne_thresh_${trackIndex}_${slotIndex}`}
              value={threshold}
              min={0} max={100}
              onChange={v => onParamChange('threshold', v)}
              color="#d4a853"
              valueDisplay={fmtThresh(threshold)}
              showValue
            />
          </div>
          <DivineKnob
            size="md"
            label="RATIO"
            id={`throne_ratio_${trackIndex}_${slotIndex}`}
            value={ratio}
            min={0} max={100}
            onChange={v => onParamChange('ratio', v)}
            color="#d4a853"
            valueDisplay={fmtRatio(ratio)}
            showValue
          />
          <DivineKnob
            size="md"
            label="ATTACK"
            id={`throne_attack_${trackIndex}_${slotIndex}`}
            value={attack}
            min={0} max={100}
            onChange={v => onParamChange('attack', v)}
            color="#ef4444"
            valueDisplay={fmtAttack(attack)}
            showValue
          />
          <DivineKnob
            size="md"
            label="RELEASE"
            id={`throne_release_${trackIndex}_${slotIndex}`}
            value={release}
            min={0} max={100}
            onChange={v => onParamChange('release', v)}
            color="#3b82f6"
            valueDisplay={fmtRelease(release)}
            showValue
          />
          <DivineKnob
            size="md"
            label="GAIN"
            id={`throne_makeup_${trackIndex}_${slotIndex}`}
            value={makeup}
            min={0} max={100}
            onChange={v => onParamChange('makeup', v)}
            color="#10b981"
            valueDisplay={fmtMakeup(makeup)}
            showValue
          />
          <DivineKnob
            size="sm"
            label="MIX"
            id={`throne_mix_${trackIndex}_${slotIndex}`}
            value={mix}
            min={0} max={100}
            onChange={v => onParamChange('mix', v)}
            color="#d4a853"
            unit="%"
            showValue
          />
        </div>

        {/* Output Meter */}
        <div className="anunnaki-throne__meter">
          <div className="anunnaki-throne__meter-track">
            <div className="anunnaki-throne__meter-fill" style={{ height: `${Math.max(0, Math.min(100, outputLevel))}%` }} />
          </div>
          <span className="anunnaki-throne__meter-label">OUT</span>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="anunnaki-throne__footer">
        <span>ANUNNAKI THRONE · v1.0</span>
        <span>ANUNNAKI DSP</span>
      </div>
    </div>
  );
};

export default AnunnakiThrone;
