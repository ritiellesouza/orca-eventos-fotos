'use client'

import { useEffect, useState } from 'react'
import { PhotoGrid } from './PhotoGrid'
import { ConsentModal } from './ConsentModal'
import { CaptureModal } from './CaptureModal'
import { Button } from './Button'
import { formatTotalBRL } from '@/lib/pricing'

type PhotoResult = { photoId: string; previewUrl: string }
type ModalState = 'none' | 'consent' | 'capture'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function SelfieUploader({ slug, eventId }: { slug: string; eventId: string }) {
  const [consented, setConsented] = useState(false)
  const [modalOpen, setModalOpen] = useState<ModalState>('none')
  const [results, setResults] = useState<PhotoResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState('')
  const [checkoutInFlight, setCheckoutInFlight] = useState(false)
  const [searching, setSearching] = useState(false)

  // If the buyer navigates to Stripe Checkout and then hits Back, some browsers
  // (bfcache) restore this exact page/component state instead of remounting --
  // including checkoutInFlight left `true` from the redirect. Without this, the
  // Comprar button would stay disabled forever with no visible explanation. On
  // a normal successful checkout the page navigates away entirely, so this
  // listener never fires for that path and there's nothing to reset there.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        setCheckoutInFlight(false)
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  async function handleFile(file: File) {
    setError(null)
    setSearching(true)
    const formData = new FormData()
    formData.append('selfie', file)
    // The API rejects the request without this; the consent modal is a UI
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
        setSearching(false)
        return
      }

      // A new search replaces the visible grid entirely. Any photo ids selected
      // from a previous grid would otherwise survive with no visible tile, but
      // still ride along into the checkout total and the /api/checkout request
      // (they're still valid photos of this event, so the server can't catch it) --
      // the buyer would be billed for photos they can no longer see or deselect.
      setSelected(new Set())
      setResults(data?.results ?? [])
      setSearching(false)
    } catch {
      setError('Erro ao buscar fotos.')
      setSearching(false)
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
    setCheckoutError(null)
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
        setCheckoutError(
          data?.error === 'unknown_photo_ids'
            ? 'Algumas fotos selecionadas não estão mais disponíveis. Atualize a página e tente de novo.'
            : 'Erro ao iniciar pagamento. Tente novamente.'
        )
        setCheckoutInFlight(false)
        return
      }

      window.location.href = data.url
    } catch {
      setCheckoutError('Erro ao iniciar pagamento. Tente novamente.')
      setCheckoutInFlight(false)
    }
  }

  // Consent is asked once per component lifetime -- a search that already
  // happened (or a retry after one) skips straight to the capture modal.
  function openSearchFlow() {
    if (searching) return
    setModalOpen(consented ? 'capture' : 'consent')
  }

  const rawPrice = Number(process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS)
  // NEXT_PUBLIC_PHOTO_PRICE_CENTS is display-only -- the server computes and
  // charges the real price independently. If it's unset/misconfigured, show
  // just the count rather than fabricating a total from a hardcoded default,
  // which would silently show a price that can be wrong instead of missing.
  const unitPriceCents = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null
  const emailIsValid = EMAIL_PATTERN.test(email)

  return (
    <div className="max-w-4xl mx-auto p-4">
      {!results && (
        <div className="max-w-md mx-auto text-center bg-white border border-orca-dourado/30 rounded-[15px] p-8 shadow-[3px_3px_15px_rgba(33,33,33,0.66)]">
          <h2 className="text-xl font-extrabold text-orca-azul-escuro mb-2">Encontre suas fotos agora!</h2>
          <p className="text-orca-preto-marca mb-6">
            Envie uma selfie para localizar todas as suas fotos usando reconhecimento facial
          </p>
          <Button onClick={openSearchFlow} disabled={searching}>
            {searching ? 'Buscando...' : 'Encontrar'}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-red-700 mt-4">
          {error}
        </p>
      )}

      {modalOpen === 'consent' && (
        <ConsentModal
          onAgree={() => {
            setConsented(true)
            setModalOpen('capture')
          }}
          onCancel={() => setModalOpen('none')}
        />
      )}

      {modalOpen === 'capture' && (
        <CaptureModal
          onCapture={(file) => {
            setModalOpen('none')
            handleFile(file)
          }}
          onCancel={() => setModalOpen('none')}
        />
      )}

      {results && (
        <>
          <div className="flex items-center justify-between mt-4 mb-2">
            <Button variant="secondary" onClick={openSearchFlow}>
              Buscar novamente
            </Button>
            {results.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => setSelected(new Set(results.map((r) => r.photoId)))}
              >
                Selecionar todas
              </Button>
            )}
          </div>
          <PhotoGrid photos={results} selected={selected} onToggle={toggle} />
        </>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-orca-dourado/30 mt-4 p-4">
          <p className="mb-2">
            {selected.size} {selected.size === 1 ? 'foto selecionada' : 'fotos selecionadas'}
            {unitPriceCents !== null && <> · {formatTotalBRL(unitPriceCents, selected.size)}</>}
          </p>
          <label htmlFor="buyer-email" className="block mb-1">
            Seu e-mail
          </label>
          <input
            id="buyer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="border rounded px-3 py-2 mb-3 w-full max-w-sm"
          />
          <Button onClick={handleCheckout} disabled={!emailIsValid || checkoutInFlight}>
            Comprar
          </Button>
          {checkoutError && (
            <p role="alert" className="text-red-700 mt-2">
              {checkoutError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
