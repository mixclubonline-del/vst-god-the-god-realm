# VST GOD — Electric Pantheon Build Plan for Antigravity

**Project:** VST GOD — The God Realm  
**Module:** Electric Pantheon  
**Version:** v1 Planning Lock  
**Owner:** Prime / Mixx Club  
**Purpose:** Bring a full pantheon-based electric keys system into the existing VST GOD plugin UI without breaking the current Antigravity standalone flow.

---

## 1. Core Vision

The Electric Pantheon is a full set of electric keys built around god identities, not normal preset names.

This is not a Rhodes pack.  
This is not a Wurly pack.  
This is not a DX clone.

The Electric Pantheon is a playable mythology system where every god has:

- a sonic identity
- an emotional purpose
- a visual realm
- a performance behavior
- a shared macro language
- a distinct frequency and texture profile

The producer should load a god and instantly understand the record they are making.

The experience should feel like entering a sacred electric keyboard realm inside VST GOD.

---

## 2. Product Language

### Official Module Name

**Electric Pantheon**

### Guide Description

The Electric Pantheon is VST GOD’s divine electric keys system — a family of playable god instruments where each deity transforms electric piano, FM keys, analog warmth, cinematic layers, and supernatural effects into a unique emotional instrument.

### Canon Line

> The Electric Pantheon uses four locked face controls — Energy, Divinity, Width, and Realm — giving every god a shared performance language while allowing each deity to interpret those controls through its own sonic mythology.

---

## 3. Locked Face Controls

The visible front-panel controls must remain exactly:

```txt
ENERGY
DIVINITY
WIDTH
REALM
```

These are the only visible main face macros for the Electric Pantheon.

Do not add these as main face controls:

```txt
AGE
AURA
TONE
MOTION
NOISE
SPACE
TEXTURE
CHARACTER
```

Those can exist underneath the hood, inside Realm FX, or inside the X/Y Vortex, but not as main visible face controls.

---

## 4. Control Hierarchy

```txt
Main Face Controls:
ENERGY / DIVINITY / WIDTH / REALM

Performance Pad:
X/Y Vortex
X-axis = AURA
Y-axis = AGE / INSTABILITY

Secondary Depth:
Realm FX
Divine Morph
God Profile
ALS Vision
```

The UI must stay reductionist. The user should not feel overwhelmed.

---

## 5. Main Macro Definitions

## ENERGY

### Purpose
Performance intensity.

This controls how hard the god is moving. It should never simply mean louder.

### Internal Targets

- velocity curve
- transient attack
- saturation drive
- compressor input
- harmonic bite
- low-mid punch
- percussive tine/noise layer
- optional aggression layer per god
- gain compensation

### Range Behavior

| Value | Feel |
|---:|---|
| 0–25 | Soft, intimate, restrained |
| 26–50 | Balanced, playable, musical |
| 51–75 | Forward, present, record-ready |
| 76–100 | Aggressive, divine overload |

### Rule

ENERGY must feel like more power, not more clipping.

Use gain compensation.

---

## DIVINITY

### Purpose
The supernatural harmonic layer.

This controls how godlike the sound feels.

### Internal Targets

- harmonic exciter
- bell/tine enhancement
- air band lift
- shimmer layer
- upper octave ghosts
- subtle reverb bloom
- halo sustain
- additive harmonic layers
- dynamic high-end smoothing

### Range Behavior

| Value | Feel |
|---:|---|
| 0–25 | Earthly, dry, close |
| 26–50 | Polished, musical |
| 51–75 | Glowing, premium |
| 76–100 | Celestial, supernatural |

### Rule

DIVINITY should glow, not stab.

At high values, use smoothing, dynamic de-essing, or soft limiting on shimmer layers.

---

## WIDTH

### Purpose
Stereo dimension and spatial motion.

This controls how wide the realm feels.

### Internal Targets

- stereo width
- chorus spread
- mid/side balance
- micro-delay spread
- stereo modulation
- auto-pan depth
- reverb width
- layer spread

### Range Behavior

| Value | Feel |
|---:|---|
| 0–25 | Focused, mono-compatible |
| 26–50 | Natural stereo |
| 51–75 | Wide record-ready |
| 76–100 | Cinematic, immersive |

### Hard Rule

Keep low frequencies mono-safe.

```txt
Sub + low body = stable center
Air + texture + motion = stereo sides
```

Below roughly 120–150 Hz, do not let WIDTH destabilize the low end.

---

## REALM

### Purpose
The identity morph knob.

This is the most important macro. REALM controls how deeply the selected god takes over the sound.

### Internal Targets

- core instrument morph
- texture layer blend
- FX personality
- tonal color
- degradation style
- modulation character
- environmental ambience
- mythological behavior
- visual theme intensity

### Range Behavior

| Value | Feel |
|---:|---|
| 0–25 | Clean instrument foundation |
| 26–50 | God identity active |
| 51–75 | Full realm personality |
| 76–100 | Mythic transformation |

### Rule

REALM is not a random wet/dry knob.

It should feel like the instrument crossing into its world.

---

