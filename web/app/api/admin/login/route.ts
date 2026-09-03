import { NextRequest, NextResponse } from 'next/server'
import { tokensMatch, ADMIN_COOKIE_NAME } from '@/middleware'
import { createRateLimiter } from '@/lib/rateLimit'

// The only unauthenticated route under /api/admin — it has to be, it is how a
// token is obtained. ADMIN_TOKEN is now also typed by a human at a login form,
// so it can no longer be assumed to be 64 hex chars of entropy.
const limiter = createRateLimiter(5, 60_000)

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  if (!limiter.allow(clientIp(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 })
  }

  const password = (body as { password?: unknown } | null)?.password
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
