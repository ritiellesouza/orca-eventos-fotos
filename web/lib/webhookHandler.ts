export type WebhookDeps = {
  markPurchasePaid: (stripeSessionId: string) => Promise<void>
  linkPurchasePhotos: (stripeSessionId: string, photoIds: string[]) => Promise<void>
}

export async function handleCheckoutCompleted(
  deps: WebhookDeps,
  session: { id: string; metadata: { eventId: string; photoIds: string } }
): Promise<void> {
  await deps.markPurchasePaid(session.id)

  // Stripe retries a webhook until it gets a 2xx, so this whole path has to be
  // safe to run more than once. Dropping blanks and duplicates here keeps the
  // insert from tripping the purchase_photos primary key or an FK on ''.
  const photoIds = Array.from(new Set(session.metadata.photoIds.split(',').filter(Boolean)))

  if (photoIds.length === 0) {
    return
  }

  await deps.linkPurchasePhotos(session.id, photoIds)
}
