import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Music, Play, Plus, Waves, Zap, Mic, Disc,
  LayoutGrid, List, Heart, Square, Volume2,
  // Category-specific icons
  Sparkles, Radio, Guitar as GuitarIcon, Piano, Lightbulb,
  Wind as WindIcon, Layers, Globe, Bell as BellIcon,
  Flame, Wand2, Headphones, CircleDot, Gauge,
  AudioWaveform, Sliders, Library
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════
   DIVINE ARCHIVE — The Celestial Browser
   Premium sample library for VST GOD
   713 samples · 20 categories
   ═══════════════════════════════════════════════ */

interface SampleInfo {
  name: string;
  path: string;
}

interface Manifest {
  name: string;
  categories: Record<string, SampleInfo[]>;
}

interface CelestialBrowserProps {
  engineRef: React.MutableRefObject<any>;
  onLoadToPad?: (samplePath: string, padIndex: number) => void;
  activePad: number;
}

/* ─── Category Icon Map ─── */
const CATEGORY_ICONS: Record<string, any> = {
  'All':         Library,
  'Accents':     Sparkles,
  'Analog':      Radio,
  'Bass':        AudioWaveform,
  'Bell':        BellIcon,
  'Ethnic':      Globe,
  'FX':          Zap,
  'Guitar':      GuitarIcon,
  'Keys':        Piano,
  'Leads':       Lightbulb,
  'Modulated':   Sliders,
  'Organ':       Headphones,
  'Pads':        Layers,
  'Pluck':       CircleDot,
  'Real Brass':  Gauge,
  'Strings':     Music,
  'Synth':       Wand2,
  'Synth Brass': Flame,
  'Texture':     Waves,
  'Vox':         Mic,
  'Wind':        WindIcon,
};

/* ─── Helpers ─── */
const getFormatBadge = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return ext === 'wav' ? 'WAV' : ext === 'ogg' ? 'OGG' : ext === 'mp3' ? 'MP3' : ext.toUpperCase();
};

const FAVORITES_KEY = 'vst-god-favorites';
const loadFavorites = (): Set<string> => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};
const saveFavorites = (favs: Set<string>) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
};

/* ─── Equalizer Bars (CSS-animated) ─── */
const EqBars = () => (
  <div className="da-eq-bars">
    <div className="da-eq-bar" />
    <div className="da-eq-bar" />
    <div className="da-eq-bar" />
    <div className="da-eq-bar" />
  </div>
);

