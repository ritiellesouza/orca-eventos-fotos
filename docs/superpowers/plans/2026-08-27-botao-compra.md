# Botão de Compra na Galeria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing photo-selection UI to the existing (already-built, tested) `POST /api/checkout` endpoint, so selecting photos and clicking "Comprar" actually redirects to Stripe Checkout.

**Architecture:** No API changes — `/api/checkout` already accepts `{eventId, photoIds, buyerEmail}` and returns `{url}`. This plan adds: a pure pricing-formatting function, an `eventId` prop threaded from the event page (a server component) down to `SelfieUploader`, and a checkout bar in `SelfieUploader` that captures the buyer's email and calls the existing endpoint.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Vitest + Testing Library (already set up in `web/`).

## Global Constraints

- No changes to `web/app/api/checkout/route.ts` or `web/lib/checkout.ts` — that endpoint is already implemented, tested, and reviewed. This plan is client-side only.
- `NEXT_PUBLIC_PHOTO_PRICE_CENTS` must be referenced as a literal `process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS` in client component source — Next.js's build only inlines `NEXT_PUBLIC_*` vars for literal property-access references, not dynamic lookups like `process.env[name]`. Do not route this through `web/lib/env.ts`'s `requireEnv(name)` (which does a dynamic `process.env[name]` lookup) for this specific value.
- The server never trusts a client-supplied price — `web/lib/checkout.ts` already reads `PHOTO_PRICE_CENTS` (no `NEXT_PUBLIC_` prefix) itself. The public copy is display-only.
- Follow existing patterns: dependency-free pure functions get colocated `.test.ts` files (see `web/lib/imagePipeline.ts`); component tests use `@testing-library/react` with `render`/`fireEvent`/`waitFor` (see `web/components/SelfieUploader.test.tsx`).

---

## File Structure

```
web/
  lib/
    pricing.ts              # new: pure BRL total formatting
    pricing.test.ts         # new
  components/
    SelfieUploader.tsx       # modified: +eventId prop, +checkout bar, +handleCheckout
    SelfieUploader.test.tsx  # modified: existing render() calls gain eventId prop, +new checkout-bar tests
  app/
    e/[slug]/page.tsx        # modified: becomes an async server component, resolves eventId from slug
  .env.local.example         # modified: +NEXT_PUBLIC_PHOTO_PRICE_CENTS
```

---

### Task 1: Price formatting helper

**Files:**
- Create: `web/lib/pricing.ts`
- Test: `web/lib/pricing.test.ts`

**Interfaces:**
- Produces: `formatTotalBRL(unitPriceCents: number, count: number): string` — used by Task 2's `SelfieUploader.tsx`.

- [ ] **Step 1: Write the failing test**

Create `web/lib/pricing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatTotalBRL } from './pricing'

describe('formatTotalBRL', () => {
  it('formats a single photo at a whole-real price', () => {
    expect(formatTotalBRL(1500, 1)).toBe('R$\u00A015,00')
  })

  it('multiplies unit price by count', () => {
    expect(formatTotalBRL(1500, 3)).toBe('R$\u00A045,00')
  })

  it('formats zero photos as zero', () => {
    expect(formatTotalBRL(1500, 0)).toBe('R$\u00A00,00')
  })

  it('formats cents correctly, not just whole reais', () => {
    expect(formatTotalBRL(1050, 2)).toBe('R$\u00A021,00')
    expect(formatTotalBRL(999, 1)).toBe('R$\u00A09,99')
  })
})
```

