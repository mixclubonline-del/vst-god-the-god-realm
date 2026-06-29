/**
 * coreLibraryFS — locate & read the Core Library folder via the File System
 * Access API (showDirectoryPicker).
 *
 * The Core Library is a ~280 MB folder of one-shot samples that ships alongside
 * the plugin, NOT embedded in the binary. The user can place it anywhere on
 * their machine (internal or external drive); this service lets them point the
 * plugin at it once, remembers the chosen folder across restarts (the directory
 * handle is persisted in IndexedDB), and reads individual samples on demand.
 *
 * Works in both contexts because both are Chromium:
 *   - Standalone build (Chrome / Edge)
 *   - VST3 plugin (WebView2 is Chromium, secure origin https://juce.backend)
 *
 * Folder layout expected (category subfolders matching the Core Library tabs):
 *   <root>/Bass/Detroit.wav, <root>/Pads/Mercury.ogg, ...
 */

const DB_NAME = 'godrealm-corelib';
const STORE = 'handles';
const KEY = 'root';

type Listener = (located: boolean, name: string | null) => void;

class CoreLibraryFS {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  // Cache resolved category subfolder handles so repeated loads don't re-walk.
  private categoryHandles = new Map<string, FileSystemDirectoryHandle>();
  private listeners = new Set<Listener>();
  private _restored = false;

  /** True if the File System Access API is available in this browser/runtime. */
  get supported(): boolean {
    return typeof (window as any).showDirectoryPicker === 'function';
  }

  get isLocated(): boolean {
    return this.rootHandle !== null;
  }

  get rootName(): string | null {
    return this.rootHandle?.name ?? null;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.isLocated, this.rootName);
    return () => { this.listeners.delete(fn); };
  }

  private emit() {
    for (const fn of this.listeners) fn(this.isLocated, this.rootName);
  }

  // ── IndexedDB persistence (stores the FileSystemDirectoryHandle object) ─────
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
    } catch { /* persistence is best-effort */ }
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

  /** Restore a previously-chosen folder on startup. Call once at mount. */
  async restore(): Promise<void> {
    if (this._restored) return;
    this._restored = true;
    const handle = await this.loadHandle();
    if (!handle) return;
    // Set the handle immediately so isLocated is true — permission is verified lazily.
    this.rootHandle = handle;
    this.categoryHandles.clear();
    this.emit();
    // Try to confirm permission silently (no prompt — no user gesture here).
    try {
      const perm = await (handle as any).queryPermission?.({ mode: 'read' });
      if (perm !== 'granted') {
        // Permission not yet granted but we keep the handle; ensurePermission()
        // will request it on the next user-gesture-triggered load.
      }
    } catch { /* older runtimes without permission API — assume granted */ }
  }

  /** Prompt the user to pick the Core Library folder. Requires a user gesture. */
  async locate(): Promise<boolean> {
    if (!this.supported) return false;
    try {
      const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        id: 'godrealm-core-library',
        mode: 'read',
      });
      this.rootHandle = handle;
      this.categoryHandles.clear();
      await this.saveHandle(handle);
      // Also persist the folder name to localStorage as a fast-path check on restore
      try { localStorage.setItem('godrealm-corelib-name', handle.name); } catch {}
      this.emit();
      return true;
    } catch {
      // User cancelled the picker, or it's unavailable.
      return false;
    }
  }

  /** Ensure read permission is granted (re-prompts from a user gesture if needed). */
  private async ensurePermission(): Promise<boolean> {
    const h = this.rootHandle as any;
    if (!h) return false;
    try {
      if ((await h.queryPermission?.({ mode: 'read' })) === 'granted') return true;
      return (await h.requestPermission?.({ mode: 'read' })) === 'granted';
    } catch {
      return true; // older impls without permission API
    }
  }

  private async getCategoryHandle(category: string): Promise<FileSystemDirectoryHandle | null> {
    if (!this.rootHandle) return null;
    const cached = this.categoryHandles.get(category);
    if (cached) return cached;
    try {
      const dir = await this.rootHandle.getDirectoryHandle(category);
      this.categoryHandles.set(category, dir);
      return dir;
    } catch {
      return null;
    }
  }

  /**
   * Read a sample's bytes. Returns null if not located, no permission, or the
   * file isn't found (caller should fall back to the JUCE bridge / show a hint).
   */
  async getFileBuffer(category: string, filename: string): Promise<ArrayBuffer | null> {
    if (!this.rootHandle) return null;
    if (!(await this.ensurePermission())) return null;
    const dir = await this.getCategoryHandle(category);
    if (!dir) return null;
    try {
      const fileHandle = await dir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.arrayBuffer();
    } catch {
      return null;
    }
  }
}

export const coreLibraryFS = new CoreLibraryFS();
