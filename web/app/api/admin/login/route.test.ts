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

// The limiter lives at module scope and is keyed by IP, so every test that is
// not itself about rate limiting must use its own address — otherwise the
// suite's own request count would trip the limit.
let ipCounter = 0
function nextIp() {
  ipCounter += 1
  return `203.0.113.${ipCounter}`
}

function loginRequest(password: unknown, ip: string = nextIp()) {
  return new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
    headers: { 'x-forwarded-for': ip },
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

  it('rejects an invalid JSON body with the same generic error', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/admin/login', {
        method: 'POST',
        body: 'not valid json',
        headers: { 'x-forwarded-for': nextIp() },
      })
    )
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'invalid_password' })
  })

  it('rate-limits repeated attempts from the same IP', async () => {
    const ip = '198.51.100.7'

    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await POST(loginRequest('wrong-password', ip))
      expect(response.status).toBe(401)
    }

    const blocked = await POST(loginRequest('wrong-password', ip))
    expect(blocked.status).toBe(429)
    await expect(blocked.json()).resolves.toEqual({ error: 'rate_limited' })
  })

  it('keeps each IP budget separate', async () => {
    const flooded = '198.51.100.8'
    for (let attempt = 0; attempt < 6; attempt++) {
      await POST(loginRequest('wrong-password', flooded))
    }

    const other = await POST(loginRequest('super-secret-admin-token', '198.51.100.9'))
    expect(other.status).toBe(200)
  })
})
