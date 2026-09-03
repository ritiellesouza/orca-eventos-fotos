import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME } from '@/middleware'

// Deliberately gated by the same middleware as every other /api/admin route:
// only a session that already holds a valid cookie (or Bearer token) can reach
// this, which is exactly the session allowed to end itself. The cookie carries
// the shared ADMIN_TOKEN itself, so clearing it is the only revocation
// available short of rotating the token for everyone.
export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ADMIN_COOKIE_NAME)
  return response
}
