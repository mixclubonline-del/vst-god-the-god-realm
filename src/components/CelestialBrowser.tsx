import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Play, Plus, Heart, Square, Library, Sparkles, ScrollText,
  LayoutGrid, List, Volume2, Shield, Flame, Waves, Archive, Eye,
  Sword, Skull, Sun, CircleDot, Landmark, Zap, Music2, Hammer, Origami, Leaf, Star, BookOpen,
  Download, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArchiveViewMode,
  DivineArchiveManifest,
  DivineRelic,
  filterRelics,
  getRoomCount,
  pickSelectedRelic,
  roomAccent,
  roomImage
} from '@/archive/divineArchive';
import { THRONE_DOMAINS } from '../data/throneDomains';
import { nativeAudio } from '@/native/bridge';
import { CarverSpectralFeedback } from './CarverSpectralFeedback';


/* Sacred Realm Sigils — unique icon per room */
const REALM_SIGILS: Record<string, React.FC<{ size?: number }>> = {
  all: BookOpen,
  favorites: Star,
  olympus: Sword,
  underworld: Skull,
  'sun-disk': Sun,
  void: CircleDot,
  temple: Landmark,
  storm: Zap,
  'celestial-choir': Music2,
  forge: Hammer,
  abyss: Origami,
  eden: Leaf,
};

const RealmSigil: React.FC<{ roomId: string; size?: number }> = ({ roomId, size = 18 }) => {
  const Icon = REALM_SIGILS[roomId] || Sparkles;
  return <Icon size={size} />;
};

interface CelestialBrowserProps {
  engineRef: React.MutableRefObject<any>;
  onLoadToPad?: (samplePath: string, padIndex: number, relic: DivineRelic) => void;
  activePad: number;
  onActivePadChange?: (padIndex: number) => void;
  loadedPadNames?: string[];
}

const FAVORITES_KEY = 'vst-god-favorites';

const loadFavorites = (): Set<string> => {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const saveFavorites = (favs: Set<string>) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
};

const EqBars = () => (
  <div className="da-eq-bars" aria-hidden="true">
    <div className="da-eq-bar" />
    <div className="da-eq-bar" />
    <div className="da-eq-bar" />
    <div className="da-eq-bar" />
  </div>
);

