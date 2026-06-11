/**
 * VST God Forge — Shared Type Definitions
 * Single source of truth for the vision → mapper → export pipeline.
 */

// ─── DSP Module Types (for modular signal chain) ────────────────────────────

export type DSPModuleType =
  | 'eq'
  | 'compressor'
  | 'delay'
  | 'reverb'
  | 'distortion'
  | 'gain'
  | 'chorus'
  | 'phaser'
  | 'limiter'
  | 'multi808'
  | 'celestialKeys';

export const DSP_MODULE_LABELS: Record<DSPModuleType, string> = {
  eq: 'EQ / Filter',
  compressor: 'Compressor',
  delay: 'Delay',
  reverb: 'Reverb',
  distortion: 'Distortion / Saturation',
  gain: 'Gain',
  chorus: 'Chorus',
  phaser: 'Phaser',
  limiter: 'Limiter',
  multi808: 'Multi-808 Engine',
  celestialKeys: 'Celestial Keys Engine',
};

export interface DSPChainModule {
  /** Unique instance key, e.g. 'eq_1', 'compressor_2' */
  instanceId: string;
  /** Module type */
  type: DSPModuleType;
  /** Instance index (1-based) for duplicate modules in the same chain */
  index: number;
  /** Whether this module is bypassed (still present, but audio passes through) */
  bypassed: boolean;
}

// ─── Control Detection Types ────────────────────────────────────────────────

export type ControlType =
  | 'knob'
  | 'slider'
  | 'button'
  | 'toggle'
  | 'dropdown'
  | 'xy_pad'
  | 'meter'
  | 'display'
  | 'waveform'
  | 'pad'
  | 'text_field'
  | 'tab'
  | 'list'
  | 'image_slot';

export type ParameterCurve = 'linear' | 'logarithmic' | 'exponential';

export interface BoundingBox {
  /** X position as percentage of image width (0-100) */
  x: number;
  /** Y position as percentage of image height (0-100) */
  y: number;
  /** Width as percentage of image width */
  width: number;
  /** Height as percentage of image height */
  height: number;
}

export interface ParameterDef {
  name: string;
  min: number;
  max: number;
  default: number;
  unit: string;
  curve: ParameterCurve;
  /** Whether this parameter supports DAW automation */
  automatable: boolean;
}

export interface DetectedControl {
  id: string;
  type: ControlType;
  label: string;
  group: string;
  position: BoundingBox;
  parameter: ParameterDef;
  /** Confidence score from vision analysis (0-1) */
  confidence: number;
  /** Specific sub-type hints (e.g. "rotary-large", "horizontal-fader") */
  variant?: string;
  /** Optional values for dropdown/list types */
  options?: string[];
  /** Which tab this control was detected from (undefined = shared across tabs) */
  sourceTab?: string;
}

// ─── Layout & Grouping Types ────────────────────────────────────────────────

export interface ControlGroup {
  name: string;
  /** Color used in the control mapper overlay */
  color: string;
  controls: string[];  // control IDs
  /** Bounding box of the entire group region */
  bounds: BoundingBox;
}

export interface UITab {
  name: string;
  icon?: string;
  /** Control groups visible when this tab is active */
  groups: string[];
}

// ─── Full Control Map (output of Vision Analyzer) ───────────────────────────

export interface ControlMap {
  pluginName: string;
  manufacturer: string;
  category: string;
  version: string;
  dimensions: { width: number; height: number };
  controls: DetectedControl[];
  groups: ControlGroup[];
  tabs: UITab[];
  /** The base64 image data for rendering (primary / first tab) */
  imageData: string;
  imageMimeType: string;
  /** Per-tab image data for multi-tab projects */
  tabImageData?: Record<string, { data: string; mime: string }>;
  /** Summary description of the plugin */
  description: string;
  /** Detected color scheme from the image */
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  /**
   * Modular DSP routing chain — defines the order of processing modules.
   * If empty or undefined, falls back to legacy category-based single-module generation.
   */
  routingChain?: DSPChainModule[];
}

// ─── Export Types ────────────────────────────────────────────────────────────

export interface VSTSpec {
  plugin: {
    name: string;
    manufacturer: string;
    category: string;
    version: string;
  };
  parameters: Array<{
    id: string;
    name: string;
    label: string;
    group: string;
    min: number;
    max: number;
    default: number;
    unit: string;
    curve: ParameterCurve;
    automatable: boolean;
  }>;
  audioProcessing: {
    inputChannels: number;
    outputChannels: number;
    algorithm: string;
    /** The modular signal chain for this plugin */
    routingChain?: DSPChainModule[];
  };
  ui: {
    width: number;
    height: number;
    tabs: UITab[];
    controls: Array<{
      id: string;
      type: ControlType;
      label: string;
      group: string;
      parameterId: string;
      position: BoundingBox;
      variant?: string;
      options?: string[];
    }>;
  };
}

export interface ExportFile {
  filename: string;
  content: string;
  language: 'tsx' | 'json' | 'cpp' | 'h' | 'cmake' | 'md' | 'css' | 'png';
}

export interface ExportBundle {
  projectName: string;
  files: ExportFile[];
  /** Timestamp of export */
  exportedAt: string;
}

