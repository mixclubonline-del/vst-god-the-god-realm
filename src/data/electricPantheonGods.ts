/**
 * electricPantheonGods.ts — The Sacred Registry
 * 
 * Every god in the Electric Pantheon is defined here.
 * Each deity carries its own sonic identity, emotional purpose,
 * visual realm, performance behavior, and macro interpretation.
 * 
 * This is the single source of truth for the entire Pantheon UI.
 */

/* ─── Type Definitions ─── */

export type ElectricPantheonGodId =
  | 'olympus'
  | 'hades'
  | 'zeus'
  | 'athena'
  | 'poseidon'
  | 'titan'
  | 'apollo'
  | 'chronos';

export interface GodMacroBehavior {
  energy: string;
  divinity: string;
  width: string;
  realm: string;
  aura: string;
  age: string;
}

export interface GodProfile {
  element: string;
  domain: string;
  energy: string;
  mood: string;
  quote: string;
}

export interface GodColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface ElectricPantheonGod {
  id: ElectricPantheonGodId;
  name: string;
  title: string;
  tone: string[];
  emotionalPurpose: string;
  bestFor: string[];
  sonicReferences: string[];
  keyBehavior: string[];
  macroBehavior: GodMacroBehavior;
  profile: GodProfile;
  colors: GodColors;
  realmFx: string[];
  /** Path to hero artwork in /public */
  heroImage: string;
  /** Icon character or emoji for selector cards */
  icon: string;
}

/* ─── God Registry ─── */

