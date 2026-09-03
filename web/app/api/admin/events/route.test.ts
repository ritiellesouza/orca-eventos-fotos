import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockOrder = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        order: mockOrder,
      }),
    }),
  }),
}))

import { GET } from './route'

describe('GET /api/admin/events', () => {
  beforeEach(() => {
    mockOrder.mockReset()
  })

  it('returns events with photo counts, mapped to camelCase', async () => {
    mockOrder.mockResolvedValue({
      data: [
        { id: '1', name: 'Festa Junina', slug: 'festa-junina', event_date: '2026-06-20', photos: [{ count: 42 }] },
        { id: '2', name: 'Casamento', slug: 'casamento', event_date: '2026-09-12', photos: [{ count: 0 }] },
      ],
      error: null,
    })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      events: [
        { id: '1', name: 'Festa Junina', slug: 'festa-junina', eventDate: '2026-06-20', photoCount: 42 },
        { id: '2', name: 'Casamento', slug: 'casamento', eventDate: '2026-09-12', photoCount: 0 },
      ],
    })
  })

  it('defaults photoCount to 0 when the embedded count is missing', async () => {
    mockOrder.mockResolvedValue({
      data: [{ id: '1', name: 'X', slug: 'x', event_date: '2026-01-01', photos: [] }],
      error: null,
    })

    const response = await GET()
    const body = await response.json()

    expect(body.events[0].photoCount).toBe(0)
  })

  it('returns 500 on a database error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'connection lost' } })

    const response = await GET()
    expect(response.status).toBe(500)
  })
})