Note: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` renders the space between `R$` and the number as a non-breaking space (`\u00A0`), not a regular space — the test asserts the exact character Node's ICU data produces.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- pricing`
Expected: FAIL (`pricing.ts` doesn't exist)

- [ ] **Step 3: Implement `formatTotalBRL`**

Create `web/lib/pricing.ts`:

```typescript
export function formatTotalBRL(unitPriceCents: number, count: number): string {
  const totalCents = unitPriceCents * count
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCents / 100)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- pricing`
Expected: PASS (4 tests)

If the exact whitespace character in the assertions doesn't match your environment's ICU output, run the test once, read the actual failure diff, and adjust the test's expected strings to match reality (the space character can differ across Node/ICU builds) — the goal is asserting the real formatted output, not a specific byte sequence you haven't verified.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/lib/pricing.ts web/lib/pricing.test.ts
git commit -m "feat: add BRL total price formatting helper"
```

---

### Task 2: Checkout bar in the event page

**Files:**
- Modify: `web/app/e/[slug]/page.tsx`
- Modify: `web/components/SelfieUploader.tsx`
- Modify: `web/components/SelfieUploader.test.tsx`
- Modify: `web/.env.local.example`

**Interfaces:**
- Consumes: `formatTotalBRL` (Task 1). `POST /api/checkout` (already implemented) — request body `{eventId: string, photoIds: string[], buyerEmail: string}`, success response `{url: string}`, error responses `{error: string}` with status 400/500 (notably `unknown_photo_ids`).
- Produces: `SelfieUploader` gains a required `eventId: string` prop — the current signature `SelfieUploader({ slug }: { slug: string })` becomes `SelfieUploader({ slug, eventId }: { slug: string; eventId: string })`.

- [ ] **Step 1: Update `page.tsx` to resolve the event id server-side and pass it down**

Read the current file first — this is the exact replacement:

Current `web/app/e/[slug]/page.tsx`:
```typescript
import { SelfieUploader } from '@/components/SelfieUploader'

export default function EventPage({ params }: { params: { slug: string } }) {
  return (
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Encontre suas fotos</h1>
      <SelfieUploader slug={params.slug} />
    </main>
  )
}
```

Replace with:
```typescript
import { notFound } from 'next/navigation'
import { SelfieUploader } from '@/components/SelfieUploader'
import { supabaseAdmin } from '@/lib/supabaseClient'

export default async function EventPage({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin()
  const { data: event } = await db.from('events').select('id').eq('slug', params.slug).single()

  if (!event) {
    notFound()
  }

  return (
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Encontre suas fotos</h1>
      <SelfieUploader slug={params.slug} eventId={event.id} />
    </main>
  )
}
```

This mirrors the exact `supabaseAdmin().from('events').select(...).eq('slug', ...).single()` pattern already used in `web/app/api/events/[slug]/search/route.ts:38-42`. `notFound()` is Next.js App Router's standard helper (from `next/navigation`) for rendering the framework's 404 page from a server component.

- [ ] **Step 2: Update the existing `SelfieUploader.test.tsx` render calls to pass `eventId`**

`web/components/SelfieUploader.test.tsx` currently renders `<SelfieUploader slug="festa-junina" />` in four places (one per `it` block). Update every one of them to `<SelfieUploader slug="festa-junina" eventId="11111111-1111-1111-1111-111111111111" />`. Do this now, before changing the component, so you can confirm in the next step whether the suite still compiles/passes with the prop present but unused.

- [ ] **Step 3: Run the existing suite to confirm it still passes with the added prop**

Run: `cd web && npm run test -- SelfieUploader`
Expected: PASS (4 tests, same as before — `eventId` isn't used by the component yet, TypeScript will complain it's now a required prop on the type but not yet destructured/used, which is fine, not an error)

- [ ] **Step 4: Write the failing tests for the checkout bar**

Add to the end of `web/components/SelfieUploader.test.tsx` (new `describe` block, same file, same imports already present):

```typescript
describe('SelfieUploader checkout bar', () => {
  const eventId = '11111111-1111-1111-1111-111111111111'

  async function selectOnePhoto() {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    render(<SelfieUploader slug="festa-junina" eventId={eventId} />)
    fireEvent.click(screen.getByRole('button', { name: /concordo/i }))

    const input = fileInput()!
    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
    fireEvent.click(screen.getByAltText(/foto 1/i).closest('button')!)
  }

  it('does not show the checkout bar with nothing selected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    render(<SelfieUploader slug="festa-junina" eventId={eventId} />)
    fireEvent.click(screen.getByRole('button', { name: /concordo/i }))
    const input = fileInput()!
    fireEvent.change(input, { target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    expect(screen.queryByRole('button', { name: /comprar/i })).toBeNull()
  })

  it('shows the checkout bar with the correct total once a photo is selected', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()

    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()
    expect(screen.getByText(/R\$\s*15,00/)).toBeTruthy()
  })

  it('disables the buy button until the email looks valid', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()

    const buyButton = screen.getByRole('button', { name: /comprar/i }) as HTMLButtonElement
    expect(buyButton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'nao-e-email' } })
    expect(buyButton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })
    expect(buyButton.disabled).toBe(false)
  })

  it('posts to /api/checkout with the selected photo and redirects on success', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    const checkoutFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/session-123' }), { status: 200 }))

    delete (window as unknown as { location: unknown }).location
    window.location = { href: '' } as Location

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(checkoutFetch).toHaveBeenCalled())

    const [url, init] = checkoutFetch.mock.calls[0]
    expect(url).toBe('/api/checkout')
    const body = JSON.parse(init!.body as string)
    expect(body).toEqual({ eventId, photoIds: ['photo-1'], buyerEmail: 'comprador@example.com' })

    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/session-123'))
  })

  it('shows a specific message when a photo is no longer available', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'unknown_photo_ids' }), { status: 400 })
    )

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não estão mais disponíveis/i))
  })

  it('shows a generic message on a network failure', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/erro ao iniciar pagamento/i))
  })
})
```

This test file references `PhotoGrid`'s rendered `alt` text to select a photo — confirm against `web/components/PhotoGrid.tsx`'s current `alt` text format (it was changed in an earlier task to include an ordinal and selection state, e.g. `` `Foto ${index + 1}` ``); adjust the `getByAltText` regex above if the actual text differs from `/foto 1/i`.

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd web && npm run test -- SelfieUploader`
Expected: FAIL — no checkout bar exists yet, `getByRole('button', { name: /comprar/i })` etc. won't be found.

