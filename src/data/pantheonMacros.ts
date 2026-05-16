/**
 * pantheonMacros.ts — The Sacred Control Language
 * 
 * Defines the 4 locked face macros (ENERGY, DIVINITY, WIDTH, REALM)
 * and the 2 hidden performance macros (AURA, AGE).
 * 
 * Includes response curve utilities so each macro
 * maps to DSP parameters with the correct feel.
 */

/* ─── Type Definitions ─── */

export type PantheonMacroId = 'energy' | 'divinity' | 'width' | 'realm' | 'age' | 'aura';

export type CurveType = 'linear' | 'soft' | 'exponential' | 'sCurve';

export type ALSMotion = 'pulse' | 'glow' | 'spread' | 'morph' | 'flicker' | 'bloom';
export type ALSColorRole = 'power' | 'halo' | 'space' | 'realm' | 'age' | 'aura';

export interface ALSFeedback {
  intensity: number;
  colorRole: ALSColorRole;
  motion: ALSMotion;
}

export interface PantheonMacro {
  id: PantheonMacroId;
  label: string;
  value: number; // 0-100 default
  visible: boolean;
  targetGroups: string[];
  curve: CurveType;
  gainCompensated: boolean;
  alsFeedback: ALSFeedback;
  /** Icon for the macro knob UI */
  icon: string;
  /** Sub-description shown below the knob */
  description: string;
}

/* ─── Macro Configuration ─── */

export const pantheonMacros: PantheonMacro[] = [
  {
    id: 'energy',
    label: 'ENERGY',
    value: 50,
    visible: true,
    targetGroups: ['velocity', 'transient', 'saturation', 'compression', 'harmonics'],
    curve: 'sCurve',
    gainCompensated: true,
    alsFeedback: {
      intensity: 0.6,
      colorRole: 'power',
      motion: 'pulse',
    },
    icon: '⚡',
    description: 'Intensity · Drive · Attack',
  },
  {
    id: 'divinity',
    label: 'DIVINITY',
    value: 50,
    visible: true,
    targetGroups: ['exciter', 'shimmer', 'upperHarmonics', 'haloLayer'],
    curve: 'soft',
    gainCompensated: true,
    alsFeedback: {
      intensity: 0.6,
      colorRole: 'halo',
      motion: 'glow',
    },
    icon: '✦',
    description: 'Harmonics · Glow · Halo',
  },
  {
    id: 'width',
    label: 'WIDTH',
    value: 50,
    visible: true,
    targetGroups: ['chorus', 'midSide', 'stereoDelay', 'reverbWidth'],
    curve: 'linear',
    gainCompensated: false,
    alsFeedback: {
      intensity: 0.5,
      colorRole: 'space',
      motion: 'spread',
    },
    icon: '◉',
    description: 'Stereo · Spread · Space',
  },
  {
    id: 'realm',
    label: 'REALM',
    value: 50,
    visible: true,
    targetGroups: ['coreMorph', 'textureBlend', 'fxProfile', 'visualTheme'],
    curve: 'sCurve',
    gainCompensated: true,
    alsFeedback: {
      intensity: 0.7,
      colorRole: 'realm',
      motion: 'morph',
    },
    icon: '🏛',
    description: 'Character · FX · Identity',
  },
  {
    id: 'aura',
    label: 'AURA',
    value: 50,
    visible: false,
    targetGroups: ['reverbSend', 'delayFeedback', 'spaceLayer', 'tailLength'],
    curve: 'soft',
    gainCompensated: true,
    alsFeedback: {
      intensity: 0.5,
      colorRole: 'aura',
      motion: 'bloom',
    },
    icon: '🌀',
    description: 'Atmosphere · Reverb · Space',
  },
  {
    id: 'age',
    label: 'AGE',
    value: 50,
    visible: false,
    targetGroups: ['wowFlutter', 'noise', 'pitchDrift', 'speakerWear'],
    curve: 'exponential',
    gainCompensated: true,
    alsFeedback: {
      intensity: 0.4,
      colorRole: 'age',
      motion: 'flicker',
    },
    icon: '⏳',
    description: 'Vintage · Instability · Wear',
  },
];

/* ─── Curve Application Utilities ─── */

/**
 * Applies a response curve to a normalized 0-1 input value.
 * This is how macros translate from UI position to DSP parameter influence.
 */
export function applyCurve(normalizedValue: number, curve: CurveType): number {
  const v = Math.max(0, Math.min(1, normalizedValue));

  switch (curve) {
    case 'linear':
      return v;

    case 'soft':
      // Gentle curve — more control in the musical range
      return Math.pow(v, 0.7);

    case 'exponential':
      // Exponential — subtle at low, aggressive at high
      return Math.pow(v, 2.5);

    case 'sCurve':
      // S-curve — musical center, power at extremes
      // Uses a smoothstep-like function
      return v * v * (3 - 2 * v);

    default:
      return v;
  }
}

/**
 * Convert a 0-100 macro value to a curved 0-1 DSP parameter.
 */
export function macroToDSP(macroValue: number, curve: CurveType): number {
  return applyCurve(macroValue / 100, curve);
}

/**
 * Get the visible macros only (for the face controls).
 */
export function getVisibleMacros(): PantheonMacro[] {
  return pantheonMacros.filter((m) => m.visible);
}

/**
 * Get a macro by its ID.
 */
export function getMacroById(id: PantheonMacroId): PantheonMacro | undefined {
  return pantheonMacros.find((m) => m.id === id);
}
