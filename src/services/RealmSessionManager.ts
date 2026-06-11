/**
 * RealmSessionManager.ts — Full-Realm Session Persistence
 * 
 * Wraps the sequencer's useProjectManager with cross-module state capture.
 * Stores full realm snapshots in IndexedDB (falls back to localStorage).
 * 
 * A session captures: sequencer state, pad assignments, Pantheon god/macros,
 * plugin parameters (effects + mastering), and Dais state.
 */

/* ═══ Types ═══ */

export interface PadAssignment {
  slotIndex: number;
  path: string;       // URL path or 'file://filename' for dropped files
  name: string;
  category?: string;
  /** If true, this was a file drop (no re-fetchable path) */
  isFileDrop?: boolean;
}

export interface DaisState {
  activePad: number;
  playModes: string[];
  midiMap: Record<number, number>;
}

export interface RealmSnapshot {
  version: number;
  name: string;
  savedAt: string;
  /** Sequencer state (tracks, patterns, BPM, etc.) — same format as useProjectManager */
  sequencerState: any;
  /** Buffer assignments — metadata only, paths for re-fetch */
  padAssignments: PadAssignment[];
  /** Electric Pantheon god selection */
  pantheonGod: string;
  /** Electric Pantheon macro values */
  pantheonMacros: Record<string, number>;
  /** Full plugin parameterValues (covers Harmonic Pantheon + Celestial Forge + all knobs) */
  parameterValues: Record<string, any>;
  /** Astral Dais state */
  daisState: DaisState;
}

export interface SessionMeta {
  name: string;
  savedAt: string;
  bpm: number;
  trackCount: number;
  godName: string;
  padCount: number;
}

/* ═══ Constants ═══ */
const DB_NAME = 'god_realm_sessions';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const CURRENT_VERSION = 1;
const MAX_SESSIONS = 50;
const LS_FALLBACK_KEY = 'god_realm_sessions_fallback';
const RECENT_KEY = 'god_realm_recent_sessions';
const ACTIVE_KEY = 'god_realm_active_session';
const MAX_RECENT = 4;

/* ═══ IndexedDB Wrapper ═══ */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'name' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch {
      reject(new Error('IndexedDB not available'));
    }
  });
  return dbPromise;
}

function idbTransaction(
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  return openDB().then(db => {
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  });
}

/* ═══ RealmSessionManager ═══ */

export class RealmSessionManager {
  private useIDB = true;

  constructor() {
    // Test IndexedDB availability
    openDB().catch(() => {
      this.useIDB = false;
      console.warn('[RealmSessionManager] IndexedDB unavailable, using localStorage fallback');
    });
  }

