import { describe, it, expect } from 'vitest'
import { isUuid } from './validation'

describe('isUuid', () => {
  it('accepts a canonical v4 uuid', () => {
    expect(isUuid('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d')).toBe(true)
  })

  it('rejects path traversal and other non-uuid strings', () => {
    expect(isUuid('../../secret')).toBe(false)
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/../x')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })
})
