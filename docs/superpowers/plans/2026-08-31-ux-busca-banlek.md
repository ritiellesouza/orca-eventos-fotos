# UX da Busca por Selfie no Padrão Banlek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar `/e/[slug]` no padrão visual Banlek (banner + cartão de busca + modais de consentimento/captura + grade com checkbox) sem mudar nenhuma lógica de negócio.

**Architecture:** Três componentes novos e pequenos (`EventBanner`, `ConsentModal`, `CaptureModal`); `SelfieUploader` ganha um estado `modalOpen: 'none' | 'consent' | 'capture'` que orquestra os modais mas chama as mesmas funções (`handleFile`, `handleCheckout`, `toggle`) sem alterá-las; `PhotoGrid` ganha um indicador visual decorativo; `page.tsx` passa `name` do evento pro banner.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Vitest + Testing Library (mesmo stack já usado no resto do projeto).

## Global Constraints

- Zero mudança de lógica de negócio: mesma busca facial, mesmo consentimento LGPD real, mesmo checkout, mesma seleção de fotos (spec §1, §3).
- Texto de consentimento LGPD deve ser byte-idêntico ao atual: "Para achar suas fotos, vamos processar uma selfie sua apenas para comparação facial neste evento. Os dados são processados em servidor próprio da Orca Mídias e removidos após 120 dias." (spec §3, §6).
- Sem conta de comprador, sem carrinho entre eventos, sem itens de navbar tipo "Vender fotos"/"Criar conta" (spec §2 — confirmado explicitamente pelo usuário, não é pivô de marketplace).
- Nenhum caminho de erro novo — os mesmos de hoje (`no_face_detected`, erro de rede, erro de checkout) continuam existindo com `role="alert"` (spec §5).
- Usar tokens de marca já existentes (`orca-azul-escuro`, `orca-royal`, `orca-verde-agua`, `orca-dourado`, `orca-preto-marca`) e o componente `Button` já existente (`web/components/Button.tsx`, variantes `primary`/`secondary`) — não criar cores ou botões novos.
- `handleFile`, `handleCheckout`, `toggle` em `SelfieUploader.tsx` mantêm corpo idêntico ao atual — só mudam de onde são chamados.

---

## File Structure

- `web/components/EventBanner.tsx` (novo) — faixa de topo com nome do evento.
- `web/components/EventBanner.test.tsx` (novo).
- `web/components/ConsentModal.tsx` (novo) — popup do texto LGPD com Cancelar/Estou de acordo.
- `web/components/ConsentModal.test.tsx` (novo).
- `web/components/CaptureModal.tsx` (novo) — popup com os dois inputs de arquivo (galeria/câmera) escondidos.
- `web/components/CaptureModal.test.tsx` (novo).
- `web/components/PhotoGrid.tsx` (modificado) — indicador de checkbox decorativo.
- `web/components/PhotoGrid.test.tsx` (novo).
- `web/components/SelfieUploader.tsx` (modificado) — orquestra os modais, ganha "Selecionar todas".
- `web/components/SelfieUploader.test.tsx` (reescrito) — mesmos casos, fluxo novo.
- `web/app/e/[slug]/page.tsx` (modificado) — seleciona `name`, renderiza `EventBanner`.

---

### Task 1: EventBanner

**Files:**
- Create: `web/components/EventBanner.tsx`
- Test: `web/components/EventBanner.test.tsx`

**Interfaces:**
- Produces: `EventBanner({ eventName: string }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventBanner } from './EventBanner'

describe('EventBanner', () => {
  it('renders the event name it receives', () => {
    render(<EventBanner eventName="Festa Junina 2026" />)

    expect(screen.getByRole('heading', { name: 'Festa Junina 2026' })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/EventBanner.test.tsx`
Expected: FAIL — `Cannot find module './EventBanner'`

- [ ] **Step 3: Write minimal implementation**

```tsx
export function EventBanner({ eventName }: { eventName: string }) {
  return (
    <div className="bg-orca-azul-escuro py-12 px-4 text-center">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{eventName}</h1>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/EventBanner.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/EventBanner.tsx web/components/EventBanner.test.tsx
git commit -m "feat: add EventBanner component for the event page header"
```

---

### Task 2: ConsentModal

**Files:**
- Create: `web/components/ConsentModal.tsx`
- Test: `web/components/ConsentModal.test.tsx`

