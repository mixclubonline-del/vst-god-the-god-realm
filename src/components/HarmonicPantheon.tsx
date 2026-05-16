import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DivineKnob } from './ui/DivineKnob';
import { DivineSlider } from './ui/DivineSlider';
import { SpectralAura } from './SpectralAura';

/* ─── God Definitions ─── */
interface God {
  id: string;
  god: string;
  origin: string;
  domain: string;
  icon: string;
  color: string;
  avatar: string;
  params: string[];
  harmonicProfile: number[];
  description: string;
}

const GODS: God[] = [
  { id: 'zeus', god: 'Zeus', origin: 'Greek', domain: 'Transients', icon: '⚡', color: '#60A5FA', avatar: '/plugins/gods/zeus.png', params: ['Attack', 'Sustain', 'Punch', 'Threshold'], harmonicProfile: [1, 0.8, 0.6, 0.4, 0.2, 0.1, 0.05, 0.02], description: 'High-tension pulse with complex harmonic folding.' },
  { id: 'ra', god: 'Ra', origin: 'Egyptian', domain: 'Harmonics', icon: '☀️', color: '#F5B041', avatar: '/plugins/gods/ra.png', params: ['Low', 'Mid', 'High', 'Presence'], harmonicProfile: [1, 0, 0.5, 0, 0.33, 0, 0.25, 0], description: 'Pure fundamental + golden-ratio overtones.' },
  { id: 'agni', god: 'Agni', origin: 'Hindu', domain: 'Saturation', icon: '🔥', color: '#E74C3C', avatar: '/plugins/gods/agni.png', params: ['Drive', 'Warmth', 'Mix'], harmonicProfile: [1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4], description: 'Distorted, unstable warmth. Flickering with harmonic glitches.' },
  { id: 'anubis', god: 'Anubis', origin: 'Egyptian', domain: 'Multi-808', icon: '💀', color: '#27AE60', avatar: '/plugins/gods/anubis.png', params: ['Sub', 'Mid', 'Click', 'Phase', 'Drive'], harmonicProfile: [1, 0.2, 0.1, 0.05, 0, 0, 0, 0], description: 'Deep, resonant shadows. The weight of the underworld.' },
  { id: 'loki', god: 'Loki', origin: 'Norse', domain: 'Delay', icon: '🌀', color: '#9B59B6', avatar: '/plugins/gods/loki.png', params: ['Time', 'Feedback', 'Chaos'], harmonicProfile: [0.5, 0.5, 0.4, 0.3, 0.5, 0.6, 0.2, 0.1], description: 'Chaos-threaded delay. Unpredictable feedback storms.' },
  { id: 'poseidon', god: 'Poseidon', origin: 'Greek', domain: 'Reverb', icon: '🌊', color: '#1ABC9C', avatar: '/plugins/gods/poseidon.png', params: ['Size', 'Depth', 'Tide'], harmonicProfile: [1, 0.5, 0.4, 0.3, 0.5, 0.6, 0.2, 0.1], description: 'Morphing fluid waveforms. Deep, shifting, tidal.' },
  { id: 'artemis', god: 'Artemis', origin: 'Greek', domain: 'Celestial Keys', icon: '🌙', color: '#BB8FCE', avatar: '/plugins/gods/artemis.png', params: ['Tines', 'Hammer', 'Drift', 'Luster'], harmonicProfile: [1, 0.3, 0.7, 0.2, 0.4, 0.1, 0.3, 0.15], description: 'Moonlit electric piano tones. Shimmering and ethereal.' },
  { id: 'odin', god: 'Odin', origin: 'Norse', domain: 'Limiter', icon: '🛡️', color: '#85929E', avatar: '/plugins/gods/odin.png', params: ['Ceiling', 'Wisdom'], harmonicProfile: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3], description: 'All-seeing limiter. Controls the final boundary.' },
];

const CX = 240;
const CY = 190;
const R = 145;

