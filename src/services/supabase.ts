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
