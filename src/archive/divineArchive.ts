export interface DivineRoom {
  id: string;
  name: string;
  tone: string;
  keywords?: string[];
  relicCount?: number;
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
  sourceManifest: string;
  sourceManifestHash?: string;
  sourceTotalSamples: number;
  totalRelics: number;
  rooms: DivineRoom[];
  relics: DivineRelic[];
}

export type ArchiveViewMode = 'shelf' | 'list';

export const getRoomCount = (relics: DivineRelic[], roomId: string): number =>
  relics.filter((relic) => relic.room === roomId).length;

export const matchesArchiveQuery = (relic: DivineRelic, query: string): boolean => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const searchableText = [
    relic.name,
    relic.roomName,
    relic.sourceCategory,
    relic.format,
    ...relic.tags,
  ]
    .join(' ')
    .toLowerCase();

  return searchableText.includes(normalizedQuery);
};

export const filterRelics = (
  relics: DivineRelic[],
  roomId: string,
  query: string,
  favoritePaths: ReadonlySet<string>,
): DivineRelic[] => {
  const roomRelics =
    roomId === 'favorites'
      ? relics.filter((relic) => favoritePaths.has(relic.path))
      : roomId === 'all'
        ? relics
        : relics.filter((relic) => relic.room === roomId);

  return roomRelics.filter((relic) => matchesArchiveQuery(relic, query));
};

export const pickSelectedRelic = (
  current: DivineRelic | null,
  visibleRelics: DivineRelic[],
): DivineRelic | null => {
  if (current && visibleRelics.some((relic) => relic.id === current.id)) {
    return current;
  }

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
    all: '#f8ddd2',
  };

  return accents[roomId] ?? '#ff6600';
};
