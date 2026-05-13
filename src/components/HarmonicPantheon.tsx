import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DivineKnob } from './ui/DivineKnob';
import { DivineSlider } from './ui/DivineSlider';
import { SpectralAura } from './SpectralAura';

interface Deity {
  id: string;
  name: string;
  domain: string;
  color: string;
  icon: string;
  harmonicProfile: number[]; // Amplitude of first 16 harmonics
  description: string;
}

const DEITIES: Deity[] = [
  {
    id: 'zeus',
    name: 'ZEUS',
    domain: 'VOLT-FOLD',
    color: '#60A5FA',
    icon: '⚡',
    harmonicProfile: [1, 0.8, 0.6, 0.4, 0.2, 0.1, 0.05, 0.02],
    description: 'High-tension pulse with complex harmonic folding. Piercing and authoritative.'
  },
  {
    id: 'ra',
    name: 'RA',
    domain: 'SOLAR CORE',
    color: '#F5B041',
    icon: '☀️',
    harmonicProfile: [1, 0, 0.5, 0, 0.33, 0, 0.25, 0],
    description: 'Pure fundamental + golden-ratio overtones. Warm, radiant, and stable.'
  },
  {
    id: 'poseidon',
    name: 'POSEIDON',
    domain: 'TIDAL WAVE',
    color: '#1ABC9C',
    icon: '🌊',
    harmonicProfile: [1, 0.5, 0.4, 0.3, 0.5, 0.6, 0.2, 0.1],
    description: 'Morphing fluid waveforms. Deep, shifting, and unpredictable.'
  },
  {
    id: 'agni',
    name: 'AGNI',
    domain: 'FIREBRAND',
    color: '#E74C3C',
    icon: '🔥',
    harmonicProfile: [1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4],
    description: 'Distorted, unstable warmth. Flickering with harmonic glitches.'
  },
  {
    id: 'hades',
    name: 'HADES',
    domain: 'VOID SUB',
    color: '#9B59B6',
    icon: '💀',
    harmonicProfile: [1, 0.2, 0.1, 0.05, 0, 0, 0, 0],
    description: 'Deep, resonant shadows. The weight of the underworld.'
  }
];

