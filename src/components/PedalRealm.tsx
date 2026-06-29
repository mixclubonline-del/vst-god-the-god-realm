/**
 * PedalRealm — global pedalboard with god-themed stompboxes.
 * Each pedal is themed after an ancient deity and renders an SVG god portrait.
 * All eight pedals are OFF by default; engage each one individually.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getPedalChain, PEDAL_ORDER, type PedalId } from '../audio/PedalChain';

interface KnobDef { key: string; label: string; min: number; max: number; def: number; }
interface GodPedalDef {
  id: PedalId;
  god: string;       // deity name
  domain: string;    // effect type
  lore: string;      // short flavour text shown on the LCD
  primary: string;   // main accent colour
  secondary: string; // secondary / shadow colour
  bodyGrad: string;  // CSS gradient for the pedal body
  face: React.ReactNode; // SVG portrait inside the pedal
  knobs: KnobDef[];
}

// ── God face SVGs (inline, self-contained) ───────────────────────────────────

function ZeusFace() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64}>
      <defs>
        <radialGradient id="zeus-skin" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#f5d08a" /><stop offset="100%" stopColor="#c49040" />
        </radialGradient>
        <linearGradient id="zeus-crown" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe066" /><stop offset="100%" stopColor="#c49000" />
        </linearGradient>
      </defs>
      {/* crown / laurel */}
      {[14,22,30,38,46,54,62].map((x,i)=>(
        <ellipse key={i} cx={x} cy={14} rx={4} ry={6} fill="url(#zeus-crown)" opacity={0.9}
          transform={`rotate(${(i-3)*5} ${x} 14)`} />
      ))}
      <rect x={10} y={14} width={60} height={5} rx={2} fill="url(#zeus-crown)" />
      {/* face */}
      <ellipse cx={40} cy={46} rx={22} ry={26} fill="url(#zeus-skin)" />
      {/* brow */}
      <path d="M24 34 Q32 30 38 34" stroke="#7a5010" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M42 34 Q48 30 56 34" stroke="#7a5010" strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* eyes */}
      <ellipse cx={32} cy={38} rx={4} ry={3} fill="#1a1005" />
      <ellipse cx={48} cy={38} rx={4} ry={3} fill="#1a1005" />
      <circle cx={33} cy={37} r={1} fill="rgba(255,255,255,0.6)" />
      <circle cx={49} cy={37} r={1} fill="rgba(255,255,255,0.6)" />
      {/* nose */}
      <path d="M40 40 L37 50 Q40 52 43 50 L40 40" fill="#c49040" stroke="#a07020" strokeWidth={0.5} />
      {/* beard */}
      <path d="M24 52 Q30 70 40 72 Q50 70 56 52 Q48 58 40 58 Q32 58 24 52Z" fill="#c8a868" stroke="#a07020" strokeWidth={0.5} />
      {/* beard lines */}
      <path d="M32 58 Q33 65 36 70" stroke="#a07020" strokeWidth={0.8} fill="none" />
      <path d="M40 60 Q40 67 40 72" stroke="#a07020" strokeWidth={0.8} fill="none" />
      <path d="M48 58 Q47 65 44 70" stroke="#a07020" strokeWidth={0.8} fill="none" />
      {/* lightning bolt accent */}
      <path d="M64 20 L60 30 L63 30 L58 42 L62 42 L56 56 L64 38 L60 38 L63 26 L60 26Z" fill="#ffe066" opacity={0.9} style={{ filter: 'drop-shadow(0 0 3px #ffe066)' }} />
    </svg>
  );
}

