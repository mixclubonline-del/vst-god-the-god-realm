import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 20;

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key',
);

export interface ActivationResult {
  success: boolean;
  message: string;
}

/**
 * Call the secure RPC function in Supabase to activate a license.
 */
export async function activateLicense(
  key: string,
  machineId: string,
  platform: string,
  version: string
): Promise<ActivationResult> {
  if (!isSupabaseConfigured) {
    console.info('[VST God] Supabase not configured. Simulating activation.');
    if (key === 'VSTGOD-TEST-KEY-1234-5678') {
      return { success: true, message: 'License activated successfully (simulated).' };
    }
    return { success: false, message: 'Invalid license key (simulated).' };
  }

  try {
    const { data, error } = await supabase.rpc('activate_license', {
      p_key: key.trim(),
      p_machine_id: machineId,
      p_platform: platform,
      p_version: version,
    });

    if (error) {
      console.error('[Supabase RPC Error]', error);
      return { success: false, message: error.message };
    }

    if (typeof data === 'boolean') {
      return {
        success: data,
        message: data ? 'License activated successfully.' : 'Activation failed. Please check your key.',
      };
    }

    if (data && typeof data === 'object') {
      const res = data as any;
      return {
        success: !!res.success,
        message: res.message || (res.success ? 'License activated successfully.' : 'Activation failed.'),
      };
    }

    return { success: true, message: 'License activated.' };
  } catch (err: any) {
    console.error('[Supabase RPC Exception]', err);
    return { success: false, message: err?.message || 'An unexpected error occurred during activation.' };
  }
}

/**
 * Helper to compare semantic versions (e.g., v1.0.0-dev vs v1.0.1-beta)
 */
export function isVersionNewer(current: string, latest: string): boolean {
  const clean = (v: string) => v.replace(/^v/, '').split(/[-_]/)[0];
  const cParts = clean(current).split('.').map(Number);
  const lParts = clean(latest).split('.').map(Number);
  
  for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
    const c = cParts[i] || 0;
    const l = lParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  
  // Pre-release tag checks (e.g. "-beta" is newer than "-dev")
  if (latest !== current && !latest.includes('dev') && current.includes('dev')) {
    return true;
  }
  return false;
}

/**
 * Check if a new version is available in Supabase.
 */
export async function checkForUpdates(currentVersion: string): Promise<any | null> {
  if (!isSupabaseConfigured) {
    console.info('[VST God] Supabase not configured. Simulating update check (new version available).');
    const mockRelease = {
      version: 'v1.0.1-beta',
      release_notes: JSON.stringify({
        features: [
          '⚡ Alchemical License Key activation overlays',
          '🔮 Midnight Ember & Celestial Gold UI aesthetic overrides',
          '⚡ Sample-accurate periodic volume watermark',
          '🧠 Real-time CPU & telemetry sync'
        ],
        fixes: [
          'Fixed mono sample channel load safety assertions',
          'Fixed C++ settings file path creation safety'
        ]
      }),
      macos_vst3_path: 'https://placeholder.supabase.co/plugin-builds/VST_God_The_God_Realm.vst3.zip',
      macos_au_path: 'https://placeholder.supabase.co/plugin-builds/VST_God_The_God_Realm.component.zip',
      macos_standalone_path: 'https://placeholder.supabase.co/plugin-builds/VST_God_The_God_Realm_Standalone.zip',
      windows_vst3_path: 'https://placeholder.supabase.co/plugin-builds/VST_God_The_God_Realm_x64.msi.zip',
      is_beta: true,
      released_at: new Date().toISOString()
    };
    return isVersionNewer(currentVersion, mockRelease.version) ? mockRelease : null;
  }

  try {
    const { data, error } = await supabase
      .from('plugin_releases')
      .select('*')
      .eq('is_latest', true)
      .maybeSingle();

    if (error) {
      console.error('[Supabase Update Check Error]', error);
      return null;
    }

    if (data && isVersionNewer(currentVersion, data.version)) {
      return data;
    }
    return null;
  } catch (err) {
    console.error('[Supabase Update Check Exception]', err);
    return null;
  }
}

