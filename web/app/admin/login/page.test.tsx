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
})
