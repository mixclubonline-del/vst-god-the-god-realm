import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecret) {
      throw new Error('STRIPE_SECRET_KEY is not configured in Supabase Secrets.')
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2022-11-15',
    })

    const signature = req.headers.get('stripe-signature')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    let event
    if (webhookSecret && signature) {
      const body = await req.text()
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } else {
      // Insecure fallback if webhook secret is not yet set (useful for easy testing)
      const bodyText = await req.text()
      event = JSON.parse(bodyText)
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      const email = session.customer_details?.email || session.metadata?.email
      const amountCents = session.amount_total
      const paymentIntentId = (session.payment_intent as string) || `stripe_${session.id}`
      const checkoutSessionId = session.id

      if (!email || !amountCents) {
        throw new Error('Missing customer email or payment amount in session.')
      }

      // Initialize Supabase Client with service role key to bypass RLS
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Call database function to create purchase record and generate license key
      const { data, error } = await supabase.rpc('create_pre_order_purchase', {
        p_email: email,
        p_amount_cents: amountCents,
        p_payment_intent: paymentIntentId,
        p_checkout_session: checkoutSessionId,
      })

      if (error) {
        console.error('[Stripe Webhook] Error calling create_pre_order_purchase:', error)
        throw error
      }

      console.log(`[Stripe Webhook] Pre-order purchase created successfully for ${email}. Result:`, data)

      // Dispatch license confirmation email via Resend if API key is configured
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (resendApiKey && data && data.success && data.license_key) {
        try {
          const isDeity = amountCents >= 30000;
          const tierName = isDeity ? "Deity Creator Tier" : "Gold Edition Tier";
          const activations = isDeity ? "5 machines" : "2 machines";
          const senderEmail = Deno.env.get('SENDER_EMAIL') || 'noreply@vstgod.com';

          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: `VST GOD <${senderEmail}>`,
              to: [email],
              subject: 'Your VST GOD Pre-Order License Key!',
              html: `
                <div style="font-family: sans-serif; background-color: #0b0b0f; color: #ffffff; padding: 40px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(194, 150, 35, 0.15);">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="color: #e8c547; font-size: 26px; margin: 0; text-shadow: 0 0 10px rgba(232, 197, 71, 0.3); font-weight: 800; tracking-spacing: 2px;">VST GOD</h2>
                    <span style="font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 0.2em;">The God Realm Activation</span>
                  </div>
                  <p style="font-size: 15px; line-height: 1.5; color: #e4e4e7;">Thank you for pre-ordering the <strong>VST GOD - God Realm</strong>!</p>
                  <p style="font-size: 15px; line-height: 1.5; color: #e4e4e7;">Your transaction has been processed successfully. Below are your activation credentials:</p>
                  
                  <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); padding: 24px; border-radius: 8px; margin: 30px 0; text-align: center;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #a1a1aa; letter-spacing: 0.1em; display: block; margin-bottom: 8px;">Your Pre-Order License Key</span>
                    <strong style="font-family: monospace; font-size: 22px; color: #ffffff; letter-spacing: 1px; display: block; margin-bottom: 8px;">${data.license_key}</strong>
                    <span style="font-size: 12px; color: #e8c547; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Tier: ${tierName} (Max ${activations})</span>
                  </div>

                  <p style="margin-top: 30px; font-size: 15px; font-weight: bold; color: #ffffff;">Next Steps:</p>
                  <ol style="padding-left: 20px; line-height: 1.6; font-size: 14px; color: #d4d4d8;">
                    <li style="margin-bottom: 8px;">Download the VST GOD plugin installation package from your profile dashboard once the beta client launches.</li>
                    <li style="margin-bottom: 8px;">Open the VST plugin in your DAW (FL Studio, Ableton, Logic, Pro Tools, etc.).</li>
                    <li style="margin-bottom: 8px;">Paste your license key above into the activation panel to bind your machine and unlock the full synth engine.</li>
                  </ol>

                  <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 30px 0;" />
                  <p style="font-size: 11px; color: #71717a; text-align: center; line-height: 1.5;">
                    Need help or have questions? Reach out to us at support@vstgod.com<br/>
                    © 2026 VST GOD. All rights reserved.
                  </p>
                </div>
              `
            })
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error('[Resend Email Fail] Response:', errText);
          } else {
            console.log(`[Resend Email Success] Dispatched pre-order license confirmation email to ${email}`);
          }
        } catch (emailErr: any) {
          console.error('[Stripe Webhook Email Dispatch Exception] Error:', emailErr.message);
        }
      } else {
        console.warn('[Stripe Webhook] RESEND_API_KEY is not configured or no license was generated. Skipping confirmation email.');
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[Stripe Webhook Exception] Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