function RaFace() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64}>
      <defs>
        <radialGradient id="ra-skin" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#f7c96a" /><stop offset="100%" stopColor="#d4820a" />
        </radialGradient>
      </defs>
      {/* sun disc */}
      {Array.from({length:12},(_,i)=>{
        const a = (i*30)*Math.PI/180;
        return <line key={i} x1={40+Math.cos(a)*16} y1={12+Math.sin(a)*16}
          x2={40+Math.cos(a)*22} y2={12+Math.sin(a)*22} stroke="#ffcc00" strokeWidth={2} strokeLinecap="round" />;
      })}
      <circle cx={40} cy={12} r={10} fill="#ffcc00" style={{ filter: 'drop-shadow(0 0 4px #ffcc00)' }} />
      {/* headdress */}
      <path d="M18 30 L22 20 L40 18 L58 20 L62 30 Q56 26 40 26 Q24 26 18 30Z" fill="#cc8800" />
      {/* face */}
      <ellipse cx={40} cy={50} rx={20} ry={22} fill="url(#ra-skin)" />
      {/* eye of Ra — left */}
      <path d="M22 44 Q28 40 35 44 Q28 48 22 44Z" fill="#1a0a00" />
      <path d="M22 44 Q28 48 35 44" stroke="#cc8800" strokeWidth={1.5} fill="none" />
      <path d="M35 44 Q37 50 33 52" stroke="#1a0a00" strokeWidth={1.2} fill="none" />
      {/* eye right */}
      <path d="M45 44 Q52 40 58 44 Q52 48 45 44Z" fill="#1a0a00" />
      <path d="M45 44 Q52 48 58 44" stroke="#cc8800" strokeWidth={1.5} fill="none" />
      <path d="M45 44 Q43 50 47 52" stroke="#1a0a00" strokeWidth={1.2} fill="none" />
      {/* nose */}
      <line x1={40} y1={46} x2={40} y2={54} stroke="#c07820" strokeWidth={1.5} />
      <path d="M36 54 Q40 56 44 54" stroke="#c07820" strokeWidth={1.5} fill="none" />
      {/* mouth */}
      <path d="M33 60 Q40 64 47 60" stroke="#8a4010" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      {/* collar */}
      <path d="M20 68 Q40 75 60 68 Q56 65 40 67 Q24 65 20 68Z" fill="#cc8800" />
    </svg>
  );
}

function PoseidonFace() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64}>
      <defs>
        <radialGradient id="pos-skin" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#7dd4e8" /><stop offset="100%" stopColor="#1a6a8a" />
        </radialGradient>
      </defs>
      {/* wave crown */}
      <path d="M14 22 Q20 14 28 22 Q34 14 42 22 Q48 14 56 22 Q62 14 68 22 L68 26 Q62 20 56 26 Q50 20 44 26 Q38 20 32 26 Q26 20 20 26 Q14 20 14 22Z"
        fill="#00aacc" />
      {/* trident tips */}
      {[28,40,52].map((x,i)=>(
        <path key={i} d={`M${x} 14 L${x-3} 8 L${x} 12 L${x+3} 8 L${x} 14`} fill="#00ccee" />
      ))}
      {/* face */}
      <ellipse cx={40} cy={50} rx={22} ry={24} fill="url(#pos-skin)" />
      {/* eyes */}
      <ellipse cx={32} cy={43} rx={4.5} ry={3.5} fill="#002244" />
      <ellipse cx={48} cy={43} rx={4.5} ry={3.5} fill="#002244" />
      <circle cx={33} cy={42} r={1.2} fill="rgba(180,240,255,0.7)" />
      <circle cx={49} cy={42} r={1.2} fill="rgba(180,240,255,0.7)" />
      {/* brow */}
      <path d="M26 38 Q32 35 38 38" stroke="#005577" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M42 38 Q48 35 54 38" stroke="#005577" strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* beard — wavy */}
      <path d="M22 56 Q24 62 22 68 Q28 60 30 68 Q34 60 36 68 Q40 60 40 70 Q44 60 46 68 Q50 60 52 68 Q54 62 56 56 Q48 62 40 62 Q32 62 22 56Z" fill="#0088aa" />
      {/* water drops */}
      <circle cx={20} cy={50} r={2} fill="#00ccee" opacity={0.6} />
      <circle cx={60} cy={50} r={2} fill="#00ccee" opacity={0.6} />
    </svg>
  );
}

function HadesFace() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64}>
      <defs>
        <radialGradient id="hades-skin" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#6a6a7a" /><stop offset="100%" stopColor="#1a1a22" />
        </radialGradient>
      </defs>
      {/* helm of darkness */}
      <path d="M14 30 L18 14 Q40 8 62 14 L66 30 Q60 20 40 20 Q20 20 14 30Z" fill="#1a1a22" />
      <path d="M18 14 L14 6 L22 12" fill="#2a2a3a" />
      <path d="M62 14 L66 6 L58 12" fill="#2a2a3a" />
      {/* face */}
      <ellipse cx={40} cy={50} rx={22} ry={24} fill="url(#hades-skin)" />
      {/* glowing purple eyes */}
      <ellipse cx={32} cy={43} rx={5} ry={4} fill="#2a0a3a" />
      <ellipse cx={48} cy={43} rx={5} ry={4} fill="#2a0a3a" />
      <ellipse cx={32} cy={43} rx={3} ry={2.5} fill="#8855cc" style={{ filter: 'drop-shadow(0 0 4px #8855cc)' }} />
      <ellipse cx={48} cy={43} rx={3} ry={2.5} fill="#8855cc" style={{ filter: 'drop-shadow(0 0 4px #8855cc)' }} />
      {/* brow — heavy */}
      <path d="M24 37 Q32 33 38 38" stroke="#111" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M42 38 Q48 33 56 37" stroke="#111" strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* angular nose */}
      <path d="M40 46 L37 54 L40 56 L43 54Z" fill="#3a3a4a" />
      {/* thin grim mouth */}
      <path d="M32 62 Q40 60 48 62" stroke="#2a0a3a" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {/* shadow wisps */}
      <path d="M14 46 Q10 50 14 54" stroke="#5533aa" strokeWidth={1} fill="none" opacity={0.5} />
      <path d="M66 46 Q70 50 66 54" stroke="#5533aa" strokeWidth={1} fill="none" opacity={0.5} />
    </svg>
  );
}

