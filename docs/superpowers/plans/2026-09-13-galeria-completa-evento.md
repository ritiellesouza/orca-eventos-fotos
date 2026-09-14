# Galeria Completa do Evento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar todas as fotos do evento em `/e/[slug]` antes de qualquer busca por selfie, com seleção e checkout compartilhados entre a galeria completa e os resultados da busca.

**Architecture:** Uma rota nova de listagem paginada; um componente `EventGallery` que reaproveita `PhotoGrid`; a barra de compra sai do `SelfieUploader` e vira `CheckoutBar` própria; um novo componente cliente `EventPageClient` segura o estado de seleção/checkout compartilhado e orquestra galeria + busca + barra de compra.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Vitest + Testing Library (mesmo stack do resto do projeto).

## Global Constraints

- Galeria e busca por selfie coexistem — a busca não muda de lógica (`handleFile`, matching, threshold continuam idênticos).
- Seleção e checkout são **compartilhados**: uma foto marcada na galeria e outra marcada na busca formam uma compra só, um único `POST /api/checkout` com todos os ids juntos.
- `/api/checkout` já valida qualquer foto do evento (não só as da busca) — nenhuma mudança nessa rota é necessária.
- Nova rota `GET /api/events/[slug]/photos` é pública (sem auth), paginada, tamanho de página 40, com rate limiter leve (mesmo padrão de `web/lib/rateLimit.ts`).
- `PhotoGrid.tsx` não muda — já recebe `selected`/`onToggle` por prop, suficiente pro novo uso.
- Zero mudança de lógica de negócio na busca por selfie ou no checkout — só reorganização de onde o estado mora.
- Usar tokens de marca já existentes e o componente `Button` já existente — não criar cores novas.

---

## File Structure

- `web/app/api/events/[slug]/photos/route.ts` (novo) — lista paginada de prévias do evento.
- `web/app/api/events/[slug]/photos/route.test.ts` (novo).
- `web/components/CheckoutBar.tsx` (novo) — barra de compra extraída, agora só por prop.
- `web/components/CheckoutBar.test.tsx` (novo).
- `web/components/SelfieUploader.tsx` (modificado) — perde a lógica de checkout; seleção passa a vir por prop.
- `web/components/SelfieUploader.test.tsx` (reescrito) — só os testes de fluxo de busca continuam; testes de checkout saem daqui.
- `web/components/EventGallery.tsx` (novo) — galeria paginada de todas as fotos do evento.
- `web/components/EventGallery.test.tsx` (novo).
- `web/components/EventPageClient.tsx` (novo) — orquestrador que segura o estado compartilhado.
- `web/components/EventPageClient.test.tsx` (novo).
- `web/app/e/[slug]/page.tsx` (modificado) — troca `SelfieUploader` por `EventPageClient`.

---

### Task 1: Rota de listagem paginada de fotos do evento

**Files:**
- Create: `web/app/api/events/[slug]/photos/route.ts`
- Test: `web/app/api/events/[slug]/photos/route.test.ts`

**Interfaces:**
- Produces: `GET` handler respondendo `{ results: { photoId: string; previewUrl: string }[], hasMore: boolean }` (200), `{ error: 'event_not_found' }` (404), `{ error: 'photo_lookup_failed' }` (500), `{ error: 'rate_limited' }` (429).
- Consumes: `supabaseAdmin` de `@/lib/supabaseClient`, `requireEnv` de `@/lib/env`, `createRateLimiter` de `@/lib/rateLimit` (todos já existentes).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockEventSingle = vi.fn()
const mockPhotosRange = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'events') {
        return { select: () => ({ eq: () => ({ single: mockEventSingle }) }) }
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              range: mockPhotosRange,
            }),
          }),
        }),
      }
    },
  }),
}))

import { GET } from './route'

