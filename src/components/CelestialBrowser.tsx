import React, { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Eye,
  Heart,
  LayoutGrid,
  List,
  Play,
  Search,
  Sparkles,
  Square,
  Waves,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArchiveViewMode,
  DivineArchiveManifest,
  DivineRelic,
  filterRelics,
  getRoomCount,
  pickSelectedRelic,
  roomAccent,
} from '@/archive/divineArchive';
import type { SamplePreviewController } from '@/engine/samplerEngine';

interface CelestialBrowserProps {
  engineRef: React.MutableRefObject<any>;
  onLoadToPad?: (samplePath: string, padIndex: number) => void;
  activePad: number;
}

interface RelicInspectorProps {
  relic: DivineRelic;
  isFavorite: boolean;
  isPlaying: boolean;
  hasPreviewError: boolean;
  activePad: number;
  onAwaken: () => void;
  onRecall: () => void;
  onToggleFavorite: () => void;
}

const FAVORITES_KEY = 'vst-god-favorites';

const cssVarsForRoom = (roomId: string): CSSProperties => ({
  '--room-accent': roomAccent(roomId),
} as CSSProperties);

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
  onToggleFavorite,
}: RelicInspectorProps) => (
  <div className="da-inspector-card" style={cssVarsForRoom(relic.room)}>
    <div className="da-inspector-orb">
      <Eye size={22} />
    </div>
    <span className="da-kicker">{relic.roomName}</span>
    <h3>{relic.name}</h3>
    <p>{relic.tone}</p>

    <div className="da-aura-ring">
      {isPlaying ? <EqBars /> : <Waves size={34} />}
    </div>

    <dl>
      <div>
        <dt>Category</dt>
        <dd>{relic.sourceCategory}</dd>
      </div>
      <div>
        <dt>Format</dt>
        <dd>{relic.format.toUpperCase()}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{hasPreviewError ? 'Preview failed' : 'Verified archive relic'}</dd>
      </div>
    </dl>

    <div className="da-tag-cloud">
      {relic.tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>

    <div className="da-inspector-actions">
      <button type="button" onClick={onAwaken}>
        {isPlaying ? 'Stop Awakening' : 'Awaken'}
      </button>
      <button type="button" onClick={onRecall}>
        Recall to Pad {activePad + 1}
      </button>
      <button type="button" onClick={onToggleFavorite}>
        {isFavorite ? 'Marked' : 'Mark Relic'}
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
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ArchiveViewMode>('shelf');
  const [selectedRelic, setSelectedRelic] = useState<DivineRelic | null>(null);
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [previewErrorPath, setPreviewErrorPath] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [recentRecalls, setRecentRecalls] = useState<DivineRelic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const previewRef = useRef<SamplePreviewController | null>(null);

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

  useEffect(() => () => {
    previewRef.current?.stop();
    previewRef.current = null;
  }, []);

  const rooms = useMemo(() => {
    if (!manifest) return [];
    return [
      { id: 'all', name: 'All Records', tone: 'Every relic in the vault', keywords: [] },
      { id: 'favorites', name: 'Marked Relics', tone: 'Favorites preserved for recall', keywords: [] },
      ...manifest.rooms,
    ];
  }, [manifest]);

  const visibleRelics = useMemo(() => {
    if (!manifest) return [];
    return filterRelics(manifest.relics, selectedRoom, searchQuery, favorites);
  }, [favorites, manifest, searchQuery, selectedRoom]);

  useEffect(() => {
    setSelectedRelic((current) => pickSelectedRelic(current, visibleRelics));
  }, [visibleRelics]);

  const selectedRoomMeta = useMemo(
    () => rooms.find((room) => room.id === selectedRoom) ?? rooms[0],
    [rooms, selectedRoom],
  );

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
    previewRef.current = null;
    setPlayingPath(relic.path);

    const controller = await engineRef.current?.previewSample(relic.path);
    if (!controller) {
      setPlayingPath((current) => (current === relic.path ? null : current));
      setPreviewErrorPath(relic.path);
      return;
    }

    previewRef.current = controller;
    controller.finished.then(() => {
      setPlayingPath((current) => (current === relic.path ? null : current));
      if (previewRef.current?.path === relic.path) {
        previewRef.current = null;
      }
    });
  }, [engineRef, playingPath]);

  const handleRecall = useCallback((relic: DivineRelic) => {
    setSelectedRelic(relic);
    engineRef.current?.loadSampleByPath(relic.path, activePad);
    onLoadToPad?.(relic.path, activePad);
    setRecentRecalls((current) => [
      relic,
      ...current.filter((item) => item.path !== relic.path),
    ].slice(0, 6));
  }, [activePad, engineRef, onLoadToPad]);

  if (loading) {
    return <LoadingRecords />;
  }

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
      <aside className="da-room-nav">
        <div className="da-room-title">
          <span>Divine Archive</span>
          <strong>Hall of Records</strong>
        </div>

        <div className="da-room-list">
          {rooms.map((room) => {
            const count = room.id === 'all'
              ? manifest.totalRelics
              : room.id === 'favorites'
                ? favorites.size
                : getRoomCount(manifest.relics, room.id);
            const active = selectedRoom === room.id;

            return (
              <button
                key={room.id}
                type="button"
                className={`da-room ${active ? 'is-active' : ''}`}
                style={cssVarsForRoom(room.id)}
                onClick={() => setSelectedRoom(room.id)}
              >
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
            <h2>{selectedRoomMeta?.name ?? 'Hall of Records'}</h2>
            <p>{visibleRelics.length} relics visible from {manifest.totalRelics} total</p>
          </div>

          <div className="da-search-tools">
            <div className="da-search">
              <Search size={14} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search relic, room, category, tag..."
              />
            </div>
            <button
              type="button"
              className={viewMode === 'shelf' ? 'is-active' : ''}
              onClick={() => setViewMode('shelf')}
              aria-label="Shelf view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'is-active' : ''}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List size={14} />
            </button>
          </div>
        </header>

        <div className={viewMode === 'shelf' ? 'da-relic-shelf' : 'da-relic-list'}>
          <AnimatePresence mode="popLayout">
            {visibleRelics.map((relic, idx) => {
              const isPlaying = playingPath === relic.path;
              const isSelected = selectedRelic?.id === relic.id;
              const isFavorite = favorites.has(relic.path);

              return (
                <motion.button
                  key={relic.id}
                  type="button"
                  initial={idx < 40 ? { opacity: 0, y: 10 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ delay: idx < 40 ? idx * 0.008 : 0 }}
                  className={`da-relic ${isSelected ? 'is-selected' : ''} ${isPlaying ? 'is-playing' : ''}`}
                  style={cssVarsForRoom(relic.room)}
                  onClick={() => handleAwaken(relic)}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    handleRecall(relic);
                  }}
                >
                  <span className="da-relic-orb">
                    {isPlaying ? <EqBars /> : <Sparkles size={viewMode === 'shelf' ? 18 : 13} />}
                  </span>
                  <span className="da-relic-copy">
                    <strong>{relic.name}</strong>
                    <small>{relic.roomName} / {relic.sourceCategory}</small>
                  </span>
                  <span className="da-relic-tags">
                    {relic.tags.slice(0, 3).map((tag) => (
                      <em key={tag}>{tag}</em>
                    ))}
                  </span>
                  <span className="da-relic-actions">
                    {isFavorite && <Heart size={12} fill="currentColor" />}
                    {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                    <b>{relic.format.toUpperCase()}</b>
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>

          {visibleRelics.length === 0 && (
            <div className="da-empty-records">
              <Archive size={34} />
              <h3>No relics found</h3>
              <p>Adjust the room, favorites, or search phrase.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="da-inspector">
        {selectedRelic ? (
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
        ) : (
          <div className="da-inspector-empty">
            <Archive size={28} />
            <span>Select a relic</span>
          </div>
        )}
      </aside>

      <footer className="da-recall-strip">
        <span>Active Pad {activePad + 1}</span>
        <div>
          {recentRecalls.length > 0 ? (
            recentRecalls.map((relic) => (
              <button
                key={relic.path}
                type="button"
                onClick={() => handleRecall(relic)}
                title={relic.name}
              >
                {relic.name}
              </button>
            ))
          ) : (
            <small>No recalls in this session</small>
          )}
        </div>
        <span>{playingPath ? 'Awakening Relic' : 'Archive Ready'}</span>
      </footer>
    </div>
  );
};