function ThothFace() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64}>
      <defs>
        <radialGradient id="thoth-skin" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#b8f0d0" /><stop offset="100%" stopColor="#2a7a5a" />
        </radialGradient>
      </defs>
      {/* ibis beak / head */}
      <ellipse cx={40} cy={24} rx={14} ry={18} fill="#e8e8d0" />
      <path d="M40 8 Q50 2 54 6 Q44 10 40 18Z" fill="#c8c8b0" />
      <path d="M26 16 Q22 10 25 6 Q30 12 34 18Z" fill="#c8c8b0" />
      <circle cx={36} cy={22} r={3} fill="#1a0a00" />
      <circle cx={35} cy={21} r={0.8} fill="rgba(255,255,255,0.8)" />
      {/* ibis beak (long curved) */}
      <path d="M38 30 Q30 36 20 46 Q18 48 20 50 Q22 48 24 46 Q30 42 40 34Z" fill="#c8c8b0" stroke="#aaa890" strokeWidth={0.5} />
      {/* neck + body */}
      <path d="M30 30 Q28 40 26 52 Q32 58 40 60 Q48 58 54 52 Q52 40 50 30 Q44 34 40 34 Q36 34 30 30Z" fill="url(#thoth-skin)" />
      {/* collar / pectoral */}
      <path d="M24 50 Q40 56 56 50 Q52 46 40 48 Q28 46 24 50Z" fill="#00aa77" />
      {/* scroll / stylus */}
      <rect x={54} y={36} width={5} height={20} rx={2} fill="#c8a860" transform="rotate(-20 56 46)" />
      <path d="M56 38 Q60 38 60 44 Q60 38 64 38" stroke="#a08840" strokeWidth={1} fill="none" />
    </svg>
  );
}

function FreyaFace() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64}>
      <defs>
        <radialGradient id="freya-skin" cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#f0e8ff" /><stop offset="100%" stopColor="#a888cc" />
        </radialGradient>
        <linearGradient id="freya-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe8c0" /><stop offset="100%" stopColor="#d4a040" />
        </linearGradient>
      </defs>
      {/* flowing hair */}
      <path d="M14 36 Q10 50 12 66 Q18 56 18 44 Q16 38 14 36Z" fill="url(#freya-hair)" />
      <path d="M66 36 Q70 50 68 66 Q62 56 62 44 Q64 38 66 36Z" fill="url(#freya-hair)" />
      <path d="M18 22 Q16 14 22 10 Q30 16 40 14 Q50 16 58 10 Q64 14 62 22 Q56 18 40 18 Q24 18 18 22Z" fill="url(#freya-hair)" />
      {/* face */}
      <ellipse cx={40} cy={46} rx={22} ry={24} fill="url(#freya-skin)" />
      {/* Necklace Brisingamen */}
      <path d="M22 66 Q40 72 58 66" stroke="#ffcc00" strokeWidth={2} fill="none" />
      {[24,32,40,48,56].map((x,i)=>(
        <circle key={i} cx={x} cy={67+(i%2?1:0)} r={2} fill="#ffcc00" style={{ filter: 'drop-shadow(0 0 2px #ffcc00)' }} />
      ))}
      {/* eyes — large, almond */}
      <path d="M24 41 Q32 36 38 41 Q32 46 24 41Z" fill="#3a2060" />
      <path d="M42 41 Q48 36 56 41 Q48 46 42 41Z" fill="#3a2060" />
      <circle cx={31} cy={40} r={1.5} fill="rgba(200,180,255,0.8)" />
      <circle cx={49} cy={40} r={1.5} fill="rgba(200,180,255,0.8)" />
      {/* nose */}
      <path d="M38 46 Q40 48 42 46" stroke="#a888cc" strokeWidth={1.2} fill="none" />
      {/* gentle smile */}
      <path d="M32 56 Q40 62 48 56" stroke="#8855aa" strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* frost runes */}
      <text x={12} y={52} fontSize={7} fill="#c0e8ff" opacity={0.6} fontFamily="serif">ᚠ</text>
      <text x={62} y={52} fontSize={7} fill="#c0e8ff" opacity={0.6} fontFamily="serif">ᚱ</text>
    </svg>
  );
}