const EVENT_ID = '11111111-1111-1111-1111-111111111111'

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/events/festa-junina/photos${query}`)
}

describe('GET /api/events/[slug]/photos', () => {
  beforeEach(() => {
    mockEventSingle.mockReset()
    mockPhotosRange.mockReset()
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://pub.example.com'
  })

  it('returns 404 for an unknown slug', async () => {
    mockEventSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const response = await GET(makeRequest(), { params: { slug: 'nao-existe' } })

    expect(response.status).toBe(404)
  })

  it('returns a page of previews with hasMore=false when there is no next page', async () => {
    mockEventSingle.mockResolvedValue({ data: { id: EVENT_ID }, error: null })
    mockPhotosRange.mockResolvedValue({
      data: [
        { id: 'photo-1', storage_key_preview: `previews/${EVENT_ID}/a.jpg` },
        { id: 'photo-2', storage_key_preview: `previews/${EVENT_ID}/b.jpg` },
      ],
      error: null,
    })

    const response = await GET(makeRequest('?offset=0&limit=40'), { params: { slug: 'festa-junina' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      results: [
        { photoId: 'photo-1', previewUrl: `https://pub.example.com/previews/${EVENT_ID}/a.jpg` },
        { photoId: 'photo-2', previewUrl: `https://pub.example.com/previews/${EVENT_ID}/b.jpg` },
      ],
      hasMore: false,
    })
  })

  it('returns hasMore=true and trims the extra row when there is a next page', async () => {
    mockEventSingle.mockResolvedValue({ data: { id: EVENT_ID }, error: null })
    mockPhotosRange.mockResolvedValue({
      data: [
        { id: 'photo-1', storage_key_preview: 'a.jpg' },
        { id: 'photo-2', storage_key_preview: 'b.jpg' },
        { id: 'photo-3', storage_key_preview: 'c.jpg' },
      ],
      error: null,
    })

    const response = await GET(makeRequest('?offset=0&limit=2'), { params: { slug: 'festa-junina' } })
    const body = await response.json()

    expect(body.results).toHaveLength(2)
    expect(body.hasMore).toBe(true)
  })

  it('returns 500 on a database error', async () => {
    mockEventSingle.mockResolvedValue({ data: { id: EVENT_ID }, error: null })
    mockPhotosRange.mockResolvedValue({ data: null, error: { message: 'connection lost' } })

    const response = await GET(makeRequest(), { params: { slug: 'festa-junina' } })

    expect(response.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run app/api/events/\[slug\]/photos/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Write minimal implementation**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { requireEnv } from '@/lib/env'
import { createRateLimiter } from '@/lib/rateLimit'

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100

// Read-only listing of already-public preview images -- much cheaper than the
// selfie-search route (no face inference), but still anonymous and worth a
// light brake against someone scripting through every page rapidly.
const limiter = createRateLimiter(60, 60_000)

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
}

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const ip = clientIp(request)

  if (!limiter.allow(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0)
  const requestedLimit = Number(searchParams.get('limit')) || DEFAULT_LIMIT
  const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT)

  const db = supabaseAdmin()

  const { data: event, error: eventError } = await db
    .from('events')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  // Fetch one extra row to know whether there's a next page without a second
  // count query -- trimmed back to `limit` before it reaches the response.
  const { data: photos, error: photosError } = await db
    .from('photos')
    .select('id, storage_key_preview')
    .eq('event_id', event.id)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit)

  if (photosError) {
    return NextResponse.json({ error: 'photo_lookup_failed' }, { status: 500 })
  }

  const rows = photos ?? []
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows

  const publicBase = requireEnv('NEXT_PUBLIC_R2_PUBLIC_URL')
  const results = pageRows.map((photo: { id: string; storage_key_preview: string }) => ({
    photoId: photo.id,
    previewUrl: `${publicBase}/${photo.storage_key_preview}`,
  }))

  return NextResponse.json({ results, hasMore })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run app/api/events/\[slug\]/photos/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/api/events/\[slug\]/photos/route.ts web/app/api/events/\[slug\]/photos/route.test.ts
git commit -m "feat: add a paginated route listing all of an event's photo previews"
```

---

### Task 2: CheckoutBar (extraído, por prop)

**Files:**
- Create: `web/components/CheckoutBar.tsx`
- Test: `web/components/CheckoutBar.test.tsx`

**Interfaces:**
- Consumes: `Button` de `./Button`, `formatTotalBRL` de `@/lib/pricing` (ambos já existentes).
- Produces: `CheckoutBar({ selectedCount: number, unitPriceCents: number | null, email: string, onEmailChange: (email: string) => void, onCheckout: () => void, checkoutInFlight: boolean, checkoutError: string | null }): JSX.Element | null`. Retorna `null` quando `selectedCount === 0`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckoutBar } from './CheckoutBar'

function renderBar(overrides: Partial<React.ComponentProps<typeof CheckoutBar>> = {}) {
  const props = {
    selectedCount: 1,
    unitPriceCents: null as number | null,
    email: '',
    onEmailChange: vi.fn(),
    onCheckout: vi.fn(),
    checkoutInFlight: false,
    checkoutError: null as string | null,
    ...overrides,
  }
  render(<CheckoutBar {...props} />)
  return props
}

describe('CheckoutBar', () => {
  it('renders nothing when nothing is selected', () => {
    const { container } = render(
      <CheckoutBar
        selectedCount={0}
        unitPriceCents={null}
        email=""
        onEmailChange={() => {}}
        onCheckout={() => {}}
        checkoutInFlight={false}
        checkoutError={null}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the count and total when a price is set', () => {
    renderBar({ selectedCount: 1, unitPriceCents: 1500 })
    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()
    expect(screen.getByText(/R\$\s*15,00/)).toBeTruthy()
  })

  it('pluralizes for more than one photo', () => {
    renderBar({ selectedCount: 2, unitPriceCents: 1500 })
    expect(screen.getByText(/2 fotos selecionadas/i)).toBeTruthy()
    expect(screen.getByText(/R\$\s*30,00/)).toBeTruthy()
  })

  it('shows the count without a total when the price is null', () => {
    renderBar({ selectedCount: 1, unitPriceCents: null })
    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('disables the buy button until the email looks valid', () => {
    renderBar({ selectedCount: 1, email: 'nao-e-email' })
    const buyButton = screen.getByRole('button', { name: /comprar/i }) as HTMLButtonElement
    expect(buyButton.disabled).toBe(true)
  })

  it('enables the buy button with a valid email and calls onCheckout when clicked', () => {
    const onCheckout = vi.fn()
    renderBar({ selectedCount: 1, email: 'comprador@example.com', onCheckout })

    const buyButton = screen.getByRole('button', { name: /comprar/i }) as HTMLButtonElement
    expect(buyButton.disabled).toBe(false)

    fireEvent.click(buyButton)
    expect(onCheckout).toHaveBeenCalledTimes(1)
  })

  it('disables the buy button while checkout is in flight', () => {
    renderBar({ selectedCount: 1, email: 'comprador@example.com', checkoutInFlight: true })
    const buyButton = screen.getByRole('button', { name: /comprar/i }) as HTMLButtonElement
    expect(buyButton.disabled).toBe(true)
  })

  it('calls onEmailChange when the email input changes', () => {
    const onEmailChange = vi.fn()
    renderBar({ onEmailChange })

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'x@y.com' } })
    expect(onEmailChange).toHaveBeenCalledWith('x@y.com')
  })

  it('shows the checkout error message next to the buy button', () => {
    renderBar({
      selectedCount: 1,
      email: 'comprador@example.com',
      checkoutError: 'Erro ao iniciar pagamento. Tente novamente.',
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/erro ao iniciar pagamento/i)
    const buyButton = screen.getByRole('button', { name: /comprar/i })
    expect(alert.parentElement).toBe(buyButton.parentElement)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/CheckoutBar.test.tsx`
Expected: FAIL — `Cannot find module './CheckoutBar'`

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client'

import { Button } from './Button'
import { formatTotalBRL } from '@/lib/pricing'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CheckoutBar({
  selectedCount,
  unitPriceCents,
  email,
  onEmailChange,
  onCheckout,
  checkoutInFlight,
  checkoutError,
}: {
  selectedCount: number
  unitPriceCents: number | null
  email: string
  onEmailChange: (email: string) => void
  onCheckout: () => void
  checkoutInFlight: boolean
  checkoutError: string | null
}) {
  if (selectedCount === 0) {
    return null
  }

  const emailIsValid = EMAIL_PATTERN.test(email)

  return (
    <div className="sticky bottom-0 bg-white border-t border-orca-dourado/30 mt-4 p-4">
      <p className="mb-2">
        {selectedCount} {selectedCount === 1 ? 'foto selecionada' : 'fotos selecionadas'}
        {unitPriceCents !== null && <> · {formatTotalBRL(unitPriceCents, selectedCount)}</>}
      </p>
      <label htmlFor="buyer-email" className="block mb-1">
        Seu e-mail
      </label>
      <input
        id="buyer-email"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="voce@exemplo.com"
        className="border rounded px-3 py-2 mb-3 w-full max-w-sm"
      />
      <Button onClick={onCheckout} disabled={!emailIsValid || checkoutInFlight}>
        Comprar
      </Button>
      {checkoutError && (
        <p role="alert" className="text-red-700 mt-2">
          {checkoutError}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/CheckoutBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/CheckoutBar.tsx web/components/CheckoutBar.test.tsx
git commit -m "feat: extract CheckoutBar as a prop-driven component"
```

---

### Task 3: SelfieUploader — seleção por prop, sem checkout

**Files:**
- Modify: `web/components/SelfieUploader.tsx`
- Modify (reescrita completa): `web/components/SelfieUploader.test.tsx`

**Interfaces:**
- Produces: `SelfieUploader({ slug: string, selected: Set<string>, onToggle: (photoId: string) => void, onSelectMany: (photoIds: string[]) => void, onDeselectMany: (photoIds: string[]) => void }): JSX.Element`. Não recebe mais `eventId` (só era usado no checkout, que saiu daqui).
- Consumes: `PhotoGrid`, `ConsentModal`, `CaptureModal`, `Button` (inalterados).

`handleFile` mantém o corpo idêntico ao de hoje, exceto que em vez de
`setSelected(new Set())` antes de `setResults(...)`, chama
`onDeselectMany(results.map(r => r.photoId))` — usando o `results` ainda
na tela ANTES da troca — pra remover só os ids da busca anterior da seleção
compartilhada, sem mexer em nada que tenha vindo da galeria. `"Selecionar
todas"` passa a chamar `onSelectMany(results.map(r => r.photoId))` em vez
de substituir a seleção inteira (soma à seleção existente, não zera o que
já estava marcado em outro lugar da página).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `web/components/SelfieUploader.test.tsx` with:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SelfieUploader } from './SelfieUploader'

function galleryInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]:not([capture])')
}

function anyFileInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]')
}

