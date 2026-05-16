import React from 'react';
import { UploadCloud, CheckCircle2, Layers, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface KitExporterProps {
  kitName: string;
  kitAuthor: string;
  kitDescription: string;
  presets: any[];
  includedPresets: boolean[];
  onToggleIncluded: (index: number) => void;
  onExport: () => void;
  update: (id: string, val: any) => void;
}

export const KitExporter: React.FC<KitExporterProps> = ({
  kitName,
  kitAuthor,
  kitDescription,
  presets,
  includedPresets,
  onToggleIncluded,
  onExport,
  update
}) => {
  const totalIncluded = includedPresets.filter(Boolean).length;
  const estimatedSize = (totalIncluded * 1.2).toFixed(1); // Rough estimate in MB

  return (
    <div className="flex flex-col h-full glass-panel border-l border-white/5 bg-black/20 w-80 shrink-0">
      {/* Exporter Header */}
      <div className="p-6 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
            <Layers size={16} />
          </div>
          <h2 className="text-lg font-black tracking-widest text-white uppercase">KIT ASSEMBLER</h2>
        </div>
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">
          BUNDLING ASSETS FOR DEPLOYMENT
        </p>
      </div>

      {/* Kit Metadata Fields */}
      <div className="p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-[9px] font-black text-yellow-500/60 uppercase tracking-widest ml-1">Kit Name</label>
          <input 
            type="text" 
            value={kitName}
            onChange={(e) => update('kitName', e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:border-yellow-500/50 outline-none transition-colors"
            placeholder="Enter Kit Name..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-yellow-500/60 uppercase tracking-widest ml-1">Author</label>
          <input 
            type="text" 
            value={kitAuthor}
            onChange={(e) => update('kitAuthor', e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:border-yellow-500/50 outline-none transition-colors"
            placeholder="Author Name..."
          />
        </div>
      </div>

      {/* Asset Selection List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-[9px] font-black text-white/40 uppercase tracking-widest">Included Presets</h3>
          <span className="text-[9px] font-mono text-yellow-400">{totalIncluded} items</span>
        </div>
        
        {presets.slice(0, 12).map((preset, i) => (
          <motion.div 
            key={i}
            whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.03)' }}
            className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${
              includedPresets[i] 
                ? 'bg-yellow-500/5 border-yellow-500/20' 
                : 'bg-black/20 border-white/5 opacity-50'
            }`}
            onClick={() => onToggleIncluded(i)}
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white/80">{preset.name}</span>
              <span className="text-[8px] text-white/30 uppercase font-bold">{preset.type}</span>
            </div>
            {includedPresets[i] ? (
              <CheckCircle2 size={12} className="text-yellow-500 shadow-[0_0_8px_rgba(255,215,0,0.5)]" />
            ) : (
              <div className="w-3 h-3 rounded-full border border-white/20" />
            )}
          </motion.div>
        ))}
        {presets.length > 12 && (
          <div className="text-center py-2">
            <span className="text-[8px] text-white/20 uppercase font-black">And {presets.length - 12} more...</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-6 bg-black/40 border-t border-white/5">
        <div className="flex items-center gap-2 mb-4 p-2 rounded bg-yellow-500/5 border border-yellow-500/10">
          <Info size={12} className="text-yellow-500 shrink-0" />
          <p className="text-[8px] text-white/50 leading-tight">
            Kits exported from the God Realm are compatible with all Flow-enabled DAWs.
          </p>
        </div>

        <div className="flex items-center justify-between text-[10px] text-white/40 mb-2 uppercase font-black tracking-wider">
          <span>Est. Payload</span>
          <span className="text-white">{estimatedSize} MB</span>
        </div>

        <button 
          className="w-full relative group mt-2"
          onClick={onExport}
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-600 to-red-600 rounded-lg blur opacity-40 group-hover:opacity-100 transition duration-300"></div>
          <div className="relative w-full flex items-center justify-center gap-3 bg-black hover:bg-zinc-900 text-white font-black tracking-[0.2em] py-3 px-6 rounded-lg uppercase transition-all border border-white/10 group-active:scale-95">
            <UploadCloud size={16} className="text-yellow-500" />
            <span>EXPORT KIT</span>
          </div>
        </button>
      </div>
    </div>
  );
};
