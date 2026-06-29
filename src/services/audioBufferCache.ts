/**
 * audioBufferCache.ts
 *
 * Stores decoded audio data (as Float32Array per channel) in IndexedDB so that
 * Multi-Realm Forge slot samples survive tab switches, page reloads, and preset
 * saves/loads.
 *
 * Storage layout:
 *   DB name:  "god-realm-audio-cache"
 *   Store:    "buffers"
 *   Key:      slot id string  (e.g. "slot-1718000000000-0")
 *   Value:    { fileName: string, sampleRate: number, channels: Float32Array[] }
 */

const DB_NAME    = 'god-realm-audio-cache';
const STORE_NAME = 'buffers';
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror   = () => reject(req.error);
  });
}

interface StoredBuffer {
  fileName: string;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  channels: Float32Array[];
}

/** Persist an AudioBuffer under the given key (slot id). */
export async function cacheAudioBuffer(key: string, fileName: string, buf: AudioBuffer): Promise<void> {
  try {
    const db    = await openDB();
    const entry: StoredBuffer = {
      fileName,
      sampleRate: buf.sampleRate,
      numberOfChannels: buf.numberOfChannels,
      length: buf.length,
      channels: Array.from({ length: buf.numberOfChannels }, (_, ch) =>
        buf.getChannelData(ch).slice(),           // copy — don't hold a live reference
      ),
    };
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry, key);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch (e) {
    console.warn('[audioBufferCache] cacheAudioBuffer failed:', e);
  }
}

/** Retrieve a stored buffer and decode it into the given AudioContext. Returns null if not found. */
export async function retrieveAudioBuffer(key: string, ctx: AudioContext): Promise<{ buffer: AudioBuffer; fileName: string } | null> {
  try {
    const db  = await openDB();
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    const entry: StoredBuffer | undefined = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
    if (!entry) return null;

    const buf = ctx.createBuffer(entry.numberOfChannels, entry.length, entry.sampleRate);
    for (let ch = 0; ch < entry.numberOfChannels; ch++) {
      buf.copyToChannel(entry.channels[ch], ch);
    }
    return { buffer: buf, fileName: entry.fileName };
  } catch (e) {
    console.warn('[audioBufferCache] retrieveAudioBuffer failed:', e);
    return null;
  }
}

/** Delete a cached buffer (e.g. when slot is removed). */
export async function deleteCachedBuffer(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch (_) {}
}

/** List all keys in the cache store (for debugging / cleanup). */
export async function listCachedKeys(): Promise<string[]> {
  try {
    const db  = await openDB();
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    return await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result as string[]);
      req.onerror   = () => rej(req.error);
    });
  } catch (_) {
    return [];
  }
}