export const HarmonicPantheon: React.FC<{
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  moduleLevels: Record<string, number>;
}> = ({ parameterValues, update, moduleLevels }) => {
  const selectedDeityId = parameterValues.selectedDeity || 'zeus';
  const selectedDeity = DEITIES.find(d => d.id === selectedDeityId) || DEITIES[0];
  const [activeVoiceMode, setActiveVoiceMode] = useState<'poly' | 'mono' | 'unison'>('poly');

  const handleDeitySelect = (id: string) => {
    update('selectedDeity', id);
  };

  return (
    <div className="harmonic-pantheon-container vg-panel relative overflow-hidden h-full flex flex-col p-6">
      {/* ── Background Ritual Layers ── */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <SpectralAura 
          energy={moduleLevels.masterOutput ? moduleLevels.masterOutput * 100 : 20} 
          decayTime={0.5} 
          spectralCentroid={selectedDeityId === 'zeus' ? 3000 : 400} 
        />
      </div>

      <div className="flex h-full gap-6 relative z-10 min-h-0">
        {/* ── Left Rail: Deity Constellation ── */}
        <aside className="w-64 flex flex-col gap-4 shrink-0">
          <div className="glass-panel p-4 rounded-2xl flex-1 flex flex-col items-center overflow-y-auto">
            <h3 className="text-[10px] font-black text-white/40 tracking-widest mb-6">SELECT DEITY</h3>
            <div className="flex flex-col gap-3 w-full">
              {DEITIES.map(deity => (
                <motion.button
                  key={deity.id}
                  className={`deity-selector-btn ${selectedDeityId === deity.id ? 'active' : ''}`}
                  onClick={() => handleDeitySelect(deity.id)}
                  whileHover={{ x: 5 }}
                  style={{ '--deity-color': deity.color } as any}
                >
                  <div className="deity-icon">{deity.icon}</div>
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="deity-name">{deity.name}</span>
                    <span className="deity-domain truncate w-full text-[6px]">{deity.domain}</span>
                  </div>
                  {selectedDeityId === deity.id && (
                    <motion.div 
                      layoutId="deity-indicator"
                      className="absolute right-0 w-1 h-8 bg-white shadow-[0_0_15px_white] rounded-full"
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl shrink-0">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[8px] font-bold text-white/50 uppercase">Voice Ritual</span>
              <div className="flex gap-1">
                {['poly', 'mono', 'unison'].map(mode => (
                  <button 
                    key={mode}
                    onClick={() => {
                        setActiveVoiceMode(mode as any);
                        update('voiceMode', mode);
                    }}
                    className={`text-[7px] font-black px-1.5 py-0.5 rounded border ${activeVoiceMode === mode ? 'bg-white text-black border-white' : 'text-white/40 border-white/10'}`}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DivineKnob size="sm" label="VOICES" min={1} max={16} value={parameterValues.polyphonyVoices || 8} onChange={(v) => update('polyphonyVoices', v)} />
              <DivineKnob size="sm" label="DETUNE" min={0} max={100} value={parameterValues.unisonDetune || 10} unit="%" onChange={(v) => update('unisonDetune', v)} />
            </div>
          </div>
        </aside>

        {/* ── Center: The Spectral Forge ── */}
        <main className="flex-1 flex flex-col gap-6 min-w-0">
          <div className="glass-panel flex-1 rounded-3xl p-8 relative overflow-hidden group flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start mb-8 shrink-0">
              <div className="flex flex-col">
                <h2 className="text-3xl font-black text-white italic tracking-tighter">SPECTRAL FORGE</h2>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">Harmonic DNA Modification</span>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-bold text-white/30 uppercase">Signature</span>
                  <span className="text-xl font-black text-white">{selectedDeity.name === 'RA' ? 'PURE' : 'COMPLEX'}</span>
                </div>
              </div>
            </div>

            {/* Harmonic Visualizer */}
            <div className="flex-1 relative flex items-end justify-between gap-1 px-4 mb-4 min-h-0">
              {selectedDeity.harmonicProfile.map((amp, i) => (
                <motion.div
                  key={i}
                  className="harmonic-bar"
                  initial={{ height: 0 }}
                  animate={{ 
                    height: `${amp * 90}%`,
                    backgroundColor: selectedDeity.color,
                  }}
                  transition={{ 
                    height: { type: 'spring', stiffness: 100, damping: 15, delay: i * 0.02 },
                  }}
                  style={{ 
                    width: `${100 / 16}%`,
                    boxShadow: `0 0 20px ${selectedDeity.color}33`,
                    opacity: 0.8
                  }}
                />
              ))}
              
              {/* Dynamic Overlay Waveform */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 1000 400" preserveAspectRatio="none">
                <motion.path 
                  fill="none"
                  stroke={selectedDeity.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  animate={{ 
                    d: `M 0 200 ${Array.from({ length: 40 }).map((_, j) => {
                      const x = (j / 39) * 1000;
                      // Jitter for Agni
                      const jitter = selectedDeityId === 'agni' ? (Math.random() - 0.5) * 20 : 0;
                      const y = 200 + Math.sin(j * 0.8 + Date.now() * 0.002) * 80 + jitter;
                      return `L ${x} ${y}`;
                    }).join(' ')}`
                  }}
                />
              </svg>
            </div>

            {/* Spectral Controls */}
            <div className="grid grid-cols-4 gap-8 mt-auto border-t border-white/10 pt-8 shrink-0">
              <DivineKnob label="WARP" value={parameterValues.spectralWarp || 0} onChange={(v) => update('spectralWarp', v)} color={selectedDeity.color} />
              <DivineKnob label="SKEW" value={parameterValues.spectralSkew || 50} onChange={(v) => update('spectralSkew', v)} color={selectedDeity.color} />
              <DivineKnob label="SPREAD" value={parameterValues.spectralSpread || 100} unit="%" onChange={(v) => update('spectralSpread', v)} color={selectedDeity.color} />
              <DivineKnob label="DNA" value={parameterValues.harmonicDna || 20} onChange={(v) => update('harmonicDna', v)} color={selectedDeity.color} />
            </div>
          </div>
        </main>

        {/* ── Right Rail: Divine Envelopes ── */}
        <aside className="w-72 flex flex-col gap-4 shrink-0">
          <div className="glass-panel p-6 rounded-2xl flex-1 flex flex-col overflow-y-auto">
            <h3 className="text-[10px] font-black text-white/40 tracking-widest mb-6 uppercase">Aether Envelope</h3>
            <div className="flex flex-col gap-8">
              <DivineSlider label="ATTACK" value={parameterValues.envAttack || 10} min={0} max={2000} unit="ms" onChange={(v) => update('envAttack', v)} />
              <DivineSlider label="DECAY" value={parameterValues.envDecay || 250} min={10} max={5000} unit="ms" onChange={(v) => update('envDecay', v)} />
              <DivineSlider label="SUSTAIN" value={parameterValues.envSustain || 70} min={0} max={100} unit="%" onChange={(v) => update('envSustain', v)} />
              <DivineSlider label="RELEASE" value={parameterValues.envRelease || 400} min={10} max={5000} unit="ms" onChange={(v) => update('envRelease', v)} />
            </div>
            
            <div className="mt-8 border-t border-white/10 pt-6">
              <h4 className="text-[8px] font-bold text-white/30 uppercase mb-6">Modulation Source</h4>
              <div className="flex gap-4">
                <DivineKnob size="sm" label="LFO RATE" value={parameterValues.lfoRate || 0.5} min={0.1} max={20} unit="Hz" onChange={(v) => update('lfoRate', v)} />
                <DivineKnob size="sm" label="DEPTH" value={parameterValues.lfoDepth || 20} min={0} max={100} unit="%" onChange={(v) => update('lfoDepth', v)} />
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl shrink-0">
            <button className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black text-white tracking-[0.2em] transition-all uppercase shadow-lg shadow-black/20">
              INVOKE MASTER EFFECT
            </button>
          </div>
        </aside>
      </div>

      <style>{`
        .deity-selector-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
          text-align: left;
          width: 100%;
        }
        .deity-selector-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
        }
        .deity-selector-btn.active {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--deity-color);
          box-shadow: 0 0 15px rgba(0, 0, 0, 0.3), inset 0 0 10px var(--deity-color) 22;
        }
        .deity-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 6px;
          font-size: 14px;
          flex-shrink: 0;
        }
        .deity-name {
          font-size: 9px;
          font-weight: 900;
          color: white;
          letter-spacing: 0.1em;
        }
        .deity-domain {
          font-weight: 700;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.15em;
        }
        .harmonic-bar {
          border-radius: 2px 2px 0 0;
          position: relative;
        }
        .harmonic-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: white;
          border-radius: 2px;
          opacity: 0.6;
          box-shadow: 0 0 8px white;
        }
      `}</style>
    </div>
  );
};
