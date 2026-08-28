import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '11111111-1111-1111-1111-111111111111' }),
}))

import AdminUploadPage from './page'

afterEach(() => {
  vi.restoreAllMocks()
})

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]')!
}

describe('AdminUploadPage', () => {
  it('disables the upload button until files are selected', () => {
    render(<AdminUploadPage />)
    expect(screen.getByRole('button', { name: /subir/i })).toHaveProperty('disabled', true)
  })

  it('uploads selected files and shows the per-file result', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          uploaded: [{ filename: 'foto1.jpg', id: 'p1', hasFace: true }],
          failed: [{ filename: 'foto2.jpg', error: 'invalid image' }],
        }),
        { status: 200 }
      )
    )

    render(<AdminUploadPage />)

    const file1 = new File(['a'], 'foto1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['b'], 'foto2.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput(), { target: { files: [file1, file2] } })

    fireEvent.click(screen.getByRole('button', { name: /subir/i }))

    await waitFor(() => expect(screen.getByText(/1 enviada/i)).toBeTruthy())
    expect(screen.getByText(/foto2.jpg/i)).toBeTruthy()

    const call = fetchMock.mock.calls[0]
    expect(call[0]).toBe('/api/admin/events/11111111-1111-1111-1111-111111111111/photos')
    const body = call[1]!.body as FormData
    expect(body.getAll('photos')).toHaveLength(2)
  })

  it('shows a generic error on a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))

    render(<AdminUploadPage />)
    fireEvent.change(fileInput(), { target: { files: [new File(['a'], 'x.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(screen.getByRole('button', { name: /subir/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/erro ao subir/i))
  })
})
