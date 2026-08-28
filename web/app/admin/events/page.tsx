'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'

type EventRow = { id: string; name: string; slug: string; eventDate: string; photoCount: number }

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', eventDate: '' })
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadEvents() {
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
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        setError('Erro ao criar evento.')
        return
      }

      setForm({ name: '', slug: '', eventDate: '' })
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
        body: JSON.stringify({ name: form.name, eventDate: form.eventDate }),
      })

      if (!response.ok) {
        setError('Erro ao editar evento.')
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

  function startEdit(event: EventRow) {
    setEditingId(event.id)
    setForm({ name: event.name, slug: event.slug, eventDate: event.eventDate })
  }

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Eventos</h1>
      {error && <p role="alert">{error}</p>}

      <button onClick={() => setCreating((c) => !c)}>{creating ? 'Cancelar' : 'Criar evento'}</button>

      {creating && (
        <form onSubmit={handleCreate}>
          <label htmlFor="new-name">Nome</label>
          <input id="new-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label htmlFor="new-slug">Slug</label>
          <input id="new-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
          <label htmlFor="new-date">Data</label>
          <input
            id="new-date"
            type="date"
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            required
          />
          <button type="submit" disabled={submitting}>Salvar</button>
        </form>
      )}

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Data</th>
              <th>Fotos</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {events.map((event) =>
              editingId === event.id ? (
                <tr key={event.id}>
                  <td>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={form.eventDate}
                      onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                    />
                  </td>
                  <td>{event.photoCount}</td>
                  <td>
                    <button onClick={() => handleUpdate(event.id)} disabled={submitting}>Salvar</button>
                    <button onClick={() => setEditingId(null)} disabled={submitting}>Cancelar</button>
                  </td>
                </tr>
              ) : (
                <tr key={event.id}>
                  <td>{event.name}</td>
                  <td>{event.eventDate}</td>
                  <td>{event.photoCount}</td>
                  <td>
                    <Link href={`/admin/events/${event.id}/upload`}>Subir fotos</Link>
                    <button onClick={() => startEdit(event)}>Editar</button>
                    <button onClick={() => handleDelete(event.id)} disabled={deletingId === event.id}>Apagar</button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </main>
  )
}
