/**
 * BufferRegistry — Unified Buffer Pool for the God Realm
 * Phase 2: Single source of truth for all audio buffers.
 *
 * Replaces both the GodRealmSamplerEngine's internal `buffers[]`
 * and the React state `buffers{}` with one canonical registry.
 *
 * Load once, play everywhere — Archive, Pads, Sequencer, Chopper, Export.
 */

export interface SliceData {
  start: number;
  end: number;
  reverse?: boolean;
  loop?: boolean;
  volume?: number;
}

export interface BufferEntry {
  buffer: AudioBuffer;
  path: string;             // Source URL path or file:// key
  name: string;             // Display name (relic name or filename)
  sourceCategory?: string;  // Archive category
  slices?: SliceData[];     // Chopper slice definitions
  reversed?: AudioBuffer;   // Cached reversed version
}

type RegistryListener = () => void;

export class BufferRegistry {
  private entries: Map<number, BufferEntry> = new Map();
  private listeners: Set<RegistryListener> = new Set();
  private maxSlots: number;
  private _cachedSnapshot: Record<number, AudioBuffer> | null = null; // cached for useSyncExternalStore

  constructor(maxSlots: number = 16) {
    this.maxSlots = maxSlots;
  }

  // ═══ Loading ═══

  /**
   * Load an audio buffer from a URL path (Archive recall, manifest loading).
   * Decodes the audio and stores it in the specified slot.
   */
  async loadFromPath(
    ctx: AudioContext | BaseAudioContext,
    path: string,
    slotIndex: number,
    name?: string,
    signal?: AbortSignal,
  ): Promise<AudioBuffer | null> {
    if (slotIndex < 0 || slotIndex >= this.maxSlots) return null;

    try {
      const response = await fetch(path, { signal });
      if (!response.ok) throw new Error(`Failed to load sample at ${path}`);
      const arrayBuffer = await response.arrayBuffer();
      if (signal?.aborted) return null;

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const displayName = name || path.split('/').pop()?.replace(/\.[^.]+$/, '') || `Slot ${slotIndex + 1}`;

      this.entries.set(slotIndex, {
        buffer: audioBuffer,
        path,
        name: displayName,
      });

      this.notify();
      console.log(`[BufferRegistry] Loaded slot ${slotIndex}: ${displayName}`);
      return audioBuffer;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(`[BufferRegistry] Error loading ${path}:`, err);
      }
      return null;
    }
  }

  /**
   * Load an audio buffer from a File object (drag-drop, file picker, kit loader).
   */
  async loadFromFile(
    ctx: AudioContext | BaseAudioContext,
    file: File,
    slotIndex: number,
  ): Promise<AudioBuffer | null> {
    if (slotIndex < 0 || slotIndex >= this.maxSlots) return null;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const displayName = file.name.replace(/\.[^.]+$/, '');

      this.entries.set(slotIndex, {
        buffer: audioBuffer,
        path: `file://${file.name}`,
        name: displayName,
      });

      this.notify();
      console.log(`[BufferRegistry] File loaded to slot ${slotIndex}: ${displayName}`);
      return audioBuffer;
    } catch (err) {
      console.error(`[BufferRegistry] Error loading file ${file.name}:`, err);
      return null;
    }
  }

  /**
   * Directly set an AudioBuffer in a slot (e.g., from an already-decoded source).
   */
  setBuffer(slotIndex: number, buffer: AudioBuffer, name: string, path: string = ''): void {
    if (slotIndex < 0 || slotIndex >= this.maxSlots) return;

    this.entries.set(slotIndex, {
      buffer,
      path,
      name,
    });

    this.notify();
  }

  // ═══ Accessors ═══

  /** Get the AudioBuffer for a slot (used by both engines for playback). */
  getBuffer(slotIndex: number): AudioBuffer | null {
    return this.entries.get(slotIndex)?.buffer ?? null;
  }

  /** Get full entry metadata for a slot. */
  getEntry(slotIndex: number): BufferEntry | null {
    return this.entries.get(slotIndex) ?? null;
  }

  /** Get the display name for a slot. */
  getName(slotIndex: number): string {
    return this.entries.get(slotIndex)?.name ?? '';
  }

  /** Get the source path for a slot. */
  getPath(slotIndex: number): string {
    return this.entries.get(slotIndex)?.path ?? '';
  }

  /** Get or compute a reversed version of the buffer. */
  getReversedBuffer(ctx: AudioContext | BaseAudioContext, slotIndex: number): AudioBuffer | null {
    const entry = this.entries.get(slotIndex);
    if (!entry) return null;

    if (entry.reversed) return entry.reversed;

    // Compute and cache the reversed buffer
    const buffer = entry.buffer;
    const reversed = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: buffer.length,
      sampleRate: buffer.sampleRate,
    });

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const srcData = buffer.getChannelData(ch);
      const destData = reversed.getChannelData(ch);
      for (let j = 0; j < buffer.length; j++) {
        destData[j] = srcData[buffer.length - 1 - j];
      }
    }

    entry.reversed = reversed;
    return reversed;
  }

  /** Check if a slot has a buffer loaded. */
  hasBuffer(slotIndex: number): boolean {
    return this.entries.has(slotIndex);
  }

  /** Get the number of loaded slots. */
  get loadedCount(): number {
    return this.entries.size;
  }

  /** Get all slot indices that have buffers. */
  get loadedSlots(): number[] {
    return Array.from(this.entries.keys()).sort((a, b) => a - b);
  }

  // ═══ Slice Management ═══

  /** Set chopper slice data for a slot. */
  setSlices(slotIndex: number, slices: SliceData[]): void {
    const entry = this.entries.get(slotIndex);
    if (!entry) return;
    entry.slices = slices;
    this.notify();
  }

  /** Get chopper slice data for a slot. */
  getSlices(slotIndex: number): SliceData[] {
    return this.entries.get(slotIndex)?.slices ?? [];
  }

  // ═══ Slot Operations ═══

  /** Remove a buffer from a slot. */
  clearSlot(slotIndex: number): void {
    this.entries.delete(slotIndex);
    this.notify();
  }

  /** Clear all slots. */
  clearAll(): void {
    this.entries.clear();
    this.notify();
  }

  /** Swap two slots. */
  swapSlots(a: number, b: number): void {
    const entryA = this.entries.get(a);
    const entryB = this.entries.get(b);

    if (entryA && entryB) {
      this.entries.set(a, entryB);
      this.entries.set(b, entryA);
    } else if (entryA) {
      this.entries.set(b, entryA);
      this.entries.delete(a);
    } else if (entryB) {
      this.entries.set(a, entryB);
      this.entries.delete(b);
    }

    this.notify();
  }

  // ═══ Snapshot (React Bridge) ═══

  /**
   * Export a plain Record<number, AudioBuffer> snapshot.
   * Used for backward-compatible prop passing to components
   * that still expect the old `buffers` format.
   */
  toBufferRecord(): Record<number, AudioBuffer> {
    if (this._cachedSnapshot) return this._cachedSnapshot;
    const record: Record<number, AudioBuffer> = {};
    for (const [slot, entry] of this.entries) {
      record[slot] = entry.buffer;
    }
    this._cachedSnapshot = record;
    return record;
  }

  // ═══ Subscription (React integration) ═══

  /** Subscribe to registry changes. Returns an unsubscribe function. */
  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this._cachedSnapshot = null; // invalidate snapshot so toBufferRecord() rebuilds
    this.listeners.forEach(fn => fn());
  }
}
