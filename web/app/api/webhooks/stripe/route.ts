import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { handleCheckoutCompleted } from '@/lib/webhookHandler'

function stripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

export async function POST(request: NextRequest) {
  const stripe = stripeClient()
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const db = supabaseAdmin()

    await handleCheckoutCompleted(
      {
        markPurchasePaid: async (stripeSessionId) => {
          const { error } = await db.from('purchases').update({ status: 'paid' }).eq('stripe_session_id', stripeSessionId)
          if (error) throw new Error(error.message)
        },
        linkPurchasePhotos: async (stripeSessionId, photoIds) => {
          const { data: purchase, error: purchaseError } = await db
            .from('purchases')
            .select('id')
            .eq('stripe_session_id', stripeSessionId)
            .single()
          if (purchaseError || !purchase) throw new Error(purchaseError?.message ?? 'purchase_not_found')

          const { error } = await db
            .from('purchase_photos')
            .insert(photoIds.map((photoId) => ({ purchase_id: purchase.id, photo_id: photoId })))
          if (error) throw new Error(error.message)
        },
      },
      { id: session.id, metadata: session.metadata as { eventId: string; photoIds: string } }
    )
  }

  return NextResponse.json({ received: true })
}
