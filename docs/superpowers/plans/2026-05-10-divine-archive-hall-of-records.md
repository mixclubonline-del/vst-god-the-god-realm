# Divine Archive Hall Of Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Divine Archive into a Hall of Records: a sacred artifact library generated from the real 713-sample VST God archive, with mythic rooms, relic inspection, reliable preview state, and recall-to-pad workflow.

**Architecture:** Keep `public/library_manifest.json` as the source of truth and generate `public/divine_archive_manifest.json` deterministically. Keep `CelestialBrowser` as the routed Divine Archive component, but refactor it around mythic rooms, relic data, an inspector, and preview lifecycle state. Upgrade `SamplerEngine.previewSample` so the UI can stop previews and clear playing state when audio ends.

**Tech Stack:** React 19, TypeScript strict mode, Vite, Web Audio API, local Node ESM scripts, existing lucide-react/framer-motion styling.

---

## File Structure

- Create: `scripts/generate-divine-archive-manifest.mjs`
  - Reads `public/library_manifest.json`.
  - Generates `public/divine_archive_manifest.json`.
  - Applies deterministic mythic room/category/tag rules.
- Create: `scripts/validate-divine-archive-manifest.mjs`
  - Verifies every source sample appears exactly once.
  - Verifies every generated path exists on disk.
  - Verifies room/tag/search fields are non-empty.
- Create: `src/archive/divineArchive.ts`
  - Shared TypeScript types and room metadata.
  - Pure helpers for filtering, sorting, counts, and selected relic fallback.
- Modify: `package.json`
  - Add archive generation and validation scripts.
- Modify: `src/engine/samplerEngine.ts`
  - Add preview lifecycle controller.
  - Add `stopPreview()`.
  - Return preview controller from `previewSample(path)`.
- Modify: `src/components/CelestialBrowser.tsx`
  - Replace category-first archive with Hall of Records room-first UI.
  - Use generated `divine_archive_manifest.json`.
  - Add relic inspector, recall strip, room navigation, and search across name/room/category/tags.
- Modify: `src/styles/index.css`
  - Add Hall of Records visual language: obsidian panels, gold recall states, purple aura accents, responsive shell.

---

## Task 1: Generated Divine Archive Manifest

**Files:**
- Create: `scripts/generate-divine-archive-manifest.mjs`
- Create: `scripts/validate-divine-archive-manifest.mjs`
- Modify: `package.json`
- Generate: `public/divine_archive_manifest.json`

- [ ] **Step 1: Create the generator script**

Create `scripts/generate-divine-archive-manifest.mjs` with this content:

