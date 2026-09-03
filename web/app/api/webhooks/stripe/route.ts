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

    try {
      await handleCheckoutCompleted(
        {
          markPurchasePaid: async (stripeSessionId) => {
            // .update().eq() reports no error when it matches zero rows, so the
            // payment would be taken and silently never marked paid. Ask for the
            // affected rows back and treat an empty result as a hard failure.
            const { data, error } = await db
              .from('purchases')
              .update({ status: 'paid' })
              .eq('stripe_session_id', stripeSessionId)
              .select('id')
            if (error) throw new Error(error.message)
            if (!data || data.length === 0) {
              throw new Error(`PURCHASE_NOT_FOUND_FOR_SESSION:${stripeSessionId}`)
            }
          },
          linkPurchasePhotos: async (stripeSessionId, photoIds) => {
            const { data: purchase, error: purchaseError } = await db
              .from('purchases')
              .select('id')
              .eq('stripe_session_id', stripeSessionId)
              .single()
            if (purchaseError || !purchase) throw new Error(purchaseError?.message ?? 'purchase_not_found')

            // Stripe retries until it sees a 2xx, so this insert must tolerate
            // being replayed: ignore rows already linked instead of throwing on
            // the purchase_photos primary key.
            const { error } = await db
              .from('purchase_photos')
              .upsert(
                photoIds.map((photoId) => ({ purchase_id: purchase.id, photo_id: photoId })),
                { onConflict: 'purchase_id,photo_id', ignoreDuplicates: true }
              )
            if (error) throw new Error(error.message)
          },
        },
        { id: session.id, metadata: session.metadata as { eventId: string; photoIds: string } }
      )
    } catch (err) {
      // Money has already changed hands at this point, so a failure here has to
      // be visible in the server log rather than just a bare 500 to Stripe.
      console.error(
        `[stripe-webhook] failed to fulfil checkout.session.completed for session ${session.id}:`,
        err
      )
      throw err
    }
  }

  return NextResponse.json({ received: true })
}
