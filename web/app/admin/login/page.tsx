'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { BrandHeader } from '@/components/BrandHeader'
import { Button } from '@/components/Button'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        setError('Senha incorreta.')
        return
      }

      router.push('/admin/events')
    } catch {
      setError('Erro ao conectar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <BrandHeader />
      <main className="max-w-sm mx-auto p-4">
        <h1 className="text-2xl font-extrabold text-orca-azul-escuro mb-4">Painel admin</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="password" className="block mb-1">
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded px-3 py-2 mb-3 w-full"
          />
          {error && (
            <p role="alert" className="text-red-700 mb-3">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            Entrar
          </Button>
        </form>
      </main>
    </>
  )
}
