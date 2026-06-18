import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { key, machine_id, platform, version, action = 'verify' } = await req.json()

    if (!key || !machine_id || !platform) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing key, machine_id, or platform.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (action === 'activate') {
      // Call the database function to activate
      const { data, error } = await supabaseClient.rpc('activate_license', {
        p_key: key.trim(),
        p_machine_id: machine_id,
        p_platform: platform,
        p_version: version ?? 'v1.0.0',
      })

      if (error) {
        return new Response(
          JSON.stringify({ success: false, message: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const res = data as any
      return new Response(
        JSON.stringify({ success: !!res.success, message: res.message, license_type: res.license_type }),
        { status: res.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Verify action: Check if license key exists, is active, and is registered to this machine_id
      const { data: license, error: licenseError } = await supabaseClient
        .from('license_keys')
        .select('id, status, type')
        .eq('key', key.trim())
        .maybeSingle()

      if (licenseError || !license) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid license key.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (license.status !== 'active') {
        return new Response(
          JSON.stringify({ success: false, message: `License key is ${license.status}.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if machine is registered
      const { data: activation, error: activationError } = await supabaseClient
        .from('license_activations')
        .select('id')
        .eq('license_id', license.id)
        .eq('machine_id', machine_id)
        .maybeSingle()

      if (activationError || !activation) {
        return new Response(
          JSON.stringify({ success: false, message: 'This machine is not authorized.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update last seen time for this activation
      await supabaseClient
        .from('license_activations')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', activation.id)

      return new Response(
        JSON.stringify({ success: true, message: 'License verified successfully.', license_type: license.type }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Server error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
