import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SelfieUploader } from './SelfieUploader'

function galleryInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]:not([capture])')
}

function anyFileInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]')
}

function renderUploader(overrides: Partial<React.ComponentProps<typeof SelfieUploader>> = {}) {
  const props = {
    slug: 'festa-junina',
    selected: new Set<string>(),
    onToggle: vi.fn(),
    onSelectMany: vi.fn(),
    onDeselectMany: vi.fn(),
    ...overrides,
  }
  render(<SelfieUploader {...props} />)
  return props
}

// Drives the UI from the initial search card through the consent modal
// (only asked once per component lifetime) into the capture modal, leaving
// it open so the caller can fire a change event on the input it needs.
function openCaptureModal() {
  const encontrarButton = screen.queryByRole('button', { name: /^encontrar$/i })
  if (encontrarButton) {
    fireEvent.click(encontrarButton)
  } else {
    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))
  }

  const agreeButton = screen.queryByRole('button', { name: /estou de acordo/i })
  if (agreeButton) {
    fireEvent.click(agreeButton)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SelfieUploader search flow', () => {
  it('shows the search card and no file input before searching', () => {
    renderUploader()

    expect(anyFileInput()).toBeNull()
    expect(screen.getByRole('button', { name: /^encontrar$/i })).toBeTruthy()
  })

  it('asks for consent before opening the capture modal', () => {
    renderUploader()

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))

    expect(anyFileInput()).toBeNull()
    expect(screen.getByRole('button', { name: /estou de acordo/i })).toBeTruthy()
  })

  it('explains what happens to the selfie in the consent modal', () => {
    renderUploader()

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))

    expect(screen.getByText(/comparação facial/i)).toBeTruthy()
  })

  it('opens the capture modal with a file input after agreeing to consent', () => {
    renderUploader()

    openCaptureModal()

    expect(galleryInput()).not.toBeNull()
  })

  it('sends consent=true alongside the selfie so the server can record it', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    renderUploader()
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

    renderUploader()
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

    renderUploader()
    openCaptureModal()

    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não achamos um rosto/i))
    expect(screen.getByRole('button', { name: /^encontrar$/i })).toBeTruthy()
  })

  it('does not ask for consent again on a second search', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    renderUploader()
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))

    expect(screen.queryByRole('button', { name: /estou de acordo/i })).toBeNull()
  })

  it('calls onSelectMany with all result ids when "Selecionar todas" is clicked', async () => {
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

    const onSelectMany = vi.fn()
    renderUploader({ onSelectMany })
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /selecionar todas/i }))

    expect(onSelectMany).toHaveBeenCalledWith(['photo-1', 'photo-2'])
  })

  it("calls onDeselectMany with the previous results' ids when a new search replaces them", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    const onDeselectMany = vi.fn()
    renderUploader({ onDeselectMany })
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
    expect(onDeselectMany).not.toHaveBeenCalled()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' }] }),
        { status: 200 }
      )
    )

    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's2.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(onDeselectMany).toHaveBeenCalledWith(['photo-1']))
  })

  it('renders PhotoGrid with the shared selected set and forwards onToggle', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    const onToggle = vi.fn()
    renderUploader({ selected: new Set(['photo-1']), onToggle })
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByAltText(/foto 1 \(selecionada\)/i)).toBeTruthy())

    fireEvent.click(screen.getByAltText(/foto 1 \(selecionada\)/i).closest('button')!)
    expect(onToggle).toHaveBeenCalledWith('photo-1')
  })
})
