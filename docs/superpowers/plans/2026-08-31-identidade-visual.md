# Identidade Visual Orca Mídias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Orca Mídias brand (colors, Montserrat typography, logo, button style) across every page of the already-shipped platform — public and admin — replacing the remaining `create-next-app` boilerplate.

**Architecture:** Pure presentation change. Two new shared components (`Button`, `BrandHeader`) built on Tailwind tokens defined once in `tailwind.config.ts`; every existing page swaps its raw `<button>`/ad-hoc classes for the tokens and the two new components. No route, API, or data-flow logic changes anywhere in this plan.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Tailwind CSS, `next/font/google`, `next/image`, Vitest + Testing Library (already set up).

## Global Constraints

- No behavior/logic changes in any file this plan touches — only className/JSX presentation. Every existing test's `getByRole`/`getByLabelText`/`getByText` query must still find the same element; only replace a test's assertion if it specifically checked a CSS class or tag that intentionally changes (e.g. `<button>` → `Button` component still renders `role="button"`, no test should break from that alone).
- Color tokens (exact hex, from the design spec): `orca-azul-escuro` `#181E27`, `orca-royal` `#18456B`, `orca-verde-agua` `#44B494`, `orca-dourado` `#DAA034`, `orca-preto-marca` `#2B2522`.
- Button style: border radius `15px`, box shadow `3px 3px 15px rgba(33,33,33,.66)`.
- Font: Montserrat (400/600/800) via `next/font/google`, replacing the current Geist fonts. Caveat is used in at most one place (the home page), not on buttons or page titles.
- `web/public/logo-orca-preto-horizontal.png` already exists (742×292px) — use it via `next/image`, don't re-fetch or duplicate it.
- Remove the OS-driven light/dark auto-switch currently in `web/app/globals.css` — the brand has one fixed light theme.

---

## File Structure

```
web/
  tailwind.config.ts          # modified: orca-* color tokens, Montserrat font family
  app/
    globals.css                # modified: brand CSS vars, remove dark-mode media query
    layout.tsx                 # modified: Montserrat/Caveat fonts, lang="pt-BR", real metadata
    page.tsx                   # modified: real institutional home page (was create-next-app boilerplate)
    e/
      [slug]/page.tsx           # modified: wrap in BrandHeader (no logic change)
      obrigado/page.tsx         # modified: BrandHeader + token classes
    admin/
      login/page.tsx            # modified: BrandHeader + Button
      events/page.tsx           # modified: BrandHeader + Button
      events/[id]/upload/page.tsx  # modified: BrandHeader + Button + token classes on drop zone
  components/
    Button.tsx                 # new
    Button.test.tsx             # new
    BrandHeader.tsx             # new
    BrandHeader.test.tsx         # new
    SelfieUploader.tsx          # modified: BrandHeader + Button + token classes
    PhotoGrid.tsx                # modified: selection border color token
```

---

### Task 1: Design tokens + `Button` component

**Files:**
- Modify: `web/tailwind.config.ts`
- Modify: `web/app/globals.css`
- Create: `web/components/Button.tsx`
- Test: `web/components/Button.test.tsx`

**Interfaces:**
- Produces: Tailwind color utilities `bg-orca-verde-agua`, `text-orca-verde-agua`, `border-orca-verde-agua`, `bg-orca-azul-escuro`, `text-orca-azul-escuro`, `text-orca-preto-marca`, `bg-orca-dourado`, `border-orca-dourado`, `text-orca-royal` (and their `/opacity` variants, e.g. `border-orca-dourado/30`), and the `font-montserrat`/`font-caveat` utilities (from Task 3's font setup — this task only adds the color tokens; font family tokens are wired in Task 3, but declare the Tailwind `fontFamily` keys now so Task 3 doesn't need to touch this file again).
- Produces: `Button` component — `<Button variant="primary" | "secondary">`, accepts every standard `<button>` prop via `ButtonHTMLAttributes<HTMLButtonElement>` (so `type="submit"`, `disabled`, `onClick` all keep working exactly as they do today on raw `<button>` elements). Every later task that swaps a `<button>` for `<Button>` relies on this passthrough.

