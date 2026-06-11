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

const deterministicVal = (seed, min, max) => {
  const hash = stableHash(seed, 8);
  const percent = (parseInt(hash, 16) % 1000) / 1000;
  return Number((min + percent * (max - min)).toFixed(3));
};

const getAcousticProperties = (sourceCategory, name, id) => {
  let energyMin = 0.2, energyMax = 0.8;
  let centroidMin = 0.2, centroidMax = 0.8;
  let decayMin = 0.2, decayMax = 2.0;

  const cat = sourceCategory.toLowerCase();
  if (cat.includes('bass')) {
    energyMin = 0.5; energyMax = 0.95;
    centroidMin = 0.05; centroidMax = 0.3;
    decayMin = 0.6; decayMax = 2.5;
  } else if (cat.includes('bell') || cat.includes('key')) {
    energyMin = 0.2; energyMax = 0.6;
    centroidMin = 0.4; centroidMax = 0.8;
    decayMin = 0.4; decayMax = 1.8;
  } else if (cat.includes('fx') || cat.includes('texture')) {
    energyMin = 0.15; energyMax = 0.75;
    centroidMin = 0.2; centroidMax = 0.7;
    decayMin = 1.0; decayMax = 4.0;
  } else if (cat.includes('pluck') || cat.includes('guitar')) {
    energyMin = 0.15; energyMax = 0.55;
    centroidMin = 0.3; centroidMax = 0.6;
    decayMin = 0.1; decayMax = 0.9;
  } else if (cat.includes('accent') || cat.includes('brass')) {
    energyMin = 0.6; energyMax = 0.95;
    centroidMin = 0.5; centroidMax = 0.9;
    decayMin = 0.05; decayMax = 0.6;
  } else if (cat.includes('vox') || cat.includes('choir') || cat.includes('pads') || cat.includes('strings')) {
    energyMin = 0.3; energyMax = 0.7;
    centroidMin = 0.3; centroidMax = 0.65;
    decayMin = 0.8; decayMax = 3.0;
  } else if (cat.includes('analog') || cat.includes('synth') || cat.includes('leads')) {
    energyMin = 0.4; energyMax = 0.85;
    centroidMin = 0.35; centroidMax = 0.75;
    decayMin = 0.4; decayMax = 1.5;
  }

  const energy = deterministicVal(`${id}:energy`, energyMin, energyMax);
  const spectralCentroid = deterministicVal(`${id}:centroid`, centroidMin, centroidMax);
  const decayTime = deterministicVal(`${id}:decay`, decayMin, decayMax);

  return { energy, spectralCentroid, decayTime };
};

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

  // Pass 1: Generate all relics with raw acoustic values
  const relics = samples.map((sample) => {
    if (!sample.name || !sample.path) {
      throw new Error(`Sample in "${sample.sourceCategory}" is missing name or path.`);
    }

    const roomId = inferRoomId(sample);
    const room = roomById.get(roomId);
    const format = String(sample.format ?? path.extname(sample.path).replace('.', '')).toLowerCase();
    const identity = `${sample.sourceCategory}:${sample.path}`;
    const relicId = `relic-${slugify(sample.sourceCategory)}-${slugify(sample.name)}-${stableHash(identity)}`;

    const acoustics = getAcousticProperties(sample.sourceCategory, sample.name, relicId);

    return {
      id: relicId,
      name: sample.name,
      path: sample.path,
      format,
      sourceCategory: sample.sourceCategory,
      room: room.id,
      roomName: room.name,
      tags: tagsFor({ ...sample, format }, room),
      tone: room.tone,
      weight: weightFor(sample, room.id),
      ...acoustics,
      similarRelicIds: [],
    };
  });

  // Pass 2: Calculate global min/max for min-max normalization
  let minEnergy = Infinity, maxEnergy = -Infinity;
  let minCentroid = Infinity, maxCentroid = -Infinity;
  let minDecay = Infinity, maxDecay = -Infinity;

  for (const r of relics) {
    if (r.energy < minEnergy) minEnergy = r.energy;
    if (r.energy > maxEnergy) maxEnergy = r.energy;
    if (r.spectralCentroid < minCentroid) minCentroid = r.spectralCentroid;
    if (r.spectralCentroid > maxCentroid) maxCentroid = r.spectralCentroid;
    if (r.decayTime < minDecay) minDecay = r.decayTime;
    if (r.decayTime > maxDecay) maxDecay = r.decayTime;
  }

  // Pass 3: Normalize features and find top 5 similar relics using Euclidean distance
  for (const a of relics) {
    const aEnergyNorm = (a.energy - minEnergy) / (maxEnergy - minEnergy || 1);
    const aCentroidNorm = (a.spectralCentroid - minCentroid) / (maxCentroid - minCentroid || 1);
    const aDecayNorm = (a.decayTime - minDecay) / (maxDecay - minDecay || 1);

    const distances = relics
      .filter((b) => b.id !== a.id)
      .map((b) => {
        const bEnergyNorm = (b.energy - minEnergy) / (maxEnergy - minEnergy || 1);
        const bCentroidNorm = (b.spectralCentroid - minCentroid) / (maxCentroid - minCentroid || 1);
        const bDecayNorm = (b.decayTime - minDecay) / (maxDecay - minDecay || 1);

        const dist = Math.sqrt(
          Math.pow(aEnergyNorm - bEnergyNorm, 2) +
          Math.pow(aCentroidNorm - bCentroidNorm, 2) +
          Math.pow(aDecayNorm - bDecayNorm, 2)
        );

        return { id: b.id, dist };
      });

    distances.sort((left, right) => left.dist - right.dist);
    a.similarRelicIds = distances.slice(0, 5).map((d) => d.id);
  }

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
