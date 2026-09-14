import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventGallery } from './EventGallery'

function renderGallery(overrides: Partial<React.ComponentProps<typeof EventGallery>> = {}) {
  const props = {
    slug: 'festa-junina',
    selected: new Set<string>(),
    onToggle: vi.fn(),
    onSelectMany: vi.fn(),
    ...overrides,
  }
  render(<EventGallery {...props} />)
  return props
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EventGallery', () => {
  it('loads and shows the first page of photos on mount', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
          hasMore: false,
        }),
        { status: 200 }
      )
    )

    renderGallery()

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
  })

  it('requests the first page with offset=0', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], hasMore: false }), { status: 200 }))

    renderGallery()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/events/festa-junina/photos?offset=0&limit=40'))
  })

  it('shows "Carregar mais" when hasMore is true, and loads the next page on click', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
            hasMore: true,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' }],
            hasMore: false,
          }),
          { status: 200 }
        )
      )

    renderGallery()
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }))

    await waitFor(() => expect(screen.getByAltText(/foto 2/i)).toBeTruthy())
    expect(screen.getByAltText(/foto 1/i)).toBeTruthy()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/events/festa-junina/photos?offset=1&limit=40')
    expect(screen.queryByRole('button', { name: /carregar mais/i })).toBeNull()
  })

  it('does not show "Carregar mais" when hasMore is false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
          hasMore: false,
        }),
        { status: 200 }
      )
    )

    renderGallery()
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    expect(screen.queryByRole('button', { name: /carregar mais/i })).toBeNull()
  })

  it('shows an error and a retry button when the initial load fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }))

    renderGallery()

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeTruthy()
  })

  it('retries the initial load when "Tentar novamente" is clicked', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
            hasMore: false,
          }),
          { status: 200 }
        )
      )

    renderGallery()
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps already-loaded photos when "Carregar mais" fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
            hasMore: true,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response('', { status: 500 }))

    renderGallery()
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByAltText(/foto 1/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /carregar mais/i })).toBeTruthy()
  })

  it('calls onSelectMany with all loaded photo ids when "Selecionar todas" is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            { photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' },
            { photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' },
          ],
          hasMore: false,
        }),
        { status: 200 }
      )
    )

    const onSelectMany = vi.fn()
    renderGallery({ onSelectMany })
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /selecionar todas/i }))

    expect(onSelectMany).toHaveBeenCalledWith(['photo-1', 'photo-2'])
  })

  it('forwards the shared selected set and onToggle to PhotoGrid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
          hasMore: false,
        }),
        { status: 200 }
      )
    )

    const onToggle = vi.fn()
    renderGallery({ selected: new Set(['photo-1']), onToggle })
    await waitFor(() => expect(screen.getByAltText(/foto 1 \(selecionada\)/i)).toBeTruthy())

    fireEvent.click(screen.getByAltText(/foto 1 \(selecionada\)/i).closest('button')!)
    expect(onToggle).toHaveBeenCalledWith('photo-1')
  })
})