/**
 * Log a download event in the Supabase downloads table.
 */
export async function trackDownloadEvent(
  version: string,
  platform: 'macos' | 'windows',
  format: 'vst3' | 'au' | 'standalone' | 'bundle',
  licenseId?: string
): Promise<void> {
  if (!isSupabaseConfigured) {
    console.info('[VST God] Supabase not configured. Simulating download event logging:', { version, platform, format });
    return;
  }

  try {
    const { error } = await supabase.from('downloads').insert({
      plugin_version: version,
      platform,
      format,
      license_id: licenseId || null,
    });

    if (error) {
      console.error('[Supabase Download Log Error]', error);
    }
  } catch (err) {
    console.error('[Supabase Download Log Exception]', err);
  }
}

export interface PresetBackup {
  license_key: string;
  machine_id: string;
  presets_json: string;
  updated_at?: string;
}

export interface CommunityPreset {
  id: string;
  name: string;
  type: string;
  author: string;
  rating: number;
  tags: string[];
  energy_level: number;
  state: any;
  downloads: number;
  created_at?: string;
}

export interface ExpansionKit {
  id: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  download_count: number;
  presets: any[];
  created_at?: string;
}

/**
 * Upload all user presets to the cloud backup table.
 */
export async function uploadPresetsBackup(
  licenseKey: string,
  machineId: string,
  presetsJson: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    console.info('[VST God] Supabase not configured. Simulating backup upload.');
    try {
      localStorage.setItem('vst-god-realm-mock-cloud-backup', presetsJson);
      return { success: true, message: 'Backup successfully completed (simulated).' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to save mock backup.' };
    }
  }

  try {
    const { error } = await supabase.from('preset_backups').upsert({
      license_key: licenseKey.trim(),
      machine_id: machineId,
      presets_json: presetsJson,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'license_key,machine_id' });

    if (error) {
      console.error('[Supabase Backup Error]', error);
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Backup successfully completed.' };
  } catch (err: any) {
    console.error('[Supabase Backup Exception]', err);
    return { success: false, message: err?.message || 'An error occurred during backup.' };
  }
}

/**
 * Retrieve user presets from the cloud backup table.
 */
export async function downloadPresetsBackup(
  licenseKey: string,
  machineId: string
): Promise<{ success: boolean; data: string | null; message: string }> {
  if (!isSupabaseConfigured) {
    console.info('[VST God] Supabase not configured. Simulating backup download.');
    const mockData = localStorage.getItem('vst-god-realm-mock-cloud-backup');
    if (mockData) {
      return { success: true, data: mockData, message: 'Backup restored successfully (simulated).' };
    }
    return { success: false, data: null, message: 'No mock backup found in local storage.' };
  }

  try {
    const { data, error } = await supabase
      .from('preset_backups')
      .select('presets_json')
      .eq('license_key', licenseKey.trim())
      .eq('machine_id', machineId)
      .maybeSingle();

    if (error) {
      console.error('[Supabase Restore Error]', error);
      return { success: false, data: null, message: error.message };
    }

    if (data) {
      return { success: true, data: data.presets_json, message: 'Backup restored successfully.' };
    }
    return { success: false, data: null, message: 'No backup found for this device.' };
  } catch (err: any) {
    console.error('[Supabase Restore Exception]', err);
    return { success: false, data: null, message: err?.message || 'An error occurred during restore.' };
  }
}

/**
 * Share a single custom preset to the community presets table.
 */
export async function sharePreset(
  licenseKey: string,
  machineId: string,
  preset: any
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    console.info('[VST God] Supabase not configured. Simulating preset upload.');
    try {
      const stored = localStorage.getItem('vst-god-realm-mock-community-presets') || '[]';
      const presets = JSON.parse(stored);
      // Remove any existing one with same name/author to avoid clutter
      const filtered = presets.filter((p: any) => p.name !== preset.name);
      filtered.push({
        ...preset,
        id: `shared-${Date.now()}`,
        downloads: 0,
        created_at: new Date().toISOString()
      });
      localStorage.setItem('vst-god-realm-mock-community-presets', JSON.stringify(filtered));
      return { success: true, message: 'Preset shared successfully (simulated).' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to save mock shared preset.' };
    }
  }

  try {
    const { error } = await supabase.from('community_presets').insert({
      name: preset.name,
      type: preset.type,
      author: preset.author,
      rating: preset.rating || 3,
      tags: preset.tags || [],
      energy_level: preset.energyLevel || 50,
      state: preset.state,
      license_key: licenseKey.trim(),
      machine_id: machineId,
      downloads: 0,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('[Supabase Share Preset Error]', error);
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Preset shared successfully.' };
  } catch (err: any) {
    console.error('[Supabase Share Preset Exception]', err);
    return { success: false, message: err?.message || 'An error occurred while sharing preset.' };
  }
}

/**
 * Fetch all shared community presets.
 */
export async function fetchCommunityPresets(): Promise<CommunityPreset[]> {
  if (!isSupabaseConfigured) {
    console.info('[VST God] Supabase not configured. Simulating fetching community presets.');
    const stored = localStorage.getItem('vst-god-realm-mock-community-presets') || '[]';
    const presets = JSON.parse(stored);
    
    // Default initial mock community presets from other gods
    const defaultCommunity = [
      {
        id: 'shared-thor-strike',
        name: 'Thor Hammer',
        type: 'Lead',
        author: 'Thor',
        rating: 5,
        tags: ['Lead', 'Ember', 'Electric'],
        energy_level: 88,
        state: { params: { energy: 90, divinity: 30, width: 60, realm: 40, filterFreq: 75, filterQ: 50, attack: 2, decay: 30, sustain: 50, release: 20, reverbMix: 30, chorusMix: 40, delayMix: 45, modIndex: 65, bodyGain: 70, subOscGain: 30, satDrive: 60, satMix: 40, detuneCents: 20, morphBlend: 40, masterGain: 75 } },
        downloads: 124
      },
      {
        id: 'shared-anubis-tomb',
        name: 'Anubis Tomb',
        type: 'Bass',
        author: 'Underworld_Lord',
        rating: 5,
        tags: ['Bass', 'Sub', 'Deep'],
        energy_level: 65,
        state: { params: { energy: 75, divinity: 45, width: 30, realm: 80, filterFreq: 25, filterQ: 40, attack: 4, decay: 45, sustain: 75, release: 25, reverbMix: 20, chorusMix: 15, delayMix: 10, modIndex: 35, bodyGain: 80, subOscGain: 90, satDrive: 50, satMix: 35, detuneCents: 5, morphBlend: 20, masterGain: 80 } },
        downloads: 87
      }
    ];

    return [...presets, ...defaultCommunity];
  }

  try {
    const { data, error } = await supabase
      .from('community_presets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase Fetch Community Error]', error);
      return [];
    }
    return (data || []).map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      author: d.author,
      rating: d.rating,
      tags: d.tags || [],
      energy_level: d.energy_level,
      state: d.state,
      downloads: d.downloads || 0,
      created_at: d.created_at
    }));
  } catch (err) {
    console.error('[Supabase Fetch Community Exception]', err);
    return [];
  }
}

