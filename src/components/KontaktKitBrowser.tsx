/**
 * KontaktKitBrowser — Kit Folder Scanner & Auto-Mapper
 * 
 * Modal panel that lets users browse to a Kontakt library or sample pack folder,
 * auto-detects samples, categorizes them, and maps to the 6 sampler slots.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '@/styles/KontaktKitBrowser.css';
import {
  type DetectedKit,
  type SlotMapping,
  type KitSample,
  type SampleCategory,
  pickDirectory,
  detectKit,
  autoMapToSlots,
  mapFromSFZ,
  formatFileSize,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
} from '@/services/kontaktKitLoader';

interface KontaktKitBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadKit: (mappings: SlotMapping[]) => void;
  onPreview?: (file: File) => void;
}

type ScanPhase = 'idle' | 'picking' | 'scanning' | 'ready' | 'loading' | 'done';

export const KontaktKitBrowser: React.FC<KontaktKitBrowserProps> = ({
  isOpen,
  onClose,
  onLoadKit,
  onPreview,
}) => {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [kit, setKit] = useState<DetectedKit | null>(null);
  const [mappings, setMappings] = useState<SlotMapping[]>([]);
  const [useSFZ, setUseSFZ] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [sampleListFilter, setSampleListFilter] = useState<SampleCategory | 'all'>('all');
  const [swapSlotIndex, setSwapSlotIndex] = useState<number | null>(null);
  const filesRef = useRef<File[]>([]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setKit(null);
      setMappings([]);
      setError(null);
      setSwapSlotIndex(null);
      filesRef.current = [];
    }
  }, [isOpen]);

  const handlePickFolder = useCallback(async () => {
    setPhase('picking');
    setError(null);
    
    try {
      const files = await pickDirectory();
      if (files.length === 0) {
        setPhase('idle');
        return;
      }
      
      filesRef.current = files;
      setPhase('scanning');
      
      const detected = await detectKit(files);
      setKit(detected);
      
      if (detected.samples.length === 0) {
        setError(detected.warnings[0] || 'No compatible audio files found in this folder.');
        setPhase('idle');
        return;
      }
      
      // Auto-map or use SFZ
      let autoMappings: SlotMapping[];
      if (detected.sfzFile) {
        autoMappings = await mapFromSFZ(detected.sfzFile, files, 6);
        setUseSFZ(true);
      } else {
        autoMappings = autoMapToSlots(detected, 6);
        setUseSFZ(false);
      }
      
      setMappings(autoMappings);
      setPhase('ready');
    } catch (err: any) {
      setError(err.message || 'Failed to scan folder.');
      setPhase('idle');
    }
  }, []);

  const handleSwapSample = useCallback((slotIndex: number, sample: KitSample) => {
    setMappings(prev => prev.map(m => 
      m.slotIndex === slotIndex ? { ...m, sample } : m
    ));
    setSwapSlotIndex(null);
  }, []);

  const handleClearSlot = useCallback((slotIndex: number) => {
    setMappings(prev => prev.map(m =>
      m.slotIndex === slotIndex ? { ...m, sample: null } : m
    ));
  }, []);

  const handleLoadKit = useCallback(() => {
    setPhase('loading');
    onLoadKit(mappings);
    setTimeout(() => {
      setPhase('done');
      setTimeout(() => onClose(), 1200);
    }, 600);
  }, [mappings, onLoadKit, onClose]);

  const handleRemapAuto = useCallback(async () => {
    if (!kit) return;
    if (useSFZ && kit.sfzFile) {
      const m = await mapFromSFZ(kit.sfzFile, filesRef.current, 6);
      setMappings(m);
    } else {
      setMappings(autoMapToSlots(kit, 6));
    }
  }, [kit, useSFZ]);

  const handleToggleSFZ = useCallback(async () => {
    if (!kit) return;
    const newUseSFZ = !useSFZ;
    setUseSFZ(newUseSFZ);
    
    if (newUseSFZ && kit.sfzFile) {
      const m = await mapFromSFZ(kit.sfzFile, filesRef.current, 6);
      setMappings(m);
    } else {
      setMappings(autoMapToSlots(kit, 6));
    }
  }, [kit, useSFZ]);

  // Drag & drop between slots
  const handleDragStart = (idx: number) => setDragSlot(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = useCallback((targetIdx: number) => {
    if (dragSlot === null || dragSlot === targetIdx) return;
    setMappings(prev => {
      const next = [...prev];
      const srcSample = next[dragSlot].sample;
      next[dragSlot] = { ...next[dragSlot], sample: next[targetIdx].sample };
      next[targetIdx] = { ...next[targetIdx], sample: srcSample };
      return next;
    });
    setDragSlot(null);
  }, [dragSlot]);

  const filteredSamples = kit?.samples.filter(s => 
    sampleListFilter === 'all' || s.category === sampleListFilter
  ) || [];

  const filledSlots = mappings.filter(m => m.sample).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="kkb-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="kkb-panel"
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 30 }}
          transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="kkb-header">
            <div className="kkb-header-left">
              <span className="kkb-header-icon">📂</span>
              <div>
                <h2 className="kkb-title">KIT LOADER</h2>
                <span className="kkb-subtitle">
                  {kit ? kit.name : 'Kontakt • SFZ • Sample Packs'}
                </span>
              </div>
            </div>
            <button className="kkb-close" onClick={onClose} aria-label="Close">✕</button>
          </div>

          {/* Body */}
          <div className="kkb-body">
            {/* ─── Idle / Pick Folder ─── */}
            {(phase === 'idle' || phase === 'picking') && (
              <div className="kkb-dropzone">
                <motion.div
                  className="kkb-dropzone-inner"
                  whileHover={{ scale: 1.02, borderColor: 'hsl(30, 100%, 55%)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePickFolder}
                >
                  {phase === 'picking' ? (
                    <>
                      <motion.span 
                        className="kkb-dropzone-icon"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                      >⏳</motion.span>
                      <span className="kkb-dropzone-text">WAITING FOR FOLDER SELECTION...</span>
                    </>
                  ) : (
                    <>
                      <span className="kkb-dropzone-icon">📂</span>
                      <span className="kkb-dropzone-text">SELECT SAMPLE FOLDER</span>
                      <span className="kkb-dropzone-hint">
                        Browse to a Kontakt library, SFZ instrument, or sample pack folder
                      </span>
                    </>
                  )}
                </motion.div>
                
                {error && (
                  <motion.div 
                    className="kkb-error"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <span className="kkb-error-icon">⚠️</span>
                    <span>{error}</span>
                  </motion.div>
                )}
              </div>
            )}

            {/* ─── Scanning ─── */}
            {phase === 'scanning' && (
              <div className="kkb-scanning">
                <motion.div
                  className="kkb-scan-pulse"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <span className="kkb-scan-icon">🔍</span>
                </motion.div>
                <span className="kkb-scan-text">SCANNING FOLDER STRUCTURE...</span>
                <span className="kkb-scan-subtext">Detecting samples, instruments, and mappings</span>
              </div>
            )}

            {/* ─── Ready / Mapping ─── */}
            {(phase === 'ready' || phase === 'loading' || phase === 'done') && kit && (
              <div className="kkb-results">
                {/* Kit Info Bar */}
                <div className="kkb-kit-info">
                  <div className="kkb-kit-info-main">
                    <span className="kkb-kit-badge" data-type={kit.type}>
                      {kit.type === 'kontakt' ? '🎛️ KONTAKT' : kit.type === 'sfz' ? '📄 SFZ' : '📁 FOLDER'}
                    </span>
                    <span className="kkb-kit-stats">
                      {kit.samples.length} samples • {formatFileSize(kit.totalSize)}
                    </span>
                    {kit.nkiFiles.length > 0 && (
                      <span className="kkb-kit-nki">{kit.nkiFiles.length} .nki instrument{kit.nkiFiles.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {kit.sfzFile && (
                    <button 
                      className={`kkb-sfz-toggle ${useSFZ ? 'active' : ''}`}
                      onClick={handleToggleSFZ}
                    >
                      {useSFZ ? '📄 SFZ Mapping Active' : '🔄 Use Auto-Mapping'}
                    </button>
                  )}
                </div>

                {/* Warnings */}
                {kit.warnings.map((w, i) => (
                  <div key={i} className="kkb-warning">
                    <span className="kkb-warning-icon">⚠️</span>
                    <span>{w}</span>
                  </div>
                ))}

                {/* Category Pills */}
                <div className="kkb-categories">
                  {Object.entries(kit.categories).map(([cat, samples]) => (
                    <span 
                      key={cat}
                      className="kkb-cat-pill"
                      style={{ '--cat-color': CATEGORY_COLORS[cat as SampleCategory] } as React.CSSProperties}
                    >
                      {CATEGORY_ICONS[cat as SampleCategory]} {cat} ({samples!.length})
                    </span>
                  ))}
                </div>

                {/* Slot Mapping Grid */}
                <div className="kkb-mapping-section">
                  <div className="kkb-mapping-header">
                    <span>SLOT MAPPING</span>
                    <span className="kkb-mapping-count">{filledSlots}/6 ASSIGNED</span>
                    <button className="kkb-remap-btn" onClick={handleRemapAuto}>↻ RE-MAP</button>
                  </div>

                  <div className="kkb-slot-grid">
                    {mappings.map((mapping) => (
                      <motion.div
                        key={mapping.slotIndex}
                        className={`kkb-slot ${mapping.sample ? 'filled' : 'empty'} ${dragSlot === mapping.slotIndex ? 'dragging' : ''}`}
                        draggable={!!mapping.sample}
                        onDragStart={() => handleDragStart(mapping.slotIndex)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(mapping.slotIndex)}
                        layout
                      >
                        <div className="kkb-slot-label">{mapping.label}</div>
                        {mapping.sample ? (
                          <div className="kkb-slot-content">
                            <span 
                              className="kkb-slot-cat-dot" 
                              style={{ background: CATEGORY_COLORS[mapping.sample.category] }}
                            />
                            <span className="kkb-slot-name" title={mapping.sample.name}>
                              {mapping.sample.name.replace(/\.[^.]+$/, '')}
                            </span>
                            <div className="kkb-slot-actions">
                              {onPreview && (
                                <button 
                                  className="kkb-slot-btn"
                                  onClick={() => onPreview(mapping.sample!.file)}
                                  title="Preview"
                                >▶</button>
                              )}
                              <button 
                                className="kkb-slot-btn"
                                onClick={() => setSwapSlotIndex(mapping.slotIndex)}
                                title="Swap sample"
                              >⇄</button>
                              <button 
                                className="kkb-slot-btn kkb-slot-btn-clear"
                                onClick={() => handleClearSlot(mapping.slotIndex)}
                                title="Clear"
                              >✕</button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="kkb-slot-empty"
                            onClick={() => setSwapSlotIndex(mapping.slotIndex)}
                          >
                            <span>+ TAP TO ASSIGN</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Sample Browser (for swap) */}
                <AnimatePresence>
                  {swapSlotIndex !== null && (
                    <motion.div
                      className="kkb-sample-browser"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="kkb-browser-header">
                        <span>ASSIGN TO SLOT {mappings[swapSlotIndex]?.label}</span>
                        <button className="kkb-browser-close" onClick={() => setSwapSlotIndex(null)}>✕</button>
                      </div>
                      
                      {/* Filter pills */}
                      <div className="kkb-browser-filters">
                        <button
                          className={`kkb-filter-pill ${sampleListFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setSampleListFilter('all')}
                        >ALL ({kit.samples.length})</button>
                        {Object.entries(kit.categories).map(([cat, samples]) => (
                          <button
                            key={cat}
                            className={`kkb-filter-pill ${sampleListFilter === cat ? 'active' : ''}`}
                            onClick={() => setSampleListFilter(cat as SampleCategory)}
                            style={{ '--cat-color': CATEGORY_COLORS[cat as SampleCategory] } as React.CSSProperties}
                          >
                            {CATEGORY_ICONS[cat as SampleCategory]} {cat.toUpperCase()} ({samples!.length})
                          </button>
                        ))}
                      </div>

                      {/* Sample list */}
                      <div className="kkb-sample-list">
                        {filteredSamples.slice(0, 50).map((sample, idx) => (
                          <button
                            key={`${sample.path}-${idx}`}
                            className="kkb-sample-item"
                            onClick={() => handleSwapSample(swapSlotIndex, sample)}
                          >
                            <span 
                              className="kkb-sample-dot"
                              style={{ background: CATEGORY_COLORS[sample.category] }}
                            />
                            <span className="kkb-sample-name">{sample.name}</span>
                            <span className="kkb-sample-size">{formatFileSize(sample.size)}</span>
                            {onPreview && (
                              <span
                                className="kkb-sample-preview"
                                onClick={(e) => { e.stopPropagation(); onPreview(sample.file); }}
                              >▶</span>
                            )}
                          </button>
                        ))}
                        {filteredSamples.length > 50 && (
                          <div className="kkb-sample-more">
                            + {filteredSamples.length - 50} more samples
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Load Button */}
                <div className="kkb-actions">
                  <button className="kkb-btn-secondary" onClick={handlePickFolder}>
                    📂 CHANGE FOLDER
                  </button>
                  <motion.button 
                    className="kkb-btn-load"
                    onClick={handleLoadKit}
                    disabled={filledSlots === 0 || phase === 'loading' || phase === 'done'}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {phase === 'done' ? '✓ KIT LOADED' : phase === 'loading' ? 'LOADING...' : `⚡ LOAD KIT (${filledSlots} SLOTS)`}
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default KontaktKitBrowser;
