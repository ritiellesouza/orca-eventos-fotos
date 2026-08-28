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
