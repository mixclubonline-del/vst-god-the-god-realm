import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Play, Square, Plus, Bookmark, LayoutGrid, List, Sparkles, Music } from 'lucide-react';
import { RelicWaveform } from './RelicWaveform';
import { THRONE_DOMAINS } from '../data/throneDomains';
import './DivineArchive.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MergedSample {
  id: string;
  name: string;
  path: string;
  category: string;
  format: string;
  semanticTags: string[];
  energy: number;
  spectralCentroid: number;
  decayTime: number;
  fundamentalFreq: number;
  relatedIds: string[];
}

interface DivineArchiveProps {
  engineRef: React.MutableRefObject<any>;
  activePad: number;
  onActivePadChange?: (pad: number) => void;
  loadedPadNames?: string[];
}

// ─── Realm Mapping (both realm name + category name) ─────────────────────────

const REALM_MAP: Record<string, { realm: string; icon: string }> = {
  'Accents':     { realm: 'Celestial Sparks', icon: '✦' },
  'Analog':      { realm: 'Forgotten Circuits', icon: '⚡' },
  'Bass':        { realm: 'The Underworld', icon: '🔱' },
  'Bell':        { realm: 'Crystal Spire', icon: '🔔' },
  'Ethnic':      { realm: 'Ancient Ruins', icon: '🏛' },
  'FX':          { realm: 'The Void', icon: '🌀' },
  'Guitar':      { realm: 'Iron Forge', icon: '🎸' },
  'Keys':        { realm: 'Ivory Temple', icon: '🎹' },
  'Leads':       { realm: 'Lightning Ridge', icon: '⚔' },
  'Modulated':   { realm: 'Shifting Planes', icon: '🌊' },
  'Organ':       { realm: 'Cathedral',  icon: '⛪' },
  'Pads':        { realm: 'Cloud Palace', icon: '☁' },
  'Pluck':       { realm: 'String Garden', icon: '🌿' },
  'Real Brass':  { realm: 'Olympus Gate', icon: '🏆' },
  'Strings':     { realm: 'Silk Chamber', icon: '🎻' },
  'Synth':       { realm: 'Neon Abyss', icon: '💎' },
  'Synth Brass': { realm: 'Titan Horn', icon: '📯' },
  'Texture':     { realm: 'Nebula Field', icon: '🌌' },
  'Vox':         { realm: 'Echo Sanctum', icon: '🗣' },
  'Wind':        { realm: 'Storm Peak', icon: '🌬' },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const DivineArchive: React.FC<DivineArchiveProps> = ({
  engineRef,
  activePad,
  onActivePadChange,
  loadedPadNames = [],
}) => {
  const [allSamples, setAllSamples] = useState<MergedSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSample, setSelectedSample] = useState<MergedSample | null>(null);
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewGainRef = useRef<GainNode | null>(null);

  // ─── Load & Merge Both Manifests ─────────────────────────────────────────

  useEffect(() => {
    const loadBoth = async () => {
      try {
        // Load both manifests in parallel
        const [libRes, akRes] = await Promise.allSettled([
          fetch('/library_manifest.json').then(r => r.json()),
          fetch('/akashic_manifest.json').then(r => r.json()),
        ]);

        const libData = libRes.status === 'fulfilled' ? libRes.value : null;
        const akData = akRes.status === 'fulfilled' ? akRes.value : null;

        // Build akashic lookup by name+category for enrichment
        const akashicLookup = new Map<string, any>();
        if (akData?.categories) {
          Object.entries(akData.categories).forEach(([cat, samples]: [string, any]) => {
            (samples as any[]).forEach(s => {
              akashicLookup.set(`${cat}::${s.name}`, s);
            });
          });
        }

        // Merge: library_manifest is the 713-sample base
        const merged: MergedSample[] = [];

        if (libData?.categories) {
          Object.entries(libData.categories).forEach(([cat, samples]: [string, any]) => {
            (samples as any[]).forEach((s: any) => {
              const akMatch = akashicLookup.get(`${cat}::${s.name}`);
              merged.push({
                id: akMatch?.id || `${cat}-${s.name}-${Math.random().toString(36).slice(2, 8)}`,
                name: s.name,
                path: s.path,
                category: cat,
                format: s.format || 'ogg',
                semanticTags: akMatch?.semanticTags || [],
                energy: akMatch?.acousticProfile?.energy ?? Math.floor(Math.random() * 60 + 20),
                spectralCentroid: akMatch?.acousticProfile?.peakFrequency ?? 1000,
                decayTime: akMatch?.acousticProfile?.decayTime ?? 0.5,
                fundamentalFreq: akMatch?.acousticProfile?.fundamentalFreq ?? 0,
                relatedIds: akMatch?.relationships || [],
              });
            });
          });
        }

        console.log(`📜 Divine Archive: ${merged.length} relics mapped across ${Object.keys(libData?.categories || {}).length} realms`);
        setAllSamples(merged);
      } catch (err) {
        console.error('Archive load failed:', err);
      } finally {
        setLoading(false);
      }
    };

    loadBoth();
  }, []);

  // ─── Derived Data ────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    allSamples.forEach(s => cats.set(s.category, (cats.get(s.category) || 0) + 1));
    return Array.from(cats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allSamples]);

  const allTags = useMemo(() => {
    const tags = new Map<string, number>();
    allSamples.forEach(s => s.semanticTags.forEach(t => tags.set(t, (tags.get(t) || 0) + 1)));
    return Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [allSamples]);

  const filteredSamples = useMemo(() => {
    let result = allSamples;
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
    if (tagFilter) {
      result = result.filter(s => s.semanticTags.includes(tagFilter));
    }
    return result;
  }, [allSamples, selectedCategory, searchQuery, tagFilter]);

  // ─── Audio Preview ───────────────────────────────────────────────────────

  const stopPreview = useCallback(() => {
    if (previewSourceRef.current) {
      try { previewSourceRef.current.stop(); } catch (e) {}
      previewSourceRef.current = null;
    }
    if (previewGainRef.current) {
      try { previewGainRef.current.disconnect(); } catch (e) {}
      previewGainRef.current = null;
    }
    setPlayingPath(null);
  }, []);

  const playPreview = useCallback(async (sample: MergedSample) => {
    stopPreview();

    const engine = engineRef.current;
    if (!engine) return;

    // Ensure engine is initialized
    if (!engine.ctx) {
      try { await engine.init(); } catch (e) { console.error('Engine init failed:', e); return; }
    }

    const ctx: AudioContext = engine.ctx;
    if (ctx.state === 'suspended') await ctx.resume();

    try {
      const response = await fetch(sample.path);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${sample.path}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Direct-to-destination preview gain (bypasses potentially muted master chain)
      const gain = ctx.createGain();
      gain.gain.value = 0.75;
      source.connect(gain);
      gain.connect(ctx.destination);

      source.start(0);
      previewSourceRef.current = source;
      previewGainRef.current = gain;
      setPlayingPath(sample.path);

      source.onended = () => {
        gain.disconnect();
        source.disconnect();
        if (previewSourceRef.current === source) {
          previewSourceRef.current = null;
          previewGainRef.current = null;
          setPlayingPath(null);
        }
      };

      console.log('🔊 Awakening:', sample.name);
    } catch (err) {
      console.error('❌ Audition Failed:', err);
      setPlayingPath(null);
    }
  }, [engineRef, stopPreview]);

  const handleAwaken = useCallback(() => {
    if (!selectedSample) return;
    if (playingPath === selectedSample.path) {
      stopPreview();
    } else {
      playPreview(selectedSample);
    }
  }, [selectedSample, playingPath, playPreview, stopPreview]);

  const handleRecall = useCallback(() => {
    if (!selectedSample || !engineRef.current) return;
    engineRef.current.loadSampleByPath(selectedSample.path, activePad);
    console.log(`📌 Recalled "${selectedSample.name}" → Pad ${activePad + 1}`);
  }, [selectedSample, engineRef, activePad]);

  const toggleMark = useCallback((id: string) => {
    setMarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ─── Double-click relic → load to active pad + auto-advance ──────────────
  const handleRelicDoubleClick = useCallback((sample: MergedSample) => {
    if (!engineRef.current) return;
    engineRef.current.loadSampleByPath(sample.path, activePad);
    console.log(`📌 Recalled "${sample.name}" → Pad ${activePad + 1}`);
    // Auto-advance to next pad
    onActivePadChange?.((activePad + 1) % 16);
  }, [engineRef, activePad, onActivePadChange]);

  // ─── Drag start from relic card ──────────────────────────────────────────
  const handleRelicDragStart = useCallback((e: React.DragEvent, sample: MergedSample) => {
    e.dataTransfer.setData('application/x-god-relic', JSON.stringify({
      path: sample.path,
      name: sample.name,
      category: sample.category,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => {
    return () => { stopPreview(); };
  }, [stopPreview]);

  // ─── Loading State ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="da-root">
        <div className="da-empty">
          <Sparkles size={40} strokeWidth={1} />
          <span className="da-empty-text" style={{ animation: 'da-awaken-pulse 2s infinite' }}>
            Summoning Divine Archive...
          </span>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const isPlaying = playingPath === selectedSample?.path;
  const totalCount = allSamples.length;

  return (
    <div className="da-root">
      {/* ── Header ── */}
      <div className="da-header">
        <div className="da-title-group">
          <h2 className="da-title">Hall of Records</h2>
          <span className="da-subtitle">
            <Sparkles size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Divine Archive V2 · {totalCount} Relics
          </span>
        </div>

        <div className="da-search-wrap">
          <Search size={15} className="da-search-icon" />
          <input
            type="text"
            className="da-search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search the divine memory..."
          />
        </div>

        <span className="da-stats">
          {filteredSamples.length} / {totalCount}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="da-body">
        {/* ── Realm Navigator ── */}
        <div className="da-realms">
          <h4 className="da-realm-label">Realms</h4>

          <button
            className={`da-realm-btn ${selectedCategory === 'All' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('All')}
          >
            <div className="da-realm-icon">✧</div>
            <div className="da-realm-info">
              <span className="da-realm-name">All Records</span>
              <span className="da-realm-cat">Every relic</span>
            </div>
            <span className="da-realm-count">{totalCount}</span>
          </button>

          {categories.map(([cat, count]) => {
            const rm = REALM_MAP[cat] || { realm: cat, icon: '◇' };
            return (
              <button
                key={cat}
                className={`da-realm-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                <div className="da-realm-icon">{rm.icon}</div>
                <div className="da-realm-info">
                  <span className="da-realm-name">{rm.realm}</span>
                  <span className="da-realm-cat">{cat}</span>
                </div>
                <span className="da-realm-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Grid Area ── */}
        <div className="da-grid-area">
          {/* Filter header */}
          <div className="da-grid-header">
            <div className="da-filter-chips">
              {tagFilter && (
                <button
                  className="da-chip active"
                  onClick={() => setTagFilter(null)}
                >
                  ✕ {tagFilter}
                </button>
              )}
              {allTags.slice(0, 8).map(([tag]) => (
                <button
                  key={tag}
                  className={`da-chip ${tagFilter === tag ? 'active' : ''}`}
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="da-view-toggle">
              <button className={`da-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
                <LayoutGrid size={14} />
              </button>
              <button className={`da-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                <List size={14} />
              </button>
            </div>
          </div>

          {/* Sample content */}
          <div className="da-grid-scroll">
            {filteredSamples.length === 0 ? (
              <div className="da-empty">
                <Search size={40} strokeWidth={1} />
                <span className="da-empty-text">The archives are silent</span>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="da-grid">
                {filteredSamples.map((sample, idx) => (
                  <motion.div
                    key={sample.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.008, 0.5), duration: 0.3 }}
                    className={[
                      'da-relic-card',
                      selectedSample?.id === sample.id ? 'selected' : '',
                      playingPath === sample.path ? 'playing' : '',
                    ].join(' ')}
                    onClick={() => {
                      setSelectedSample(sample);
                      playPreview(sample);
                    }}
                    onDoubleClick={() => handleRelicDoubleClick(sample)}
                    draggable
                    onDragStart={(e) => handleRelicDragStart(e as any, sample)}
                  >
                    <div className="da-relic-wave">
                      <RelicWaveform mode="mini" />
                    </div>

                    <div className="da-relic-play-icon">
                      <Play size={11} fill="currentColor" />
                    </div>

                    <span className="da-relic-name">{sample.name}</span>

                    <div className="da-relic-tags">
                      <span className="da-relic-tag">{sample.category}</span>
                      {sample.semanticTags.slice(0, 1).map(t => (
                        <span key={t} className="da-relic-tag">{t}</span>
                      ))}
                    </div>

                    <div className="da-relic-energy">
                      <div className="da-relic-energy-fill" style={{ width: `${sample.energy}%` }} />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="da-list">
                {filteredSamples.map((sample, idx) => (
                  <motion.div
                    key={sample.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.005, 0.3) }}
                    className={[
                      'da-list-item',
                      selectedSample?.id === sample.id ? 'selected' : '',
                    ].join(' ')}
                    onClick={() => {
                      setSelectedSample(sample);
                      playPreview(sample);
                    }}
                  >
                    <div className="da-list-play">
                      <Play size={12} fill="currentColor" />
                    </div>
                    <div className="da-list-info">
                      <div className="da-list-name">{sample.name}</div>
                      <div className="da-list-cat">{sample.category}</div>
                    </div>
                    <div className="da-list-energy-bar">
                      <div className="da-list-energy-fill" style={{ width: `${sample.energy}%` }} />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Relic Inspector ── */}
        <AnimatePresence>
          {selectedSample ? (
            <motion.div
              key="inspector"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="da-inspector"
            >
              <h5 className="da-inspector-label">Relic Inspector</h5>
              <h3 className="da-inspector-name">{selectedSample.name}</h3>
              <span className="da-inspector-cat">
                {REALM_MAP[selectedSample.category]?.realm || selectedSample.category} · {selectedSample.category}
              </span>

              <div className="da-wave-large">
                <RelicWaveform mode="full" />
              </div>

              {/* Acoustic Meters */}
              <div className="da-meters">
                <div>
                  <div className="da-meter-row">
                    <span className="da-meter-label">Resonance</span>
                    <span className="da-meter-val">{selectedSample.energy}%</span>
                  </div>
                  <div className="da-meter-track">
                    <div className="da-meter-fill" style={{ width: `${selectedSample.energy}%` }} />
                  </div>
                </div>
                <div>
                  <div className="da-meter-row">
                    <span className="da-meter-label">Spectral Peak</span>
                    <span className="da-meter-val">{Math.round(selectedSample.spectralCentroid)} Hz</span>
                  </div>
                  <div className="da-meter-track">
                    <div className="da-meter-fill" style={{ width: `${Math.min(100, (selectedSample.spectralCentroid / 8000) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="da-meter-row">
                    <span className="da-meter-label">Decay</span>
                    <span className="da-meter-val">{selectedSample.decayTime.toFixed(2)}s</span>
                  </div>
                  <div className="da-meter-track">
                    <div className="da-meter-fill" style={{ width: `${Math.min(100, selectedSample.decayTime * 50)}%` }} />
                  </div>
                </div>
              </div>

              {/* Semantic Tags */}
              {selectedSample.semanticTags.length > 0 && (
                <div className="da-sem-tags">
                  {selectedSample.semanticTags.map(t => (
                    <span key={t} className="da-sem-tag">{t}</span>
                  ))}
                </div>
              )}

              {/* Metadata Grid */}
              <div className="da-meta-grid">
                <div className="da-meta-cell">
                  <div className="da-meta-key">Format</div>
                  <div className="da-meta-value">{selectedSample.format.toUpperCase()}</div>
                </div>
                <div className="da-meta-cell">
                  <div className="da-meta-key">Category</div>
                  <div className="da-meta-value">{selectedSample.category}</div>
                </div>
                <div className="da-meta-cell">
                  <div className="da-meta-key">Realm</div>
                  <div className="da-meta-value" style={{ fontSize: 10 }}>
                    {REALM_MAP[selectedSample.category]?.realm || '—'}
                  </div>
                </div>
                <div className="da-meta-cell">
                  <div className="da-meta-key">Freq</div>
                  <div className="da-meta-value">
                    {selectedSample.fundamentalFreq > 0
                      ? `${Math.round(selectedSample.fundamentalFreq)} Hz`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <button
                className={`da-btn-awaken ${isPlaying ? 'playing' : ''}`}
                onClick={handleAwaken}
              >
                {isPlaying ? (
                  <><Square size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> SILENCE</>
                ) : (
                  <><Play size={14} fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> AWAKEN</>
                )}
              </button>

              <button className="da-btn-recall" onClick={handleRecall}>
                <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                Recall to Pad {activePad + 1}
              </button>

              <button
                className={`da-btn-mark ${markedIds.has(selectedSample.id) ? 'marked' : ''}`}
                onClick={() => toggleMark(selectedSample.id)}
              >
                <Bookmark size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                {markedIds.has(selectedSample.id) ? 'Sacred ✦' : 'Mark as Sacred'}
              </button>
            </motion.div>
          ) : (
            <div className="da-inspector" style={{ justifyContent: 'center' }}>
              <div className="da-inspector-empty">
                <Music size={36} strokeWidth={1} />
                <span className="da-inspector-empty-text">Select a relic<br />to inspect</span>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Sacred Pad Bank — Throne-aware ── */}
      <div className="da-pad-bank">
        {Array.from({ length: 16 }, (_, i) => {
          const domain = THRONE_DOMAINS[i];
          return (
            <div
              key={i}
              className={[
                'da-pad',
                activePad === i ? 'active' : '',
                loadedPadNames[i] ? 'loaded' : '',
              ].join(' ')}
              style={{ '--da-pad-color': domain.color } as React.CSSProperties}
              onClick={() => onActivePadChange?.(i)}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/x-god-relic')) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const relicData = e.dataTransfer.getData('application/x-god-relic');
                if (relicData && engineRef.current) {
                  const relic = JSON.parse(relicData);
                  engineRef.current.loadSampleByPath(relic.path, i);
                  console.log(`📌 Dropped "${relic.name}" → Pad ${i + 1}`);
                }
              }}
            >
              <span className="da-pad-sigil">{domain.sigil}</span>
              <span className="da-pad-num">{i + 1}</span>
              {loadedPadNames[i] ? (
                <span className="da-pad-sample">{loadedPadNames[i]}</span>
              ) : (
                <span className="da-pad-domain">{domain.name}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
