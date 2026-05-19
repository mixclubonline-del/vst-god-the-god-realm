import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Cloud, 
  Share2, 
  History, 
  Sparkles, 
  Heart, 
  Tag, 
  Zap, 
  Eye,
  Layers,
  Activity,
  User,
  Globe,
  Database,
  ShieldCheck,
  Star,
  Plus,
  Package
} from 'lucide-react';

interface Preset {
  id: string;
  name: string;
  type: string;
  author: string;
  rating: number;
  fav: boolean;
  tags: string[];
  lastModified: string;
  energyLevel: number; // 0-100 for visual resonance
}

type CollectionFilter = 'all' | 'fav' | 'cloud' | 'user';

interface EternalPresetVaultProps {
  presets: Preset[];
  selectedPresetIndex: number;
  onSelectPreset: (index: number) => void;
  onToggleFavorite: (index: number) => void;
  onLoadPreset: () => void;
  onSavePreset: () => void;
  onSaveAsPreset: () => void;
  onDeletePreset: () => void;
  onCloudSync: () => void;
  isSyncing: boolean;
  /* Kit Assembler props (optional — shown as right-panel tab) */
  kitExporter?: React.ReactNode;
}

/**
 * Deterministic pseudo-random number from a string seed.
 * Produces the same result for the same seed on every render.
 */
function seededRandom(seed: string, index: number): number {
  let hash = 0;
  const str = seed + index.toString();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return (Math.abs(hash) % 100) / 100;
}

function getCategoryPreviewImage(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('keys') || t.includes('arp')) return '/images/pantheon/olympus_keys.png';
  if (t.includes('bass')) return '/images/pantheon/underworld_bass.png';
  if (t.includes('lead')) return '/images/pantheon/mythic_lead.png';
  if (t.includes('pluck') || t.includes('fx')) return '/images/pantheon/ethereal_pluck.png';
  if (t.includes('pad') || t.includes('vocal')) return '/images/pantheon/celestial_pad.png';
  if (t.includes('texture') || t.includes('percussion') || t.includes('all')) return '/images/pantheon/divine_texture.png';
  return '/images/pantheon/olympus_keys.png';
}

