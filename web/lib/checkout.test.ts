import { describe, it, expect, vi } from 'vitest'
import { buildCheckoutSession, type CheckoutDeps } from './checkout'

describe('buildCheckoutSession', () => {
  it('creates one line item per photo, records the purchase, and returns the session url', async () => {
    const deps: CheckoutDeps = {
      createStripeSession: vi.fn().mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/session-123' }),
      insertPurchase: vi.fn().mockResolvedValue(undefined),
    }

    const result = await buildCheckoutSession(deps, 'event-1', ['p1', 'p2'], 'buyer@example.com')

    expect(result).toEqual({ url: 'https://checkout.stripe.com/session-123' })
    const call = (deps.createStripeSession as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.line_items).toHaveLength(2)
    expect(call.customer_email).toBe('buyer@example.com')
    expect(call.metadata).toEqual({ eventId: 'event-1', photoIds: 'p1,p2' })
    expect(deps.insertPurchase).toHaveBeenCalledWith({
      eventId: 'event-1',
      stripeSessionId: 'cs_test_123',
      buyerEmail: 'buyer@example.com',
    })
  })

  it('throws when Stripe returns no url', async () => {
    const deps: CheckoutDeps = {
      createStripeSession: vi.fn().mockResolvedValue({ id: 'cs_test_456', url: null }),
      insertPurchase: vi.fn(),
    }

    await expect(buildCheckoutSession(deps, 'event-1', ['p1'], 'buyer@example.com')).rejects.toThrow(
      'STRIPE_SESSION_MISSING_URL'
    )
  })
})
