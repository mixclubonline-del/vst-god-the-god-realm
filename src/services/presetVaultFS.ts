/**
 * presetVaultFS — mirror the Preset Vault to a real folder on the user's disk
 * via the File System Access API, so presets survive a cleared browser cache,
 * a plugin reinstall, or moving to another machine.
 *
 * The user picks (or creates) a folder once via "SYNC FOLDER". After that every
 * save/delete writes through to disk automatically. One JSON file per preset
 * (`<id>.json`) so a single corrupt write can never lose the whole library.
 *
 * Works in standalone Chrome/Edge and in the WebView2 plugin (both Chromium).
 * The chosen directory handle is persisted in IndexedDB and re-permissioned on
 * the next session.
 */

import type { UnifiedPreset } from './presetService';

const DB_NAME = 'godrealm-presetvault';
const STORE = 'handles';
const KEY = 'root';

type Listener = (located: boolean, name: string | null) => void;

function sanitize(s: string): string {
  return s.replace(/[^a-z0-9_\-]+/gi, '_').slice(0, 60);
}

class PresetVaultFS {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private listeners = new Set<Listener>();
  private _restored = false;

  get supported(): boolean {
    return typeof (window as any).showDirectoryPicker === 'function';
  }
  get isLocated(): boolean { return this.rootHandle !== null; }
  get rootName(): string | null { return this.rootHandle?.name ?? null; }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.isLocated, this.rootName);
    return () => { this.listeners.delete(fn); };
  }
  private emit() { for (const fn of this.listeners) fn(this.isLocated, this.rootName); }

  // ── IndexedDB persistence of the directory handle ──────────────────────────
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  private async saveHandle(handle: FileSystemDirectoryHandle) {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(handle, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch { /* best effort */ }
  }
  private async loadHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await this.openDB();
      const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
      db.close();
      return handle;
    } catch { return null; }
  }

  /** Restore a previously-chosen folder on startup (no prompt). */
  async restore(): Promise<boolean> {
    if (this._restored) return this.isLocated;
    this._restored = true;
    const handle = await this.loadHandle();
    if (!handle) return false;
    try {
      const perm = await (handle as any).queryPermission?.({ mode: 'readwrite' });
      this.rootHandle = handle; // keep it; permission re-granted lazily on first write
      this.emit();
      return perm === 'granted';
    } catch {
      this.rootHandle = handle;
      this.emit();
      return false;
    }
  }

  /** Prompt the user to choose/create the preset folder (requires a gesture). */
  async locate(): Promise<boolean> {
    if (!this.supported) return false;
    try {
      const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        id: 'godrealm-preset-vault',
        mode: 'readwrite',
      });
      this.rootHandle = handle;
      await this.saveHandle(handle);
      this.emit();
      return true;
    } catch {
      return false;
    }
  }

  private async ensurePermission(): Promise<boolean> {
    const h = this.rootHandle as any;
    if (!h) return false;
    try {
      if ((await h.queryPermission?.({ mode: 'readwrite' })) === 'granted') return true;
      return (await h.requestPermission?.({ mode: 'readwrite' })) === 'granted';
    } catch { return true; }
  }

  // ── Reads / writes ─────────────────────────────────────────────────────────

  /** Write a single preset to `<id>.json`. No-op if no folder is set. */
  async writePreset(preset: UnifiedPreset): Promise<void> {
    if (!this.rootHandle) return;
    if (!(await this.ensurePermission())) return;
    try {
      const fname = `${sanitize(preset.name)}__${preset.id}.json`;
      const fh = await this.rootHandle.getFileHandle(fname, { create: true });
      const w = await (fh as any).createWritable();
      await w.write(JSON.stringify(preset, null, 2));
      await w.close();
    } catch { /* ignore individual write failures */ }
  }

  /** Remove a preset's file by id (matches the `__<id>.json` suffix). */
  async deletePreset(id: string): Promise<void> {
    if (!this.rootHandle) return;
    if (!(await this.ensurePermission())) return;
    try {
      for await (const [name, handle] of (this.rootHandle as any).entries()) {
        if (handle.kind === 'file' && name.endsWith(`__${id}.json`)) {
          await (this.rootHandle as any).removeEntry(name);
        }
      }
    } catch { /* ignore */ }
  }

  /** Write the full set (used right after the folder is first chosen). */
  async writeAll(presets: UnifiedPreset[]): Promise<void> {
    for (const p of presets) await this.writePreset(p);
  }

  /** Read every preset JSON from the folder. */
  async readAll(): Promise<UnifiedPreset[]> {
    if (!this.rootHandle) return [];
    if (!(await this.ensurePermission())) return [];
    const out: UnifiedPreset[] = [];
    try {
      for await (const [name, handle] of (this.rootHandle as any).entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
        try {
          const file = await handle.getFile();
          const data = JSON.parse(await file.text());
          if (data && data.id && data.name) out.push(data as UnifiedPreset);
        } catch { /* skip bad file */ }
      }
    } catch { /* ignore */ }
    return out;
  }
}

export const presetVaultFS = new PresetVaultFS();
