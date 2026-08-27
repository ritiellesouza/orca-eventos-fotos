import { describe, it, expect } from 'vitest'
import { formatTotalBRL } from './pricing'

describe('formatTotalBRL', () => {
  it('formats a single photo at a whole-real price', () => {
    expect(formatTotalBRL(1500, 1)).toBe('R$ 15,00')
  })

  it('multiplies unit price by count', () => {
    expect(formatTotalBRL(1500, 3)).toBe('R$ 45,00')
  })

  it('formats zero photos as zero', () => {
    expect(formatTotalBRL(1500, 0)).toBe('R$ 0,00')
  })

  it('formats cents correctly, not just whole reais', () => {
    expect(formatTotalBRL(1050, 2)).toBe('R$ 21,00')
    expect(formatTotalBRL(999, 1)).toBe('R$ 9,99')
  })
})
