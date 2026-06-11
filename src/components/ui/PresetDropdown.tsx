/**
 * PresetDropdown — Top-bar preset browser with search, categories, keyboard nav.
 *
 * Replaces the inline PRESET ◀ name ▶ bar with a full dropdown browser
 * showing all presets (vault + pantheon + user) with filtering.
 *
 * Uses BEM-style CSS classes matching PresetDropdown.css
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { UnifiedPreset } from '@/services/presetService';
import '@/styles/PresetDropdown.css';

// ─── Category definitions ───────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'ALL', label: 'ALL' },
  { id: 'FAVS', label: '★ FAVS' },
  { id: 'BASS', label: 'BASS' },
  { id: 'LEAD', label: 'LEAD' },
  { id: 'PAD', label: 'PAD' },
  { id: 'KEYS', label: 'KEYS' },
  { id: 'FX', label: 'FX' },
  { id: 'ARP', label: 'ARP' },
  { id: 'PLUCK', label: 'PLUCK' },
  { id: 'TEXTURES', label: 'TEXTURES' },
  { id: 'HYBRID', label: 'HYBRID' },
  { id: 'MULTI-REALM', label: 'MULTI-REALM' },
  { id: 'PANTHEON', label: '⚡ PANTHEON' },
  { id: 'USER', label: 'USER' },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface PresetDropdownProps {
  presets: UnifiedPreset[];
  activePresetId: string | null;
  onSelect: (preset: UnifiedPreset) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFavorite: (id: string) => void;
  currentName: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const PresetDropdown: React.FC<PresetDropdownProps> = ({
  presets,
  activePresetId,
  onSelect,
  onPrev,
  onNext,
  onToggleFavorite,
  currentName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [copied, setCopied] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Filtering ──

  const filtered = useMemo(() => {
    let results = presets;
    const cat = activeCategory.toUpperCase();

    // Category filter
    if (cat !== 'ALL') {
      if (cat === 'FAVS' || cat === '★ FAVS') {
        results = results.filter(p => p.fav);
      } else if (cat === 'PANTHEON' || cat === '⚡ PANTHEON') {
        results = results.filter(p => p.source === 'pantheon');
      } else if (cat === 'USER') {
        results = results.filter(p => p.source === 'user');
      } else {
        results = results.filter(p => p.type.toUpperCase() === cat);
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return results;
  }, [presets, activeCategory, searchQuery]);

  // ── Open/Close ──

  const open = useCallback(() => {
    setIsOpen(true);
    setSearchQuery('');
    setFocusedIndex(-1);
    requestAnimationFrame(() => {
      searchRef.current?.focus();
      const activeEl = listRef.current?.querySelector('.preset-dropdown__row--active');
      activeEl?.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setFocusedIndex(-1);
  }, []);

  // ── Click outside ──

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, close]);

  // ── Keyboard navigation ──

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setFocusedIndex(prev => {
            const next = Math.min(prev + 1, filtered.length - 1);
            const items = listRef.current?.querySelectorAll('.preset-dropdown__row');
            items?.[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return next;
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setFocusedIndex(prev => {
            const next = Math.max(prev - 1, 0);
            const items = listRef.current?.querySelectorAll('.preset-dropdown__row');
            items?.[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return next;
          });
          break;

        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (focusedIndex >= 0 && focusedIndex < filtered.length) {
            onSelect(filtered[focusedIndex]);
            close();
          }
          break;

        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          close();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, focusedIndex, filtered, onSelect, close]);

  // ── Handlers ──

  const handleSelect = useCallback((preset: UnifiedPreset) => {
    onSelect(preset);
    close();
  }, [onSelect, close]);

  const handleFavClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onToggleFavorite(id);
  }, [onToggleFavorite]);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(currentName).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [currentName]);

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPrev();
  }, [onPrev]);

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onNext();
  }, [onNext]);

  // ── Render ──

  return (
    <div className="preset-dropdown" ref={containerRef}>
      <span className="preset-dropdown__label">PRESET</span>

      <button className="preset-dropdown__nav-btn" onClick={handlePrev} title="Previous preset">
        ◀
      </button>

      <button
        className={`preset-dropdown__trigger${isOpen ? ' preset-dropdown__trigger--open' : ''}`}
        onClick={isOpen ? close : open}
      >
        {currentName}
      </button>

      <button className="preset-dropdown__nav-btn" onClick={handleNext} title="Next preset">
        ▶
      </button>

      <button
        className={`preset-dropdown__copy-btn${copied ? ' preset-dropdown__copy-btn--copied' : ''}`}
        onClick={handleCopy}
        title="Copy preset name"
      >
        {copied ? '✓' : '📋'}
      </button>

      {isOpen && (
        <div className="preset-dropdown__panel">
          {/* Search */}
          <div className="preset-dropdown__search">
            <div className="preset-dropdown__search-wrapper">
              <span className="preset-dropdown__search-icon">🔍</span>
              <input
                ref={searchRef}
                className="preset-dropdown__search-input"
                type="text"
                placeholder="Search presets..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setFocusedIndex(-1);
                }}
                onKeyDown={e => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Category pills */}
          <div className="preset-dropdown__categories">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`preset-dropdown__category-pill${activeCategory === cat.id ? ' preset-dropdown__category-pill--active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setFocusedIndex(-1);
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Preset list */}
          <div className="preset-dropdown__list" ref={listRef}>
            {filtered.length === 0 ? (
              <div className="preset-dropdown__empty">
                <span className="preset-dropdown__empty-icon">🔮</span>
                <span className="preset-dropdown__empty-text">No presets found</span>
              </div>
            ) : (
              filtered.map((preset, idx) => {
                const isActive = preset.id === activePresetId;
                const isFocused = idx === focusedIndex;
                const rowClass = [
                  'preset-dropdown__row',
                  isActive ? 'preset-dropdown__row--active' : '',
                  isFocused ? 'preset-dropdown__row--focused' : '',
                ].filter(Boolean).join(' ');

                return (
                  <div
                    key={preset.id}
                    className={rowClass}
                    onClick={() => handleSelect(preset)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                  >
                    {/* Source indicator */}
                    <span className={`preset-dropdown__source-indicator${
                      preset.source === 'pantheon' ? ' preset-dropdown__source-indicator--pantheon' :
                      preset.source === 'user' ? ' preset-dropdown__source-indicator--user' : ''
                    }`}>
                      {preset.source === 'pantheon' ? '⚡' : preset.source === 'user' ? '●' : ''}
                    </span>

                    {/* Name + author */}
                    <div className="preset-dropdown__row-info">
                      <span className="preset-dropdown__row-name">{preset.name}</span>
                      <div className="preset-dropdown__row-meta">
                        <span className="preset-dropdown__row-author">{preset.author}</span>
                      </div>
                    </div>

                    {/* Type badge */}
                    <span className="preset-dropdown__type-badge">{preset.type}</span>

                    {/* Favorite button */}
                    <button
                      className={`preset-dropdown__fav-btn${preset.fav ? ' preset-dropdown__fav-btn--active' : ''}`}
                      onClick={(e) => handleFavClick(e, preset.id)}
                      title={preset.fav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      ♥
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer count */}
          <div className="preset-dropdown__footer">
            <div className="preset-dropdown__count">
              {filtered.length} preset{filtered.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
