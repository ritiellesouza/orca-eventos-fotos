import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBlurOnFocusLoss } from './useBlurOnFocusLoss'

describe('useBlurOnFocusLoss', () => {
  it('starts false, becomes true on window blur, false again on focus', () => {
    const { result } = renderHook(() => useBlurOnFocusLoss())
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe(false)
  })
})