# 6. Hidden / Secondary Macro System

## AURA

### Placement

AURA should not be a main face knob.

Map AURA to:

```txt
X/Y Vortex X-axis
```

### Purpose
Atmosphere, reverb, emotional space, and environmental depth.

### Internal Targets

- reverb send
- shimmer send
- delay feedback
- tail length
- room/chamber size
- environmental texture
- pad layer depth
- sustain bloom

---

## AGE

### Placement

AGE should not be a main face knob.

Map AGE to:

```txt
X/Y Vortex Y-axis
```

AGE can also be interpreted as instability depending on the god.

### Purpose
Vintage wear, instability, and time damage.

### Internal Targets

- wow/flutter
- tape noise
- bit depth softness
- pitch drift
- mechanical key noise
- speaker age
- sample-start randomness
- dust/noise layer

---

# 7. X/Y Vortex

The X/Y Vortex is the live performance pad.

### Mapping

```txt
X-axis = AURA
Y-axis = AGE / INSTABILITY
```

### Behavior

- Moving right increases space, atmosphere, ambience, and emotional depth.
- Moving up increases age, danger, instability, degradation, and movement.

### UI Labels

```txt
X/Y VORTEX
X = AURA
Y = AGE
```

or, for darker gods:

```txt
X = AURA
Y = INSTABILITY
```

---

# 8. Divine Morph

Divine Morph should allow morphing between god identities.

### Purpose
Morph between two deities in real time.

### Examples

```txt
Olympus → Hades
Apollo → Titan
Athena → Zeus
Poseidon → Chronos
```

### Must Morph

- core layer blend
- FX profile
- macro response curves
- color theme
- ALS behavior
- texture layers
- tuning instability
- spatial field

### Critical Rule

Divine Morph should not just crossfade audio.

It should morph the behavior of the macros themselves.

Example:

At Olympus:

```txt
ENERGY = Rhodes bark + golden warmth
```

At Hades:

```txt
ENERGY = distortion + instability + underworld grit
```

The same knob changes meaning as the deity changes.

---

# 9. First 8 God Identities

## 1. OLYMPUS

### Title
**Luxury Above The Clouds**

### Tone

- warm Rhodes foundation
- expensive harmonics
- velvet top-end
- wide stereo bloom
- soft analog saturation
- controlled low mids

### Emotional Purpose

The “I already won” instrument.

### Best For

- luxury rap
- introspective success
- cinematic wealth
- emotional confidence
- victory records
- R&B
- melodic trap

### Sonic References

- penthouse at night
- gold chains in rain
- Maybach interior energy
- soul samples reborn futuristic

### Key Behavior

- velocity increases harmonic bloom
- chords widen automatically
- long notes create halo tails

### Macro Behavior

| Macro | Olympus Behavior |
|---|---|
| ENERGY | Adds Rhodes bark, gold warmth, and confident presence |
| DIVINITY | Adds golden halo, expensive high-end bloom |
| WIDTH | Adds luxury stereo bloom while preserving mono-safe body |
| REALM | Morphs Rhodes into celestial palace keys |
| AURA | Heavenly palace hall |
| AGE | Polished vinyl warmth |

### UI Profile

```txt
Element: Light
Domain: Victory
Energy: Elevated
Mood: Confident
Best For: Luxury Rap, R&B, Melodic Trap, Cinematic Soul
Quote: “You already won.”
```

---

## 2. HADES

### Title
**The Beautiful Underworld**

### Tone

- distorted Wurly core
- tape instability
- dark saturation
- broken speaker texture
- mono-centered low mids
- slight detune drift

### Emotional Purpose

Pain plus power.

### Best For

- dark trap
- betrayal music
- revenge records
- underground confessionals
- villain arc energy

### Sonic References

- abandoned church
- burnt tape machines
- subway tunnel reverb
- smoke and neon

### Key Behavior

- hard velocity adds distortion
- sustain introduces instability
- notes slightly decay in pitch

### Macro Behavior

| Macro | Hades Behavior |
|---|---|
| ENERGY | Increases distortion, speaker breakup, and pitch instability |
| DIVINITY | Adds cursed harmonics and dark spiritual overtones |
| WIDTH | Keeps low mids centered while haunted movement spreads on the sides |
| REALM | Morphs Wurly into broken-tape underworld ritual keys |
| AURA | Underworld chamber |
| AGE | Burnt speaker, broken tape, and unstable pitch |

### Signature Trait

The harder you play, the more the realm collapses.

---

## 3. ZEUS

### Title
**Lightning In Human Form**

### Tone

- bright attack
- DX/FM electric core
- hyper transient snap
- air-frequency sparkle
- aggressive stereo imaging

### Emotional Purpose

Dominance.

### Best For

- anthem records
- high-energy trap
- victory music
- crowd-control hooks
- beat switch moments

### Sonic References

- electrical storms
- arena lights
- transformers energy
- divine voltage

### Key Behavior

- velocity creates transient sparks
- fast playing widens stereo field
- repeated notes trigger harmonic arcs

### Macro Behavior