const MOCK_KITS: ExpansionKit[] = [
  {
    id: 'kit-ethereal-void',
    name: 'Ethereal Void Pack',
    description: 'Dark ambient textures, cosmic atmospheres, and endless reverbs from the outer edges of the universe.',
    author: 'Voidweaver',
    tags: ['Ambient', 'Void', 'Dark', 'Cinematic'],
    download_count: 342,
    presets: [
      {
        name: 'Void Whisper',
        type: 'Textures',
        author: 'Voidweaver',
        rating: 5,
        fav: false,
        tags: ['Void', 'Ambient', 'Ethereal'],
        energyLevel: 35,
        state: { params: { energy: 30, divinity: 85, width: 95, realm: 80, filterFreq: 35, filterQ: 20, attack: 85, decay: 60, sustain: 85, release: 95, reverbMix: 90, chorusMix: 50, delayMix: 40, modIndex: 15, bodyGain: 45, subOscGain: 30, satDrive: 5, satMix: 5, detuneCents: 25, morphBlend: 65, masterGain: 65 } }
      },
      {
        name: 'Singularity Bass',
        type: 'Bass',
        author: 'Voidweaver',
        rating: 4,
        fav: false,
        tags: ['Void', 'Deep', 'Heavy'],
        energyLevel: 78,
        state: { params: { energy: 80, divinity: 30, width: 25, realm: 75, filterFreq: 25, filterQ: 45, attack: 5, decay: 50, sustain: 65, release: 30, reverbMix: 25, chorusMix: 15, delayMix: 10, modIndex: 40, bodyGain: 85, subOscGain: 95, satDrive: 70, satMix: 55, detuneCents: 10, morphBlend: 30, masterGain: 75 } }
      }
    ]
  },
  {
    id: 'kit-valhalla-horizon',
    name: 'Valhalla Horizon',
    description: 'Epic cinematic brasses, heroic plucks, and soaring polyphonic pads fit for the halls of Odin.',
    author: 'OdinSon',
    tags: ['Cinematic', 'Valiant', 'Epic', 'Brass'],
    download_count: 512,
    presets: [
      {
        name: 'Bifrost Arp',
        type: 'Arp',
        author: 'OdinSon',
        rating: 5,
        fav: false,
        tags: ['Epic', 'Arp', 'Bright'],
        energyLevel: 82,
        state: { params: { energy: 85, divinity: 65, width: 70, realm: 60, filterFreq: 70, filterQ: 40, attack: 3, decay: 35, sustain: 50, release: 25, reverbMix: 45, chorusMix: 30, delayMix: 50, modIndex: 45, bodyGain: 70, subOscGain: 35, satDrive: 30, satMix: 20, detuneCents: 15, morphBlend: 50, masterGain: 78 } }
      },
      {
        name: 'Valhalla Horns',
        type: 'Lead',
        author: 'OdinSon',
        rating: 5,
        fav: false,
        tags: ['Epic', 'Brass', 'Cinematic'],
        energyLevel: 72,
        state: { params: { energy: 75, divinity: 70, width: 65, realm: 65, filterFreq: 50, filterQ: 30, attack: 15, decay: 45, sustain: 75, release: 40, reverbMix: 55, chorusMix: 25, delayMix: 20, modIndex: 35, bodyGain: 65, subOscGain: 40, satDrive: 20, satMix: 15, detuneCents: 12, morphBlend: 45, masterGain: 80 } }
      }
    ]
  },
  {
    id: 'kit-neon-cyber',
    name: 'Neon Cyber-God',
    description: 'Electrified synthwave basses, screaming laser leads, and retro futuristic bells with a digital bite.',
    author: 'Vektor',
    tags: ['Cyberpunk', 'Neon', 'Retro', 'Synthwave'],
    download_count: 289,
    presets: [
      {
        name: 'Screaming Laser',
        type: 'Lead',
        author: 'Vektor',
        rating: 4,
        fav: false,
        tags: ['Cyberpunk', 'Lead', 'Aggressive'],
        energyLevel: 90,
        state: { params: { energy: 95, divinity: 30, width: 50, realm: 45, filterFreq: 85, filterQ: 65, attack: 1, decay: 20, sustain: 40, release: 15, reverbMix: 20, chorusMix: 35, delayMix: 40, modIndex: 75, bodyGain: 75, subOscGain: 20, satDrive: 65, satMix: 50, detuneCents: 35, morphBlend: 40, masterGain: 75 } }
      },
      {
        name: 'Cyber Grid Bass',
        type: 'Bass',
        author: 'Vektor',
        rating: 5,
        fav: false,
        tags: ['Cyberpunk', 'Bass', 'Aggressive'],
        energyLevel: 85,
        state: { params: { energy: 90, divinity: 35, width: 35, realm: 50, filterFreq: 40, filterQ: 55, attack: 2, decay: 40, sustain: 70, release: 20, reverbMix: 15, chorusMix: 25, delayMix: 15, modIndex: 50, bodyGain: 80, subOscGain: 80, satDrive: 60, satMix: 45, detuneCents: 15, morphBlend: 35, masterGain: 80 } }
      }
    ]
  }
];

