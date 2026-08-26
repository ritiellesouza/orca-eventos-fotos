import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { buildCheckoutSession } from '@/lib/checkout'
import { isUuid } from '@/lib/validation'

function stripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

export async function POST(request: NextRequest) {
  const { eventId, photoIds, buyerEmail } = await request.json()

  if (!eventId || !Array.isArray(photoIds) || photoIds.length === 0 || !buyerEmail) {
    return NextResponse.json({ error: 'eventId, photoIds and buyerEmail are required' }, { status: 400 })
  }

  if (!isUuid(eventId) || !photoIds.every(isUuid)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // The slug is read from the database rather than trusted from the request so
  // cancel_url can never be pointed at an unrelated event (or off-site).
  const { data: event, error: eventError } = await db
    .from('events')
    .select('slug')
    .eq('id', eventId)
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 400 })
  }

  // Without this, a bogus photo id takes the buyer's money and then blows up
  // with an FK violation in the webhook, which Stripe retries forever.
  const uniquePhotoIds = Array.from(new Set<string>(photoIds))
  const { data: photos, error: photosError } = await db
    .from('photos')
    .select('id')
    .eq('event_id', eventId)
    .in('id', uniquePhotoIds)

  if (photosError) {
    return NextResponse.json({ error: 'photo_lookup_failed' }, { status: 500 })
  }

  if ((photos?.length ?? 0) !== uniquePhotoIds.length) {
    return NextResponse.json({ error: 'unknown_photo_ids' }, { status: 400 })
  }

  const stripe = stripeClient()

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
    event.slug,
    uniquePhotoIds,
    buyerEmail
  )

  return NextResponse.json(result)
}