function HermesFace() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64}>
      <defs>
        <radialGradient id="hermes-skin" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#e8d8a0" /><stop offset="100%" stopColor="#b09040" />
        </radialGradient>
      </defs>
      {/* winged helmet */}
      <ellipse cx={40} cy={22} rx={20} ry={16} fill="#888" />
      <ellipse cx={40} cy={22} rx={18} ry={14} fill="#aaa" />
      {/* wings */}
      <path d="M20 20 Q8 10 6 20 Q8 28 20 26Z" fill="#e8e8e8" stroke="#aaa" strokeWidth={0.5} />
      <path d="M20 20 Q6 14 8 24 Q12 30 22 28Z" fill="#ddd" />
      <path d="M60 20 Q72 10 74 20 Q72 28 60 26Z" fill="#e8e8e8" stroke="#aaa" strokeWidth={0.5} />
      <path d="M60 20 Q74 14 72 24 Q68 30 58 28Z" fill="#ddd" />
      {/* face */}
      <ellipse cx={40} cy={50} rx={20} ry={22} fill="url(#hermes-skin)" />
      {/* alert eyes */}
      <ellipse cx={32} cy={44} rx={4.5} ry={3.5} fill="#1a1000" />
      <ellipse cx={48} cy={44} rx={4.5} ry={3.5} fill="#1a1000" />
      <circle cx={33} cy={43} r={1.2} fill="rgba(255,255,200,0.7)" />
      <circle cx={49} cy={43} r={1.2} fill="rgba(255,255,200,0.7)" />
      {/* caduceus */}
      <line x1={66} y1={20} x2={66} y2={70} stroke="#c8a840" strokeWidth={2} />
      <path d="M62 30 Q66 26 70 30 Q66 34 62 38 Q66 42 70 38" stroke="#44aa44" strokeWidth={1.5} fill="none" />
      <circle cx={66} cy={24} r={3} fill="#c8a840" />
      {/* confident smirk */}
      <path d="M32 58 Q37 62 44 58" stroke="#8a6020" strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* speed lines */}
      <line x1={6} y1={46} x2={16} y2={46} stroke="#ffee88" strokeWidth={1} opacity={0.5} />
      <line x1={6} y1={50} x2={14} y2={50} stroke="#ffee88" strokeWidth={1} opacity={0.4} />
    </svg>
  );
}

function AnubisFace() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64}>
      <defs>
        <radialGradient id="anubis-skin" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#2a2a2a" /><stop offset="100%" stopColor="#080808" />
        </radialGradient>
      </defs>
      {/* jackal ears */}
      <path d="M18 30 L10 8 L24 22Z" fill="#1a1a1a" />
      <path d="M62 30 L70 8 L56 22Z" fill="#1a1a1a" />
      <path d="M19 28 L14 12 L24 22Z" fill="#3a2a2a" />
      <path d="M61 28 L66 12 L56 22Z" fill="#3a2a2a" />
      {/* head */}
      <ellipse cx={40} cy={44} rx={24} ry={28} fill="url(#anubis-skin)" />
      {/* elongated jackal snout */}
      <path d="M28 54 Q32 58 40 60 Q48 58 52 54 Q46 56 40 56 Q34 56 28 54Z" fill="#1a1a1a" />
      <path d="M30 50 L26 66 Q33 60 40 62 Q47 60 54 66 L50 50Z" fill="#111" stroke="#2a2a2a" strokeWidth={0.5} />
      {/* golden collar */}
      <path d="M16 46 Q40 54 64 46 Q60 40 40 42 Q20 40 16 46Z" fill="#cc9900" stroke="#aa7700" strokeWidth={0.5} />
      {[20,28,36,44,52,60].map((x,i)=>(
        <rect key={i} x={x-3} y={42} width={6} height={4} rx={1} fill={i%2===0?'#eebb00':'#cc8800'} />
      ))}
      {/* glowing gold eyes */}
      <ellipse cx={32} cy={38} rx={5} ry={4} fill="#220800" />
      <ellipse cx={48} cy={38} rx={5} ry={4} fill="#220800" />
      <ellipse cx={32} cy={38} rx={3} ry={2.5} fill="#ee9900" style={{ filter: 'drop-shadow(0 0 3px #ee9900)' }} />
      <ellipse cx={48} cy={38} rx={3} ry={2.5} fill="#ee9900" style={{ filter: 'drop-shadow(0 0 3px #ee9900)' }} />
      {/* scales of justice */}
      <line x1={64} y1={28} x2={64} y2={56} stroke="#cc9900" strokeWidth={1.5} />
      <line x1={58} y1={34} x2={70} y2={34} stroke="#cc9900" strokeWidth={1} />
      <circle cx={58} cy={36} r={3} fill="none" stroke="#cc9900" strokeWidth={1} />
      <circle cx={70} cy={36} r={3} fill="none" stroke="#cc9900" strokeWidth={1} />
    </svg>
  );
}

