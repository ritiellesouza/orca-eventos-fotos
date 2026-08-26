import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { buildCheckoutSession } from '@/lib/checkout'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const { eventId, photoIds, buyerEmail } = await request.json()

  if (!eventId || !Array.isArray(photoIds) || photoIds.length === 0 || !buyerEmail) {
    return NextResponse.json({ error: 'eventId, photoIds and buyerEmail are required' }, { status: 400 })
  }

  const db = supabaseAdmin()

  const result = await buildCheckoutSession(
    {
      createStripeSession: (params) =>
        stripe.checkout.sessions.create({ mode: 'payment', ...params } as Stripe.Checkout.SessionCreateParams),
      insertPurchase: async (row) => {
        const { error } = await db.from('purchases').insert({
          event_id: row.eventId,
          stripe_session_id: row.stripeSessionId,
          buyer_email: row.buyerEmail,
        })
        if (error) throw new Error(error.message)
      },
    },
    eventId,
    photoIds,
    buyerEmail
  )

  return NextResponse.json(result)
}