| Macro | Zeus Behavior |
|---|---|
| ENERGY | Sharpens attack and adds electrical transient sparks |
| DIVINITY | Adds white lightning shimmer and electric upper harmonics |
| WIDTH | Adds fast stereo sparks and wide attack flashes |
| REALM | Morphs FM EP into lightning-charged anthem keys |
| AURA | Storm field |
| AGE | Unstable voltage |

### Signature Trait

Feels alive and dangerous.

---

## 4. ATHENA

### Title
**Intelligence With Soul**

### Tone

- neo-soul EP core
- jazz chord enhancement
- midrange richness
- soft tape warmth
- smooth transient edges

### Emotional Purpose

Sophisticated emotion.

### Best For

- neo soul
- jazz rap
- R&B
- deep songwriting
- thinking music

### Sonic References

- rooftop jazz bars
- late-night writing sessions
- velvet studio lighting

### Key Behavior

- chords intelligently bloom
- extensions shimmer softly
- optional humanized timing drift

### Macro Behavior

| Macro | Athena Behavior |
|---|---|
| ENERGY | Adds chord bloom and upper-mid articulation |
| DIVINITY | Adds intelligent chord aura and smooth jazz extension glow |
| WIDTH | Adds balanced neo-soul spread while preserving chord clarity |
| REALM | Morphs warm EP into intelligent neo-soul oracle keys |
| AURA | Intimate studio / jazz room |
| AGE | Clean tape warmth |

### Signature Trait

Makes simple chords feel genius.

---

## 5. POSEIDON

### Title
**Liquid Memory**

### Tone

- ambient EP
- liquid tremolo
- underwater chorus
- deep atmospheric tails
- moving stereo field

### Emotional Purpose

Floating through memory.

### Best For

- ambient trap
- emotional interludes
- dream sequences
- melodic storytelling
- psychedelic production

### Sonic References

- underwater cities
- moonlight oceans
- drifting through space

### Key Behavior

- stereo moves like waves
- modulation breathes naturally
- notes evolve while sustaining

### Macro Behavior

| Macro | Poseidon Behavior |
|---|---|
| ENERGY | Increases wave motion and liquid pulse |
| DIVINITY | Adds aquatic shimmer and distant oceanic reflections |
| WIDTH | Adds wave-like side motion and drifting field movement |
| REALM | Morphs ambient EP into underwater memory instrument |
| AURA | Underwater temple |
| AGE | Water-worn memory |

### Signature Trait

Nothing stays still.

---

## 6. TITAN

### Title
**Massive Cinematic Force**

### Tone

- layered octave keys
- cinematic low end
- hybrid piano/synth body
- massive transient scale
- huge reverb chambers

### Emotional Purpose

Scale.

### Best For

- movie trailers
- stadium records
- emotional climax
- boss battle energy
- orchestral trap

### Sonic References

- giant structures
- collapsing worlds
- IMAX sound design

### Key Behavior

- chords stack dynamically
- bass harmonics grow with sustain
- velocity increases perceived size

### Macro Behavior

| Macro | Titan Behavior |
|---|---|
| ENERGY | Adds octave weight, sub-body, and cinematic impact |
| DIVINITY | Adds giant harmonic lift and choir-like thickness |
| WIDTH | Adds massive cinematic stage width |
| REALM | Morphs hybrid piano/EP into colossal cinematic force |
| AURA | Giant cinematic arena |
| AGE | Ancient stone chamber |

### Signature Trait

Makes small ideas sound enormous.

---

## 7. APOLLO

### Title
**The Oracle Of Melody**

### Tone

- bell-like EP
- high-end shimmer
- crystal harmonics
- soft transient body
- airy sustain

### Emotional Purpose

Pure melody.

### Best For

- hooks
- emotional toplines
- melodic rap
- vulnerable records
- anthem choruses

### Sonic References

- celestial bells
- sunrise reflections
- emotional revelation

### Key Behavior

- upper harmonics glow on sustain
- high notes produce angelic layers
- melody phrases trigger ambience

### Macro Behavior

| Macro | Apollo Behavior |
|---|---|
| ENERGY | Increases bell clarity and melodic shimmer |
| DIVINITY | Adds crystal bell halo and emotional hook glow |
| WIDTH | Adds airy melodic spread and high-end shimmer on sides |
| REALM | Morphs bell EP into celestial hook machine |
| AURA | Golden sunrise chamber |
| AGE | Timeless crystal glow |

### Signature Trait

Designed to create unforgettable hooks.

---

## 8. CHRONOS

### Title
**Time Is Breaking**

### Tone

- granular electric piano
- reverse textures
- time-stretched harmonics
- ghost ambience
- pitch memory trails

### Emotional Purpose

Disorientation plus transcendence.

### Best For

- experimental trap
- psychedelic hip-hop
- transitions
- futuristic soundtracks
- abstract production

### Sonic References

- broken timelines
- memories folding
- slowed reality

### Key Behavior

- notes leave time trails
- reverse harmonics emerge dynamically
- sustain introduces temporal drift

### Macro Behavior

