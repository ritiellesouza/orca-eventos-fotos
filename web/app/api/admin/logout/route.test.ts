import { describe, it, expect } from 'vitest'
import { POST } from './route'
import { ADMIN_COOKIE_NAME } from '@/middleware'

describe('POST /api/admin/logout', () => {
  it('clears the admin cookie', async () => {
    const response = await POST()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })

    const cookie = response.cookies.get(ADMIN_COOKIE_NAME)
    expect(cookie?.value).toBe('')
    // Expired in the past, so the browser drops it rather than keeping an
    // empty-but-present cookie around.
    expect(cookie?.expires?.getTime()).toBe(0)
  })

  it('sends the clearing cookie for the whole site, not just /api', async () => {
    const response = await POST()

    expect(response.headers.get('set-cookie')).toContain(`${ADMIN_COOKIE_NAME}=`)
    expect(response.cookies.get(ADMIN_COOKIE_NAME)?.path).toBe('/')
  })
})