- [ ] **Step 6: Implement the checkout bar in `SelfieUploader.tsx`**

Modify `web/components/SelfieUploader.tsx`. Full replacement:

```typescript
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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd web && npm run test -- SelfieUploader`
Expected: PASS (all tests in both `describe` blocks)

If the `alt` text selector from Step 4 doesn't match `PhotoGrid`'s actual output, or the checkout-bar copy/selectors need small adjustments to match what you rendered, fix the test expectations to match real, correct behavior — not the other way around.

- [ ] **Step 8: Add the public price env var**

Add to `web/.env.local.example` (alongside the existing `PHOTO_PRICE_CENTS=1500` line):

```
# Public copy of PHOTO_PRICE_CENTS, shown to the buyer before checkout. Keep
# these two values in sync manually — the server never trusts this one.
NEXT_PUBLIC_PHOTO_PRICE_CENTS=1500
```

- [ ] **Step 9: Run the full suite, tsc, lint, and build**

Run: `cd web && npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all four succeed. `npm run build` has broken twice already in this project's history from changes that looked unrelated to the build — do not skip it. If `next build` warns or fails about `process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS` being unset (it has no value at build time in this environment, only in `.env.local.example`), confirm the build still completes — an unset `NEXT_PUBLIC_*` var is `undefined` in the bundle, not a build error; `Number(undefined)` is `NaN`, which `formatTotalBRL` will render as `NaN`-derived text (e.g. via `Intl.NumberFormat`, likely `R$ NaN`) rather than throwing. This is an accepted display-only degradation when the operator forgets to set the var — the actual `/api/checkout` call still works correctly regardless, since the server computes the real price independently.

- [ ] **Step 10: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/app/e/[slug]/page.tsx web/components/SelfieUploader.tsx web/components/SelfieUploader.test.tsx web/.env.local.example
git commit -m "feat: wire photo selection to Stripe checkout"
```

---

## Self-Review Notes

- **Spec coverage:** §2 (barra de checkout, campo e-mail, total, redirecionamento) → Task 2. §5 (preço no cliente, `NEXT_PUBLIC_PHOTO_PRICE_CENTS`, servidor não confia no cliente) → Task 1 + Task 2 Global Constraints. §6 (tratamento de erro: `unknown_photo_ids`, falha de rede, e-mail inválido) → Task 2 Steps 4/6. §7 (testes: `pricing.test.ts`, casos na `SelfieUploader.test.tsx`) → Task 1 Step 1, Task 2 Steps 2/4.
- **Placeholder scan:** none found — every step has complete, runnable code.
- **Type consistency:** `formatTotalBRL(unitPriceCents: number, count: number): string` (Task 1) matches its only call site in Task 2's `SelfieUploader.tsx`. `SelfieUploader`'s new `eventId: string` prop is threaded consistently from `page.tsx` (Task 2 Step 1) through to the component (Step 6) and every test render call (Step 2, Step 4).
