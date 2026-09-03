# Painel Admin Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Orca Mídias staff a browser UI (login, event list, create/edit/delete, photo upload) on top of the existing, already-tested `/api/admin/*` routes — no changes to the public event flow.

**Architecture:** `middleware.ts` gains cookie-based auth (in addition to the existing Bearer-header check) and starts gating `/admin/*` page routes with a redirect instead of a JSON 401. A new login route sets that cookie. Two new API routes (`GET`/`PATCH`/`DELETE` on events) back three new pages that are thin client components calling these routes with `fetch`.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Vitest + Testing Library (already set up).

## Global Constraints

- No changes to `web/app/api/checkout/route.ts`, `web/app/api/webhooks/stripe/route.ts`, `web/app/api/events/[slug]/search/route.ts`, or anything under `web/app/e/` — the public flow is untouched.
- `POST /api/admin/events` and `POST /api/admin/events/[id]/photos` keep their exact current request/response shapes — the new pages call them as-is, nothing about them changes.
- The shared secret model stays: no session table, no per-user accounts. The cookie's value is the `ADMIN_TOKEN` itself.
- `/admin/login` (page) and `/api/admin/login` (route) must be reachable with no valid token, or nobody could ever obtain one — every other `/admin/*` and `/api/admin/*` path stays gated.
- Event deletion only removes the database row (FK cascade already handles `photos`/`faces`/`purchases`); R2 objects are not touched by this plan.

---

## File Structure

```
web/
  middleware.ts                                    # modified: cookie auth + page-route gating
  middleware.test.ts                                # modified: new cases
  app/
    api/
      admin/
        login/
          route.ts                                  # new: POST, sets the cookie
          route.test.ts                              # new
        events/
          route.ts                                  # modified: adds GET (list + photo counts)
          route.test.ts                              # new: covers the new GET
          [id]/
            route.ts                                 # new: PATCH, DELETE
            route.test.ts                             # new
    admin/
      login/
        page.tsx                                     # new
        page.test.tsx                                 # new
      events/
        page.tsx                                     # new: list + create/edit/delete
        page.test.tsx                                  # new
        [id]/
          upload/
            page.tsx                                  # new: drag-and-drop upload
            page.test.tsx                              # new
```

---

### Task 1: Cookie auth + page-route gating in middleware

**Files:**
- Modify: `web/middleware.ts`
- Modify: `web/middleware.test.ts`

**Interfaces:**
- Produces: `ADMIN_COOKIE_NAME` (exported string constant, value `'admin_token'`) — Task 2's login route and every `/admin/*` page's `fetch` calls (which send cookies automatically, same-origin) rely on this exact name. `tokensMatch` and `bearerToken` keep their existing exported signatures — Task 2 imports `tokensMatch` directly.
- `config.matcher` changes from a single string to an array: `['/api/admin/:path*', '/admin/:path*']`.

- [ ] **Step 1: Write the failing tests**

Read the current `web/middleware.test.ts` first — you're adding to it, not replacing the existing cases (they still apply and must keep passing). Add these to the file:

```typescript
function pageRequest(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  })
}

describe('admin middleware — page routes and cookie auth', () => {
  it('matcher covers both /api/admin and /admin page routes', () => {
    expect(config.matcher).toEqual(['/api/admin/:path*', '/admin/:path*'])
  })

  it('allows /admin/login through with no token at all', () => {
    const response = middleware(pageRequest('/admin/login'))
    expect(response.status).toBe(200)
  })

  it('allows /api/admin/login through with no token at all', () => {
    const response = middleware(pageRequest('/api/admin/login'))
    expect(response.status).toBe(200)
  })

  it('redirects an unauthenticated /admin/events request to /admin/login', () => {
    const response = middleware(pageRequest('/admin/events'))
    expect([307, 308]).toContain(response.status)
    expect(response.headers.get('location')).toContain('/admin/login')
  })

  it('allows /admin/events through with a valid cookie', () => {
    const response = middleware(pageRequest('/admin/events', 'admin_token=super-secret-admin-token'))
    expect(response.status).toBe(200)
  })

  it('redirects with an invalid cookie', () => {
    const response = middleware(pageRequest('/admin/events', 'admin_token=wrong'))
    expect([307, 308]).toContain(response.status)
  })

  it('accepts a valid cookie on an /api/admin route (not just Bearer)', () => {
    const response = middleware(pageRequest('/api/admin/events', 'admin_token=super-secret-admin-token'))
    expect(response.status).toBe(200)
  })

  it('still returns 401 JSON (not a redirect) for an unauthenticated /api/admin route', async () => {
    const response = middleware(pageRequest('/api/admin/events'))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd web && npm run test -- middleware`