export const HarmonicPantheon: React.FC<{
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  moduleLevels: Record<string, number>;
}> = ({ parameterValues, update, moduleLevels }) => {
  const selectedGod = (parameterValues.selectedGod as string) || '';
  const sel = GODS.find(g => g.god === selectedGod);

  // Calculate divine power (avg invoke across all gods)
  const totalInvoke = GODS.reduce((sum, g) => {
    const v = parameterValues[`god_${g.id}_invoke`];
    return sum + (v !== undefined ? (v as number) : 50);
  }, 0);
  const divinePower = Math.round(totalInvoke / GODS.length);

  return (
    <div className="vg-panel vg-pantheon relative overflow-hidden h-full">
      {/* Background Spectral Aura */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <SpectralAura 
          energy={moduleLevels.masterOutput ? moduleLevels.masterOutput * 100 : 20}
          decayTime={0.5}
          spectralCentroid={sel ? (sel.id === 'zeus' ? 3000 : 400) : 600}
        />
      </div>

      <div className="flex h-full relative z-10">
        {/* ═══════════ LEFT: CIRCULAR CONSTELLATION ═══════════ */}
        <div className="vg-constellation-wrap" style={{ flex: sel ? '0 0 55%' : '1 1 100%', transition: 'flex 0.4s ease' }}>
          <div className="vg-constellation-inner" style={{ position: 'relative', height: '100%', width: '100%', maxWidth: 'calc(100vh * (480/380))', maxHeight: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg className="vg-constellation-svg" viewBox="0 0 480 380" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible', width: '100%', height: '100%' }}>
              <defs>
                <radialGradient id="coreGlow"><stop offset="0%" stopColor="rgba(255,215,0,0.25)" /><stop offset="100%" stopColor="transparent" /></radialGradient>
                <filter id="godGlow"><feGaussianBlur stdDeviation="3" /><feColorMatrix type="saturate" values="2" /></filter>
              </defs>

              {/* Ambient orbit rings */}
              <g className="vg-orbit-group-1" style={{ transformOrigin: `${CX}px ${CY}px` }}>
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 6" />
              </g>
              <g className="vg-orbit-group-2" style={{ transformOrigin: `${CX}px ${CY}px` }}>
                <circle cx={CX} cy={CY} r={R - 30} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" strokeDasharray="10 20" />
              </g>
              <g className="vg-orbit-group-3" style={{ transformOrigin: `${CX}px ${CY}px` }}>
                <circle cx={CX} cy={CY} r={R + 20} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" strokeDasharray="2 8" />
              </g>

              {/* Signal flow lines between consecutive gods */}
              {GODS.map((g, i) => {
                const next = GODS[(i + 1) % GODS.length];
                const a1 = (i / GODS.length) * Math.PI * 2 - Math.PI / 2;
                const a2 = ((i + 1) / GODS.length) * Math.PI * 2 - Math.PI / 2;
                const x1 = CX + Math.cos(a1) * R; const y1 = CY + Math.sin(a1) * R;
                const x2 = CX + Math.cos(a2) * R; const y2 = CY + Math.sin(a2) * R;
                const bypassed1 = parameterValues[`god_${g.id}_bypass`] === true;
                const bypassed2 = parameterValues[`god_${next.id}_bypass`] === true;
                return (
                  <g key={`flow-${i}`}>
                    <path d={`M ${x1} ${y1} L ${x2} ${y2}`}
                      fill="none"
                      stroke={(bypassed1 || bypassed2) ? 'rgba(255,255,255,0.03)' : `${g.color}30`}
                      strokeWidth="2.5" strokeDasharray={bypassed1 ? '2 4' : 'none'}
                    />
                    {!(bypassed1 || bypassed2) && (
                      <path d={`M ${x1} ${y1} L ${x2} ${y2}`}
                        fill="none"
                        stroke={g.color}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="5 100"
                        pathLength="100"
                        className="vg-signal-flow-edge"
                        style={{ filter: 'url(#godGlow)', animationDelay: `${i * -0.4}s` }}
                      />
                    )}
                  </g>
                );
              })}

              {/* Lines from each god to center */}
              {GODS.map((g, i) => {
                const angle = (i / GODS.length) * Math.PI * 2 - Math.PI / 2;
                const x = CX + Math.cos(angle) * R; const y = CY + Math.sin(angle) * R;
                const inv = parameterValues[`god_${g.id}_invoke`] as number ?? 50;
                const bypassed = parameterValues[`god_${g.id}_bypass`] === true;
                return (
                  <g key={`core-${i}`}>
                    <line x1={x} y1={y} x2={CX} y2={CY}
                      stroke={`${g.color}${Math.round(inv * 0.2 + 5).toString(16).padStart(2, '0')}`}
                      strokeWidth="0.5" strokeDasharray="2 8"
                    />
                    {!bypassed && inv > 10 && (
                      <line x1={x} y1={y} x2={CX} y2={CY}
                        stroke={g.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="3 100"
                        pathLength="100"
                        className="vg-signal-flow-core"
                        style={{ filter: 'url(#godGlow)', animationDelay: `${i * -0.2}s`, animationDuration: `${3 - (inv / 50)}s` }}
                      />
                    )}
                  </g>
                );
              })}

              {/* Divine Core (center) */}
              <circle cx={CX} cy={CY} r="40" fill="url(#coreGlow)" />
              <circle cx={CX} cy={CY} r="28" fill="rgba(0,0,0,0.6)" stroke="rgba(255,215,0,0.4)" strokeWidth="1.5" />
              <circle cx={CX} cy={CY} r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
              <circle cx={CX} cy={CY} r="24" fill="none" stroke="#FFD700" strokeWidth="2"
                strokeDasharray={`${divinePower * 1.5} ${150 - divinePower * 1.5}`}
                strokeDashoffset="37.5" strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.6))' }}
              />
              <text x={CX} y={CY - 6} textAnchor="middle" className="vg-core-number">{divinePower}</text>
              <text x={CX} y={CY + 8} textAnchor="middle" className="vg-core-label">DIVINE</text>
              <text x={CX} y={CY + 18} textAnchor="middle" className="vg-core-label">POWER</text>

              {/* God Nodes via foreignObject */}
              {GODS.map((god, i) => {
                const angle = (i / GODS.length) * Math.PI * 2 - Math.PI / 2;
                const x = CX + Math.cos(angle) * R;
                const y = CY + Math.sin(angle) * R;
                const invokeVal = parameterValues[`god_${god.id}_invoke`] !== undefined ? (parameterValues[`god_${god.id}_invoke`] as number) : 50;
                const bypassed = parameterValues[`god_${god.id}_bypass`] === true;
                const isSelected = selectedGod === god.god;
                const peakLevel = moduleLevels[god.id] || 0;

                return (
                  <foreignObject 
                    key={god.id} 
                    x={x - 60} 
                    y={y - 60} 
                    width="120" 
                    height="120" 
                    style={{ overflow: 'visible' }}
                  >
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <button
                        className={`vg-cnode ${bypassed ? 'vg-cnode-sleep' : ''} ${isSelected ? 'vg-cnode-active' : ''}`}
                        style={{
                          '--god-c': god.color, 
                          '--god-c-glow': `${god.color}${Math.round(peakLevel * 100).toString(16).padStart(2, '0')}`,
                          '--god-peak': `${1 + peakLevel * 0.2}`,
                          left: '50%', top: '50%', position: 'absolute', transform: `translate(-50%, -50%) scale(${1 + peakLevel * 0.1})`
                        } as any}
                        onClick={() => update('selectedGod', isSelected ? '' : god.god)}
                      >
                        <img src={god.avatar} alt={god.god} className="vg-cnode-img" />
                        <svg viewBox="0 0 44 44" className="vg-cnode-ring">
                          <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                          <circle cx="22" cy="22" r="20" fill="none" stroke={god.color} strokeWidth="2"
                            strokeDasharray={`${invokeVal * 1.26} ${126 - invokeVal * 1.26}`}
                            strokeDashoffset="31.5" strokeLinecap="round"
                            style={{ filter: `drop-shadow(0 0 ${4 + peakLevel * 10}px ${god.color})`, transition: 'stroke-dasharray 0.3s' }}
                          />
                        </svg>
                        <span className="vg-cnode-name">{god.god.toUpperCase()}</span>
                        <span className="vg-cnode-domain">{god.domain}</span>
                      </button>
                    </div>
                  </foreignObject>
                );
              })}
            </svg>
          </div>
        </div>

        {/* ═══════════ RIGHT: DEITY DETAIL PANEL ═══════════ */}
        <AnimatePresence>
          {sel && (
            <motion.div
              className="vg-deity-panel"
              style={{ '--god-c': sel.color, '--god-c-glow': `${sel.color}40` } as any}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '45%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
            >
              <div style={{ minWidth: 320, padding: '24px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Header */}
                <div className="vg-deity-header">
                  <div className="vg-deity-id">
                    <img src={sel.avatar} alt={sel.god} className="vg-deity-thumb" />
                    <div>
                      <div className="vg-deity-title">
                        <span className="vg-deity-icon">{sel.icon}</span>
                        <span className="vg-deity-name">{sel.god.toUpperCase()}</span>
                        <span className="vg-god-origin">{sel.origin}</span>
                      </div>
                      <span className="vg-deity-domain">{sel.domain}</span>
                    </div>
                  </div>
                  <div className="vg-deity-actions">
                    <button className="vg-deity-bypass-btn"
                      onClick={() => update(`god_${sel.id}_bypass`,
                        !(parameterValues[`god_${sel.id}_bypass`] === true)
                      )}
                    >
                      {parameterValues[`god_${sel.id}_bypass`] === true ? '💤 SLEEPING' : '✦ ACTIVE'}
                    </button>
                    <button className="vg-deity-close" onClick={() => update('selectedGod', '')}>✕</button>
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', margin: 0 }}>{sel.description}</p>

                {/* Invoke slider */}
                <div className="vg-deity-invoke-row">
                  <span className="vg-deity-invoke-label">INVOKE</span>
                  <div className="vg-deity-invoke-track">
                    <div className="vg-deity-invoke-fill"
                      style={{ width: `${parameterValues[`god_${sel.id}_invoke`] ?? 50}%` }} />
                    <input type="range" min="0" max="100"
                      value={parameterValues[`god_${sel.id}_invoke`] ?? 50}
                      className="vg-deity-invoke-input"
                      onChange={(e) => update(`god_${sel.id}_invoke`, parseFloat(e.target.value))}
                    />
                  </div>
                  <span className="vg-deity-invoke-val">
                    {(() => {
                      const v = (parameterValues[`god_${sel.id}_invoke`] as number) ?? 50;
                      return v < 20 ? 'MORTAL' : v < 50 ? 'DEMIGOD' : v < 80 ? 'GOD' : 'DEITY';
                    })()}
                  </span>
                </div>

                {/* Harmonic DNA Bars */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 4 }}>
                  {sel.harmonicProfile.map((amp, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${amp * 100}%` }}
                      transition={{ type: 'spring', stiffness: 100, damping: 15, delay: i * 0.03 }}
                      style={{ 
                        flex: 1, 
                        background: sel.color, 
                        borderRadius: '2px 2px 0 0',
                        opacity: 0.7,
                        boxShadow: `0 0 8px ${sel.color}44`
                      }}
                    />
                  ))}
                </div>

                {/* DSP Parameter Knobs */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sel.params.length, 4)}, 1fr)`, gap: 12 }}>
                  {sel.params.map(p => {
                    const paramId = `god_${sel.id}_${p.toLowerCase()}`;
                    const val = parameterValues[paramId] !== undefined ? (parameterValues[paramId] as number) : 50;
                    return (
                      <DivineKnob 
                        key={p}
                        size="sm"
                        label={p.toUpperCase()}
                        min={0}
                        max={100}
                        value={val}
                        onChange={(v) => update(paramId, v)}
                        color={sel.color}
                      />
                    );
                  })}
                </div>

                {/* Anubis Phase Align special */}
                {sel.id === 'anubis' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button 
                      className="vg-deity-bypass-btn"
                      onClick={() => {
                        const current = (parameterValues.god_anubis_phase as number) || 0;
                        update('god_anubis_phase', current > 50 ? 0 : 80);
                      }}
                      style={{ flex: 1 }}
                    >
                      ⚡ PHASE ALIGN
                    </button>
                    <div className="vg-808-viz" style={{ flex: 1 }}>
                      <div className="vg-808-wave-layer sub" style={{ opacity: (parameterValues.god_anubis_sub as number || 50) / 100 }} />
                      <div className="vg-808-wave-layer mid" style={{ opacity: (parameterValues.god_anubis_mid as number || 50) / 100 }} />
                    </div>
                  </div>
                )}

                {/* Aether Envelope */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                  <span style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>AETHER ENVELOPE</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <DivineSlider label="ATTACK" value={parameterValues[`god_${sel.id}_envAttack`] || 10} min={0} max={2000} unit="ms" onChange={(v) => update(`god_${sel.id}_envAttack`, v)} />
                    <DivineSlider label="DECAY" value={parameterValues[`god_${sel.id}_envDecay`] || 250} min={10} max={5000} unit="ms" onChange={(v) => update(`god_${sel.id}_envDecay`, v)} />
                    <DivineSlider label="SUSTAIN" value={parameterValues[`god_${sel.id}_envSustain`] || 70} min={0} max={100} unit="%" onChange={(v) => update(`god_${sel.id}_envSustain`, v)} />
                    <DivineSlider label="RELEASE" value={parameterValues[`god_${sel.id}_envRelease`] || 400} min={10} max={5000} unit="ms" onChange={(v) => update(`god_${sel.id}_envRelease`, v)} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prompt when nothing selected */}
        {!sel && (
          <div className="vg-pantheon-hint" style={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.3em', textTransform: 'uppercase' as const }}>
              SELECT A DEITY TO INVOKE THEIR POWER
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
