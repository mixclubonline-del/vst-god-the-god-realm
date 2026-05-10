# Divine Archive Hall Of Records Design

Date: 2026-05-10
Mode: Dream approved, execution-ready
Target: Standalone God Realm repo

## Purpose

The Divine Archive becomes the sacred sound vault of The God Realm: a Hall of Records where every one-shot is presented as a sound artifact, organized by mythic rooms generated from the current 713-sample library.

This is not a decorative reskin of a file browser. The archive must stay fast enough for production work while making auditioning and loading sounds feel like awakening and recalling relics into the Multi-Realm engine.

## Current Ground Truth

- The standalone app loads the real library from `public/library_manifest.json`.
- The library contains 713 samples across 20 source categories.
- `src/components/CelestialBrowser.tsx` already supports category browsing, search, favorites, audition, list/grid modes, and loading to the active pad.
- `src/components/HallOfRecords.tsx` contains an older Akashic visual direction with shelves, aura, and artifact language, but it currently reads `public/akashic_manifest.json`, which only covers 105 samples and uses stale `/samples/...` paths.
- The implementation should build on `CelestialBrowser` and reuse the useful Hall of Records ideas without switching to the stale Akashic manifest as source of truth.

## Product Identity

Primary identity: sacred library of sound artifacts.

Core language:

- Samples are sound relics.
- Categories remain technical metadata.
- Mythic rooms are the primary browsing model.
- Audition means awaken.
- Load to pad means recall.
- Favorites become marked relics.
- Recent loads become recent recalls.

## Visual Direction

Reference language from Prime's VST God imagery:

- Obsidian and carved-stone panel base from the mastering reference.
- Gold-orange glow for primary energy, active states, and recall actions.
- Purple/magenta spectral accents for waveform, aura, and magical resonance.
- Dense pro-audio information layout from the Multi-Realm and Preset Vault screens.
- Heroic God Realm presence without turning the archive into a poster.

The archive should feel like a premium instrument surface, not a marketing page.

## V1 Layout

### Left: Mythic Rooms

Primary navigation by generated rooms:

- Olympus
- Underworld
- Sun Disk
- Void
- Temple
- Storm
- Celestial Choir
- Forge
- Abyss
- Eden

Each room displays:

- Name
- Relic count
- Short room tone label
- Active glow state

### Center: Artifact Shelves

The main area shows filtered relics as dense artifact cards or list rows.

Each relic displays:

- Sample name
- Mythic room
- Original source category
- Format badge
- Favorite mark
- Audition state
- Recall action

The layout should support both:

- Shelf view: cinematic card/tome presentation.
- List view: fast producer scanning.

### Right: Artifact Inspector

Selecting a relic opens an inspector with:

- Relic name
- Original category
- Generated mythic room
- Generated tags
- Audio format
- Path validity status
- Favorite toggle
- Awaken preview action
- Recall to active pad action
- Aura or waveform preview area

### Bottom: Recall Strip

The bottom strip shows:

- Active pad target
- Recent recalls
- Audition status
- Quick filter chips
- Library stats

## Manifest Strategy

Create a generated archive manifest from `public/library_manifest.json`.

Output file:

`public/divine_archive_manifest.json`

Each generated relic should include:

- `id`
- `name`
- `path`
- `format`
- `sourceCategory`
- `room`
- `tags`
- `tone`
- `weight`

Every sample from `public/library_manifest.json` must appear exactly once in the generated manifest.

## Room Generation Rules

Initial room assignment is deterministic and rule-based.

Example mapping:

- Olympus: heroic, brass, lead, bright, triumph, god, zeus, olympus
- Underworld: bass, dark, low, fatal, abyss, doom, heavy, grim
- Sun Disk: keys, bell, warm, glow, golden, sun, bright, air
- Void: fx, texture, space, glitch, alien, riser, drone
- Temple: ethnic, organ, pluck, acoustic, ritual, ancient
- Storm: transient, strike, thunder, electric, voltage, impact
- Celestial Choir: vox, choir, strings, pad, heavenly, angelic
- Forge: analog, synth, modulated, circuit, drive, machine
- Abyss: horror, distorted, shadow, night, terrifying, deep
- Eden: guitar, soft, lush, organic, gentle, rain, garden

Fallback behavior:

- If no strong rule matches, assign by source category.
- If still ambiguous, assign to Olympus as the general divine room.

## Interaction Model

Primary actions:

- Click relic: select and awaken preview.
- Double click relic: recall to active pad.
- Recall button: load into active pad.
- Favorite button: mark relic.
- Room click: filter to room.
- Search: matches name, room, category, and generated tags.

Keyboard targets for a later pass:

- Arrow keys move selection.
- Space awakens preview.
- Enter recalls to active pad.
- Number keys set active pad target when supported by the parent shell.

## Audio Behavior

V1 should fix the current optimistic preview state:

- The archive should know when preview playback ends.
- Clicking the current playing relic should stop preview playback.
- Starting a new preview should stop the previous preview.
- Preview failures should show a quiet error state on the relic and inspector.

`SamplerEngine.previewSample` may need to return a small playback controller or emit preview lifecycle callbacks.

## Integration Points

Main component:

- Keep `CelestialBrowser` as the routed Divine Archive tab unless a rename is done intentionally.

Engine:

- Continue using `engineRef.current.loadSampleByPath(path, activePad)`.
- Upgrade preview handling so UI state follows real audio state.

Parent plugin:

- Pass a load callback if pad metadata needs to update outside the audio buffer.
- Preserve the existing standalone `VstgodthegodrealmPlugin` tab structure.

Assets:

- Reuse existing `public/plugins/god-realm.png`, `god-realm-hero.png`, kit images, and effects imagery only where they help the archive.
- Do not block V1 on new generated art.

## Acceptance Criteria

- Divine Archive opens from the standalone app without console errors.
- All 713 current samples are represented in `divine_archive_manifest.json`.
- Every generated relic path fetches successfully from the dev server.
- Mythic rooms are visible as the primary navigation.
- Search works across relic name, room, source category, and generated tags.
- Favorites persist in local storage.
- Audition plays the selected relic and clears/updates state when playback ends.
- Recall loads the selected relic into the active pad.
- The UI visually matches the God Realm language: obsidian base, gold-orange divine energy, purple spectral accents, dense pro-audio layout.
- Build passes with `npm run build`.

## Pressure Pass

- Verify empty room, no search results, failed audio fetch, and failed manifest states.
- Verify the archive remains usable at laptop width and does not overlap text.
- Verify list rendering remains smooth with 713 relics.
- Verify stale `akashic_manifest.json` does not become the active source of truth.
- Verify no placeholder copy ships in the interface.

## Beyond V1

- Real waveform peak generation for every relic.
- Acoustic fingerprinting for energy, decay, brightness, and similarity.
- Drag relics directly to pads.
- Smart kit builder from selected rooms.
- Similar relic recommendations.
- User-refined room overrides saved locally or exported as kit metadata.
- Signed archive packs through Prime Fabric, with Studio consuming only signed artifacts.
