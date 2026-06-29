/**
 * Chop Session Service — persists chopper sessions to localStorage.
 * Completely separate from the Preset Vault.
 */

export interface ChopSlice {
  start: number;
  end: number;
}

export interface ChopSession {
  id: string;
  name: string;
  createdAt: string;
  sampleName: string;
  slices: ChopSlice[];
  chopMarkers: number[];   // normalized 0–1 positions
  params: {
    chopMode: string;
    snapToTransient: boolean;
    snapToZero: boolean;
    chopperSpeed: number;
    chopperPitch: number;
    chopperFadeIn: number;
    chopperFadeOut: number;
    chopperGlide: number;
    chopperSensitivity: number;
    chopperTrigger: string;
    chopperDryWet: number;
    chopperOutputVolume: number;
  };
}

const STORAGE_KEY = 'vst-god-chop-sessions-v1';

class ChopSessionService {
  private sessions: ChopSession[] = [];
  private listeners: (() => void)[] = [];

  constructor() { this.load(); }

  onChange(cb: () => void) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }
  private notify() { this.listeners.forEach(l => l()); }

  getAll(): ChopSession[] { return [...this.sessions]; }

  save(session: Omit<ChopSession, 'id' | 'createdAt'>): ChopSession {
    const s: ChopSession = {
      ...session,
      id: `chop-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.sessions.unshift(s);
    this.persist();
    this.notify();
    return s;
  }

  update(id: string, data: Partial<ChopSession>): void {
    const idx = this.sessions.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.sessions[idx] = { ...this.sessions[idx], ...data };
      this.persist();
      this.notify();
    }
  }

  delete(id: string): void {
    this.sessions = this.sessions.filter(s => s.id !== id);
    this.persist();
    this.notify();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.sessions = raw ? JSON.parse(raw) : [];
    } catch { this.sessions = []; }
  }

  private persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions)); } catch {}
  }

  export(id: string): string | null {
    const s = this.sessions.find(s => s.id === id);
    return s ? JSON.stringify(s, null, 2) : null;
  }

  import(json: string): ChopSession | null {
    try {
      const data = JSON.parse(json) as ChopSession;
      if (!data.chopMarkers || !data.sampleName) return null;
      const s: ChopSession = { ...data, id: `chop-${Date.now()}`, createdAt: new Date().toISOString() };
      this.sessions.unshift(s);
      this.persist();
      this.notify();
      return s;
    } catch { return null; }
  }
}

export const chopSessionService = new ChopSessionService();
