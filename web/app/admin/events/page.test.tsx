import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

import AdminEventsPage from './page'

const EVENTS_RESPONSE = {
  events: [
    { id: '1', name: 'Festa Junina', slug: 'festa-junina', eventDate: '2026-06-20', photoCount: 42 },
  ],
}

afterEach(() => {
  vi.restoreAllMocks()
  push.mockClear()
})

describe('AdminEventsPage', () => {
  it('loads and renders the event list with photo counts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))

    render(<AdminEventsPage />)

    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('creates a new event and reloads the list', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: '2', name: 'X', slug: 'x', eventDate: '2026-01-01' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /criar evento/i }))
    fireEvent.change(screen.getByLabelText(/^nome$/i), { target: { value: 'Novo Evento' } })
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'novo-evento' } })
    fireEvent.change(screen.getByLabelText(/data/i), { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const createCall = fetchMock.mock.calls[1]
    expect(createCall[0]).toBe('/api/admin/events')
    expect(JSON.parse(createCall[1]!.body as string)).toEqual({
      name: 'Novo Evento',
      slug: 'novo-evento',
      eventDate: '2026-12-01',
    })
  })

  it('deletes an event after confirmation and reloads the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /apagar/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/events/1')
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE' })
  })

  it('does not delete when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /apagar/i }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows an error message when loading the list fails due to a network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(<AdminEventsPage />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toMatch(/erro/i)
  })

  it('shows an error message when create fails due to a network error, without crashing', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(<AdminEventsPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /criar evento/i }))
    fireEvent.change(screen.getByLabelText(/^nome$/i), { target: { value: 'Novo Evento' } })
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'novo-evento' } })
    fireEvent.change(screen.getByLabelText(/data/i), { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces the server error message when create fails (e.g. duplicate slug)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'duplicate key value violates unique constraint "events_slug_key"' }),
          { status: 400 }
        )
      )

    render(<AdminEventsPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /criar evento/i }))
    fireEvent.change(screen.getByLabelText(/^nome$/i), { target: { value: 'Novo Evento' } })
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'festa-junina' } })
    fireEvent.change(screen.getByLabelText(/data/i), { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/events_slug_key/))
    expect(screen.queryByText('Erro ao criar evento.')).toBeNull()
  })

  it('falls back to the generic message when the failed create body has no error field', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /criar evento/i }))
    fireEvent.change(screen.getByLabelText(/^nome$/i), { target: { value: 'Novo Evento' } })
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'novo-evento' } })
    fireEvent.change(screen.getByLabelText(/data/i), { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Erro ao criar evento.'))
  })

  it('surfaces the server error message when editing fails', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'event_not_found' }), { status: 404 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /editar/i }))
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('event_not_found'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows an error message when delete fails due to a network error, without crashing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /apagar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not fire a second create request while the first is still in flight', async () => {
    let resolveCreate: (value: Response) => void = () => {}
    const createPromise = new Promise<Response>((resolve) => {
      resolveCreate = resolve
    })

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }))
      .mockImplementationOnce(() => createPromise)
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /criar evento/i }))
    fireEvent.change(screen.getByLabelText(/^nome$/i), { target: { value: 'Novo Evento' } })
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'novo-evento' } })
    fireEvent.change(screen.getByLabelText(/data/i), { target: { value: '2026-12-01' } })

    const saveButton = screen.getByRole('button', { name: /^salvar$/i })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    resolveCreate(new Response(JSON.stringify({ id: '2', name: 'X', slug: 'x', eventDate: '2026-01-01' }), { status: 201 }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  })

  it('does not fire a second delete request while the first is still in flight', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let resolveDelete: (value: Response) => void = () => {}
    const deletePromise = new Promise<Response>((resolve) => {
      resolveDelete = resolve
    })

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))
      .mockImplementationOnce(() => deletePromise)
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    const deleteButton = screen.getByRole('button', { name: /apagar/i })
    fireEvent.click(deleteButton)
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    resolveDelete(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  })

  it('logs out and redirects to the login page', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /^sair$/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/login'))
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/logout')
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' })
  })

  it('still redirects to the login page when the logout request fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /^sair$/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/login'))
  })

  it('does not leak an in-progress create draft into the row being edited', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /criar evento/i }))
    fireEvent.change(screen.getByLabelText(/^nome$/i), { target: { value: 'Rascunho não salvo' } })

    fireEvent.click(screen.getByRole('button', { name: /editar/i }))

    // The create panel must not silently keep showing (and the user must not lose
    // track of) an unsaved draft once a different form has taken over the shared state.
    expect(screen.queryByLabelText(/^nome$/i)).toBeNull()
    // The row being edited must show its own original data, not the create draft.
    expect(screen.getByDisplayValue('Festa Junina')).toBeTruthy()
    expect(screen.queryByDisplayValue('Rascunho não salvo')).toBeNull()
  })

  it('does not leak an in-progress edit into a freshly opened create panel', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /editar/i }))
    fireEvent.change(screen.getByDisplayValue('Festa Junina'), { target: { value: 'Editado sem salvar' } })

    fireEvent.click(screen.getByRole('button', { name: /criar evento/i }))

    // The create panel must open empty, not pre-filled with the unsaved edit.
    expect((screen.getByLabelText(/^nome$/i) as HTMLInputElement).value).toBe('')
    expect(screen.queryByDisplayValue('Editado sem salvar')).toBeNull()
  })
})
