'use client'

import { useState } from 'react'
import { PhotoGrid } from './PhotoGrid'
import { formatTotalBRL } from '@/lib/pricing'

type PhotoResult = { photoId: string; previewUrl: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function SelfieUploader({ slug, eventId }: { slug: string; eventId: string }) {
  const [consented, setConsented] = useState(false)
  const [results, setResults] = useState<PhotoResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState('')
  const [checkoutInFlight, setCheckoutInFlight] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    const formData = new FormData()
    formData.append('selfie', file)
    // The API rejects the request without this; the consent gate below is a UI
    // affordance, this field is what the server records the agreement from.
    formData.append('consent', 'true')

    try {
      const response = await fetch(`/api/events/${slug}/search`, { method: 'POST', body: formData })

      let data: { error?: string; results?: PhotoResult[] } | null = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {
        setError(data?.error === 'no_face_detected' ? 'Não achamos um rosto nessa foto. Tente outra, com boa iluminação.' : 'Erro ao buscar fotos.')
        return
      }

      setResults(data?.results ?? [])
    } catch {
      setError('Erro ao buscar fotos.')
    }
  }

  function toggle(photoId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) {
        next.delete(photoId)
      } else {
        next.add(photoId)
      }
      return next
    })
  }

  async function handleCheckout() {
    setError(null)
    setCheckoutInFlight(true)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, photoIds: Array.from(selected), buyerEmail: email }),
      })

      let data: { error?: string; url?: string } | null = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok || !data?.url) {
        setError(
          data?.error === 'unknown_photo_ids'
            ? 'Algumas fotos selecionadas não estão mais disponíveis. Atualize a página e tente de novo.'
            : 'Erro ao iniciar pagamento. Tente novamente.'
        )
        setCheckoutInFlight(false)
        return
      }

      window.location.href = data.url
    } catch {
      setError('Erro ao iniciar pagamento. Tente novamente.')
      setCheckoutInFlight(false)
    }
  }

  if (!consented) {
    return (
      <div>
        <p>Para achar suas fotos, vamos processar uma selfie sua apenas para comparação facial neste evento. Os dados são processados em servidor próprio da Orca Mídias e removidos após 120 dias.</p>
        <button onClick={() => setConsented(true)}>Concordo, continuar</button>
      </div>
    )
  }

  const unitPriceCents = Number(process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS)
  const emailIsValid = EMAIL_PATTERN.test(email)

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="user"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {error && <p role="alert">{error}</p>}
      {results && <PhotoGrid photos={results} selected={selected} onToggle={toggle} />}
      {selected.size > 0 && (
        <div>
          <p>
            {selected.size} {selected.size === 1 ? 'foto selecionada' : 'fotos selecionadas'} · {formatTotalBRL(unitPriceCents, selected.size)}
          </p>
          <label htmlFor="buyer-email">Seu e-mail</label>
          <input
            id="buyer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
          <button onClick={handleCheckout} disabled={!emailIsValid || checkoutInFlight}>
            Comprar
          </button>
        </div>
      )}
    </div>
  )
}
