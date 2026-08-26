export type CheckoutDeps = {
  createStripeSession: (params: {
    line_items: { price_data: object; quantity: number }[]
    customer_email: string
    metadata: Record<string, string>
    success_url: string
    cancel_url: string
  }) => Promise<{ id: string; url: string | null }>
  insertPurchase: (row: { eventId: string; stripeSessionId: string; buyerEmail: string }) => Promise<void>
}

export async function buildCheckoutSession(
  deps: CheckoutDeps,
  eventId: string,
  photoIds: string[],
  buyerEmail: string
): Promise<{ url: string }> {
  const priceCents = Number(process.env.PHOTO_PRICE_CENTS ?? 1500)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const session = await deps.createStripeSession({
    line_items: photoIds.map(() => ({
      price_data: {
        currency: 'brl',
        product_data: { name: 'Foto do evento (alta resolução)' },
        unit_amount: priceCents,
      },
      quantity: 1,
    })),
    customer_email: buyerEmail,
    metadata: { eventId, photoIds: photoIds.join(',') },
    success_url: `${siteUrl}/e/obrigado?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/e`,
  })

  if (!session.url) {
    throw new Error('STRIPE_SESSION_MISSING_URL')
  }

  await deps.insertPurchase({
    eventId,
    stripeSessionId: session.id,
    buyerEmail,
  })

  return { url: session.url }
}
