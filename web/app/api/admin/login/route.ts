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
