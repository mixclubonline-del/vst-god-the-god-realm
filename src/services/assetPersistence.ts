/**
 * Asset Persistence Service
 * 
 * Handles IndexedDB storage for binary audio data (samples, IRs) 
 * and persistent plugin metadata within the God Realm harness.
 */

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'GodRealmAssets';
const STORE_SAMPLES = 'samples';
const STORE_METADATA = 'metadata';
const DB_VERSION = 1;

export interface AssetRecord {
  id: string;
  name: string;
  data: ArrayBuffer;
  type: string;
  timestamp: number;
}

class AssetPersistence {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_SAMPLES)) {
          db.createObjectStore(STORE_SAMPLES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
        }
      },
    });
  }

  /**
   * Save an audio sample to IndexedDB
   */
  async saveSample(id: string, name: string, data: ArrayBuffer, type: string): Promise<void> {
    const db = await this.db;
    const record: AssetRecord = {
      id,
      name,
      data,
      type,
      timestamp: Date.now(),
    };
    await db.put(STORE_SAMPLES, record);
    console.log(`[AssetPersistence] Sample saved: ${name} (${id})`);
  }

  /**
   * Retrieve a sample by ID
   */
  async getSample(id: string): Promise<AssetRecord | undefined> {
    const db = await this.db;
    return db.get(STORE_SAMPLES, id);
  }

  /**
   * List all stored samples
   */
  async listSamples(): Promise<Omit<AssetRecord, 'data'>[]> {
    const db = await this.db;
    const all = await db.getAll(STORE_SAMPLES);
    return all.map(({ id, name, type, timestamp }) => ({ id, name, type, timestamp }));
  }

  /**
   * Delete a sample
   */
  async deleteSample(id: string): Promise<void> {
    const db = await this.db;
    await db.delete(STORE_SAMPLES, id);
  }

  /**
   * Generic metadata storage (e.g. last session ID, UI state)
   */
  async setMetadata(key: string, value: any): Promise<void> {
    const db = await this.db;
    await db.put(STORE_METADATA, { key, value });
  }

  async getMetadata(key: string): Promise<any> {
    const db = await this.db;
    const result = await db.get(STORE_METADATA, key);
    return result?.value;
  }
}

export const assetPersistence = new AssetPersistence();
