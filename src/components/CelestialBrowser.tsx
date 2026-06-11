import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Play, Plus, Heart, Square, Library, Sparkles, ScrollText,
  LayoutGrid, List, Volume2, Shield, Flame, Waves, Archive, Eye,
  Sword, Skull, Sun, CircleDot, Landmark, Zap, Music2, Hammer, Origami, Leaf, Star, BookOpen
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
const WaveformOracle: React.FC<{ accent: string; active: boolean }> = ({ accent, active }) => {
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

      if (!active) {
        // Dormant state — faint baseline
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      t += 0.025;

      // Layer 1: primary wave — bold golden sine
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const y = h / 2 +
          Math.sin(nx * Math.PI * 4 + t * 2.5) * h * 0.22 +
          Math.sin(nx * Math.PI * 7 + t * 1.8) * h * 0.08 +
          Math.sin(nx * Math.PI * 13 + t * 3.2) * h * 0.04;
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
        const y = h / 2 +
          Math.sin(nx * Math.PI * 9 + t * 3.5) * h * 0.14 +
          Math.cos(nx * Math.PI * 3 + t * 1.2) * h * 0.10;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Layer 3: sub-harmonic — very faint, slow
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.08;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const y = h / 2 +
          Math.sin(nx * Math.PI * 2 + t * 0.8) * h * 0.30;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Glow particles at wave peaks
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = accent;
      for (let i = 0; i < 5; i++) {
        const px = (Math.sin(t * (0.7 + i * 0.3) + i * 1.7) * 0.5 + 0.5) * w;
        const py = h / 2 + Math.sin(px / w * Math.PI * 4 + t * 2.5) * h * 0.22;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i * 2);
        const r = 1.5 + pulse * 2;
        ctx.globalAlpha = 0.3 + pulse * 0.4;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        // Outer glow
        ctx.globalAlpha = 0.08 + pulse * 0.06;
        ctx.beginPath();
        ctx.arc(px, py, r * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [accent, active]);

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
  onAwaken,
  onRecall,
  onToggleFavorite
}: {
  relic: DivineRelic;
  isFavorite: boolean;
  isPlaying: boolean;
  hasPreviewError: boolean;
  activePad: number;
  onAwaken: () => void;
  onRecall: () => void;
  onToggleFavorite: () => void;
}) => (
  <div className={`da-inspector-card ${isPlaying ? 'is-playing' : ''}`} style={{ '--room-accent': roomAccent(relic.room) } as React.CSSProperties}>
    <div className="da-inspector-header" style={{ '--room-image': `url(${roomImage(relic.room)})` } as React.CSSProperties}>
      <WaveformOracle accent={roomAccent(relic.room)} active={isPlaying} />
      <div className={`da-inspector-orb ${isPlaying ? 'is-pulsing' : ''}`}>
        {isPlaying ? <Volume2 size={22} /> : <Eye size={22} />}
      </div>
    </div>
    <span className="da-kicker">{relic.roomName}</span>
    <h3>{relic.name}</h3>
    <p>{relic.tone}</p>
    <div className="da-aura-ring">{isPlaying ? <EqBars /> : <Waves size={34} />}</div>
    <dl>
      <div><dt>Category</dt><dd>{relic.sourceCategory}</dd></div>
      <div><dt>Format</dt><dd>{relic.format.toUpperCase()}</dd></div>
      <div><dt>Status</dt><dd>{isPlaying ? '◉ Awakened' : hasPreviewError ? '⚠ Preview failed' : '○ Dormant'}</dd></div>
    </dl>
    <div className="da-tag-cloud">{relic.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
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

export const CelestialBrowser: React.FC<CelestialBrowserProps> = ({
  engineRef,
  onLoadToPad,
  activePad,
}) => {
  const [manifest, setManifest] = useState<DivineArchiveManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    <div className="da-hall-shell">
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

      <footer className="da-recall-strip">
        <span>ACTIVE PAD {activePad + 1}</span>
        <div>
          {recentRecalls.map((relic, i) => (
            <motion.button
              key={relic.path}
              onClick={() => handleRecall(relic)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15, delay: i * 0.04 }}
              style={{ '--room-accent': roomAccent(relic.room) } as React.CSSProperties}
            >
              {relic.name}
            </motion.button>
          ))}
        </div>
        <span>{recalledPath ? 'RELIC RECALLED ✦' : playingPath ? 'AWAKENING RELIC' : 'ARCHIVE READY'}</span>
      </footer>
    </div>
  );
};
