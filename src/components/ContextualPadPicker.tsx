/**
 * ContextualPadPicker.tsx — Compact Archive Browser Overlay
 * Opens as a floating panel anchored to a specific pad/throne.
 * Lets you search, preview, and assign samples without leaving the current view.
 *
 * Features:
 * - Search + category filter
 * - Click-to-preview, double-click-to-assign
 * - Shows target pad info at top
 * - Closes after assignment or manually
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Play, Square, Check, X } from 'lucide-react';
import type { ThroneDomain } from '@/data/throneDomains';

interface MergedSample {
  id: string;
  name: string;
  path: string;
  category: string;
  format: string;
  semanticTags: string[];
  energy: number;
}

interface ContextualPadPickerProps {
  isOpen: boolean;
  onClose: () => void;
  targetPadIndex: number;
  targetDomain: ThroneDomain;
  /** Current sample name on the target pad */
  currentSampleName?: string;
  /** Engine ref for audio preview and loading */
  engineRef: React.MutableRefObject<any>;
  /** Callback when a sample is assigned */
  onAssign: (samplePath: string, padIndex: number, sampleName: string, category: string) => void;
}

const REALM_ICONS: Record<string, string> = {
  Accents: '✦', Analog: '⚡', Bass: '🔱', Bell: '🔔', Ethnic: '🏛',
  FX: '🌀', Guitar: '🎸', Keys: '🎹', Leads: '⚔', Modulated: '🌊',
  Organ: '⛪', Pads: '☁', Pluck: '🌿', 'Real Brass': '🏆',
  Strings: '🎻', Synth: '💎', 'Synth Brass': '📯', Texture: '🌌',
  Vox: '🗣', Wind: '🌬',
};

