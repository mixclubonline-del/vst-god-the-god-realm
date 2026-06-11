/**
 * pluginRegistry.ts — The Five Sacred Instruments
 * Defines the plugin identity, god mapping, theme, and FUI paradigm for each instrument.
 */

export type PluginId =
  | 'ethereal-pluck'
  | 'divine-texture'
  | 'underworld-bass'
  | 'celestial-pad'
  | 'mythic-lead';

export type FuiParadigm =
  | 'scan-grid'        // High-Density Scanning Grids
  | 'fluid-orb'        // Nebulous Fluid Orbs
  | 'spectral-radar'   // Circular Spectral Radar
  | 'holo-slider'      // Holographic Floating Sliders
  | 'recessed-hardware'; // Deep-Recessed Hardware

export interface PluginTheme {
  primary: string;
  secondary: string;
  accent: string;
  frame: string;
  glowHsl: string;
}

export interface PluginDefinition {
  id: PluginId;
  name: string;
  godId: string;
  morphGodId?: string;
  icon: string;
  voiceMode: 'POLY' | 'MONO' | 'LEGATO';
  category: 'synth' | 'bass' | 'pad' | 'lead' | 'texture';
  fui: FuiParadigm;
  theme: PluginTheme;
  texture: string;
  defaultSize: { w: number; h: number };
  description: string;
}

export const PLUGIN_REGISTRY: Record<PluginId, PluginDefinition> = {
  'ethereal-pluck': {
    id: 'ethereal-pluck',
    name: 'Ethereal Pluck',
    godId: 'apollo',
    icon: '💎',
    voiceMode: 'POLY',
    category: 'synth',
    fui: 'scan-grid',
    theme: {
      primary: '#B87DFF',
      secondary: '#6B32FF',
      accent: '#D4A0FF',
      frame: 'hsl(270, 80%, 65%)',
      glowHsl: 'hsla(270, 80%, 65%, 0.3)',
    },
    defaultSize: { w: 520, h: 400 },
    texture: '/textures/plugins/ethereal-pluck.png',
    description: 'Crystal bell pluck with shimmer tail',
  },
  'divine-texture': {
    id: 'divine-texture',
    name: 'Divine Texture',
    godId: 'poseidon',
    morphGodId: 'chronos',
    icon: '🌿',
    voiceMode: 'POLY',
    category: 'texture',
    fui: 'fluid-orb',
    theme: {
      primary: '#22C55E',
      secondary: '#065F46',
      accent: '#4ADE80',
      frame: 'hsl(140, 60%, 45%)',
      glowHsl: 'hsla(140, 60%, 45%, 0.3)',
    },
    defaultSize: { w: 580, h: 440 },
    texture: '/textures/plugins/divine-texture.png',
    description: 'Evolving organic texture with dual-god morph',
  },
  'underworld-bass': {
    id: 'underworld-bass',
    name: 'Underworld Bass',
    godId: 'hades',
    icon: '🌋',
    voiceMode: 'MONO',
    category: 'bass',
    fui: 'spectral-radar',
    theme: {
      primary: '#EF4444',
      secondary: '#991B1B',
      accent: '#FF8C42',
      frame: 'hsl(15, 90%, 50%)',
      glowHsl: 'hsla(15, 90%, 50%, 0.3)',
    },
    defaultSize: { w: 560, h: 420 },
    texture: '/textures/plugins/underworld-bass.png',
    description: 'Volcanic mono bass with heavy saturation',
  },
  'celestial-pad': {
    id: 'celestial-pad',
    name: 'Celestial Pad',
    godId: 'poseidon',
    icon: '🌌',
    voiceMode: 'POLY',
    category: 'pad',
    fui: 'holo-slider',
    theme: {
      primary: '#38D5FF',
      secondary: '#0E7490',
      accent: '#67E8F9',
      frame: 'hsl(190, 80%, 55%)',
      glowHsl: 'hsla(190, 80%, 55%, 0.3)',
    },
    defaultSize: { w: 500, h: 380 },
    texture: '/textures/plugins/celestial-pad.png',
    description: 'Lush ambient pad with aurora stereo field',
  },
  'mythic-lead': {
    id: 'mythic-lead',
    name: 'Mythic Lead',
    godId: 'zeus',
    icon: '⚡',
    voiceMode: 'MONO',
    category: 'lead',
    fui: 'recessed-hardware',
    theme: {
      primary: '#FFE66D',
      secondary: '#B8860B',
      accent: '#FFD700',
      frame: 'hsl(45, 90%, 55%)',
      glowHsl: 'hsla(45, 90%, 55%, 0.3)',
    },
    defaultSize: { w: 540, h: 420 },
    texture: '/textures/plugins/mythic-lead.png',
    description: 'Lightning mono lead with Greek fire transients',
  },
};

export const PLUGIN_LIST: PluginDefinition[] = Object.values(PLUGIN_REGISTRY);
