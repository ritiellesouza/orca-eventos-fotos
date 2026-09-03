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
