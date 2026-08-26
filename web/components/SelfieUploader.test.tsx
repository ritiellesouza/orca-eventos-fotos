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
    render(<SelfieUploader slug="festa-junina" />)

    expect(fileInput()).toBeNull()
    expect(screen.getByRole('button', { name: /concordo/i })).toBeTruthy()
  })

  it('renders the file input only after the consent button is clicked', () => {
    render(<SelfieUploader slug="festa-junina" />)

    fireEvent.click(screen.getByRole('button', { name: /concordo/i }))

    expect(fileInput()).not.toBeNull()
  })

  it('explains what happens to the selfie before asking for consent', () => {
    render(<SelfieUploader slug="festa-junina" />)

    expect(screen.getByText(/comparação facial/i)).toBeTruthy()
  })

  it('sends consent=true alongside the selfie so the server can record it', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    render(<SelfieUploader slug="festa-junina" />)
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
