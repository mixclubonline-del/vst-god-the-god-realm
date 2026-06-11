/**
 * MidiMappingService — Core engine for MIDI CC → Parameter mapping.
 *
 * Features:
 *  - Register mappable parameters with ID, range, getter/setter
 *  - MIDI Learn mode: arm a target, receive next CC, create mapping
 *  - Value routing: incoming CC → scale to parameter range → call setter
 *  - Persistence: save/load mappings from localStorage
 *  - Activity tracking: last CC values for UI meters
 */

import { neuralInputBus } from './neuralInputBus';
import type {
  NeuralInputEvent,
  MidiCCKey,
  MidiMappableTarget,
  MidiMapping,
  MidiMappingStore,
} from './types';

const STORAGE_KEY = 'vst-god-midi-mappings';

type LearnCallback = (mapping: MidiMapping) => void;
type MappingChangeCallback = () => void;
type ActivityCallback = (ccKey: MidiCCKey, value: number) => void;

class MidiMappingService {
  // ═══ Registered targets (runtime only, not persisted) ═══
  private targets: Map<string, MidiMappableTarget> = new Map();

  // ═══ Active mappings ═══
  private mappings: Map<MidiCCKey, MidiMapping> = new Map();

  // ═══ Learn mode state ═══
  private _isLearning = false;
  private _learningTargetId: string | null = null;
  private learnResolve: LearnCallback | null = null;

  // ═══ Activity tracking (last 7-bit CC values for UI meters) ═══
  private _lastCCValues: Map<MidiCCKey, number> = new Map();

  // ═══ Change listeners ═══
  private changeListeners: MappingChangeCallback[] = [];
  private activityListeners: ActivityCallback[] = [];
  private learnListeners: (() => void)[] = [];

  private unsubBus: (() => void) | null = null;

  constructor() {
    this.loadFromStorage();
    // Subscribe to NeuralInputBus CC events
    this.unsubBus = neuralInputBus.addListener(this.handleInputEvent.bind(this));
  }

  // ═══ Target Registration ═══

  /** Register a parameter as mappable. Call from React components on mount. */
  registerTarget(target: MidiMappableTarget): void {
    this.targets.set(target.id, target);
  }

  /** Unregister a parameter. Call on component unmount. */
  unregisterTarget(id: string): void {
    this.targets.delete(id);
  }

  /** Get all registered targets */
  getTargets(): MidiMappableTarget[] {
    return Array.from(this.targets.values());
  }

  /** Get targets grouped by their group field */
  getTargetsByGroup(): Map<string, MidiMappableTarget[]> {
    const groups = new Map<string, MidiMappableTarget[]>();
    for (const t of this.targets.values()) {
      const list = groups.get(t.group) ?? [];
      list.push(t);
      groups.set(t.group, list);
    }
    return groups;
  }

  // ═══ Mapping Management ═══

  /** Get all active mappings */
  getMappings(): MidiMapping[] {
    return Array.from(this.mappings.values());
  }

  /** Get mapping for a specific CC key */
  getMappingForCC(ccKey: MidiCCKey): MidiMapping | undefined {
    return this.mappings.get(ccKey);
  }

  /** Get mapping for a specific target ID */
  getMappingForTarget(targetId: string): MidiMapping | undefined {
    for (const m of this.mappings.values()) {
      if (m.targetId === targetId) return m;
    }
    return undefined;
  }

  /** Create or update a mapping */
  setMapping(mapping: MidiMapping): void {
    // Remove any existing mapping to the same target
    for (const [key, m] of this.mappings) {
      if (m.targetId === mapping.targetId && key !== mapping.ccKey) {
        this.mappings.delete(key);
      }
    }
    this.mappings.set(mapping.ccKey, mapping);
    this.saveToStorage();
    this.emitChange();
  }

  /** Remove a mapping by CC key */
  removeMapping(ccKey: MidiCCKey): void {
    this.mappings.delete(ccKey);
    this.saveToStorage();
    this.emitChange();
  }

  /** Remove a mapping by target ID */
  removeMappingForTarget(targetId: string): void {
    for (const [key, m] of this.mappings) {
      if (m.targetId === targetId) {
        this.mappings.delete(key);
      }
    }
    this.saveToStorage();
    this.emitChange();
  }

  /** Clear all mappings */
  clearAll(): void {
    this.mappings.clear();
    this.saveToStorage();
    this.emitChange();
  }