- [ ] **Step 1: Write the failing test**

Create `web/components/Button.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders the primary variant with the brand background by default', () => {
    render(<Button>Entrar</Button>)
    const button = screen.getByRole('button', { name: 'Entrar' })
    expect(button.className).toContain('bg-orca-verde-agua')
  })

  it('renders the secondary variant with an outline style', () => {
    render(<Button variant="secondary">Cancelar</Button>)
    const button = screen.getByRole('button', { name: 'Cancelar' })
    expect(button.className).toContain('border-orca-verde-agua')
    expect(button.className).not.toContain('bg-orca-verde-agua')
  })

  it('forwards standard button props (type, disabled)', () => {
    render(
      <Button type="submit" disabled>
        Enviar
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement
    expect(button.type).toBe('submit')
    expect(button.disabled).toBe(true)
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Clique</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Clique' }))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('merges a caller-provided className instead of overwriting the base styles', () => {
    render(<Button className="w-full">Largo</Button>)
    const button = screen.getByRole('button', { name: 'Largo' })
    expect(button.className).toContain('w-full')
    expect(button.className).toContain('bg-orca-verde-agua')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- Button`
Expected: FAIL (`Button.tsx` doesn't exist)

- [ ] **Step 3: Add the color tokens to Tailwind**

Read the current `web/tailwind.config.ts` first (it's small — you're adding to the `theme.extend` block, not replacing the file). Replace its contents in full:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        orca: {
          "azul-escuro": "#181E27",
          royal: "#18456B",
          "verde-agua": "#44B494",
          dourado: "#DAA034",
          "preto-marca": "#2B2522",
        },
      },
      fontFamily: {
        montserrat: ["var(--font-montserrat)", "sans-serif"],
        caveat: ["var(--font-caveat)", "cursive"],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 4: Update global CSS — fixed light brand theme, no OS dark-mode switch**

Replace `web/app/globals.css` in full:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #2b2522;
}

body {
  color: var(--foreground);
  background: var(--background);
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

(The `@media (prefers-color-scheme: dark)` block and the `font-family: Arial...` line are both removed — Montserrat is applied via `next/font` on `<body>` in Task 3, and the brand has no dark theme.)

- [ ] **Step 5: Implement `Button`**

Create `web/components/Button.tsx`:

```typescript
import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

const BASE_CLASSES =
  'rounded-[15px] px-5 py-2.5 font-semibold shadow-[3px_3px_15px_rgba(33,33,33,0.66)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-orca-verde-agua text-white hover:brightness-95',
  secondary: 'bg-white text-orca-verde-agua border-2 border-orca-verde-agua hover:bg-orca-verde-agua/10',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`.trim()} {...props} />
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && npm run test -- Button`
Expected: PASS (5 tests)

- [ ] **Step 7: Run the full suite and build to confirm the CSS/config change didn't break anything**

Run: `cd web && npm run test && npx tsc --noEmit && npm run build`
Expected: all succeed.

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/tailwind.config.ts web/app/globals.css web/components/Button.tsx web/components/Button.test.tsx
git commit -m "feat: add Orca Mídias color tokens and the Button component"
```

---

### Task 2: `BrandHeader` component

**Files:**
- Create: `web/components/BrandHeader.tsx`
- Test: `web/components/BrandHeader.test.tsx`

**Interfaces:**
- Consumes: `web/public/logo-orca-preto-horizontal.png` (already in the repo, 742×292px).
- Produces: `BrandHeader` — no props, no state. Every page task from Task 3 onward renders `<BrandHeader />` at the top of its `<main>`/root element.

- [ ] **Step 1: Write the failing test**

