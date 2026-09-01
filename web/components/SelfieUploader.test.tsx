import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SelfieUploader } from './SelfieUploader'

const EVENT_ID = '11111111-1111-1111-1111-111111111111'

function galleryInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]:not([capture])')
}

function anyFileInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]')
}

// Drives the UI from the initial search card through the consent modal
// (only asked once per component lifetime) into the capture modal, leaving
// it open so the caller can fire a change event on the input it needs.
function openCaptureModal() {
  const encontrarButton = screen.queryByRole('button', { name: /^encontrar$/i })
  if (encontrarButton) {
    fireEvent.click(encontrarButton)
  } else {
    // A search already happened; "Buscar novamente" reopens the capture
    // modal directly since consent was already granted.
    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))
  }

  const agreeButton = screen.queryByRole('button', { name: /estou de acordo/i })
  if (agreeButton) {
    fireEvent.click(agreeButton)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS
})

describe('SelfieUploader search flow', () => {
  it('shows the search card and no file input before searching', () => {
    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)

    expect(anyFileInput()).toBeNull()
    expect(screen.getByRole('button', { name: /^encontrar$/i })).toBeTruthy()
  })

  it('asks for consent before opening the capture modal', () => {
    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))

    expect(anyFileInput()).toBeNull()
    expect(screen.getByRole('button', { name: /estou de acordo/i })).toBeTruthy()
  })

  it('explains what happens to the selfie in the consent modal', () => {
    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))

    expect(screen.getByText(/comparação facial/i)).toBeTruthy()
  })

  it('opens the capture modal with a file input after agreeing to consent', () => {
    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)

    openCaptureModal()

    expect(galleryInput()).not.toBeNull()
  })

  it('sends consent=true alongside the selfie so the server can record it', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()

    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(galleryInput()!, { target: { files: [file] } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const body = fetchMock.mock.calls[0][1]?.body as FormData
    expect(body.get('consent')).toBe('true')
    expect(body.get('selfie')).toBe(file)
  })

  it('closes the capture modal once a file is selected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()

    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(anyFileInput()).toBeNull())
  })

  it('shows a "no face detected" message and lets the user try again', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'no_face_detected' }), { status: 422 })
    )

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()

    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não achamos um rosto/i))
    // The search card is still reachable to retry -- consent isn't asked again.
    expect(screen.getByRole('button', { name: /^encontrar$/i })).toBeTruthy()
  })

  it('does not ask for consent again on a second search', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    // Wait for the first search to finish -- while `searching` is true the
    // "Buscar novamente" flow could be blocked, so the button must be idle
    // again before the second search starts.
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))

    expect(screen.queryByRole('button', { name: /estou de acordo/i })).toBeNull()
  })
})

describe('SelfieUploader checkout bar', () => {
  async function selectOnePhoto() {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()

    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(galleryInput()!, { target: { files: [file] } })

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

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })
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
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://checkout.stripe.com/session-123' }), { status: 200 })
      )

    delete (window as unknown as { location: unknown }).location
    ;(window as unknown as { location: Location }).location = { href: '' } as Location

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(checkoutFetch).toHaveBeenCalled())

    const [url, init] = checkoutFetch.mock.calls[checkoutFetch.mock.calls.length - 1]
    expect(url).toBe('/api/checkout')
    const body = JSON.parse(init!.body as string)
    expect(body).toEqual({ eventId: EVENT_ID, photoIds: ['photo-1'], buyerEmail: 'comprador@example.com' })

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

  it('does not carry a checkout error into a fresh search', async () => {
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

    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['bytes'], 'selfie2.jpg', { type: 'image/jpeg' })] },
    })

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

    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['bytes'], 'selfie2.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() =>
      expect(screen.getByAltText(/foto 1/i).getAttribute('src')).toBe('https://example.com/p2.jpg')
    )

    expect(screen.queryByRole('button', { name: /comprar/i })).toBeNull()
  })

  it('shows the photo count without a total when the price env var is unset', async () => {
    await selectOnePhoto()

    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('selects all results when "Selecionar todas" is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            { photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' },
            { photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' },
          ],
        }),
        { status: 200 }
      )
    )

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /selecionar todas/i }))

    expect(screen.getByText(/2 fotos selecionadas/i)).toBeTruthy()
  })
})