function renderUploader(overrides: Partial<React.ComponentProps<typeof SelfieUploader>> = {}) {
  const props = {
    slug: 'festa-junina',
    selected: new Set<string>(),
    onToggle: vi.fn(),
    onSelectMany: vi.fn(),
    onDeselectMany: vi.fn(),
    ...overrides,
  }
  render(<SelfieUploader {...props} />)
  return props
}

// Drives the UI from the initial search card through the consent modal
// (only asked once per component lifetime) into the capture modal, leaving
// it open so the caller can fire a change event on the input it needs.
function openCaptureModal() {
  const encontrarButton = screen.queryByRole('button', { name: /^encontrar$/i })
  if (encontrarButton) {
    fireEvent.click(encontrarButton)
  } else {
    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))
  }

  const agreeButton = screen.queryByRole('button', { name: /estou de acordo/i })
  if (agreeButton) {
    fireEvent.click(agreeButton)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SelfieUploader search flow', () => {
  it('shows the search card and no file input before searching', () => {
    renderUploader()

    expect(anyFileInput()).toBeNull()
    expect(screen.getByRole('button', { name: /^encontrar$/i })).toBeTruthy()
  })

  it('asks for consent before opening the capture modal', () => {
    renderUploader()

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))

    expect(anyFileInput()).toBeNull()
    expect(screen.getByRole('button', { name: /estou de acordo/i })).toBeTruthy()
  })

  it('explains what happens to the selfie in the consent modal', () => {
    renderUploader()

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))

    expect(screen.getByText(/comparação facial/i)).toBeTruthy()
  })

  it('opens the capture modal with a file input after agreeing to consent', () => {
    renderUploader()

    openCaptureModal()

    expect(galleryInput()).not.toBeNull()
  })

  it('sends consent=true alongside the selfie so the server can record it', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    renderUploader()
    openCaptureModal()

    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(galleryInput()!, { target: { files: [file] } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const body = fetchMock.mock.calls[0][1]?.body as FormData
    expect(body.get('consent')).toBe('true')
    expect(body.get('selfie')).toBe(file)
  })

  it('closes the capture modal once a file is selected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    renderUploader()
    openCaptureModal()

    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(anyFileInput()).toBeNull())
  })

  it('shows a "no face detected" message and lets the user try again', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'no_face_detected' }), { status: 422 })
    )

    renderUploader()
    openCaptureModal()

    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não achamos um rosto/i))
    expect(screen.getByRole('button', { name: /^encontrar$/i })).toBeTruthy()
  })

  it('does not ask for consent again on a second search', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    renderUploader()
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))

    expect(screen.queryByRole('button', { name: /estou de acordo/i })).toBeNull()
  })

  it('calls onSelectMany with all result ids when "Selecionar todas" is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            { photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' },
            { photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' },
          ],
        }),
        { status: 200 }
      )
    )

    const onSelectMany = vi.fn()
    renderUploader({ onSelectMany })
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /selecionar todas/i }))

    expect(onSelectMany).toHaveBeenCalledWith(['photo-1', 'photo-2'])
  })

  it("calls onDeselectMany with the previous results' ids when a new search replaces them", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    const onDeselectMany = vi.fn()
    renderUploader({ onDeselectMany })
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
    expect(onDeselectMany).not.toHaveBeenCalled()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' }] }),
        { status: 200 }
      )
    )

    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's2.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(onDeselectMany).toHaveBeenCalledWith(['photo-1']))
  })

  it('renders PhotoGrid with the shared selected set and forwards onToggle', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    const onToggle = vi.fn()
    renderUploader({ selected: new Set(['photo-1']), onToggle })
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByAltText(/foto 1 \(selecionada\)/i)).toBeTruthy())

    fireEvent.click(screen.getByAltText(/foto 1 \(selecionada\)/i).closest('button')!)
    expect(onToggle).toHaveBeenCalledWith('photo-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/SelfieUploader.test.tsx`
Expected: FAIL — current `SelfieUploader` doesn't accept these props, has no `Encontrar` reachable without checkout state, etc.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `web/components/SelfieUploader.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { PhotoGrid } from './PhotoGrid'
import { ConsentModal } from './ConsentModal'
import { CaptureModal } from './CaptureModal'
import { Button } from './Button'

type PhotoResult = { photoId: string; previewUrl: string }
type ModalState = 'none' | 'consent' | 'capture'

export function SelfieUploader({
  slug,
  selected,
  onToggle,
  onSelectMany,
  onDeselectMany,
}: {
  slug: string
  selected: Set<string>
  onToggle: (photoId: string) => void
  onSelectMany: (photoIds: string[]) => void
  onDeselectMany: (photoIds: string[]) => void
}) {
  const [consented, setConsented] = useState(false)
  const [modalOpen, setModalOpen] = useState<ModalState>('none')
  const [results, setResults] = useState<PhotoResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

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

      // A new search replaces the visible grid entirely. Any photo ids
      // selected from the PREVIOUS search results would otherwise ride
      // along in the shared selection with no visible tile to deselect them
      // from -- the buyer would be billed for a photo they can no longer
      // see. Only the previous search's own ids are removed: a selection
      // made in the full gallery lives in the same shared set and must
      // survive a fresh selfie search.
      if (results) {
        onDeselectMany(results.map((r) => r.photoId))
      }
      setResults(data?.results ?? [])
      setSearching(false)
    } catch {
      setError('Erro ao buscar fotos.')
      setSearching(false)
    }
  }

  // Consent is asked once per component lifetime -- a search that already
  // happened (or a retry after one) skips straight to the capture modal.
  function openSearchFlow() {
    if (searching) return
    setModalOpen(consented ? 'capture' : 'consent')
  }

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
              <Button variant="secondary" onClick={() => onSelectMany(results.map((r) => r.photoId))}>
                Selecionar todas
              </Button>
            )}
          </div>
          <PhotoGrid photos={results} selected={selected} onToggle={onToggle} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/SelfieUploader.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/SelfieUploader.tsx web/components/SelfieUploader.test.tsx