Create `web/components/BrandHeader.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrandHeader } from './BrandHeader'

describe('BrandHeader', () => {
  it('renders the Orca Mídias logo', () => {
    render(<BrandHeader />)
    const logo = screen.getByAltText('Orca Mídias')
    expect(logo).toBeTruthy()
    expect(logo.tagName).toBe('IMG')
  })

  it('links the logo back to the home page', () => {
    render(<BrandHeader />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- BrandHeader`
Expected: FAIL (`BrandHeader.tsx` doesn't exist)

- [ ] **Step 3: Implement `BrandHeader`**

Create `web/components/BrandHeader.tsx`:

```typescript
import Image from 'next/image'
import Link from 'next/link'

export function BrandHeader() {
  return (
    <header className="border-b border-orca-dourado/30 bg-white">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <Link href="/">
          <Image
            src="/logo-orca-preto-horizontal.png"
            alt="Orca Mídias"
            width={180}
            height={71}
            priority
          />
        </Link>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- BrandHeader`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/components/BrandHeader.tsx web/components/BrandHeader.test.tsx
git commit -m "feat: add BrandHeader component with the Orca Mídias logo"
```

---

### Task 3: Root layout, fonts, and a real home page

**Files:**
- Modify: `web/app/layout.tsx`
- Modify: `web/app/page.tsx`
- Test: `web/app/page.test.tsx`

**Interfaces:**
- Consumes: `BrandHeader` (Task 2).
- Produces: `--font-montserrat` and `--font-caveat` CSS variables (via `next/font/google`), consumed by the `fontFamily.montserrat`/`fontFamily.caveat` Tailwind keys already declared in Task 1.

- [ ] **Step 1: Write the failing test for the home page**

Create `web/app/page.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'

describe('HomePage', () => {
  it('renders the brand header', () => {
    render(<HomePage />)
    expect(screen.getByAltText('Orca Mídias')).toBeTruthy()
  })

  it('explains what the product does', () => {
    render(<HomePage />)
    expect(screen.getByText(/encontre suas fotos/i)).toBeTruthy()
  })

  it('links to the Orca Mídias Instagram', () => {
    render(<HomePage />)
    const instagramLink = screen.getByRole('link', { name: /instagram/i })
    expect(instagramLink.getAttribute('href')).toContain('instagram.com')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- app/page.test`
Expected: FAIL (current `page.tsx` is the create-next-app template — no `alt="Orca Mídias"`, no matching text)

- [ ] **Step 3: Update the root layout — Montserrat/Caveat fonts, `pt-BR`, real metadata**

Read the current `web/app/layout.tsx` first. Replace it in full:

```typescript
import type { Metadata } from "next";
import { Montserrat, Caveat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-montserrat",
});
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Orca Mídias — Fotos de Eventos",
  description: "Encontre e compre suas fotos de eventos por reconhecimento facial.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${montserrat.variable} ${caveat.variable} font-montserrat antialiased text-orca-preto-marca`}>
        {children}
      </body>
    </html>
  );
}
```

Delete the two now-unused font files (they were only referenced by the old `localFont` calls this replaces): `web/app/fonts/GeistVF.woff` and `web/app/fonts/GeistMonoVF.woff`, and the now-empty `web/app/fonts/` directory if nothing else is in it.

- [ ] **Step 4: Implement the home page**

Replace `web/app/page.tsx` in full:

```typescript
import { BrandHeader } from '@/components/BrandHeader'

export default function HomePage() {
  return (
    <>
      <BrandHeader />
      <main className="max-w-2xl mx-auto p-4 text-center py-16">
        <h1 className="text-3xl font-extrabold text-orca-azul-escuro mb-4">
          Encontre suas fotos de evento
        </h1>
        <p className="text-lg mb-2">
          A Orca Mídias fotografa seu evento e usa reconhecimento facial para
          você achar suas fotos em segundos — sem precisar procurar.
        </p>
        <p className="font-caveat text-2xl text-orca-dourado mb-8">
          Você recebeu o link do seu evento? É só abrir e tirar uma selfie.
        </p>
        <p>
          <a
            href="https://instagram.com/orcamidias"
            className="text-orca-royal underline"
            target="_blank"
            rel="noreferrer"
          >
            Siga a Orca Mídias no Instagram
          </a>
        </p>
      </main>
    </>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npm run test -- app/page.test`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full suite, tsc, lint, and build**

Run: `cd web && npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all succeed. `/` should still appear as a static route in the build output — a plain content page with no dynamic data.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/app/layout.tsx web/app/page.tsx web/app/page.test.tsx
git rm -r web/app/fonts 2>/dev/null || true
git commit -m "feat: Montserrat/Caveat fonts, pt-BR metadata, real home page"
```

---

### Task 4: Public event page (`SelfieUploader`, `PhotoGrid`)

**Files:**
- Modify: `web/components/SelfieUploader.tsx`
- Modify: `web/components/PhotoGrid.tsx`
- Modify: `web/components/SelfieUploader.test.tsx` (only if a query breaks — see Step 4)

**Interfaces:**
- Consumes: `BrandHeader` (Task 2), `Button` (Task 1). No change to `SelfieUploader`'s or `PhotoGrid`'s props/exports — both keep their exact current signatures (`SelfieUploader({slug, eventId})`, `PhotoGrid({photos, selected, onToggle})`).

This task is a pure presentation edit — every `handleFile`/`handleCheckout`/state-management line stays byte-identical. Only JSX markup and class names change.

- [ ] **Step 1: Update `PhotoGrid`'s selection color**

Read the current `web/components/PhotoGrid.tsx` first. Change only the selection border class — replace:

```typescript
            className={`relative border-2 rounded ${isSelected ? 'border-blue-500' : 'border-transparent'}`}
```

with:

```typescript
            className={`relative border-2 rounded ${isSelected ? 'border-orca-dourado' : 'border-transparent'}`}
```

Nothing else in this file changes.

- [ ] **Step 2: Run the existing PhotoGrid/SelfieUploader tests to confirm nothing broke**

Run: `cd web && npm run test -- PhotoGrid SelfieUploader`
Expected: PASS — the tests select by `alt`/`role`, not by border color, so this one-line change shouldn't break anything. If something does fail, read the failure and fix only what the color change actually affects.

- [ ] **Step 3: Restyle `SelfieUploader`**

Read the current `web/components/SelfieUploader.tsx` first (reproduced in full below reflects its current state — do not lose the `useEffect` pageshow listener, `handleFile`, `toggle`, or `handleCheckout` function bodies, which are unchanged). Replace the file in full:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { PhotoGrid } from './PhotoGrid'
import { Button } from './Button'
import { formatTotalBRL } from '@/lib/pricing'

type PhotoResult = { photoId: string; previewUrl: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function SelfieUploader({ slug, eventId }: { slug: string; eventId: string }) {
  const [consented, setConsented] = useState(false)
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

  if (!consented) {
    return (
      <div className="max-w-md mx-auto p-4 text-center">
        <p className="mb-4">
          Para achar suas fotos, vamos processar uma selfie sua apenas para comparação facial neste evento. Os
          dados são processados em servidor próprio da Orca Mídias e removidos após 120 dias.
        </p>
        <Button onClick={() => setConsented(true)}>Concordo, continuar</Button>
      </div>
    )
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
      <input
        type="file"
        accept="image/*"
        capture="user"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="mb-4"
      />
      {error && (
        <p role="alert" className="text-red-700 mb-4">
          {error}
        </p>
      )}
      {results && <PhotoGrid photos={results} selected={selected} onToggle={toggle} />}
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

- [ ] **Step 4: Run the tests, fixing any query that broke on markup structure alone**

Run: `cd web && npm run test -- SelfieUploader`
Expected: PASS. The consent-gate tests and checkout-flow tests select by `getByRole('button', {name: ...})`, `getByLabelText`, `getByRole('alert')` — none of those depend on the wrapping `<div>`/class changes above, so they should pass unmodified. If any test specifically asserted on a class name or exact DOM structure that this restyle changed, update only that assertion — do not weaken what it verifies, just point it at the new (still-correct) markup.

- [ ] **Step 5: Add `BrandHeader` to the event page**

Read the current `web/app/e/[slug]/page.tsx` first. Add the `BrandHeader` import and render it above `SelfieUploader`, replacing the file in full:

```typescript
import { notFound } from 'next/navigation'
import { SelfieUploader } from '@/components/SelfieUploader'
import { BrandHeader } from '@/components/BrandHeader'
import { supabaseAdmin } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'

export default async function EventPage({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin()
  const { data: event } = await db.from('events').select('id').eq('slug', params.slug).single()

  if (!event) {
    notFound()
  }

  return (
    <>
      <BrandHeader />
      <main>
        <h1 className="text-2xl font-extrabold text-orca-azul-escuro text-center mt-6 mb-2">
          Encontre suas fotos
        </h1>
        <SelfieUploader slug={params.slug} eventId={event.id} />
      </main>
    </>
  )
}
```

- [ ] **Step 6: Run the full suite, tsc, lint, and build**

Run: `cd web && npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all succeed. Confirm `/e/[slug]` still appears dynamic (ƒ) in the build output.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/components/SelfieUploader.tsx web/components/SelfieUploader.test.tsx web/components/PhotoGrid.tsx web/app/e/\[slug\]/page.tsx
git commit -m "feat: brand the public event page (selfie search, gallery, checkout)"
```

---

### Task 5: Obrigado (thank-you) page

**Files:**
- Modify: `web/app/e/obrigado/page.tsx`

**Interfaces:**
- Consumes: `BrandHeader` (Task 2). No change to `getSignedDownloadUrl`/`supabaseAdmin` calls or the page's async data-fetching logic.

- [ ] **Step 1: Restyle the page**

Read the current `web/app/e/obrigado/page.tsx` first (reproduced below reflects its current state — the Supabase queries and `getSignedDownloadUrl('originals', ...)` call are unchanged, only JSX/classes change). Replace the file in full:

```typescript
import { BrandHeader } from '@/components/BrandHeader'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getSignedDownloadUrl } from '@/lib/storage'

export default async function ObrigadoPage({ searchParams }: { searchParams: { session_id?: string } }) {
  const sessionId = searchParams.session_id
  if (!sessionId) {
    return (
      <>
        <BrandHeader />
        <p className="max-w-2xl mx-auto p-4">Sessão inválida.</p>
      </>
    )
  }

  const db = supabaseAdmin()
  const { data: purchase } = await db
    .from('purchases')
    .select('id, status')
    .eq('stripe_session_id', sessionId)
    .single()

  if (!purchase || purchase.status !== 'paid') {
    return (
      <>
        <BrandHeader />
        <p className="max-w-2xl mx-auto p-4">Pagamento ainda não confirmado. Atualize a página em instantes.</p>
      </>
    )
  }

  const { data: purchasedPhotos } = await db
    .from('purchase_photos')
    .select('photos(storage_key_original)')
    .eq('purchase_id', purchase.id)

  const links = await Promise.all(
    (purchasedPhotos ?? []).map(async (row: { photos: { storage_key_original: string } | { storage_key_original: string }[] }) => {
      const photo = Array.isArray(row.photos) ? row.photos[0] : row.photos
      return getSignedDownloadUrl('originals', photo.storage_key_original, 3600 * 6)
    })
  )

  return (
    <>
      <BrandHeader />
      <main className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-extrabold text-orca-azul-escuro mb-4">Pagamento confirmado!</h1>
        <ul className="space-y-2">
          {links.map((url, i) => (
            <li key={i}>
              <a href={url} className="text-orca-verde-agua underline font-semibold">
                Baixar foto {i + 1}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-orca-preto-marca/70 mt-4">Os links expiram em algumas horas.</p>
      </main>
    </>
  )
}
```

- [ ] **Step 2: Run the full suite, tsc, lint, and build**

Run: `cd web && npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/app/e/obrigado/page.tsx
git commit -m "feat: brand the post-payment download page"
```

---

### Task 6: Admin login page

**Files:**
- Modify: `web/app/admin/login/page.tsx`

**Interfaces:**
- Consumes: `BrandHeader` (Task 2), `Button` (Task 1). No change to `handleSubmit`, `submitting` state, or the `POST /api/admin/login` call.

- [ ] **Step 1: Restyle the page**

Read the current `web/app/admin/login/page.tsx` first (reproduced below reflects its current state — `handleSubmit`'s try/catch/finally and the `submitting` guard are unchanged). Replace the file in full:

```typescript
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
```

- [ ] **Step 2: Run the tests**

Run: `cd web && npm run test -- app/admin/login`
Expected: PASS — the existing tests select by `getByLabelText(/senha/i)` and `getByRole('button', {name: /entrar/i})`, unaffected by class/wrapper changes.

- [ ] **Step 3: Run the full suite, tsc, lint, and build**

Run: `cd web && npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/app/admin/login/page.tsx
git commit -m "feat: brand the admin login page"
```

---

### Task 7: Admin event list page

**Files:**
- Modify: `web/app/admin/events/page.tsx`

**Interfaces:**
- Consumes: `BrandHeader` (Task 2), `Button` (Task 1). No change to `loadEvents`, `handleCreate`, `handleUpdate`, `handleDelete`, `handleLogout`, `serverError`, or any state/guard logic — every function body stays byte-identical to the current file.

- [ ] **Step 1: Restyle the page**

Read the current `web/app/admin/events/page.tsx` first (reproduced below reflects its current state in full — every function body below is unchanged from what's already in the file; only the returned JSX and imports change). Replace the file in full:

```typescript
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

        <Button variant="secondary" onClick={toggleCreating} className="mb-4">
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
                      <Link href={`/admin/events/${event.id}/upload`} className="text-orca-verde-agua underline">
                        Subir fotos
                      </Link>
                      <Button variant="secondary" onClick={() => startEdit(event)}>
                        Editar
                      </Button>
                      <Button variant="secondary" onClick={() => handleDelete(event.id)} disabled={deletingId === event.id}>
                        Apagar
                      </Button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </main>
    </>
  )
}
```

- [ ] **Step 2: Run the tests**

Run: `cd web && npm run test -- app/admin/events/page.test`
Expected: PASS — the existing tests select by `getByText`, `getByRole('button', {name: ...})`, `getByLabelText`, all unaffected by class/wrapper changes. `Link` and `Button` both still render as `role="link"`/`role="button"` respectively.

- [ ] **Step 3: Run the full suite, tsc, lint, and build**

Run: `cd web && npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/app/admin/events/page.tsx
git commit -m "feat: brand the admin event list page"
```

---

### Task 8: Admin photo upload page

**Files:**
- Modify: `web/app/admin/events/[id]/upload/page.tsx`

**Interfaces:**
- Consumes: `BrandHeader` (Task 2), `Button` (Task 1). No change to `handleDrop`, `handleUpload`, or any state logic.

This is the final task of the plan.

- [ ] **Step 1: Restyle the page**

Read the current `web/app/admin/events/[id]/upload/page.tsx` first (reproduced below reflects its current state in full — `handleDrop` and `handleUpload` are byte-identical, only JSX/classes change). Replace the file in full:

```typescript
'use client'

import { useRef, useState, type DragEvent } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { BrandHeader } from '@/components/BrandHeader'
import { Button } from '@/components/Button'

type UploadResult = {
  uploaded: { filename: string; id: string; hasFace: boolean }[]
  failed: { filename: string; error: string }[]
}

export default function AdminUploadPage() {
  const params = useParams<{ id: string }>()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setFiles(Array.from(e.dataTransfer.files))
  }

  async function handleUpload() {
    setUploading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    files.forEach((file) => formData.append('photos', file))

    try {
      const response = await fetch(`/api/admin/events/${params.id}/photos`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        setError('Erro ao subir fotos.')
        return
      }

      const data: UploadResult = await response.json()
      setResult(data)
      // Clear the batch: `photos` has no unique constraint on the storage key,
      // so a second click on the same selection would create duplicate photo
      // rows (and duplicate face embeddings) for the same file.
      setFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch {
      setError('Erro ao subir fotos.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <BrandHeader />
      <main className="max-w-3xl mx-auto p-4">
        <Link href="/admin/events" className="text-orca-verde-agua underline">
          ← Eventos
        </Link>
        <h1 className="text-2xl font-extrabold text-orca-azul-escuro mb-4 mt-2">Subir fotos</h1>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-orca-dourado rounded-[15px] p-8 text-center mb-4 text-orca-preto-marca/70"
        >
          {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : 'Arraste as fotos aqui'}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="mb-4 block"
        />
        <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
          {uploading ? 'Enviando...' : `Subir ${files.length} foto(s)`}
        </Button>
        {error && (
          <p role="alert" className="text-red-700 mt-3">
            {error}
          </p>
        )}
        {result && (
          <div className="mt-4">
            <p>
              {result.uploaded.length} enviada(s) com sucesso, {result.failed.length} falharam.
            </p>
            {result.failed.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-red-700">
                {result.failed.map((f) => (
                  <li key={f.filename}>
                    {f.filename}: {f.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </>
  )
}
```

- [ ] **Step 2: Run the tests**

Run: `cd web && npm run test -- app/admin/events/\\\[id\\\]/upload`
Expected: PASS — existing tests select by `getByRole('button', {name: /subir/i})`, the file input query, `getByText`/`getByRole('alert')`, none of which depend on the class/wrapper changes.

- [ ] **Step 3: Run the full suite, tsc, lint, and build — this is the last task, confirm everything end to end**

Run: `cd web && npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all succeed. Spot-check the build output's route table one more time: `/`, `/admin/login`, `/admin/events` should still be present (static or dynamic per their existing classification, unchanged by this plan — this plan doesn't touch data-fetching), `/e/[slug]`, `/e/obrigado`, `/admin/events/[id]/upload` dynamic.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add "web/app/admin/events/[id]/upload/page.tsx"
git commit -m "feat: brand the admin photo upload page"
```

---

## Self-Review Notes

- **Spec coverage:** §3 (tokens) → Task 1. §4 (`BrandHeader`, `Button`) → Tasks 1-2. §5 (every listed page, including layout/metadata/`lang`) → Tasks 3-8, one row of the spec's table per task. §6 (error handling — logo `alt` fallback) → Task 2's `alt="Orca Mídias"`, present from the start. §7 (tests — `Button`, `BrandHeader`, existing pages keep passing) → every task's test steps.
- **Placeholder scan:** none found — every step has complete, runnable code, including full-file replacements for every modified page so there's no ambiguity about what "add BrandHeader" means in context.
- **Type consistency:** `Button`'s `variant` prop (`'primary' | 'secondary'`) is used identically in Tasks 4, 6, 7, 8 — no task invents a third variant or a different prop name. `BrandHeader` takes no props everywhere it's used. Every page that imports `Button`/`BrandHeader` uses the exact `@/components/Button` / `@/components/BrandHeader` import path Tasks 1-2 establish.