  /* ─── Save ─── */
  async saveSession(snapshot: RealmSnapshot): Promise<void> {
    snapshot.version = CURRENT_VERSION;
    snapshot.savedAt = new Date().toISOString();

    if (this.useIDB) {
      try {
        const store = await idbTransaction('readwrite');
        await new Promise<void>((resolve, reject) => {
          const req = store.put(snapshot);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {
        this.saveFallback(snapshot);
      }
    } else {
      this.saveFallback(snapshot);
    }

    this.setActiveSession(snapshot.name);
    this.pushRecent(snapshot.name);
    console.log(`[RealmSession] Sealed: "${snapshot.name}"`);
  }

  /* ─── Load ─── */
  async loadSession(name: string): Promise<RealmSnapshot | null> {
    if (this.useIDB) {
      try {
        const store = await idbTransaction('readonly');
        return new Promise((resolve, reject) => {
          const req = store.get(name);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      } catch {
        return this.loadFallback(name);
      }
    }
    return this.loadFallback(name);
  }

  /* ─── List ─── */
  async listSessions(): Promise<SessionMeta[]> {
    if (this.useIDB) {
      try {
        const store = await idbTransaction('readonly');
        return new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => {
            const sessions: RealmSnapshot[] = req.result || [];
            const metas = sessions.map(s => this.toMeta(s))
              .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
            resolve(metas);
          };
          req.onerror = () => reject(req.error);
        });
      } catch {
        return this.listFallback();
      }
    }
    return this.listFallback();
  }

  /* ─── Delete ─── */
  async deleteSession(name: string): Promise<void> {
    if (this.useIDB) {
      try {
        const store = await idbTransaction('readwrite');
        await new Promise<void>((resolve, reject) => {
          const req = store.delete(name);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {
        this.deleteFallback(name);
      }
    } else {
      this.deleteFallback(name);
    }

    if (this.getActiveSession() === name) {
      localStorage.removeItem(ACTIVE_KEY);
    }
    this.removeRecent(name);
  }

  /* ─── Export ─── */
  async exportSession(name: string): Promise<void> {
    const snapshot = await this.loadSession(name);
    if (!snapshot) return;

    const json = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.realm.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ─── Import ─── */
  async importSession(file: File): Promise<string | null> {
    try {
      const text = await file.text();
      const snapshot: RealmSnapshot = JSON.parse(text);
      if (!snapshot.name || !snapshot.sequencerState) {
        console.error('[RealmSession] Invalid session file');
        return null;
      }

      // Avoid name collision
      const existing = await this.listSessions();
      const existingNames = new Set(existing.map(s => s.name));
      let name = snapshot.name;
      let counter = 1;
      while (existingNames.has(name)) {
        name = `${snapshot.name} (${counter++})`;
      }
      snapshot.name = name;
      snapshot.savedAt = new Date().toISOString();

      await this.saveSession(snapshot);
      return name;
    } catch (err) {
      console.error('[RealmSession] Import failed:', err);
      return null;
    }
  }

  /* ─── Recent Sessions ─── */
  getRecentSessions(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private pushRecent(name: string): void {
    const recent = this.getRecentSessions().filter(n => n !== name);
    recent.unshift(name);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  }

  private removeRecent(name: string): void {
    const recent = this.getRecentSessions().filter(n => n !== name);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }

  /* ─── Active Session ─── */
  getActiveSession(): string | null {
    return localStorage.getItem(ACTIVE_KEY);
  }

  setActiveSession(name: string): void {
    localStorage.setItem(ACTIVE_KEY, name);
  }

  clearActiveSession(): void {
    localStorage.removeItem(ACTIVE_KEY);
  }

  /* ─── Helpers ─── */
  private toMeta(s: RealmSnapshot): SessionMeta {
    return {
      name: s.name,
      savedAt: s.savedAt,
      bpm: s.sequencerState?.bpm ?? 120,
      trackCount: s.sequencerState?.tracks?.length ?? 0,
      godName: s.pantheonGod || 'Unknown',
      padCount: s.padAssignments?.length ?? 0,
    };
  }

  /* ─── LocalStorage Fallback ─── */
  private getFallbackStore(): Record<string, RealmSnapshot> {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private setFallbackStore(store: Record<string, RealmSnapshot>): void {
    try {
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(store));
    } catch (e) {
      console.error('[RealmSession] localStorage full:', e);
    }
  }

  private saveFallback(snapshot: RealmSnapshot): void {
    const store = this.getFallbackStore();
    if (!store[snapshot.name] && Object.keys(store).length >= MAX_SESSIONS) {
      // Remove oldest
      const oldest = Object.values(store)
        .sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime())[0];
      if (oldest) delete store[oldest.name];
    }
    store[snapshot.name] = snapshot;
    this.setFallbackStore(store);
  }

  private loadFallback(name: string): RealmSnapshot | null {
    return this.getFallbackStore()[name] || null;
  }

  private listFallback(): SessionMeta[] {
    return Object.values(this.getFallbackStore())
      .map(s => this.toMeta(s))
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }

  private deleteFallback(name: string): void {
    const store = this.getFallbackStore();
    delete store[name];
    this.setFallbackStore(store);
  }
}

/** Singleton instance */
export const realmSessionManager = new RealmSessionManager();
