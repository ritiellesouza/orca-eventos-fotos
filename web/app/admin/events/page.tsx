'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrandHeader } from '@/components/BrandHeader'
import { Button } from '@/components/Button'

type EventRow = { id: string; name: string; slug: string; eventDate: string; photoCount: number }

// The admin API answers a failed create/edit with `{ error: "<reason>" }` — a
// duplicate slug (the column is `unique`) is by far the likeliest real failure
// here, and it is only distinguishable from an outage if we show the body.
async function serverError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json()
    const message = (data as { error?: unknown } | null)?.error
    return typeof message === 'string' && message.length > 0 ? message : fallback
  } catch {
    return fallback
  }
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', slug: '', eventDate: '' })
  const [editForm, setEditForm] = useState({ name: '', slug: '', eventDate: '' })
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const loadingRef = useRef(false)
  const router = useRouter()

  async function loadEvents() {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const response = await fetch('/api/admin/events')
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events)
      } else {
        setError('Erro ao carregar eventos.')
      }
    } catch {
      setError('Erro ao carregar eventos.')
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })

      if (!response.ok) {
        setError(await serverError(response, 'Erro ao criar evento.'))
        return
      }

      setCreateForm({ name: '', slug: '', eventDate: '' })
      setCreating(false)
      await loadEvents()
    } catch {
      setError('Erro ao criar evento.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(id: string) {
    if (submitting) return
    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch(`/api/admin/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name, eventDate: editForm.eventDate }),
      })

      if (!response.ok) {
        setError(await serverError(response, 'Erro ao editar evento.'))
        return
      }

      setEditingId(null)
      await loadEvents()
    } catch {
      setError('Erro ao editar evento.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return
    if (!window.confirm('Apagar este evento? As fotos no armazenamento não serão removidas.')) {
      return
    }

    setError(null)
    setDeletingId(id)

    try {
      const response = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })

      if (!response.ok) {
        setError('Erro ao apagar evento.')
        return
      }

      await loadEvents()
    } catch {
      setError('Erro ao apagar evento.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)

    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // The cookie may still be set, but leaving the user stuck on a page they
      // asked to leave is worse — the login page is the right place either way.
    } finally {
      setLoggingOut(false)
      router.push('/admin/login')
    }
  }

  function startEdit(event: EventRow) {
    setCreating(false)
    setEditingId(event.id)
    setEditForm({ name: event.name, slug: event.slug, eventDate: event.eventDate })
  }

  function toggleCreating() {
    setEditingId(null)
    setCreating((c) => !c)
  }

  return (
    <>
      <BrandHeader />
      <main className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold text-orca-azul-escuro">Eventos</h1>
          <Button variant="secondary" onClick={handleLogout} disabled={loggingOut}>
            Sair
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-red-700 mb-3">
            {error}
          </p>
        )}

        <Button variant={creating ? 'secondary' : 'primary'} onClick={toggleCreating} className="mb-4">
          {creating ? 'Cancelar' : 'Criar evento'}
        </Button>

        {creating && (
          <form onSubmit={handleCreate} className="mb-6 border border-orca-dourado/30 rounded p-4">
            <label htmlFor="new-name" className="block mb-1">
              Nome
            </label>
            <input
              id="new-name"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
              className="border rounded px-3 py-2 mb-3 w-full"
            />
            <label htmlFor="new-slug" className="block mb-1">
              Slug
            </label>
            <input
              id="new-slug"
              value={createForm.slug}
              onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
              required
              className="border rounded px-3 py-2 mb-3 w-full"
            />
            <label htmlFor="new-date" className="block mb-1">
              Data
            </label>
            <input
              id="new-date"
              type="date"
              value={createForm.eventDate}
              onChange={(e) => setCreateForm({ ...createForm, eventDate: e.target.value })}
              required
              className="border rounded px-3 py-2 mb-3 w-full"
            />
            <Button type="submit" disabled={submitting}>
              Salvar
            </Button>
          </form>
        )}

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <>
            <p className="text-sm text-orca-preto-marca/70 mb-3">
              {events.length} {events.length === 1 ? 'evento' : 'eventos'} ·{' '}
              {events.reduce((sum, event) => sum + event.photoCount, 0)} fotos
            </p>
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-orca-dourado/30">
                <th className="py-2">Nome</th>
                <th className="py-2">Data</th>
                <th className="py-2">Fotos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((event) =>
                editingId === event.id ? (
                  <tr key={event.id} className="border-b border-orca-dourado/10">
                    <td className="py-2">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="border rounded px-2 py-1"
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="date"
                        value={editForm.eventDate}
                        onChange={(e) => setEditForm({ ...editForm, eventDate: e.target.value })}
                        className="border rounded px-2 py-1"
                      />
                    </td>
                    <td className="py-2">{event.photoCount}</td>
                    <td className="py-2 space-x-2">
                      <Button onClick={() => handleUpdate(event.id)} disabled={submitting}>
                        Salvar
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)} disabled={submitting}>
                        Cancelar
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={event.id} className="border-b border-orca-dourado/10">
                    <td className="py-2">{event.name}</td>
                    <td className="py-2">{event.eventDate}</td>
                    <td className="py-2">{event.photoCount}</td>
                    <td className="py-2 space-x-2">
                      <Link href={`/admin/events/${event.id}/upload`} className="text-orca-royal underline">
                        Subir fotos
                      </Link>
                      <Button variant="secondary" onClick={() => startEdit(event)}>
                        Editar
                      </Button>
                      <Button variant="destructive" onClick={() => handleDelete(event.id)} disabled={deletingId === event.id}>
                        Apagar
                      </Button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          </>
        )}
      </main>
    </>
  )
}
