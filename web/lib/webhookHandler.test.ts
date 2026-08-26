import { describe, it, expect, vi } from 'vitest'
import { handleCheckoutCompleted, type WebhookDeps } from './webhookHandler'

describe('handleCheckoutCompleted', () => {
  it('marks the purchase as paid and links the purchased photos', async () => {
    const deps: WebhookDeps = {
      markPurchasePaid: vi.fn().mockResolvedValue(undefined),
      linkPurchasePhotos: vi.fn().mockResolvedValue(undefined),
    }

    await handleCheckoutCompleted(deps, {
      id: 'sess_123',
      metadata: { eventId: 'event-1', photoIds: 'p1,p2' },
    })

    expect(deps.markPurchasePaid).toHaveBeenCalledWith('sess_123')
    expect(deps.linkPurchasePhotos).toHaveBeenCalledWith('sess_123', ['p1', 'p2'])
  })
})