export const EternalPresetVault: React.FC<EternalPresetVaultProps> = ({
  presets,
  selectedPresetIndex,
  onSelectPreset,
  onToggleFavorite,
  onLoadPreset,
  onSavePreset,
  onSaveAsPreset,
  onDeletePreset,
  onCloudSync,
  isSyncing,
  kitExporter
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeCollection, setActiveCollection] = useState<CollectionFilter>('all');
  const [rightPanelMode, setRightPanelMode] = useState<'detail' | 'kit'>('detail');

  const selectedPreset = presets[selectedPresetIndex];

  // Derived tags for filtering
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    presets.forEach(p => p.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [presets]);

  const filteredPresets = useMemo(() => {
    return presets.filter(p => {
      // Search filter
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.author.toLowerCase().includes(searchQuery.toLowerCase());
      // Tag filter
      const matchesTag = !selectedTag || p.tags.includes(selectedTag);
      // Collection filter
      let matchesCollection = true;
      switch (activeCollection) {
        case 'fav':
          matchesCollection = p.fav;
          break;
        case 'user':
          matchesCollection = p.author !== 'VST GOD';
          break;
        case 'cloud':
          matchesCollection = true; // Cloud presets — future: filter by synced flag
          break;
        case 'all':
        default:
          matchesCollection = true;
          break;
      }
      return matchesSearch && matchesTag && matchesCollection;
    });
  }, [presets, searchQuery, selectedTag, activeCollection]);

  // Collection definitions with live counts
  const collections = useMemo(() => [
    { id: 'all' as CollectionFilter, name: 'All Rituals', icon: Globe, count: presets.length },
    { id: 'fav' as CollectionFilter, name: 'Marked Rituals', icon: Heart, count: presets.filter(p => p.fav).length },
    { id: 'cloud' as CollectionFilter, name: 'Ascended (Cloud)', icon: Cloud, count: presets.length },
    { id: 'user' as CollectionFilter, name: 'My Creations', icon: User, count: presets.filter(p => p.author !== 'VST GOD').length },
  ], [presets]);

  return (
    <div className="flex w-full h-full gap-2 p-1 overflow-hidden select-none">
      {/* ─── LEFT: DIVINE COLLECTIONS & TAGS ─── */}
      <aside className="w-64 shrink-0 glass-panel bg-black/40 flex flex-col border-r border-white/5">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded bg-yellow-500/20 flex items-center justify-center text-yellow-500">
              <Database size={16} />
            </div>
            <div>
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Divine Repository</h3>
              <p className="text-[8px] text-white/40 font-bold uppercase">v1.2.0-Alpha</p>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-yellow-500 transition-colors" size={12} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-full pl-9 pr-4 py-2 text-[10px] text-white placeholder:text-white/20 focus:border-yellow-500/40 outline-none transition-all"
              placeholder="Search rituals..."
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {/* Collections */}
          <div>
            <h4 className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-3 ml-1">Collections</h4>
            <div className="space-y-1">
              {collections.map(col => (
                <button 
                  key={col.id} 
                  onClick={() => setActiveCollection(col.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                    activeCollection === col.id
                      ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shadow-[inset_3px_0_0_rgba(255,215,0,0.6)]'
                      : 'text-white/40 hover:bg-white/5 hover:text-white/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <col.icon size={14} className={activeCollection === col.id ? 'opacity-100' : 'opacity-50'} />
                    <span className="text-[11px] font-bold tracking-wide">{col.name}</span>
                  </div>
                  <span className={`text-[9px] font-mono ${activeCollection === col.id ? 'text-yellow-500/80' : 'opacity-30'}`}>{col.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Tags */}
          <div>
            <div className="flex items-center justify-between mb-3 ml-1">
              <h4 className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Semantic DNA</h4>
              <Sparkles size={10} className="text-yellow-500/40" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map(tag => (
                <button 
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter transition-all ${
                    selectedTag === tag 
                      ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(255,215,0,0.4)]' 
                      : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cloud Sync Status */}
        <div className="p-4 bg-yellow-500/5 border-t border-white/5">
          <button 
            onClick={onCloudSync}
            disabled={isSyncing}
            className="w-full group relative flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/20 transition-all overflow-hidden"
          >
            {isSyncing && (
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              />
            )}
            <Cloud size={16} className={`${isSyncing ? 'animate-pulse' : 'group-hover:scale-110'} transition-transform text-yellow-500`} />
            <span className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em]">
              {isSyncing ? 'Syncing to Heaven...' : 'Cloud Ritual Sync'}
            </span>
          </button>
        </div>
      </aside>

      {/* ─── CENTER: CONSTELLATION GRID ─── */}
      <main className="flex-1 min-w-0 glass-panel bg-black/20 flex flex-col relative overflow-hidden">
        {/* Ambient background effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        {/* Grid Header */}
        <header className="p-6 flex items-center justify-between border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent z-10">
          <div>
            <h2 className="text-xl font-black text-white tracking-[0.2em] uppercase">The Eternal Vault</h2>
            <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-1">
              {filteredPresets.length} items manifest in current vision
            </p>
          </div>
          <div className="flex gap-2">
            <button className="vg-btn vg-btn-ghost px-4 gap-2" onClick={() => setShowHistory(!showHistory)}>
              <History size={14} className={showHistory ? 'text-yellow-500' : ''} />
              <span className="text-[10px]">HISTORY</span>
            </button>
            <button className="vg-btn vg-btn-primary px-6 gap-2" onClick={onSaveAsPreset}>
              <Plus size={14} />
              <span className="text-[10px]">NEW RITUAL</span>
            </button>
          </div>
        </header>

        {/* The Node Grid */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar z-10">
          <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredPresets.map((preset, idx) => {
                // Find the real index in the unfiltered presets array
                const realIndex = presets.findIndex(p => p.id === preset.id);
                const isSelected = selectedPreset?.id === preset.id;
                return (
                  <motion.div
                    key={preset.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => onSelectPreset(realIndex)}
                    className={`relative group cursor-pointer rounded-2xl border transition-all duration-300 overflow-hidden ${
                      isSelected 
                        ? 'bg-yellow-500/10 border-yellow-500/40 shadow-[0_0_40px_rgba(255,215,0,0.15)] ring-1 ring-yellow-500/20' 
                        : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Visual DNA background */}
                    <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                       <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <path 
                            d={`M 0 50 Q 25 ${50 - preset.energyLevel/2} 50 50 T 100 50`} 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            className={isSelected ? 'text-yellow-500' : 'text-white'}
                          />
                       </svg>
                    </div>

                    <div className="p-5 flex flex-col justify-between relative z-10" style={{ minHeight: '10rem' }}>
                      <div className="flex justify-between items-start">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-yellow-500 text-black' : 'bg-white/5 text-white/40'} transition-colors`}>
                           <Layers size={14} />
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onToggleFavorite(realIndex); }}
                          className={`${preset.fav ? 'text-yellow-500' : 'text-white/10 hover:text-white/40'} transition-colors`}
                        >
                          <Heart size={14} fill={preset.fav ? 'currentColor' : 'none'} />
                        </button>
                      </div>

                      <div className="mt-auto">
                        <h4 className="text-sm font-black text-white tracking-wide mb-1 group-hover:text-yellow-500 transition-colors leading-tight" title={preset.name}>
                          {preset.name}
                        </h4>
                        <div className="flex items-center gap-2">
                           <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">{preset.type}</span>
                           <span className="w-1 h-1 rounded-full bg-white/10" />
                           <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">{preset.author}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-3">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star 
                              key={i} 
                              size={8} 
                              className={i < preset.rating ? 'text-yellow-500' : 'text-white/5'} 
                              fill={i < preset.rating ? 'currentColor' : 'none'} 
                            />
                          ))}
                        </div>
                        <span className="text-[7px] font-mono text-white/20 uppercase tracking-tighter">
                          ID: {preset.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>

                    {/* Highlight corner */}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rotate-45 transform translate-x-3 -translate-y-3 shadow-lg" />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* History Overlay Panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 right-0 w-80 bg-black/60 backdrop-blur-xl border-l border-white/10 z-50 p-6 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <History size={18} className="text-yellow-500" />
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Ritual History</h3>
                </div>
                <button onClick={() => setShowHistory(false)} className="text-white/20 hover:text-white">✕</button>
              </div>

              <div className="space-y-6 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[1px] before:bg-white/10">
                 {[
                   { action: 'Harmonic Shift', time: '2m ago', icon: Zap, color: 'text-blue-400' },
                   { action: 'Portal Transition', time: '12m ago', icon: Globe, color: 'text-purple-400' },
                   { action: 'Relic Recall', time: '45m ago', icon: Database, color: 'text-yellow-400' },
                   { action: 'Soul Extraction', time: '1h ago', icon: Activity, color: 'text-red-400' },
                   { action: 'Void Compression', time: 'Yesterday', icon: ShieldCheck, color: 'text-emerald-400' },
                 ].map((step, i) => (
                   <div key={i} className="flex gap-4 relative">
                      <div className={`w-5 h-5 rounded-full bg-black border border-white/20 flex items-center justify-center z-10 ${step.color}`}>
                        <step.icon size={10} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-white/80">{step.action}</p>
                        <p className="text-[9px] text-white/30 font-bold uppercase tracking-tighter mt-1">{step.time}</p>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="mt-auto pt-8">
                <button className="w-full vg-btn vg-btn-ghost text-[10px] py-4">PURGE RECENT HISTORY</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ─── RIGHT: TABBED PANEL (Sacred Specification / Kit Assembler) ─── */}
      <aside className="w-80 shrink-0 glass-panel bg-black/40 flex flex-col border-l border-white/5">
        {/* Panel Tab Switcher */}
        {kitExporter && (
          <div className="flex border-b border-white/5 shrink-0">
            <button
              onClick={() => setRightPanelMode('detail')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.15em] transition-all ${
                rightPanelMode === 'detail'
                  ? 'text-yellow-500 bg-yellow-500/5 border-b-2 border-yellow-500'
                  : 'text-white/30 hover:text-white/50 hover:bg-white/[0.02]'
              }`}
            >
              <Eye size={12} />
              DETAIL
            </button>
            <button
              onClick={() => setRightPanelMode('kit')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.15em] transition-all ${
                rightPanelMode === 'kit'
                  ? 'text-yellow-500 bg-yellow-500/5 border-b-2 border-yellow-500'
                  : 'text-white/30 hover:text-white/50 hover:bg-white/[0.02]'
              }`}
            >
              <Package size={12} />
              KIT ASSEMBLER
            </button>
          </div>
        )}

        {/* Detail Panel */}
        {rightPanelMode === 'detail' && (
          <AnimatePresence mode="wait">
            {selectedPreset ? (
              <motion.div
                key={selectedPreset.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar"
              >
                {/* Category Preset Concept Artwork Preview */}
                <div className="relative h-32 rounded-2xl overflow-hidden mb-6 border border-white/10 group bg-black/45 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                  <img
                    src={getCategoryPreviewImage(selectedPreset.type)}
                    alt={selectedPreset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <span className="text-[8px] font-black text-yellow-400 uppercase tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                      {selectedPreset.type.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="mb-8">
                  <span className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.4em] block mb-2">Sacred Specification</span>
                  <h3 className="text-3xl font-black text-white tracking-tighter mb-4">{selectedPreset.name}</h3>
                  
                  <div className="flex flex-wrap gap-2">
                    <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
                      <User size={12} className="text-white/40" />
                      <span className="text-[10px] font-bold text-white/60">{selectedPreset.author}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
                      <Tag size={12} className="text-white/40" />
                      <span className="text-[10px] font-bold text-white/60">{selectedPreset.type}</span>
                    </div>
                  </div>
                </div>

                {/* Spectral Footprint — deterministic per preset */}
                <div className="mb-8 p-4 rounded-2xl bg-black/40 border border-white/5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex justify-between items-center mb-4">
                     <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Spectral Footprint</h4>
                     <Activity size={12} className="text-yellow-500/60" />
                  </div>
                  <div className="h-24 flex items-end gap-[2px]">
                     {Array.from({ length: 32 }).map((_, i) => {
                       const height = 20 + seededRandom(selectedPreset.id, i) * 80;
                       return (
                         <motion.div 
                           key={i}
                           initial={{ height: 0 }}
                           animate={{ height: `${height}%` }}
                           transition={{ duration: 0.5, delay: i * 0.015 }}
                           className={`flex-1 rounded-t-sm ${i % 4 === 0 ? 'bg-yellow-500/60' : 'bg-white/10'}`}
                         />
                       );
                     })}
                  </div>
                  <div className="flex justify-between mt-3 text-[8px] font-mono text-white/20">
                     <span>20Hz</span>
                     <span>20kHz</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 mt-auto">
                   <button className="w-full vg-btn vg-btn-primary py-4 text-xs tracking-widest" onClick={onLoadPreset}>
                     LOAD RITUAL
                   </button>
                   <div className="grid grid-cols-2 gap-2">
                     <button 
                       className="vg-btn py-3 text-[10px] flex items-center justify-center gap-2" 
                       onClick={() => {
                         if (confirm(`Overwrite "${selectedPreset.name}" with current settings?`)) {
                           onSavePreset();
                         }
                       }}
                     >
                       <ShieldCheck size={12} />
                       OVERWRITE
                     </button>
                     <button 
                       className="vg-btn py-3 text-[10px] flex items-center justify-center gap-2"
                       onClick={onCloudSync}
                     >
                       <Share2 size={12} />
                       ASCEND
                     </button>
                   </div>
                   <button className="w-full text-[9px] font-black text-red-500/40 hover:text-red-500 uppercase tracking-[0.3em] py-4 transition-colors" onClick={onDeletePreset}>
                     BANISH FROM VAULT
                   </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-20 p-12 text-center">
                 <Eye size={48} strokeWidth={1} />
                 <h3 className="text-xs font-black uppercase tracking-[0.4em] mt-8">Gaze into the Void</h3>
                 <p className="text-[10px] font-bold mt-4 leading-relaxed">Select a ritual node to inspect its sacred specification and sonic footprint.</p>
              </div>
            )}
          </AnimatePresence>
        )}

        {/* Kit Assembler Panel */}
        {rightPanelMode === 'kit' && kitExporter && (
          <div className="flex-1 overflow-hidden">
            {kitExporter}
          </div>
        )}
      </aside>
    </div>
  );
};
