import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateMaybeSingle = vi.fn()
const mockDeleteMaybeSingle = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: mockUpdateMaybeSingle,
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: mockDeleteMaybeSingle,
          }),
        }),
      }),
    }),
  }),
}))

import { PATCH, DELETE } from './route'

// Must satisfy lib/validation.ts's isUuid (v4 UUID: version nibble [1-8],
// variant nibble [89ab]) — an all-'1's id fails that check.
const VALID_ID = '11111111-1111-4111-8111-111111111111'

function jsonRequest(body: unknown) {
  return new Request(`http://localhost:3000/api/admin/events/${VALID_ID}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as any
}

function malformedJsonRequest() {
  return new Request(`http://localhost:3000/api/admin/events/${VALID_ID}`, {
    method: 'PATCH',
    body: '{not valid json',
  }) as any
}

describe('PATCH /api/admin/events/[id]', () => {
  beforeEach(() => {
    mockUpdateMaybeSingle.mockReset()
  })

  it('updates name and eventDate, returns the updated row', async () => {
    mockUpdateMaybeSingle.mockResolvedValue({
      data: { id: VALID_ID, name: 'Novo Nome', slug: 'evento-x', event_date: '2026-10-01' },
      error: null,
    })

    const response = await PATCH(jsonRequest({ name: 'Novo Nome', eventDate: '2026-10-01' }), {
      params: { id: VALID_ID },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: VALID_ID,
      name: 'Novo Nome',
      slug: 'evento-x',
      eventDate: '2026-10-01',
    })
  })

  it('rejects an invalid id before touching the database', async () => {
    const response = await PATCH(jsonRequest({ name: 'X' }), { params: { id: 'not-a-uuid' } })
    expect(response.status).toBe(400)
    expect(mockUpdateMaybeSingle).not.toHaveBeenCalled()
  })

  it('rejects an empty update body', async () => {
    const response = await PATCH(jsonRequest({}), { params: { id: VALID_ID } })
    expect(response.status).toBe(400)
    expect(mockUpdateMaybeSingle).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON with nothing_to_update instead of crashing', async () => {
    const response = await PATCH(malformedJsonRequest(), { params: { id: VALID_ID } })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'nothing_to_update' })
    expect(mockUpdateMaybeSingle).not.toHaveBeenCalled()
  })

  it('returns 404 when no row matches the id', async () => {
    mockUpdateMaybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await PATCH(jsonRequest({ name: 'X' }), { params: { id: VALID_ID } })
    expect(response.status).toBe(404)
  })

  it('returns 500 on a database error', async () => {
    mockUpdateMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const response = await PATCH(jsonRequest({ name: 'X' }), { params: { id: VALID_ID } })
    expect(response.status).toBe(500)
  })
})

describe('DELETE /api/admin/events/[id]', () => {
  beforeEach(() => {
    mockDeleteMaybeSingle.mockReset()
  })

  it('deletes the event and returns ok', async () => {
    mockDeleteMaybeSingle.mockResolvedValue({ data: { id: VALID_ID }, error: null })

    const response = await DELETE(new Request('http://localhost:3000') as any, { params: { id: VALID_ID } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('rejects an invalid id', async () => {
    const response = await DELETE(new Request('http://localhost:3000') as any, { params: { id: 'nope' } })
    expect(response.status).toBe(400)
    expect(mockDeleteMaybeSingle).not.toHaveBeenCalled()
  })

  it('returns 404 when no row matches the id', async () => {
    mockDeleteMaybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await DELETE(new Request('http://localhost:3000') as any, { params: { id: VALID_ID } })
    expect(response.status).toBe(404)
  })
})
