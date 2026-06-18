import type { InsertEffectType } from '../sequencer/useSequencerEngine';
import React from 'react';

export interface PluginRegistryEntry {
  displayName: string;          // e.g. "ANUNNAKI VEIL"
  shortName: string;            // e.g. "VEIL" (for mixer slot display)
  icon: string;                 // emoji icon
  defaultWidth: number;         // default floating window width
  defaultHeight: number;        // default floating window height
  minWidth: number;             // minimum resize width
  minHeight: number;            // minimum resize height
  component: React.LazyExoticComponent<React.ComponentType<PluginComponentProps>> | null; // lazy-loaded component (null = not yet built)
  color: string;                // brand color for this plugin
}

export interface PluginComponentProps {
  trackIndex: number;
  slotIndex: number;
  params: Record<string, number>;
  onParamChange: (param: string, value: number) => void;
  bypassed: boolean;
  trackColor: string;
}

export const pluginRegistry: Record<InsertEffectType, PluginRegistryEntry> = {
  filter: {
    displayName: 'ANUNNAKI VEIL',
    shortName: 'VEIL',
    icon: '🗡️',
    defaultWidth: 560,
    defaultHeight: 750,
    minWidth: 440,
    minHeight: 520,
    component: React.lazy(() => import('./AnunnakiVeil')),
    color: '#d4a853',
  },
  compressor: {
    displayName: 'ANUNNAKI THRONE',
    shortName: 'THRONE',
    icon: '🔱',
    defaultWidth: 620,
    defaultHeight: 720,
    minWidth: 500,
    minHeight: 560,
    component: React.lazy(() => import('./AnunnakiThrone')),
    color: '#ef4444',
  },
  reverb: {
    displayName: 'ANUNNAKI NEBULA',
    shortName: 'NEBULA',
    icon: '🌌',
    defaultWidth: 680,
    defaultHeight: 480,
    minWidth: 540,
    minHeight: 380,
    component: null,
    color: '#a855f7',
  },
  distortion: {
    displayName: 'ANUNNAKI WRATH',
    shortName: 'WRATH',
    icon: '🔥',
    defaultWidth: 560,
    defaultHeight: 520,
    minWidth: 440,
    minHeight: 400,
    component: null,
    color: '#f97316',
  },
  delay: {
    displayName: 'ANUNNAKI ECHO',
    shortName: 'ECHO',
    icon: '🌀',
    defaultWidth: 640,
    defaultHeight: 460,
    minWidth: 500,
    minHeight: 360,
    component: null,
    color: '#d4a853',
  },
  chorus: {
    displayName: 'ANUNNAKI CHORUS',
    shortName: 'CHORUS',
    icon: '🎭',
    defaultWidth: 480,
    defaultHeight: 420,
    minWidth: 380,
    minHeight: 340,
    component: null,
    color: '#3b82f6',
  },
  bitcrusher: {
    displayName: 'ANUNNAKI CRUSH',
    shortName: 'CRUSH',
    icon: '💀',
    defaultWidth: 440,
    defaultHeight: 400,
    minWidth: 360,
    minHeight: 320,
    component: null,
    color: '#10b981',
  },
  saturation: {
    displayName: 'ANUNNAKI WRATH',
    shortName: 'WRATH',
    icon: '🔥',
    defaultWidth: 560,
    defaultHeight: 520,
    minWidth: 440,
    minHeight: 400,
    component: null,
    color: '#f97316',
  },
};