// ─── Multi-Tab Analysis Types ───────────────────────────────────────────────

/** Analysis result for a single tab screenshot */
export interface TabAnalysis {
  /** User-defined tab name (e.g., "Effects", "Preset Vault") */
  tabName: string;
  /** The base64 image used for this tab's analysis */
  imageData: string;
  imageMimeType: string;
  /** Controls detected in this specific tab */
  controls: DetectedControl[];
  /** Groups detected in this specific tab */
  groups: ControlGroup[];
  /** Analysis status */
  status: 'idle' | 'analyzing' | 'complete' | 'error';
  /** Error message if status is 'error' */
  error?: string;
  /** Timestamp of analysis completion */
  analyzedAt?: string;
}

/** Container for an entire multi-tab plugin project */
export interface MultiTabProject {
  /** Plugin metadata */
  pluginName: string;
  manufacturer: string;
  category: string;
  /** Per-tab analysis results */
  tabAnalyses: TabAnalysis[];
  /** The merged master ControlMap (built after merge) */
  mergedMap: ControlMap | null;
  /** Project creation timestamp */
  createdAt: string;
}

// ─── Forge Memory Types ─────────────────────────────────────────────────────

export interface PluginTemplate {
  id: string;
  name: string;
  category: string;
  /** Expected control groups for this type of plugin */
  expectedGroups: string[];
  /** Common parameter names for this plugin type */
  commonParameters: string[];
  /** Example control layout */
  typicalLayout: Partial<DetectedControl>[];
  /** How many times this template has been used */
  usageCount: number;
  lastUsed: string;
}

export interface ForgeSession {
  id: string;
  pluginName: string;
  imagePath?: string;
  controlMap: ControlMap;
  exportedFormats: string[];
  /** Number of tabs analyzed (1 = single-shot, >1 = multi-tab) */
  tabCount: number;
  /** Names of tabs that were analyzed */
  tabNames: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Akashic Indexer Types ──────────────────────────────────────────────────

export interface AkashicSample {
  id: string;
  name: string;
  path: string;
  category: string;
  /** Semantic descriptors: 'dark', 'ethereal', 'gritty', 'warm', etc. */
  semanticTags: string[];
  /** Acoustic profile data */
  acoustic: {
    key?: string;
    bpm?: number;
    energy: number; // 0-100
    spectralCentroid: number;
    decayTime: number;
    fundamentalFreq?: number;
  };
  /** IDs of sonically similar samples in the lattice */
  relatedIds: string[];
  /** Lore/Story for the sample (generated by AI) */
  lore?: string;
}

export interface AkashicManifest {
  name: string;
  version: string;
  lastIndexed: string;
  samples: AkashicSample[];
  /** Category hierarchy and metadata */
  categories: Record<string, {
    description: string;
    icon: string;
    sampleCount: number;
  }>;
}

// ─── Neural Input Bus Types ────────────────────────────────────────────────

export type InputType = 'midi' | 'midi_cc' | 'midi_note_on' | 'midi_note_off' | 'keyboard' | 'neural';

export interface NeuralInputEvent {
  type: InputType;
  /** Target pad index (0-15) for note events */
  target: number;
  /** High-resolution velocity (0-65535 for MIDI 2.0 readiness) */
  velocity: number;
  /** Per-note expression / Pressure (0-1) */
  pressure?: number;
  /** Pitch bend / Timbre shift */
  timbre?: number;
  /** Original MIDI note number (if type is 'midi') */
  note?: number;
  /** CC number (0-127) for midi_cc events */
  cc?: number;
  /** MIDI channel (0-15) */
  channel?: number;
  /** Device name for identifying source controller */
  deviceName?: string;
  timestamp: number;
}

export interface KeyboardMap {
  /** Key to pad index mapping */
  keys: Record<string, number>;
  /** Key to command mapping (e.g., 'Space' -> 'Toggle Playback') */
  commands: Record<string, string>;
}

// ─── MIDI Controller Mapping Types ─────────────────────────────────────────

/** Unique key for a MIDI CC source: "channel:cc" e.g. "0:74" */
export type MidiCCKey = `${number}:${number}`;

/** A mappable parameter target */
export interface MidiMappableTarget {
  /** Unique parameter ID e.g. 'seq.bpm', 'track.0.volume' */
  id: string;
  /** Human-readable label */
  label: string;
  /** Group for UI organization */
  group: string;
  /** Value range */
  min: number;
  max: number;
  /** Current value getter */
  getValue: () => number;
  /** Value setter — called when CC is received */
  setValue: (value: number) => void;
  /** Whether this is a toggle (CC > 64 = on, <= 64 = off) */
  isToggle?: boolean;
}

/** A stored mapping between a CC source and a parameter target */
export interface MidiMapping {
  /** The CC source key "channel:cc" */
  ccKey: MidiCCKey;
  /** CC number */
  cc: number;
  /** MIDI channel */
  channel: number;
  /** Target parameter ID */
  targetId: string;
  /** Target label (for display when target is not registered) */
  targetLabel: string;
  /** Device name that created this mapping */
  deviceName?: string;
}

/** Serializable mapping store for persistence */
export interface MidiMappingStore {
  version: number;
  mappings: MidiMapping[];
}
