import React, { useState, useEffect, useCallback } from 'react';
import { Palette, Download, Sparkles, AlertTriangle, Eye, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { nativeAudio } from '@/native/bridge';
import './AltarOfAesthetics.css';

interface HarvestedAsset {
  name: string;
  path: string;
  type: 'graphic' | 'audio' | 'other';
  size: number;
}

export const AltarOfAesthetics: React.FC = () => {
  const [dragOver, setDragOver] = useState(false);
  const [harvesting, setHarvesting] = useState(false);
  const [harvestedAssets, setHarvestedAssets] = useState<HarvestedAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<HarvestedAsset | null>(null);
  
  // Customization state
  const [glowColor, setGlowColor] = useState('#ffd700');
  const [blurAmount, setBlurAmount] = useState(16);
  const [opacity, setOpacity] = useState(60);
  const [accentHue, setAccentHue] = useState(45); // Golden
  const [activeSkinProfile, setActiveSkinProfile] = useState('Midnight Ember');
  const [selectedDialType, setSelectedDialType] = useState('tune');

  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);

  // Subscribe to harvesting callbacks from JUCE backend
  useEffect(() => {
    const unsubscribe = nativeAudio.subscribeHarvest((success, pluginPath, files) => {
      setHarvesting(false);
      if (success && files && files.length > 0) {
        // Filter out graphic assets (PNGs)
        const graphics = files.filter(f => f.type === 'graphic');
        setHarvestedAssets(graphics);
        if (graphics.length > 0) {
          setSelectedAsset(graphics[0]);
        }
      }
    });
    return () => { unsubscribe(); };
  }, []);

  // Load skin from localStorage and listen to preset changes
  useEffect(() => {
    const loadSkin = () => {
      const stored = localStorage.getItem('vst-god-active-skin');
      if (stored) {
        try {
          const skin = JSON.parse(stored);
          if (skin.glowColor) setGlowColor(skin.glowColor);
          if (skin.blurAmount !== undefined) setBlurAmount(skin.blurAmount);
          if (skin.opacity !== undefined) setOpacity(skin.opacity);
          if (skin.activeSkinProfile) setActiveSkinProfile(skin.activeSkinProfile);
          if (skin.selectedAssetPath) {
            setSelectedAsset({
              name: skin.selectedAssetName || 'custom knob',
              path: skin.selectedAssetPath,
              type: 'graphic',
              size: 0
            });
          }
        } catch (e) {
          console.error('Failed to parse active skin from localStorage:', e);
        }
      }
    };

    loadSkin();

    const handleSkinChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const skin = customEvent.detail;
        if (skin.glowColor) setGlowColor(skin.glowColor);
        if (skin.blurAmount !== undefined) setBlurAmount(skin.blurAmount);
        if (skin.opacity !== undefined) setOpacity(skin.opacity);
        if (skin.activeSkinProfile) setActiveSkinProfile(skin.activeSkinProfile);
        if (skin.selectedAssetPath) {
          setSelectedAsset({
            name: skin.selectedAssetName || 'custom knob',
            path: skin.selectedAssetPath,
            type: 'graphic',
            size: 0
          });
        } else {
          setSelectedAsset(null);
        }
      }
    };

    window.addEventListener('vst-god-skin-changed', handleSkinChanged);
    return () => {
      window.removeEventListener('vst-god-skin-changed', handleSkinChanged);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    // Check if dropping files from OS
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // In standard HTML5, full path is not exposed, but in Tauri/JUCE WebView it is sometimes,
      // or we can read the file data. Let's retrieve path if available, or name
      const path = (file as any).path || file.name;
      
      // Open notice disclaimer first
      setPendingFilePath(path);
      setShowDisclaimer(true);
    }
  };

  const confirmHarvest = () => {
    setShowDisclaimer(false);
    if (pendingFilePath) {
      setHarvesting(true);
      nativeAudio.harvestGraphics(pendingFilePath);
      setPendingFilePath(null);
    }
  };

  const applyCustomStyle = () => {
    // Dynamically update CSS custom properties on document body
    document.documentElement.style.setProperty('--god-primary', glowColor);
    document.documentElement.style.setProperty('--god-blur', `${blurAmount}px`);
    document.documentElement.style.setProperty('--god-opacity', `${opacity / 100}`);
    
    // Also simulate changing dial knobs if selected
    if (selectedAsset) {
      document.documentElement.style.setProperty('--god-knob-image', `url('${selectedAsset.path}')`);
      console.log('Applied custom knob skin:', selectedAsset.name);
    } else {
      document.documentElement.style.removeProperty('--god-knob-image');
    }

    const skinData = {
      glowColor,
      blurAmount,
      opacity,
      activeSkinProfile,
      selectedAssetPath: selectedAsset?.path || '',
      selectedAssetName: selectedAsset?.name || ''
    };
    localStorage.setItem('vst-god-active-skin', JSON.stringify(skinData));
    
    alert(`⚡ SKIN APPLIED: "${activeSkinProfile}" template customized and active!`);
  };

  return (
    <div className="aa-container">
      {/* Disclaimer Modal */}
      <AnimatePresence>
        {showDisclaimer && (
          <motion.div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-[#12081f] border-2 border-[#ffd700] rounded-xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <div className="flex items-center gap-3 text-[#ffd700]">
                <ShieldAlert size={28} />
                <h3 className="font-bold text-lg font-mono tracking-wide">ALTAR OF AESTHETICS NOTICE</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed font-sans">
                You are about to deconstruct a compiled audio binary or folder to harvest UI graphic assets (PNG sliders and knobs). 
                Ensure that you possess the license, rights, or authorization to use the harvested assets in your sound design workspace.
              </p>
              <div className="flex gap-3 mt-2">
                <button 
                  onClick={confirmHarvest} 
                  className="flex-1 py-2 rounded bg-[#ffd700] text-black font-bold font-mono text-sm hover:shadow-[0_0_15px_rgba(255,215,0,0.4)] transition-all"
                >
                  PROCEED RITUAL
                </button>
                <button 
                  onClick={() => setShowDisclaimer(false)} 
                  className="flex-1 py-2 rounded border border-gray-600 text-gray-300 font-bold font-mono text-sm hover:bg-white/5 transition-all"
                >
                  ABORT
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Controls */}
      <aside className="aa-sidebar">
        <div className="aa-header">
          <span>ALTAR OF AESTHETICS</span>
          <h3>SKIN CUSTOMIZER</h3>
        </div>

        <div className="aa-control-group">
          <label className="aa-control-label">Aesthetic Profile</label>
          <div className="aa-preset-list">
            {['Midnight Ember', 'Golden Pantheon', 'Olympian White', 'Void Abyss'].map((profile) => (
              <div 
                key={profile}
                className={`aa-preset-row ${activeSkinProfile === profile ? 'active' : ''}`}
                onClick={() => {
                  setActiveSkinProfile(profile);
                  if (profile === 'Golden Pantheon') { setGlowColor('#ffd700'); setAccentHue(45); }
                  else if (profile === 'Midnight Ember') { setGlowColor('#ff4500'); setAccentHue(15); }
                  else if (profile === 'Olympian White') { setGlowColor('#00d4ff'); setAccentHue(190); }
                  else if (profile === 'Void Abyss') { setGlowColor('#a855f7'); setAccentHue(270); }
                }}
              >
                <span>{profile}</span>
                <span className="aa-preset-row-sigil">🔱</span>
              </div>
            ))}
          </div>
        </div>

        <div className="aa-control-group">
          <label className="aa-control-label">Glow Color</label>
          <div className="flex items-center gap-3">
            <input 
              type="color" 
              value={glowColor} 
              onChange={(e) => setGlowColor(e.target.value)}
              className="w-12 h-8 rounded border border-gray-600 bg-transparent cursor-pointer"
            />
            <span className="font-mono text-xs text-gray-400">{glowColor.toUpperCase()}</span>
          </div>
        </div>

        <div className="aa-control-group">
          <label className="aa-control-label">Backdrop Blur</label>
          <div className="flex flex-col gap-1">
            <input 
              type="range" 
              min="0" 
              max="32" 
              value={blurAmount} 
              onChange={(e) => setBlurAmount(Number(e.target.value))}
              className="w-full accent-[#ffd700]"
            />
            <span className="font-mono text-right text-[10px] text-gray-400">{blurAmount} px</span>
          </div>
        </div>

        <div className="aa-control-group">
          <label className="aa-control-label">Glass Opacity</label>
          <div className="flex flex-col gap-1">
            <input 
              type="range" 
              min="10" 
              max="95" 
              value={opacity} 
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-[#ffd700]"
            />
            <span className="font-mono text-right text-[10px] text-gray-400">{opacity}%</span>
          </div>
        </div>

        <button onClick={applyCustomStyle} className="aa-apply-btn mt-auto">
          APPLY SKIN
        </button>
      </aside>

      {/* Main Preview Area */}
      <section 
        className="aa-preview-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AnimatePresence>
          {dragOver && (
            <motion.div 
              className="aa-drop-zone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="aa-drop-zone-icon"><Palette size={48} /></div>
              <h4>DROP AUDIO PLUGIN TO HARVEST DIALS</h4>
              <p className="text-xs text-gray-400 font-mono">Accepts .vst3, .component, .dll, or folder packs</p>
            </motion.div>
          )}
        </AnimatePresence>

        {harvesting ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-t-[#ffd700] border-transparent animate-spin" />
            <h3 className="font-mono text-sm tracking-widest text-[#ffd700] animate-pulse">DECONSTRUCTING PLUGIN & HARVESTING GRAPHICS...</h3>
          </div>
        ) : (
          <div className="aa-preview-hardware" style={{ '--dial-rotation': '-120deg' } as React.CSSProperties}>
            <div className="aa-preview-header">
              <span>ACTIVE PROFILE: {activeSkinProfile.toUpperCase()}</span>
              <span>🔱 RACK PREVIEW</span>
            </div>
            <div className="aa-preview-body">
              {['tune', 'volume', 'cutoff', 'resonance'].map((dial) => (
                <div key={dial} className="aa-preview-dial-wrapper">
                  <div 
                    className={`aa-preview-dial ${selectedDialType === dial ? 'selected' : ''}`}
                    onClick={() => setSelectedDialType(dial)}
                    style={{ 
                      boxShadow: `0 0 15px ${glowColor}44`,
                      borderColor: selectedDialType === dial ? '#ffffff' : glowColor
                    }}
                  >
                    {selectedAsset && selectedDialType === dial && (
                      <img src={selectedAsset.path} className="w-full h-full object-contain p-1" alt="custom" />
                    )}
                  </div>
                  <span className="aa-preview-dial-label">{dial.toUpperCase()}</span>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-gray-500 font-mono text-center">
              DRAG & DROP A VST PLUGIN FILE HERE TO EXTRACT CUSTOM DIAL GRAPHICS
            </div>
          </div>
        )}
      </section>

      {/* Harvester Panel (Right) */}
      <section className="aa-harvester">
        <div className="aa-harvester-title">
          <Sparkles size={16} className="text-[#ffd700]" />
          <h3>HARVESTED GRAPHICS</h3>
        </div>

        {harvestedAssets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-800 rounded-lg bg-[#0e0719]">
            <AlertTriangle className="text-gray-600 mb-2" size={24} />
            <p className="text-xs text-gray-500 font-mono leading-relaxed">
              No graphics harvested yet. Drop a binary plugin onto the preview area to extract knobs.
            </p>
          </div>
        ) : (
          <div className="aa-asset-grid">
            {harvestedAssets.map((asset, idx) => (
              <div 
                key={idx}
                className={`aa-asset-card ${selectedAsset?.path === asset.path ? 'selected' : ''}`}
                onClick={() => setSelectedAsset(asset)}
              >
                {/* Visual fallback placeholder or direct path */}
                <img src={asset.path} className="aa-asset-preview" alt="knob" onError={(e) => {
                  (e.target as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="gold" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v10l4 4"/></svg>';
                }} />
                <span className="aa-asset-name">{asset.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="aa-notice-banner">
          <ShieldAlert size={20} className="text-[#ffd700] shrink-0" />
          <span>
            Drop harvested assets onto preview slots to bind them to dials.
          </span>
        </div>
      </section>
    </div>
  );
};
