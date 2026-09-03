import { describe, it, expect, vi } from 'vitest'
import { handleCheckoutCompleted, type WebhookDeps } from './webhookHandler'

function makeDeps(): WebhookDeps {
  return {
    markPurchasePaid: vi.fn().mockResolvedValue(undefined),
    linkPurchasePhotos: vi.fn().mockResolvedValue(undefined),
  }
}

describe('handleCheckoutCompleted', () => {
  it('marks the purchase as paid and links the purchased photos', async () => {
    const deps = makeDeps()

    await handleCheckoutCompleted(deps, {
      id: 'sess_123',
      metadata: { eventId: 'event-1', photoIds: 'p1,p2' },
    })

    expect(deps.markPurchasePaid).toHaveBeenCalledWith('sess_123')
    expect(deps.linkPurchasePhotos).toHaveBeenCalledWith('sess_123', ['p1', 'p2'])
  })

  it('de-duplicates photo ids so a retry cannot collide on the purchase_photos key', async () => {
    const deps = makeDeps()

    await handleCheckoutCompleted(deps, {
      id: 'sess_123',
      metadata: { eventId: 'event-1', photoIds: 'p1,p2,p1' },
    })

    expect(deps.linkPurchasePhotos).toHaveBeenCalledWith('sess_123', ['p1', 'p2'])
  })

  it('skips the link step when metadata carries no photo ids', async () => {
    const deps = makeDeps()

    await handleCheckoutCompleted(deps, {
      id: 'sess_123',
      metadata: { eventId: 'event-1', photoIds: '' },
    })

    expect(deps.markPurchasePaid).toHaveBeenCalledWith('sess_123')
    expect(deps.linkPurchasePhotos).not.toHaveBeenCalled()
  })
})