// ── God pedal definitions ─────────────────────────────────────────────────────

const GOD_PEDALS: GodPedalDef[] = [
  {
    id: 'overtone', god: 'ZEUS', domain: 'THUNDER DRIVE', lore: 'OLYMPUS',
    primary: '#f5cc30', secondary: '#7a5010',
    bodyGrad: 'linear-gradient(160deg,#2a1e04,#1a1202)',
    face: <ZeusFace />,
    knobs: [
      { key: 'drive',  label: 'WRATH',  min: 0, max: 100, def: 55 },
      { key: 'mix',    label: 'STORM',  min: 0, max: 100, def: 100 },
      { key: 'tone',   label: 'BOLT',   min: 0, max: 100, def: 60 },
      { key: 'freq',   label: 'CHARGE', min: 0, max: 100, def: 70 },
    ],
  },
  {
    id: 'lofreq', god: 'RA', domain: 'SOLAR GRIT', lore: 'HELIOPOLIS',
    primary: '#ffaa00', secondary: '#aa5500',
    bodyGrad: 'linear-gradient(160deg,#241200,#160b00)',
    face: <RaFace />,
    knobs: [
      { key: 'jitter',    label: 'HAZE',   min: 0, max: 100, def: 20 },
      { key: 'drive',     label: 'FIRE',   min: 0, max: 100, def: 35 },
      { key: 'frequency', label: 'DISC',   min: 0, max: 100, def: 75 },
      { key: 'mix',       label: 'RADIANCE',min: 0, max: 100, def: 100 },
    ],
  },
  {
    id: 'chorus', god: 'POSEIDON', domain: 'DEPTH CHORUS', lore: 'ATLANTIS',
    primary: '#00ccee', secondary: '#004466',
    bodyGrad: 'linear-gradient(160deg,#001a26,#000d18)',
    face: <PoseidonFace />,
    knobs: [
      { key: 'analog',  label: 'TIDE',   min: 0, max: 100, def: 40 },
      { key: 'vibrato', label: 'CURRENT',min: 0, max: 100, def: 35 },
      { key: 'depth',   label: 'DEPTH',  min: 0, max: 100, def: 45 },
      { key: 'rate',    label: 'WAVE',   min: 0, max: 100, def: 30 },
      { key: 'mix',     label: 'ABYSS',  min: 0, max: 100, def: 50 },
    ],
  },
  {
    id: 'echoflux', god: 'HADES', domain: 'SHADOW DELAY', lore: 'UNDERWORLD',
    primary: '#8855cc', secondary: '#220044',
    bodyGrad: 'linear-gradient(160deg,#0e0010,#060008)',
    face: <HadesFace />,
    knobs: [
      { key: 'drive',    label: 'SHADE',  min: 0, max: 100, def: 30 },
      { key: 'detune',   label: 'WAIL',   min: 0, max: 100, def: 20 },
      { key: 'mix',      label: 'VOID',   min: 0, max: 100, def: 45 },
      { key: 'speed',    label: 'DRIFT',  min: 0, max: 100, def: 30 },
      { key: 'feedback', label: 'ECHO',   min: 0, max: 100, def: 40 },
    ],
  },
  {
    id: 'timewarp', god: 'THOTH', domain: 'WISDOM ECHO', lore: 'HERMOPOLIS',
    primary: '#44ddaa', secondary: '#115533',
    bodyGrad: 'linear-gradient(160deg,#001a10,#000d08)',
    face: <ThothFace />,
    knobs: [
      { key: 'capture', label: 'INSCRIBE', min: 0, max: 100, def: 35 },
      { key: 'flutter', label: 'SCROLL',   min: 0, max: 100, def: 30 },
      { key: 'flux',    label: 'RUNE',     min: 0, max: 100, def: 38 },
      { key: 'drift',   label: 'AGE',      min: 0, max: 100, def: 25 },
      { key: 'mix',     label: 'QUILL',    min: 0, max: 100, def: 40 },
    ],
  },
  {
    id: 'retroverb', god: 'FREYA', domain: 'FROST REVERB', lore: 'VALHALLA',
    primary: '#aaccff', secondary: '#224488',
    bodyGrad: 'linear-gradient(160deg,#060e1e,#02060e)',
    face: <FreyaFace />,
    knobs: [
      { key: 'time',     label: 'MIST',  min: 0, max: 100, def: 45 },
      { key: 'predelay', label: 'VEIL',  min: 0, max: 100, def: 15 },
      { key: 'mix',      label: 'HALL',  min: 0, max: 100, def: 35 },
      { key: 'drift',    label: 'FROST', min: 0, max: 100, def: 30 },
    ],
  },
  {
    id: 'trem', god: 'HERMES', domain: 'SPEED PHASER', lore: 'OLYMPUS',
    primary: '#ffee66', secondary: '#886600',
    bodyGrad: 'linear-gradient(160deg,#1a1600,#0e0c00)',
    face: <HermesFace />,
    knobs: [
      { key: 'depth', label: 'WING',  min: 0, max: 100, def: 55 },
      { key: 'rate',  label: 'RUSH',  min: 0, max: 100, def: 35 },
      { key: 'shape', label: 'FLEET', min: 0, max: 100, def: 0 },
    ],
  },
  {
    id: 'backtrack', god: 'ANUBIS', domain: 'GATE CRUNCH', lore: 'DUAT',
    primary: '#ee9900', secondary: '#441100',
    bodyGrad: 'linear-gradient(160deg,#0a0800,#050400)',
    face: <AnubisFace />,
    knobs: [
      { key: 'pitch',   label: 'SOUL',   min: 0, max: 100, def: 40 },
      { key: 'mix',     label: 'WEIGH',  min: 0, max: 100, def: 50 },
      { key: 'forward', label: 'JUDGE',  min: 0, max: 100, def: 45 },
      { key: 'width',   label: 'GATE',   min: 0, max: 100, def: 50 },
    ],
  },
];

