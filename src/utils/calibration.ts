import { useState, useEffect } from 'react';

export interface CalibrationSettings {
  knobCurve: 'linear' | 'logarithmic' | 'exponential' | 's-curve';
  knobSensitivity: number;
  faderCurve: 'linear' | 'logarithmic' | 'exponential' | 's-curve';
  faderSensitivity: number;
  xyPadCurveX: 'linear' | 'logarithmic' | 'exponential' | 's-curve';
  xyPadCurveY: 'linear' | 'logarithmic' | 'exponential' | 's-curve';
  xyPadSensitivity: number;
}

export const DEFAULT_CALIBRATION_SETTINGS: CalibrationSettings = {
  knobCurve: 'linear',
  knobSensitivity: 1.0,
  faderCurve: 'linear',
  faderSensitivity: 1.0,
  xyPadCurveX: 'linear',
  xyPadCurveY: 'linear',
  xyPadSensitivity: 1.0,
};

const STORAGE_KEY = 'vst-god-divine-settings';

/**
 * Loads the active calibration configuration from localStorage.
 */
export function getCalibrationSettings(): CalibrationSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        knobCurve: parsed.knobCurve || DEFAULT_CALIBRATION_SETTINGS.knobCurve,
        knobSensitivity: typeof parsed.knobSensitivity === 'number' ? parsed.knobSensitivity : DEFAULT_CALIBRATION_SETTINGS.knobSensitivity,
        faderCurve: parsed.faderCurve || DEFAULT_CALIBRATION_SETTINGS.faderCurve,
        faderSensitivity: typeof parsed.faderSensitivity === 'number' ? parsed.faderSensitivity : DEFAULT_CALIBRATION_SETTINGS.faderSensitivity,
        xyPadCurveX: parsed.xyPadCurveX || DEFAULT_CALIBRATION_SETTINGS.xyPadCurveX,
        xyPadCurveY: parsed.xyPadCurveY || DEFAULT_CALIBRATION_SETTINGS.xyPadCurveY,
        xyPadSensitivity: typeof parsed.xyPadSensitivity === 'number' ? parsed.xyPadSensitivity : DEFAULT_CALIBRATION_SETTINGS.xyPadSensitivity,
      };
    }
  } catch (e) {
    // Ignore storage errors in restrictive environments
  }
  return DEFAULT_CALIBRATION_SETTINGS;
}

/**
 * Custom hook to subscribe to calibration setting updates in real-time.
 */
export function useCalibrationSettings(): CalibrationSettings {
  const [settings, setSettings] = useState<CalibrationSettings>(getCalibrationSettings);

  useEffect(() => {
    const handleUpdate = () => {
      setSettings(getCalibrationSettings());
    };
    window.addEventListener('divine-settings-updated', handleUpdate);
    return () => {
      window.removeEventListener('divine-settings-updated', handleUpdate);
    };
  }, []);

  return settings;
}

/**
 * Transforms a linear normalized ratio [0..1] into a curved value mapping,
 * then maps it to the [min, max] range.
 */
export function applyCurve(value: number, curve: string, min: number, max: number): number {
  const range = max - min;
  if (range === 0) return min;

  // Normalize and clamp value to [0..1]
  const normalized = Math.max(0, Math.min(1, (value - min) / range));
  let curved = normalized;

  if (curve === 'logarithmic') {
    curved = Math.pow(normalized, 1 / 2.5);
  } else if (curve === 'exponential') {
    curved = Math.pow(normalized, 2.5);
  } else if (curve === 's-curve') {
    curved = (Math.sin(Math.PI * (normalized - 0.5)) + 1) / 2;
  }

  return min + curved * range;
}

/**
 * Inverse of applyCurve: transforms a curved value in [min, max] back to the raw linear value.
 */
export function invertCurve(value: number, curve: string, min: number, max: number): number {
  const range = max - min;
  if (range === 0) return min;

  // Normalize and clamp value to [0..1]
  const normalized = Math.max(0, Math.min(1, (value - min) / range));
  let raw = normalized;

  if (curve === 'logarithmic') {
    raw = Math.pow(normalized, 2.5);
  } else if (curve === 'exponential') {
    raw = Math.pow(normalized, 1 / 2.5);
  } else if (curve === 's-curve') {
    const clampedVal = Math.max(-1, Math.min(1, 2 * normalized - 1));
    raw = Math.asin(clampedVal) / Math.PI + 0.5;
  }

  return min + raw * range;
}
