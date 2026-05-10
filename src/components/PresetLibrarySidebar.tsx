import React from 'react';
import { Search, Heart, Star, User, Hash, Music, Zap, Drum, Mic, Waves } from 'lucide-react';
import { motion } from 'framer-motion';

interface PresetLibrarySidebarProps {
  categories: Array<{ name: string; count: number; icon: string }>;
  selectedCategory: string;
  onSelectCategory: (name: string) => void;
  presetSearch: string;
  onSearchChange: (val: string) => void;
  filteredPresets: any[];
  selectedPreset: number;
  onSelectPreset: (index: number) => void;
  onToggleFavorite: (index: number) => void;
}

const CATEGORY_ICONS: Record<string, any> = {
  'All Presets': Hash,
  'Favorites': Heart,
  'User Presets': User,
  'Bass': Music,
  'Lead': Zap,
  'Pad': Waves,
  'Arp': Zap,
  'Pluck': Star,
  'Keys': Music,
  'FX': Zap,
  'Percussion': Drum,
  'Vocal': Mic,
  'Textures': Waves,
};

export const PresetLibrarySidebar: React.FC<PresetLibrarySidebarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  presetSearch,
  onSearchChange,
  filteredPresets,
  selectedPreset,
  onSelectPreset,
  onToggleFavorite
}) => {
  return (
    <div className="flex flex-col h-full glass-panel border-r border-white/5 bg-black/40 w-72 shrink-0 overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 border-b border-white/5 bg-black/20">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-orange-500 transition-colors" size={14} />
          <input 
            type="text" 
            value={presetSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/20 focus:border-orange-500/40 outline-none transition-all"
            placeholder="Search the Vault..."
          />
        </div>
      </div>

      {/* Categories Scroll */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 overflow-y-auto max-h-[40%] border-b border-white/5">
          <h3 className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-3 ml-1">Categories</h3>
          <div className="space-y-1">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.name] || Hash;
              const isActive = selectedCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => onSelectCategory(cat.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                    isActive 
                      ? 'bg-orange-500/10 text-orange-500' 
                      : 'text-white/40 hover:bg-white/5 hover:text-white/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={14} className={isActive ? 'text-orange-500' : 'opacity-50'} />
                    <span className="text-[11px] font-bold tracking-wide">{cat.name}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-40">{cat.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preset List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <h3 className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-3 ml-1">Presets</h3>
          {filteredPresets.map((preset) => (
            <div 
              key={preset.originalIndex}
              onClick={() => onSelectPreset(preset.originalIndex)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                selectedPreset === preset.originalIndex 
                  ? 'bg-orange-500/20 border-orange-500/30 shadow-[0_0_15px_rgba(255,102,0,0.1)]' 
                  : 'bg-transparent border-transparent hover:bg-white/5'
              }`}
            >
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className={`text-[11px] font-bold truncate ${selectedPreset === preset.originalIndex ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>
                  {preset.name}
                </span>
                <div className="flex items-center gap-2 opacity-30 text-[8px] font-black uppercase tracking-tighter">
                  <span>{preset.type}</span>
                  <span>•</span>
                  <span>{preset.author}</span>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(preset.originalIndex);
                }}
                className={`transition-colors ${preset.fav ? 'text-orange-500 shadow-[0_0_8px_rgba(255,102,0,0.4)]' : 'text-white/10 hover:text-white/40'}`}
              >
                <Heart size={12} fill={preset.fav ? 'currentColor' : 'none'} />
              </button>
            </div>
          ))}
          {filteredPresets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 opacity-20">
              <Search size={32} strokeWidth={1} />
              <span className="text-[10px] font-bold uppercase mt-2">No presets found</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
