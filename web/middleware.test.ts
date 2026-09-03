import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware, bearerToken, tokensMatch, config } from './middleware'

function adminRequest(authorization?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/events', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  })
}

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

describe('admin middleware', () => {
  it('guards every /api/admin route', () => {
    // matcher is now an array covering both /api/admin and /admin page
    // routes (see the "admin middleware — page routes and cookie auth"
    // describe block below for the dedicated assertion on this).
    expect(config.matcher).toEqual(['/api/admin/:path*', '/admin/:path*'])
  })

  it('rejects a request with no Authorization header', async () => {
    const response = middleware(adminRequest())
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
  })

  it('rejects a wrong token', () => {
    expect(middleware(adminRequest('Bearer wrong-token')).status).toBe(401)
  })

  it('rejects a token that is a prefix of the real one', () => {
    expect(middleware(adminRequest('Bearer super-secret')).status).toBe(401)
  })

  it('allows the correct bearer token through', () => {
    const response = middleware(adminRequest('Bearer super-secret-admin-token'))
    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('fails closed with 500 when ADMIN_TOKEN is not configured', () => {
    delete process.env.ADMIN_TOKEN
    expect(middleware(adminRequest('Bearer ')).status).toBe(500)
    expect(middleware(adminRequest()).status).toBe(500)
  })
})

describe('bearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(bearerToken('Bearer abc123')).toBe('abc123')
  })

  it('returns null for missing or non-Bearer schemes', () => {
    expect(bearerToken(null)).toBeNull()
    expect(bearerToken('Basic abc123')).toBeNull()
    expect(bearerToken('Bearer')).toBeNull()
  })
})

describe('tokensMatch', () => {
  it('matches identical strings only', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true)
    expect(tokensMatch('abc', 'abd')).toBe(false)
    expect(tokensMatch('ab', 'abc')).toBe(false)
    expect(tokensMatch('', '')).toBe(true)
  })
})

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
