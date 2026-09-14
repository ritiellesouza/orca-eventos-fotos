'use client'

import { useEffect, useState } from 'react'
import { EventGallery } from './EventGallery'
import { SelfieUploader } from './SelfieUploader'
import { CheckoutBar } from './CheckoutBar'

export function EventPageClient({ slug, eventId }: { slug: string; eventId: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState('')
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutInFlight, setCheckoutInFlight] = useState(false)

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

  function selectMany(photoIds: string[]) {
    setSelected((prev) => new Set([...prev, ...photoIds]))
  }

  function deselectMany(photoIds: string[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      photoIds.forEach((id) => next.delete(id))
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

  const rawPrice = Number(process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS)
  // NEXT_PUBLIC_PHOTO_PRICE_CENTS is display-only -- the server computes and
  // charges the real price independently. If it's unset/misconfigured, show
  // just the count rather than fabricating a total from a hardcoded default,
  // which would silently show a price that can be wrong instead of missing.
  const unitPriceCents = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null

  return (
    <>
      <EventGallery slug={slug} selected={selected} onToggle={toggle} onSelectMany={selectMany} />
      <SelfieUploader
        slug={slug}
        selected={selected}
        onToggle={toggle}
        onSelectMany={selectMany}
        onDeselectMany={deselectMany}
      />
      <CheckoutBar
        selectedCount={selected.size}
        unitPriceCents={unitPriceCents}
        email={email}
        onEmailChange={setEmail}
        onCheckout={handleCheckout}
        checkoutInFlight={checkoutInFlight}
        checkoutError={checkoutError}
      />
    </>
  )
}
