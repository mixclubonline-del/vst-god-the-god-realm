import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const sourceManifestPath = path.join(publicDir, 'library_manifest.json');
const outputManifestPath = path.join(publicDir, 'divine_archive_manifest.json');

const ROOM_DEFINITIONS = [
  {
    id: 'olympus',
    name: 'Olympus',
    tone: 'heroic ascension',
    categories: ['Accents', 'Real Brass', 'Strings', 'Wind'],
    keywords: ['brass', 'trumpet', 'orchestra', 'orchestral', 'hero', 'high', 'marcato', 'staccato', 'showtime'],
  },
  {
    id: 'underworld',
    name: 'Underworld',
    tone: 'subterranean pressure',
    categories: ['Bass'],
    keywords: ['bass', 'sub', 'deep', 'bottom', 'fatal', 'low', 'dark', 'tractor', 'reese'],
  },
  {
    id: 'sun-disk',
    name: 'Sun Disk',
    tone: 'radiant gold',
    categories: ['Bell', 'Keys'],
    keywords: ['sun', 'gold', 'golden', 'bright', 'glimmer', 'light', 'shimmer', 'sol', 'luz'],
  },
  {
    id: 'void',
    name: 'Void',
    tone: 'weightless signal drift',
    categories: ['Texture'],
    keywords: ['space', 'void', 'air', 'oxygen', 'drift', 'particles', 'scattered', 'noise', 'inbetween'],
  },
  {
    id: 'temple',
    name: 'Temple',
    tone: 'ritual resonance',
    categories: ['Ethnic', 'Organ'],
    keywords: ['ceremony', 'harp', 'lute', 'domra', 'kalimba', 'traveller', 'medieval', 'organ', 'church'],
  },
  {
    id: 'storm',
    name: 'Storm',
    tone: 'charged motion',
    categories: ['FX', 'Modulated'],
    keywords: ['storm', 'chase', 'wildfire', 'crush', 'boiling', 'anger', 'blast', 'blaster', 'swarm', 'motion'],
  },
  {
    id: 'celestial-choir',
    name: 'Celestial Choir',
    tone: 'vocal ether',
    categories: ['Vox'],
    keywords: ['vox', 'vocal', 'choir', 'voice', 'angel', 'angelification', 'soup'],
  },
  {
    id: 'forge',
    name: 'Forge',
    tone: 'crafted voltage',
    categories: ['Analog', 'Synth', 'Synth Brass', 'Leads'],
    keywords: ['analog', 'synth', 'juno', 'acid', 'poly', 'lead', 'electric', 'robot', 'steel', 'revolution'],
  },
  {
    id: 'abyss',
    name: 'Abyss',
    tone: 'cinematic dread',
    categories: ['Pads'],
    keywords: ['abyss', 'unsettled', 'disturbing', 'suspense', 'brooding', 'nightshade', 'cliff', 'muddied'],
  },
  {
    id: 'eden',
    name: 'Eden',
    tone: 'organic sanctuary',
    categories: ['Guitar', 'Pluck'],
    keywords: ['nature', 'sweet', 'home', 'guitar', 'pluck', 'acoustic', 'mariner', 'shepherd', 'celtic'],
  },
];

const roomById = new Map(ROOM_DEFINITIONS.map((room) => [room.id, room]));
const categoryFallbackRooms = new Map(
  ROOM_DEFINITIONS.flatMap((room) => room.categories.map((category) => [category, room.id])),
);

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const stableHash = (value, length = 12) =>
  createHash('sha256').update(value).digest('hex').slice(0, length);

const flattenSamples = (manifest) => {
  if (!manifest.categories || typeof manifest.categories !== 'object') {
    throw new Error('library_manifest.json must contain a categories object.');
  }

  return Object.entries(manifest.categories)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([sourceCategory, samples]) => {
      if (!Array.isArray(samples)) {
        throw new Error(`Category "${sourceCategory}" must be an array.`);
      }

      return [...samples]
        .sort((left, right) => {
          const leftKey = `${left.path ?? ''}::${left.name ?? ''}`;
          const rightKey = `${right.path ?? ''}::${right.name ?? ''}`;
          return leftKey.localeCompare(rightKey);
        })
        .map((sample, index) => ({ ...sample, sourceCategory, sourceIndex: index }));
    });
};