export const ContextualPadPicker: React.FC<ContextualPadPickerProps> = ({
  isOpen,
  onClose,
  targetPadIndex,
  targetDomain,
  currentSampleName,
  engineRef,
  onAssign,
}) => {
  const [samples, setSamples] = useState<MergedSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [assignedPath, setAssignedPath] = useState<string | null>(null);

  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewGainRef = useRef<GainNode | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Load manifest on open
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setSearchQuery('');
    setSelectedCategory('All');
    setAssignedPath(null);

    Promise.allSettled([
      fetch('/library_manifest.json').then(r => r.json()),
      fetch('/akashic_manifest.json').then(r => r.json()),
    ]).then(([libRes, akRes]) => {
      const libData = libRes.status === 'fulfilled' ? libRes.value : null;
      const akData = akRes.status === 'fulfilled' ? akRes.value : null;

      const akLookup = new Map<string, any>();
      if (akData?.categories) {
        Object.entries(akData.categories).forEach(([cat, arr]: [string, any]) => {
          (arr as any[]).forEach(s => akLookup.set(`${cat}::${s.name}`, s));
        });
      }

      const merged: MergedSample[] = [];
      if (libData?.categories) {
        Object.entries(libData.categories).forEach(([cat, arr]: [string, any]) => {
          (arr as any[]).forEach((s: any) => {
            const ak = akLookup.get(`${cat}::${s.name}`);
            merged.push({
              id: ak?.id || `${cat}-${s.name}-${Math.random().toString(36).slice(2, 8)}`,
              name: s.name,
              path: s.path,
              category: cat,
              format: s.format || 'ogg',
              semanticTags: ak?.semanticTags || [],
              energy: ak?.acousticProfile?.energy ?? Math.floor(Math.random() * 60 + 20),
            });
          });
        });
      }

      setSamples(merged);
      setLoading(false);

      // Auto-focus search
      requestAnimationFrame(() => searchInputRef.current?.focus());
    });
  }, [isOpen]);

  // Derived
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    samples.forEach(s => cats.set(s.category, (cats.get(s.category) || 0) + 1));
    return Array.from(cats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [samples]);

  const filtered = useMemo(() => {
    let result = samples;
    if (selectedCategory !== 'All') {
      result = result.filter(s => s.category === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.semanticTags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [samples, selectedCategory, searchQuery]);

  // Preview
  const stopPreview = useCallback(() => {
    try { previewSourceRef.current?.stop(); } catch {}
    try { previewGainRef.current?.disconnect(); } catch {}
    previewSourceRef.current = null;
    previewGainRef.current = null;
    setPlayingPath(null);
  }, []);

  const playPreview = useCallback(async (sample: MergedSample) => {
    stopPreview();
    const engine = engineRef.current;
    if (!engine) return;
    if (!engine.ctx) { try { await engine.init(); } catch { return; } }
    const ctx: AudioContext = engine.ctx;
    if (ctx.state === 'suspended') await ctx.resume();

    try {
      const res = await fetch(sample.path);
      if (!res.ok) return;
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0.7;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
      previewSourceRef.current = src;
      previewGainRef.current = gain;
      setPlayingPath(sample.path);
      src.onended = () => {
        gain.disconnect();
        src.disconnect();
        if (previewSourceRef.current === src) {
          previewSourceRef.current = null;
          setPlayingPath(null);
        }
      };
    } catch {}
  }, [engineRef, stopPreview]);

  const handleAssign = useCallback((sample: MergedSample) => {
    stopPreview();
    onAssign(sample.path, targetPadIndex, sample.name, sample.category);
    setAssignedPath(sample.path);

    // Auto-close after brief flash
    setTimeout(() => onClose(), 600);
  }, [stopPreview, onAssign, targetPadIndex, onClose]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) stopPreview();
  }, [isOpen, stopPreview]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="cpp-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="cpp-panel"
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: 'spring', bounce: 0.1, duration: 0.35 }}
          onClick={e => e.stopPropagation()}
          style={{ '--cpp-accent': targetDomain.color } as React.CSSProperties}
        >
          {/* Header */}
          <div className="cpp-header">
            <div className="cpp-target">
              <span className="cpp-target-sigil">{targetDomain.sigil}</span>
              <div className="cpp-target-info">
                <span className="cpp-target-label">ASSIGN TO PAD {targetPadIndex + 1}</span>
                <span className="cpp-target-domain">{targetDomain.name}</span>
                {currentSampleName && (
                  <span className="cpp-target-current">Current: {currentSampleName}</span>
                )}
              </div>
            </div>
            <button className="cpp-close" onClick={onClose}><X size={14} /></button>
          </div>

          {/* Search */}
          <div className="cpp-search">
            <Search size={13} className="cpp-search-icon" />
            <input
              ref={searchInputRef}
              className="cpp-search-input"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search the archive…"
            />
            <span className="cpp-search-count">{filtered.length}</span>
          </div>

          {/* Category Chips */}
          <div className="cpp-cats">
            <button
              className={`cpp-cat ${selectedCategory === 'All' ? 'cpp-cat--active' : ''}`}
              onClick={() => setSelectedCategory('All')}
            >
              ALL
            </button>
            {categories.map(([cat, count]) => (
              <button
                key={cat}
                className={`cpp-cat ${selectedCategory === cat ? 'cpp-cat--active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {REALM_ICONS[cat] || '◇'} {cat} <span className="cpp-cat-count">{count}</span>
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="cpp-results">
            {loading ? (
              <div className="cpp-empty">Summoning archive…</div>
            ) : filtered.length === 0 ? (
              <div className="cpp-empty">No relics found</div>
            ) : (
              filtered.slice(0, 100).map(sample => (
                <div
                  key={sample.id}
                  className={[
                    'cpp-relic',
                    playingPath === sample.path ? 'cpp-relic--playing' : '',
                    assignedPath === sample.path ? 'cpp-relic--assigned' : '',
                  ].join(' ')}
                  onClick={() => playPreview(sample)}
                  onDoubleClick={() => handleAssign(sample)}
                >
                  <button
                    className="cpp-relic-play"
                    onClick={e => {
                      e.stopPropagation();
                      if (playingPath === sample.path) {
                        stopPreview();
                      } else {
                        playPreview(sample);
                      }
                    }}
                  >
                    {playingPath === sample.path
                      ? <Square size={9} fill="currentColor" />
                      : <Play size={9} fill="currentColor" />
                    }
                  </button>
                  <span className="cpp-relic-name">{sample.name}</span>
                  <span className="cpp-relic-cat">{sample.category}</span>
                  <div className="cpp-relic-energy">
                    <div
                      className="cpp-relic-energy-fill"
                      style={{ width: `${sample.energy}%` }}
                    />
                  </div>
                  <button
                    className="cpp-relic-assign"
                    onClick={e => {
                      e.stopPropagation();
                      handleAssign(sample);
                    }}
                    title={`Assign to Pad ${targetPadIndex + 1}`}
                  >
                    {assignedPath === sample.path ? <Check size={11} /> : '→'}
                  </button>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
