import React, { useRef, useEffect, useMemo } from 'react';

interface WaveformCanvasProps {
  buffer: AudioBuffer | null;
  chopMarkers: number[];
  draggingMarker: number | null;
  onMarkerMouseDown: (index: number) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  className?: string;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  buffer,
  chopMarkers,
  draggingMarker,
  onMarkerMouseDown,
  onMouseMove,
  onMouseUp,
  className = ""
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pre-calculate peaks
  const peaks = useMemo(() => {
    if (!buffer) return new Float32Array(0);
    
    const width = 1000; // Fixed resolution for calculation
    const data = buffer.getChannelData(0);
    const step = Math.floor(data.length / width);
    const result = new Float32Array(width);
    
    for (let i = 0; i < width; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const val = Math.abs(data[i * step + j] || 0);
        if (val > max) max = val;
      }
      result[i] = max;
    }
    return result;
  }, [buffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    let animationFrameId: number;

    const render = () => {
      // Clear with motion trail
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, width, height);

      const drawPath = (color: string, blur: number, isMirror: boolean, jitterAmount: number, alpha: number = 1.0, lineWidth: number = 1.5) => {
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        
        for (let i = 0; i < width; i++) {
          const peak = peaks[i];
          const jitter = (Math.random() - 0.5) * peak * jitterAmount;
          const yOffset = peak * (height / 2 * 0.85) + jitter;
          const y = isMirror ? (height / 2) + yOffset : (height / 2) - yOffset;
          
          ctx.lineTo(i, y);
        }

        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lineWidth;
        ctx.shadowBlur = blur;
        ctx.shadowColor = color;
        ctx.globalCompositeOperation = 'screen';
        ctx.stroke();
      };

      // 1. Wide Amethyst Glow
      drawPath('#a855f7', 25, false, 8, 0.4, 2.5);
      drawPath('#a855f7', 25, true, 8, 0.4, 2.5);
      
      // 2. Magenta Energy
      drawPath('#d946ef', 15, false, 18, 0.6, 1.5);
      drawPath('#d946ef', 15, true, 18, 0.6, 1.5);
      
      // 3. Core Ember Lightning
      drawPath('#ff6600', 8, false, 40, 0.9, 1.2);
      drawPath('#ff6600', 8, true, 40, 0.9, 1.2);
      
      // 4. White Hot Center
      ctx.globalCompositeOperation = 'lighter';
      drawPath('#ffffff', 4, false, 12, 1.0, 0.8);
      drawPath('#ffffff', 4, true, 12, 1.0, 0.8);

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [peaks]);

  return (
    <div 
      className={`relative w-full h-full cursor-crosshair overflow-hidden ${className}`}
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <canvas 
        ref={canvasRef}
        width={1000}
        height={300}
        className="w-full h-full p-4 object-fill pointer-events-none"
      />

      {/* Slice Markers */}
      <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" preserveAspectRatio="none">
        {chopMarkers.map((pos: number, i: number) => (
          <g 
            key={i} 
            className="cursor-ew-resize group/marker pointer-events-auto"
            onMouseDown={(e) => { e.stopPropagation(); onMarkerMouseDown(i); }}
          >
            {/* Glow Line */}
            <line 
              x1={`${pos * 100}%`} y1="0" x2={`${pos * 100}%`} y2="100%" 
              stroke={draggingMarker === i ? "#ff6600" : "#a855f7"} 
              strokeWidth={draggingMarker === i ? "3" : "1.5"}
              strokeOpacity={0.8}
              className="transition-all"
              style={{ filter: `drop-shadow(0 0 8px ${draggingMarker === i ? "#ff6600" : "#a855f7"})` }}
            />
            
            {/* Marker Handle */}
            <rect 
              x={`calc(${pos * 100}% - 14px)`} y="calc(100% - 32px)" width="28" height="24" rx="6" 
              fill={draggingMarker === i ? "#ff6600" : "rgba(20,10,40,0.95)"}
              stroke={draggingMarker === i ? "#ffaa00" : "#a855f7"}
              strokeWidth="1.5"
              className="transition-all shadow-xl"
            />
            
            <text 
              x={`${pos * 100}%`} y="calc(100% - 16px)" textAnchor="middle" 
              className="text-[12px] font-black fill-white pointer-events-none select-none uppercase tracking-tighter"
            >
              {i + 1}
            </text>

            {/* Top Indicator */}
            <circle 
              cx={`${pos * 100}%`} cy="10" r="4"
              fill={draggingMarker === i ? "#ff6600" : "#a855f7"}
              className="transition-all"
              style={{ filter: `drop-shadow(0 0 4px ${draggingMarker === i ? "#ff6600" : "#a855f7"})` }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};