/* ─── Skeleton Row ─── */
const SkeletonRow = ({ i }: { i: number }) => (
  <div
    className="flex items-center gap-4 p-3 rounded-lg"
    style={{ animationDelay: `${i * 80}ms` }}
  >
    <div className="da-skeleton w-9 h-9 rounded-lg flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="da-skeleton h-3 rounded-full w-2/3" />
      <div className="da-skeleton h-2 rounded-full w-1/4" />
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export const CelestialBrowser: React.FC<CelestialBrowserProps> = ({
  engineRef,
  onLoadToPad,
  activePad
}) => {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [loading, setLoading] = useState(true);
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);

  /* ─── Load Manifest ─── */
  useEffect(() => {
    fetch('/library_manifest.json')
      .then(res => res.json())
      .then(data => {
        setManifest(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load manifest:', err);
        setLoading(false);
      });
  }, []);

  /* ─── Category List ─── */
  const categories = useMemo(() => {
    if (!manifest) return [];
    return ['All', 'Favorites', ...Object.keys(manifest.categories).sort()];
  }, [manifest]);

  /* ─── Flatten all samples ─── */
  const allSamples = useMemo(() => {
    if (!manifest) return [];
    const flat: (SampleInfo & { category: string })[] = [];
    Object.entries(manifest.categories).forEach(([cat, samples]) => {
      samples.forEach(s => flat.push({ ...s, category: cat }));
    });
    return flat;
  }, [manifest]);

  /* ─── Total count ─── */
  const totalCount = allSamples.length;

  /* ─── Get count for a category ─── */
  const getCategoryCount = useCallback((cat: string) => {
    if (cat === 'All') return totalCount;
    if (cat === 'Favorites') return favorites.size;
    return manifest?.categories[cat]?.length ?? 0;
  }, [manifest, totalCount, favorites]);

  /* ─── Filtered Samples ─── */
  const filteredSamples = useMemo(() => {
    let result = allSamples;

    if (selectedCategory === 'Favorites') {
      result = result.filter(s => favorites.has(s.path));
    } else if (selectedCategory !== 'All') {
      result = result.filter(s => s.category === selectedCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allSamples, selectedCategory, searchQuery, favorites]);

  /* ─── Audition ─── */
  const handleAudition = useCallback((path: string) => {
    if (playingPath === path) {
      // Stop if same sample clicked again
      setPlayingPath(null);
      return;
    }
    setPlayingPath(path);
    if (engineRef.current) {
      engineRef.current.previewSample(path);
    }
  }, [playingPath, engineRef]);

  /* ─── Load to Pad ─── */
  const handleLoad = useCallback((path: string) => {
    if (engineRef.current) {
      engineRef.current.loadSampleByPath(path, activePad);
    }
  }, [engineRef, activePad]);

  /* ─── Toggle Favorite ─── */
  const toggleFavorite = useCallback((path: string) => {
    setFavorites(prev => {
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

  /* ═══════════════════════════════════════════════
     LOADING STATE — Premium Skeleton
     ═══════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="flex h-full gap-4 p-4 overflow-hidden">
        {/* Skeleton Sidebar */}
        <div className="w-56 flex flex-col gap-3 glass-panel p-4 bg-black/40 border border-white/5 rounded-xl">
          <div className="da-skeleton h-3 w-24 rounded-full mb-2" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="da-skeleton h-8 rounded-lg" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        {/* Skeleton Main */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="da-skeleton h-14 rounded-xl" />
          <div className="da-skeleton h-2 rounded-full" />
          <div className="flex-1 space-y-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonRow key={i} i={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     RENDER — Divine Archive
     ═══════════════════════════════════════════════ */
  return (
    <div className="flex h-full gap-0 overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ─── CATEGORY SIDEBAR ─── */}
      <div
        className="w-52 flex flex-col border-r border-white/5"
        style={{ background: 'rgba(8, 8, 12, 0.6)' }}
      >
        {/* Sidebar Header */}
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-[9px] font-black text-white/25 uppercase tracking-[0.25em]">
            Categories
          </h3>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto glass-scroll px-2 pb-2 space-y-0.5">
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat] || (cat === 'Favorites' ? Heart : Disc);
            const isActive = selectedCategory === cat;
            const count = getCategoryCount(cat);
            const isFavorites = cat === 'Favorites';

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`
                  w-full flex items-center justify-between px-3 py-[7px] rounded-lg transition-all text-left
                  border border-transparent
                  ${isActive
                    ? 'da-cat-active text-orange-400'
                    : isFavorites
                      ? 'text-white/30 hover:bg-white/[0.03] hover:text-orange-400/60'
                      : 'text-white/35 hover:bg-white/[0.03] hover:text-white/55'
                  }
                `}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    size={13}
                    className={`flex-shrink-0 ${isActive
                      ? 'text-orange-500'
                      : isFavorites
                        ? 'text-orange-500/30'
                        : 'opacity-35'
                    }`}
                  />
                  <span className="text-[11px] font-semibold truncate">{cat}</span>
                </div>
                <span
                  className={`text-[9px] font-mono flex-shrink-0 ${
                    isActive ? 'text-orange-500/60' : 'opacity-25'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── MAIN AREA ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ─── HEADER BAR ─── */}
        <div className="flex items-center justify-between px-5 py-3" style={{ background: 'rgba(8, 8, 12, 0.4)' }}>
          {/* Left: Title + Stats */}
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-[13px] font-black text-white/80 tracking-wide">
                {selectedCategory === 'All' ? 'DIVINE ARCHIVE' : selectedCategory.toUpperCase()}
              </h2>
              <p className="text-[9px] text-white/20 font-mono tracking-wider">
                {filteredSamples.length} {filteredSamples.length === 1 ? 'SAMPLE' : 'SAMPLES'}
                {searchQuery && ` · "${searchQuery.toUpperCase()}"`}
                {selectedCategory === 'All' && ` · ${Object.keys(manifest?.categories || {}).length} CATEGORIES`}
              </p>
            </div>

            {/* Now Playing Display */}
            <AnimatePresence>
              {playingPath && (
                <motion.div
                  initial={{ opacity: 0, x: -10, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -10, scale: 0.9 }}
                  className="da-now-playing"
                >
                  <EqBars />
                  <span className="text-[10px] font-bold text-orange-400 max-w-[180px] truncate">
                    {playingPath.split('/').pop()?.replace(/\.[^.]+$/, '')}
                  </span>
                  <button
                    onClick={() => setPlayingPath(null)}
                    className="text-white/20 hover:text-white/60 transition-colors"
                  >
                    <Square size={10} fill="currentColor" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Search + View Toggle */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/15" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 bg-black/30 border border-white/[0.06] rounded-full pl-9 pr-4 py-1.5 text-[11px] text-white/80 focus:border-orange-500/30 outline-none placeholder:text-white/15 transition-colors"
                placeholder="Search divine archive..."
              />
            </div>
            <div className="flex gap-1 bg-black/30 p-0.5 rounded-lg border border-white/[0.04]">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list'
                  ? 'bg-orange-500/15 text-orange-400 shadow-sm'
                  : 'text-white/20 hover:text-white/40'
                }`}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid'
                  ? 'bg-orange-500/15 text-orange-400 shadow-sm'
                  : 'text-white/20 hover:text-white/40'
                }`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ─── HEADER DIVIDER ─── */}
        <div className="da-header-line" />

        {/* ─── SAMPLE LIST / GRID ─── */}
        <div className="flex-1 overflow-y-auto glass-scroll">
          {viewMode === 'list' ? (
            /* ═══ LIST VIEW ═══ */
            <div className="px-2 py-1">
              {filteredSamples.map((sample, idx) => {
                const isPlaying = playingPath === sample.path;
                const isFav = favorites.has(sample.path);
                const format = getFormatBadge(sample.path);

                return (
                  <motion.div
                    initial={idx < 50 ? { opacity: 0, x: -8 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx < 50 ? idx * 0.008 : 0 }}
                    key={sample.path}
                    className={`
                      group flex items-center justify-between px-3 py-2 mx-1 rounded-lg
                      border border-transparent transition-all cursor-pointer da-row-alt
                      ${isPlaying
                        ? 'da-row-playing'
                        : 'hover:bg-white/[0.025] hover:border-white/[0.04]'
                      }
                    `}
                    onClick={() => handleAudition(sample.path)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      handleLoad(sample.path);
                    }}
                  >
                    {/* Left Side */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Play Icon / EQ Bars */}
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
                        ${isPlaying
                          ? 'bg-orange-500/15'
                          : 'bg-white/[0.02] group-hover:bg-orange-500/10'
                        }
                      `}>
                        {isPlaying ? (
                          <EqBars />
                        ) : (
                          <Play
                            size={12}
                            fill="currentColor"
                            className="text-white/15 group-hover:text-orange-500/70 transition-colors"
                          />
                        )}
                      </div>

                      {/* Name + Category */}
                      <div className="min-w-0 flex-1">
                        <div className={`text-[11px] font-semibold truncate ${
                          isPlaying ? 'text-orange-400' : 'text-white/70 group-hover:text-white/90'
                        }`}>
                          {sample.name}
                        </div>
                        <div className="text-[8px] font-bold text-white/15 uppercase tracking-[0.1em]">
                          {sample.category}
                        </div>
                      </div>
                    </div>

                    {/* Right Side */}
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {/* Format Badge */}
                      <span className="da-format-badge">{format}</span>

                      {/* Favorite */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(sample.path);
                        }}
                        className={`da-fav-btn ${isFav ? 'is-fav' : ''}`}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {isFav ? '♥' : '♡'}
                      </button>

                      {/* Load to Pad */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoad(sample.path);
                        }}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded text-[9px] font-bold transition-all whitespace-nowrap"
                      >
                        <Plus size={10} strokeWidth={3} />
                        PAD {activePad + 1}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* ═══ GRID VIEW ═══ */
            <div className="grid grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 p-4">
              {filteredSamples.map((sample, idx) => {
                const isPlaying = playingPath === sample.path;
                const isFav = favorites.has(sample.path);
                const format = getFormatBadge(sample.path);
                const CatIcon = CATEGORY_ICONS[sample.category] || Disc;

                return (
                  <motion.div
                    initial={idx < 40 ? { opacity: 0, scale: 0.92 } : false}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx < 40 ? idx * 0.01 : 0 }}
                    key={sample.path}
                    onClick={() => handleAudition(sample.path)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      handleLoad(sample.path);
                    }}
                    className={`
                      da-grid-card aspect-[4/3] glass-panel rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer group
                      border
                      ${isPlaying
                        ? 'border-orange-500/25 bg-orange-500/[0.04]'
                        : 'border-white/[0.04]'
                      }
                    `}
                  >
                    {/* Top-right: Format + Fav */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <span className="da-format-badge">{format}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(sample.path);
                        }}
                        className={`da-fav-btn ${isFav ? 'is-fav' : ''}`}
                        style={{ opacity: isFav ? 1 : undefined }}
                      >
                        {isFav ? '♥' : '♡'}
                      </button>
                    </div>

                    {/* Top-left: Category Icon */}
                    <div className="absolute top-2.5 left-2.5 text-white/[0.06] group-hover:text-orange-500/15 transition-colors">
                      <CatIcon size={18} />
                    </div>

                    {/* Center: Play Button */}
                    <div className={`
                      w-11 h-11 rounded-full flex items-center justify-center transition-all
                      ${isPlaying
                        ? 'bg-orange-500/20 ring-2 ring-orange-500/20'
                        : 'bg-white/[0.03] group-hover:bg-orange-500/10 shadow-inner'
                      }
                    `}>
                      {isPlaying ? (
                        <EqBars />
                      ) : (
                        <Play
                          size={16}
                          fill="currentColor"
                          className="text-white/15 group-hover:text-orange-500/60 transition-colors ml-0.5"
                        />
                      )}
                    </div>

                    {/* Sample Name */}
                    <div className="text-center px-1 w-full">
                      <div className={`text-[10px] font-bold truncate ${
                        isPlaying ? 'text-orange-400' : 'text-white/60 group-hover:text-white/85'
                      }`}>
                        {sample.name}
                      </div>
                      <div className="text-[8px] font-bold text-white/15 uppercase tracking-widest mt-0.5">
                        {sample.category}
                      </div>
                    </div>

                    {/* Slide-up Action Bar */}
                    <div className="da-grid-action bg-gradient-to-t from-orange-500/90 to-orange-600/80 backdrop-blur-sm py-2 text-center rounded-b-xl">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoad(sample.path);
                        }}
                        className="text-white text-[9px] font-black tracking-wider"
                      >
                        LOAD TO PAD {activePad + 1}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ─── EMPTY STATE ─── */}
          {filteredSamples.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-white/10">
              {selectedCategory === 'Favorites' && !searchQuery ? (
                <>
                  <Heart size={40} strokeWidth={1} />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] mt-4">
                    No favorites yet
                  </span>
                  <span className="text-[9px] text-white/8 mt-1">
                    Click ♡ on any sample to add to favorites
                  </span>
                </>
              ) : (
                <>
                  <Search size={40} strokeWidth={1} />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] mt-4">
                    No samples found
                  </span>
                  <span className="text-[9px] text-white/8 mt-1">
                    Try adjusting your search or category
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── BOTTOM STATUS BAR ─── */}
        <div
          className="flex items-center justify-between px-5 py-1.5 border-t border-white/[0.04]"
          style={{ background: 'rgba(6, 6, 10, 0.5)' }}
        >
          <span className="text-[8px] font-mono text-white/12 tracking-wider">
            DIVINE ARCHIVE v1.0 · {totalCount} SAMPLES · {Object.keys(manifest?.categories || {}).length} CATEGORIES
          </span>
          <span className="text-[8px] font-mono text-white/12 tracking-wider">
            DOUBLE-CLICK TO LOAD · CLICK TO AUDITION
          </span>
        </div>
      </div>
    </div>
  );
};