git commit -m "refactor: lift selection and checkout out of SelfieUploader"
```

---

### Task 4: EventGallery

**Files:**
- Create: `web/components/EventGallery.tsx`
- Test: `web/components/EventGallery.test.tsx`

**Interfaces:**
- Consumes: `PhotoGrid` (inalterado), `Button` (inalterado), a rota do Task 1 (`GET /api/events/[slug]/photos?offset=&limit=`).
- Produces: `EventGallery({ slug: string, selected: Set<string>, onToggle: (photoId: string) => void, onSelectMany: (photoIds: string[]) => void }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventGallery } from './EventGallery'

function renderGallery(overrides: Partial<React.ComponentProps<typeof EventGallery>> = {}) {
  const props = {
    slug: 'festa-junina',
    selected: new Set<string>(),
    onToggle: vi.fn(),
    onSelectMany: vi.fn(),
    ...overrides,
  }
  render(<EventGallery {...props} />)
  return props
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EventGallery', () => {
  it('loads and shows the first page of photos on mount', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
          hasMore: false,
        }),
        { status: 200 }
      )
    )

    renderGallery()

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
  })

  it('requests the first page with offset=0', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], hasMore: false }), { status: 200 }))

    renderGallery()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/events/festa-junina/photos?offset=0&limit=40'))
  })

  it('shows "Carregar mais" when hasMore is true, and loads the next page on click', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
            hasMore: true,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' }],
            hasMore: false,
          }),
          { status: 200 }
        )
      )

    renderGallery()
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }))

    await waitFor(() => expect(screen.getByAltText(/foto 2/i)).toBeTruthy())
    expect(screen.getByAltText(/foto 1/i)).toBeTruthy()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/events/festa-junina/photos?offset=1&limit=40')
    expect(screen.queryByRole('button', { name: /carregar mais/i })).toBeNull()
  })

  it('does not show "Carregar mais" when hasMore is false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
          hasMore: false,
        }),
        { status: 200 }
      )
    )

    renderGallery()
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    expect(screen.queryByRole('button', { name: /carregar mais/i })).toBeNull()
  })

  it('shows an error and a retry button when the initial load fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }))

    renderGallery()

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeTruthy()
  })

  it('retries the initial load when "Tentar novamente" is clicked', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
            hasMore: false,
          }),
          { status: 200 }
        )
      )

    renderGallery()
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps already-loaded photos when "Carregar mais" fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
            hasMore: true,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response('', { status: 500 }))

    renderGallery()
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByAltText(/foto 1/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /carregar mais/i })).toBeTruthy()
  })

  it('calls onSelectMany with all loaded photo ids when "Selecionar todas" is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            { photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' },
            { photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' },
          ],
          hasMore: false,
        }),
        { status: 200 }
      )
    )

    const onSelectMany = vi.fn()
    renderGallery({ onSelectMany })
    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /selecionar todas/i }))

    expect(onSelectMany).toHaveBeenCalledWith(['photo-1', 'photo-2'])
  })

  it('forwards the shared selected set and onToggle to PhotoGrid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }],
          hasMore: false,
        }),
        { status: 200 }
      )
    )

    const onToggle = vi.fn()
    renderGallery({ selected: new Set(['photo-1']), onToggle })
    await waitFor(() => expect(screen.getByAltText(/foto 1 \(selecionada\)/i)).toBeTruthy())

    fireEvent.click(screen.getByAltText(/foto 1 \(selecionada\)/i).closest('button')!)
    expect(onToggle).toHaveBeenCalledWith('photo-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/EventGallery.test.tsx`
Expected: FAIL — `Cannot find module './EventGallery'`

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { PhotoGrid } from './PhotoGrid'
import { Button } from './Button'

type PhotoResult = { photoId: string; previewUrl: string }

const PAGE_SIZE = 40

export function EventGallery({
  slug,
  selected,
  onToggle,
  onSelectMany,
}: {
  slug: string
  selected: Set<string>
  onToggle: (photoId: string) => void
  onSelectMany: (photoIds: string[]) => void
}) {
  const [photos, setPhotos] = useState<PhotoResult[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPage(offset: number) {
    try {
      const response = await fetch(`/api/events/${slug}/photos?offset=${offset}&limit=${PAGE_SIZE}`)

      if (!response.ok) {
        setError('Erro ao carregar as fotos do evento.')
        return
      }

      const data: { results: PhotoResult[]; hasMore: boolean } = await response.json()
      setPhotos((prev) => (offset === 0 ? data.results : [...prev, ...data.results]))
      setHasMore(data.hasMore)
      setError(null)
    } catch {
      setError('Erro ao carregar as fotos do evento.')
    }
  }

  useEffect(() => {
    setLoading(true)
    loadPage(0).finally(() => setLoading(false))
    // slug is fixed for the lifetime of this page -- no other dependency to
    // re-fetch on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  async function handleLoadMore() {
    setLoadingMore(true)
    await loadPage(photos.length)
    setLoadingMore(false)
  }

  if (loading) {
    return <p className="max-w-4xl mx-auto p-4">Carregando fotos...</p>
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-extrabold text-orca-azul-escuro">Todas as fotos do evento</h2>
        {photos.length > 0 && (
          <Button variant="secondary" onClick={() => onSelectMany(photos.map((p) => p.photoId))}>
            Selecionar todas
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-red-700 mb-3">
          {error}
        </p>
      )}

      {photos.length > 0 && <PhotoGrid photos={photos} selected={selected} onToggle={onToggle} />}

      {error && photos.length === 0 && (
        <Button variant="secondary" onClick={() => loadPage(0)}>
          Tentar novamente
        </Button>
      )}

      {hasMore && (
        <div className="text-center mt-4">
          <Button variant="secondary" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/EventGallery.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/EventGallery.tsx web/components/EventGallery.test.tsx
git commit -m "feat: add EventGallery, a paginated view of all of an event's photos"
```

---

### Task 5: EventPageClient — estado compartilhado

**Files:**
- Create: `web/components/EventPageClient.tsx`
- Test: `web/components/EventPageClient.test.tsx`

**Interfaces:**
- Consumes: `EventGallery` (Task 4, props `{slug, selected, onToggle, onSelectMany}`), `SelfieUploader` (Task 3, props `{slug, selected, onToggle, onSelectMany, onDeselectMany}`), `CheckoutBar` (Task 2, props `{selectedCount, unitPriceCents, email, onEmailChange, onCheckout, checkoutInFlight, checkoutError}`).
- Produces: `EventPageClient({ slug: string, eventId: string }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventPageClient } from './EventPageClient'

const EVENT_ID = '11111111-1111-1111-1111-111111111111'

function galleryFileInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]:not([capture])')
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS
})

function mockFetchSequence(responses: Array<{ url: RegExp; body: unknown; status?: number }>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const match = responses.find((r) => r.url.test(url))
    if (!match) {
      throw new Error(`Unexpected fetch: ${url}`)
    }
    return new Response(JSON.stringify(match.body), { status: match.status ?? 200 })
  })
}

describe('EventPageClient', () => {
  it('combines a gallery selection and a search-result selection into one checkout bar', async () => {
    mockFetchSequence([
      {
        url: /\/api\/events\/festa-junina\/photos/,
        body: { results: [{ photoId: 'gallery-1', previewUrl: 'https://example.com/g1.jpg' }], hasMore: false },
      },
      {
        url: /\/api\/events\/festa-junina\/search/,
        body: { results: [{ photoId: 'search-1', previewUrl: 'https://example.com/s1.jpg' }] },
      },
    ])

    render(<EventPageClient slug="festa-junina" eventId={EVENT_ID} />)

    await waitFor(() => expect(screen.getByAltText(/^foto 1$/i)).toBeTruthy())
    fireEvent.click(screen.getByAltText(/^foto 1$/i).closest('button')!)

    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))
    fireEvent.click(screen.getByRole('button', { name: /estou de acordo/i }))
    fireEvent.change(galleryFileInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getAllByAltText(/^foto 1$/i)).toHaveLength(2))
    const searchPhoto = screen.getAllByAltText(/^foto 1$/i)[1]
    fireEvent.click(searchPhoto.closest('button')!)

    await waitFor(() => expect(screen.getByText(/2 fotos selecionadas/i)).toBeTruthy())
  })

  it('posts every selected photo id (gallery + search) in a single checkout request', async () => {
    mockFetchSequence([
      {
        url: /\/api\/events\/festa-junina\/photos/,
        body: { results: [{ photoId: 'gallery-1', previewUrl: 'https://example.com/g1.jpg' }], hasMore: false },
      },
      {
        url: /\/api\/events\/festa-junina\/search/,
        body: { results: [{ photoId: 'search-1', previewUrl: 'https://example.com/s1.jpg' }] },
      },
      { url: /\/api\/checkout/, body: { url: 'https://checkout.stripe.com/session-123' } },
    ])

    render(<EventPageClient slug="festa-junina" eventId={EVENT_ID} />)

    await waitFor(() => expect(screen.getByAltText(/^foto 1$/i)).toBeTruthy())
    fireEvent.click(screen.getByAltText(/^foto 1$/i).closest('button')!)

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))
    fireEvent.click(screen.getByRole('button', { name: /estou de acordo/i }))
    fireEvent.change(galleryFileInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getAllByAltText(/^foto 1$/i)).toHaveLength(2))
    fireEvent.click(screen.getAllByAltText(/^foto 1$/i)[1].closest('button')!)

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    delete (window as unknown as { location: unknown }).location
    ;(window as unknown as { location: Location }).location = { href: '' } as Location

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/session-123'))

    const checkoutCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).includes('/api/checkout')
    )
    const body = JSON.parse(checkoutCall![1].body as string)
    expect(body.eventId).toBe(EVENT_ID)
    expect(new Set(body.photoIds)).toEqual(new Set(['gallery-1', 'search-1']))
  })

  it('clears only the stale search selection when a new search replaces results, keeping the gallery selection', async () => {
    mockFetchSequence([
      {
        url: /\/api\/events\/festa-junina\/photos/,
        body: { results: [{ photoId: 'gallery-1', previewUrl: 'https://example.com/g1.jpg' }], hasMore: false },
      },
      {
        url: /\/api\/events\/festa-junina\/search/,
        body: { results: [{ photoId: 'search-1', previewUrl: 'https://example.com/s1.jpg' }] },
      },
    ])

    render(<EventPageClient slug="festa-junina" eventId={EVENT_ID} />)

    await waitFor(() => expect(screen.getByAltText(/^foto 1$/i)).toBeTruthy())
    fireEvent.click(screen.getByAltText(/^foto 1$/i).closest('button')!)

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))
    fireEvent.click(screen.getByRole('button', { name: /estou de acordo/i }))
    fireEvent.change(galleryFileInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getAllByAltText(/^foto 1$/i)).toHaveLength(2))
    fireEvent.click(screen.getAllByAltText(/^foto 1$/i)[1].closest('button')!)
    await waitFor(() => expect(screen.getByText(/2 fotos selecionadas/i)).toBeTruthy())

    mockFetchSequence([
      {
        url: /\/api\/events\/festa-junina\/photos/,
        body: { results: [{ photoId: 'gallery-1', previewUrl: 'https://example.com/g1.jpg' }], hasMore: false },
      },
      {
        url: /\/api\/events\/festa-junina\/search/,
        body: { results: [{ photoId: 'search-2', previewUrl: 'https://example.com/s2.jpg' }] },
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))
    fireEvent.change(galleryFileInput()!, {
      target: { files: [new File(['b'], 's2.jpg', { type: 'image/jpeg' })] },
    })

    // The previous search's selection (search-1) is gone, but the gallery
    // selection (gallery-1) must survive.
    await waitFor(() => expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/EventPageClient.test.tsx`
Expected: FAIL — `Cannot find module './EventPageClient'`

- [ ] **Step 3: Write minimal implementation**

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/EventPageClient.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/EventPageClient.tsx web/components/EventPageClient.test.tsx
git commit -m "feat: add EventPageClient to share selection/checkout between gallery and search"
```

---

### Task 6: Ligar `EventPageClient` na página + verificação final

**Files:**
- Modify: `web/app/e/[slug]/page.tsx`

**Interfaces:**
- Consumes: `EventPageClient({ slug, eventId })` do Task 5.

- [ ] **Step 1: Write the implementation**

Não há teste próprio pra esta página (server component com acesso a banco,
sem teste unitário, mesmo padrão do resto do projeto) — verificação é a
suíte completa + build no Step 2.

Replace the full contents of `web/app/e/[slug]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation'
import { EventPageClient } from '@/components/EventPageClient'
import { BrandHeader } from '@/components/BrandHeader'
import { EventBanner } from '@/components/EventBanner'
import { SiteFooter } from '@/components/SiteFooter'
import { supabaseAdmin } from '@/lib/supabaseClient'

// Without this, Next.js treats this route as static-if-possible (it only
// auto-detects dynamism from native fetch(), not from the Supabase client
// library) and caches the rendered page indefinitely — a deleted or
// recreated event would keep serving a stale eventId to the checkout flow.
export const dynamic = 'force-dynamic'

export default async function EventPage({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin()
  const { data: event } = await db.from('events').select('id, name').eq('slug', params.slug).single()

  if (!event) {
    notFound()
  }

  return (
    <>
      <BrandHeader />
      <EventBanner eventName={event.name} />
      <main className="py-8">
        <EventPageClient slug={params.slug} eventId={event.id} />
      </main>
      <SiteFooter />
    </>
  )
}
```

- [ ] **Step 2: Run the full suite, type check, lint, and build**

Run: `cd web && npx vitest run && npx tsc --noEmit && npx eslint . && npx next build`
Expected: all four pass with no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/e/\[slug\]/page.tsx
git commit -m "feat: wire EventPageClient into the event page"
```

---

## Self-Review Notes

- **Spec coverage:** §3 nova rota paginada (Task 1), `EventGallery` (Task 4), `CheckoutBar` extraído (Task 2), `EventPageClient` compartilhando estado (Task 5), `SelfieUploader` sem checkout (Task 3), `page.tsx` ligando tudo (Task 6). §2 "fora do escopo" — nenhuma mudança na lógica de busca/checkout, nenhum filtro avançado na galeria. §4 fluxo — coberto pelos testes de integração do Task 5 (seleção combinada, checkout único, deselect seletivo na busca nova). §5 erros — Task 1 cobre 404/500/429; Task 4 cobre falha na primeira carga (retry) e falha no "carregar mais" (mantém o que já tinha). §6 testes — todo arquivo testável tem task; `page.tsx` sem teste próprio segue o padrão já estabelecido no resto do projeto pra server components com acesso a banco.
- **Placeholder scan:** sem TBD/TODO; todo step tem código real.
- **Type consistency:** `PhotoResult` (`{photoId, previewUrl}`) usado de forma idêntica em `SelfieUploader.tsx`, `EventGallery.tsx` e na resposta da rota do Task 1 — mesmo formato, sem type novo compartilhado (segue o padrão já existente no projeto, que já duplica esse type em `PhotoGrid.tsx`/`SelfieUploader.tsx` em vez de centralizar). As props de `SelfieUploader`/`EventGallery`/`CheckoutBar` batem exatamente com o que `EventPageClient` (Task 5) passa pra elas.
