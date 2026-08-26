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
    expect(config.matcher).toBe('/api/admin/:path*')
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
