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

    // data is expected to be a JSON/Record or boolean/string depending on the RPC return value.
    // Let's assume it returns a JSON object with: { success: boolean, message: string }
    // Or if it returns a boolean, let's handle both.
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