**Interfaces:**
- Consumes: `Button` from `./Button` (`variant="primary" | "secondary"`, already exists)
- Produces: `ConsentModal({ onAgree: () => void, onCancel: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConsentModal } from './ConsentModal'

describe('ConsentModal', () => {
  it('explains what happens to the selfie', () => {
    render(<ConsentModal onAgree={() => {}} onCancel={() => {}} />)

    expect(
      screen.getByText(
        /processar uma selfie sua apenas para comparação facial neste evento/i
      )
    ).toBeTruthy()
  })

  it('calls onAgree when "Estou de acordo" is clicked', () => {
    const onAgree = vi.fn()
    render(<ConsentModal onAgree={onAgree} onCancel={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /estou de acordo/i }))

    expect(onAgree).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when "Cancelar" is clicked', () => {
    const onCancel = vi.fn()
    render(<ConsentModal onAgree={() => {}} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/ConsentModal.test.tsx`
Expected: FAIL — `Cannot find module './ConsentModal'`

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client'

import { Button } from './Button'

export function ConsentModal({ onAgree, onCancel }: { onAgree: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[15px] max-w-md w-full p-6">
        <h2 className="text-xl font-extrabold text-orca-azul-escuro mb-3">Permissão para busca facial</h2>
        <p className="text-orca-preto-marca mb-6">
          Para achar suas fotos, vamos processar uma selfie sua apenas para comparação facial neste evento. Os
          dados são processados em servidor próprio da Orca Mídias e removidos após 120 dias.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onAgree}>Estou de acordo</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/ConsentModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/ConsentModal.tsx web/components/ConsentModal.test.tsx
git commit -m "feat: add ConsentModal component with the existing LGPD consent text"
```

---

### Task 3: CaptureModal

**Files:**
- Create: `web/components/CaptureModal.tsx`
- Test: `web/components/CaptureModal.test.tsx`

**Interfaces:**
- Consumes: `Button` from `./Button`
- Produces: `CaptureModal({ onCapture: (file: File) => void, onCancel: () => void }): JSX.Element`. Renders two hidden `<input type="file" accept="image/*">` elements — one plain (gallery), one with `capture="user"` (camera) — mounted only while the modal is rendered.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CaptureModal } from './CaptureModal'

function galleryInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement
}

function cameraInput(): HTMLInputElement {
  return document.querySelector('input[type="file"][capture]') as HTMLInputElement
}

describe('CaptureModal', () => {
  it('renders both capture buttons', () => {
    render(<CaptureModal onCapture={() => {}} onCancel={() => {}} />)

    expect(screen.getByRole('button', { name: /carregar foto/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /tirar foto/i })).toBeTruthy()
  })

  it('mounts a plain file input and a capture="user" file input', () => {
    render(<CaptureModal onCapture={() => {}} onCancel={() => {}} />)

    expect(galleryInput()).toBeTruthy()
    expect(cameraInput().getAttribute('capture')).toBe('user')
  })

  it('calls onCapture with the file chosen via the gallery input', () => {
    const onCapture = vi.fn()
    render(<CaptureModal onCapture={onCapture} onCancel={() => {}} />)

    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(galleryInput(), { target: { files: [file] } })

    expect(onCapture).toHaveBeenCalledWith(file)
  })

  it('calls onCapture with the file chosen via the camera input', () => {
    const onCapture = vi.fn()
    render(<CaptureModal onCapture={onCapture} onCancel={() => {}} />)

    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(cameraInput(), { target: { files: [file] } })

    expect(onCapture).toHaveBeenCalledWith(file)
  })

  it('calls onCancel when "Cancelar" is clicked', () => {
    const onCancel = vi.fn()
    render(<CaptureModal onCapture={() => {}} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/CaptureModal.test.tsx`
Expected: FAIL — `Cannot find module './CaptureModal'`

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client'

import { useRef } from 'react'
import { Button } from './Button'

export function CaptureModal({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void
  onCancel: () => void
}) {
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onCapture(file)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[15px] max-w-md w-full p-6 text-center">
        <h2 className="text-xl font-extrabold text-orca-azul-escuro mb-2">Reconhecimento facial</h2>
        <p className="text-orca-preto-marca mb-6">Tire uma foto ou carregue uma foto do seu rosto.</p>
        <div className="flex gap-3 justify-center mb-4">
          <Button variant="secondary" onClick={() => galleryInputRef.current?.click()}>
            Carregar foto
          </Button>
          <Button onClick={() => cameraInputRef.current?.click()}>Tirar foto</Button>
        </div>
        <button onClick={onCancel} className="text-orca-royal underline text-sm">
          Cancelar
        </button>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/CaptureModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/CaptureModal.tsx web/components/CaptureModal.test.tsx
git commit -m "feat: add CaptureModal component with gallery/camera file inputs"
```

---

### Task 4: PhotoGrid checkbox indicator

**Files:**
- Modify: `web/components/PhotoGrid.tsx`
- Test: `web/components/PhotoGrid.test.tsx`

**Interfaces:**
- No change to `PhotoGrid`'s props or exported signature — purely visual.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhotoGrid } from './PhotoGrid'

describe('PhotoGrid checkbox indicator', () => {
  const photos = [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }]

  it('shows an unchecked indicator when the photo is not selected', () => {
    render(<PhotoGrid photos={photos} selected={new Set()} onToggle={() => {}} />)

    const button = screen.getByAltText(/foto 1/i).closest('button')!
    const indicator = button.querySelector('[data-testid="photo-checkbox"]')!

    expect(indicator.className).not.toContain('bg-orca-verde-agua')
  })

  it('shows a checked indicator when the photo is selected', () => {
    render(<PhotoGrid photos={photos} selected={new Set(['photo-1'])} onToggle={() => {}} />)

    const button = screen.getByAltText(/foto 1 \(selecionada\)/i).closest('button')!
    const indicator = button.querySelector('[data-testid="photo-checkbox"]')!

    expect(indicator.className).toContain('bg-orca-verde-agua')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/PhotoGrid.test.tsx`
Expected: FAIL — indicator not found (`querySelector` returns `null`, `.className` throws)

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client'

import { useBlurOnFocusLoss } from './useBlurOnFocusLoss'

type PhotoResult = { photoId: string; previewUrl: string }

export function PhotoGrid({
  photos,
  selected,
  onToggle,
}: {
  photos: PhotoResult[]
  selected: Set<string>
  onToggle: (photoId: string) => void
}) {
  const isBlurred = useBlurOnFocusLoss()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {photos.map((photo, index) => {
        const isSelected = selected.has(photo.photoId)
        return (
          <button
            key={photo.photoId}
            onClick={() => onToggle(photo.photoId)}
            aria-pressed={isSelected}
            className={`relative border-2 rounded ${isSelected ? 'border-orca-dourado' : 'border-transparent'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.previewUrl}
              alt={`Foto ${index + 1}${isSelected ? ' (selecionada)' : ''}`}
              className={`w-full h-full object-cover rounded transition-all ${isBlurred ? 'blur-lg' : ''}`}
            />
            {/* Decorative only -- aria-pressed on the button above already
                communicates selection state to assistive tech. */}
            <span
              aria-hidden="true"
              data-testid="photo-checkbox"
              className={`absolute top-2 right-2 w-5 h-5 rounded border-2 ${
                isSelected ? 'bg-orca-verde-agua border-orca-verde-agua' : 'bg-white/80 border-white'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/PhotoGrid.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/PhotoGrid.tsx web/components/PhotoGrid.test.tsx
git commit -m "feat: add a visible checkbox indicator to each photo in the grid"
```

---

### Task 5: Rewire SelfieUploader through the new modals + "Selecionar todas"

**Files:**
- Modify: `web/components/SelfieUploader.tsx`
- Modify (full rewrite): `web/components/SelfieUploader.test.tsx`

**Interfaces:**
- Consumes: `ConsentModal({ onAgree, onCancel })` from Task 2, `CaptureModal({ onCapture, onCancel })` from Task 3, `PhotoGrid` (unchanged props) from Task 4, `Button` (unchanged).
- Produces: `SelfieUploader({ slug: string, eventId: string })` — same public signature as before. `handleFile`, `handleCheckout`, `toggle` keep identical bodies to the current file; only the JSX and the new `modalOpen` state change.

This task **replaces** the consent-gate early return and the raw `<input type="file">` with the search-card + modal flow. `consented` keeps its exact current meaning (once `true`, stays `true` for the component's lifetime — consent is asked once, not on every search). A new `modalOpen: 'none' | 'consent' | 'capture'` state controls which modal (if any) is shown. Clicking "Encontrar" (first search) or "Buscar novamente" (any search after the first) opens `'consent'` if `!consented`, otherwise jumps straight to `'capture'`.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `web/components/SelfieUploader.test.tsx` with:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SelfieUploader } from './SelfieUploader'

const EVENT_ID = '11111111-1111-1111-1111-111111111111'

function galleryInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]:not([capture])')
}

function anyFileInput(): HTMLInputElement | null {
  return document.querySelector('input[type="file"]')
}

// Drives the UI from the initial search card through the consent modal
// (only asked once per component lifetime) into the capture modal, leaving
// it open so the caller can fire a change event on the input it needs.
function openCaptureModal() {
  const encontrarButton = screen.queryByRole('button', { name: /^encontrar$/i })
  if (encontrarButton) {
    fireEvent.click(encontrarButton)
  } else {
    // A search already happened; "Buscar novamente" reopens the capture
    // modal directly since consent was already granted.
    fireEvent.click(screen.getByRole('button', { name: /buscar novamente/i }))
  }

  const agreeButton = screen.queryByRole('button', { name: /estou de acordo/i })
  if (agreeButton) {
    fireEvent.click(agreeButton)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS
})

describe('SelfieUploader search flow', () => {
  it('shows the search card and no file input before searching', () => {
    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)

    expect(anyFileInput()).toBeNull()
    expect(screen.getByRole('button', { name: /^encontrar$/i })).toBeTruthy()
  })

  it('asks for consent before opening the capture modal', () => {
    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))

    expect(anyFileInput()).toBeNull()
    expect(screen.getByRole('button', { name: /estou de acordo/i })).toBeTruthy()
  })

  it('explains what happens to the selfie in the consent modal', () => {
    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)

    fireEvent.click(screen.getByRole('button', { name: /^encontrar$/i }))

    expect(screen.getByText(/comparação facial/i)).toBeTruthy()
  })

  it('opens the capture modal with a file input after agreeing to consent', () => {
    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)

    openCaptureModal()

    expect(galleryInput()).not.toBeNull()
  })

  it('sends consent=true alongside the selfie so the server can record it', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
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

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
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

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()

    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não achamos um rosto/i))
    // The search card is still reachable to retry -- consent isn't asked again.
    expect(screen.getByRole('button', { name: /^encontrar$/i })).toBeTruthy()
  })
})

describe('SelfieUploader checkout bar', () => {
  async function selectOnePhoto() {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }] }),
        { status: 200 }
      )
    )

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()

    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(galleryInput()!, { target: { files: [file] } })

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

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })
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
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://checkout.stripe.com/session-123' }), { status: 200 })
      )

    delete (window as unknown as { location: unknown }).location
    ;(window as unknown as { location: Location }).location = { href: '' } as Location

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(checkoutFetch).toHaveBeenCalled())

    const [url, init] = checkoutFetch.mock.calls[checkoutFetch.mock.calls.length - 1]
    expect(url).toBe('/api/checkout')
    const body = JSON.parse(init!.body as string)
    expect(body).toEqual({ eventId: EVENT_ID, photoIds: ['photo-1'], buyerEmail: 'comprador@example.com' })

    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/session-123'))
  })

  it('shows a specific message when a photo is no longer available, next to the checkout bar', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'unknown_photo_ids' }), { status: 400 })
    )

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não estão mais disponíveis/i))

    const alert = screen.getByRole('alert')
    const buyButton = screen.getByRole('button', { name: /comprar/i })
    expect(alert.parentElement).toBe(buyButton.parentElement)
  })

  it('shows a generic message on a network failure, next to the checkout bar', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))

    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/erro ao iniciar pagamento/i))

    const alert = screen.getByRole('alert')
    const buyButton = screen.getByRole('button', { name: /comprar/i })
    expect(alert.parentElement).toBe(buyButton.parentElement)
  })

  it('does not carry a checkout error into a fresh search', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'comprador@example.com' } })

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))
    fireEvent.click(screen.getByRole('button', { name: /comprar/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/erro ao iniciar pagamento/i))

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' }] }),
        { status: 200 }
      )
    )

    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['bytes'], 'selfie2.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() =>
      expect(screen.getByAltText(/foto 1/i).getAttribute('src')).toBe('https://example.com/p2.jpg')
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears a stale selection when a new search is performed', async () => {
    process.env.NEXT_PUBLIC_PHOTO_PRICE_CENTS = '1500'
    await selectOnePhoto()
    expect(screen.getByRole('button', { name: /comprar/i })).toBeTruthy()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ photoId: 'photo-2', previewUrl: 'https://example.com/p2.jpg' }] }),
        { status: 200 }
      )
    )

    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['bytes'], 'selfie2.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() =>
      expect(screen.getByAltText(/foto 1/i).getAttribute('src')).toBe('https://example.com/p2.jpg')
    )

    expect(screen.queryByRole('button', { name: /comprar/i })).toBeNull()
  })

  it('shows the photo count without a total when the price env var is unset', async () => {
    await selectOnePhoto()

    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('selects all results when "Selecionar todas" is clicked', async () => {
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

    render(<SelfieUploader slug="festa-junina" eventId={EVENT_ID} />)
    openCaptureModal()
    fireEvent.change(galleryInput()!, {
      target: { files: [new File(['b'], 's.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => expect(screen.getByAltText(/foto 1/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /selecionar todas/i }))

    expect(screen.getByText(/2 fotos selecionadas/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/SelfieUploader.test.tsx`
Expected: FAIL — the current component still shows the old consent block/raw input, so `getByRole('button', { name: /^encontrar$/i })` etc. don't match.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `web/components/SelfieUploader.tsx` with:

```tsx
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
        return
      }

      // A new search replaces the visible grid entirely. Any photo ids selected
      // from a previous grid would otherwise survive with no visible tile, but
      // still ride along into the checkout total and the /api/checkout request
      // (they're still valid photos of this event, so the server can't catch it) --
      // the buyer would be billed for photos they can no longer see or deselect.
      setSelected(new Set())
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
          <Button onClick={openSearchFlow}>Encontrar</Button>
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/SelfieUploader.test.tsx`
Expected: PASS (all cases, including the pre-existing checkout-bar cases carried over)

- [ ] **Step 5: Commit**

```bash
git add web/components/SelfieUploader.tsx web/components/SelfieUploader.test.tsx
git commit -m "feat: orchestrate the selfie search through consent/capture modals"
```

---

### Task 6: Wire EventBanner into the event page + final verification

**Files:**
- Modify: `web/app/e/[slug]/page.tsx`

**Interfaces:**
- Consumes: `EventBanner({ eventName: string })` from Task 1.

- [ ] **Step 1: Write the failing check**

There's no existing automated test file for `page.tsx` (it's a server component reading `params`/DB directly, consistent with the rest of the codebase's pattern of not unit-testing App Router page components). Verification for this task is the type check + build in Step 4. Skip straight to the implementation.

- [ ] **Step 2: (n/a — no separate failing-test step for this task, see Step 1)**

- [ ] **Step 3: Write the implementation**

Replace the full contents of `web/app/e/[slug]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation'
import { SelfieUploader } from '@/components/SelfieUploader'
import { BrandHeader } from '@/components/BrandHeader'
import { EventBanner } from '@/components/EventBanner'
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
        <SelfieUploader slug={params.slug} eventId={event.id} />
      </main>
    </>
  )
}
```

- [ ] **Step 4: Run the full suite, type check, lint, and build**

Run: `cd web && npx vitest run && npx tsc --noEmit && npx eslint . && npx next build`
Expected: all four pass with no errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/e/[slug]/page.tsx
git commit -m "feat: render EventBanner with the event name on the event page"
```

---

## Self-Review Notes

- **Spec coverage:** §2 banner (Task 1, 6), cartão de busca (Task 5), modal de consentimento (Task 2), modal de captura (Task 3), checkbox visível + "Selecionar todas" (Task 4, 5), `page.tsx` selecionando `name` (Task 6) — all covered. §2 "fora do escopo" (contas de comprador, carrinho, navbar nova) — no task introduces any of these. §3 architecture table — every listed component has its own task. §4 fluxo — steps 1-6 map directly onto the `openSearchFlow`/`modalOpen`/`onCapture`/`onAgree` wiring in Task 5. §5 error handling — preserved verbatim in Task 5 (same `handleFile`/`handleCheckout` bodies), covered by the "no face detected" and checkout-error tests. §6 testing — every listed test file has a task. §7 open item (real cover photo) — explicitly out of scope, not touched.
- **Placeholder scan:** no TBD/TODO; every step has real code.
- **Type consistency:** `PhotoResult` type kept identical (`{ photoId: string; previewUrl: string }`) across `SelfieUploader.tsx` and `PhotoGrid.tsx`. `ConsentModal`/`CaptureModal` prop names (`onAgree`/`onCancel`, `onCapture`/`onCancel`) match between their own definitions (Tasks 2-3) and their call sites in `SelfieUploader.tsx` (Task 5). `ModalState` values (`'none' | 'consent' | 'capture'`) used consistently in Task 5's state and JSX conditionals.
