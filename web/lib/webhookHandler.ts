export type WebhookDeps = {
  markPurchasePaid: (stripeSessionId: string) => Promise<void>
  linkPurchasePhotos: (stripeSessionId: string, photoIds: string[]) => Promise<void>
}

export async function handleCheckoutCompleted(
  deps: WebhookDeps,
  session: { id: string; metadata: { eventId: string; photoIds: string } }
): Promise<void> {
  await deps.markPurchasePaid(session.id)
  await deps.linkPurchasePhotos(session.id, session.metadata.photoIds.split(','))
}