Expected: the pre-existing tests still pass; the new ones FAIL (matcher is still a string, no cookie/page-route handling yet).

- [ ] **Step 3: Update the middleware implementation**

Replace `web/middleware.ts` in full:

```typescript
import { NextRequest, NextResponse } from 'next/server'

// Every route under /api/admin runs with the Supabase service-role key (which
// bypasses RLS) and an R2 write credential. Without this gate anyone could
// create events, upload arbitrary files and drive InsightFace inference on the
// shared VM. A single shared secret is enough for a staff-only surface at this
// scale; it is deliberately fail-closed when ADMIN_TOKEN is not configured.
//
// /admin/* page routes are gated the same way, via a cookie carrying the same
// token value (no separate session store) — see the admin panel design doc.
export const ADMIN_COOKIE_NAME = 'admin_token'

export const config = {
  matcher: ['/api/admin/:path*', '/admin/:path*'],
}

// Length-independent comparison so a wrong token cannot be discovered byte by
// byte from response timing. Runs in the Edge runtime, so no node:crypto.
export function tokensMatch(presented: string, expected: string): boolean {
  if (presented.length !== expected.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < presented.length; i++) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export function bearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null
  }
  const match = /^Bearer (.+)$/.exec(authorizationHeader.trim())
  return match ? match[1] : null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // The login page and its API route must be reachable with no valid token —
  // otherwise nobody could ever obtain one.
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next()
  }

  const expected = process.env.ADMIN_TOKEN

  if (!expected) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'admin_auth_not_configured' }, { status: 500 })
      : NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const presented =
    bearerToken(request.headers.get('authorization')) ??
    request.cookies.get(ADMIN_COOKIE_NAME)?.value ??
    null

  if (!presented || !tokensMatch(presented, expected)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      )
    }
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  return NextResponse.next()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npm run test -- middleware`
Expected: PASS (all pre-existing and new cases)

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/middleware.ts web/middleware.test.ts
git commit -m "feat: cookie-based auth and page-route gating for the admin panel"
```

---

### Task 2: Login route

**Files:**
- Create: `web/app/api/admin/login/route.ts`
- Test: `web/app/api/admin/login/route.test.ts`

**Interfaces:**
- Consumes: `tokensMatch`, `ADMIN_COOKIE_NAME` from `@/middleware` (or `../../../../middleware` — use the `@/` alias, it resolves to `web/middleware.ts` since `@/*` maps to `./*`).
- Produces: `POST /api/admin/login` — body `{ password: string }` → `200 { ok: true }` with the `admin_token` cookie set on success, `401 { error: 'invalid_password' }` on failure (wrong password or `ADMIN_TOKEN` unset — same error either way, never reveal misconfiguration).

- [ ] **Step 1: Write the failing test**

Create `web/app/api/admin/login/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { ADMIN_COOKIE_NAME } from '@/middleware'

const originalToken = process.env.ADMIN_TOKEN

beforeEach(() => {
  process.env.ADMIN_TOKEN = 'super-secret-admin-token'
})

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.ADMIN_TOKEN
  } else {
    process.env.ADMIN_TOKEN = originalToken
  }
})

function loginRequest(password: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

describe('POST /api/admin/login', () => {
  it('sets the cookie and returns ok on the correct password', async () => {
    const response = await POST(loginRequest('super-secret-admin-token'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    const cookie = response.cookies.get(ADMIN_COOKIE_NAME)
    expect(cookie?.value).toBe('super-secret-admin-token')
    expect(cookie?.httpOnly).toBe(true)
  })

  it('rejects the wrong password without setting a cookie', async () => {
    const response = await POST(loginRequest('wrong-password'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'invalid_password' })
    expect(response.cookies.get(ADMIN_COOKIE_NAME)).toBeUndefined()
  })

  it('rejects with the same generic error when ADMIN_TOKEN is unset', async () => {
    delete process.env.ADMIN_TOKEN
    const response = await POST(loginRequest('anything'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'invalid_password' })
  })

  it('rejects a non-string password', async () => {
    const response = await POST(loginRequest(12345))
    expect(response.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- app/api/admin/login`
Expected: FAIL (`route.ts` doesn't exist)

- [ ] **Step 3: Implement the route**

Create `web/app/api/admin/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { tokensMatch, ADMIN_COOKIE_NAME } from '@/middleware'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const password = body?.password
  const expected = process.env.ADMIN_TOKEN

  if (!expected || typeof password !== 'string' || !tokensMatch(password, expected)) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE_NAME, expected, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- app/api/admin/login`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/app/api/admin/login
git commit -m "feat: admin login route sets the shared-secret cookie"
```

---

### Task 3: List events with photo counts

**Files:**
- Modify: `web/app/api/admin/events/route.ts`
- Create: `web/app/api/admin/events/route.test.ts`

**Interfaces:**
- Consumes: `orca_eventos.photos` (via PostgREST's embedded count syntax, `photos(count)`) — no schema change needed, this is a read-only aggregate over the existing FK.
- Produces: `GET /api/admin/events` → `200 { events: [{ id, name, slug, eventDate, photoCount }] }`, ordered by `eventDate` descending. `500 { error }` on a database error. This is the exact shape Task 6's list page consumes.

- [ ] **Step 1: Write the failing test**

Create `web/app/api/admin/events/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockOrder = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        order: mockOrder,
      }),
    }),
  }),
}))

import { GET } from './route'

describe('GET /api/admin/events', () => {
  beforeEach(() => {
    mockOrder.mockReset()
  })

  it('returns events with photo counts, mapped to camelCase', async () => {
    mockOrder.mockResolvedValue({
      data: [
        { id: '1', name: 'Festa Junina', slug: 'festa-junina', event_date: '2026-06-20', photos: [{ count: 42 }] },
        { id: '2', name: 'Casamento', slug: 'casamento', event_date: '2026-09-12', photos: [{ count: 0 }] },
      ],
      error: null,
    })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      events: [
        { id: '1', name: 'Festa Junina', slug: 'festa-junina', eventDate: '2026-06-20', photoCount: 42 },
        { id: '2', name: 'Casamento', slug: 'casamento', eventDate: '2026-09-12', photoCount: 0 },
      ],
    })
  })

  it('defaults photoCount to 0 when the embedded count is missing', async () => {
    mockOrder.mockResolvedValue({
      data: [{ id: '1', name: 'X', slug: 'x', event_date: '2026-01-01', photos: [] }],
      error: null,
    })

    const response = await GET()
    const body = await response.json()

    expect(body.events[0].photoCount).toBe(0)
  })

  it('returns 500 on a database error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'connection lost' } })

    const response = await GET()
    expect(response.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- app/api/admin/events/route.test`
Expected: FAIL (`GET` is not exported yet)

- [ ] **Step 3: Add the `GET` handler**

Read the current `web/app/api/admin/events/route.ts` first (it has a `POST` handler — you are adding `GET` alongside it, not replacing anything). Add this to the file, keeping the existing `POST` and its imports exactly as they are:

```typescript
type EventRow = {
  id: string
  name: string
  slug: string
  event_date: string
  photos: { count: number }[]
}

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from('events')
    .select('id, name, slug, event_date, photos(count)')
    .order('event_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const events = ((data ?? []) as EventRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    eventDate: row.event_date,
    photoCount: row.photos?.[0]?.count ?? 0,
  }))

  return NextResponse.json({ events })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- app/api/admin/events/route.test`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/app/api/admin/events/route.ts web/app/api/admin/events/route.test.ts
git commit -m "feat: list events with photo counts (GET /api/admin/events)"
```

---

### Task 4: Edit and delete an event

**Files:**
- Create: `web/app/api/admin/events/[id]/route.ts`
- Test: `web/app/api/admin/events/[id]/route.test.ts`

**Interfaces:**
- Consumes: `isUuid` from `@/lib/validation` (already used by the sibling `photos/route.ts`).
- Produces: `PATCH /api/admin/events/[id]` — body `{ name?, eventDate? }`, at least one required → `200 { id, name, slug, eventDate }` | `400` (invalid id or empty update) | `404 { error: 'event_not_found' }` | `500`. `DELETE /api/admin/events/[id]` → `200 { ok: true }` | `400` | `404` | `500`. Task 6's list page calls both by these exact shapes.

- [ ] **Step 1: Write the failing test**

Create `web/app/api/admin/events/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateMaybeSingle = vi.fn()
const mockDeleteMaybeSingle = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: mockUpdateMaybeSingle,
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: mockDeleteMaybeSingle,
          }),
        }),
      }),
    }),
  }),
}))

import { PATCH, DELETE } from './route'

const VALID_ID = '11111111-1111-1111-1111-111111111111'

function jsonRequest(body: unknown) {
  return new Request(`http://localhost:3000/api/admin/events/${VALID_ID}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as any
}

describe('PATCH /api/admin/events/[id]', () => {
  beforeEach(() => {
    mockUpdateMaybeSingle.mockReset()
  })

  it('updates name and eventDate, returns the updated row', async () => {
    mockUpdateMaybeSingle.mockResolvedValue({
      data: { id: VALID_ID, name: 'Novo Nome', slug: 'evento-x', event_date: '2026-10-01' },
      error: null,
    })

    const response = await PATCH(jsonRequest({ name: 'Novo Nome', eventDate: '2026-10-01' }), {
      params: { id: VALID_ID },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: VALID_ID,
      name: 'Novo Nome',
      slug: 'evento-x',
      eventDate: '2026-10-01',
    })
  })

  it('rejects an invalid id before touching the database', async () => {
    const response = await PATCH(jsonRequest({ name: 'X' }), { params: { id: 'not-a-uuid' } })
    expect(response.status).toBe(400)
    expect(mockUpdateMaybeSingle).not.toHaveBeenCalled()
  })

  it('rejects an empty update body', async () => {
    const response = await PATCH(jsonRequest({}), { params: { id: VALID_ID } })
    expect(response.status).toBe(400)
    expect(mockUpdateMaybeSingle).not.toHaveBeenCalled()
  })

  it('returns 404 when no row matches the id', async () => {
    mockUpdateMaybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await PATCH(jsonRequest({ name: 'X' }), { params: { id: VALID_ID } })
    expect(response.status).toBe(404)
  })

  it('returns 500 on a database error', async () => {
    mockUpdateMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const response = await PATCH(jsonRequest({ name: 'X' }), { params: { id: VALID_ID } })
    expect(response.status).toBe(500)
  })
})

describe('DELETE /api/admin/events/[id]', () => {
  beforeEach(() => {
    mockDeleteMaybeSingle.mockReset()
  })

  it('deletes the event and returns ok', async () => {
    mockDeleteMaybeSingle.mockResolvedValue({ data: { id: VALID_ID }, error: null })

    const response = await DELETE(new Request('http://localhost:3000') as any, { params: { id: VALID_ID } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('rejects an invalid id', async () => {
    const response = await DELETE(new Request('http://localhost:3000') as any, { params: { id: 'nope' } })
    expect(response.status).toBe(400)
    expect(mockDeleteMaybeSingle).not.toHaveBeenCalled()
  })

  it('returns 404 when no row matches the id', async () => {
    mockDeleteMaybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await DELETE(new Request('http://localhost:3000') as any, { params: { id: VALID_ID } })
    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- app/api/admin/events/\\\[id\\\]/route.test`
Expected: FAIL (`route.ts` doesn't exist)

- [ ] **Step 3: Implement the route**

Create `web/app/api/admin/events/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { isUuid } from '@/lib/validation'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'invalid_event_id' }, { status: 400 })
  }

  const body = await request.json()
  const update: { name?: string; event_date?: string } = {}
  if (typeof body?.name === 'string' && body.name.length > 0) {
    update.name = body.name
  }
  if (typeof body?.eventDate === 'string' && body.eventDate.length > 0) {
    update.event_date = body.eventDate
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  // maybeSingle (not single, unlike sibling routes) because "no row matched
  // this id" must be distinguishable from a query error, to return 404
  // rather than 500.
  const { data, error } = await supabaseAdmin()
    .from('events')
    .update(update)
    .eq('id', params.id)
    .select('id, name, slug, event_date')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  return NextResponse.json({ id: data.id, name: data.name, slug: data.slug, eventDate: data.event_date })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'invalid_event_id' }, { status: 400 })
  }

  // The events -> photos/faces/purchases foreign keys are all `on delete
  // cascade` (supabase/migrations/0001_orca_eventos_schema.sql), so this
  // single delete is sufficient at the database level. R2 objects for this
  // event's photos are NOT removed — orphaned storage cleanup is out of
  // scope for this plan (see the design doc's "itens em aberto").
  const { data, error } = await supabaseAdmin()
    .from('events')
    .delete()
    .eq('id', params.id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- app/api/admin/events/\\\[id\\\]/route.test`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/app/api/admin/events/\[id\]/route.ts web/app/api/admin/events/\[id\]/route.test.ts
git commit -m "feat: edit and delete an event (PATCH/DELETE /api/admin/events/[id])"
```

---

### Task 5: Login page

**Files:**
- Create: `web/app/admin/login/page.tsx`
- Test: `web/app/admin/login/page.test.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/login` (Task 2) — sends `{ password }`, expects `200`/`401`.
- Produces: the page component `AdminLoginPage`, no props. On success, navigates to `/admin/events`.

- [ ] **Step 1: Write the failing test**

Create `web/app/admin/login/page.test.tsx`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

import AdminLoginPage from './page'

afterEach(() => {
  vi.restoreAllMocks()
  pushMock.mockReset()
})

describe('AdminLoginPage', () => {
  it('renders a password field and a submit button', () => {
    render(<AdminLoginPage />)
    expect(screen.getByLabelText(/senha/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeTruthy()
  })

  it('navigates to /admin/events on successful login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    render(<AdminLoginPage />)
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin/events'))
  })

  it('shows an error and does not navigate on a wrong password', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_password' }), { status: 401 })
    )

    render(<AdminLoginPage />)
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/senha incorreta/i))
    expect(pushMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- app/admin/login`
Expected: FAIL (`page.tsx` doesn't exist)

- [ ] **Step 3: Implement the page**

Create `web/app/admin/login/page.tsx`:

```typescript
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

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
  }

  return (
    <main className="max-w-sm mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Painel admin</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Entrar</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- app/admin/login`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/app/admin/login
git commit -m "feat: admin login page"
```

---

### Task 6: Event list page (create, edit, delete)

**Files:**
- Create: `web/app/admin/events/page.tsx`
- Test: `web/app/admin/events/page.test.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/admin/events` (Tasks 3, and the pre-existing `POST`), `PATCH`/`DELETE /api/admin/events/[id]` (Task 4). Exact response shapes as defined in those tasks.
- Produces: `AdminEventsPage`, no props. Links to `/admin/events/[id]/upload` (Task 7) per row.

- [ ] **Step 1: Write the failing test**

Create `web/app/admin/events/page.test.tsx`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import AdminEventsPage from './page'

const EVENTS_RESPONSE = {
  events: [
    { id: '1', name: 'Festa Junina', slug: 'festa-junina', eventDate: '2026-06-20', photoCount: 42 },
  ],
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminEventsPage', () => {
  it('loads and renders the event list with photo counts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))

    render(<AdminEventsPage />)

    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('creates a new event and reloads the list', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: '2', name: 'X', slug: 'x', eventDate: '2026-01-01' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /criar evento/i }))
    fireEvent.change(screen.getByLabelText(/^nome$/i), { target: { value: 'Novo Evento' } })
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'novo-evento' } })
    fireEvent.change(screen.getByLabelText(/data/i), { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const createCall = fetchMock.mock.calls[1]
    expect(createCall[0]).toBe('/api/admin/events')
    expect(JSON.parse(createCall[1]!.body as string)).toEqual({
      name: 'Novo Evento',
      slug: 'novo-evento',
      eventDate: '2026-12-01',
    })
  })

  it('deletes an event after confirmation and reloads the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /apagar/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/events/1')
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE' })
  })

  it('does not delete when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(EVENTS_RESPONSE), { status: 200 }))

    render(<AdminEventsPage />)
    await waitFor(() => expect(screen.getByText('Festa Junina')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /apagar/i }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- app/admin/events/page.test`
Expected: FAIL (`page.tsx` doesn't exist)

- [ ] **Step 3: Implement the page**

Create `web/app/admin/events/page.tsx`:

```typescript
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

  async function loadEvents() {
    setLoading(true)
    const response = await fetch('/api/admin/events')
    if (response.ok) {
      const data = await response.json()
      setEvents(data.events)
    } else {
      setError('Erro ao carregar eventos.')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadEvents()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)

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
    loadEvents()
  }

  async function handleUpdate(id: string) {
    setError(null)

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
    loadEvents()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Apagar este evento? As fotos no armazenamento não serão removidas.')) {
      return
    }

    setError(null)
    const response = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })

    if (!response.ok) {
      setError('Erro ao apagar evento.')
      return
    }

    loadEvents()
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
          <button type="submit">Salvar</button>
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
                    <button onClick={() => handleUpdate(event.id)}>Salvar</button>
                    <button onClick={() => setEditingId(null)}>Cancelar</button>
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
                    <button onClick={() => handleDelete(event.id)}>Apagar</button>
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- app/admin/events/page.test`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add web/app/admin/events/page.tsx web/app/admin/events/page.test.tsx
git commit -m "feat: admin event list page (create, edit, delete)"
```

---

### Task 7: Photo upload page

**Files:**
- Create: `web/app/admin/events/[id]/upload/page.tsx`
- Test: `web/app/admin/events/[id]/upload/page.test.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/events/[id]/photos` (pre-existing, unchanged) — response shape `{ uploaded: { filename, id, hasFace }[], failed: { filename, error }[] }`.
- Produces: `AdminUploadPage`, no props (reads the event id from the route via `useParams`).

- [ ] **Step 1: Write the failing test**

Create `web/app/admin/events/[id]/upload/page.test.tsx`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '11111111-1111-1111-1111-111111111111' }),
}))

import AdminUploadPage from './page'

afterEach(() => {
  vi.restoreAllMocks()
})

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]')!
}

describe('AdminUploadPage', () => {
  it('disables the upload button until files are selected', () => {
    render(<AdminUploadPage />)
    expect(screen.getByRole('button', { name: /subir/i })).toHaveProperty('disabled', true)
  })

  it('uploads selected files and shows the per-file result', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          uploaded: [{ filename: 'foto1.jpg', id: 'p1', hasFace: true }],
          failed: [{ filename: 'foto2.jpg', error: 'invalid image' }],
        }),
        { status: 200 }
      )
    )

    render(<AdminUploadPage />)

    const file1 = new File(['a'], 'foto1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['b'], 'foto2.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput(), { target: { files: [file1, file2] } })

    fireEvent.click(screen.getByRole('button', { name: /subir/i }))

    await waitFor(() => expect(screen.getByText(/1 enviada/i)).toBeTruthy())
    expect(screen.getByText(/foto2.jpg/i)).toBeTruthy()

    const call = fetchMock.mock.calls[0]
    expect(call[0]).toBe('/api/admin/events/11111111-1111-1111-1111-111111111111/photos')
    const body = call[1]!.body as FormData
    expect(body.getAll('photos')).toHaveLength(2)
  })

  it('shows a generic error on a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))

    render(<AdminUploadPage />)
    fireEvent.change(fileInput(), { target: { files: [new File(['a'], 'x.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(screen.getByRole('button', { name: /subir/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/erro ao subir/i))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- app/admin/events/\\\[id\\\]/upload`
Expected: FAIL (`page.tsx` doesn't exist)

- [ ] **Step 3: Implement the page**

Create `web/app/admin/events/[id]/upload/page.tsx`:

```typescript
'use client'

import { useState, type DragEvent } from 'react'
import { useParams } from 'next/navigation'

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
    } catch {
      setError('Erro ao subir fotos.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Subir fotos</h1>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{ border: '2px dashed #ccc', padding: '2rem', textAlign: 'center' }}
      >
        {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : 'Arraste as fotos aqui'}
      </div>
      <input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      <button onClick={handleUpload} disabled={files.length === 0 || uploading}>
        {uploading ? 'Enviando...' : `Subir ${files.length} foto(s)`}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div>
          <p>
            {result.uploaded.length} enviada(s) com sucesso, {result.failed.length} falharam.
          </p>
          {result.failed.length > 0 && (
            <ul>
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
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- app/admin/events/\\\[id\\\]/upload`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite, tsc, lint, and build**

Run: `cd web && npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all succeed. Confirm `/admin/login`, `/admin/events`, and `/admin/events/[id]/upload` all appear as dynamic (`ƒ`) routes in the build output — a page reading `useParams`/cookies/making runtime `fetch` calls should never be statically prerendered.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/.claude/worktrees/plataforma-fotos-eventos"
git add "web/app/admin/events/[id]/upload"
git commit -m "feat: admin photo upload page with per-file results"
```

---

## Self-Review Notes

- **Spec coverage:** §3 (login/cookie/matcher, all six files) → Tasks 1-2, 5. §3 (`GET`/`PATCH`/`DELETE` routes) → Tasks 3-4. §3 (three pages) → Tasks 5-7. §4 (data flow steps 1-7) → traced across Tasks 1 (redirect), 2 (login), 3 (list load), existing `POST` reused (create), 4 (edit/delete), 7 (upload). §5 (error handling: generic login error, fail-closed unset token, 404s, cookie-expired redirect, upload isolation already covered) → Tasks 1, 2, 4, 7. §6 (testing: middleware cookie cases, login route, list/edit/delete routes, component tests) → every task's test steps.
- **Placeholder scan:** none found — every step has complete, runnable code.
- **Type consistency:** `EventRow` in Task 6's page matches the exact `{ id, name, slug, eventDate, photoCount }` shape Task 3's `GET` route produces. `UploadResult` in Task 7 matches the pre-existing photos route's `{ uploaded, failed }` shape (verified against `web/app/api/admin/events/[id]/photos/route.ts`, unchanged by this plan). `ADMIN_COOKIE_NAME` is defined once in Task 1 and imported by name in Task 2 — no re-declaration.
