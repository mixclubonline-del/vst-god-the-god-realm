/**
 * supabase.ts — Supabase client & helpers
 *
 * Initializes the Supabase JS client and exports helper functions
 * for beta signups, downloads, and license validation.
 *
 * Gracefully degrades when credentials are not yet configured
 * (placeholder values in .env).
 */

import { createClient } from '@supabase/supabase-js';

/* ── Client Init ───────────────────────────────────────────── */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** Whether Supabase is configured with real credentials */
export const isSupabaseConfigured =
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('YOUR_PROJECT_ID') &&
  supabaseAnonKey.length > 20;

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key',
);

/** The URL of the user portal (Lovable app) */
export const APP_URL = import.meta.env.VITE_APP_URL ?? 'https://app.vstgod.com';

/* ── Beta Signup ───────────────────────────────────────────── */

export interface BetaSignupResult {
  success: boolean;
  message: string;
  alreadySignedUp?: boolean;
}

/**
 * Submit a beta signup request.
 * Inserts email into the `beta_signups` table.
 * Handles duplicate detection gracefully.
 */
export async function submitBetaSignup(email: string): Promise<BetaSignupResult> {
  if (!isSupabaseConfigured) {
    // Dev/demo mode — simulate success
    console.info('[VST God] Supabase not configured. Simulating beta signup for:', email);
    return {
      success: true,
      message: 'You\'re on the list! We\'ll reach out when your invite is ready.',
    };
  }

  try {
    const { error } = await supabase
      .from('beta_signups')
      .insert({ email: email.toLowerCase().trim(), source: 'website' });

    if (error) {
      // Unique constraint violation = already signed up
      if (error.code === '23505') {
        return {
          success: true,
          alreadySignedUp: true,
          message: 'You\'re already on the list! We\'ll reach out soon.',
        };
      }
      console.error('[VST God] Beta signup error:', error);
      return { success: false, message: 'Something went wrong. Please try again.' };
    }

    return {
      success: true,
      message: 'You\'re on the list! We\'ll reach out when your invite is ready.',
    };
  } catch (err) {
    console.error('[VST God] Beta signup exception:', err);
    return { success: false, message: 'Connection error. Please try again.' };
  }
}

/* ── Download Helpers ──────────────────────────────────────── */

/**
 * Get a signed download URL for a plugin binary.
 * Requires the user to be authenticated.
 */
export async function getSignedDownloadUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.storage
    .from('plugin-builds')
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    console.error('[VST God] Download URL error:', error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Track a download event.
 */
export async function trackDownload(params: {
  pluginVersion: string;
  platform: 'macos' | 'windows';
  format: 'vst3' | 'au' | 'standalone' | 'bundle';
  licenseId?: string;
}) {
  if (!isSupabaseConfigured) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('downloads').insert({
    user_id: user.id,
    license_id: params.licenseId ?? null,
    plugin_version: params.pluginVersion,
    platform: params.platform,
    format: params.format,
  });
}

/* ── Pre-Order Purchases ───────────────────────────────────── */

export interface PreOrderResult {
  success: boolean;
  licenseKey?: string;
  linkedImmediately?: boolean;
  error?: string;
}

/**
 * Record a completed pre-order purchase in Supabase.
 * Calls the `create_pre_order_purchase` database RPC.
 */
export async function createPreOrder(
  email: string,
  amountCents: number,
  paymentIntentId: string,
): Promise<PreOrderResult> {
  if (!isSupabaseConfigured) {
    // Dev/mock mode — simulate success and generate mock key
    console.info('[VST God] Supabase not configured. Simulating pre-order for:', email);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate networking
    const mockKey = 'VSTGOD-' + Array.from({ length: 4 }, () =>
      Math.random().toString(36).substring(2, 6).toUpperCase()
    ).join('-');
    return {
      success: true,
      licenseKey: mockKey,
      linkedImmediately: false,
    };
  }

  try {
    const { data, error } = await supabase.rpc('create_pre_order_purchase', {
      p_email: email.toLowerCase().trim(),
      p_amount_cents: amountCents,
      p_payment_intent: paymentIntentId,
    });

    if (error) {
      console.error('[VST God] Pre-order RPC error:', error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; license_key?: string; linked_immediately?: boolean; error?: string };
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to complete pre-order.' };
    }

    return {
      success: true,
      licenseKey: result.license_key,
      linkedImmediately: result.linked_immediately,
    };
  } catch (err: any) {
    console.error('[VST God] Pre-order exception:', err);
    return { success: false, error: err.message || 'Connection error. Please try again.' };
  }
}

/**
 * Create a Stripe Checkout session by calling the Edge Function.
 */
export async function createStripeCheckoutSession(
  email: string,
  price: number
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    // Dev mock checkout session redirect
    console.info('[VST God] Supabase not configured. Mocking Stripe checkout redirect for:', email, price);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Redirect back after 1 sec with mock session id
    const mockSessionId = 'cs_mock_' + Math.random().toString(36).substring(2, 12);
    return {
      success: true,
      url: `${window.location.origin}/?session_id=${mockSessionId}`,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('create-stripe-session', {
      body: {
        email,
        price,
        origin: window.location.origin,
      },
    });

    if (error) {
      console.error('[VST God] Edge function error creating Stripe session:', error);
      return { success: false, error: error.message || 'Failed to create checkout session.' };
    }

    return {
      success: true,
      url: data.url,
    };
  } catch (err: any) {
    console.error('[VST God] Stripe checkout exception:', err);
    return { success: false, error: err.message || 'Connection error. Please try again.' };
  }
}

/**
 * Retrieve the license key generated for a Stripe checkout session.
 */
export async function getLicenseKeyByCheckoutSession(
  sessionId: string
): Promise<{ success: boolean; licenseKey?: string; email?: string; error?: string }> {
  if (!isSupabaseConfigured || sessionId.startsWith('cs_mock_')) {
    // Dev mock key retrieval
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const mockKey = 'VSTGOD-' + Array.from({ length: 4 }, () =>
      Math.random().toString(36).substring(2, 6).toUpperCase()
    ).join('-');
    return {
      success: true,
      licenseKey: mockKey,
      email: 'mock-user@test.com',
    };
  }

  try {
    const { data, error } = await supabase.rpc('get_license_key_by_checkout_session', {
      p_session_id: sessionId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; license_key?: string; email?: string; error?: string };
    if (!result.success) {
      return { success: false, error: result.error || 'Pending key generation...' };
    }

    return {
      success: true,
      licenseKey: result.license_key,
      email: result.email,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Connection error.' };
  }
}

