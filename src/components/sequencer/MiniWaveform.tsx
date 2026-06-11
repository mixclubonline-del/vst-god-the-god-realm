/**
 * MiniWaveform — Canvas-based waveform preview for sample tracks.
 * Renders a compact waveform visualization from an AudioBuffer.
 */
import React, { useRef, useEffect, useCallback, useMemo } from 'react';

interface MiniWaveformProps {
  /** AudioBuffer to visualize (null = no sample loaded) */
  buffer: AudioBuffer | null;
  /** Track color for waveform fill */
  color: string;
  /** Width of the canvas */
  width?: number;
  /** Height of the canvas */
  height?: number;
  /** Sample start position (0-1) */
  sampleStart?: number;
  /** Sample end position (0-1) */
  sampleEnd?: number;
  /** Whether the track is playing */
  isPlaying?: boolean;
  /** Current playback position (0-1) */
  playbackPosition?: number;
}

/**
 * Extract peak data from an AudioBuffer for waveform rendering.
 * Returns an array of [min, max] pairs for each pixel column.
 */
function extractPeaks(buffer: AudioBuffer, numBuckets: number): [number, number][] {
  const channel = buffer.getChannelData(0); // mono or first channel
  const samplesPerBucket = Math.floor(channel.length / numBuckets);
  const peaks: [number, number][] = [];

  for (let i = 0; i < numBuckets; i++) {
    const start = i * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, channel.length);
    let min = 1.0;
    let max = -1.0;
    for (let j = start; j < end; j++) {
      const sample = channel[j];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    peaks.push([min, max]);
  }

  return peaks;
}

export const MiniWaveform: React.FC<MiniWaveformProps> = React.memo(({
  buffer,
  color,
  width = 120,
  height = 28,
  sampleStart = 0,
  sampleEnd = 1,
  isPlaying = false,
  playbackPosition = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Memoize peak extraction (expensive operation)
  const peaks = useMemo(() => {
    if (!buffer) return null;
    return extractPeaks(buffer, width);
  }, [buffer, width]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    const mid = height / 2;
    const startCol = Math.floor(sampleStart * peaks.length);
    const endCol = Math.floor(sampleEnd * peaks.length);

    // Draw waveform
    for (let i = 0; i < peaks.length; i++) {
      const [min, max] = peaks[i];
      const isInRange = i >= startCol && i <= endCol;

      if (isInRange) {
        // Active region — full color
        ctx.fillStyle = color + 'B3'; // 70% opacity
      } else {
        // Outside region — dimmed
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
      }

      const top = mid - max * mid * 0.85;
      const bottom = mid - min * mid * 0.85;
      ctx.fillRect(i, top, 1, Math.max(1, bottom - top));
    }

    // Draw start/end markers
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    // Start marker
    const sx = startCol;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();

    // End marker
    const ex = endCol;
    ctx.beginPath();
    ctx.moveTo(ex, 0);
    ctx.lineTo(ex, height);
    ctx.stroke();

    ctx.setLineDash([]);

    // Playback position indicator
    if (isPlaying && playbackPosition > 0) {
      const px = Math.floor(playbackPosition * peaks.length);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }

    // Subtle center line
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();
  }, [peaks, width, height, color, sampleStart, sampleEnd, isPlaying, playbackPosition]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!buffer) {
    return (
      <div
        className="seq-waveform seq-waveform--empty"
        style={{ width, height }}
      >
        <span className="seq-waveform__empty-label">Drop sample</span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="seq-waveform"
      style={{ width, height }}
      title={`${buffer.duration.toFixed(2)}s · ${buffer.sampleRate}Hz · ${buffer.numberOfChannels}ch`}
    />
  );
});

MiniWaveform.displayName = 'MiniWaveform';
