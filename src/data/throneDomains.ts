/**
 * throneDomains.ts — The Sixteen Throne Domains of the Astral Dais
 *
 * Each throne channels a domain of sonic creation.
 * Sigil images are premium-generated divine runes stored in /images/sigils/.
 */

export interface ThroneDomain {
  id: number;
  name: string;
  sigil: string;          // emoji fallback
  sigilImage: string;     // path to generated PNG
  color: string;          // hex color for the throne's aura
  sonicRole: string;      // suggested sample type
  lore: string;           // mythological description
  defaultMidiNote: number; // C1=36 through D#2=51
}

export const THRONE_DOMAINS: ThroneDomain[] = [
  {
    id: 0, name: 'Thunder', sigil: '⚡', color: '#FFD700',
    sigilImage: '/images/sigils/sigil_01_thunder.png',
    sonicRole: 'Kick / Impact',
    lore: 'The first sound — Zeus strikes the void',
    defaultMidiNote: 36, // C1
  },
  {
    id: 1, name: 'Tides', sigil: '🌊', color: '#00BFA5',
    sigilImage: '/images/sigils/sigil_02_tides.png',
    sonicRole: 'Sub Bass',
    lore: "Poseidon's depths shape the low end",
    defaultMidiNote: 37, // C#1
  },
  {
    id: 2, name: 'Inferno', sigil: '🔥', color: '#FF3D00',
    sigilImage: '/images/sigils/sigil_03_inferno.png',
    sonicRole: 'Distorted / Saturated',
    lore: 'Hephaestus forges in fire',
    defaultMidiNote: 38, // D1
  },
  {
    id: 3, name: 'Crystal', sigil: '💎', color: '#AA00FF',
    sigilImage: '/images/sigils/sigil_04_crystal.png',
    sonicRole: 'Hi-Hat / Metallic',
    lore: "Athena's crystalline clarity",
    defaultMidiNote: 39, // D#1
  },
  {
    id: 4, name: 'Eden', sigil: '🌿', color: '#00E676',
    sigilImage: '/images/sigils/sigil_05_eden.png',
    sonicRole: 'Nature / Organic',
    lore: "Demeter's living earth",
    defaultMidiNote: 40, // E1
  },
  {
    id: 5, name: 'Celestial', sigil: '☁️', color: '#B0BEC5',
    sigilImage: '/images/sigils/sigil_06_celestial.png',
    sonicRole: 'Pad / Atmosphere',
    lore: 'The heavens breathe',
    defaultMidiNote: 41, // F1
  },
  {
    id: 6, name: 'Starlight', sigil: '⭐', color: '#2979FF',
    sigilImage: '/images/sigils/sigil_07_starlight.png',
    sonicRole: 'Pluck / Bell',
    lore: 'Points of light in the cosmic dark',
    defaultMidiNote: 42, // F#1
  },
  {
    id: 7, name: 'Eclipse', sigil: '🌙', color: '#5C6BC0',
    sigilImage: '/images/sigils/sigil_08_eclipse.png',
    sonicRole: 'Dark Texture',
    lore: 'What the moon hides',
    defaultMidiNote: 43, // G1
  },
  {
    id: 8, name: 'Trident', sigil: '🔱', color: '#FF6D00',
    sigilImage: '/images/sigils/sigil_09_trident.png',
    sonicRole: 'Percussion / Rim',
    lore: 'The weapon that commands rhythm',
    defaultMidiNote: 44, // G#1
  },
  {
    id: 9, name: 'Olympus', sigil: '🏛️', color: '#ECEFF1',
    sigilImage: '/images/sigils/sigil_10_olympus.png',
    sonicRole: 'Keys / Piano',
    lore: 'The pillars of harmony',
    defaultMidiNote: 45, // A1
  },
  {
    id: 10, name: 'Oracle', sigil: '👁️', color: '#FF80AB',
    sigilImage: '/images/sigils/sigil_11_oracle.png',
    sonicRole: 'Vocal / Choir',
    lore: 'The voice that sees the future',
    defaultMidiNote: 46, // A#1
  },
  {
    id: 11, name: 'Wrath', sigil: '⚔️', color: '#8D6E63',
    sigilImage: '/images/sigils/sigil_12_wrath.png',
    sonicRole: 'Impact FX / Riser',
    lore: "Ares' fury unleashed",
    defaultMidiNote: 47, // B1
  },
  {
    id: 12, name: 'Elysium', sigil: '🌸', color: '#69F0AE',
    sigilImage: '/images/sigils/sigil_13_elysium.png',
    sonicRole: 'Melodic / Chord',
    lore: 'Paradise in sound',
    defaultMidiNote: 48, // C2
  },
  {
    id: 13, name: 'Leviathan', sigil: '🐉', color: '#78909C',
    sigilImage: '/images/sigils/sigil_14_leviathan.png',
    sonicRole: '808 / Deep Bass',
    lore: 'The beast beneath the waves',
    defaultMidiNote: 49, // C#2
  },
  {
    id: 14, name: 'Vortex', sigil: '🌀', color: '#FFB300',
    sigilImage: '/images/sigils/sigil_15_vortex.png',
    sonicRole: 'Glitch / Stutter',
    lore: 'Time fractures around the spiral',
    defaultMidiNote: 50, // D2
  },
  {
    id: 15, name: 'Sovereign', sigil: '👑', color: '#FFC400',
    sigilImage: '/images/sigils/sigil_16_sovereign.png',
    sonicRole: 'Lead / Master',
    lore: 'The final throne — the one who commands all',
    defaultMidiNote: 51, // D#2
  },
];

/** Default MIDI note mapping — standard MPC layout C1-D#2 */
export const DEFAULT_MIDI_MAP: number[] = THRONE_DOMAINS.map(d => d.defaultMidiNote);

/** Get throne index from MIDI note, given current mapping */
export function midiNoteToThrone(note: number, midiMap: number[]): number {
  return midiMap.indexOf(note);
}