| Macro | Chronos Behavior |
|---|---|
| ENERGY | Adds glitch trails, reverse movement, and time smear |
| DIVINITY | Adds ghost harmonics and delayed memory trails |
| WIDTH | Adds fractured stereo time trails and offset ghosts |
| REALM | Morphs EP into reverse/granular time-warped instrument |
| AURA | Fractured timeline space |
| AGE | Time decay and reverse dust |

### Signature Trait

Feels like playing inside a dream.

---

# 10. UI Layout Direction

The existing VST GOD layout should evolve into the Electric Pantheon layout while preserving the current Antigravity standalone structure.

## Current Useful Structure

The active UI already has:

```txt
VST GOD
THE GOD REALM
Preset selector
Tabs
Hero visual
Active slots
X/Y Vortex
Divine Morph
Global Macros
Realm FX
Master envelope
Neural Forge
Transport / engine status
```

Keep this structure.

Do not rebuild the whole UI from scratch.

---

## Recommended Electric Pantheon Layout

```txt
TOP BAR
VST GOD | ELECTRIC PANTHEON | Preset / God selector | BPM | Key | Save

LEFT PANEL
Electric Pantheon god list:
OLYMPUS
HADES
ZEUS
ATHENA
POSEIDON
TITAN
APOLLO
CHRONOS

CENTER TOP
GLOBAL MACROS
ENERGY / DIVINITY / WIDTH / REALM

CENTER HERO
Selected god realm artwork
God name
Tagline
Short emotional description
Core sound chips

RIGHT PANEL
God Profile
Element
Domain
Energy
Mood
Best For
Quote

BOTTOM LEFT
X/Y Vortex
X = AURA
Y = AGE / INSTABILITY

BOTTOM CENTER
Realm FX
God-specific FX modules

BOTTOM RIGHT
ALS Vision
Divine level / visual waveform / realm reaction

BOTTOM
Keyboard
Pitch / Mod
Velocity Curve
Voice Mode
Engine Status
```

---

# 11. Current UI Integration Notes

Based on the current page at localhost:3004, the system already has visible text for:

```txt
Global Macros
50% ENERGY
50% DIVINITY
50% WIDTH
50% REALM
```

This is correct.

### Do This

- Keep Global Macros visible.
- Move them visually higher and make them more important.
- Make Electric Pantheon feel like the active mode.
- Replace or extend the current slot-based Forge cards with god-based keys when the Electric Pantheon tab is active.
- Keep the existing tabs for future modules, but add or prioritize Electric Pantheon.

### Do Not Do This

- Do not add extra face knobs.
- Do not flatten the design.
- Do not make the UI plain white.
- Do not remove the God Realm identity.
- Do not break current Antigravity standalone engine status UI.

---

# 12. Recommended Tab Adjustments

Current tabs include:

```txt
MULTI-REALM
HARMONIC PANTHEON
CHOPPER
ARCHIVE
SACRED SEQUENCER
CELESTIAL FORGE
RITUAL OF EXPORT
PRESET VAULT
```

Recommended update:

```txt
ELECTRIC PANTHEON
MULTI-REALM
HARMONIC PANTHEON
CHOPPER
SACRED SEQUENCER
CELESTIAL FORGE
EXPORT LAB
PRESET VAULT
```

Electric Pantheon should become a major mode, not hidden behind generic Forge language.

---

# 13. Realm FX Behavior

Realm FX should adapt per god.

## Olympus Example

```txt
HEAVENLY REVERB
GOLD CHORUS
PALACE DELAY
VELVET SATURATION
```

## Hades Example

```txt
UNDERWORLD REVERB
BURNED TAPE
CURSED CHORUS
BROKEN SPEAKER
```

## Zeus Example

```txt
STORM DELAY
LIGHTNING TRANSIENT
VOLTAGE CHORUS
THUNDER SATURATION
```

## Athena Example

```txt
ORACLE ROOM
JAZZ BLOOM
VELVET CHORUS
CHORD HALO
```

## Poseidon Example

```txt
OCEANIC REVERB
LIQUID TREMOLO
TIDAL CHORUS
DEEP CURRENT
```

## Titan Example

```txt
COLOSSAL HALL
IMPACT LAYER
STONE CHORUS
GIANT GLUE
```

## Apollo Example

```txt
SUNRISE REVERB
CRYSTAL DELAY
MELODY HALO
ANGELIC SHIMMER
```

## Chronos Example

```txt
TIME SMEAR
REVERSE DELAY
GRANULAR HALO
MEMORY DRIFT
```

---

# 14. ALS Vision Rules

ALS Vision should show the state of the god without distracting from the workflow.

## ENERGY

- stronger pulse
- transient flashes
- intensity rises

## DIVINITY

- halo glow increases
- top rail gets luminous
- particles smooth out

## WIDTH

- side energy spreads outward
- stereo field visualization expands

## REALM

- background realm shifts
- god emblem intensifies
- UI color theme transforms

## AGE

- subtle flicker
- dust
- artifact movement

## AURA

- atmosphere expands
- reverb tail visualization grows

### Rule

ALS confirms action. It does not steal attention.

---

# 15. Macro Response Curves

