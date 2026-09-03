import { describe, it, expect, afterEach } from 'vitest'
import { requireEnv } from './env'

afterEach(() => {
  delete process.env.ORCA_TEST_VAR
})

describe('requireEnv', () => {
  it('returns the value when the variable is set', () => {
    process.env.ORCA_TEST_VAR = 'value'
    expect(requireEnv('ORCA_TEST_VAR')).toBe('value')
  })

  it('throws naming the variable when it is unset', () => {
    expect(() => requireEnv('ORCA_TEST_VAR')).toThrow(
      'Missing required environment variable: ORCA_TEST_VAR'
    )
  })

  it('throws when the variable is set but empty', () => {
    process.env.ORCA_TEST_VAR = ''
    expect(() => requireEnv('ORCA_TEST_VAR')).toThrow(
      'Missing required environment variable: ORCA_TEST_VAR'
    )
  })
})
