import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockEventSingle, mockPhotosRange, mockCreateRateLimiter } = vi.hoisted(() => {
  const mockCreateRateLimiter = vi.fn()
  mockCreateRateLimiter.mockReturnValue({ allow: () => true })
  return {
    mockEventSingle: vi.fn(),
    mockPhotosRange: vi.fn(),
    mockCreateRateLimiter,
  }
})

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'events') {
        return { select: () => ({ eq: () => ({ single: mockEventSingle }) }) }
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              range: mockPhotosRange,
            }),
          }),
        }),
      }
    },
  }),
}))

vi.mock('@/lib/rateLimit', () => ({
  createRateLimiter: mockCreateRateLimiter,
}))

import { GET } from './route'

const EVENT_ID = '11111111-1111-1111-1111-111111111111'

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/events/festa-junina/photos${query}`)
}

describe('GET /api/events/[slug]/photos', () => {
  beforeEach(() => {
    mockEventSingle.mockReset()
    mockPhotosRange.mockReset()
    mockCreateRateLimiter.mockReset()
    mockCreateRateLimiter.mockReturnValue({ allow: () => true })
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://pub.example.com'
  })

  it('returns 404 for an unknown slug', async () => {
    mockEventSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const response = await GET(makeRequest(), { params: { slug: 'nao-existe' } })

    expect(response.status).toBe(404)
  })

  it('returns a page of previews with hasMore=false when there is no next page', async () => {
    mockEventSingle.mockResolvedValue({ data: { id: EVENT_ID }, error: null })
    mockPhotosRange.mockResolvedValue({
      data: [
        { id: 'photo-1', storage_key_preview: `previews/${EVENT_ID}/a.jpg` },
        { id: 'photo-2', storage_key_preview: `previews/${EVENT_ID}/b.jpg` },
      ],
      error: null,
    })

    const response = await GET(makeRequest('?offset=0&limit=40'), { params: { slug: 'festa-junina' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      results: [
        { photoId: 'photo-1', previewUrl: `https://pub.example.com/previews/${EVENT_ID}/a.jpg` },
        { photoId: 'photo-2', previewUrl: `https://pub.example.com/previews/${EVENT_ID}/b.jpg` },
      ],
      hasMore: false,
    })
  })

  it('returns hasMore=true and trims the extra row when there is a next page', async () => {
    mockEventSingle.mockResolvedValue({ data: { id: EVENT_ID }, error: null })
    mockPhotosRange.mockResolvedValue({
      data: [
        { id: 'photo-1', storage_key_preview: 'a.jpg' },
        { id: 'photo-2', storage_key_preview: 'b.jpg' },
        { id: 'photo-3', storage_key_preview: 'c.jpg' },
      ],
      error: null,
    })

    const response = await GET(makeRequest('?offset=0&limit=2'), { params: { slug: 'festa-junina' } })
    const body = await response.json()

    expect(body.results).toHaveLength(2)
    expect(body.hasMore).toBe(true)
  })

  it('returns 500 on a database error', async () => {
    mockEventSingle.mockResolvedValue({ data: { id: EVENT_ID }, error: null })
    mockPhotosRange.mockResolvedValue({ data: null, error: { message: 'connection lost' } })

    const response = await GET(makeRequest(), { params: { slug: 'festa-junina' } })

    expect(response.status).toBe(500)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateRateLimiter.mockReturnValue({ allow: () => false })

    const response = await GET(makeRequest(), { params: { slug: 'festa-junina' } })

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body).toEqual({ error: 'rate_limited' })
  })
})
