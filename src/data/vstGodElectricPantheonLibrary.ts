// src/data/vstGodElectricPantheonLibrary.ts
// VST GOD — Electric Pantheon Library v0.1
// Drop this into your React/Tauri/Antigravity app and import the named exports.
// Locked face controls: ENERGY / DIVINITY / WIDTH / REALM

export type VstGodFaceControl = "ENERGY" | "DIVINITY" | "WIDTH" | "REALM";

export type VstGodPresetCategory =
  | "keys"
  | "pad"
  | "lead"
  | "bass"
  | "texture"
  | "hybrid";

export type VstGodMacroBehavior = {
  label: string;
  purpose: string;
  low: string;
  mid: string;
  high: string;
  targets: string[];
};

export type VstGodProfile = {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  quote: string;
  element: string;
  domain: string;
  energy: string;
  mood: string[];
  bestFor: string[];
  visualRealm: string[];
  keyBehavior: string[];
  colorTokens: {
    primary: string;
    secondary: string;
    glass: string;
  };
};

export type VstGodRealmFx = {
  name: string;
  default: number;
};

export type VstGodPreset = {
  id: string;
  godId: string;
  god: string;
  icon: string;
  slot: number;
  displayName: string;
  name: string;
  subtitle: string;
  category: VstGodPresetCategory;
  rootKey: string;
  bpmRange: [number, number];
  chordProgression: string[];
  mood: string[];
  bestFor: string[];
  quote: string;
  soundRecipe: string[];
  macroBehavior: Record<VstGodFaceControl, string>;
  realmFx: VstGodRealmFx[];
  tags: string[];
  export: {
    midiKit: string;
    recommendedVelocity: [number, number];
    loopBars: number;
    swing: number;
  };
};

export type VstGodMidiKit = {
  godId: string;
  name: string;
  bpm: number;
  key: string;
  chords: string[];
  voicings: string[][];
  bass: string[];
  melody: string[];
};

export const VST_GOD_FACE_CONTROLS: VstGodFaceControl[] = [
  "ENERGY",
  "DIVINITY",
  "WIDTH",
  "REALM",
];

export const macroBehaviorMap: Record<VstGodFaceControl, VstGodMacroBehavior> = {
  "ENERGY": {
    "label": "Energy",
    "purpose": "Intensity, drive, attack, rhythmic force",
    "low": "Soft attack, clean tone, relaxed dynamics",
    "mid": "Present attack, harmonic push, stronger velocity response",
    "high": "Drive, transient snap, compression, aggressive movement",
    "targets": [
      "ampAttack",
      "drive",
      "transient",
      "velocityBloom",
      "compression"
    ]
  },
  "DIVINITY": {
    "label": "Divinity",
    "purpose": "Glow, shimmer, sacred harmonic layer",
    "low": "Dry and grounded",
    "mid": "Harmonic lift, chorus, subtle shimmer",
    "high": "Halo layer, octave shimmer, air, divine top-end",
    "targets": [
      "shimmer",
      "chorusDepth",
      "highAir",
      "octaveLayer",
      "harmonicExciter"
    ]
  },
  "WIDTH": {
    "label": "Width",
    "purpose": "Stereo spread, space, dimensional bloom",
    "low": "Centered and mono-safe",
    "mid": "Natural stereo field",
    "high": "Wide chorus, micro-delay, spatial bloom",
    "targets": [
      "stereoWidth",
      "microDelay",
      "reverbWidth",
      "chorusSpread",
      "midside"
    ]
  },
  "REALM": {
    "label": "Realm",
    "purpose": "God identity morph and FX world",
    "low": "Pure instrument tone",
    "mid": "Signature FX and color",
    "high": "Full god-world transformation",
    "targets": [
      "realmFxBlend",
      "textureLayer",
      "fxChainMorph",
      "visualState",
      "presetLoreIntensity"
    ]
  }
} as const;

export const godProfiles: VstGodProfile[] = [
  {
    "id": "olympus",
    "name": "Olympus",
    "icon": "🏛",
    "subtitle": "Luxury Above The Clouds",
    "quote": "You already won.",
    "element": "Light",
    "domain": "Victory",
    "energy": "Elevated",
    "mood": [
      "Confident",
      "Luxury",
      "Calm dominance"
    ],
    "bestFor": [
      "Luxury Rap",
      "R&B",
      "Melodic Trap",
      "Cinematic Soul",
      "Victory Records"
    ],
    "visualRealm": [
      "Penthouse at night",
      "Gold chains in rain",
      "Maybach interior energy"
    ],
    "keyBehavior": [
      "Velocity increases harmonic bloom",
      "Chords widen automatically",
      "Long notes create halo tails"
    ],
    "colorTokens": {
      "primary": "#F9D86E",
      "secondary": "#7E55FF",
      "glass": "rgba(255, 217, 112, 0.15)"
    }
  },
  {
    "id": "hades",
    "name": "Hades",
    "icon": "🔥",
    "subtitle": "The Beautiful Underworld",
    "quote": "The dark still shines.",
    "element": "Shadow",
    "domain": "Underworld",
    "energy": "Dangerous",
    "mood": [
      "Pain",
      "Mystery",
      "Hunger"
    ],
    "bestFor": [
      "Dark Trap",
      "Pain Rap",
      "Villain R&B",
      "Cinematic Intros"
    ],
    "visualRealm": [
      "Black marble halls",
      "Low red smoke",
      "Diamonds under ash"
    ],
    "keyBehavior": [
      "Lower velocities stay smoky",
      "High velocities add black flame saturation",
      "Long notes open ghost tails"
    ],
    "colorTokens": {
      "primary": "#FF5A3D",
      "secondary": "#6B32FF",
      "glass": "rgba(255, 90, 61, 0.14)"
    }
  },
  {
    "id": "zeus",
    "name": "Zeus",
    "icon": "⚡",
    "subtitle": "Lightning In Human Form",
    "quote": "The room moves when you enter.",
    "element": "Lightning",
    "domain": "Command",
    "energy": "Royal pressure",
    "mood": [
      "Power",
      "Arrival",
      "Victory"
    ],
    "bestFor": [
      "Anthem Trap",
      "Sports Placements",
      "Battle Music",
      "Victory Beats"
    ],
    "visualRealm": [
      "Storm over marble",
      "Gold lightning",
      "Arena floodlights"
    ],
    "keyBehavior": [
      "Velocity adds thunder transient",
      "Octaves trigger impact support",
      "Sustains charge the storm tail"
    ],
    "colorTokens": {
      "primary": "#FFE66D",
      "secondary": "#52B6FF",
      "glass": "rgba(255, 230, 109, 0.14)"
    }
  },
  {
    "id": "athena",
    "name": "Athena",
    "icon": "🦉",
    "subtitle": "Intelligence With Soul",
    "quote": "Precision is power.",
    "element": "Silver",
    "domain": "Strategy",
    "energy": "Focused",
    "mood": [
      "Clarity",
      "Confidence",
      "Intentional"
    ],
    "bestFor": [
      "Lyrical Rap",
      "Clean R&B",
      "Reflective Beats",
      "Smart Trap"
    ],
    "visualRealm": [
      "Silver glass room",
      "Owl signal lights",
      "Blueprint constellations"
    ],
    "keyBehavior": [
      "Velocity tightens attack",
      "Chords stay vocal-safe",
      "Sparse playing gets subtle echo answers"
    ],
    "colorTokens": {
      "primary": "#CFE8FF",
      "secondary": "#A879FF",
      "glass": "rgba(207, 232, 255, 0.13)"
    }
  },
  {
    "id": "poseidon",
    "name": "Poseidon",
    "icon": "🌊",
    "subtitle": "Liquid Memory",
    "quote": "Every wave remembers.",
    "element": "Water",
    "domain": "Motion",
    "energy": "Fluid",
    "mood": [
      "Nostalgic",
      "Emotional",
      "Deep"
    ],
    "bestFor": [
      "R&B",
      "Melodic Trap",
      "Afro-Fusion",
      "Emotional Rap"
    ],
    "visualRealm": [
      "Underwater keys",
      "Blue neon current",
      "Rain on glass"
    ],
    "keyBehavior": [
      "Velocity increases wave chorus",
      "Mod wheel raises current movement",
      "Overlapping notes create water trails"
    ],
    "colorTokens": {
      "primary": "#38D5FF",
      "secondary": "#7768FF",
      "glass": "rgba(56, 213, 255, 0.13)"
    }
  },
  {
    "id": "titan",
    "name": "Titan",
    "icon": "⛰",
    "subtitle": "Massive Cinematic Force",
    "quote": "Make the floor remember you.",
    "element": "Stone",
    "domain": "Scale",
    "energy": "Massive",
    "mood": [
      "Heavy",
      "Mythic",
      "Pressure"
    ],
    "bestFor": [
      "Trailers",
      "Drill",
      "Battle Scenes",
      "Beat Switches",
      "Cinematic Intros"
    ],
    "visualRealm": [
      "Colossus shadows",
      "Cracked stone temple",
      "Sub pressure fog"
    ],
    "keyBehavior": [
      "Low octaves add sub impact",
      "Velocity opens brass weight",
      "REALM brings cinematic room size"
    ],
    "colorTokens": {
      "primary": "#B8A67A",
      "secondary": "#5F5BFF",
      "glass": "rgba(184, 166, 122, 0.13)"
    }
  },
  {
    "id": "apollo",
    "name": "Apollo",
    "icon": "☀",
    "subtitle": "The Oracle Of Melody",
    "quote": "The hook was already there.",
    "element": "Sun",
    "domain": "Melody",
    "energy": "Inspired",
    "mood": [
      "Bright",
      "Catchy",
      "Prophetic"
    ],
    "bestFor": [
      "Hooks",
      "Toplines",
      "Melodic Trap",
      "Pop-Rap",
      "Emotional Victory Records"
    ],
    "visualRealm": [
      "Golden morning studio",
      "Solar glass",
      "Hook lines as light"
    ],
    "keyBehavior": [
      "Velocity brightens melody layer",
      "Sustains reveal oracle shimmer",
      "Higher octaves add vocal-like glow"
    ],
    "colorTokens": {
      "primary": "#FFD36E",
      "secondary": "#FF74D6",
      "glass": "rgba(255, 211, 110, 0.13)"
    }
  },
  {
    "id": "chronos",
    "name": "Chronos",
    "icon": "⏳",
    "subtitle": "Time Is Breaking",
    "quote": "The future has old memories.",
    "element": "Time",
    "domain": "Memory",
    "energy": "Warped",
    "mood": [
      "Glitchy",
      "Futuristic",
      "Emotional"
    ],
    "bestFor": [
      "Experimental Trap",
      "Alt-R&B",
      "Transitions",
      "Dark Futuristic Records"
    ],
    "visualRealm": [
      "Broken clocks",
      "Reverse glass",
      "Neon hourglass dust"
    ],
    "keyBehavior": [
      "Delayed entrances feel intentional",
      "REALM adds reverse pickups",
      "Sustains drift in pitch and time"
    ],
    "colorTokens": {
      "primary": "#D8C6FF",
      "secondary": "#31F5C8",
      "glass": "rgba(216, 198, 255, 0.13)"
    }
  }
];