/**
 * Fetch official/community preset expansion kits.
 */
export async function fetchExpansionKits(): Promise<ExpansionKit[]> {
  if (!isSupabaseConfigured) {
    console.info('[VST God] Supabase not configured. Simulating fetching expansion kits.');
    const stored = localStorage.getItem('vst-god-realm-mock-kits');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    // Set initial mock kits in storage
    localStorage.setItem('vst-god-realm-mock-kits', JSON.stringify(MOCK_KITS));
    return MOCK_KITS;
  }

  try {
    const { data, error } = await supabase
      .from('expansion_kits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase Fetch Kits Error]', error);
      return MOCK_KITS; // fallback
    }

    if (!data || data.length === 0) {
      return MOCK_KITS; // fallback
    }

    return data.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      author: d.author,
      tags: d.tags || [],
      download_count: d.download_count || 0,
      presets: d.presets || []
    }));
  } catch (err) {
    console.error('[Supabase Fetch Kits Exception]', err);
    return MOCK_KITS; // fallback
  }
}

/**
 * Increment expansion kit download count.
 */
export async function incrementKitDownload(kitId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const stored = localStorage.getItem('vst-god-realm-mock-kits');
    if (stored) {
      try {
        const kits = JSON.parse(stored) as ExpansionKit[];
        const updated = kits.map(k => k.id === kitId ? { ...k, download_count: k.download_count + 1 } : k);
        localStorage.setItem('vst-god-realm-mock-kits', JSON.stringify(updated));
      } catch {}
    }
    return;
  }

  try {
    // Increment via supabase rpc or simple update
    // Fetch current count first
    const { data } = await supabase
      .from('expansion_kits')
      .select('download_count')
      .eq('id', kitId)
      .maybeSingle();
    
    if (data) {
      await supabase
        .from('expansion_kits')
        .update({ download_count: (data.download_count || 0) + 1 })
        .eq('id', kitId);
    }
  } catch (err) {
    console.error('[Supabase Kit Download Increment Exception]', err);
  }
}

/**
 * Increment community preset download count.
 */
export async function incrementPresetDownload(presetId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const stored = localStorage.getItem('vst-god-realm-mock-community-presets') || '[]';
    try {
      const presets = JSON.parse(stored);
      const updated = presets.map((p: any) => p.id === presetId ? { ...p, downloads: (p.downloads || 0) + 1 } : p);
      localStorage.setItem('vst-god-realm-mock-community-presets', JSON.stringify(updated));
    } catch {}
    return;
  }

  try {
    const { data } = await supabase
      .from('community_presets')
      .select('downloads')
      .eq('id', presetId)
      .maybeSingle();

    if (data) {
      await supabase
        .from('community_presets')
        .update({ downloads: (data.downloads || 0) + 1 })
        .eq('id', presetId);
    }
  } catch (err) {
    console.error('[Supabase Preset Download Increment Exception]', err);
  }
}
