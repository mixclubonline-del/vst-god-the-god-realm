/**
 * godData.ts — Website God Registry
 * 
 * Adapted from the Electric Pantheon sacred registry for the marketing website.
 * Each god carries its identity, colors, marketing copy, and audio preview assignments.
 */

export interface GodMacroBehavior {
  energy: string;
  divinity: string;
  width: string;
  realm: string;
}

export interface GodData {
  id: string;
  name: string;
  title: string;
  quote: string;
  emotionalPurpose: string;
  element: string;
  domain: string;
  mood: string;
  bestFor: string[];
  sonicReferences: string[];
  tone: string[];
  macroBehavior: GodMacroBehavior;
  realmFx: string[];
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
  };
  heroImage: string;
  icon: string;
  audioPreview?: string;
}

export const gods: GodData[] = [
  {
    id: 'olympus',
    name: 'OLYMPUS',
    title: 'Luxury Above The Clouds',
    quote: 'You already won.',
    emotionalPurpose: 'The "I already won" instrument.',
    element: 'Light',
    domain: 'Victory',
    mood: 'Confident',
    bestFor: ['Luxury Rap', 'R&B', 'Melodic Trap', 'Cinematic Soul', 'Victory Records'],
    sonicReferences: ['Penthouse at night', 'Gold chains in rain', 'Maybach interior energy'],
    tone: ['Warm Rhodes foundation', 'Expensive harmonics', 'Velvet top-end', 'Wide stereo bloom'],
    macroBehavior: {
      energy: 'Adds Rhodes bark, gold warmth, and confident presence',
      divinity: 'Adds golden halo and expensive high-end bloom',
      width: 'Adds luxury stereo bloom while preserving mono-safe body',
      realm: 'Morphs Rhodes into celestial palace keys',
    },
    realmFx: ['Heavenly Reverb', 'Gold Chorus', 'Palace Delay', 'Velvet Saturation'],
    colors: {
      primary: '#f8c85a',
      secondary: '#6d4b1f',
      accent: '#fff1b0',
      glow: 'rgba(248, 200, 90, 0.3)',
    },
    heroImage: '/images/pantheon/olympus.png',
    icon: '🏛',
    audioPreview: '/audio/olympus-preview.ogg',
  },
  {
    id: 'hades',
    name: 'HADES',
    title: 'The Beautiful Underworld',
    quote: 'The pain became power.',
    emotionalPurpose: 'Pain plus power.',
    element: 'Shadow',
    domain: 'Underworld',
    mood: 'Dangerous',
    bestFor: ['Dark Trap', 'Revenge Records', 'Underground Confessionals', 'Villain Arc Energy'],
    sonicReferences: ['Abandoned church', 'Burnt tape machines', 'Subway tunnel reverb'],
    tone: ['Distorted Wurly core', 'Tape instability', 'Dark saturation', 'Broken speaker texture'],
    macroBehavior: {
      energy: 'Increases distortion, speaker breakup, and pitch instability',
      divinity: 'Adds cursed harmonics and dark spiritual overtones',
      width: 'Keeps low mids centered while haunted movement spreads',
      realm: 'Morphs Wurly into broken-tape underworld ritual keys',
    },
    realmFx: ['Underworld Reverb', 'Burned Tape', 'Cursed Chorus', 'Broken Speaker'],
    colors: {
      primary: '#d64b35',
      secondary: '#1a0504',
      accent: '#ff7a4a',
      glow: 'rgba(214, 75, 53, 0.3)',
    },
    heroImage: '/images/pantheon/hades.png',
    icon: '🔥',
    audioPreview: '/audio/hades-preview.ogg',
  },
  {
    id: 'zeus',
    name: 'ZEUS',
    title: 'Lightning In Human Form',
    quote: 'Strike first. Shake the room.',
    emotionalPurpose: 'Dominance.',
    element: 'Lightning',
    domain: 'Power',
    mood: 'Dominant',
    bestFor: ['Anthem Records', 'High-Energy Trap', 'Victory Music', 'Beat Switch Moments'],
    sonicReferences: ['Electrical storms', 'Arena lights', 'Transformers energy'],
    tone: ['Bright attack', 'DX/FM electric core', 'Hyper transient snap', 'Air-frequency sparkle'],
    macroBehavior: {
      energy: 'Sharpens attack and adds electrical transient sparks',
      divinity: 'Adds white lightning shimmer and electric upper harmonics',
      width: 'Adds fast stereo sparks and wide attack flashes',
      realm: 'Morphs FM EP into lightning-charged anthem keys',
    },
    realmFx: ['Storm Delay', 'Lightning Transient', 'Voltage Chorus', 'Thunder Saturation'],
    colors: {
      primary: '#4ecbff',
      secondary: '#071829',
      accent: '#ffffff',
      glow: 'rgba(78, 203, 255, 0.3)',
    },
    heroImage: '/images/pantheon/zeus.png',
    icon: '⚡',
    audioPreview: '/audio/zeus-preview.ogg',
  },
  {
    id: 'athena',
    name: 'ATHENA',
    title: 'Intelligence With Soul',
    quote: 'Make the chords speak.',
    emotionalPurpose: 'Sophisticated emotion.',
    element: 'Wisdom',
    domain: 'Strategy',
    mood: 'Sophisticated',
    bestFor: ['Neo Soul', 'Jazz Rap', 'R&B', 'Deep Songwriting', 'Thinking Music'],
    sonicReferences: ['Rooftop jazz bars', 'Late-night writing sessions', 'Velvet studio lighting'],
    tone: ['Neo-soul EP core', 'Jazz chord enhancement', 'Midrange richness', 'Soft tape warmth'],
    macroBehavior: {
      energy: 'Adds chord bloom and upper-mid articulation',
      divinity: 'Adds intelligent chord aura and smooth jazz extension glow',
      width: 'Adds balanced neo-soul spread while preserving chord clarity',
      realm: 'Morphs warm EP into intelligent neo-soul oracle keys',
    },
    realmFx: ['Oracle Room', 'Jazz Bloom', 'Velvet Chorus', 'Chord Halo'],
    colors: {
      primary: '#9d65ff',
      secondary: '#1a1029',
      accent: '#f8d786',
      glow: 'rgba(157, 101, 255, 0.3)',
    },
    heroImage: '/images/pantheon/athena.png',
    icon: '🦉',
    audioPreview: '/audio/athena-preview.ogg',
  },
  {
    id: 'poseidon',
    name: 'POSEIDON',
    title: 'Liquid Memory',
    quote: 'Let the memory move.',
    emotionalPurpose: 'Floating through memory.',
    element: 'Water',
    domain: 'Memory',
    mood: 'Reflective',
    bestFor: ['Ambient Trap', 'Emotional Interludes', 'Dream Sequences', 'Psychedelic Production'],
    sonicReferences: ['Underwater cities', 'Moonlight oceans', 'Drifting through space'],
    tone: ['Ambient EP', 'Liquid tremolo', 'Underwater chorus', 'Deep atmospheric tails'],
    macroBehavior: {
      energy: 'Increases wave motion and liquid pulse',
      divinity: 'Adds aquatic shimmer and distant oceanic reflections',
      width: 'Adds wave-like side motion and drifting field movement',
      realm: 'Morphs ambient EP into underwater memory instrument',
    },
    realmFx: ['Oceanic Reverb', 'Liquid Tremolo', 'Tidal Chorus', 'Deep Current'],
    colors: {
      primary: '#29d7e8',
      secondary: '#05242d',
      accent: '#9ff6ff',
      glow: 'rgba(41, 215, 232, 0.3)',
    },
    heroImage: '/images/pantheon/poseidon.png',
    icon: '🌊',
    audioPreview: '/audio/poseidon-preview.wav',
  },
  {
    id: 'titan',
    name: 'TITAN',
    title: 'Massive Cinematic Force',
    quote: 'Make the room feel small.',
    emotionalPurpose: 'Scale.',
    element: 'Stone',
    domain: 'Scale',
    mood: 'Epic',
    bestFor: ['Movie Trailers', 'Stadium Records', 'Emotional Climax', 'Orchestral Trap'],
    sonicReferences: ['Giant structures', 'Collapsing worlds', 'IMAX sound design'],
    tone: ['Layered octave keys', 'Cinematic low end', 'Hybrid piano/synth body', 'Massive transient scale'],
    macroBehavior: {
      energy: 'Adds octave weight, sub-body, and cinematic impact',
      divinity: 'Adds giant harmonic lift and choir-like thickness',
      width: 'Adds massive cinematic stage width',
      realm: 'Morphs hybrid piano/EP into colossal cinematic force',
    },
    realmFx: ['Colossal Hall', 'Impact Layer', 'Stone Chorus', 'Giant Glue'],
    colors: {
      primary: '#ff9f2f',
      secondary: '#211307',
      accent: '#ffd18a',
      glow: 'rgba(255, 159, 47, 0.3)',
    },
    heroImage: '/images/pantheon/titan.png',
    icon: '⛰',
    audioPreview: '/audio/titan-preview.ogg',
  },
  {
    id: 'apollo',
    name: 'APOLLO',
    title: 'The Oracle Of Melody',
    quote: 'Find the hook inside the light.',
    emotionalPurpose: 'Pure melody.',
    element: 'Sun',
    domain: 'Melody',
    mood: 'Hopeful',
    bestFor: ['Hooks', 'Emotional Toplines', 'Melodic Rap', 'Anthem Choruses'],
    sonicReferences: ['Celestial bells', 'Sunrise reflections', 'Emotional revelation'],
    tone: ['Bell-like EP', 'High-end shimmer', 'Crystal harmonics', 'Soft transient body'],
    macroBehavior: {
      energy: 'Increases bell clarity and melodic shimmer',
      divinity: 'Adds crystal bell halo and emotional hook glow',
      width: 'Adds airy melodic spread and high-end shimmer on sides',
      realm: 'Morphs bell EP into celestial hook machine',
    },
    realmFx: ['Sunrise Reverb', 'Crystal Delay', 'Melody Halo', 'Angelic Shimmer'],
    colors: {
      primary: '#ffd45a',
      secondary: '#281c08',
      accent: '#fff4bd',
      glow: 'rgba(255, 212, 90, 0.3)',
    },
    heroImage: '/images/pantheon/apollo.png',
    icon: '☀',
    audioPreview: '/audio/apollo-preview.wav',
  },
  {
    id: 'chronos',
    name: 'CHRONOS',
    title: 'Time Is Breaking',
    quote: 'Play the moment before it happens.',
    emotionalPurpose: 'Disorientation plus transcendence.',
    element: 'Time',
    domain: 'Memory',
    mood: 'Dreamlike',
    bestFor: ['Experimental Trap', 'Psychedelic Hip-Hop', 'Transitions', 'Futuristic Soundtracks'],
    sonicReferences: ['Broken timelines', 'Memories folding', 'Slowed reality'],
    tone: ['Granular electric piano', 'Reverse textures', 'Time-stretched harmonics', 'Ghost ambience'],
    macroBehavior: {
      energy: 'Adds glitch trails, reverse movement, and time smear',
      divinity: 'Adds ghost harmonics and delayed memory trails',
      width: 'Adds fractured stereo time trails and offset ghosts',
      realm: 'Morphs EP into reverse/granular time-warped instrument',
    },
    realmFx: ['Time Smear', 'Reverse Delay', 'Granular Halo', 'Memory Drift'],
    colors: {
      primary: '#7cff9d',
      secondary: '#06190d',
      accent: '#d9ffe2',
      glow: 'rgba(124, 255, 157, 0.3)',
    },
    heroImage: '/images/pantheon/chronos.png',
    icon: '⏳',
    audioPreview: '/audio/chronos-preview.ogg',
  },
];

export const getGodById = (id: string): GodData =>
  gods.find((g) => g.id === id) || gods[0];