export const electricPantheonGods: ElectricPantheonGod[] = [
  // ═══════════ 1. OLYMPUS ═══════════
  {
    id: 'olympus',
    name: 'OLYMPUS',
    title: 'Luxury Above The Clouds',
    tone: [
      'Warm Rhodes foundation',
      'Expensive harmonics',
      'Velvet top-end',
      'Wide stereo bloom',
      'Soft analog saturation',
      'Controlled low mids',
    ],
    emotionalPurpose: 'The "I already won" instrument.',
    bestFor: ['Luxury Rap', 'R&B', 'Melodic Trap', 'Cinematic Soul', 'Victory Records'],
    sonicReferences: ['Penthouse at night', 'Gold chains in rain', 'Maybach interior energy'],
    keyBehavior: [
      'Velocity increases harmonic bloom',
      'Chords widen automatically',
      'Long notes create halo tails',
    ],
    macroBehavior: {
      energy: 'Adds Rhodes bark, gold warmth, and confident presence',
      divinity: 'Adds golden halo and expensive high-end bloom',
      width: 'Adds luxury stereo bloom while preserving mono-safe body',
      realm: 'Morphs Rhodes into celestial palace keys',
      aura: 'Heavenly palace hall',
      age: 'Polished vinyl warmth',
    },
    profile: {
      element: 'Light',
      domain: 'Victory',
      energy: 'Elevated',
      mood: 'Confident',
      quote: 'You already won.',
    },
    colors: {
      primary: '#f8c85a',
      secondary: '#6d4b1f',
      accent: '#fff1b0',
    },
    realmFx: ['Heavenly Reverb', 'Gold Chorus', 'Palace Delay', 'Velvet Saturation'],
    heroImage: '/images/pantheon/olympus.png',
    icon: '🏛',
  },

  // ═══════════ 2. HADES ═══════════
  {
    id: 'hades',
    name: 'HADES',
    title: 'The Beautiful Underworld',
    tone: [
      'Distorted Wurly core',
      'Tape instability',
      'Dark saturation',
      'Broken speaker texture',
      'Mono-centered low mids',
      'Slight detune drift',
    ],
    emotionalPurpose: 'Pain plus power.',
    bestFor: ['Dark Trap', 'Revenge Records', 'Underground Confessionals', 'Villain Arc Energy'],
    sonicReferences: ['Abandoned church', 'Burnt tape machines', 'Subway tunnel reverb', 'Smoke and neon'],
    keyBehavior: [
      'Hard velocity adds distortion',
      'Sustain introduces instability',
      'Notes slightly decay in pitch',
    ],
    macroBehavior: {
      energy: 'Increases distortion, speaker breakup, and pitch instability',
      divinity: 'Adds cursed harmonics and dark spiritual overtones',
      width: 'Keeps low mids centered while haunted movement spreads on the sides',
      realm: 'Morphs Wurly into broken-tape underworld ritual keys',
      aura: 'Underworld chamber',
      age: 'Burnt speaker, broken tape, and unstable pitch',
    },
    profile: {
      element: 'Shadow',
      domain: 'Underworld',
      energy: 'Heavy',
      mood: 'Dangerous',
      quote: 'The pain became power.',
    },
    colors: {
      primary: '#d64b35',
      secondary: '#1a0504',
      accent: '#ff7a4a',
    },
    realmFx: ['Underworld Reverb', 'Burned Tape', 'Cursed Chorus', 'Broken Speaker'],
    heroImage: '/images/pantheon/hades.png',
    icon: '🔥',
  },

  // ═══════════ 3. ZEUS ═══════════
  {
    id: 'zeus',
    name: 'ZEUS',
    title: 'Lightning In Human Form',
    tone: [
      'Bright attack',
      'DX/FM electric core',
      'Hyper transient snap',
      'Air-frequency sparkle',
      'Aggressive stereo imaging',
    ],
    emotionalPurpose: 'Dominance.',
    bestFor: ['Anthem Records', 'High-Energy Trap', 'Victory Music', 'Beat Switch Moments'],
    sonicReferences: ['Electrical storms', 'Arena lights', 'Transformers energy', 'Divine voltage'],
    keyBehavior: [
      'Velocity creates transient sparks',
      'Fast playing widens stereo field',
      'Repeated notes trigger harmonic arcs',
    ],
    macroBehavior: {
      energy: 'Sharpens attack and adds electrical transient sparks',
      divinity: 'Adds white lightning shimmer and electric upper harmonics',
      width: 'Adds fast stereo sparks and wide attack flashes',
      realm: 'Morphs FM EP into lightning-charged anthem keys',
      aura: 'Storm field',
      age: 'Unstable voltage',
    },
    profile: {
      element: 'Lightning',
      domain: 'Power',
      energy: 'Explosive',
      mood: 'Dominant',
      quote: 'Strike first. Shake the room.',
    },
    colors: {
      primary: '#4ecbff',
      secondary: '#071829',
      accent: '#ffffff',
    },
    realmFx: ['Storm Delay', 'Lightning Transient', 'Voltage Chorus', 'Thunder Saturation'],
    heroImage: '/images/pantheon/zeus.png',
    icon: '⚡',
  },

  // ═══════════ 4. ATHENA ═══════════
  {
    id: 'athena',
    name: 'ATHENA',
    title: 'Intelligence With Soul',
    tone: [
      'Neo-soul EP core',
      'Jazz chord enhancement',
      'Midrange richness',
      'Soft tape warmth',
      'Smooth transient edges',
    ],
    emotionalPurpose: 'Sophisticated emotion.',
    bestFor: ['Neo Soul', 'Jazz Rap', 'R&B', 'Deep Songwriting', 'Thinking Music'],
    sonicReferences: ['Rooftop jazz bars', 'Late-night writing sessions', 'Velvet studio lighting'],
    keyBehavior: [
      'Chords intelligently bloom',
      'Extensions shimmer softly',
      'Optional humanized timing drift',
    ],
    macroBehavior: {
      energy: 'Adds chord bloom and upper-mid articulation',
      divinity: 'Adds intelligent chord aura and smooth jazz extension glow',
      width: 'Adds balanced neo-soul spread while preserving chord clarity',
      realm: 'Morphs warm EP into intelligent neo-soul oracle keys',
      aura: 'Intimate studio / jazz room',
      age: 'Clean tape warmth',
    },
    profile: {
      element: 'Wisdom',
      domain: 'Strategy',
      energy: 'Focused',
      mood: 'Sophisticated',
      quote: 'Make the chords speak.',
    },
    colors: {
      primary: '#9d65ff',
      secondary: '#1a1029',
      accent: '#f8d786',
    },
    realmFx: ['Oracle Room', 'Jazz Bloom', 'Velvet Chorus', 'Chord Halo'],
    heroImage: '/images/pantheon/athena.png',
    icon: '🦉',
  },

  // ═══════════ 5. POSEIDON ═══════════
  {
    id: 'poseidon',
    name: 'POSEIDON',
    title: 'Liquid Memory',
    tone: [
      'Ambient EP',
      'Liquid tremolo',
      'Underwater chorus',
      'Deep atmospheric tails',
      'Moving stereo field',
    ],
    emotionalPurpose: 'Floating through memory.',
    bestFor: ['Ambient Trap', 'Emotional Interludes', 'Dream Sequences', 'Psychedelic Production'],
    sonicReferences: ['Underwater cities', 'Moonlight oceans', 'Drifting through space'],
    keyBehavior: [
      'Stereo moves like waves',
      'Modulation breathes naturally',
      'Notes evolve while sustaining',
    ],
    macroBehavior: {
      energy: 'Increases wave motion and liquid pulse',
      divinity: 'Adds aquatic shimmer and distant oceanic reflections',
      width: 'Adds wave-like side motion and drifting field movement',
      realm: 'Morphs ambient EP into underwater memory instrument',
      aura: 'Underwater temple',
      age: 'Water-worn memory',
    },
    profile: {
      element: 'Water',
      domain: 'Memory',
      energy: 'Fluid',
      mood: 'Reflective',
      quote: 'Let the memory move.',
    },
    colors: {
      primary: '#29d7e8',
      secondary: '#05242d',
      accent: '#9ff6ff',
    },
    realmFx: ['Oceanic Reverb', 'Liquid Tremolo', 'Tidal Chorus', 'Deep Current'],
    heroImage: '/images/pantheon/poseidon.png',
    icon: '🌊',
  },

  // ═══════════ 6. TITAN ═══════════
  {
    id: 'titan',
    name: 'TITAN',
    title: 'Massive Cinematic Force',
    tone: [
      'Layered octave keys',
      'Cinematic low end',
      'Hybrid piano/synth body',
      'Massive transient scale',
      'Huge reverb chambers',
    ],
    emotionalPurpose: 'Scale.',
    bestFor: ['Movie Trailers', 'Stadium Records', 'Emotional Climax', 'Orchestral Trap'],
    sonicReferences: ['Giant structures', 'Collapsing worlds', 'IMAX sound design'],
    keyBehavior: [
      'Chords stack dynamically',
      'Bass harmonics grow with sustain',
      'Velocity increases perceived size',
    ],
    macroBehavior: {
      energy: 'Adds octave weight, sub-body, and cinematic impact',
      divinity: 'Adds giant harmonic lift and choir-like thickness',
      width: 'Adds massive cinematic stage width',
      realm: 'Morphs hybrid piano/EP into colossal cinematic force',
      aura: 'Giant cinematic arena',
      age: 'Ancient stone chamber',
    },
    profile: {
      element: 'Stone',
      domain: 'Scale',
      energy: 'Massive',
      mood: 'Epic',
      quote: 'Make the room feel small.',
    },
    colors: {
      primary: '#ff9f2f',
      secondary: '#211307',
      accent: '#ffd18a',
    },
    realmFx: ['Colossal Hall', 'Impact Layer', 'Stone Chorus', 'Giant Glue'],
    heroImage: '/images/pantheon/titan.png',
    icon: '⛰',
  },

  // ═══════════ 7. APOLLO ═══════════
  {
    id: 'apollo',
    name: 'APOLLO',
    title: 'The Oracle Of Melody',
    tone: [
      'Bell-like EP',
      'High-end shimmer',
      'Crystal harmonics',
      'Soft transient body',
      'Airy sustain',
    ],
    emotionalPurpose: 'Pure melody.',
    bestFor: ['Hooks', 'Emotional Toplines', 'Melodic Rap', 'Anthem Choruses', 'Vulnerable Records'],
    sonicReferences: ['Celestial bells', 'Sunrise reflections', 'Emotional revelation'],
    keyBehavior: [
      'Upper harmonics glow on sustain',
      'High notes produce angelic layers',
      'Melody phrases trigger ambience',
    ],
    macroBehavior: {
      energy: 'Increases bell clarity and melodic shimmer',
      divinity: 'Adds crystal bell halo and emotional hook glow',
      width: 'Adds airy melodic spread and high-end shimmer on sides',
      realm: 'Morphs bell EP into celestial hook machine',
      aura: 'Golden sunrise chamber',
      age: 'Timeless crystal glow',
    },
    profile: {
      element: 'Sun',
      domain: 'Melody',
      energy: 'Radiant',
      mood: 'Hopeful',
      quote: 'Find the hook inside the light.',
    },
    colors: {
      primary: '#ffd45a',
      secondary: '#281c08',
      accent: '#fff4bd',
    },
    realmFx: ['Sunrise Reverb', 'Crystal Delay', 'Melody Halo', 'Angelic Shimmer'],
    heroImage: '/images/pantheon/apollo.png',
    icon: '☀',
  },

  // ═══════════ 8. CHRONOS ═══════════
  {
    id: 'chronos',
    name: 'CHRONOS',
    title: 'Time Is Breaking',
    tone: [
      'Granular electric piano',
      'Reverse textures',
      'Time-stretched harmonics',
      'Ghost ambience',
      'Pitch memory trails',
    ],
    emotionalPurpose: 'Disorientation plus transcendence.',
    bestFor: ['Experimental Trap', 'Psychedelic Hip-Hop', 'Transitions', 'Futuristic Soundtracks'],
    sonicReferences: ['Broken timelines', 'Memories folding', 'Slowed reality'],
    keyBehavior: [
      'Notes leave time trails',
      'Reverse harmonics emerge dynamically',
      'Sustain introduces temporal drift',
    ],
    macroBehavior: {
      energy: 'Adds glitch trails, reverse movement, and time smear',
      divinity: 'Adds ghost harmonics and delayed memory trails',
      width: 'Adds fractured stereo time trails and offset ghosts',
      realm: 'Morphs EP into reverse/granular time-warped instrument',
      aura: 'Fractured timeline space',
      age: 'Time decay and reverse dust',
    },
    profile: {
      element: 'Time',
      domain: 'Memory',
      energy: 'Unstable',
      mood: 'Dreamlike',
      quote: 'Play the moment before it happens.',
    },
    colors: {
      primary: '#7cff9d',
      secondary: '#06190d',
      accent: '#d9ffe2',
    },
    realmFx: ['Time Smear', 'Reverse Delay', 'Granular Halo', 'Memory Drift'],
    heroImage: '/images/pantheon/chronos.png',
    icon: '⏳',
  },
];

/* ─── Utility Lookups ─── */

export const getGodById = (id: ElectricPantheonGodId): ElectricPantheonGod =>
  electricPantheonGods.find((g) => g.id === id) || electricPantheonGods[0];

export const getGodColors = (id: ElectricPantheonGodId): GodColors =>
  getGodById(id).colors;

export const getGodRealmFx = (id: ElectricPantheonGodId): string[] =>
  getGodById(id).realmFx;
