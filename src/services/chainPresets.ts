/**
 * VST God Forge — Chain Preset System
 * Factory-defined signal chain templates for common audio workflows.
 * Each preset is a pre-configured DSPChainModule[] that can be loaded instantly.
 */

import type { DSPChainModule, DSPModuleType } from './types';

// ─── Preset Definition ──────────────────────────────────────────────────────

export interface ChainPreset {
  /** Unique key for this preset */
  id: string;
  /** Display name */
  name: string;
  /** Short description of the use case */
  description: string;
  /** Emoji icon for the preset picker */
  icon: string;
  /** Category tag for filtering */
  category: 'production' | 'mixing' | 'creative' | 'mastering' | 'utility';
  /** The pre-configured signal chain */
  chain: DSPChainModule[];
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function mod(type: DSPModuleType, index: number = 1): DSPChainModule {
  return {
    instanceId: `${type}_${index}`,
    type,
    index,
    bypassed: false,
  };
}

// ─── Factory Presets ────────────────────────────────────────────────────────

export const CHAIN_PRESETS: ChainPreset[] = [
  {
    id: 'channel_strip',
    name: 'Channel Strip',
    description: 'Full production strip — EQ, compression, saturation, modulation, time effects, and limiting.',
    icon: '🎚️',
    category: 'production',
    chain: [
      mod('eq'),
      mod('compressor'),
      mod('distortion'),
      mod('chorus'),
      mod('delay'),
      mod('reverb'),
      mod('limiter'),
    ],
  },
  {
    id: 'vocal_chain',
    name: 'Vocal Chain',
    description: 'Clean vocal processing — shape tone, control dynamics, add space, protect peaks.',
    icon: '🎤',
    category: 'mixing',
    chain: [
      mod('eq'),
      mod('compressor'),
      mod('reverb'),
      mod('limiter'),
    ],
  },
  {
    id: 'fx_bus',
    name: 'FX Bus',
    description: 'Send/return effects bus — modulation, delays, and reverb for parallel processing.',
    icon: '🌊',
    category: 'mixing',
    chain: [
      mod('chorus'),
      mod('delay'),
      mod('reverb'),
    ],
  },
  {
    id: 'guitar_amp',
    name: 'Guitar Amp',
    description: 'Guitar rig simulation — drive into EQ, modulation, delay, and spatial reverb.',
    icon: '🎸',
    category: 'creative',
    chain: [
      mod('distortion'),
      mod('eq'),
      mod('chorus'),
      mod('delay'),
      mod('reverb'),
    ],
  },
  {
    id: 'mastering',
    name: 'Mastering',
    description: 'Stereo master chain — surgical EQ, transparent compression, brick-wall limiting.',
    icon: '💎',
    category: 'mastering',
    chain: [
      mod('eq'),
      mod('compressor'),
      mod('limiter'),
    ],
  },
  {
    id: 'clean_dynamics',
    name: 'Clean Dynamics',
    description: 'Clean vocal / voiceover — dynamics control with tonal shaping and peak protection.',
    icon: '🎙️',
    category: 'mixing',
    chain: [
      mod('compressor'),
      mod('eq'),
      mod('limiter'),
    ],
  },
  {
    id: 'lo_fi',
    name: 'Lo-Fi',
    description: 'Lo-fi texture chain — saturation, wobble, and echo for vintage character.',
    icon: '📼',
    category: 'creative',
    chain: [
      mod('distortion'),
      mod('chorus'),
      mod('delay'),
    ],
  },
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start from scratch — build your own chain module by module.',
    icon: '➕',
    category: 'utility',
    chain: [],
  },
];

// ─── Lookup Helpers ─────────────────────────────────────────────────────────

/** Find a preset by ID */
export function getPreset(id: string): ChainPreset | undefined {
  return CHAIN_PRESETS.find(p => p.id === id);
}

/** Get presets filtered by category */
export function getPresetsByCategory(category: ChainPreset['category']): ChainPreset[] {
  return CHAIN_PRESETS.filter(p => p.category === category);
}

/**
 * Detect if a given chain matches any factory preset exactly.
 * Returns the preset ID or 'custom' if no match.
 */
export function detectPresetMatch(chain: DSPChainModule[]): string {
  for (const preset of CHAIN_PRESETS) {
    if (preset.chain.length !== chain.length) continue;

    const match = preset.chain.every((m, i) =>
      chain[i]?.type === m.type && chain[i]?.index === m.index
    );

    if (match) return preset.id;
  }
  return 'custom';
}
