# Layout Profissional da Plataforma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar às páginas públicas (`/`, `/e/[slug]`, `/e/obrigado`) e ao painel admin a estrutura de um site profissional de venda de fotos — rodapé institucional, "como funciona" na home, resumo no admin — sem virar marketplace.

**Architecture:** Um componente novo (`SiteFooter`) reutilizado em três páginas públicas; a home ganha uma seção "como funciona"; o admin ganha uma linha de resumo calculada a partir dos dados já carregados. Nenhuma lógica de negócio muda.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Vitest + Testing Library (mesmo stack do resto do projeto).

## Global Constraints

- Não é pivô de marketplace: sem conta de comprador, sem carrinho entre eventos, sem "Vender fotos"/"Criar conta"/"Entrar" em nenhuma página (spec §1, §2 — confirmado duas vezes pelo usuário).
- `BrandHeader` não muda — continua só a logo, sem links de navbar novos (spec §3).
- Dados reais do rodapé, usar literalmente: Orca Mídias · CNPJ 53.731.640/0001-38 · Mairiporã - SP · contato@orcamidias.com · @orcamidias (`https://instagram.com/orcamidias`) (spec §3).
- Sem rodapé no painel admin — ferramenta interna, não página de marketing (spec §2).
- Sem busca global de eventos na home — não existe diretório público de eventos nesse modelo (spec §2, §3).
- Zero mudança de lógica de negócio em qualquer página tocada (spec §4, §5).
- Usar tokens de marca já existentes (`orca-azul-escuro`, `orca-royal`, `orca-verde-agua`, `orca-dourado`, `orca-preto-marca`) e o componente `Button` já existente — não criar cores novas.

---

## File Structure

- `web/components/SiteFooter.tsx` (novo) — rodapé institucional reutilizável.
- `web/components/SiteFooter.test.tsx` (novo).
- `web/app/page.tsx` (modificado) — home ganha seção "Como funciona" + `SiteFooter`; hero existente preservado.
- `web/app/page.test.tsx` (modificado) — mantém os 3 testes existentes, ganha 2 novos.
- `web/app/e/[slug]/page.tsx` (modificado) — adiciona `<SiteFooter />`.
- `web/app/e/obrigado/page.tsx` (modificado) — adiciona `<SiteFooter />` nas três variações de retorno.
- `web/app/admin/events/page.tsx` (modificado) — adiciona resumo de contagem acima da tabela.
- `web/app/admin/events/page.test.tsx` (modificado) — ganha 1 teste novo.

---

### Task 1: SiteFooter

**Files:**
- Create: `web/components/SiteFooter.tsx`
- Test: `web/components/SiteFooter.test.tsx`

**Interfaces:**
- Produces: `SiteFooter(): JSX.Element` — sem props.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SiteFooter } from './SiteFooter'