Each macro needs a response curve, not a basic linear mapping.

## ENERGY Curve

```txt
0–60 = musical control
60–100 = divine power ramp
```

Use an S-curve.

## DIVINITY Curve

```txt
0–70 = harmonic polish
70–100 = supernatural bloom
```

Use a soft curve.

## WIDTH Curve

```txt
0–75 = mix-safe width
75–100 = cinematic spread
```

Mostly linear with safety clamp.

## REALM Curve

```txt
0–40 = clean foundation
40–75 = identity
75–100 = full realm takeover
```

Use an S-curve.

---

# 16. Developer Type Model

Use this as the conceptual model for the macro system.

```ts
type PantheonMacroId = "energy" | "divinity" | "width" | "realm" | "age" | "aura";

type PantheonMacro = {
  id: PantheonMacroId;
  label: string;
  value: number; // 0-100
  visible: boolean;
  targetGroups: string[];
  curve: "linear" | "soft" | "exponential" | "sCurve";
  gainCompensated: boolean;
  alsFeedback: {
    intensity: number;
    colorRole: "power" | "halo" | "space" | "realm" | "age" | "aura";
    motion: "pulse" | "glow" | "spread" | "morph" | "flicker" | "bloom";
  };
};
```

Recommended macro config:

```ts
const pantheonMacros: PantheonMacro[] = [
  {
    id: "energy",
    label: "ENERGY",
    value: 50,
    visible: true,
    targetGroups: ["velocity", "transient", "saturation", "compression", "harmonics"],
    curve: "sCurve",
    gainCompensated: true,
    alsFeedback: {
      intensity: 0.6,
      colorRole: "power",
      motion: "pulse",
    },
  },
  {
    id: "divinity",
    label: "DIVINITY",
    value: 50,
    visible: true,
    targetGroups: ["exciter", "shimmer", "upperHarmonics", "haloLayer"],
    curve: "soft",
    gainCompensated: true,
    alsFeedback: {
      intensity: 0.6,
      colorRole: "halo",
      motion: "glow",
    },
  },
  {
    id: "width",
    label: "WIDTH",
    value: 50,
    visible: true,
    targetGroups: ["chorus", "midSide", "stereoDelay", "reverbWidth"],
    curve: "linear",
    gainCompensated: false,
    alsFeedback: {
      intensity: 0.5,
      colorRole: "space",
      motion: "spread",
    },
  },
  {
    id: "realm",
    label: "REALM",
    value: 50,
    visible: true,
    targetGroups: ["coreMorph", "textureBlend", "fxProfile", "visualTheme"],
    curve: "sCurve",
    gainCompensated: true,
    alsFeedback: {
      intensity: 0.7,
      colorRole: "realm",
      motion: "morph",
    },
  },
  {
    id: "aura",
    label: "AURA",
    value: 50,
    visible: false,
    targetGroups: ["reverbSend", "delayFeedback", "spaceLayer", "tailLength"],
    curve: "soft",
    gainCompensated: true,
    alsFeedback: {
      intensity: 0.5,
      colorRole: "aura",
      motion: "bloom",
    },
  },
  {
    id: "age",
    label: "AGE",
    value: 50,
    visible: false,
    targetGroups: ["wowFlutter", "noise", "pitchDrift", "speakerWear"],
    curve: "exponential",
    gainCompensated: true,
    alsFeedback: {
      intensity: 0.4,
      colorRole: "age",
      motion: "flicker",
    },
  },
];
```

---

# 17. God Data Model

Use this shape for god configuration.

```ts
type ElectricPantheonGodId =
  | "olympus"
  | "hades"
  | "zeus"
  | "athena"
  | "poseidon"
  | "titan"
  | "apollo"
  | "chronos";

type ElectricPantheonGod = {
  id: ElectricPantheonGodId;
  name: string;
  title: string;
  tone: string[];
  emotionalPurpose: string;
  bestFor: string[];
  sonicReferences: string[];
  keyBehavior: string[];
  macroBehavior: {
    energy: string;
    divinity: string;
    width: string;
    realm: string;
    aura: string;
    age: string;
  };
  profile: {
    element: string;
    domain: string;
    energy: string;
    mood: string;
    quote: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  realmFx: string[];
};
```

---

# 18. Initial God Config Starter

