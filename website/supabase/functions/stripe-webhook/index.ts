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
