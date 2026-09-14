import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventPageClient } from './EventPageClient'

const EVENT_ID = '11111111-1111-1111-1111-111111111111'

function galleryFileInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]:not([capture])')
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS
})

function mockFetchSequence(responses: Array<{ url: RegExp; body: unknown; status?: number }>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const match = responses.find((r) => r.url.test(url))
    if (!match) {
      throw new Error(`Unexpected fetch: ${url}`)
    }
    return new Response(JSON.stringify(match.body), { status: match.status ?? 200 })
  })
}

describe('EventPageClient', () => {
  it('combines a gallery selection and a search-result selection into one checkout bar', async () => {
    mockFetchSequence([
      {
        url: /\/api\/events\/festa-junina\/photos/,
        body: { results: [{ photoId: 'gallery-1', previewUrl: 'https://example.com/g1.jpg' }], hasMore: false },
      },
      {
        url: /\/api\/events\/festa-junina\/search/,
        body: { results: [{ photoId: 'search-1', previewUrl: 'https://example.com/s1.jpg' }] },
      },
    ])

    render(<EventPageClient slug="festa-junina" eventId={EVENT_ID} />)

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
    fireEvent.click(screen.getByAltText(/foto 1/i).closest('button')!)

    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))
    fireEvent.click(screen.getByRole('button', { name: /estou de acordo/i }))
    fireEvent.change(galleryFileInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getAllByAltText(/foto 1/i)).toHaveLength(2))
    const searchPhoto = screen.getAllByAltText(/foto 1/i)[1]
    fireEvent.click(searchPhoto.closest('button')!)

    await waitFor(() => expect(screen.getByText(/2 fotos selecionadas/i)).toBeTruthy())
  })

  it('posts every selected photo id (gallery + search) in a single checkout request', async () => {
    mockFetchSequence([
      {
        url: /\/api\/events\/festa-junina\/photos/,
        body: { results: [{ photoId: 'gallery-1', previewUrl: 'https://example.com/g1.jpg' }], hasMore: false },
      },
      {
        url: /\/api\/events\/festa-junina\/search/,
        body: { results: [{ photoId: 'search-1', previewUrl: 'https://example.com/s1.jpg' }] },
      },
      { url: /\/api\/checkout/, body: { url: 'https://checkout.stripe.com/session-123' } },
    ])

    render(<EventPageClient slug="festa-junina" eventId={EVENT_ID} />)

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
    fireEvent.click(screen.getByAltText(/foto 1/i).closest('button')!)

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))
    fireEvent.click(screen.getByRole('button', { name: /estou de acordo/i }))
    fireEvent.change(galleryFileInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getAllByAltText(/foto 1/i)).toHaveLength(2))
    fireEvent.click(screen.getAllByAltText(/foto 1/i)[1].closest('button')!)

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    delete (window as unknown as { location: unknown }).location
    ;(window as unknown as { location: Location }).location = { href: '' } as Location

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/session-123'))

    const checkoutCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).includes('/api/checkout')
    )
    const body = JSON.parse(checkoutCall![1].body as string)
    expect(body.eventId).toBe(EVENT_ID)
    expect(new Set(body.photoIds)).toEqual(new Set(['gallery-1', 'search-1']))
  })

  it('clears only the stale search selection when a new search replaces results, keeping the gallery selection', async () => {
    mockFetchSequence([
      {
        url: /\/api\/events\/festa-junina\/photos/,
        body: { results: [{ photoId: 'gallery-1', previewUrl: 'https://example.com/g1.jpg' }], hasMore: false },
      },
      {
        url: /\/api\/events\/festa-junina\/search/,
        body: { results: [{ photoId: 'search-1', previewUrl: 'https://example.com/s1.jpg' }] },
      },
    ])

    render(<EventPageClient slug="festa-junina" eventId={EVENT_ID} />)

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
    fireEvent.click(screen.getByAltText(/foto 1/i).closest('button')!)

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))
    fireEvent.click(screen.getByRole('button', { name: /estou de acordo/i }))
    fireEvent.change(galleryFileInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getAllByAltText(/foto 1/i)).toHaveLength(2))
    fireEvent.click(screen.getAllByAltText(/foto 1/i)[1].closest('button')!)
    await waitFor(() => expect(screen.getByText(/2 fotos selecionadas/i)).toBeTruthy())

    mockFetchSequence([
      {
        url: /\/api\/events\/festa-junina\/photos/,
        body: { results: [{ photoId: 'gallery-1', previewUrl: 'https://example.com/g1.jpg' }], hasMore: false },
      },
      {
        url: /\/api\/events\/festa-junina\/search/,
        body: { results: [{ photoId: 'search-2', previewUrl: 'https://example.com/s2.jpg' }] },
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))
    fireEvent.change(galleryFileInput()!, {
      target: { files: [new File(['b'], 's2.jpg', { type: 'image/jpeg' })] },
    })

    // The previous search's selection (search-1) is gone, but the gallery
    // selection (gallery-1) must survive.
    await waitFor(() => expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy())
  })
})