```ts
export const electricPantheonGods: ElectricPantheonGod[] = [
  {
    id: "olympus",
    name: "OLYMPUS",
    title: "Luxury Above The Clouds",
    tone: [
      "Warm Rhodes foundation",
      "Expensive harmonics",
      "Velvet top-end",
      "Wide stereo bloom",
      "Soft analog saturation",
      "Controlled low mids",
    ],
    emotionalPurpose: "The I already won instrument.",
    bestFor: ["Luxury Rap", "R&B", "Melodic Trap", "Cinematic Soul", "Victory Records"],
    sonicReferences: ["Penthouse at night", "Gold chains in rain", "Maybach interior energy"],
    keyBehavior: [
      "Velocity increases harmonic bloom",
      "Chords widen automatically",
      "Long notes create halo tails",
    ],
    macroBehavior: {
      energy: "Adds Rhodes bark, gold warmth, and confident presence",
      divinity: "Adds golden halo and expensive high-end bloom",
      width: "Adds luxury stereo bloom while preserving mono-safe body",
      realm: "Morphs Rhodes into celestial palace keys",
      aura: "Heavenly palace hall",
      age: "Polished vinyl warmth",
    },
    profile: {
      element: "Light",
      domain: "Victory",
      energy: "Elevated",
      mood: "Confident",
      quote: "You already won.",
    },
    colors: {
      primary: "#f8c85a",
      secondary: "#6d4b1f",
      accent: "#fff1b0",
    },
    realmFx: ["Heavenly Reverb", "Gold Chorus", "Palace Delay", "Velvet Saturation"],
  },
  {
    id: "hades",
    name: "HADES",
    title: "The Beautiful Underworld",
    tone: ["Distorted Wurly core", "Tape instability", "Dark saturation", "Broken speaker texture"],
    emotionalPurpose: "Pain plus power.",
    bestFor: ["Dark Trap", "Revenge Records", "Underground Confessionals", "Villain Arc Energy"],
    sonicReferences: ["Abandoned church", "Burnt tape machines", "Subway tunnel reverb"],
    keyBehavior: ["Hard velocity adds distortion", "Sustain introduces instability", "Notes slightly decay in pitch"],
    macroBehavior: {
      energy: "Increases distortion, speaker breakup, and pitch instability",
      divinity: "Adds cursed harmonics and dark spiritual overtones",
      width: "Keeps low mids centered while haunted movement spreads on the sides",
      realm: "Morphs Wurly into broken-tape underworld ritual keys",
      aura: "Underworld chamber",
      age: "Burnt speaker, broken tape, and unstable pitch",
    },
    profile: {
      element: "Shadow",
      domain: "Underworld",
      energy: "Heavy",
      mood: "Dangerous",
      quote: "The pain became power.",
    },
    colors: {
      primary: "#d64b35",
      secondary: "#1a0504",
      accent: "#ff7a4a",
    },
    realmFx: ["Underworld Reverb", "Burned Tape", "Cursed Chorus", "Broken Speaker"],
  },
  {
    id: "zeus",
    name: "ZEUS",
    title: "Lightning In Human Form",
    tone: ["Bright attack", "DX/FM electric core", "Hyper transient snap", "Air-frequency sparkle"],
    emotionalPurpose: "Dominance.",
    bestFor: ["Anthem Records", "High-Energy Trap", "Victory Music", "Beat Switch Moments"],
    sonicReferences: ["Electrical storms", "Arena lights", "Divine voltage"],
    keyBehavior: ["Velocity creates transient sparks", "Fast playing widens stereo field", "Repeated notes trigger harmonic arcs"],
    macroBehavior: {
      energy: "Sharpens attack and adds electrical transient sparks",
      divinity: "Adds white lightning shimmer and electric upper harmonics",
      width: "Adds fast stereo sparks and wide attack flashes",
      realm: "Morphs FM EP into lightning-charged anthem keys",
      aura: "Storm field",
      age: "Unstable voltage",
    },
    profile: {
      element: "Lightning",
      domain: "Power",
      energy: "Explosive",
      mood: "Dominant",
      quote: "Strike first. Shake the room.",
    },
    colors: {
      primary: "#4ecbff",
      secondary: "#071829",
      accent: "#ffffff",
    },
    realmFx: ["Storm Delay", "Lightning Transient", "Voltage Chorus", "Thunder Saturation"],
  },
  {
    id: "athena",
    name: "ATHENA",
    title: "Intelligence With Soul",
    tone: ["Neo-soul EP core", "Jazz chord enhancement", "Midrange richness", "Soft tape warmth"],
    emotionalPurpose: "Sophisticated emotion.",
    bestFor: ["Neo Soul", "Jazz Rap", "R&B", "Deep Songwriting"],
    sonicReferences: ["Rooftop jazz bars", "Late-night writing sessions", "Velvet studio lighting"],
    keyBehavior: ["Chords intelligently bloom", "Extensions shimmer softly", "Optional humanized timing drift"],
    macroBehavior: {
      energy: "Adds chord bloom and upper-mid articulation",
      divinity: "Adds intelligent chord aura and smooth jazz extension glow",
      width: "Adds balanced neo-soul spread while preserving chord clarity",
      realm: "Morphs warm EP into intelligent neo-soul oracle keys",
      aura: "Intimate studio / jazz room",
      age: "Clean tape warmth",
    },
    profile: {
      element: "Wisdom",
      domain: "Strategy",
      energy: "Focused",
      mood: "Sophisticated",
      quote: "Make the chords speak.",
    },
    colors: {
      primary: "#9d65ff",
      secondary: "#1a1029",
      accent: "#f8d786",
    },
    realmFx: ["Oracle Room", "Jazz Bloom", "Velvet Chorus", "Chord Halo"],
  },
  {
    id: "poseidon",
    name: "POSEIDON",
    title: "Liquid Memory",
    tone: ["Ambient EP", "Liquid tremolo", "Underwater chorus", "Deep atmospheric tails"],
    emotionalPurpose: "Floating through memory.",
    bestFor: ["Ambient Trap", "Emotional Interludes", "Dream Sequences", "Psychedelic Production"],
    sonicReferences: ["Underwater cities", "Moonlight oceans", "Drifting through space"],
    keyBehavior: ["Stereo moves like waves", "Modulation breathes naturally", "Notes evolve while sustaining"],
    macroBehavior: {
      energy: "Increases wave motion and liquid pulse",
      divinity: "Adds aquatic shimmer and distant oceanic reflections",
      width: "Adds wave-like side motion and drifting field movement",
      realm: "Morphs ambient EP into underwater memory instrument",
      aura: "Underwater temple",
      age: "Water-worn memory",
    },
    profile: {
      element: "Water",
      domain: "Memory",
      energy: "Fluid",
      mood: "Reflective",
      quote: "Let the memory move.",
    },
    colors: {
      primary: "#29d7e8",
      secondary: "#05242d",
      accent: "#9ff6ff",
    },
    realmFx: ["Oceanic Reverb", "Liquid Tremolo", "Tidal Chorus", "Deep Current"],
  },
  {
    id: "titan",
    name: "TITAN",
    title: "Massive Cinematic Force",
    tone: ["Layered octave keys", "Cinematic low end", "Hybrid piano/synth body", "Huge reverb chambers"],
    emotionalPurpose: "Scale.",
    bestFor: ["Movie Trailers", "Stadium Records", "Emotional Climax", "Orchestral Trap"],
    sonicReferences: ["Giant structures", "Collapsing worlds", "IMAX sound design"],
    keyBehavior: ["Chords stack dynamically", "Bass harmonics grow with sustain", "Velocity increases perceived size"],
    macroBehavior: {
      energy: "Adds octave weight, sub-body, and cinematic impact",
      divinity: "Adds giant harmonic lift and choir-like thickness",
      width: "Adds massive cinematic stage width",
      realm: "Morphs hybrid piano/EP into colossal cinematic force",
      aura: "Giant cinematic arena",
      age: "Ancient stone chamber",
    },
    profile: {
      element: "Stone",
      domain: "Scale",
      energy: "Massive",
      mood: "Epic",
      quote: "Make the room feel small.",
    },
    colors: {
      primary: "#ff9f2f",
      secondary: "#211307",
      accent: "#ffd18a",
    },
    realmFx: ["Colossal Hall", "Impact Layer", "Stone Chorus", "Giant Glue"],
  },
  {
    id: "apollo",
    name: "APOLLO",
    title: "The Oracle Of Melody",
    tone: ["Bell-like EP", "High-end shimmer", "Crystal harmonics", "Airy sustain"],
    emotionalPurpose: "Pure melody.",
    bestFor: ["Hooks", "Emotional Toplines", "Melodic Rap", "Anthem Choruses"],
    sonicReferences: ["Celestial bells", "Sunrise reflections", "Emotional revelation"],
    keyBehavior: ["Upper harmonics glow on sustain", "High notes produce angelic layers", "Melody phrases trigger ambience"],
    macroBehavior: {
      energy: "Increases bell clarity and melodic shimmer",
      divinity: "Adds crystal bell halo and emotional hook glow",
      width: "Adds airy melodic spread and high-end shimmer on sides",
      realm: "Morphs bell EP into celestial hook machine",
      aura: "Golden sunrise chamber",
      age: "Timeless crystal glow",
    },
    profile: {
      element: "Sun",
      domain: "Melody",
      energy: "Radiant",
      mood: "Hopeful",
      quote: "Find the hook inside the light.",
    },
    colors: {
      primary: "#ffd45a",
      secondary: "#281c08",
      accent: "#fff4bd",
    },
    realmFx: ["Sunrise Reverb", "Crystal Delay", "Melody Halo", "Angelic Shimmer"],
  },
  {
    id: "chronos",
    name: "CHRONOS",
    title: "Time Is Breaking",
    tone: ["Granular electric piano", "Reverse textures", "Time-stretched harmonics", "Ghost ambience"],
    emotionalPurpose: "Disorientation plus transcendence.",
    bestFor: ["Experimental Trap", "Psychedelic Hip-Hop", "Transitions", "Futuristic Soundtracks"],
    sonicReferences: ["Broken timelines", "Memories folding", "Slowed reality"],
    keyBehavior: ["Notes leave time trails", "Reverse harmonics emerge dynamically", "Sustain introduces temporal drift"],
    macroBehavior: {
      energy: "Adds glitch trails, reverse movement, and time smear",
      divinity: "Adds ghost harmonics and delayed memory trails",
      width: "Adds fractured stereo time trails and offset ghosts",
      realm: "Morphs EP into reverse/granular time-warped instrument",
      aura: "Fractured timeline space",
      age: "Time decay and reverse dust",
    },
    profile: {
      element: "Time",
      domain: "Memory",
      energy: "Unstable",
      mood: "Dreamlike",
      quote: "Play the moment before it happens.",
    },
    colors: {
      primary: "#7cff9d",
      secondary: "#06190d",
      accent: "#d9ffe2",
    },
    realmFx: ["Time Smear", "Reverse Delay", "Granular Halo", "Memory Drift"],
  },
];
```

