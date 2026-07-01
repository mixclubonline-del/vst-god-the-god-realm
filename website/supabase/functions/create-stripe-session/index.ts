import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecret) {
      throw new Error('STRIPE_SECRET_KEY is not configured in Supabase Secrets.')
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2022-11-15',
    })

    const { email, price, origin } = await req.json()

    if (!email || !price || !origin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing email, price, or origin URL.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: price === 380 ? 'Electric Pantheon - Deity Creator Pre-Order' : 'Electric Pantheon - Gold Edition Pre-Order',
              description: price === 380 
                ? '5 activations, 3D spatial module, all future expansions, theme skin customizer, 24/7 priority support.' 
                : '2 activations, unlocked DSP engine, 50 exclusive divine presets, lifetime v1.x updates.',
            },
            unit_amount: price * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: email.toLowerCase().trim(),
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      metadata: {
        email: email.toLowerCase().trim(),
        price: price.toString(),
      },
    })

    return new Response(
      JSON.stringify({ success: true, url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Server error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