export const vstGodPresets: VstGodPreset[] = [
  {
    "id": "olympus-domain-keys",
    "godId": "olympus",
    "god": "Olympus",
    "icon": "🏛",
    "slot": 1,
    "displayName": "OLYMPUS 01 — Domain Keys",
    "name": "Domain Keys",
    "subtitle": "Luxury Above The Clouds",
    "category": "keys",
    "rootKey": "F minor",
    "bpmRange": [
      120,
      160
    ],
    "chordProgression": [
      "Fm9",
      "Dbmaj9",
      "Abmaj9",
      "Eb13"
    ],
    "mood": [
      "Confident",
      "Luxury",
      "Elevated"
    ],
    "bestFor": [
      "Luxury Rap",
      "R&B",
      "Melodic Trap",
      "Cinematic Soul"
    ],
    "quote": "You already won.",
    "soundRecipe": [
      "Warm Rhodes foundation",
      "Soft glass bell layer",
      "Gold chorus",
      "Heavenly reverb",
      "Velvet saturation",
      "Wide stereo bloom"
    ],
    "macroBehavior": {
      "ENERGY": "Adds velvet drive, firmer tine attack, and stronger velocity bloom.",
      "DIVINITY": "Adds gold shimmer, halo octave, and expensive top-end.",
      "WIDTH": "Opens chorus width, micro-delay, and palace reverb spread.",
      "REALM": "Morphs clean Rhodes into full Olympus palace atmosphere."
    },
    "realmFx": [
      {
        "name": "Heavenly Reverb",
        "default": 0.5
      },
      {
        "name": "Gold Chorus",
        "default": 0.5
      },
      {
        "name": "Palace Delay",
        "default": 0.35
      },
      {
        "name": "Velvet Saturation",
        "default": 0.32
      }
    ],
    "tags": [
      "confident",
      "elevated",
      "f-minor",
      "keys",
      "luxury",
      "olympus"
    ],
    "export": {
      "midiKit": "olympus-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "olympus-penthouse-gospel",
    "godId": "olympus",
    "god": "Olympus",
    "icon": "🏛",
    "slot": 2,
    "displayName": "OLYMPUS 02 — Penthouse Gospel",
    "name": "Penthouse Gospel",
    "subtitle": "Gospel voicings in a luxury suite",
    "category": "keys",
    "rootKey": "Ab major",
    "bpmRange": [
      72,
      148
    ],
    "chordProgression": [
      "Abmaj9",
      "Eb/G",
      "Fm9",
      "Dbmaj9"
    ],
    "mood": [
      "Soulful",
      "Premium",
      "Hopeful"
    ],
    "bestFor": [
      "R&B",
      "Gospel Trap",
      "Luxury Rap"
    ],
    "quote": "You already won.",
    "soundRecipe": [
      "Clean gospel electric keys",
      "Soft organ shadow",
      "Tape sheen",
      "Subtle room reflection",
      "Humanized chord release"
    ],
    "macroBehavior": {
      "ENERGY": "Pushes chord attack and adds gentle bus compression.",
      "DIVINITY": "Raises organ halo and upper harmonics.",
      "WIDTH": "Spreads room reflections while protecting mono center.",
      "REALM": "Turns intimate gospel keys into a grand penthouse choir."
    },
    "realmFx": [
      {
        "name": "Suite Room",
        "default": 0.42
      },
      {
        "name": "Choir Halo",
        "default": 0.28
      },
      {
        "name": "Gold Tape",
        "default": 0.31
      },
      {
        "name": "Soft Echo",
        "default": 0.22
      }
    ],
    "tags": [
      "ab-major",
      "hopeful",
      "keys",
      "olympus",
      "premium",
      "soulful"
    ],
    "export": {
      "midiKit": "olympus-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "olympus-maybach-halo",
    "godId": "olympus",
    "god": "Olympus",
    "icon": "🏛",
    "slot": 3,
    "displayName": "OLYMPUS 03 — Maybach Halo",
    "name": "Maybach Halo",
    "subtitle": "Soft bell-Rhodes with cinematic tails",
    "category": "hybrid",
    "rootKey": "F minor",
    "bpmRange": [
      80,
      150
    ],
    "chordProgression": [
      "Fm9",
      "Ebadd9",
      "Dbmaj9",
      "Bbm11"
    ],
    "mood": [
      "Reflective",
      "Expensive",
      "Smooth"
    ],
    "bestFor": [
      "Luxury Rap",
      "Late Night R&B",
      "Melodic Hooks"
    ],
    "quote": "You already won.",
    "soundRecipe": [
      "Bell-Rhodes hybrid",
      "Felt attack layer",
      "Long halo tail",
      "Slow stereo drift",
      "Air lift"
    ],
    "macroBehavior": {
      "ENERGY": "Adds felt attack and tasteful harmonic lift.",
      "DIVINITY": "Introduces bell halo, shimmer, and angel-air layer.",
      "WIDTH": "Expands the halo tail and stereo drift.",
      "REALM": "Moves from car-interior intimacy to skyline-wide atmosphere."
    },
    "realmFx": [
      {
        "name": "Halo Tail",
        "default": 0.58
      },
      {
        "name": "Interior Chorus",
        "default": 0.38
      },
      {
        "name": "Rain Delay",
        "default": 0.24
      },
      {
        "name": "Leather Saturation",
        "default": 0.26
      }
    ],
    "tags": [
      "expensive",
      "f-minor",
      "hybrid",
      "olympus",
      "reflective",
      "smooth"
    ],
    "export": {
      "midiKit": "olympus-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "olympus-victory-lounge",
    "godId": "olympus",
    "god": "Olympus",
    "icon": "🏛",
    "slot": 4,
    "displayName": "OLYMPUS 04 — Victory Lounge",
    "name": "Victory Lounge",
    "subtitle": "Dark luxury lounge keys",
    "category": "pad",
    "rootKey": "Bb minor",
    "bpmRange": [
      90,
      142
    ],
    "chordProgression": [
      "Bbm9",
      "Gbmaj9",
      "Dbmaj9",
      "Ab13"
    ],
    "mood": [
      "Calm",
      "Victorious",
      "Nocturnal"
    ],
    "bestFor": [
      "Outro",
      "Bridge",
      "Luxury Pain Rap"
    ],
    "quote": "You already won.",
    "soundRecipe": [
      "Dark Rhodes body",
      "Velvet pad bed",
      "Soft vinyl air",
      "Slow delay",
      "Warm glue"
    ],
    "macroBehavior": {
      "ENERGY": "Adds lounge drive and warmer low-mid push.",
      "DIVINITY": "Lifts the pad halo and upper shimmer.",
      "WIDTH": "Widens pad bed and delay returns.",
      "REALM": "Turns the lounge into a victorious after-hours palace."
    },
    "realmFx": [
      {
        "name": "Velvet Room",
        "default": 0.47
      },
      {
        "name": "Afterglow Pad",
        "default": 0.44
      },
      {
        "name": "Slow Delay",
        "default": 0.3
      },
      {
        "name": "Warm Glue",
        "default": 0.35
      }
    ],
    "tags": [
      "bb-minor",
      "calm",
      "nocturnal",
      "olympus",
      "pad",
      "victorious"
    ],
    "export": {
      "midiKit": "olympus-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "hades-underworld-rhodes",
    "godId": "hades",
    "god": "Hades",
    "icon": "🔥",
    "slot": 1,
    "displayName": "HADES 01 — Underworld Rhodes",
    "name": "Underworld Rhodes",
    "subtitle": "Smoky low-mid electric keys",
    "category": "keys",
    "rootKey": "C minor",
    "bpmRange": [
      120,
      150
    ],
    "chordProgression": [
      "Cm9",
      "Abmaj7",
      "Fm9",
      "G7alt"
    ],
    "mood": [
      "Dark",
      "Beautiful",
      "Dangerous"
    ],
    "bestFor": [
      "Dark Trap",
      "Pain Rap",
      "Villain R&B"
    ],
    "quote": "The dark still shines.",
    "soundRecipe": [
      "Dark Rhodes",
      "Low choir shadow",
      "Vinyl air",
      "Underworld saturation",
      "Ghost tail"
    ],
    "macroBehavior": {
      "ENERGY": "Adds black-flame drive and harder hammer bite.",
      "DIVINITY": "Adds ghost shimmer without making it bright.",
      "WIDTH": "Spreads the low choir carefully around the center.",
      "REALM": "Pulls the Rhodes deeper into the underworld."
    },
    "realmFx": [
      {
        "name": "Abyss Room",
        "default": 0.46
      },
      {
        "name": "Ghost Chorus",
        "default": 0.34
      },
      {
        "name": "Ash Delay",
        "default": 0.28
      },
      {
        "name": "Black Flame",
        "default": 0.4
      }
    ],
    "tags": [
      "beautiful",
      "c-minor",
      "dangerous",
      "dark",
      "hades",
      "keys"
    ],
    "export": {
      "midiKit": "hades-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "hades-velvet-abyss",
    "godId": "hades",
    "god": "Hades",
    "icon": "🔥",
    "slot": 2,
    "displayName": "HADES 02 — Velvet Abyss",
    "name": "Velvet Abyss",
    "subtitle": "Slow cinematic pad-key hybrid",
    "category": "pad",
    "rootKey": "D minor",
    "bpmRange": [
      70,
      140
    ],
    "chordProgression": [
      "Dm9",
      "Bbmaj7",
      "Gm9",
      "A7alt"
    ],
    "mood": [
      "Pain",
      "Mystery",
      "Heavy"
    ],
    "bestFor": [
      "Cinematic Intros",
      "Pain Rap",
      "Alt-R&B"
    ],
    "quote": "The dark still shines.",
    "soundRecipe": [
      "Pad-key hybrid",
      "Subtle choir vowel",
      "Dark velvet filter",
      "Slow attack",
      "Long hall"
    ],
    "macroBehavior": {
      "ENERGY": "Pushes movement and increases low-mid pressure.",
      "DIVINITY": "Opens a ghostly upper layer.",
      "WIDTH": "Expands hall size and choir spread.",
      "REALM": "Transforms the patch into a full underworld cinematic bed."
    },
    "realmFx": [
      {
        "name": "Velvet Hall",
        "default": 0.55
      },
      {
        "name": "Choir Smoke",
        "default": 0.44
      },
      {
        "name": "Dark Filter",
        "default": 0.5
      },
      {
        "name": "Sub Pressure",
        "default": 0.25
      }
    ],
    "tags": [
      "d-minor",
      "hades",
      "heavy",
      "mystery",
      "pad",
      "pain"
    ],
    "export": {
      "midiKit": "hades-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "hades-funeral-diamonds",
    "godId": "hades",
    "god": "Hades",
    "icon": "🔥",
    "slot": 3,
    "displayName": "HADES 03 — Funeral Diamonds",
    "name": "Funeral Diamonds",
    "subtitle": "Minor glass keys with dark shimmer",
    "category": "hybrid",
    "rootKey": "G minor",
    "bpmRange": [
      128,
      160
    ],
    "chordProgression": [
      "Gm9",
      "Ebmaj9",
      "Cm9",
      "D7alt"
    ],
    "mood": [
      "Beautiful",
      "Cold",
      "Haunted"
    ],
    "bestFor": [
      "Dark Melodies",
      "Hooks",
      "Beat Switches"
    ],
    "quote": "The dark still shines.",
    "soundRecipe": [
      "Glass keys",
      "Minor bell layer",
      "Dark shimmer",
      "Soft crackle",
      "Reverse inhale"
    ],
    "macroBehavior": {
      "ENERGY": "Adds tighter hit and controlled distortion.",
      "DIVINITY": "Raises cold-glass shimmer and octave sparkle.",
      "WIDTH": "Spreads bell reflections and reverse tails.",
      "REALM": "Reveals a haunted diamond chamber around the notes."
    },
    "realmFx": [
      {
        "name": "Diamond Shimmer",
        "default": 0.48
      },
      {
        "name": "Reverse Smoke",
        "default": 0.22
      },
      {
        "name": "Cold Chorus",
        "default": 0.37
      },
      {
        "name": "Crypt Verb",
        "default": 0.43
      }
    ],
    "tags": [
      "beautiful",
      "cold",
      "g-minor",
      "hades",
      "haunted",
      "hybrid"
    ],
    "export": {
      "midiKit": "hades-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "hades-black-flame",
    "godId": "hades",
    "god": "Hades",
    "icon": "🔥",
    "slot": 4,
    "displayName": "HADES 04 — Black Flame",
    "name": "Black Flame",
    "subtitle": "Distorted low-register villain keys",
    "category": "bass",
    "rootKey": "C minor",
    "bpmRange": [
      130,
      170
    ],
    "chordProgression": [
      "Cm",
      "Bb",
      "Ab",
      "G7"
    ],
    "mood": [
      "Aggressive",
      "Villain",
      "Grimy"
    ],
    "bestFor": [
      "Drill",
      "Battle Beats",
      "Villain Trap"
    ],
    "quote": "The dark still shines.",
    "soundRecipe": [
      "Low distorted key layer",
      "Sub reinforcement",
      "Transient clamp",
      "Dark room slap",
      "Saturation growl"
    ],
    "macroBehavior": {
      "ENERGY": "Turns up growl, compression, and transient violence.",
      "DIVINITY": "Adds a small cursed-air layer above the grime.",
      "WIDTH": "Keeps low end mono while widening upper grit.",
      "REALM": "Moves from playable low keys into black-flame impact mode."
    },
    "realmFx": [
      {
        "name": "Flame Drive",
        "default": 0.62
      },
      {
        "name": "Mono Sub",
        "default": 0.7
      },
      {
        "name": "Grime Slap",
        "default": 0.25
      },
      {
        "name": "Ash Room",
        "default": 0.31
      }
    ],
    "tags": [
      "aggressive",
      "bass",
      "c-minor",
      "grimy",
      "hades",
      "villain"
    ],
    "export": {
      "midiKit": "hades-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "zeus-thunder-keys",
    "godId": "zeus",
    "god": "Zeus",
    "icon": "⚡",
    "slot": 1,
    "displayName": "ZEUS 01 — Thunder Keys",
    "name": "Thunder Keys",
    "subtitle": "Aggressive bright keys with command",
    "category": "keys",
    "rootKey": "D minor",
    "bpmRange": [
      130,
      165
    ],
    "chordProgression": [
      "Dm",
      "Bb",
      "F",
      "C"
    ],
    "mood": [
      "Powerful",
      "Royal",
      "Victorious"
    ],
    "bestFor": [
      "Anthem Trap",
      "Sports",
      "Battle Music"
    ],
    "quote": "The room moves when you enter.",
    "soundRecipe": [
      "Bright electric piano",
      "Thunder transient layer",
      "Arena room",
      "Brass-like attack",
      "Limiter snap"
    ],
    "macroBehavior": {
      "ENERGY": "Adds thunder transient, drive, and command compression.",
      "DIVINITY": "Adds lightning shimmer and top-end electricity.",
      "WIDTH": "Widens arena returns while keeping attack centered.",
      "REALM": "Moves from bright keys to full storm-palace impact."
    },
    "realmFx": [
      {
        "name": "Storm Hall",
        "default": 0.48
      },
      {
        "name": "Lightning Top",
        "default": 0.38
      },
      {
        "name": "Thunder Hit",
        "default": 0.44
      },
      {
        "name": "Command Glue",
        "default": 0.36
      }
    ],
    "tags": [
      "d-minor",
      "keys",
      "powerful",
      "royal",
      "victorious",
      "zeus"
    ],
    "export": {
      "midiKit": "zeus-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "zeus-lightning-chords",
    "godId": "zeus",
    "god": "Zeus",
    "icon": "⚡",
    "slot": 2,
    "displayName": "ZEUS 02 — Lightning Chords",
    "name": "Lightning Chords",
    "subtitle": "Fast electric chord stabs",
    "category": "keys",
    "rootKey": "E minor",
    "bpmRange": [
      140,
      175
    ],
    "chordProgression": [
      "Em",
      "C",
      "G",
      "D"
    ],
    "mood": [
      "Sharp",
      "Fast",
      "Dominant"
    ],
    "bestFor": [
      "Trap Stabs",
      "Drill",
      "Battle Hooks"
    ],
    "quote": "The room moves when you enter.",
    "soundRecipe": [
      "Short tine stab",
      "Sharp transient",
      "Tempo echo",
      "Electric sizzle",
      "Stadium slap"
    ],
    "macroBehavior": {
      "ENERGY": "Shortens envelope and increases snap.",
      "DIVINITY": "Adds electric sizzle and bright harmonic lift.",
      "WIDTH": "Spreads echoes without blurring the stab.",
      "REALM": "Turns every stab into a lightning mark."
    },
    "realmFx": [
      {
        "name": "Charge Echo",
        "default": 0.32
      },
      {
        "name": "Sizzle",
        "default": 0.45
      },
      {
        "name": "Stadium Slap",
        "default": 0.28
      },
      {
        "name": "Snap Drive",
        "default": 0.5
      }
    ],
    "tags": [
      "dominant",
      "e-minor",
      "fast",
      "keys",
      "sharp",
      "zeus"
    ],
    "export": {
      "midiKit": "zeus-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "zeus-god-mode-anthem",
    "godId": "zeus",
    "god": "Zeus",
    "icon": "⚡",
    "slot": 3,
    "displayName": "ZEUS 03 — God Mode Anthem",
    "name": "God Mode Anthem",
    "subtitle": "Huge layered hook keys",
    "category": "hybrid",
    "rootKey": "D minor",
    "bpmRange": [
      120,
      160
    ],
    "chordProgression": [
      "Dm9",
      "Bbmaj9",
      "Fadd9",
      "Cadd9"
    ],
    "mood": [
      "Huge",
      "Anthemic",
      "Heroic"
    ],
    "bestFor": [
      "Main Hooks",
      "Sports Placements",
      "Trailer Trap"
    ],
    "quote": "The room moves when you enter.",
    "soundRecipe": [
      "Layered keys",
      "Brass pad support",
      "Wide hook room",
      "Thunder riser tail",
      "Harmonic lift"
    ],
    "macroBehavior": {
      "ENERGY": "Adds hook pressure, attack, and bus density.",
      "DIVINITY": "Adds divine brass-light and shimmer.",
      "WIDTH": "Expands the hook room and chorus spread.",
      "REALM": "Transforms the sound into a Zeus-level anthem stack."
    },
    "realmFx": [
      {
        "name": "Hook Hall",
        "default": 0.55
      },
      {
        "name": "Brass Light",
        "default": 0.38
      },
      {
        "name": "Thunder Riser",
        "default": 0.22
      },
      {
        "name": "Anthem Glue",
        "default": 0.44
      }
    ],
    "tags": [
      "anthemic",
      "d-minor",
      "heroic",
      "huge",
      "hybrid",
      "zeus"
    ],
    "export": {
      "midiKit": "zeus-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "zeus-storm-palace",
    "godId": "zeus",
    "god": "Zeus",
    "icon": "⚡",
    "slot": 4,
    "displayName": "ZEUS 04 — Storm Palace",
    "name": "Storm Palace",
    "subtitle": "Electric keys with thunder FX tails",
    "category": "texture",
    "rootKey": "F minor",
    "bpmRange": [
      100,
      150
    ],
    "chordProgression": [
      "Fm",
      "Db",
      "Ab",
      "Eb"
    ],
    "mood": [
      "Cinematic",
      "Stormy",
      "Commanding"
    ],
    "bestFor": [
      "Intros",
      "Transitions",
      "Cinematic Trap"
    ],
    "quote": "The room moves when you enter.",
    "soundRecipe": [
      "Electric keys",
      "Rain-noise layer",
      "Thunder tail",
      "Huge room",
      "Slow filter movement"
    ],
    "macroBehavior": {
      "ENERGY": "Raises storm motion and impact level.",
      "DIVINITY": "Brightens lightning-air layer.",
      "WIDTH": "Expands rain field and room tail.",
      "REALM": "Places the player inside the storm palace."
    },
    "realmFx": [
      {
        "name": "Rain Field",
        "default": 0.45
      },
      {
        "name": "Thunder Tail",
        "default": 0.4
      },
      {
        "name": "Palace Room",
        "default": 0.56
      },
      {
        "name": "Storm Filter",
        "default": 0.35
      }
    ],
    "tags": [
      "cinematic",
      "commanding",
      "f-minor",
      "stormy",
      "texture",
      "zeus"
    ],
    "export": {
      "midiKit": "zeus-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "athena-clarity-keys",
    "godId": "athena",
    "god": "Athena",
    "icon": "🦉",
    "slot": 1,
    "displayName": "ATHENA 01 — Clarity Keys",
    "name": "Clarity Keys",
    "subtitle": "Focused clean writing keys",
    "category": "keys",
    "rootKey": "A minor",
    "bpmRange": [
      85,
      100
    ],
    "chordProgression": [
      "Am9",
      "Em9",
      "Fmaj7",
      "Dm9"
    ],
    "mood": [
      "Clean",
      "Focused",
      "Intelligent"
    ],
    "bestFor": [
      "Lyrical Rap",
      "Reflective Beats",
      "Clean R&B"
    ],
    "quote": "Precision is power.",
    "soundRecipe": [
      "Clean tine keys",
      "Soft pluck layer",
      "Tight room",
      "Controlled stereo",
      "Vocal-safe EQ"
    ],
    "macroBehavior": {
      "ENERGY": "Adds definition and firm attack without clutter.",
      "DIVINITY": "Adds controlled silver shimmer.",
      "WIDTH": "Widens only the upper reflections, center stays solid.",
      "REALM": "Moves from dry clarity to strategic silver atmosphere."
    },
    "realmFx": [
      {
        "name": "Tight Room",
        "default": 0.25
      },
      {
        "name": "Silver Shimmer",
        "default": 0.28
      },
      {
        "name": "Focus Delay",
        "default": 0.18
      },
      {
        "name": "Clean Glue",
        "default": 0.3
      }
    ],
    "tags": [
      "a-minor",
      "athena",
      "clean",
      "focused",
      "intelligent",
      "keys"
    ],
    "export": {
      "midiKit": "athena-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "athena-owl-signal",
    "godId": "athena",
    "god": "Athena",
    "icon": "🦉",
    "slot": 2,
    "displayName": "ATHENA 02 — Owl Signal",
    "name": "Owl Signal",
    "subtitle": "Soft pluck-key hybrid",
    "category": "lead",
    "rootKey": "A minor",
    "bpmRange": [
      92,
      184
    ],
    "chordProgression": [
      "Am",
      "G",
      "F",
      "Em"
    ],
    "mood": [
      "Smart",
      "Sparse",
      "Precise"
    ],
    "bestFor": [
      "Toplines",
      "Counter Melodies",
      "Lyrical Records"
    ],
    "quote": "Precision is power.",
    "soundRecipe": [
      "Pluck-key hybrid",
      "Soft bell point",
      "Subtle ping delay",
      "Clean transient",
      "Minimal tail"
    ],
    "macroBehavior": {
      "ENERGY": "Tightens pluck and adds confident click.",
      "DIVINITY": "Adds owl-signal bell glint.",
      "WIDTH": "Spreads delay taps surgically.",
      "REALM": "Turns a clean pluck into a strategic signal line."
    },
    "realmFx": [
      {
        "name": "Signal Ping",
        "default": 0.3
      },
      {
        "name": "Owl Bell",
        "default": 0.36
      },
      {
        "name": "Logic Room",
        "default": 0.18
      },
      {
        "name": "Tine Focus",
        "default": 0.42
      }
    ],
    "tags": [
      "a-minor",
      "athena",
      "lead",
      "precise",
      "smart",
      "sparse"
    ],
    "export": {
      "midiKit": "athena-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "athena-strategy-rhodes",
    "godId": "athena",
    "god": "Athena",
    "icon": "🦉",
    "slot": 3,
    "displayName": "ATHENA 03 — Strategy Rhodes",
    "name": "Strategy Rhodes",
    "subtitle": "Dry Rhodes built for verses",
    "category": "keys",
    "rootKey": "E minor",
    "bpmRange": [
      80,
      110
    ],
    "chordProgression": [
      "Em9",
      "Cmaj7",
      "Am9",
      "B7alt"
    ],
    "mood": [
      "Dry",
      "Intentional",
      "Vocal-safe"
    ],
    "bestFor": [
      "Verses",
      "Storytelling",
      "Rap Writing"
    ],
    "quote": "Precision is power.",
    "soundRecipe": [
      "Dry Rhodes",
      "Low noise removed",
      "Controlled low mids",
      "Small room",
      "Touch-sensitive bark"
    ],
    "macroBehavior": {
      "ENERGY": "Adds touch-sensitive bark and subtle grit.",
      "DIVINITY": "Adds only enough air to stay premium.",
      "WIDTH": "Keeps verses clean with narrow-to-natural spread.",
      "REALM": "Adds analytical precision without stealing vocal space."
    },
    "realmFx": [
      {
        "name": "Small Room",
        "default": 0.2
      },
      {
        "name": "Air Polish",
        "default": 0.24
      },
      {
        "name": "Bark Drive",
        "default": 0.32
      },
      {
        "name": "Verse Control",
        "default": 0.46
      }
    ],
    "tags": [
      "athena",
      "dry",
      "e-minor",
      "intentional",
      "keys",
      "vocal-safe"
    ],
    "export": {
      "midiKit": "athena-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "athena-silver-thought",
    "godId": "athena",
    "god": "Athena",
    "icon": "🦉",
    "slot": 4,
    "displayName": "ATHENA 04 — Silver Thought",
    "name": "Silver Thought",
    "subtitle": "Glass-tine keys with zero clutter",
    "category": "hybrid",
    "rootKey": "B minor",
    "bpmRange": [
      90,
      130
    ],
    "chordProgression": [
      "Bm9",
      "Gmaj7",
      "Dmaj9",
      "Aadd9"
    ],
    "mood": [
      "Reflective",
      "Bright",
      "Precise"
    ],
    "bestFor": [
      "Clean Hooks",
      "R&B",
      "Smart Trap"
    ],
    "quote": "Precision is power.",
    "soundRecipe": [
      "Glass tine layer",
      "Clean key body",
      "Soft modulation",
      "Surgical EQ",
      "Short shimmer tail"
    ],
    "macroBehavior": {
      "ENERGY": "Adds brighter tine definition and tighter dynamics.",
      "DIVINITY": "Raises silver-glass glow.",
      "WIDTH": "Expands only after note attack to preserve clarity.",
      "REALM": "Turns each chord into a clean thought bubble."
    },
    "realmFx": [
      {
        "name": "Glass Thought",
        "default": 0.44
      },
      {
        "name": "Surgical EQ",
        "default": 0.5
      },
      {
        "name": "Short Halo",
        "default": 0.26
      },
      {
        "name": "Clean Mod",
        "default": 0.21
      }
    ],
    "tags": [
      "athena",
      "b-minor",
      "bright",
      "hybrid",
      "precise",
      "reflective"
    ],
    "export": {
      "midiKit": "athena-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "poseidon-liquid-rhodes",
    "godId": "poseidon",
    "god": "Poseidon",
    "icon": "🌊",
    "slot": 1,
    "displayName": "POSEIDON 01 — Liquid Rhodes",
    "name": "Liquid Rhodes",
    "subtitle": "Watery Rhodes with chorus movement",
    "category": "keys",
    "rootKey": "E minor",
    "bpmRange": [
      90,
      112
    ],
    "chordProgression": [
      "Em9",
      "Cmaj9",
      "Gmaj9",
      "Bm7"
    ],
    "mood": [
      "Fluid",
      "Emotional",
      "Reflective"
    ],
    "bestFor": [
      "R&B",
      "Melodic Trap",
      "Afro-Fusion"
    ],
    "quote": "Every wave remembers.",
    "soundRecipe": [
      "Electric Rhodes",
      "Watery chorus",
      "Wave delay",
      "Filtered reverb",
      "Soft pitch drift"
    ],
    "macroBehavior": {
      "ENERGY": "Adds brighter current and stronger key movement.",
      "DIVINITY": "Adds blue shimmer and airy water light.",
      "WIDTH": "Expands chorus and delay waves.",
      "REALM": "Morphs clean Rhodes into an underwater memory field."
    },
    "realmFx": [
      {
        "name": "Wave Chorus",
        "default": 0.52
      },
      {
        "name": "Blue Verb",
        "default": 0.44
      },
      {
        "name": "Current Delay",
        "default": 0.34
      },
      {
        "name": "Drift",
        "default": 0.28
      }
    ],
    "tags": [
      "e-minor",
      "emotional",
      "fluid",
      "keys",
      "poseidon",
      "reflective"
    ],
    "export": {
      "midiKit": "poseidon-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "poseidon-deep-current",
    "godId": "poseidon",
    "god": "Poseidon",
    "icon": "🌊",
    "slot": 2,
    "displayName": "POSEIDON 02 — Deep Current",
    "name": "Deep Current",
    "subtitle": "Low emotional key-pad hybrid",
    "category": "pad",
    "rootKey": "F# minor",
    "bpmRange": [
      80,
      118
    ],
    "chordProgression": [
      "F#m9",
      "Dmaj9",
      "Amaj9",
      "Eadd9"
    ],
    "mood": [
      "Deep",
      "Nostalgic",
      "Moving"
    ],
    "bestFor": [
      "Emotional Rap",
      "Bridges",
      "R&B Beds"
    ],
    "quote": "Every wave remembers.",
    "soundRecipe": [
      "Low key body",
      "Pad undertow",
      "Subtle phaser",
      "Deep room",
      "Slow LFO filter"
    ],
    "macroBehavior": {
      "ENERGY": "Increases current speed and low-mid motion.",
      "DIVINITY": "Adds shimmering water surface.",
      "WIDTH": "Spreads pad undertow and reverb sides.",
      "REALM": "Sinks the sound deeper into the ocean room."
    },
    "realmFx": [
      {
        "name": "Undertow Pad",
        "default": 0.5
      },
      {
        "name": "Surface Shimmer",
        "default": 0.31
      },
      {
        "name": "Deep Room",
        "default": 0.48
      },
      {
        "name": "Slow Current",
        "default": 0.38
      }
    ],
    "tags": [
      "deep",
      "f#-minor",
      "moving",
      "nostalgic",
      "pad",
      "poseidon"
    ],
    "export": {
      "midiKit": "poseidon-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "poseidon-blue-memory",
    "godId": "poseidon",
    "god": "Poseidon",
    "icon": "🌊",
    "slot": 3,
    "displayName": "POSEIDON 03 — Blue Memory",
    "name": "Blue Memory",
    "subtitle": "Nostalgic bell keys with drift",
    "category": "lead",
    "rootKey": "D minor",
    "bpmRange": [
      95,
      130
    ],
    "chordProgression": [
      "Dm9",
      "Bbmaj9",
      "Fmaj9",
      "Cadd9"
    ],
    "mood": [
      "Nostalgic",
      "Blue",
      "Catchy"
    ],
    "bestFor": [
      "Melodic Hooks",
      "R&B Leads",
      "Emotional Trap"
    ],
    "quote": "Every wave remembers.",
    "soundRecipe": [
      "Bell keys",
      "Soft pitch drift",
      "Chorus waterline",
      "Memory delay",
      "Gentle air"
    ],
    "macroBehavior": {
      "ENERGY": "Adds bell articulation and rhythmic movement.",
      "DIVINITY": "Raises watery sparkle and air.",
      "WIDTH": "Widens memory delay and chorus drift.",
      "REALM": "Turns the lead into a blue memory trail."
    },
    "realmFx": [
      {
        "name": "Memory Delay",
        "default": 0.42
      },
      {
        "name": "Bell Drift",
        "default": 0.37
      },
      {
        "name": "Waterline",
        "default": 0.45
      },
      {
        "name": "Blue Air",
        "default": 0.28
      }
    ],
    "tags": [
      "blue",
      "catchy",
      "d-minor",
      "lead",
      "nostalgic",
      "poseidon"
    ],
    "export": {
      "midiKit": "poseidon-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "poseidon-ocean-room",
    "godId": "poseidon",
    "god": "Poseidon",
    "icon": "🌊",
    "slot": 4,
    "displayName": "POSEIDON 04 — Ocean Room",
    "name": "Ocean Room",
    "subtitle": "Wide evolving keys like water",
    "category": "texture",
    "rootKey": "A minor",
    "bpmRange": [
      70,
      120
    ],
    "chordProgression": [
      "Am9",
      "Fmaj9",
      "Cmaj9",
      "G6"
    ],
    "mood": [
      "Atmospheric",
      "Wide",
      "Emotional"
    ],
    "bestFor": [
      "Intros",
      "Film Beds",
      "Alt-R&B"
    ],
    "quote": "Every wave remembers.",
    "soundRecipe": [
      "Wide key wash",
      "Moving reverb",
      "Phaser swell",
      "Air layer",
      "Filtered tail"
    ],
    "macroBehavior": {
      "ENERGY": "Adds wave speed and stronger transient presence.",
      "DIVINITY": "Adds reflected light shimmer.",
      "WIDTH": "Opens ocean-sized stereo bloom.",
      "REALM": "Turns the instrument into a playable ocean room."
    },
    "realmFx": [
      {
        "name": "Ocean Verb",
        "default": 0.65
      },
      {
        "name": "Phaser Swell",
        "default": 0.42
      },
      {
        "name": "Reflected Light",
        "default": 0.3
      },
      {
        "name": "Tail Filter",
        "default": 0.35
      }
    ],
    "tags": [
      "a-minor",
      "atmospheric",
      "emotional",
      "poseidon",
      "texture",
      "wide"
    ],
    "export": {
      "midiKit": "poseidon-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "titan-colossus-keys",
    "godId": "titan",
    "god": "Titan",
    "icon": "⛰",
    "slot": 1,
    "displayName": "TITAN 01 — Colossus Keys",
    "name": "Colossus Keys",
    "subtitle": "Massive low keys with cinematic weight",
    "category": "keys",
    "rootKey": "G minor",
    "bpmRange": [
      130,
      150
    ],
    "chordProgression": [
      "Gm",
      "Eb",
      "F",
      "D7"
    ],
    "mood": [
      "Massive",
      "Heavy",
      "Cinematic"
    ],
    "bestFor": [
      "Drill",
      "Trailers",
      "Battle Scenes"
    ],
    "quote": "Make the floor remember you.",
    "soundRecipe": [
      "Low piano-key hybrid",
      "Stone transient",
      "Sub impact",
      "Cinematic room",
      "Wide upper debris"
    ],
    "macroBehavior": {
      "ENERGY": "Adds stone attack, sub impact, and compression.",
      "DIVINITY": "Adds mythic upper debris and air.",
      "WIDTH": "Widen upper room while low force stays mono.",
      "REALM": "Turns keys into a giant walking through the mix."
    },
    "realmFx": [
      {
        "name": "Stone Room",
        "default": 0.47
      },
      {
        "name": "Sub Impact",
        "default": 0.55
      },
      {
        "name": "Upper Debris",
        "default": 0.25
      },
      {
        "name": "War Glue",
        "default": 0.4
      }
    ],
    "tags": [
      "cinematic",
      "g-minor",
      "heavy",
      "keys",
      "massive",
      "titan"
    ],
    "export": {
      "midiKit": "titan-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "titan-mountain-chords",
    "godId": "titan",
    "god": "Titan",
    "icon": "⛰",
    "slot": 2,
    "displayName": "TITAN 02 — Mountain Chords",
    "name": "Mountain Chords",
    "subtitle": "Huge sustained chords with stone body",
    "category": "pad",
    "rootKey": "C minor",
    "bpmRange": [
      80,
      140
    ],
    "chordProgression": [
      "Cm",
      "Ab",
      "Eb",
      "Bb"
    ],
    "mood": [
      "Epic",
      "Stone",
      "Immense"
    ],
    "bestFor": [
      "Cinematic Intros",
      "Hooks",
      "Trailer Beds"
    ],
    "quote": "Make the floor remember you.",
    "soundRecipe": [
      "Sustained key body",
      "Stone pad",
      "Huge hall",
      "Low air",
      "Slow pressure rise"
    ],
    "macroBehavior": {
      "ENERGY": "Raises pressure and hall push.",
      "DIVINITY": "Adds mythic light across the top.",
      "WIDTH": "Expands huge hall and side reflections.",
      "REALM": "Builds a mountain around every chord."
    },
    "realmFx": [
      {
        "name": "Mountain Hall",
        "default": 0.6
      },
      {
        "name": "Stone Pad",
        "default": 0.5
      },
      {
        "name": "Pressure Rise",
        "default": 0.35
      },
      {
        "name": "Myth Light",
        "default": 0.23
      }
    ],
    "tags": [
      "c-minor",
      "epic",
      "immense",
      "pad",
      "stone",
      "titan"
    ],
    "export": {
      "midiKit": "titan-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "titan-giant-steps",
    "godId": "titan",
    "god": "Titan",
    "icon": "⛰",
    "slot": 3,
    "displayName": "TITAN 03 — Giant Steps",
    "name": "Giant Steps",
    "subtitle": "Rhythmic low-register key hits",
    "category": "bass",
    "rootKey": "G minor",
    "bpmRange": [
      140,
      170
    ],
    "chordProgression": [
      "Gm",
      "F",
      "Eb",
      "D"
    ],
    "mood": [
      "Rhythmic",
      "Heavy",
      "Aggressive"
    ],
    "bestFor": [
      "Drill",
      "Battle Beats",
      "Drops"
    ],
    "quote": "Make the floor remember you.",
    "soundRecipe": [
      "Low key hit",
      "Sub thump",
      "Short room",
      "Impact tail",
      "Slight distortion"
    ],
    "macroBehavior": {
      "ENERGY": "Increases thump, distortion, and impact.",
      "DIVINITY": "Adds small mythic top spark for translation.",
      "WIDTH": "Keeps bass mono while tail gets wider.",
      "REALM": "Turns simple hits into giant-footstep impacts."
    },
    "realmFx": [
      {
        "name": "Footstep Thump",
        "default": 0.65
      },
      {
        "name": "Short Cave",
        "default": 0.26
      },
      {
        "name": "Impact Tail",
        "default": 0.38
      },
      {
        "name": "Stone Drive",
        "default": 0.45
      }
    ],
    "tags": [
      "aggressive",
      "bass",
      "g-minor",
      "heavy",
      "rhythmic",
      "titan"
    ],
    "export": {
      "midiKit": "titan-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "titan-war-monument",
    "godId": "titan",
    "god": "Titan",
    "icon": "⛰",
    "slot": 4,
    "displayName": "TITAN 04 — War Monument",
    "name": "War Monument",
    "subtitle": "Key/brass/pad stack for epic drops",
    "category": "hybrid",
    "rootKey": "D minor",
    "bpmRange": [
      120,
      156
    ],
    "chordProgression": [
      "Dm",
      "Bb",
      "C",
      "A7"
    ],
    "mood": [
      "Mythic",
      "War",
      "Epic"
    ],
    "bestFor": [
      "Battle Scenes",
      "Trailer Trap",
      "Beat Switches"
    ],
    "quote": "Make the floor remember you.",
    "soundRecipe": [
      "Hybrid keys",
      "Brass pad",
      "Epic percussion ghost",
      "Large hall",
      "Saturated bus"
    ],
    "macroBehavior": {
      "ENERGY": "Adds brass bite, bus density, and war pressure.",
      "DIVINITY": "Adds monument light and upper harmonic shine.",
      "WIDTH": "Spreads the brass pad and hall tail.",
      "REALM": "Raises the full war-monument scene around the patch."
    },
    "realmFx": [
      {
        "name": "Brass Stone",
        "default": 0.44
      },
      {
        "name": "War Hall",
        "default": 0.58
      },
      {
        "name": "Ghost Perc",
        "default": 0.2
      },
      {
        "name": "Bus Heat",
        "default": 0.39
      }
    ],
    "tags": [
      "d-minor",
      "epic",
      "hybrid",
      "mythic",
      "titan",
      "war"
    ],
    "export": {
      "midiKit": "titan-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "apollo-oracle-keys",
    "godId": "apollo",
    "god": "Apollo",
    "icon": "☀",
    "slot": 1,
    "displayName": "APOLLO 01 — Oracle Keys",
    "name": "Oracle Keys",
    "subtitle": "Bright melodic keys for instant hooks",
    "category": "keys",
    "rootKey": "B minor",
    "bpmRange": [
      118,
      140
    ],
    "chordProgression": [
      "Bm7",
      "Gmaj9",
      "Dmaj9",
      "Aadd9"
    ],
    "mood": [
      "Bright",
      "Catchy",
      "Inspired"
    ],
    "bestFor": [
      "Hooks",
      "Toplines",
      "Melodic Trap"
    ],
    "quote": "The hook was already there.",
    "soundRecipe": [
      "Bright keys",
      "Melody layer",
      "Clean harmonic glow",
      "Soft slap",
      "Solar shimmer"
    ],
    "macroBehavior": {
      "ENERGY": "Adds melodic attack and brighter key presence.",
      "DIVINITY": "Adds solar shimmer and oracle glow.",
      "WIDTH": "Spreads slap delay and hook room.",
      "REALM": "Turns simple keys into a melody oracle."
    },
    "realmFx": [
      {
        "name": "Solar Shimmer",
        "default": 0.4
      },
      {
        "name": "Hook Room",
        "default": 0.33
      },
      {
        "name": "Oracle Slap",
        "default": 0.24
      },
      {
        "name": "Melody Glow",
        "default": 0.47
      }
    ],
    "tags": [
      "apollo",
      "b-minor",
      "bright",
      "catchy",
      "inspired",
      "keys"
    ],
    "export": {
      "midiKit": "apollo-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "apollo-sunline",
    "godId": "apollo",
    "god": "Apollo",
    "icon": "☀",
    "slot": 2,
    "displayName": "APOLLO 02 — Sunline",
    "name": "Sunline",
    "subtitle": "Bell-key lead hybrid for top melodies",
    "category": "lead",
    "rootKey": "C# minor",
    "bpmRange": [
      120,
      155
    ],
    "chordProgression": [
      "C#m7",
      "Amaj9",
      "Emaj9",
      "Badd9"
    ],
    "mood": [
      "Melodic",
      "Clean",
      "Golden"
    ],
    "bestFor": [
      "Counter Melodies",
      "Hooks",
      "Pop-Rap"
    ],
    "quote": "The hook was already there.",
    "soundRecipe": [
      "Bell-key lead",
      "Vocal-like attack",
      "Solar delay",
      "Soft chorus",
      "Air layer"
    ],
    "macroBehavior": {
      "ENERGY": "Tightens lead edge and performance response.",
      "DIVINITY": "Raises golden bell glow.",
      "WIDTH": "Spreads delay lines without losing lead center.",
      "REALM": "Turns the lead into a sunline across the track."
    },
    "realmFx": [
      {
        "name": "Golden Bell",
        "default": 0.45
      },
      {
        "name": "Solar Delay",
        "default": 0.36
      },
      {
        "name": "Lead Air",
        "default": 0.34
      },
      {
        "name": "Soft Chorus",
        "default": 0.25
      }
    ],
    "tags": [
      "apollo",
      "c#-minor",
      "clean",
      "golden",
      "lead",
      "melodic"
    ],
    "export": {
      "midiKit": "apollo-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "apollo-golden-hook",
    "godId": "apollo",
    "god": "Apollo",
    "icon": "☀",
    "slot": 3,
    "displayName": "APOLLO 03 — Golden Hook",
    "name": "Golden Hook",
    "subtitle": "Smooth chorus chord sound",
    "category": "hybrid",
    "rootKey": "B minor",
    "bpmRange": [
      100,
      145
    ],
    "chordProgression": [
      "Bm9",
      "Gmaj9",
      "Dmaj9",
      "A6"
    ],
    "mood": [
      "Hooky",
      "Smooth",
      "Uplifting"
    ],
    "bestFor": [
      "Choruses",
      "Melodic Records",
      "Victory R&B"
    ],
    "quote": "The hook was already there.",
    "soundRecipe": [
      "Smooth chord keys",
      "Wide hook pad",
      "Subtle vocal air",
      "Clean bus glue",
      "Shimmer tail"
    ],
    "macroBehavior": {
      "ENERGY": "Adds chorus lift and bus push.",
      "DIVINITY": "Opens golden hook shimmer.",
      "WIDTH": "Expands the hook pad and shimmer sides.",
      "REALM": "Turns a chord bed into a chorus-ready golden hook."
    },
    "realmFx": [
      {
        "name": "Hook Pad",
        "default": 0.42
      },
      {
        "name": "Vocal Air",
        "default": 0.28
      },
      {
        "name": "Golden Tail",
        "default": 0.48
      },
      {
        "name": "Clean Glue",
        "default": 0.35
      }
    ],
    "tags": [
      "apollo",
      "b-minor",
      "hooky",
      "hybrid",
      "smooth",
      "uplifting"
    ],
    "export": {
      "midiKit": "apollo-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "apollo-prophecy-pluck",
    "godId": "apollo",
    "god": "Apollo",
    "icon": "☀",
    "slot": 4,
    "displayName": "APOLLO 04 — Prophecy Pluck",
    "name": "Prophecy Pluck",
    "subtitle": "Fast plucky divine shimmer",
    "category": "lead",
    "rootKey": "F# minor",
    "bpmRange": [
      130,
      170
    ],
    "chordProgression": [
      "F#m",
      "D",
      "A",
      "E"
    ],
    "mood": [
      "Fast",
      "Prophetic",
      "Catchy"
    ],
    "bestFor": [
      "Trap Melodies",
      "Toplines",
      "Arps"
    ],
    "quote": "The hook was already there.",
    "soundRecipe": [
      "Fast pluck",
      "Bright transient",
      "Ping-pong echo",
      "Divine shimmer",
      "Short tail"
    ],
    "macroBehavior": {
      "ENERGY": "Sharpens pluck and increases rhythmic bounce.",
      "DIVINITY": "Adds prophecy shimmer and bright overtone.",
      "WIDTH": "Widens ping-pong echo and stereo spark.",
      "REALM": "Turns the pluck into a divine message line."
    },
    "realmFx": [
      {
        "name": "Prophecy Echo",
        "default": 0.4
      },
      {
        "name": "Divine Spark",
        "default": 0.44
      },
      {
        "name": "Short Tail",
        "default": 0.21
      },
      {
        "name": "Bounce Snap",
        "default": 0.48
      }
    ],
    "tags": [
      "apollo",
      "catchy",
      "f#-minor",
      "fast",
      "lead",
      "prophetic"
    ],
    "export": {
      "midiKit": "apollo-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.55
    }
  },
  {
    "id": "chronos-broken-clock-keys",
    "godId": "chronos",
    "god": "Chronos",
    "icon": "⏳",
    "slot": 1,
    "displayName": "CHRONOS 01 — Broken Clock Keys",
    "name": "Broken Clock Keys",
    "subtitle": "Warped electric keys with unstable delay",
    "category": "keys",
    "rootKey": "D# minor",
    "bpmRange": [
      145,
      170
    ],
    "chordProgression": [
      "D#m9",
      "Bmaj7",
      "F#maj9",
      "A#7"
    ],
    "mood": [
      "Warped",
      "Futuristic",
      "Emotional"
    ],
    "bestFor": [
      "Experimental Trap",
      "Alt-R&B",
      "Intros"
    ],
    "quote": "The future has old memories.",
    "soundRecipe": [
      "Warped electric keys",
      "Tempo delay",
      "Pitch drift",
      "Granular dust",
      "Short reverse layer"
    ],
    "macroBehavior": {
      "ENERGY": "Adds clock tick attack and stronger movement.",
      "DIVINITY": "Adds time-glass shimmer and future air.",
      "WIDTH": "Spreads delays into asymmetric time space.",
      "REALM": "Breaks the timing into a playable time-warp world."
    },
    "realmFx": [
      {
        "name": "Clock Delay",
        "default": 0.48
      },
      {
        "name": "Pitch Drift",
        "default": 0.33
      },
      {
        "name": "Granular Dust",
        "default": 0.27
      },
      {
        "name": "Reverse Layer",
        "default": 0.22
      }
    ],
    "tags": [
      "chronos",
      "d#-minor",
      "emotional",
      "futuristic",
      "keys",
      "warped"
    ],
    "export": {
      "midiKit": "chronos-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "chronos-reverse-timeline",
    "godId": "chronos",
    "god": "Chronos",
    "icon": "⏳",
    "slot": 2,
    "displayName": "CHRONOS 02 — Reverse Timeline",
    "name": "Reverse Timeline",
    "subtitle": "Reverse key swells into chords",
    "category": "texture",
    "rootKey": "F minor",
    "bpmRange": [
      70,
      150
    ],
    "chordProgression": [
      "Fm9",
      "Dbmaj7",
      "Abmaj9",
      "Eb7sus"
    ],
    "mood": [
      "Reverse",
      "Dreamy",
      "Cinematic"
    ],
    "bestFor": [
      "Transitions",
      "Intros",
      "Beat Switches"
    ],
    "quote": "The future has old memories.",
    "soundRecipe": [
      "Reverse keys",
      "Swell layer",
      "Long delay",
      "Washed room",
      "Temporal filter"
    ],
    "macroBehavior": {
      "ENERGY": "Shortens swell and adds stronger arrival hit.",
      "DIVINITY": "Adds future shimmer to reverse layers.",
      "WIDTH": "Expands reverse tails around the center.",
      "REALM": "Makes the performance feel like it is moving backward."
    },
    "realmFx": [
      {
        "name": "Reverse Swell",
        "default": 0.62
      },
      {
        "name": "Time Wash",
        "default": 0.55
      },
      {
        "name": "Arrival Hit",
        "default": 0.28
      },
      {
        "name": "Temporal Filter",
        "default": 0.36
      }
    ],
    "tags": [
      "chronos",
      "cinematic",
      "dreamy",
      "f-minor",
      "reverse",
      "texture"
    ],
    "export": {
      "midiKit": "chronos-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "chronos-timeglass",
    "godId": "chronos",
    "god": "Chronos",
    "icon": "⏳",
    "slot": 3,
    "displayName": "CHRONOS 03 — Timeglass",
    "name": "Timeglass",
    "subtitle": "Glass keys with granular shimmer",
    "category": "hybrid",
    "rootKey": "C minor",
    "bpmRange": [
      90,
      160
    ],
    "chordProgression": [
      "Cm9",
      "Abmaj9",
      "Ebmaj9",
      "G7alt"
    ],
    "mood": [
      "Glass",
      "Modern",
      "Haunted"
    ],
    "bestFor": [
      "Alt-R&B",
      "Dark Melodies",
      "Futuristic Hooks"
    ],
    "quote": "The future has old memories.",
    "soundRecipe": [
      "Glass keys",
      "Granular shimmer",
      "Slow pitch cloud",
      "Digital dust",
      "Clean body"
    ],
    "macroBehavior": {
      "ENERGY": "Adds glass articulation and motion grit.",
      "DIVINITY": "Raises granular shimmer and hourglass sparkle.",
      "WIDTH": "Spreads granular cloud and delay field.",
      "REALM": "Turns keys into glass particles suspended in time."
    },
    "realmFx": [
      {
        "name": "Granular Glass",
        "default": 0.48
      },
      {
        "name": "Hourglass Spark",
        "default": 0.35
      },
      {
        "name": "Pitch Cloud",
        "default": 0.3
      },
      {
        "name": "Digital Dust",
        "default": 0.26
      }
    ],
    "tags": [
      "c-minor",
      "chronos",
      "glass",
      "haunted",
      "hybrid",
      "modern"
    ],
    "export": {
      "midiKit": "chronos-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  },
  {
    "id": "chronos-future-relic",
    "godId": "chronos",
    "god": "Chronos",
    "icon": "⏳",
    "slot": 4,
    "displayName": "CHRONOS 04 — Future Relic",
    "name": "Future Relic",
    "subtitle": "Old-soul keys processed like tomorrow",
    "category": "pad",
    "rootKey": "A minor",
    "bpmRange": [
      80,
      130
    ],
    "chordProgression": [
      "Am9",
      "Fmaj7",
      "Cmaj9",
      "E7alt"
    ],
    "mood": [
      "Vintage",
      "Future",
      "Emotional"
    ],
    "bestFor": [
      "Alt-R&B",
      "Pain Rap",
      "Experimental Soul"
    ],
    "quote": "The future has old memories.",
    "soundRecipe": [
      "Old Rhodes sample tone",
      "Futuristic delay",
      "Wow/flutter",
      "Soft pad layer",
      "Aged air"
    ],
    "macroBehavior": {
      "ENERGY": "Adds sample bite and bus movement.",
      "DIVINITY": "Adds soft future glow over the vintage base.",
      "WIDTH": "Expands pad layer and delayed memories.",
      "REALM": "Moves from old-soul keys into tomorrow's relic texture."
    },
    "realmFx": [
      {
        "name": "Future Delay",
        "default": 0.41
      },
      {
        "name": "Wow Flutter",
        "default": 0.37
      },
      {
        "name": "Aged Air",
        "default": 0.29
      },
      {
        "name": "Memory Pad",
        "default": 0.45
      }
    ],
    "tags": [
      "a-minor",
      "chronos",
      "emotional",
      "future",
      "pad",
      "vintage"
    ],
    "export": {
      "midiKit": "chronos-signature",
      "recommendedVelocity": [
        58,
        108
      ],
      "loopBars": 4,
      "swing": 0.5
    }
  }
];

export const midiKits: Record<string, VstGodMidiKit> = {
  "olympus-signature": {
    "godId": "olympus",
    "name": "Olympus Signature Kit",
    "bpm": 140,
    "key": "F minor",
    "chords": [
      "Fm9",
      "Dbmaj9",
      "Abmaj9",
      "Eb13"
    ],
    "voicings": [
      [
        "F2",
        "Ab3",
        "C4",
        "Eb4",
        "G4"
      ],
      [
        "Db2",
        "F3",
        "Ab3",
        "C4",
        "Eb4"
      ],
      [
        "Ab2",
        "C4",
        "Eb4",
        "G4",
        "Bb4"
      ],
      [
        "Eb2",
        "G3",
        "Db4",
        "F4",
        "C5"
      ]
    ],
    "bass": [
      "F1",
      "F1",
      "Db1",
      "Db1",
      "Ab1",
      "Ab1",
      "Eb1",
      "Eb1"
    ],
    "melody": [
      "C5",
      "Eb5",
      "G5",
      "Eb5",
      "C5",
      "Bb4",
      "G4",
      "F4"
    ]
  },
  "hades-signature": {
    "godId": "hades",
    "name": "Hades Signature Kit",
    "bpm": 138,
    "key": "C minor",
    "chords": [
      "Cm9",
      "Abmaj7",
      "Fm9",
      "G7alt"
    ],
    "voicings": [
      [
        "C2",
        "Eb3",
        "G3",
        "Bb3",
        "D4"
      ],
      [
        "Ab2",
        "C4",
        "Eb4",
        "G4"
      ],
      [
        "F2",
        "Ab3",
        "C4",
        "Eb4",
        "G4"
      ],
      [
        "G2",
        "B3",
        "F4",
        "Ab4",
        "Eb5"
      ]
    ],
    "bass": [
      "C1",
      "C1",
      "Ab0",
      "Ab0",
      "F1",
      "F1",
      "G1",
      "G1"
    ],
    "melody": [
      "Eb4",
      "G4",
      "Bb4",
      "D5",
      "C5",
      "Ab4",
      "G4",
      "F4"
    ]
  },
  "zeus-signature": {
    "godId": "zeus",
    "name": "Zeus Signature Kit",
    "bpm": 150,
    "key": "D minor",
    "chords": [
      "Dm",
      "Bb",
      "F",
      "C"
    ],
    "voicings": [
      [
        "D2",
        "A3",
        "D4",
        "F4"
      ],
      [
        "Bb1",
        "F3",
        "Bb3",
        "D4"
      ],
      [
        "F2",
        "C4",
        "F4",
        "A4"
      ],
      [
        "C2",
        "G3",
        "C4",
        "E4"
      ]
    ],
    "bass": [
      "D1",
      "D1",
      "Bb0",
      "Bb0",
      "F1",
      "F1",
      "C1",
      "C1"
    ],
    "melody": [
      "D5",
      "F5",
      "A5",
      "G5",
      "F5",
      "E5",
      "D5",
      "C5"
    ]
  },
  "athena-signature": {
    "godId": "athena",
    "name": "Athena Signature Kit",
    "bpm": 92,
    "key": "A minor",
    "chords": [
      "Am9",
      "Em9",
      "Fmaj7",
      "Dm9"
    ],
    "voicings": [
      [
        "A2",
        "C4",
        "E4",
        "G4",
        "B4"
      ],
      [
        "E2",
        "G3",
        "B3",
        "D4",
        "F#4"
      ],
      [
        "F2",
        "A3",
        "C4",
        "E4"
      ],
      [
        "D2",
        "F3",
        "A3",
        "C4",
        "E4"
      ]
    ],
    "bass": [
      "A1",
      "A1",
      "E1",
      "E1",
      "F1",
      "F1",
      "D1",
      "D1"
    ],
    "melody": [
      "E4",
      "G4",
      "B4",
      "A4",
      "G4",
      "F4",
      "E4",
      "D4"
    ]
  },
  "poseidon-signature": {
    "godId": "poseidon",
    "name": "Poseidon Signature Kit",
    "bpm": 100,
    "key": "E minor",
    "chords": [
      "Em9",
      "Cmaj9",
      "Gmaj9",
      "Bm7"
    ],
    "voicings": [
      [
        "E2",
        "G3",
        "B3",
        "D4",
        "F#4"
      ],
      [
        "C2",
        "E3",
        "G3",
        "B3",
        "D4"
      ],
      [
        "G2",
        "B3",
        "D4",
        "F#4",
        "A4"
      ],
      [
        "B1",
        "F#3",
        "A3",
        "D4"
      ]
    ],
    "bass": [
      "E1",
      "E1",
      "C1",
      "C1",
      "G1",
      "G1",
      "B0",
      "B0"
    ],
    "melody": [
      "B4",
      "D5",
      "F#5",
      "E5",
      "D5",
      "B4",
      "A4",
      "G4"
    ]
  },
  "titan-signature": {
    "godId": "titan",
    "name": "Titan Signature Kit",
    "bpm": 144,
    "key": "G minor",
    "chords": [
      "Gm",
      "Eb",
      "F",
      "D7"
    ],
    "voicings": [
      [
        "G1",
        "D3",
        "G3",
        "Bb3"
      ],
      [
        "Eb1",
        "Bb2",
        "Eb3",
        "G3"
      ],
      [
        "F1",
        "C3",
        "F3",
        "A3"
      ],
      [
        "D1",
        "A2",
        "C3",
        "F#3"
      ]
    ],
    "bass": [
      "G0",
      "G0",
      "Eb0",
      "Eb0",
      "F0",
      "F0",
      "D0",
      "D0"
    ],
    "melody": [
      "D3",
      "G3",
      "Bb3",
      "D4",
      "C4",
      "Bb3",
      "A3",
      "F#3"
    ]
  },
  "apollo-signature": {
    "godId": "apollo",
    "name": "Apollo Signature Kit",
    "bpm": 128,
    "key": "B minor",
    "chords": [
      "Bm7",
      "Gmaj9",
      "Dmaj9",
      "Aadd9"
    ],
    "voicings": [
      [
        "B2",
        "D4",
        "F#4",
        "A4"
      ],
      [
        "G2",
        "B3",
        "D4",
        "F#4",
        "A4"
      ],
      [
        "D2",
        "F#3",
        "A3",
        "C#4",
        "E4"
      ],
      [
        "A2",
        "B3",
        "C#4",
        "E4"
      ]
    ],
    "bass": [
      "B1",
      "B1",
      "G1",
      "G1",
      "D1",
      "D1",
      "A1",
      "A1"
    ],
    "melody": [
      "F#4",
      "A4",
      "B4",
      "D5",
      "C#5",
      "A4",
      "F#4",
      "E4"
    ]
  },
  "chronos-signature": {
    "godId": "chronos",
    "name": "Chronos Signature Kit",
    "bpm": 160,
    "key": "D# minor",
    "chords": [
      "D#m9",
      "Bmaj7",
      "F#maj9",
      "A#7"
    ],
    "voicings": [
      [
        "D#2",
        "F#3",
        "A#3",
        "C#4",
        "F4"
      ],
      [
        "B1",
        "D#3",
        "F#3",
        "A#3"
      ],
      [
        "F#2",
        "A#3",
        "C#4",
        "F4",
        "G#4"
      ],
      [
        "A#1",
        "D3",
        "G#3",
        "C#4"
      ]
    ],
    "bass": [
      "D#1",
      "D#1",
      "B0",
      "B0",
      "F#1",
      "F#1",
      "A#0",
      "A#0"
    ],
    "melody": [
      "F#4",
      "A#4",
      "C#5",
      "F5",
      "D#5",
      "C#5",
      "A#4",
      "G#4"
    ]
  }
};

export const defaultGodOrder = godProfiles.map((god) => god.id);

export const defaultPresetId = "olympus-domain-keys";

export function getGodProfile(godId: string): VstGodProfile | undefined {
  return godProfiles.find((god) => god.id === godId);
}

export function getPresetsByGod(godId: string): VstGodPreset[] {
  return vstGodPresets.filter((preset) => preset.godId === godId);
}

export function getPresetsByCategory(category: VstGodPresetCategory): VstGodPreset[] {
  return vstGodPresets.filter((preset) => preset.category === category);
}

export function getPresetById(presetId: string): VstGodPreset | undefined {
  return vstGodPresets.find((preset) => preset.id === presetId);
}

export function getMidiKitForPreset(preset: VstGodPreset): VstGodMidiKit | undefined {
  return midiKits[preset.export.midiKit];
}

export function getNextPreset(currentPresetId: string): VstGodPreset {
  const index = vstGodPresets.findIndex((preset) => preset.id === currentPresetId);
  const nextIndex = index < 0 ? 0 : (index + 1) % vstGodPresets.length;
  return vstGodPresets[nextIndex];
}

export function getPreviousPreset(currentPresetId: string): VstGodPreset {
  const index = vstGodPresets.findIndex((preset) => preset.id === currentPresetId);
  const previousIndex = index < 0 ? 0 : (index - 1 + vstGodPresets.length) % vstGodPresets.length;
  return vstGodPresets[previousIndex];
}

export function getGodVisualStyle(godId: string) {
  const god = getGodProfile(godId);

  return {
    "--vst-god-primary": god?.colorTokens.primary ?? "#F9D86E",
    "--vst-god-secondary": god?.colorTokens.secondary ?? "#7E55FF",
    "--vst-god-glass": god?.colorTokens.glass ?? "rgba(249, 216, 110, 0.15)",
  } as React.CSSProperties;
}

export function createPresetExportManifest(presetId: string) {
  const preset = getPresetById(presetId);
  if (!preset) throw new Error(`Preset not found: ${presetId}`);

  const god = getGodProfile(preset.godId);
  const midiKit = getMidiKitForPreset(preset);

  return {
    product: "VST GOD",
    library: "Electric Pantheon",
    preset,
    god,
    midiKit,
    faceControls: VST_GOD_FACE_CONTROLS,
    macroBehaviorMap,
    exportedAt: new Date().toISOString(),
  };
}