describe('SiteFooter', () => {
  it('renders the brand name, CNPJ, and city', () => {
    render(<SiteFooter />)

    expect(screen.getByText('Orca Mídias')).toBeTruthy()
    expect(screen.getByText(/53\.731\.640\/0001-38/)).toBeTruthy()
    expect(screen.getByText(/Mairiporã - SP/)).toBeTruthy()
  })

  it('links to the contact email', () => {
    render(<SiteFooter />)

    const link = screen.getByRole('link', { name: /contato@orcamidias\.com/i })
    expect(link.getAttribute('href')).toBe('mailto:contato@orcamidias.com')
  })

  it('links to the Instagram profile', () => {
    render(<SiteFooter />)

    const link = screen.getByRole('link', { name: /@orcamidias/i })
    expect(link.getAttribute('href')).toBe('https://instagram.com/orcamidias')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/SiteFooter.test.tsx`
Expected: FAIL — `Cannot find module './SiteFooter'`

- [ ] **Step 3: Write minimal implementation**

```tsx
export function SiteFooter() {
  return (
    <footer className="bg-orca-azul-escuro text-white mt-12 py-8">
      <div className="max-w-4xl mx-auto px-4 text-center space-y-2">
        <p className="font-extrabold">Orca Mídias</p>
        <p className="text-sm text-white/80">CNPJ 53.731.640/0001-38 · Mairiporã - SP</p>
        <p className="text-sm">
          <a href="mailto:contato@orcamidias.com" className="underline hover:text-orca-verde-agua">
            contato@orcamidias.com
          </a>
          {' · '}
          <a
            href="https://instagram.com/orcamidias"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-orca-verde-agua"
          >
            @orcamidias
          </a>
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/SiteFooter.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/SiteFooter.tsx web/components/SiteFooter.test.tsx
git commit -m "feat: add SiteFooter component with Orca Mídias contact info"
```

---

### Task 2: Home page — "Como funciona" + rodapé

**Files:**
- Modify: `web/app/page.tsx`
- Modify: `web/app/page.test.tsx`

**Interfaces:**
- Consumes: `SiteFooter()` from Task 1, `BrandHeader` (unchanged, already imported).

The existing hero (título, dois parágrafos, link do Instagram) fica exatamente como está — só ganha uma seção nova "Como funciona" logo abaixo e o rodapé no final. Os 3 testes já existentes (`page.test.tsx`) não podem quebrar.

- [ ] **Step 1: Write the failing test**

Adicione ao final do `describe('HomePage', ...)` em `web/app/page.test.tsx` (sem tocar nos 3 testes já existentes):

```tsx
  it('explains how the platform works in three steps', () => {
    render(<HomePage />)

    expect(screen.getByText(/como funciona/i)).toBeTruthy()
    expect(screen.getByText(/envie uma selfie e encontre suas fotos/i)).toBeTruthy()
  })

  it('renders the site footer with the company CNPJ', () => {
    render(<HomePage />)

    expect(screen.getByText(/53\.731\.640\/0001-38/)).toBeTruthy()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run app/page.test.tsx`
Expected: FAIL — "como funciona" text and CNPJ not found

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `web/app/page.tsx` with:

```tsx
import { BrandHeader } from '@/components/BrandHeader'
import { SiteFooter } from '@/components/SiteFooter'

const STEPS = [
  {
    title: '1. O fotógrafo sobe as fotos',
    text: 'A Orca Mídias fotografa o evento e organiza tudo na plataforma.',
  },
  {
    title: '2. Você recebe o link do seu evento',
    text: 'O organizador ou fotógrafo compartilha o link exclusivo do evento com você.',
  },
  {
    title: '3. Envie uma selfie e encontre suas fotos',
    text: 'Reconhecimento facial localiza automaticamente todas as fotos com você.',
  },
]

export default function HomePage() {
  return (
    <>
      <BrandHeader />
      <main>
        <div className="max-w-2xl mx-auto p-4 text-center py-16">
          <h1 className="text-3xl font-extrabold text-orca-azul-escuro mb-4">
            Encontre suas fotos de evento
          </h1>
          <p className="text-lg mb-2">
            A Orca Mídias fotografa seu evento e usa reconhecimento facial para
            você achar suas fotos em segundos — sem precisar procurar.
          </p>
          <p className="font-caveat text-2xl text-orca-preto-marca mb-8">
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
        </div>

        <div className="bg-orca-azul-escuro/5 py-12 px-4">
          <h2 className="text-2xl font-extrabold text-orca-azul-escuro text-center mb-8">
            Como funciona
          </h2>
          <div className="max-w-4xl mx-auto grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="bg-white rounded-[15px] p-6 shadow-[3px_3px_15px_rgba(33,33,33,0.66)]"
              >
                <h3 className="font-extrabold text-orca-azul-escuro mb-2">{step.title}</h3>
                <p className="text-sm">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run app/page.test.tsx`
Expected: PASS (all 5 tests — the 3 pre-existing plus the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add web/app/page.tsx web/app/page.test.tsx
git commit -m "feat: add a 'Como funciona' section and the site footer to the home page"
```

---

### Task 3: Rodapé em `/e/[slug]`

**Files:**
- Modify: `web/app/e/[slug]/page.tsx`

**Interfaces:**
- Consumes: `SiteFooter()` from Task 1.

Não existe arquivo de teste para esta página (server component com acesso a banco, sem teste unitário — mesmo padrão já usado no resto do projeto). Verificação é rodar a suíte completa + build no Task 5 final.

- [ ] **Step 1: Write the implementation**

Replace the full contents of `web/app/e/[slug]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation'
import { SelfieUploader } from '@/components/SelfieUploader'
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
        <SelfieUploader slug={params.slug} eventId={event.id} />
      </main>
      <SiteFooter />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/e/\[slug\]/page.tsx
git commit -m "feat: add the site footer to the event page"
```

---

### Task 4: Rodapé em `/e/obrigado`

**Files:**
- Modify: `web/app/e/obrigado/page.tsx`

**Interfaces:**
- Consumes: `SiteFooter()` from Task 1.

Mesma situação do Task 3: sem arquivo de teste próprio, verificação no Task 5. A página tem três `return` (sessão inválida, pagamento pendente, sucesso) — o rodapé entra nos três, pra manter a mesma estrutura em todos os estados (mesmo padrão já usado no sub-projeto de identidade visual).

- [ ] **Step 1: Write the implementation**

Replace the full contents of `web/app/e/obrigado/page.tsx` with:

```tsx
import { BrandHeader } from '@/components/BrandHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getSignedDownloadUrl } from '@/lib/storage'

export default async function ObrigadoPage({ searchParams }: { searchParams: { session_id?: string } }) {
  const sessionId = searchParams.session_id
  if (!sessionId) {
    return (
      <>
        <BrandHeader />
        <main className="max-w-2xl mx-auto p-4">
          <h1 className="text-2xl font-extrabold text-orca-azul-escuro mb-4">Sessão inválida</h1>
          <p>Sessão inválida.</p>
        </main>
        <SiteFooter />
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
        <main className="max-w-2xl mx-auto p-4">
          <h1 className="text-2xl font-extrabold text-orca-azul-escuro mb-4">Aguardando confirmação</h1>
          <p>Pagamento ainda não confirmado. Atualize a página em instantes.</p>
        </main>
        <SiteFooter />
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
              <a href={url} className="text-orca-royal underline font-semibold">
                Baixar foto {i + 1}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-orca-preto-marca/70 mt-4">Os links expiram em algumas horas.</p>
      </main>
      <SiteFooter />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/e/obrigado/page.tsx
git commit -m "feat: add the site footer to the obrigado page"
```

---

### Task 5: Resumo no painel admin + verificação final

**Files:**
- Modify: `web/app/admin/events/page.tsx`
- Modify: `web/app/admin/events/page.test.tsx`

**Interfaces:**
- Consumes: `events` state already loaded by the page (`EventRow[]`, each with `photoCount: number`) — no new API call.

- [ ] **Step 1: Write the failing test**

Adicione ao final do `describe('AdminEventsPage', ...)` em `web/app/admin/events/page.test.tsx`:

```tsx
  it('shows a summary of total events and photos above the table', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))

    render(<AdminEventsPage />)

    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())
    expect(screen.getByText(/1 evento · 42 fotos/i)).toBeTruthy()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run app/admin/events/page.test.tsx`
Expected: FAIL — summary text not found

- [ ] **Step 3: Write minimal implementation**

In `web/app/admin/events/page.tsx`, replace:

```tsx
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <table className="w-full text-left border-collapse">
```

with:

```tsx
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <>
            <p className="text-sm text-orca-preto-marca/70 mb-3">
              {events.length} {events.length === 1 ? 'evento' : 'eventos'} ·{' '}
              {events.reduce((sum, event) => sum + event.photoCount, 0)} fotos
            </p>
            <table className="w-full text-left border-collapse">
```

And close the added fragment right after the existing `</table>` closing tag (which currently sits directly inside the ternary's else branch):

```tsx
            </table>
          </>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run app/admin/events/page.test.tsx`
Expected: PASS (all pre-existing tests plus the new one)

- [ ] **Step 5: Run the full suite, type check, lint, and build**

Run: `cd web && npx vitest run && npx tsc --noEmit && npx eslint . && npx next build`
Expected: all four pass with no errors.

- [ ] **Step 6: Commit**

```bash
git add web/app/admin/events/page.tsx web/app/admin/events/page.test.tsx
git commit -m "feat: show an event/photo count summary above the admin events table"
```

---

## Self-Review Notes

- **Spec coverage:** §3 `SiteFooter` with the real company data (Task 1). §3 home rewrite with hero preserved + "Como funciona" + footer (Task 2). §3 `/e/[slug]` and `/e/obrigado` gaining the footer (Tasks 3-4). §3 admin summary computed from already-loaded data (Task 5). §2 "fora do escopo" — no task adds buyer accounts, cart, fake nav links, a home search field, or an admin footer. §5 error handling — no new error paths in any task. §6 testing — every testable file has a task; `/e/[slug]` and `/e/obrigado` correctly have no test step since neither has an existing test file, consistent with the rest of the codebase's pattern for server components with DB access.
- **Placeholder scan:** no TBD/TODO; every step has real code.
- **Type consistency:** `SiteFooter` has no props anywhere it's used (Tasks 2-4). `EventRow`'s `photoCount: number` field (already defined in `web/app/admin/events/page.tsx`) is the only field Task 5's summary reads — no new type introduced.
