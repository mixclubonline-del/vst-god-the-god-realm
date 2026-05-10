import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const sourceManifestPath = path.join(publicDir, 'library_manifest.json');
const archiveManifestPath = path.join(publicDir, 'divine_archive_manifest.json');

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const fail = (message) => {
  throw new Error(message);
};

const flattenSourceSamples = (manifest) => {
  if (!manifest.categories || typeof manifest.categories !== 'object') {
    fail('Source manifest must contain a categories object.');
  }

  return Object.entries(manifest.categories).flatMap(([sourceCategory, samples]) => {
    if (!Array.isArray(samples)) {
      fail(`Source category "${sourceCategory}" must be an array.`);
    }

    return samples.map((sample) => {
      if (!sample.path || !sample.name) {
        fail(`Source category "${sourceCategory}" contains a sample missing name or path.`);
      }

      return {
        sourceCategory,
        name: sample.name,
        path: sample.path,
        key: `${sourceCategory}::${sample.path}`,
      };
    });
  });
};

const assertPublicPathExists = (relicPath) => {
  if (!relicPath.startsWith('/')) {
    fail(`Relic path must be public-root absolute: ${relicPath}`);
  }

  const resolved = path.resolve(publicDir, `.${relicPath}`);
  const relative = path.relative(publicDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(`Relic path escapes public directory: ${relicPath}`);
  }

  if (!existsSync(resolved)) {
    fail(`Relic path does not exist under public: ${relicPath}`);
  }
};

const sourceManifest = readJson(sourceManifestPath);
const archiveManifest = readJson(archiveManifestPath);
const sourceSamples = flattenSourceSamples(sourceManifest);
const sourceKeys = new Set(sourceSamples.map((sample) => sample.key));
const roomIds = new Set((archiveManifest.rooms ?? []).map((room) => room.id));
const relics = archiveManifest.relics ?? [];

if (!Array.isArray(archiveManifest.rooms) || archiveManifest.rooms.length === 0) {
  fail('Archive manifest must contain a non-empty rooms array.');
}

if (!Array.isArray(relics)) {
  fail('Archive manifest must contain a relics array.');
}

if (archiveManifest.totalRelics !== sourceManifest.totalSamples) {
  fail(`Archive totalRelics ${archiveManifest.totalRelics} does not match source totalSamples ${sourceManifest.totalSamples}.`);
}

if (archiveManifest.sourceTotalSamples !== sourceManifest.totalSamples) {
  fail(
    `Archive sourceTotalSamples ${archiveManifest.sourceTotalSamples} does not match source totalSamples ${sourceManifest.totalSamples}.`,
  );
}

if (relics.length !== sourceManifest.totalSamples) {
  fail(`Archive relic array length ${relics.length} does not match source totalSamples ${sourceManifest.totalSamples}.`);
}

const ids = new Set();
const archiveKeys = new Set();

for (const relic of relics) {
  if (!relic.id) {
    fail(`Relic is missing id for path ${relic.path ?? 'unknown'}.`);
  }

  if (ids.has(relic.id)) {
    fail(`Duplicate relic id: ${relic.id}`);
  }
  ids.add(relic.id);

  for (const field of ['room', 'roomName', 'sourceCategory']) {
    if (!relic[field]) {
      fail(`Relic ${relic.id} is missing ${field}.`);
    }
  }

  if (!Array.isArray(relic.tags) || relic.tags.length === 0) {
    fail(`Relic ${relic.id} must contain at least one tag.`);
  }

  if (!roomIds.has(relic.room)) {
    fail(`Relic ${relic.id} references unknown room: ${relic.room}`);
  }

  assertPublicPathExists(relic.path);

  const sourceKey = `${relic.sourceCategory}::${relic.path}`;
  if (!sourceKeys.has(sourceKey)) {
    fail(`Archive relic ${relic.id} is not present in source manifest: ${sourceKey}`);
  }

  if (archiveKeys.has(sourceKey)) {
    fail(`Source sample appears more than once in archive: ${sourceKey}`);
  }
  archiveKeys.add(sourceKey);
}

for (const sourceSample of sourceSamples) {
  if (!archiveKeys.has(sourceSample.key)) {
    fail(`Source sample missing from archive: ${sourceSample.key}`);
  }
}

const relicRoomCounts = relics.reduce((counts, relic) => {
  counts.set(relic.room, (counts.get(relic.room) ?? 0) + 1);
  return counts;
}, new Map());

for (const room of archiveManifest.rooms) {
  if (!room.id || !room.name) {
    fail('Every archive room must contain id and name.');
  }

  if (room.relicCount !== relicRoomCounts.get(room.id)) {
    fail(`Room ${room.id} relicCount ${room.relicCount} does not match assigned relics.`);
  }
}

console.log(`Validated ${relics.length} relics across ${archiveManifest.rooms.length} rooms.`);