```js
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'public', 'library_manifest.json');
const outputPath = path.join(root, 'public', 'divine_archive_manifest.json');

const ROOM_DEFINITIONS = [
  { id: 'olympus', name: 'Olympus', tone: 'Heroic command', categories: ['Real Brass', 'Leads', 'Synth Brass'], keywords: ['hero', 'brass', 'lead', 'bright', 'triumph', 'god', 'zeus', 'olympus', 'strike'] },
  { id: 'underworld', name: 'Underworld', tone: 'Low shadow power', categories: ['Bass'], keywords: ['bass', 'dark', 'low', 'fatal', 'abyss', 'doom', 'heavy', 'grim', 'sub'] },
  { id: 'sun-disk', name: 'Sun Disk', tone: 'Radiant harmonic glow', categories: ['Keys', 'Bell'], keywords: ['sun', 'gold', 'golden', 'warm', 'glow', 'bright', 'air', 'piano', 'key', 'bell', 'vibra'] },
  { id: 'void', name: 'Void', tone: 'Space, glitch, and absence', categories: ['FX', 'Texture'], keywords: ['fx', 'space', 'glitch', 'alien', 'riser', 'drone', 'atmos', 'circuit', 'broken', 'signal'] },
  { id: 'temple', name: 'Temple', tone: 'Ritual acoustic memory', categories: ['Ethnic', 'Organ', 'Pluck'], keywords: ['ethnic', 'organ', 'pluck', 'ritual', 'ancient', 'temple', 'marimba', 'acoustic'] },
  { id: 'storm', name: 'Storm', tone: 'Transient voltage and motion', categories: ['Accents'], keywords: ['storm', 'thunder', 'electric', 'voltage', 'impact', 'zap', 'strike', 'transient', 'hit'] },
  { id: 'celestial-choir', name: 'Celestial Choir', tone: 'Heavenly voices and strings', categories: ['Vox', 'Strings', 'Pads'], keywords: ['vox', 'choir', 'string', 'pad', 'heaven', 'angel', 'airy', 'choir', 'voice'] },
  { id: 'forge', name: 'Forge', tone: 'Analog fire and machine craft', categories: ['Analog', 'Synth', 'Modulated'], keywords: ['analog', 'synth', 'modulated', 'machine', 'drive', 'tube', 'juno', 'circuit', 'wave'] },
  { id: 'abyss', name: 'Abyss', tone: 'Horror, pressure, and depth', categories: [], keywords: ['horror', 'shadow', 'night', 'terrifying', 'deep', 'abyss', 'darkness', 'venom', 'riot'] },
  { id: 'eden', name: 'Eden', tone: 'Organic light and living texture', categories: ['Guitar', 'Wind'], keywords: ['guitar', 'wind', 'soft', 'lush', 'organic', 'gentle', 'rain', 'garden', 'flute'] }
];

const CATEGORY_FALLBACK = new Map(
  ROOM_DEFINITIONS.flatMap((room) => room.categories.map((category) => [category, room]))
);

const normalize = (value) => value.toLowerCase().replace(/[_-]+/g, ' ');
const slug = (value) => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stableId = (sourceCategory, name, index) =>
  crypto.createHash('sha1').update(`${sourceCategory}:${name}:${index}`).digest('hex').slice(0, 12);

const inferRoom = (sourceCategory, name) => {
  const haystack = `${normalize(sourceCategory)} ${normalize(name)}`;
  const scored = ROOM_DEFINITIONS.map((room) => {
    const categoryScore = room.categories.includes(sourceCategory) ? 3 : 0;
    const keywordScore = room.keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 2 : 0), 0);
    return { room, score: categoryScore + keywordScore };
  }).sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) return scored[0].room;
  return CATEGORY_FALLBACK.get(sourceCategory) || ROOM_DEFINITIONS[0];
};

const inferTags = (sourceCategory, sampleName, room) => {
  const base = new Set([slug(sourceCategory), slug(room.name)]);
  const words = normalize(sampleName).split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
  for (const word of words.slice(0, 4)) base.add(word);
  for (const keyword of room.keywords) {
    if (normalize(sampleName).includes(keyword)) base.add(slug(keyword));
  }
  return [...base].filter(Boolean).slice(0, 8);
};

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const relics = [];

for (const [sourceCategory, samples] of Object.entries(source.categories)) {
  samples.forEach((sample, index) => {
    const room = inferRoom(sourceCategory, sample.name);
    relics.push({
      id: stableId(sourceCategory, sample.name, index),
      name: sample.name,
      path: sample.path,
      format: sample.format || path.extname(sample.path).slice(1).toLowerCase(),
      sourceCategory,
      room: room.id,
      roomName: room.name,
      tags: inferTags(sourceCategory, sample.name, room),
      tone: room.tone,
      weight: 1
    });
  });
}

const manifest = {
  name: 'Divine Archive - Hall of Records',
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  sourceManifest: 'library_manifest.json',
  sourceTotalSamples: source.totalSamples,
  totalRelics: relics.length,
  rooms: ROOM_DEFINITIONS.map((room) => ({
    id: room.id,
    name: room.name,
    tone: room.tone,
    keywords: room.keywords
  })),
  relics
};

fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${manifest.totalRelics} Divine Archive relics at ${path.relative(root, outputPath)}`);
```

- [ ] **Step 2: Create the validation script**

Create `scripts/validate-divine-archive-manifest.mjs` with this content:

```js
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'public', 'library_manifest.json'), 'utf8'));
const archive = JSON.parse(fs.readFileSync(path.join(root, 'public', 'divine_archive_manifest.json'), 'utf8'));

const sourceSamples = Object.entries(source.categories).flatMap(([sourceCategory, samples]) =>
  samples.map((sample) => `${sourceCategory}::${sample.name}::${sample.path}`)
);
const archiveSamples = archive.relics.map((relic) => `${relic.sourceCategory}::${relic.name}::${relic.path}`);

assert.equal(archive.totalRelics, source.totalSamples, 'totalRelics must equal source totalSamples');
assert.equal(archive.relics.length, sourceSamples.length, 'archive relic count must equal source sample count');
assert.deepEqual([...archiveSamples].sort(), [...sourceSamples].sort(), 'archive must contain every source sample exactly once');