const LS_KEY = 'vst-god-pedal-realm-v1';

// ── Knob component ────────────────────────────────────────────────────────────
let _pkSeq = 0;
function GodKnob({ value, min, max, accent, label, onChange }:
  { value: number; min: number; max: number; accent: string; label: string; onChange: (v: number) => void }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const rot = -135 + pct * 270;
  const drag = useRef({ y: 0, v: 0 });
  const uid = useRef(`gk${++_pkSeq}`).current;
  const down = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); drag.current = { y: e.clientY, v: value };
    const mv = (me: MouseEvent) => {
      const d = (drag.current.y - me.clientY) / 130 * (max - min);
      onChange(Math.max(min, Math.min(max, drag.current.v + d)));
    };
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  }, [value, min, max, onChange]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'ns-resize', userSelect: 'none' }} onMouseDown={down}>
      <svg width={40} height={40} viewBox="0 0 46 46">
        <defs>
          <radialGradient id={`${uid}-r`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#3a3640" /><stop offset="70%" stopColor="#1a1820" /><stop offset="100%" stopColor="#060508" />
          </radialGradient>
        </defs>
        {/* glow arc */}
        <circle cx={23} cy={23} r={20} fill="none" stroke={`${accent}22`} strokeWidth={4} />
        {/* tick marks */}
        {Array.from({ length: 11 }, (_, i) => {
          const a = (-135 + (i / 10) * 270) * Math.PI / 180;
          const lit = (i / 10) <= pct;
          return <line key={i}
            x1={23 + Math.sin(a) * 17} y1={23 - Math.cos(a) * 17}
            x2={23 + Math.sin(a) * 20} y2={23 - Math.cos(a) * 20}
            stroke={lit ? accent : 'rgba(255,255,255,0.15)'} strokeWidth={1.6} strokeLinecap="round" />;
        })}
        <circle cx={23} cy={23} r={13} fill={`url(#${uid}-r)`} stroke="rgba(0,0,0,0.7)" strokeWidth={1} />
        {/* inner metallic ring */}
        <circle cx={23} cy={23} r={13} fill="none" stroke={`${accent}44`} strokeWidth={0.8} />
        <g transform={`rotate(${rot} 23 23)`}>
          <line x1={23} y1={23} x2={23} y2={11} stroke={accent} strokeWidth={2.5} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${accent})` }} />
        </g>
      </svg>
      <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

// ── God stompbox ──────────────────────────────────────────────────────────────
function GodStompbox({ def, enabled, values, onToggle, onKnob }:
  { def: GodPedalDef; enabled: boolean; values: Record<string, number>; onToggle: () => void; onKnob: (k: string, v: number) => void }) {
  return (
    <div style={{
      position: 'relative', borderRadius: 14, overflow: 'hidden',
      background: def.bodyGrad,
      border: `1px solid ${def.primary}30`,
      boxShadow: enabled
        ? `0 0 18px ${def.primary}44, 0 8px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)`
        : '0 8px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex', flexDirection: 'column', minHeight: 300, transition: 'box-shadow 0.3s',
    }}>
      {/* top accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${def.primary},transparent)`, opacity: enabled ? 1 : 0.3, transition: 'opacity 0.3s' }} />

      {/* corner screws */}
      {[{top:8,left:8},{top:8,right:8},{bottom:8,left:8},{bottom:8,right:8}].map((p,i)=>(
        <div key={i} style={{ position:'absolute', ...p, width:6, height:6, borderRadius:'50%',
          background:'radial-gradient(circle at 35% 30%,#bbb,#555 65%,#222)',
          boxShadow:'0 1px 2px rgba(0,0,0,0.7)', zIndex: 2 }} />
      ))}

      {/* God face portrait area */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 8px 8px', position: 'relative' }}>
        {/* art deco frame behind the face */}
        <div style={{
          position: 'absolute', inset: 8, borderRadius: 10,
          background: `radial-gradient(ellipse at 50% 40%, ${def.primary}14, transparent 70%)`,
          border: `1px solid ${def.primary}22`,
        }} />
        <div style={{ position: 'relative', zIndex: 1, filter: enabled ? 'none' : 'grayscale(0.6) brightness(0.6)', transition: 'filter 0.3s' }}>
          {def.face}
        </div>
      </div>

      {/* God name + domain */}
      <div style={{ textAlign: 'center', padding: '0 8px 6px', lineHeight: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.12em', color: def.primary, textShadow: enabled ? `0 0 8px ${def.primary}88` : 'none', transition: 'text-shadow 0.3s' }}>
          {def.god}
        </div>
        <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.42)', marginTop: 2 }}>{def.domain}</div>
        {/* LCD strip */}
        <div style={{ margin: '5px auto 0', width: '80%', background: 'rgba(0,0,0,0.6)', borderRadius: 3, padding: '2px 6px', fontFamily: 'monospace', fontSize: 8, color: enabled ? def.primary : 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', border: '1px solid rgba(0,0,0,0.6)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.7)', transition: 'color 0.3s' }}>
          {def.lore}
        </div>
      </div>

      {/* Knobs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, padding: '4px 10px 6px', flex: 1, alignContent: 'center' }}>
        {def.knobs.map(k => (
          <GodKnob key={k.key} value={values[k.key] ?? k.def} min={k.min} max={k.max}
            accent={def.primary} label={k.label} onChange={v => onKnob(k.key, v)} />
        ))}
      </div>

      {/* Footswitch */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 14px' }}>
        <button onClick={onToggle} title={enabled ? 'Bypass' : 'Engage'} style={{
          width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', position: 'relative',
          background: enabled
            ? `radial-gradient(circle at 38% 32%, ${def.primary}cc, ${def.secondary}88)`
            : 'radial-gradient(circle at 38% 32%, #444, #1a1a1a)',
          border: `2px solid ${enabled ? def.primary : 'rgba(255,255,255,0.15)'}`,
          boxShadow: enabled
            ? `0 0 14px ${def.primary}66, inset 0 2px 4px rgba(255,255,255,0.25)`
            : 'inset 0 2px 4px rgba(255,255,255,0.1), 0 3px 8px rgba(0,0,0,0.6)',
          transition: 'all 0.2s',
        }}>
          {/* LED dot in footswitch */}
          <span style={{
            position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%',
            background: enabled ? def.primary : '#2a2a2a',
            boxShadow: enabled ? `0 0 5px ${def.primary}` : 'none',
            transition: 'all 0.2s',
          }} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface PedalRealmProps { isActiveTab?: boolean; showMessage?: (m: string) => void; }

export const PedalRealm: React.FC<PedalRealmProps> = ({ showMessage }) => {
  const chainRef = useRef(getPedalChain());
  const [persisted] = useState<any>(() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } });

  const [masterOn, setMasterOn] = useState<boolean>(() => !!persisted.masterOn);
  const [enabled, setEnabled] = useState<Record<PedalId, boolean>>(() => {
    const init: any = {};
    for (const id of PEDAL_ORDER) init[id] = persisted.enabled?.[id] ?? false;
    return init;
  });
  const [values, setValues] = useState<Record<PedalId, Record<string, number>>>(() => {
    const init: any = {};
    for (const def of GOD_PEDALS) {
      init[def.id] = {};
      for (const k of def.knobs) init[def.id][k.key] = persisted.values?.[def.id]?.[k.key] ?? k.def;
    }
    return init;
  });

  useEffect(() => {
    const chain = chainRef.current;
    for (const def of GOD_PEDALS) {
      chain.setPedalEnabled(def.id, enabled[def.id]);
      for (const k of def.knobs) chain.setPedalParam(def.id, k.key, values[def.id][k.key]);
    }
    chain.setActive(masterOn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMaster = useCallback(() => {
    setMasterOn(prev => {
      const v = !prev; chainRef.current.setActive(v);
      try { localStorage.setItem(LS_KEY, JSON.stringify({ masterOn: v, enabled, values })); } catch {}
      showMessage?.(v ? 'PEDAL REALM: ON — the gods process all audio' : 'PEDAL REALM: SILENCED');
      return v;
    });
  }, [enabled, values, showMessage]);

  const togglePedal = useCallback((id: PedalId) => {
    setEnabled(prev => {
      const next = { ...prev, [id]: !prev[id] };
      chainRef.current.setPedalEnabled(id, next[id]);
      try { localStorage.setItem(LS_KEY, JSON.stringify({ masterOn, enabled: next, values })); } catch {}
      return next;
    });
  }, [masterOn, values]);

  const setKnob = useCallback((id: PedalId, key: string, v: number) => {
    chainRef.current.setPedalParam(id, key, v);
    setValues(prev => {
      const next = { ...prev, [id]: { ...prev[id], [key]: v } };
      try { localStorage.setItem(LS_KEY, JSON.stringify({ masterOn, enabled, values: next })); } catch {}
      return next;
    });
  }, [masterOn, enabled]);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: 'linear-gradient(180deg,#060408,#030205)', padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.5)', position: 'sticky', top: 0, zIndex: 5, backdropFilter: 'blur(8px)' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.18em', color: '#fff', textTransform: 'uppercase' }}>PEDAL REALM</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', marginTop: 1 }}>DIVINE EFFECTS CHAIN · GODS PROCESS ALL AUDIO</div>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: masterOn ? '#4ade80' : 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', transition: 'color 0.2s' }}>{masterOn ? '⚡ ACTIVE' : 'DORMANT'}</span>
        <button onClick={toggleMaster} title="Activate / Silence the entire rack" style={{
          position: 'relative', width: 60, height: 30, borderRadius: 15, cursor: 'pointer',
          background: masterOn ? 'linear-gradient(90deg,#1a5a30,#36c466)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${masterOn ? '#36c466' : 'rgba(255,255,255,0.15)'}`,
          boxShadow: masterOn ? '0 0 14px rgba(54,196,102,0.4)' : 'none', transition: 'all 0.2s',
        }}>
          <span style={{ position: 'absolute', top: 3, left: masterOn ? 33 : 3, width: 22, height: 22, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%,#fff,#ccc 60%,#999)', boxShadow: '0 2px 4px rgba(0,0,0,0.5)', transition: 'left 0.2s' }} />
        </button>
      </div>

      {/* Pedalboard grid */}
      <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))', gap: 18 }}>
        {GOD_PEDALS.map(def => (
          <GodStompbox key={def.id} def={def} enabled={enabled[def.id]} values={values[def.id]}
            onToggle={() => togglePedal(def.id)} onKnob={(k, v) => setKnob(def.id, k, v)} />
        ))}
      </div>

      {!masterOn && (
        <div style={{ textAlign: 'center', padding: '0 0 20px', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
          THE GODS SLEEP — ENGAGE THE MASTER SWITCH TO AWAKEN
        </div>
      )}
    </div>
  );
};
