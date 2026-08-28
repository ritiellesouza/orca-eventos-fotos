import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

import AdminLoginPage from './page'

afterEach(() => {
  vi.restoreAllMocks()
  pushMock.mockReset()
})

describe('AdminLoginPage', () => {
  it('renders a password field and a submit button', () => {
    render(<AdminLoginPage />)
    expect(screen.getByLabelText(/senha/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeTruthy()
  })

  it('navigates to /admin/events on successful login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    render(<AdminLoginPage />)
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin/events'))
  })

  it('shows an error and does not navigate on a wrong password', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_password' }), { status: 401 })
    )

    render(<AdminLoginPage />)
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/senha incorreta/i))
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('disables the submit button while a request is pending and only sends one request', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(fetchPromise)

    render(<AdminLoginPage />)
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'correct-password' } })
    const button = screen.getByRole('button', { name: /entrar/i })

    fireEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())

    // A second click while the first request is still in flight must not fire another request
    // (a disabled button does not dispatch click in the first place, mirroring real browsers).
    fireEvent.click(button)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    resolveFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin/events'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('shows an alert and does not navigate when the request fails (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'))

    render(<AdminLoginPage />)
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'correct-password' } })
    const button = screen.getByRole('button', { name: /entrar/i })
    fireEvent.click(button)

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(pushMock).not.toHaveBeenCalled()
    await waitFor(() => expect(button).not.toBeDisabled())
  })
})
