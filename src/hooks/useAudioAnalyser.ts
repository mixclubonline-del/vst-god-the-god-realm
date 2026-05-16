import { useEffect, useRef, useState } from 'react';

interface AudioAnalysisData {
  energy: number; // 0 to 1
  peak: number;   // 0 to 1
}

/**
 * useAudioAnalyser — Bridges the Web Audio API with the CSS design system.
 * Injects real-time audio metrics into global CSS variables for UI reactivity.
 */
export function useAudioAnalyser(analyser: AnalyserNode | null): AudioAnalysisData {
  const [data, setData] = useState<AudioAnalysisData>({ energy: 0, peak: 0 });
  const requestRef = useRef<number>(undefined);
  
  useEffect(() => {
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate Average Energy (RMS)
      let sum = 0;
      let max = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i] / 255;
        sum += val * val;
        if (val > max) max = val;
      }
      
      const rms = Math.sqrt(sum / bufferLength);
      const energy = Math.min(1, rms * 5); // Scale for UI responsiveness
      const peak = max;

      setData({ energy, peak });

      // Inject into CSS Variables for global reactivity
      document.documentElement.style.setProperty('--divine-energy-level', energy.toFixed(3));
      document.documentElement.style.setProperty('--divine-peak-pulse', peak.toFixed(3));
      document.documentElement.style.setProperty('--divine-glow-intensity', (energy * 0.8 + peak * 0.2).toFixed(3));

      requestRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [analyser]);

  return data;
}
