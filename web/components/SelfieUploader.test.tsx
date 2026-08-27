import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SelfieUploader } from './SelfieUploader'

function fileInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SelfieUploader consent gate', () => {
  it('does not render the file input before consent is given', () => {
    render(<SelfieUploader slug="festa-junina" eventId="11111111-1111-1111-1111-111111111111" />)

    expect(fileInput()).toBeNull()
    expect(screen.getByRole('button', { name: /concordo/i })).toBeTruthy()
  })

  it('renders the file input only after the consent button is clicked', () => {
    render(<SelfieUploader slug="festa-junina" eventId="11111111-1111-1111-1111-111111111111" />)

    fireEvent.click(screen.getByRole('button', { name: /concordo/i }))

    expect(fileInput()).not.toBeNull()
  })

  it('explains what happens to the selfie before asking for consent', () => {
    render(<SelfieUploader slug="festa-junina" eventId="11111111-1111-1111-1111-111111111111" />)

    expect(screen.getByText(/comparação facial/i)).toBeTruthy()
  })

  it('sends consent=true alongside the selfie so the server can record it', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    render(<SelfieUploader slug="festa-junina" eventId="11111111-1111-1111-1111-111111111111" />)
    fireEvent.click(screen.getByRole('button', { name: /concordo/i }))

    const input = fileInput()!
    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const body = fetchMock.mock.calls[0][1]?.body as FormData
    expect(body.get('consent')).toBe('true')
    expect(body.get('selfie')).toBe(file)
  })
})

describe('SelfieUploader checkout bar', () => {
  const eventId = '11111111-1111-1111-1111-111111111111'

  async function selectOnePhoto() {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    render(<SelfieUploader slug="festa-junina" eventId={eventId} />)
    fireEvent.click(screen.getByRole('button', { name: /concordo/i }))

    const input = fileInput()!
    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
    fireEvent.click(screen.getByAltText(/foto 1/i).closest('button')!)
  }

  it('does not show the checkout bar with nothing selected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    render(<SelfieUploader slug="festa-junina" eventId={eventId} />)
    fireEvent.click(screen.getByRole('button', { name: /concordo/i }))
    const input = fileInput()!
    fireEvent.change(input, { target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    expect(screen.queryByRole('button', { name: /comprar/i })).toBeNull()
  })

  it('shows the checkout bar with the correct total once a photo is selected', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()

    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()
    expect(screen.getByText(/R\$\s*15,00/)).toBeTruthy()
  })

  it('disables the buy button until the email looks valid', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()

    const buyButton = screen.getByRole('button', { name: /comprar/i }) as HTMLButtonElement
    expect(buyButton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'nao-e-email' } })
    expect(buyButton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })
    expect(buyButton.disabled).toBe(false)
  })

  it('posts to /api/checkout with the selected photo and redirects on success', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    const checkoutFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/session-123' }), { status: 200 }))

    delete (window as unknown as { location: unknown }).location
    // window.location's getter/setter types differ (Location / string) in this
    // TS/lib.dom version, so a direct object-literal assignment is checked
    // against their intersection and rejected. Cast the assignment target too.
    ;(window as unknown as { location: Location }).location = { href: '' } as Location

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(checkoutFetch).toHaveBeenCalled())

    // checkoutFetch is the same spy instance selectOnePhoto already mocked once
    // (vi.spyOn on an already-spied fetch returns the existing spy), so its
    // call history includes that earlier /search call too — grab the last call.
    const [url, init] = checkoutFetch.mock.calls[checkoutFetch.mock.calls.length - 1]
    expect(url).toBe('/api/checkout')
    const body = JSON.parse(init!.body as string)
    expect(body).toEqual({ eventId, photoIds: ['photo-1'], buyerEmail: 'comprador@example.com' })

    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/session-123'))
  })

  it('shows a specific message when a photo is no longer available, next to the checkout bar', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'unknown_photo_ids' }), { status: 400 })
    )

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não estão mais disponíveis/i))

    // The checkout error must render inside the checkout bar (same parent as
    // the Comprar button), not in the top-level search-error slot near the
    // file input -- otherwise it can be scrolled off-screen from the button.
    const alert = screen.getByRole('alert')
    const buyButton = screen.getByRole('button', { name: /comprar/i })
    expect(alert.parentElement).toBe(buyButton.parentElement)
  })

  it('shows a generic message on a network failure, next to the checkout bar', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/erro ao iniciar pagamento/i))

    const alert = screen.getByRole('alert')
    const buyButton = screen.getByRole('button', { name: /comprar/i })
    expect(alert.parentElement).toBe(buyButton.parentElement)
  })

  it('does not carry a checkout error into a fresh search (independent error state)', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))
    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/erro ao iniciar pagamento/i))

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' }] }),
        { status: 200 }
      )
    )
    const file2 = new File(['bytes'], 'selfie2.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput()!, { target: { files: [file2] } })

    await waitFor(() =>
      expect(screen.getByAltText(/foto 1/i).getAttribute('src')).toBe('https://example.com/p2.jpg')
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears a stale selection when a new search is performed', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    expect(screen.getByRole('button', { name: /comprar/i })).toBeTruthy()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' }] }),
        { status: 200 }
      )
    )

    const file2 = new File(['bytes'], 'selfie2.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput()!, { target: { files: [file2] } })

    // Wait for the new grid (a different photo, same "Foto 1" ordinal) to render.
    await waitFor(() =>
      expect(screen.getByAltText(/foto 1/i).getAttribute('src')).toBe('https://example.com/p2.jpg')
    )

    // The old selection (photo-1, no longer visible) must not survive into the
    // new search -- otherwise the checkout bar would show a stale count/total
    // for a photo the buyer can no longer see or deselect.
    expect(screen.queryByRole('button', { name: /comprar/i })).toBeNull()
  })

  it('shows the photo count without a total when the price env var is unset', async () => {
    delete process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS
    await selectOnePhoto()

    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })
})