---

# 19. Antigravity Implementation Prompt

Copy this section directly into Antigravity.

```txt
We are adding a new VST GOD module called Electric Pantheon.

Electric Pantheon is a pantheon-based electric keys system. It should feel like a flagship instrument mode inside the existing VST GOD / The God Realm interface.

Do not rebuild the whole app. Integrate this into the current Antigravity standalone UI.

The visible face controls are locked and must remain exactly:
ENERGY, DIVINITY, WIDTH, REALM.

Do not add AGE, AURA, Tone, Motion, Noise, Space, or extra macro knobs to the main face.

AGE and AURA are secondary depth controls only:
X/Y Vortex X-axis = AURA
X/Y Vortex Y-axis = AGE / INSTABILITY

Create the Electric Pantheon mode with these first 8 gods:
1. Olympus — Luxury Above The Clouds
2. Hades — The Beautiful Underworld
3. Zeus — Lightning In Human Form
4. Athena — Intelligence With Soul
5. Poseidon — Liquid Memory
6. Titan — Massive Cinematic Force
7. Apollo — The Oracle Of Melody
8. Chronos — Time Is Breaking

Each god should have:
- name
- title
- tone description
- emotional purpose
- best-for tags
- key behavior
- macro behavior mapping for ENERGY, DIVINITY, WIDTH, REALM
- AURA and AGE hidden behavior
- god profile panel
- realm FX names
- color palette

UI layout:
- Top bar remains VST GOD / The God Realm style.
- Add or prioritize ELECTRIC PANTHEON as a major mode/tab.
- Left panel shows the 8 gods as selectable deity cards.
- Center top shows Global Macros: ENERGY / DIVINITY / WIDTH / REALM.
- Center hero shows selected god art/realm area, god name, tagline, short description, and sound chips.
- Right panel shows God Profile: Element, Domain, Energy, Mood, Best For, Quote.
- Bottom left shows X/Y Vortex with X=AURA and Y=AGE/INSTABILITY.
- Bottom center shows Realm FX adapted to the selected god.
- Bottom right shows ALS Vision reacting to macro changes.
- Bottom remains keyboard/performance/engine status where appropriate.

Design direction:
- dark luxury interface
- black/gold base for Olympus
- glass/metal/chrome panels
- cinematic glow
- premium VST instrument feeling
- mythological electric-key identity
- no flat white canvas
- preserve the God Realm visual language

Implementation priorities:
1. Preserve current app stability.
2. Create data-driven god configuration.
3. Lock Global Macros to ENERGY / DIVINITY / WIDTH / REALM.
4. Make the UI update when selecting a god.
5. Let each god reinterpret the same four macros.
6. Map X/Y Vortex to hidden AURA and AGE controls.
7. Make Realm FX labels change per god.
8. Add ALS Vision visual feedback based on macro values.
9. Keep low-end mono-safe when WIDTH increases.
10. Use gain compensation so ENERGY and DIVINITY do not simply increase volume.

Do not overcomplicate the user-facing interface. The main experience should feel powerful, clean, and playable.
```

