import { describe, it, expect } from 'vitest'
import { createRateLimiter } from './rateLimit'

describe('createRateLimiter', () => {
  it('allows up to the limit inside one window and rejects the next request', () => {
    const limiter = createRateLimiter(3, 60_000)

    expect(limiter.allow('1.2.3.4', 1_000)).toBe(true)
    expect(limiter.allow('1.2.3.4', 1_100)).toBe(true)
    expect(limiter.allow('1.2.3.4', 1_200)).toBe(true)
    expect(limiter.allow('1.2.3.4', 1_300)).toBe(false)
  })

  it('tracks each key independently', () => {
    const limiter = createRateLimiter(1, 60_000)

    expect(limiter.allow('1.2.3.4', 1_000)).toBe(true)
    expect(limiter.allow('1.2.3.4', 1_100)).toBe(false)
    expect(limiter.allow('5.6.7.8', 1_100)).toBe(true)
  })

  it('resets once the window has elapsed', () => {
    const limiter = createRateLimiter(2, 60_000)

    expect(limiter.allow('1.2.3.4', 1_000)).toBe(true)
    expect(limiter.allow('1.2.3.4', 2_000)).toBe(true)
    expect(limiter.allow('1.2.3.4', 3_000)).toBe(false)
    expect(limiter.allow('1.2.3.4', 61_000)).toBe(true)
  })
})
