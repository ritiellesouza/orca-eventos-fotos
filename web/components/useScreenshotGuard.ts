import { useEffect } from 'react'

export const SCREENSHOT_GUARD_CLASS = 'screenshot-protecao'

// Toggles a class directly on document.body from inside the browser's own
// event listeners, instead of going through React state + a re-render.
// setState+re-render adds at least one extra tick before the CSS actually
// lands in the DOM; a screen-capture tool can grab its frozen frame within
// that same window, so shaving every avoidable millisecond off the reaction
// path matters here -- see the `.screenshot-protecao .foto-protegida` rule
// in globals.css for the actual blur.
//
// Two triggers, confirmed by reverse-engineering Banlek's own equivalent
// mechanism (protecao-screenshot-bloqueada) live on their site:
//   1. keydown on the Meta/Windows key alone. Win+Shift+S (and most other
//      Windows screenshot shortcuts) always presses Meta first, and the
//      browser receives that keydown before Windows finishes the combo and
//      freezes the display for the snip overlay -- reacting here, instead of
//      waiting for the resulting window blur, is what actually wins the
//      race in practice.
//   2. window blur, as a fallback for capture methods that don't start with
//      the Meta key (alt-tabbing to a separate screenshot app, etc).
// Neither trigger can guarantee winning: the OS can in principle freeze the
// screen before any JS runs at all. This is a best-effort latency
// improvement on top of the always-on watermark + downscaled resolution,
// which is the actual unbypassable protection.
export function useScreenshotGuard(): void {
  useEffect(() => {
    const guard = () => document.body.classList.add(SCREENSHOT_GUARD_CLASS)
    const release = () => document.body.classList.remove(SCREENSHOT_GUARD_CLASS)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta') {
        guard()
      }
    }

    window.addEventListener('blur', guard)
    window.addEventListener('focus', release)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('blur', guard)
      window.removeEventListener('focus', release)
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove(SCREENSHOT_GUARD_CLASS)
    }
  }, [])
}
