import React, { useState, useRef, useEffect, useCallback } from 'react';

interface GodRealmSampleChopperProps {
  activePad: number;
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
}

export const GodRealmSampleChopper: React.FC<GodRealmSampleChopperProps> = ({
  activePad,
  parameterValues,
  update
}) => {
  const [draggingMarker, setDraggingMarker] = useState<number | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const chopMarkers = parameterValues.chopMarkers || [0.25, 0.5, 0.75];
  const snapToTransient = parameterValues.snapToTransient ?? true;
  const scopeGlobal = parameterValues.scopeGlobal ?? true;
  const chopMode = parameterValues.chopMode || 'Auto';

  const speed = parameterValues.chopperSpeed ?? 1.0;
  const pitch = parameterValues.chopperPitch ?? 0;
  const fadeIn = parameterValues.chopperFadeIn ?? 25;
  const fadeOut = parameterValues.chopperFadeOut ?? 150;
  const glide = parameterValues.chopperGlide ?? 10;
  const isReverse = parameterValues.chopperReverse ?? false;

  const sensitivity = parameterValues.chopperSensitivity ?? 50;
  const triggerMode = parameterValues.chopperTrigger ?? 'MIDI';
  const dryWet = parameterValues.chopperDryWet ?? 75;
  const outputVolume = parameterValues.chopperOutputVolume ?? -3;

  // Render Lightning Waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    let animationFrameId: number;

    const width = canvas.width;
    const height = canvas.height;
    
    // Mock peaks for visuals since native buffer sharing isn't built yet
    const peaks = new Float32Array(width);
    for (let i = 0; i < width; i++) {
      peaks[i] = Math.random() * 0.5 + 0.1; // random base level
    }

    const renderWaveform = () => {
      // Clear with slight opacity to create motion trails
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);

      // Draw dual glowing paths with variable jitter and alpha
      const drawPath = (color: string, blur: number, isMirror: boolean, jitterAmount: number, alpha: number = 1.0, widthOverride: number = 1.5) => {
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        
        for (let i = 0; i < width; i++) {
          const peak = peaks[i];
          // Add volatile jitter for lightning effect
          const jitter = (Math.random() - 0.5) * peak * jitterAmount;
          const yOffset = peak * (height / 2 * 0.8) + jitter; // Scaled slightly to contain wild jitter
          const y = isMirror ? (height / 2) + yOffset : (height / 2) - yOffset;
          
          ctx.lineTo(i, y);
        }

        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = widthOverride;
        ctx.shadowBlur = blur;
        ctx.shadowColor = color;
        ctx.globalCompositeOperation = 'screen';
        ctx.stroke();
      };

      // Base Amethyst Glow (Wide bloom, slow pulse)
      drawPath('#a855f7', 20, false, 5, 0.6, 2.0);
      drawPath('#a855f7', 20, true, 5, 0.6, 2.0);
      
      // Secondary Magenta/Orange Blend
      drawPath('#d946ef', 12, false, 15, 0.8, 1.5);
      drawPath('#d946ef', 12, true, 15, 0.8, 1.5);
      
      // Core Ember Lightning (High volatility, sharp arcs)
      drawPath('#ff6600', 6, false, 35, 1.0, 1.0);
      drawPath('#ff6600', 6, true, 35, 1.0, 1.0);
      
      // Additional super-bright white core
      ctx.globalCompositeOperation = 'lighter';
      drawPath('#ffffff', 3, false, 8, 1.0, 0.8);
      drawPath('#ffffff', 3, true, 8, 1.0, 0.8);

      animationFrameId = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();

    return () => cancelAnimationFrame(animationFrameId);
  }, [activePad]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingMarker === null || !waveformRef.current) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let pos = Math.max(0, Math.min(1, x / rect.width));
    
    // TODO: Implement snap to transient with native backend
    
    const nextMarkers = [...chopMarkers];
    nextMarkers[draggingMarker] = pos;
    update('chopMarkers', nextMarkers);
  }, [draggingMarker, chopMarkers, snapToTransient, activePad, update]);

  const handleMouseUp = useCallback(() => {
    setDraggingMarker(null);
  }, []);

  return (
    <div className="vg-panel vg-chopper animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <div className="vg-section-head flex justify-between items-center shrink-0">
        <span className="text-xl font-bold tracking-[0.2em] text-[#e0d6ff] shadow-sm uppercase">Divine Sample Chopper</span>
        <div className="flex gap-4 items-center">
          <div className="text-[10px] font-mono text-[#a88cff] uppercase tracking-wider">Mode: {chopMode} Detection</div>
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_#ff6600]" />
        </div>
      </div>

      <div className="flex-1 bg-black/80 rounded-xl border border-[#3a2b5c] relative group/chopper overflow-hidden mt-3 shadow-[inset_0_0_40px_rgba(40,20,80,0.5)]">
        {/* Cinematic Waveform */}
        <div 
          className="absolute inset-0 cursor-crosshair"
          ref={waveformRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas 
            ref={canvasRef}
            width={1000}
            height={300}
            className="w-full h-full p-6 object-fill"
          />

          {/* Slice Markers */}
          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" preserveAspectRatio="none">
            {chopMarkers.map((pos: number, i: number) => (
              <g 
                key={i} 
                className="cursor-ew-resize group/marker pointer-events-auto"
                onMouseDown={(e) => { e.stopPropagation(); setDraggingMarker(i); }}
              >
                <line 
                  x1={`${pos * 100}%`} y1="0" x2={`${pos * 100}%`} y2="100%" 
                  stroke={draggingMarker === i ? "#ff6600" : "#a855f7"} 
                  strokeWidth={draggingMarker === i ? "2" : "1"}
                  strokeOpacity={0.6}
                  className="transition-colors"
                />
                <rect 
                  x={`calc(${pos * 100}% - 12px)`} y="calc(100% - 30px)" width="24" height="20" rx="4" 
                  fill={draggingMarker === i ? "#ff6600" : "rgba(20,10,40,0.9)"}
                  stroke={draggingMarker === i ? "#ffaa00" : "#a855f7"}
                  strokeWidth="1"
                  className="transition-all shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                />
                <text 
                  x={`${pos * 100}%`} y="calc(100% - 16px)" textAnchor="middle" 
                  className="text-[11px] font-black fill-white pointer-events-none"
                >
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Control Panel - Middle Rail */}
      <div className="h-28 flex items-center justify-between px-6 mt-4 bg-gradient-to-b from-[#1a103c] to-black rounded-xl border border-[#3a2b5c] shadow-lg shrink-0">
        
        {/* Toggles */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-[#a88cff] uppercase tracking-wider w-16">Scope</span>
            <div className="flex items-center bg-black/50 p-1 rounded-full border border-[#3a2b5c]">
              <button 
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${scopeGlobal ? 'bg-[#a855f7] text-white shadow-[0_0_10px_#a855f7]' : 'text-white/40 hover:text-white/80'}`}
                onClick={() => update('scopeGlobal', true)}
              >
                Global
              </button>
              <button 
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${!scopeGlobal ? 'bg-[#ff6600] text-white shadow-[0_0_10px_#ff6600]' : 'text-white/40 hover:text-white/80'}`}
                onClick={() => update('scopeGlobal', false)}
              >
                Slice
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-[#a88cff] uppercase tracking-wider w-16">Snap</span>
            <button 
              className={`w-12 h-6 rounded-full border relative transition-all ${snapToTransient ? 'bg-[#ff6600]/20 border-[#ff6600]' : 'bg-black/50 border-[#3a2b5c]'}`}
              onClick={() => update('snapToTransient', !snapToTransient)}
            >
              <div className={`absolute top-[2px] w-4 h-4 rounded-full transition-all ${snapToTransient ? 'bg-[#ff6600] left-[26px] shadow-[0_0_8px_#ff6600]' : 'bg-white/30 left-[2px]'}`} />
            </button>
          </div>
        </div>

        <div className="w-px h-16 bg-gradient-to-b from-transparent via-[#3a2b5c] to-transparent mx-2" />

        {/* Rotary Knobs */}
        <div className="flex gap-8">
          <Knob label="Speed" value={speed} min={0.25} max={2.0} unit="x" update={update} paramKey="chopperSpeed" color="#a855f7" />
          <Knob label="Fade In" value={fadeIn} min={0} max={500} unit="ms" update={update} paramKey="chopperFadeIn" color="#ff6600" />
          <Knob label="Fade Out" value={fadeOut} min={0} max={1000} unit="ms" update={update} paramKey="chopperFadeOut" color="#ff6600" />
          <Knob label="Pitch" value={pitch} min={-24} max={24} unit="st" update={update} paramKey="chopperPitch" color="#a855f7" displayValue={pitch > 0 ? `+${pitch}` : `${pitch}`} />
          <Knob label="Glide" value={glide} min={0} max={200} unit="ms" update={update} paramKey="chopperGlide" color="#a855f7" />
        </div>

        <div className="w-px h-16 bg-gradient-to-b from-transparent via-[#3a2b5c] to-transparent mx-2" />

        {/* Reverse Button */}
        <button 
          className={`px-6 py-3 rounded-lg border font-bold text-xs uppercase tracking-widest transition-all ${isReverse ? 'bg-[#ff6600]/20 border-[#ff6600] text-[#ff6600] shadow-[0_0_15px_rgba(255,102,0,0.3)]' : 'bg-black/50 border-[#3a2b5c] text-white/50 hover:border-[#a855f7]/50'}`}
          onClick={() => update('chopperReverse', !isReverse)}
        >
          Reverse
        </button>

      </div>

      {/* Bottom Rail */}
      <div className="h-16 flex items-center justify-between px-6 mt-3 bg-[#0d071d] rounded-xl border border-[#2a1b4c] shrink-0">
        
        <div className="flex gap-6 items-center">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-[#a88cff] uppercase tracking-widest">Chop Mode</span>
            <div className="flex bg-black/50 border border-[#2a1b4c] rounded">
              {['Manual', 'Auto', 'Grid'].map(m => (
                <button 
                  key={m}
                  className={`px-3 py-1 text-[10px] uppercase font-bold transition-colors ${chopMode === m ? 'bg-[#3a2b5c] text-white' : 'text-white/40 hover:text-white/80'}`}
                  onClick={() => update('chopMode', m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col gap-1 w-32">
            <span className="text-[9px] font-black text-[#a88cff] uppercase tracking-widest">Sensitivity</span>
            <input type="range" className="w-full accent-[#ff6600]" min={0} max={100} value={sensitivity} onChange={(e) => update('chopperSensitivity', +e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-[#a88cff] uppercase tracking-widest">Trigger</span>
            <select 
              className="bg-black/50 border border-[#2a1b4c] rounded px-3 py-1 text-[10px] text-white uppercase font-bold outline-none"
              value={triggerMode}
              onChange={(e) => update('chopperTrigger', e.target.value)}
            >
              <option value="MIDI">MIDI</option>
              <option value="Gate">Gate</option>
              <option value="OneShot">One-Shot</option>
            </select>
          </div>
        </div>

        <div className="flex gap-8 items-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-black text-[#a88cff] uppercase tracking-widest">Dry/Wet</span>
            <div className="flex items-center gap-2">
              <input type="range" className="w-16 accent-[#a855f7]" min={0} max={100} value={dryWet} onChange={(e) => update('chopperDryWet', +e.target.value)} />
              <span className="text-[10px] text-white w-8">{dryWet}%</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-black text-[#a88cff] uppercase tracking-widest">Output Volume</span>
            <div className="flex items-center gap-2">
              <input type="range" className="w-24 accent-[#a855f7]" min={-24} max={12} value={outputVolume} onChange={(e) => update('chopperOutputVolume', +e.target.value)} />
              <span className="text-[10px] text-white w-8">{outputVolume > 0 ? `+${outputVolume}` : outputVolume}dB</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// Internal Knob Component mirroring the style
const Knob = ({ label, value, min, max, unit, update, paramKey, color, displayValue }: any) => {
  const rotation = -135 + ((value - min) / (max - min)) * 270;
  return (
    <div className="flex flex-col items-center gap-2 relative">
      <div className="w-12 h-12 rounded-full border-2 border-[#2a1b4c] relative bg-[#1a103c] shadow-inner flex items-center justify-center">
        <div 
          className="absolute w-full h-full rounded-full"
          style={{
            background: `conic-gradient(from 225deg, ${color} ${((value - min) / (max - min)) * 270}deg, transparent 0)`,
            opacity: 0.3
          }}
        />
        <div 
          className="w-[2px] h-3 absolute top-1 rounded-full origin-[center_20px]"
          style={{ 
            backgroundColor: color, 
            transform: `rotate(${rotation}deg)`,
            boxShadow: `0 0 5px ${color}`
          }} 
        />
        <input 
          type="range" 
          className="absolute inset-0 opacity-0 cursor-ns-resize" 
          min={min} max={max} step={max - min > 10 ? 1 : 0.01}
          value={value} 
          onChange={(e) => update(paramKey, +e.target.value)} 
          style={{ writingMode: 'vertical-lr' } as any}
        />
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-bold text-[#e0d6ff] tracking-wider uppercase">{label}</span>
        <span className="text-[9px] text-[#a88cff] font-mono">{displayValue !== undefined ? displayValue : value}{unit}</span>
      </div>
    </div>
  );
};
