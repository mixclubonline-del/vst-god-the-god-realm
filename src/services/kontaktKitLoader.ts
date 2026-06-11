/**
 * kontaktKitLoader.ts — Kit Detection & Auto-Mapping Service
 * 
 * Scans folders (Kontakt libraries, sample packs, SFZ instruments) and
 * auto-maps audio files to the 6-slot sampler. Supports:
 *  - Non-monolith Kontakt libraries (WAV/AIFF in Samples/ directory)
 *  - Generic sample pack folders
 *  - SFZ instrument files (lightweight zone parsing)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KitSample {
  name: string;
  file: File;
  category: SampleCategory;
  path: string;
  size: number;
}

export type SampleCategory = 
  | 'kick' | 'snare' | 'hihat' | 'clap' 
  | 'perc' | 'cymbal' | 'tom' | 'fx' 
  | 'bass' | 'keys' | 'vocal' | 'other';

export interface DetectedKit {
  name: string;
  type: 'kontakt' | 'sfz' | 'folder';
  samples: KitSample[];
  categories: Partial<Record<SampleCategory, KitSample[]>>;
  sfzFile: File | null;
  nkiFiles: string[];
  ncwCount: number;
  nkxCount: number;
  totalSize: number;
  warnings: string[];
}

export interface SlotMapping {
  slotIndex: number;
  sample: KitSample | null;
  label: string;
}

// ─── Category Detection Engine ──────────────────────────────────────────────

const CATEGORY_PATTERNS: [SampleCategory, RegExp][] = [
  ['kick',   /\b(kick|kik|bd|bassdrum|bass[_\s-]?drum)\b/i],
  ['snare',  /\b(snare|snr|sd|rim[_\s-]?shot)\b/i],
  ['hihat',  /\b(hi[_\s-]?hat|hh|hat|oh|ch|open[_\s-]?hat|closed[_\s-]?hat)\b/i],
  ['clap',   /\b(clap|clp|cp|hand[_\s-]?clap)\b/i],
  ['tom',    /\b(tom|floor[_\s-]?tom|rack[_\s-]?tom)\b/i],
  ['cymbal', /\b(cymbal|crash|ride|splash|china)\b/i],
  ['perc',   /\b(perc|percussion|conga|bongo|shaker|tamb|cowbell|wood[_\s-]?block|triangle|guiro|cabasa|maracas|agogo|bell|clave|vibraslap)\b/i],
  ['fx',     /\b(fx|sfx|effect|sweep|riser|impact|noise|texture|atmo|amb)\b/i],
  ['bass',   /\b(bass|sub|808|low[_\s-]?end)\b/i],
  ['keys',   /\b(keys|piano|organ|rhodes|wurli|ep|clav|synth|pad|chord)\b/i],
  ['vocal',  /\b(vocal|vox|voice|choir|ad[_\s-]?lib|chant)\b/i],
];

const AUDIO_EXTENSIONS = new Set([
  '.wav', '.wave', '.aif', '.aiff', '.flac', '.ogg', '.mp3', '.m4a', '.opus',
]);

const NI_EXTENSIONS = {
  nki: '.nki',
  nkx: '.nkx',
  nkm: '.nkm',
  nkr: '.nkr',
  ncw: '.ncw',
};

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

function detectCategory(filename: string): SampleCategory {
  // Strip extension and path for matching
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_\-\.]/g, ' ');
  
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(base)) return category;
  }
  
  // Fallback: check parent directory name patterns
  const parts = filename.split('/');
  if (parts.length > 1) {
    const parentDir = parts[parts.length - 2];
    for (const [category, pattern] of CATEGORY_PATTERNS) {
      if (pattern.test(parentDir)) return category;
    }
  }
  
  return 'other';
}

// ─── Folder Scanning ────────────────────────────────────────────────────────

async function scanDirectoryHandle(dirHandle: FileSystemDirectoryHandle, basePath: string = ''): Promise<File[]> {
  const files: File[] = [];
  
  for await (const [name, handle] of (dirHandle as any).entries()) {
    const path = basePath ? `${basePath}/${name}` : name;
    
    if (handle.kind === 'directory') {
      const subFiles = await scanDirectoryHandle(handle as FileSystemDirectoryHandle, path);
      files.push(...subFiles);
    } else {
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        // Attach relative path to the file
        Object.defineProperty(file, 'relativePath', { value: path, writable: false });
        files.push(file);
      } catch (e) {
        // Skip files we can't read
      }
    }
  }
  
  return files;
}

// ─── SFZ Parser (Lightweight) ───────────────────────────────────────────────

export interface SFZRegion {
  sample: string;
  lokey?: number;
  hikey?: number;
  lovel?: number;
  hivel?: number;
  group?: string;
  offset?: number;
  end?: number;
  loop_mode?: string;
}

function parseSFZ(content: string): SFZRegion[] {
  const regions: SFZRegion[] = [];
  let currentRegion: Partial<SFZRegion> | null = null;
  let currentGroup = '';
  
  const lines = content.split('\n');
  
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    
    if (line === '<group>') {
      currentGroup = '';
      continue;
    }
    
    if (line === '<region>') {
      if (currentRegion && currentRegion.sample) {
        regions.push(currentRegion as SFZRegion);
      }
      currentRegion = { group: currentGroup };
      continue;
    }
    
    if (line.startsWith('<')) continue; // Skip other headers
    
    // Parse key=value pairs
    const pairs = line.split(/\s+/);
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx < 0) continue;
      const key = pair.slice(0, eqIdx).toLowerCase();
      const val = pair.slice(eqIdx + 1);
      
      if (!currentRegion && key !== 'group_label') continue;
      
      switch (key) {
        case 'sample':
          if (currentRegion) currentRegion.sample = val.replace(/\\/g, '/');
          break;
        case 'lokey':
          if (currentRegion) currentRegion.lokey = parseInt(val);
          break;
        case 'hikey':
          if (currentRegion) currentRegion.hikey = parseInt(val);
          break;
        case 'key':
          if (currentRegion) {
            const k = parseInt(val);
            currentRegion.lokey = k;
            currentRegion.hikey = k;
          }
          break;
        case 'lovel':
          if (currentRegion) currentRegion.lovel = parseInt(val);
          break;
        case 'hivel':
          if (currentRegion) currentRegion.hivel = parseInt(val);
          break;
        case 'group_label':
          currentGroup = val;
          break;
        case 'offset':
          if (currentRegion) currentRegion.offset = parseInt(val);
          break;
        case 'end':
          if (currentRegion) currentRegion.end = parseInt(val);
          break;
        case 'loop_mode':
          if (currentRegion) currentRegion.loop_mode = val;
          break;
      }
    }
  }
  
  // Push last region
  if (currentRegion && currentRegion.sample) {
    regions.push(currentRegion as SFZRegion);
  }
  
  return regions;
}

// ─── Kit Detection ──────────────────────────────────────────────────────────

export async function detectKit(files: File[]): Promise<DetectedKit> {
  const samples: KitSample[] = [];
  const nkiFiles: string[] = [];
  let ncwCount = 0;
  let nkxCount = 0;
  let sfzFile: File | null = null;
  let totalSize = 0;
  const warnings: string[] = [];
  
  for (const file of files) {
    const path = (file as any).relativePath || (file as any).webkitRelativePath || file.name;
    const ext = getExtension(file.name);
    totalSize += file.size;
    
    if (AUDIO_EXTENSIONS.has(ext)) {
      samples.push({
        name: file.name,
        file,
        category: detectCategory(path),
        path,
        size: file.size,
      });
    } else if (ext === NI_EXTENSIONS.nki) {
      nkiFiles.push(path);
    } else if (ext === NI_EXTENSIONS.ncw) {
      ncwCount++;
    } else if (ext === NI_EXTENSIONS.nkx) {
      nkxCount++;
    } else if (ext === '.sfz' && !sfzFile) {
      sfzFile = file;
    }
  }
  
  // Build warnings
  if (ncwCount > 0 && samples.length === 0) {
    warnings.push(`This library contains ${ncwCount} NCW files (NI's proprietary compression). Only WAV/AIFF/FLAC samples are supported. Consider converting with NI's Kontakt batch resave.`);
  } else if (ncwCount > 0) {
    warnings.push(`${ncwCount} NCW files were skipped. ${samples.length} compatible samples found.`);
  }
  
  if (nkxCount > 0) {
    warnings.push(`${nkxCount} NKX monolith container(s) detected. Encrypted samples inside cannot be accessed.`);
  }
  
  if (samples.length === 0 && nkiFiles.length > 0) {
    warnings.push('Kontakt instruments (.nki) found but no compatible audio samples. This may be a monolith or NCW-only library.');
  }
  
  // Determine kit type
  let type: DetectedKit['type'] = 'folder';
  if (nkiFiles.length > 0) type = 'kontakt';
  if (sfzFile) type = 'sfz';
  
  // Derive kit name from common root folder
  let kitName = 'Unknown Kit';
  if (files.length > 0) {
    const firstPath = (files[0] as any).webkitRelativePath || (files[0] as any).relativePath || '';
    const rootFolder = firstPath.split('/')[0];
    if (rootFolder) kitName = rootFolder;
  }
  
  // Group by category
  const categories: Partial<Record<SampleCategory, KitSample[]>> = {};
  for (const s of samples) {
    if (!categories[s.category]) categories[s.category] = [];
    categories[s.category]!.push(s);
  }
  
  // Sort each category by name
  for (const cat of Object.values(categories)) {
    cat?.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }
  
  return {
    name: kitName,
    type,
    samples,
    categories,
    sfzFile,
    nkiFiles,
    ncwCount,
    nkxCount,
    totalSize,
    warnings,
  };
}

// ─── Auto-Mapping ───────────────────────────────────────────────────────────

const DEFAULT_SLOT_PRIORITY: SampleCategory[] = [
  'kick', 'snare', 'hihat', 'clap', 'perc', 'cymbal',
];

export function autoMapToSlots(kit: DetectedKit, slotCount: number = 6): SlotMapping[] {
  const SLOT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const mappings: SlotMapping[] = [];
  const usedFiles = new Set<string>();
  
  // Phase 1: Fill slots by priority category
  for (let i = 0; i < slotCount; i++) {
    const targetCategory = DEFAULT_SLOT_PRIORITY[i] || 'other';
    const candidates = kit.categories[targetCategory];
    
    let picked: KitSample | null = null;
    if (candidates) {
      for (const c of candidates) {
        if (!usedFiles.has(c.path)) {
          picked = c;
          usedFiles.add(c.path);
          break;
        }
      }
    }
    
    mappings.push({
      slotIndex: i,
      sample: picked,
      label: SLOT_LABELS[i],
    });
  }
  
  // Phase 2: Fill any empty slots with remaining samples
  const remaining = kit.samples.filter(s => !usedFiles.has(s.path));
  for (const mapping of mappings) {
    if (!mapping.sample && remaining.length > 0) {
      mapping.sample = remaining.shift()!;
      usedFiles.add(mapping.sample.path);
    }
  }
  
  return mappings;
}

// ─── SFZ-Based Mapping ─────────────────────────────────────────────────────

export async function mapFromSFZ(
  sfzFile: File,
  allFiles: File[],
  slotCount: number = 6
): Promise<SlotMapping[]> {
  const SLOT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const content = await sfzFile.text();
  const regions = parseSFZ(content);
  
  // Build a lookup from filename → File object
  const fileMap = new Map<string, File>();
  for (const f of allFiles) {
    const path = (f as any).relativePath || (f as any).webkitRelativePath || f.name;
    // Store by just filename and by relative path
    fileMap.set(f.name.toLowerCase(), f);
    fileMap.set(path.toLowerCase(), f);
    // Also store by the path suffix after any "Samples/" directory
    const samplesIdx = path.toLowerCase().indexOf('samples/');
    if (samplesIdx >= 0) {
      fileMap.set(path.slice(samplesIdx + 8).toLowerCase(), f);
    }
  }
  
  const mappings: SlotMapping[] = [];
  const usedSamples = new Set<string>();
  
  // Map first N unique regions to slots
  for (const region of regions) {
    if (mappings.length >= slotCount) break;
    if (usedSamples.has(region.sample.toLowerCase())) continue;
    
    // Try to find the file
    const samplePath = region.sample.toLowerCase();
    const file = fileMap.get(samplePath) 
      || fileMap.get(samplePath.split('/').pop()!)
      || fileMap.get(samplePath.replace(/\\/g, '/'));
    
    if (file) {
      usedSamples.add(region.sample.toLowerCase());
      const ext = getExtension(file.name);
      if (AUDIO_EXTENSIONS.has(ext)) {
        mappings.push({
          slotIndex: mappings.length,
          sample: {
            name: file.name,
            file,
            category: detectCategory(region.sample),
            path: region.sample,
            size: file.size,
          },
          label: SLOT_LABELS[mappings.length],
        });
      }
    }
  }
  
  // Fill remaining slots with nulls
  while (mappings.length < slotCount) {
    mappings.push({
      slotIndex: mappings.length,
      sample: null,
      label: SLOT_LABELS[mappings.length],
    });
  }
  
  return mappings;
}

// ─── Directory Picker ───────────────────────────────────────────────────────

export async function pickDirectory(): Promise<File[]> {
  // Try modern File System Access API first (Chromium)
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
      return await scanDirectoryHandle(dirHandle);
    } catch (e: any) {
      if (e.name === 'AbortError') return []; // User cancelled
      // Fall through to legacy picker
    }
  }
  
  // Fallback: <input webkitdirectory>
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.multiple = true;
    
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      resolve(files);
    };
    
    // Handle cancellation
    input.addEventListener('cancel', () => resolve([]));
    
    input.click();
  });
}

// ─── Utility ────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const CATEGORY_COLORS: Record<SampleCategory, string> = {
  kick:   '#ff4444',
  snare:  '#ff8c00',
  hihat:  '#00e5ff',
  clap:   '#ffeb3b',
  perc:   '#ab47bc',
  cymbal: '#26c6da',
  tom:    '#ef5350',
  fx:     '#7c4dff',
  bass:   '#ff1744',
  keys:   '#69f0ae',
  vocal:  '#f48fb1',
  other:  '#78909c',
};

export const CATEGORY_ICONS: Record<SampleCategory, string> = {
  kick:   '🥁',
  snare:  '🪘',
  hihat:  '🔔',
  clap:   '👏',
  perc:   '🎵',
  cymbal: '🔊',
  tom:    '🎯',
  fx:     '⚡',
  bass:   '🎸',
  keys:   '🎹',
  vocal:  '🎤',
  other:  '📁',
};
