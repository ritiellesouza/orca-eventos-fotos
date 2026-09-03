import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useScreenshotGuard, SCREENSHOT_GUARD_CLASS } from './useScreenshotGuard'

afterEach(() => {
  cleanup()
  document.body.className = ''
})

describe('useScreenshotGuard', () => {
  it('adds the guard class to document.body on window blur, removes it on focus', () => {
    renderHook(() => useScreenshotGuard())
    expect(document.body.classList.contains(SCREENSHOT_GUARD_CLASS)).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(document.body.classList.contains(SCREENSHOT_GUARD_CLASS)).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(document.body.classList.contains(SCREENSHOT_GUARD_CLASS)).toBe(false)
  })

  it('adds the guard class on Meta keydown alone, before the rest of a shortcut completes', () => {
    renderHook(() => useScreenshotGuard())
    expect(document.body.classList.contains(SCREENSHOT_GUARD_CLASS)).toBe(false)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta', bubbles: true }))
    })
    expect(document.body.classList.contains(SCREENSHOT_GUARD_CLASS)).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(document.body.classList.contains(SCREENSHOT_GUARD_CLASS)).toBe(false)
  })

  it('ignores keydowns for keys other than Meta', () => {
    renderHook(() => useScreenshotGuard())

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }))
    })
    expect(document.body.classList.contains(SCREENSHOT_GUARD_CLASS)).toBe(false)
  })

  it('removes the guard class on unmount so it never gets stuck on', () => {
    const { unmount } = renderHook(() => useScreenshotGuard())

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(document.body.classList.contains(SCREENSHOT_GUARD_CLASS)).toBe(true)

    unmount()
    expect(document.body.classList.contains(SCREENSHOT_GUARD_CLASS)).toBe(false)
  })
})