  // ═══ MIDI Learn Mode ═══

  get isLearning(): boolean {
    return this._isLearning;
  }

  get learningTargetId(): string | null {
    return this._learningTargetId;
  }

  /** Start Learn mode for a specific target parameter */
  startLearn(targetId: string): Promise<MidiMapping> {
    const target = this.targets.get(targetId);
    if (!target) {
      return Promise.reject(new Error(`Target '${targetId}' not registered`));
    }

    this._isLearning = true;
    this._learningTargetId = targetId;
    this.emitLearnChange();

    return new Promise<MidiMapping>((resolve) => {
      this.learnResolve = resolve;
    });
  }

  /** Cancel Learn mode without creating a mapping */
  cancelLearn(): void {
    this._isLearning = false;
    this._learningTargetId = null;
    this.learnResolve = null;
    this.emitLearnChange();
  }

  // ═══ Event Handling ═══

  private handleInputEvent(event: NeuralInputEvent): void {
    if (event.type !== 'midi_cc') return;
    if (event.cc === undefined || event.channel === undefined) return;

    const ccKey: MidiCCKey = `${event.channel}:${event.cc}`;
    const value7bit = Math.round((event.velocity / 65535) * 127);

    // Track activity
    this._lastCCValues.set(ccKey, value7bit);
    this.emitActivity(ccKey, value7bit);

    // ─── Learn Mode: capture this CC for the armed target ───
    if (this._isLearning && this._learningTargetId && this.learnResolve) {
      const target = this.targets.get(this._learningTargetId);
      if (target) {
        const mapping: MidiMapping = {
          ccKey,
          cc: event.cc,
          channel: event.channel,
          targetId: this._learningTargetId,
          targetLabel: target.label,
          deviceName: event.deviceName,
        };
        this.setMapping(mapping);
        const resolve = this.learnResolve;
        this._isLearning = false;
        this._learningTargetId = null;
        this.learnResolve = null;
        this.emitLearnChange();
        resolve(mapping);
      }
      return; // Don't route the Learn-capture CC to a parameter
    }

    // ─── Route Mode: apply CC value to mapped parameter ───
    const mapping = this.mappings.get(ccKey);
    if (!mapping) return;

    const target = this.targets.get(mapping.targetId);
    if (!target) return;

    if (target.isToggle) {
      // Toggle: CC > 64 = on, <= 64 = off
      target.setValue(value7bit > 64 ? 1 : 0);
    } else {
      // Continuous: scale 0-127 → min-max
      const scaled = target.min + (value7bit / 127) * (target.max - target.min);
      target.setValue(scaled);
    }
  }

  // ═══ Activity ═══

  getLastCCValue(ccKey: MidiCCKey): number {
    return this._lastCCValues.get(ccKey) ?? 0;
  }

  // ═══ Persistence ═══

  private saveToStorage(): void {
    try {
      const store: MidiMappingStore = {
        version: 1,
        mappings: Array.from(this.mappings.values()),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      console.warn('[MidiMapping] Failed to save mappings', e);
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const store: MidiMappingStore = JSON.parse(raw);
      if (store.version === 1 && Array.isArray(store.mappings)) {
        for (const m of store.mappings) {
          this.mappings.set(m.ccKey, m);
        }
      }
    } catch (e) {
      console.warn('[MidiMapping] Failed to load mappings', e);
    }
  }

  // ═══ Change Subscriptions ═══

  onMappingChange(callback: MappingChangeCallback): () => void {
    this.changeListeners.push(callback);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== callback);
    };
  }

  onActivity(callback: ActivityCallback): () => void {
    this.activityListeners.push(callback);
    return () => {
      this.activityListeners = this.activityListeners.filter(l => l !== callback);
    };
  }

  onLearnChange(callback: () => void): () => void {
    this.learnListeners.push(callback);
    return () => {
      this.learnListeners = this.learnListeners.filter(l => l !== callback);
    };
  }

  private emitChange(): void {
    this.changeListeners.forEach(l => l());
  }

  private emitActivity(ccKey: MidiCCKey, value: number): void {
    this.activityListeners.forEach(l => l(ccKey, value));
  }

  private emitLearnChange(): void {
    this.learnListeners.forEach(l => l());
  }
}

/** Singleton instance */
export const midiMappingService = new MidiMappingService();