---

# 20. Build Order

## Phase 1 — Data Lock

- Create `electricPantheonGods` config.
- Create `pantheonMacros` config.
- Confirm visible macros are only ENERGY, DIVINITY, WIDTH, REALM.

## Phase 2 — UI Integration

- Add Electric Pantheon mode/tab.
- Add left-side deity selector.
- Add selected god hero panel.
- Add God Profile panel.
- Connect Realm FX labels to selected god.

## Phase 3 — Macro Behavior

- ENERGY changes internal intensity behavior.
- DIVINITY changes harmonic/halo behavior.
- WIDTH changes stereo/space behavior with mono-safe low end.
- REALM changes god identity depth.
- X/Y Vortex maps to AURA and AGE.

## Phase 4 — Visual Feedback

- ALS Vision responds to macro movement.
- God color palette updates with selected deity.
- Realm visual intensity follows REALM.

## Phase 5 — Sound Engine Mapping

- Connect macros to actual DSP/audio params.
- Add gain compensation.
- Add stereo safety.
- Add per-god FX profiles.

---

# 21. Non-Negotiables

```txt
ENERGY / DIVINITY / WIDTH / REALM are locked as the visible face controls.
```

```txt
AURA and AGE are hidden/performance depth controls, not main face knobs.
```

```txt
Every god uses the same macro names but interprets them differently.
```

```txt
The interface must preserve Flow: powerful, clear, minimal, and playable.
```

```txt
Do not flatten the God Realm aesthetic.
```

```txt
Do not make this feel like a normal preset browser.
```

```txt
This is a playable mythology system.
```

---

# 22. Final Direction

The Electric Pantheon should make VST GOD feel like a premium flagship instrument.

The producer should not feel like they are browsing presets.

They should feel like they are choosing which god enters the session.