const ids = new Set();
for (const relic of archive.relics) {
  assert.ok(relic.id, `missing id for ${relic.name}`);
  assert.ok(!ids.has(relic.id), `duplicate id ${relic.id}`);
  ids.add(relic.id);
  assert.ok(relic.room, `missing room for ${relic.name}`);
  assert.ok(relic.roomName, `missing roomName for ${relic.name}`);
  assert.ok(relic.sourceCategory, `missing sourceCategory for ${relic.name}`);
  assert.ok(Array.isArray(relic.tags) && relic.tags.length >= 2, `missing tags for ${relic.name}`);
  assert.ok(fs.existsSync(path.join(root, 'public', relic.path.replace(/^\//, ''))), `missing audio file ${relic.path}`);
}

const roomIds = new Set(archive.rooms.map((room) => room.id));
for (const relic of archive.relics) {
  assert.ok(roomIds.has(relic.room), `relic ${relic.name} references unknown room ${relic.room}`);
}

console.log(`Divine Archive manifest valid: ${archive.relics.length} relics across ${archive.rooms.length} rooms`);
```

- [ ] **Step 3: Add package scripts**

Modify `package.json` scripts to include:

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "generate:archive": "node scripts/generate-divine-archive-manifest.mjs",
  "validate:archive": "node scripts/validate-divine-archive-manifest.mjs"
}
```

- [ ] **Step 4: Generate and validate**

Run:

```bash
npm run generate:archive
npm run validate:archive
```

Expected:

```text
Generated 713 Divine Archive relics at public/divine_archive_manifest.json
Divine Archive manifest valid: 713 relics across 10 rooms
```

---

## Task 2: Archive Types And Pure Helpers

**Files:**
- Create: `src/archive/divineArchive.ts`

- [ ] **Step 1: Create shared archive helper module**

Create `src/archive/divineArchive.ts` with this content:

```ts
export interface DivineRoom {
  id: string;
  name: string;
  tone: string;
  keywords: string[];
}

export interface DivineRelic {
  id: string;
  name: string;
  path: string;
  format: string;
  sourceCategory: string;
  room: string;
  roomName: string;
  tags: string[];
  tone: string;
  weight: number;
}

export interface DivineArchiveManifest {
  name: string;
  version: string;
  generatedAt: string;
  sourceManifest: string;
  sourceTotalSamples: number;
  totalRelics: number;
  rooms: DivineRoom[];
  relics: DivineRelic[];
}

export type ArchiveViewMode = 'shelf' | 'list';

export const getRoomCount = (relics: DivineRelic[], roomId: string): number =>
  relics.filter((relic) => relic.room === roomId).length;

export const matchesArchiveQuery = (relic: DivineRelic, query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [
    relic.name,
    relic.roomName,
    relic.sourceCategory,
    relic.format,
    ...relic.tags
  ].join(' ').toLowerCase();
  return haystack.includes(normalized);
};

export const filterRelics = (
  relics: DivineRelic[],
  roomId: string,
  query: string,
  favoritePaths: Set<string>
): DivineRelic[] => {
  const roomFiltered = roomId === 'favorites'
    ? relics.filter((relic) => favoritePaths.has(relic.path))
    : roomId === 'all'
      ? relics
      : relics.filter((relic) => relic.room === roomId);

  return roomFiltered.filter((relic) => matchesArchiveQuery(relic, query));
};

export const pickSelectedRelic = (
  current: DivineRelic | null,
  visibleRelics: DivineRelic[]
): DivineRelic | null => {
  if (current && visibleRelics.some((relic) => relic.id === current.id)) return current;
  return visibleRelics[0] ?? null;
};

export const roomAccent = (roomId: string): string => {
  const accents: Record<string, string> = {
    olympus: '#ff8a3d',
    underworld: '#d13f3f',
    'sun-disk': '#ffcc66',
    void: '#9b5cff',
    temple: '#c29623',
    storm: '#ff5c7a',
    'celestial-choir': '#d8b4ff',
    forge: '#ff6600',
    abyss: '#7f1d1d',
    eden: '#6ee7b7',
    favorites: '#ff6600',
    all: '#f8ddd2'
  };
  return accents[roomId] || '#ff6600';
};
```

- [ ] **Step 2: Type-check helper module**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: no TypeScript errors.

---

## Task 3: Preview Lifecycle In The Sampler Engine

**Files:**
- Modify: `src/engine/samplerEngine.ts`

- [ ] **Step 1: Add preview controller types and state near the top of `samplerEngine.ts`**

Add this exported interface after existing imports/types:

```ts
export interface SamplePreviewController {
  path: string;
  stop: () => void;
  finished: Promise<void>;
}
```

Add this private field inside `SamplerEngine`:

```ts
private activePreview: AudioBufferSourceNode | null = null;
```

- [ ] **Step 2: Replace `previewSample` and add `stopPreview`**

Replace the current `previewSample` method with:

```ts
public stopPreview(): void {
  if (!this.activePreview) return;
  const preview = this.activePreview;
  this.activePreview = null;
  try {
    preview.onended = null;
    preview.stop();
  } catch {
    // The source may already be stopped; clearing activePreview is still correct.
  }
  try {
    preview.disconnect();
  } catch {
    // Disconnect can fail after the node has already been released.
  }
}

public async previewSample(path: string): Promise<SamplePreviewController | null> {
  if (!this.ctx || !this.masterGain) return null;
  if (this.ctx.state === 'suspended') await this.ctx.resume();

  this.stopPreview();

  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to fetch preview ${path}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arrayBuffer);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGain);
    this.activePreview = source;

    let resolveFinished!: () => void;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    source.onended = () => {
      if (this.activePreview === source) this.activePreview = null;
      try {
        source.disconnect();
      } catch {
        // Source may already be disconnected by stopPreview.
      }
      resolveFinished();
    };

    source.start(0);

    return {
      path,
      finished,
      stop: () => {
        if (this.activePreview === source) {
          this.stopPreview();
          resolveFinished();
        }
      }
    };
  } catch (err) {
    console.error('Audition Failed:', err);
    return null;
  }
}
```

- [ ] **Step 3: Stop previews during dispose**

At the beginning of `dispose()`, after aborting any controller, add:

```ts
this.stopPreview();
```

- [ ] **Step 4: Verify TypeScript**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: no TypeScript errors.

---

## Task 4: Hall Of Records Component Refactor

**Files:**
- Modify: `src/components/CelestialBrowser.tsx`

- [ ] **Step 1: Update imports and types**

Use `src/archive/divineArchive.ts` for the data model:

```ts
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Play, Plus, Heart, Square, Library, Sparkles, ScrollText,
  LayoutGrid, List, Volume2, Shield, Flame, Waves, Archive, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArchiveViewMode,
  DivineArchiveManifest,
  DivineRelic,
  filterRelics,
  getRoomCount,
  pickSelectedRelic,
  roomAccent
} from '@/archive/divineArchive';

interface CelestialBrowserProps {
  engineRef: React.MutableRefObject<any>;
  onLoadToPad?: (samplePath: string, padIndex: number) => void;
  activePad: number;
}
```

- [ ] **Step 2: Load `divine_archive_manifest.json` with fallback to the generated file only**

Use this manifest effect:

```ts
const [manifest, setManifest] = useState<DivineArchiveManifest | null>(null);
const [loading, setLoading] = useState(true);
const [loadError, setLoadError] = useState<string | null>(null);

useEffect(() => {
  let mounted = true;
  fetch('/divine_archive_manifest.json')
    .then((res) => {
      if (!res.ok) throw new Error(`Archive manifest failed with ${res.status}`);
      return res.json();
    })
    .then((data: DivineArchiveManifest) => {
      if (!mounted) return;
      setManifest(data);
      setLoadError(null);
    })
    .catch((err) => {
      if (!mounted) return;
      console.error('Failed to load Divine Archive manifest:', err);
      setLoadError('The Hall of Records could not open its generated archive.');
    })
    .finally(() => {
      if (mounted) setLoading(false);
    });
  return () => {
    mounted = false;
  };
}, []);
```

- [ ] **Step 3: Add room/search/selection/preview state**

Use these state values:

```ts
const [selectedRoom, setSelectedRoom] = useState('all');
const [searchQuery, setSearchQuery] = useState('');
const [viewMode, setViewMode] = useState<ArchiveViewMode>('shelf');
const [selectedRelic, setSelectedRelic] = useState<DivineRelic | null>(null);
const [playingPath, setPlayingPath] = useState<string | null>(null);
const [previewErrorPath, setPreviewErrorPath] = useState<string | null>(null);
const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
const [recentRecalls, setRecentRecalls] = useState<DivineRelic[]>([]);
const previewRef = useRef<{ path: string; stop: () => void } | null>(null);
```

Compute rooms and visible relics:

```ts
const rooms = useMemo(() => {
  if (!manifest) return [];
  return [
    { id: 'all', name: 'All Records', tone: 'Every relic in the vault', keywords: [] },
    { id: 'favorites', name: 'Marked Relics', tone: 'Favorites preserved for recall', keywords: [] },
    ...manifest.rooms
  ];
}, [manifest]);

const visibleRelics = useMemo(() => {
  if (!manifest) return [];
  return filterRelics(manifest.relics, selectedRoom, searchQuery, favorites);
}, [manifest, selectedRoom, searchQuery, favorites]);

useEffect(() => {
  setSelectedRelic((current) => pickSelectedRelic(current, visibleRelics));
}, [visibleRelics]);
```

- [ ] **Step 4: Implement awaken/recall handlers**

Use these handlers:

```ts
const handleAwaken = useCallback(async (relic: DivineRelic) => {
  setSelectedRelic(relic);
  setPreviewErrorPath(null);

  if (playingPath === relic.path) {
    previewRef.current?.stop();
    previewRef.current = null;
    setPlayingPath(null);
    return;
  }

  previewRef.current?.stop();
  setPlayingPath(relic.path);

  const controller = await engineRef.current?.previewSample(relic.path);
  if (!controller) {
    setPlayingPath(null);
    setPreviewErrorPath(relic.path);
    return;
  }

  previewRef.current = controller;
  controller.finished.then(() => {
    setPlayingPath((current) => (current === relic.path ? null : current));
    if (previewRef.current?.path === relic.path) previewRef.current = null;
  });
}, [engineRef, playingPath]);

const handleRecall = useCallback((relic: DivineRelic) => {
  setSelectedRelic(relic);
  engineRef.current?.loadSampleByPath(relic.path, activePad);
  onLoadToPad?.(relic.path, activePad);
  setRecentRecalls((current) => [relic, ...current.filter((item) => item.path !== relic.path)].slice(0, 6));
}, [activePad, engineRef, onLoadToPad]);

useEffect(() => () => {
  previewRef.current?.stop();
}, []);
```

- [ ] **Step 5: Render the Hall of Records shell**

Replace the existing return JSX with a four-region shell using these class names:

```tsx
return (
  <div className="da-hall-shell">
    <aside className="da-room-nav">
      <div className="da-room-title">
        <span>Divine Archive</span>
        <strong>Hall of Records</strong>
      </div>
      <div className="da-room-list">
        {rooms.map((room) => {
          const count = room.id === 'all'
            ? manifest?.totalRelics ?? 0
            : room.id === 'favorites'
              ? favorites.size
              : getRoomCount(manifest?.relics ?? [], room.id);
          const active = selectedRoom === room.id;
          return (
            <button
              key={room.id}
              type="button"
              className={`da-room ${active ? 'is-active' : ''}`}
              style={{ '--room-accent': roomAccent(room.id) } as React.CSSProperties}
              onClick={() => setSelectedRoom(room.id)}
            >
              <span className="da-room-name">{room.name}</span>
              <span className="da-room-tone">{room.tone}</span>
              <span className="da-room-count">{count}</span>
            </button>
          );
        })}
      </div>
    </aside>

    <section className="da-records">
      <header className="da-records-header">
        <div>
          <span className="da-kicker">Sacred Sound Vault</span>
          <h2>{rooms.find((room) => room.id === selectedRoom)?.name ?? 'Hall of Records'}</h2>
          <p>{visibleRelics.length} relics visible from {manifest?.totalRelics ?? 0} total</p>
        </div>
        <div className="da-search-tools">
          <div className="da-search">
            <Search size={14} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search relic, room, category, tag..." />
          </div>
          <button type="button" className={viewMode === 'shelf' ? 'is-active' : ''} onClick={() => setViewMode('shelf')}><LayoutGrid size={14} /></button>
          <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}><List size={14} /></button>
        </div>
      </header>

      <div className={viewMode === 'shelf' ? 'da-relic-shelf' : 'da-relic-list'}>
        {visibleRelics.map((relic) => (
          <button
            key={relic.id}
            type="button"
            className={`da-relic ${selectedRelic?.id === relic.id ? 'is-selected' : ''} ${playingPath === relic.path ? 'is-playing' : ''}`}
            style={{ '--room-accent': roomAccent(relic.room) } as React.CSSProperties}
            onClick={() => handleAwaken(relic)}
            onDoubleClick={() => handleRecall(relic)}
          >
            <span className="da-relic-orb"><Sparkles size={viewMode === 'shelf' ? 18 : 13} /></span>
            <span className="da-relic-copy">
              <strong>{relic.name}</strong>
              <small>{relic.roomName} / {relic.sourceCategory}</small>
            </span>
            <span className="da-relic-tags">{relic.tags.slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}</span>
            <span className="da-relic-actions">
              {playingPath === relic.path ? <Square size={12} /> : <Play size={12} />}
              <b>{relic.format.toUpperCase()}</b>
            </span>
          </button>
        ))}
      </div>
    </section>

    <aside className="da-inspector">
      {selectedRelic ? (
        <RelicInspector
          relic={selectedRelic}
          isFavorite={favorites.has(selectedRelic.path)}
          isPlaying={playingPath === selectedRelic.path}
          hasPreviewError={previewErrorPath === selectedRelic.path}
          activePad={activePad}
          onAwaken={() => handleAwaken(selectedRelic)}
          onRecall={() => handleRecall(selectedRelic)}
          onToggleFavorite={() => toggleFavorite(selectedRelic.path)}
        />
      ) : (
        <div className="da-inspector-empty"><Archive size={28} /><span>Select a relic</span></div>
      )}
    </aside>

    <footer className="da-recall-strip">
      <span>ACTIVE PAD {activePad + 1}</span>
      <div>{recentRecalls.map((relic) => <button key={relic.path} onClick={() => handleRecall(relic)}>{relic.name}</button>)}</div>
      <span>{playingPath ? 'AWAKENING RELIC' : 'ARCHIVE READY'}</span>
    </footer>
  </div>
);
```

- [ ] **Step 6: Add `RelicInspector` inside `CelestialBrowser.tsx`**

Add this component below `EqBars`:

```tsx
const RelicInspector = ({
  relic,
  isFavorite,
  isPlaying,
  hasPreviewError,
  activePad,
  onAwaken,
  onRecall,
  onToggleFavorite
}: {
  relic: DivineRelic;
  isFavorite: boolean;
  isPlaying: boolean;
  hasPreviewError: boolean;
  activePad: number;
  onAwaken: () => void;
  onRecall: () => void;
  onToggleFavorite: () => void;
}) => (
  <div className="da-inspector-card" style={{ '--room-accent': roomAccent(relic.room) } as React.CSSProperties}>
    <div className="da-inspector-orb"><Eye size={22} /></div>
    <span className="da-kicker">{relic.roomName}</span>
    <h3>{relic.name}</h3>
    <p>{relic.tone}</p>
    <div className="da-aura-ring">{isPlaying ? <EqBars /> : <Waves size={34} />}</div>
    <dl>
      <div><dt>Category</dt><dd>{relic.sourceCategory}</dd></div>
      <div><dt>Format</dt><dd>{relic.format.toUpperCase()}</dd></div>
      <div><dt>Path</dt><dd>{hasPreviewError ? 'Preview failed' : 'Verified archive relic'}</dd></div>
    </dl>
    <div className="da-tag-cloud">{relic.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
    <div className="da-inspector-actions">
      <button type="button" onClick={onAwaken}>{isPlaying ? 'Stop Awakening' : 'Awaken'}</button>
      <button type="button" onClick={onRecall}>Recall to Pad {activePad + 1}</button>
      <button type="button" onClick={onToggleFavorite}>{isFavorite ? 'Marked' : 'Mark Relic'}</button>
    </div>
  </div>
);
```

- [ ] **Step 7: Verify component compile**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: no TypeScript errors.

---

## Task 5: Hall Of Records Styling

**Files:**
- Modify: `src/styles/index.css`

- [ ] **Step 1: Add the Hall of Records CSS block**

Append this CSS after the existing Divine Archive block:

```css
.da-hall-shell {
  height: 100%;
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr) 300px;
  grid-template-rows: minmax(0, 1fr) 54px;
  background: radial-gradient(circle at 50% 0%, rgba(255, 102, 0, 0.12), transparent 34%), #050506;
  color: #f8ddd2;
  overflow: hidden;
}

.da-room-nav,
.da-inspector {
  background: linear-gradient(180deg, rgba(15, 12, 11, 0.92), rgba(5, 5, 6, 0.96));
  border-color: rgba(255, 138, 61, 0.12);
}

.da-room-nav {
  border-right: 1px solid rgba(255, 138, 61, 0.12);
  padding: 16px 12px;
  overflow: hidden;
}

.da-room-title span,
.da-kicker {
  display: block;
  color: rgba(255, 204, 128, 0.52);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.da-room-title strong {
  display: block;
  margin-top: 4px;
  color: #fff2d8;
  font-size: 17px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.da-room-list {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  height: calc(100% - 58px);
  overflow-y: auto;
}

.da-room {
  position: relative;
  min-height: 54px;
  padding: 9px 38px 9px 11px;
  border: 1px solid rgba(255, 255, 255, 0.055);
  background: rgba(255, 255, 255, 0.025);
  color: rgba(248, 221, 210, 0.72);
  text-align: left;
  border-radius: 8px;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.da-room:hover,
.da-room.is-active {
  border-color: color-mix(in srgb, var(--room-accent) 58%, transparent);
  background: linear-gradient(90deg, color-mix(in srgb, var(--room-accent) 14%, transparent), rgba(255, 255, 255, 0.02));
  box-shadow: inset 3px 0 0 var(--room-accent), 0 0 18px color-mix(in srgb, var(--room-accent) 18%, transparent);
}

.da-room-name,
.da-room-tone,
.da-room-count {
  display: block;
}

.da-room-name {
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.da-room-tone {
  margin-top: 3px;
  color: rgba(248, 221, 210, 0.34);
  font-size: 9px;
  line-height: 1.2;
}

.da-room-count {
  position: absolute;
  right: 10px;
  top: 10px;
  color: var(--room-accent);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}

.da-records {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.da-records-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 86px;
  padding: 15px 18px;
  border-bottom: 1px solid rgba(255, 138, 61, 0.1);
  background: linear-gradient(180deg, rgba(12, 9, 9, 0.88), rgba(5, 5, 6, 0.72));
}

.da-records-header h2 {
  margin: 4px 0 2px;
  color: #ffe4b4;
  font-size: 22px;
  line-height: 1;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.da-records-header p {
  color: rgba(248, 221, 210, 0.34);
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.da-search-tools {
  display: flex;
  align-items: center;
  gap: 7px;
}

.da-search {
  width: min(360px, 34vw);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.34);
}

.da-search input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  color: rgba(255, 242, 216, 0.86);
  background: transparent;
  font-size: 11px;
}

.da-search-tools > button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 7px;
  color: rgba(248, 221, 210, 0.42);
  background: rgba(255, 255, 255, 0.035);
}

.da-search-tools > button.is-active {
  color: #ffb86b;
  border-color: rgba(255, 102, 0, 0.38);
  background: rgba(255, 102, 0, 0.12);
}

.da-relic-shelf,
.da-relic-list {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

.da-relic-shelf {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
  gap: 12px;
  align-content: start;
}

.da-relic-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.da-relic {
  position: relative;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  min-height: 132px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.045), rgba(0, 0, 0, 0.22));
  color: rgba(248, 221, 210, 0.78);
  text-align: left;
  overflow: hidden;
}

.da-relic-list .da-relic {
  min-height: 58px;
  grid-template-columns: 28px minmax(0, 1fr) auto auto;
  align-items: center;
}

.da-relic:hover,
.da-relic.is-selected,
.da-relic.is-playing {
  border-color: color-mix(in srgb, var(--room-accent) 54%, transparent);
  box-shadow: 0 0 22px color-mix(in srgb, var(--room-accent) 16%, transparent);
}

.da-relic-orb {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: var(--room-accent);
  background: color-mix(in srgb, var(--room-accent) 12%, rgba(0, 0, 0, 0.32));
}

.da-relic-copy {
  min-width: 0;
}

.da-relic-copy strong,
.da-relic-copy small {
  display: block;
}

.da-relic-copy strong {
  color: #fff2d8;
  font-size: 12px;
  line-height: 1.2;
}

.da-relic-copy small {
  margin-top: 4px;
  color: rgba(248, 221, 210, 0.36);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.da-relic-tags {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-self: end;
}

.da-relic-list .da-relic-tags {
  grid-column: auto;
}

.da-relic-tags em,
.da-tag-cloud span {
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 999px;
  padding: 2px 6px;
  color: rgba(248, 221, 210, 0.42);
  font-size: 8px;
  font-style: normal;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.da-relic-actions {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--room-accent);
}

.da-relic-list .da-relic-actions {
  position: static;
}

.da-relic-actions b {
  color: rgba(248, 221, 210, 0.32);
  font-size: 8px;
}

.da-inspector {
  border-left: 1px solid rgba(255, 138, 61, 0.12);
  padding: 14px;
  overflow: hidden;
}

.da-inspector-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--room-accent) 32%, transparent);
  border-radius: 10px;
  background: radial-gradient(circle at 50% 10%, color-mix(in srgb, var(--room-accent) 14%, transparent), transparent 40%), rgba(0, 0, 0, 0.28);
}

.da-inspector-orb,
.da-aura-ring {
  display: grid;
  place-items: center;
  color: var(--room-accent);
}

.da-inspector-orb {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--room-accent) 13%, transparent);
}

.da-inspector-card h3 {
  color: #fff2d8;
  font-size: 20px;
  line-height: 1.1;
}

.da-inspector-card p {
  color: rgba(248, 221, 210, 0.44);
  font-size: 11px;
  line-height: 1.45;
}

.da-aura-ring {
  min-height: 110px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--room-accent) 42%, transparent);
  box-shadow: inset 0 0 30px color-mix(in srgb, var(--room-accent) 10%, transparent), 0 0 22px color-mix(in srgb, var(--room-accent) 14%, transparent);
}

.da-inspector-card dl {
  display: grid;
  gap: 7px;
}

.da-inspector-card dl div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
}

.da-inspector-card dt {
  color: rgba(248, 221, 210, 0.34);
  font-size: 9px;
  text-transform: uppercase;
}

.da-inspector-card dd {
  max-width: 150px;
  color: rgba(255, 242, 216, 0.72);
  font-size: 9px;
  text-align: right;
}

.da-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.da-inspector-actions {
  margin-top: auto;
  display: grid;
  gap: 8px;
}

.da-inspector-actions button,
.da-recall-strip button {
  border: 1px solid rgba(255, 102, 0, 0.24);
  border-radius: 7px;
  padding: 8px 10px;
  color: #ffd6a0;
  background: rgba(255, 102, 0, 0.12);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.da-inspector-empty {
  height: 100%;
  display: grid;
  place-items: center;
  gap: 8px;
  color: rgba(248, 221, 210, 0.22);
}

.da-recall-strip {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) 160px;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-top: 1px solid rgba(255, 138, 61, 0.13);
  background: rgba(5, 5, 6, 0.94);
}

.da-recall-strip span {
  color: rgba(255, 204, 128, 0.5);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.da-recall-strip div {
  display: flex;
  gap: 7px;
  overflow-x: auto;
}

.da-recall-strip button {
  flex: 0 0 auto;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 6px 9px;
  background: rgba(255, 255, 255, 0.035);
}
```

- [ ] **Step 2: Verify CSS syntax through build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds. A large chunk warning is acceptable.

---

## Task 6: Runtime Verification

**Files:**
- No source edits unless verification exposes a defect.

- [ ] **Step 1: Run all local gates**

Run:

```bash
npm run generate:archive
npm run validate:archive
npx tsc --noEmit --pretty false
npm run build
```

Expected:

```text
Generated 713 Divine Archive relics at public/divine_archive_manifest.json
Divine Archive manifest valid: 713 relics across 10 rooms
```

TypeScript and build should exit successfully.

- [ ] **Step 2: Verify live app behavior in browser**

Open:

```text
http://127.0.0.1:3001/
```

Manual checks:

- Click `DIVINE ARCHIVE`.
- Confirm room navigation shows Olympus, Underworld, Sun Disk, Void, Temple, Storm, Celestial Choir, Forge, Abyss, Eden.
- Search `bass`; visible relics include Underworld/Bass source results.
- Search `vox`; visible relics include Celestial Choir/Vox source results.
- Click a relic; inspector updates and preview begins.
- Click the same relic again; preview stops and active state clears.
- Double click a relic or use `Recall to Pad`; no console error appears.
- Switch shelf/list view; layout remains stable.

- [ ] **Step 3: Pressure pass defects found during verification**

If a verification step fails, fix only the failing behavior and rerun:

```bash
npm run validate:archive
npx tsc --noEmit --pretty false
npm run build
```

---

## Self-Review

Spec coverage:

- Generated mythic-room manifest: Task 1.
- Room-first UI and Hall of Records identity: Tasks 4 and 5.
- Search over name, room, category, and tags: Tasks 2 and 4.
- Favorites persistence: Task 4 keeps existing local storage pattern.
- Audition lifecycle correctness: Task 3 and Task 4.
- Recall to pad: Task 4.
- Real source of truth and stale Akashic manifest avoidance: Task 1 and Task 4.
- Verification and pressure pass: Task 6.

Placeholder scan:

- No task uses unspecified placeholder code.
- No task asks for vague error handling without a concrete behavior.
- No task relies on `akashic_manifest.json` as source of truth.

Type consistency:

- `DivineRelic`, `DivineRoom`, `DivineArchiveManifest`, and `ArchiveViewMode` are defined in Task 2 and used consistently in Task 4.
- `previewSample` returns `Promise<SamplePreviewController | null>` in Task 3 and is consumed as a controller in Task 4.