/* ── Waveform Oracle — animated golden oscilloscope ── */
const WaveformOracle: React.FC<{ accent: string; active: boolean; energy: number; decayTime: number }> = ({ accent, active, energy, decayTime }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    let t = 0;
    const draw = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ctx.clearRect(0, 0, w, h);

      // Decays from left to right. A longer decayTime means it decays slower.
      // Maximum decayTime in manifest is 4.0, minimum is 0.05.
      const decayCoeff = 2.5 / Math.max(0.1, decayTime);

      if (!active) {
        // Dormant state — draw a realistic static decay waveform fingerprint
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.22;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const envelope = Math.exp(-nx * decayCoeff) * energy;
          // Complex static wave with multiple harmonics to look realistic
          const y = h / 2 + (
            Math.sin(nx * Math.PI * 18) * 0.5 +
            Math.sin(nx * Math.PI * 36) * 0.3 +
            Math.sin(nx * Math.PI * 64) * 0.15 +
            Math.sin(nx * Math.PI * 120) * 0.05
          ) * (h * 0.4) * envelope;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Faint baseline
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.05;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      t += 0.025;

      // Active state — animated ripples decaying exponentially
      // Layer 1: primary wave — bold golden sine with decay
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const envelope = Math.exp(-nx * decayCoeff) * energy;
        const y = h / 2 + (
          Math.sin(nx * Math.PI * 6 - t * 3) * 0.6 +
          Math.sin(nx * Math.PI * 12 - t * 1.7) * 0.3 +
          Math.sin(nx * Math.PI * 24 - t * 4.2) * 0.1
        ) * (h * 0.4) * envelope;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Layer 2: harmonic overtone — thinner, faster
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const envelope = Math.exp(-nx * decayCoeff) * energy;
        const y = h / 2 + (
          Math.sin(nx * Math.PI * 10 - t * 4.5) * 0.7 +
          Math.cos(nx * Math.PI * 16 - t * 2.2) * 0.3
        ) * (h * 0.3) * envelope;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Glow particles at wave peaks
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = accent;
      for (let i = 0; i < 4; i++) {
        const px = (Math.sin(t * (0.8 + i * 0.25) + i * 1.5) * 0.45 + 0.5) * w;
        const pnx = px / w;
        const penv = Math.exp(-pnx * decayCoeff) * energy;
        const py = h / 2 + Math.sin(pnx * Math.PI * 6 - t * 3) * (h * 0.4) * penv;
        const pulse = 0.5 + 0.5 * Math.sin(t * 4 + i * 2);
        const r = 1.5 + pulse * 2;
        ctx.globalAlpha = (0.2 + pulse * 0.4) * penv;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [accent, active, energy, decayTime]);

  return <canvas ref={canvasRef} className="da-waveform-oracle" />;
};

const LoadingRecords = () => (
  <div className="da-hall-loading">
    <div className="da-skeleton da-loading-room" />
    <div className="da-skeleton da-loading-main" />
    <div className="da-skeleton da-loading-inspector" />
  </div>
);

const RelicInspector = ({
  relic,
  isFavorite,
  isPlaying,
  hasPreviewError,
  activePad,
  allRelics,
  onSelectRelic,
  onAwaken,
  onRecall,
  onToggleFavorite
}: {
  relic: DivineRelic;
  isFavorite: boolean;
  isPlaying: boolean;
  hasPreviewError: boolean;
  activePad: number;
  allRelics: DivineRelic[];
  onSelectRelic: (relic: DivineRelic) => void;
  onAwaken: () => void;
  onRecall: () => void;
  onToggleFavorite: () => void;
}) => {
  const similarRelics = useMemo(() => {
    if (!relic.similarRelicIds) return [];
    return relic.similarRelicIds
      .map((id) => allRelics.find((r) => r.id === id))
      .filter((r): r is DivineRelic => r !== undefined);
  }, [relic.similarRelicIds, allRelics]);

  return (
    <div className={`da-inspector-card ${isPlaying ? 'is-playing' : ''}`} style={{ '--room-accent': roomAccent(relic.room) } as React.CSSProperties}>
      <div className="da-inspector-header" style={{ '--room-image': `url(${roomImage(relic.room)})` } as React.CSSProperties}>
        <WaveformOracle accent={roomAccent(relic.room)} active={isPlaying} energy={relic.energy} decayTime={relic.decayTime} />
        <div className={`da-inspector-orb ${isPlaying ? 'is-pulsing' : ''}`}>
          {isPlaying ? <Volume2 size={22} /> : <Eye size={22} />}
        </div>
      </div>
      <span className="da-kicker">{relic.roomName}</span>
      <h3>{relic.name}</h3>
      <p>{relic.tone}</p>

      {/* Acoustic Meters */}
      <div className="da-meters">
        <div className="da-meter-item">
          <div className="da-meter-row">
            <span className="da-meter-label">Energy</span>
            <span className="da-meter-val">{Math.round((relic.energy ?? 0.5) * 100)}%</span>
          </div>
          <div className="da-meter-track">
            <div className="da-meter-fill" style={{ width: `${(relic.energy ?? 0.5) * 100}%` }} />
          </div>
        </div>
        <div className="da-meter-item">
          <div className="da-meter-row">
            <span className="da-meter-label">Centroid</span>
            <span className="da-meter-val">{Math.round((relic.spectralCentroid ?? 0.5) * 100)}%</span>
          </div>
          <div className="da-meter-track">
            <div className="da-meter-fill" style={{ width: `${(relic.spectralCentroid ?? 0.5) * 100}%` }} />
          </div>
        </div>
        <div className="da-meter-item">
          <div className="da-meter-row">
            <span className="da-meter-label">Decay Time</span>
            <span className="da-meter-val">{(relic.decayTime ?? 1.0).toFixed(2)}s</span>
          </div>
          <div className="da-meter-track">
            <div className="da-meter-fill" style={{ width: `${Math.min(((relic.decayTime ?? 1.0) / 4.0) * 100, 100)}%` }} />
          </div>
        </div>
      </div>

      <dl>
        <div><dt>Category</dt><dd>{relic.sourceCategory}</dd></div>
        <div><dt>Format</dt><dd>{relic.format.toUpperCase()}</dd></div>
        <div><dt>Status</dt><dd>{isPlaying ? '◉ Awakened' : hasPreviewError ? '⚠ Preview failed' : '○ Dormant'}</dd></div>
      </dl>
      <div className="da-tag-cloud">{relic.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>

      {/* Similar Relics grid */}
      {similarRelics.length > 0 && (
        <div className="da-similar-section">
          <h4 className="da-similar-title">Similar Relics</h4>
          <div className="da-similar-grid">
            {similarRelics.map((sim) => (
              <button
                key={sim.id}
                type="button"
                className="da-similar-btn"
                style={{ '--room-accent': roomAccent(sim.room) } as React.CSSProperties}
                onClick={() => onSelectRelic(sim)}
                title={`${sim.name} (${sim.roomName})`}
              >
                <span className="da-similar-sigil">
                  <RealmSigil roomId={sim.room} size={10} />
                </span>
                <span className="da-similar-name">{sim.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="da-inspector-actions">
        <button type="button" onClick={onAwaken}>
          {isPlaying ? '■ Stop' : '▶ Awaken'}
          <kbd>Space</kbd>
        </button>
        <button type="button" onClick={onRecall}>
          Recall to Pad {activePad + 1}
          <kbd>Enter</kbd>
        </button>
        <button type="button" onClick={onToggleFavorite}>
          {isFavorite ? '★ Marked' : '☆ Mark Relic'}
        </button>
      </div>
    </div>
  );
};

export const CelestialBrowser: React.FC<CelestialBrowserProps> = ({
  engineRef,
  onLoadToPad,
  activePad,
  onActivePadChange,
  loadedPadNames,
}) => {
  const [manifest, setManifest] = useState<DivineArchiveManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dragOverFile, setDragOverFile] = useState(false);
  const [deconstructing, setDeconstructing] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [pendingImportPath, setPendingImportPath] = useState<string | null>(null);

  // Subscribe to deconstruction results from JUCE backend
  useEffect(() => {
    const unsubscribe = nativeAudio.subscribeDeconstruct((success, filePath, files) => {
      setDeconstructing(false);
      if (success && files && files.length > 0) {
        // Create new relics from the carved files
        const newRelics: DivineRelic[] = files.map((file: any) => {
          const format = file.name.split('.').pop() || 'wav';
          return {
            id: `carved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            path: file.path,
            format: format,
            sourceCategory: 'Carved',
            room: 'forge',
            roomName: 'Celestial Forge',
            tags: ['Carved', 'Imported', format.toUpperCase()],
            tone: 'Forensically carved relic sound',
            weight: 0.6,
            energy: 0.8,
            spectralCentroid: 0.65,
            decayTime: 1.5,
            similarRelicIds: []
          };
        });

        setManifest((prev) => {
          if (!prev) return null;
          const updatedRelics = [...newRelics, ...prev.relics];
          return {
            ...prev,
            totalRelics: updatedRelics.length,
            relics: updatedRelics
          };
        });
      } else {
        alert('❌ Failed to deconstruct and carve samples from the file.');
      }
    });
    return () => { unsubscribe(); };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setDragOverFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFile(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const path = (file as any).path || file.name;
      setPendingImportPath(path);
      setShowNotice(true);
    }
  }, []);

  const confirmDeconstruct = useCallback(() => {
    setShowNotice(false);
    if (pendingImportPath) {
      setDeconstructing(true);
      nativeAudio.deconstructRelic(pendingImportPath);
      setPendingImportPath(null);
    }
  }, [pendingImportPath]);

  useEffect(() => {
    let mounted = true;
    fetch('/divine_archive_manifest.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Archive manifest failed with ${res.status}`);
        return res.json();
      })
      .then((data: DivineArchiveManifest) => {
        if (!mounted) return;
        setManifest(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Failed to load Divine Archive manifest:', err);
        setLoadError('The Hall of Records could not open its generated archive.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);


  const [selectedRoom, setSelectedRoom] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ArchiveViewMode>('shelf');
  const [selectedRelic, setSelectedRelic] = useState<DivineRelic | null>(null);
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [previewErrorPath, setPreviewErrorPath] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [recentRecalls, setRecentRecalls] = useState<DivineRelic[]>([]);
  const [recalledPath, setRecalledPath] = useState<string | null>(null);
  const previewRef = useRef<{ path: string; stop: () => void } | null>(null);
  const recallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relicListRef = useRef<HTMLDivElement>(null);

  const rooms = useMemo(() => {
    if (!manifest) return [];
    return [
      { id: 'all', name: 'All Records', tone: 'Every relic in the vault', keywords: [] },
      { id: 'favorites', name: 'Marked Relics', tone: 'Favorites preserved for recall', keywords: [] },
      ...manifest.rooms
    ];
  }, [manifest]);

  const visibleRelics = useMemo(() => {
    if (!manifest) return [];
    return filterRelics(manifest.relics, selectedRoom, searchQuery, favorites);
  }, [manifest, selectedRoom, searchQuery, favorites]);

  useEffect(() => {
    setSelectedRelic((current) => pickSelectedRelic(current, visibleRelics));
  }, [visibleRelics]);

  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      saveFavorites(next);
      return next;
    });
  }, []);

  const handleAwaken = useCallback(async (relic: DivineRelic) => {
    setSelectedRelic(relic);
    setPreviewErrorPath(null);

    if (playingPath === relic.path) {
      previewRef.current?.stop();
      previewRef.current = null;
      setPlayingPath(null);
      return;
    }

    previewRef.current?.stop();
    setPlayingPath(relic.path);

    const controller = await engineRef.current?.previewSample(relic.path);
    if (!controller) {
      setPlayingPath(null);
      setPreviewErrorPath(relic.path);
      return;
    }

    previewRef.current = controller;
    controller.finished.then(() => {
      setPlayingPath((current) => (current === relic.path ? null : current));
      if (previewRef.current?.path === relic.path) previewRef.current = null;
    });
  }, [engineRef, playingPath]);

  const handleRecall = useCallback((relic: DivineRelic) => {
    setSelectedRelic(relic);
    engineRef.current?.loadSampleByPath(relic.path, activePad);
    onLoadToPad?.(relic.path, activePad, relic);
    setRecentRecalls((current) => [relic, ...current.filter((item) => item.path !== relic.path)].slice(0, 6));
    // Flash feedback
    setRecalledPath(relic.path);
    if (recallTimerRef.current) clearTimeout(recallTimerRef.current);
    recallTimerRef.current = setTimeout(() => setRecalledPath(null), 600);
  }, [activePad, engineRef, onLoadToPad]);

  useEffect(() => () => {
    previewRef.current?.stop();
    if (recallTimerRef.current) clearTimeout(recallTimerRef.current);
  }, []);

  /* ── Keyboard Navigation ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't intercept when typing in inputs
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = selectedRelic ? visibleRelics.findIndex(r => r.id === selectedRelic.id) : -1;
        const next = e.key === 'ArrowDown'
          ? Math.min(idx + 1, visibleRelics.length - 1)
          : Math.max(idx - 1, 0);
        if (visibleRelics[next]) {
          setSelectedRelic(visibleRelics[next]);
          // Auto-scroll the relic into view
          requestAnimationFrame(() => {
            const el = relicListRef.current?.children[next] as HTMLElement;
            el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          });
        }
      } else if (e.key === ' ' && selectedRelic) {
        e.preventDefault();
        handleAwaken(selectedRelic);
      } else if (e.key === 'Enter' && selectedRelic) {
        e.preventDefault();
        handleRecall(selectedRelic);
      } else if (e.key === 'Escape') {
        setSelectedRelic(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRelic, visibleRelics, handleAwaken, handleRecall]);

  if (loading) return <LoadingRecords />;

  if (loadError || !manifest) {
    return (
      <div className="da-hall-shell da-hall-state">
        <Archive size={34} />
        <h2>Hall of Records Offline</h2>
        <p>{loadError ?? 'The generated archive manifest is unavailable.'}</p>
      </div>
    );
  }

  return (
    <div 
      className="da-hall-shell"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* OS File Drag and Drop Overlay */}
      <AnimatePresence>
        {dragOverFile && (
          <motion.div 
            className="da-drop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="da-drop-icon"><Archive size={48} /></div>
            <h4>DROP RELIC BANK TO DECONSTRUCT</h4>
            <p>Accepts .mse, .hr1, .ch1, .dat, or .zip container files</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deconstructing Loader Overlay */}
      <AnimatePresence>
        {deconstructing && (
          <motion.div 
            className="da-deconstruct-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CarverSpectralFeedback active={deconstructing} />
            <h3>DECONSTRUCTING RELIC BANK...</h3>
            <p>Carving raw PCM waves & audio relics forensically...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disclaimer Consent Notice Modal */}
      <AnimatePresence>
        {showNotice && (
          <motion.div 
            className="da-notice-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="da-notice-modal"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <div className="da-notice-header">
                <ShieldAlert size={28} />
                <h3>SOLEMN OATH OF SYNTHESIS</h3>
              </div>
              <p className="da-notice-text">
                You are about to forensically deconstruct and carve samples from a packed relic container. 
                Ensure that you possess the license, rights, or authorization to use the harvested assets. 
                MixxTech & Zeus reserve all rights of ultimate synthesis. Do you swear to forge only the most godly sounds?
              </p>
              <div className="da-notice-buttons">
                <button onClick={confirmDeconstruct} className="da-notice-btn-confirm">
                  I SWEAR & PROCEED
                </button>
                <button onClick={() => setShowNotice(false)} className="da-notice-btn-cancel">
                  ABORT
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="sync">
        <motion.div
          key={`bg-${selectedRoom}`}
          className="da-bg-overlay"
          style={{ '--room-image': `url(${roomImage(selectedRoom)})` } as React.CSSProperties}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 0.18, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
      </AnimatePresence>
      <aside className="da-room-nav">
        <div className="da-room-title">
          <span>Divine Archive</span>
          <strong>Hall of Records</strong>
        </div>
        <div className="da-room-list">
          {rooms.map((room) => {
            const count = room.id === 'all'
              ? manifest?.totalRelics ?? 0
              : room.id === 'favorites'
                ? favorites.size
                : getRoomCount(manifest?.relics ?? [], room.id);
            const active = selectedRoom === room.id;
            return (
              <button
                key={room.id}
                type="button"
                className={`da-room ${active ? 'is-active' : ''}`}
                style={{ 
                  '--room-accent': roomAccent(room.id),
                  '--room-image': `url(${roomImage(room.id)})`,
                  '--room-fill': `${Math.round((count / (manifest?.totalRelics || 1)) * 100)}%`
                } as React.CSSProperties}
                onClick={() => setSelectedRoom(room.id)}
              >
                <div className="da-room-bg" />
                <div className="da-room-fill" />
                <span className="da-room-sigil"><RealmSigil roomId={room.id} size={14} /></span>
                <span className="da-room-name">{room.name}</span>
                <span className="da-room-tone">{room.tone}</span>
                <span className="da-room-count">{count}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="da-records">
        <header className="da-records-header">
          <div>
            <span className="da-kicker">Sacred Sound Vault</span>
            <AnimatePresence mode="wait">
              <motion.h2
                key={selectedRoom}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
              >
                {rooms.find((room) => room.id === selectedRoom)?.name ?? 'Hall of Records'}
              </motion.h2>
            </AnimatePresence>
            <p>{visibleRelics.length} relics visible from {manifest?.totalRelics ?? 0} total</p>
          </div>
          <div className="da-search-tools">
            <div className="da-search">
              <Search size={14} />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Speak unto the Oracle..." />
            </div>
            <button type="button" className={viewMode === 'shelf' ? 'is-active' : ''} onClick={() => setViewMode('shelf')}><LayoutGrid size={14} /></button>
            <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}><List size={14} /></button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedRoom + viewMode}
            className={viewMode === 'shelf' ? 'da-relic-shelf' : 'da-relic-list'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            ref={relicListRef}
          >
            {visibleRelics.map((relic, index) => (
              <motion.button
                key={relic.id}
                type="button"
                className={`da-relic ${selectedRelic?.id === relic.id ? 'is-selected' : ''} ${playingPath === relic.path ? 'is-playing' : ''} ${recalledPath === relic.path ? 'is-recalled' : ''}`}
                style={{ 
                  '--room-accent': roomAccent(relic.room),
                  '--room-image': `url(${roomImage(relic.room)})`
                } as React.CSSProperties}
                onClick={() => handleAwaken(relic)}
                onDoubleClick={() => handleRecall(relic)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: Math.min(index * 0.012, 0.4) }}
                whileHover={{ scale: 1.015, transition: { duration: 0.15 } }}
                draggable
                onDragStart={(e: any) => {
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData('text/plain', JSON.stringify({ relicId: relic.id, path: relic.path }));
                }}
              >
                {viewMode === 'shelf' && <div className="da-relic-hero" />}
                <span className="da-relic-orb">
                  {playingPath === relic.path ? <EqBars /> : <RealmSigil roomId={relic.room} size={viewMode === 'shelf' ? 18 : 13} />}
                </span>
                <span className="da-relic-copy">
                  <strong>{relic.name}</strong>
                  <small>{relic.roomName} / {relic.sourceCategory}</small>
                </span>
                <span className="da-relic-tags">{relic.tags.slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}</span>
                <span className="da-relic-actions">
                  {playingPath === relic.path ? <Square size={12} /> : <Play size={12} />}
                  <b>{relic.format.toUpperCase()}</b>
                </span>
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      </section>

      <aside className="da-inspector">
        <AnimatePresence mode="wait">
          {selectedRelic ? (
            <motion.div
              key={selectedRelic.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
            >
              <RelicInspector
                relic={selectedRelic}
                isFavorite={favorites.has(selectedRelic.path)}
                isPlaying={playingPath === selectedRelic.path}
                hasPreviewError={previewErrorPath === selectedRelic.path}
                activePad={activePad}
                allRelics={manifest.relics}
                onSelectRelic={handleAwaken}
                onAwaken={() => handleAwaken(selectedRelic)}
                onRecall={() => handleRecall(selectedRelic)}
                onToggleFavorite={() => toggleFavorite(selectedRelic.path)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="da-inspector-empty"
            >
              <Archive size={28} /><span>Select a relic</span>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      <footer className="da-pad-bank" style={{ gridColumn: '1 / -1' }}>
        {Array.from({ length: 16 }).map((_, i) => {
          const domain = THRONE_DOMAINS[i];
          const sampleName = loadedPadNames ? loadedPadNames[i] : '';
          const isActive = activePad === i;
          return (
            <div
              key={i}
              className={`da-pad ${isActive ? 'active' : ''} ${sampleName ? 'loaded' : ''}`}
              style={{ '--da-pad-color': domain.color } as React.CSSProperties}
              onClick={() => onActivePadChange?.(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                try {
                  const dataStr = e.dataTransfer.getData('text/plain');
                  if (dataStr) {
                    const data = JSON.parse(dataStr);
                    if (data && data.path) {
                      const relic = manifest.relics.find((r) => r.path === data.path);
                      if (relic) {
                        engineRef.current?.loadSampleByPath(relic.path, i);
                        onLoadToPad?.(relic.path, i, relic);
                        setRecentRecalls((current) => [relic, ...current.filter((item) => item.path !== relic.path)].slice(0, 6));
                        setRecalledPath(relic.path);
                        if (recallTimerRef.current) clearTimeout(recallTimerRef.current);
                        recallTimerRef.current = setTimeout(() => setRecalledPath(null), 600);
                      }
                    }
                  }
                } catch (err) {
                  console.error('Failed to parse dropped relic:', err);
                }
              }}
            >
              <span className="da-pad-sigil">{domain.sigil}</span>
              <span className="da-pad-num">{(i + 1).toString().padStart(2, '0')}</span>
              {sampleName ? (
                <span className="da-pad-sample" title={sampleName}>{sampleName}</span>
              ) : (
                <span className="da-pad-domain">{domain.name}</span>
              )}
            </div>
          );
        })}
      </footer>
    </div>
  );
};
