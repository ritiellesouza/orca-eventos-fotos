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

  it('shows a specific message when a photo is no longer available', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'unknown_photo_ids' }), { status: 400 })
    )

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não estão mais disponíveis/i))
  })

  it('shows a generic message on a network failure', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/erro ao iniciar pagamento/i))
  })
})
