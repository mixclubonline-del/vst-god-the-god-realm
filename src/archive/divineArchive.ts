export interface DivineRoom {
  id: string;
  name: string;
  tone: string;
  keywords?: string[];
  relicCount?: number;
  image?: string;
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
    forge: '#FFD700',
    abyss: '#7f1d1d',
    eden: '#6ee7b7',
    favorites: '#FFD700',
    all: '#f8ddd2',
  };

  return accents[roomId] ?? '#FFD700';
};

export const roomImage = (roomId: string): string => {
  const images: Record<string, string> = {
    olympus: '/images/archive/room_olympus.png',
    underworld: '/images/archive/room_underworld.png',
    'sun-disk': '/images/archive/room_sun_disk.png',
    void: '/images/archive/room_void.png',
    temple: '/images/archive/room_temple.png',
    storm: '/images/archive/room_storm.png',
    'celestial-choir': '/images/archive/room_celestial_choir.png',
    forge: '/images/archive/room_forge.png',
    abyss: '/images/archive/room_abyss.png',
    eden: '/images/archive/room_eden.png',
    favorites: '/images/archive/section_vault.png',
    all: '/images/archive/hall_of_records_bg.png',
  };

  return images[roomId] ?? '/images/archive/room_generic.png';
};