const inferRoomId = (sample) => {
  const haystack = `${sample.sourceCategory} ${sample.name} ${sample.path}`.toLowerCase();
  const scores = ROOM_DEFINITIONS.map((room) => {
    const categoryScore = room.categories.includes(sample.sourceCategory) ? 10 : 0;
    const keywordScore = room.keywords.reduce((score, keyword) => {
      return score + (haystack.includes(keyword.toLowerCase()) ? 2 : 0);
    }, 0);
    return { id: room.id, score: categoryScore + keywordScore };
  });

  scores.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  return scores[0]?.score > 0 ? scores[0].id : categoryFallbackRooms.get(sample.sourceCategory) ?? 'void';
};

const tagsFor = (sample, room) => {
  const format = String(sample.format ?? path.extname(sample.path ?? '').replace('.', '')).toLowerCase();
  const nameTokens = String(sample.name ?? '')
    .split(/[^A-Za-z0-9]+/)
    .filter((token) => token.length >= 3)
    .slice(0, 4)
    .map((token) => slugify(token));

  return [...new Set([slugify(sample.sourceCategory), room.id, format, ...nameTokens])].filter(Boolean);
};

const weightFor = (sample, roomId) => {
  const hash = stableHash(`${sample.sourceCategory}:${sample.name}:${sample.path}:${roomId}`, 8);
  return Number((0.55 + (Number.parseInt(hash, 16) % 45) / 100).toFixed(2));
};

const buildArchiveManifest = () => {
  const sourceManifestRaw = readFileSync(sourceManifestPath, 'utf8');
  const sourceManifest = JSON.parse(sourceManifestRaw);
  const samples = flattenSamples(sourceManifest);
  const relics = samples.map((sample) => {
    if (!sample.name || !sample.path) {
      throw new Error(`Sample in "${sample.sourceCategory}" is missing name or path.`);
    }

    const roomId = inferRoomId(sample);
    const room = roomById.get(roomId);
    const format = String(sample.format ?? path.extname(sample.path).replace('.', '')).toLowerCase();
    const identity = `${sample.sourceCategory}:${sample.path}`;

    return {
      id: `relic-${slugify(sample.sourceCategory)}-${slugify(sample.name)}-${stableHash(identity)}`,
      name: sample.name,
      path: sample.path,
      format,
      sourceCategory: sample.sourceCategory,
      room: room.id,
      roomName: room.name,
      tags: tagsFor({ ...sample, format }, room),
      tone: room.tone,
      weight: weightFor(sample, room.id),
    };
  });

  const roomCounts = relics.reduce((counts, relic) => {
    counts.set(relic.room, (counts.get(relic.room) ?? 0) + 1);
    return counts;
  }, new Map());

  return {
    name: 'Divine Archive Hall of Records',
    version: '1.0.0',
    sourceManifest: 'public/library_manifest.json',
    sourceManifestHash: stableHash(sourceManifestRaw, 16),
    sourceTotalSamples: sourceManifest.totalSamples,
    totalRelics: relics.length,
    rooms: ROOM_DEFINITIONS.map((room) => ({
      id: room.id,
      name: room.name,
      tone: room.tone,
      relicCount: roomCounts.get(room.id) ?? 0,
    })),
    relics,
  };
};

const archiveManifest = buildArchiveManifest();
writeFileSync(outputManifestPath, `${JSON.stringify(archiveManifest, null, 2)}\n`);

console.log(
  `Generated ${path.relative(rootDir, outputManifestPath)} with ${archiveManifest.totalRelics} relics across ${archiveManifest.rooms.length} rooms.`,
);
