/**
 * MasterMeter — High-fidelity stereo VU meter for mastering output.
 * Features:
 *  - Dual-channel vertical bars with gradient fill
 *  - Peak hold indicator with slow decay
 *  - Clip detection with red flash
 *  - dB scale markings
 *  - RMS readout display
 */
import React, { useRef, useEffect, useState, memo } from 'react';
import '@/styles/MasterMeter.css';

interface MasterMeterProps {
  left: number;   // 0.0 – 1.0+ (linear amplitude)
  right: number;  // 0.0 – 1.0+ (linear amplitude)
  height?: number; // px, default 200
}

// Convert linear amplitude to dB (clamped)
function linearToDb(linear: number): number {
  if (linear <= 0.0001) return -96;
  return Math.max(-96, 20 * Math.log10(linear));
}

// Convert dB to percentage for display (0dB = 100%, -48dB = 0%)
function dbToPercent(db: number): number {
  return Math.max(0, Math.min(100, ((db + 48) / 48) * 100));
}

const DB_MARKS = [0, -6, -12, -24, -48];

export const MasterMeter: React.FC<MasterMeterProps> = memo(({
  left,
  right,
  height = 200,
}) => {
  // Peak hold state
  const peakHoldL = useRef(0);
  const peakHoldR = useRef(0);
  const peakDecayTimer = useRef(0);
  const [peakL, setPeakL] = useState(0);
  const [peakR, setPeakR] = useState(0);
  const [clippingL, setClippingL] = useState(false);
  const [clippingR, setClippingR] = useState(false);
  const clipTimerL = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipTimerR = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update peak hold (decays at ~3dB/sec)
  useEffect(() => {
    const dbL = linearToDb(left);
    const dbR = linearToDb(right);
    const pctL = dbToPercent(dbL);
    const pctR = dbToPercent(dbR);

    // Update peak hold (sticky for ~1.5s, then decay)
    if (pctL >= peakHoldL.current) {
      peakHoldL.current = pctL;
      peakDecayTimer.current = 0;
    }
    if (pctR >= peakHoldR.current) {
      peakHoldR.current = pctR;
    }

    // Decay peaks
    peakDecayTimer.current++;
    if (peakDecayTimer.current > 45) { // ~1.5s at 30Hz
      peakHoldL.current = Math.max(0, peakHoldL.current - 1.5);
      peakHoldR.current = Math.max(0, peakHoldR.current - 1.5);
    }

    setPeakL(peakHoldL.current);
    setPeakR(peakHoldR.current);

    // Clip detection
    if (left >= 1.0) {
      setClippingL(true);
      if (clipTimerL.current) clearTimeout(clipTimerL.current);
      clipTimerL.current = setTimeout(() => setClippingL(false), 2000);
    }
    if (right >= 1.0) {
      setClippingR(true);
      if (clipTimerR.current) clearTimeout(clipTimerR.current);
      clipTimerR.current = setTimeout(() => setClippingR(false), 2000);
    }

    return () => {
      if (clipTimerL.current) clearTimeout(clipTimerL.current);
      if (clipTimerR.current) clearTimeout(clipTimerR.current);
    };
  }, [left, right]);

  const dbL = linearToDb(left);
  const dbR = linearToDb(right);
  const fillL = dbToPercent(dbL);
  const fillR = dbToPercent(dbR);
  const isHotL = dbL > -12;
  const isHotR = dbR > -12;

  // Format dB readout
  const formatDb = (db: number) => {
    if (db <= -96) return '-∞';
    return db.toFixed(1);
  };

  return (
    <div className="master-meter" style={{ height: height + 40 }}>
      {/* dB Scale */}
      <div className="meter-scale" style={{ height }}>
        {DB_MARKS.map(db => (
          <span key={db} className="meter-scale-mark" data-db={db}>
            {db === 0 ? '0' : db}
          </span>
        ))}
      </div>

      {/* Left Channel */}
      <div className="meter-channel">
        <div 
          className="meter-clip" 
          data-clipping={clippingL ? 'true' : 'false'}
          title={clippingL ? 'CLIPPING!' : 'No clip'}
        />
        <div className="meter-track" style={{ height }}>
          <div
            className="meter-fill meter-fill-l"
            data-hot={isHotL ? 'true' : 'false'}
            data-clip={clippingL ? 'true' : 'false'}
            style={{ height: `${fillL}%` }}
          />
          <div
            className="meter-peak-hold meter-peak-hold-l"
            style={{ bottom: `${peakL}%` }}
          />
        </div>
        <span className="meter-label">L</span>
      </div>

      {/* Right Channel */}
      <div className="meter-channel">
        <div 
          className="meter-clip" 
          data-clipping={clippingR ? 'true' : 'false'}
          title={clippingR ? 'CLIPPING!' : 'No clip'}
        />
        <div className="meter-track" style={{ height }}>
          <div
            className="meter-fill meter-fill-r"
            data-hot={isHotR ? 'true' : 'false'}
            data-clip={clippingR ? 'true' : 'false'}
            style={{ height: `${fillR}%` }}
          />
          <div
            className="meter-peak-hold meter-peak-hold-r"
            style={{ bottom: `${peakR}%` }}
          />
        </div>
        <span className="meter-label">R</span>
      </div>

      {/* Readout */}
      <div className="flex flex-col justify-end gap-1">
        <div 
          className="meter-readout" 
          data-hot={isHotL ? 'true' : 'false'}
          data-clip={clippingL ? 'true' : 'false'}
        >
          {formatDb(dbL)}
        </div>
        <div 
          className="meter-readout" 
          data-hot={isHotR ? 'true' : 'false'}
          data-clip={clippingR ? 'true' : 'false'}
        >
          {formatDb(dbR)}
        </div>
        <span className="meter-label" style={{ marginTop: 2 }}>dB</span>
      </div>
    </div>
  );
});

MasterMeter.displayName = 'MasterMeter';
