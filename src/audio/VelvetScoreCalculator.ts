/**
 * VelvetScoreCalculator — Real-time audio quality metric calculation.
 * Analyzes the balance of the Four Anchors (Body, Soul, Air, Silk).
 * Returns a score from 0-100.
 */

export interface VelvetMetrics {
  body: number;  // 0-1
  soul: number;  // 0-1
  air: number;   // 0-1
  silk: number;  // 0-1 (coherence/correlation proxy)
  total: number; // 0-100
}

export class VelvetScoreCalculator {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private bufferLength: number;

  constructor(analyser: AnalyserNode) {
    this.analyser = analyser;
    this.bufferLength = analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
  }

  public calculate(sampleRate: number = 44100): VelvetMetrics {
    this.analyser.getByteFrequencyData(this.dataArray);

    const binFreq = (bin: number) => (bin * sampleRate) / (this.bufferLength * 2);

    let bodySum = 0;
    let bodyCount = 0;
    let soulSum = 0;
    let soulCount = 0;
    let airSum = 0;
    let airCount = 0;

    for (let i = 0; i < this.bufferLength; i++) {
      const freq = binFreq(i);
      const val = this.dataArray[i] / 255;

      if (freq >= 20 && freq < 200) {
        bodySum += val;
        bodyCount++;
      } else if (freq >= 200 && freq < 2000) {
        soulSum += val;
        soulCount++;
      } else if (freq >= 2000 && freq < 20000) {
        airSum += val;
        airCount++;
      }
    }

    const body = bodyCount > 0 ? bodySum / bodyCount : 0;
    const soul = soulCount > 0 ? soulSum / soulCount : 0;
    const air = airCount > 0 ? airSum / airCount : 0;

    // Silk is a proxy for "musicality" / spectral balance
    // We calculate it as the inverse of the deviation from an "ideal" curve
    const idealBody = 0.6;
    const idealSoul = 0.5;
    const idealAir = 0.4;
    
    const deviation = 
      Math.abs(body - idealBody) * 0.4 +
      Math.abs(soul - idealSoul) * 0.3 +
      Math.abs(air - idealAir) * 0.3;

    const silk = Math.max(0, 1 - deviation * 2);

    // Total score calculation (0-100)
    // We weight Soul and Silk higher for "God Realm" warmth
    const total = (
      body * 0.2 +
      soul * 0.3 +
      air * 0.2 +
      silk * 0.3
    ) * 100;

    return {
      body,
      soul,
      air,
      silk,
      total: Math.min(100, Math.max(0, total))
    };
  }
}
