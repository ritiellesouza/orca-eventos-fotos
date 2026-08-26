import { useEffect, useState } from 'react'

export function useBlurOnFocusLoss(): boolean {
  const [isBlurred, setIsBlurred] = useState(false)

  useEffect(() => {
    const onBlur = () => setIsBlurred(true)
    const onFocus = () => setIsBlurred(false)

    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return isBlurred
}
