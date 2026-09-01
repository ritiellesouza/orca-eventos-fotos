import { useEffect } from 'react'

export const SCREENSHOT_GUARD_CLASS = 'screenshot-protecao'

// Toggles a class directly on document.body from inside the browser's own
// blur/focus listeners, instead of going through React state + a re-render.
// setState+re-render adds at least one extra tick before the CSS actually
// lands in the DOM; a screen-capture tool (e.g. Win+Shift+S) can grab its
// frozen frame within that same window, so shaving every avoidable
// millisecond off the reaction path matters here -- see the
// `.screenshot-protecao .foto-protegida` rule in globals.css for the actual
// blur. This can shave the reaction time but can never guarantee winning
// that race: the OS can freeze the screen before this listener runs at all.
export function useScreenshotGuard(): void {
  useEffect(() => {
    const onBlur = () => document.body.classList.add(SCREENSHOT_GUARD_CLASS)
    const onFocus = () => document.body.classList.remove(SCREENSHOT_GUARD_CLASS)

    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.body.classList.remove(SCREENSHOT_GUARD_CLASS)
    }
  }, [])
}
