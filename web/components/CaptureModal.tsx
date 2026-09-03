'use client'

import { useEffect, useRef } from 'react'
import { Button } from './Button'

export function CaptureModal({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void
  onCancel: () => void
}) {
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onCapture(file)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onCancel}>
      <div
        className="bg-white rounded-[15px] max-w-md w-full p-6 text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="capture-title" className="text-xl font-extrabold text-orca-azul-escuro mb-2">Reconhecimento facial</h2>
        <p className="text-orca-preto-marca mb-6">Tire uma foto ou carregue uma foto do seu rosto.</p>
        <div className="flex gap-3 justify-center mb-4">
          <Button variant="secondary" onClick={() => galleryInputRef.current?.click()}>
            Carregar foto
          </Button>
          <Button onClick={() => cameraInputRef.current?.click()}>Tirar foto</Button>
        </div>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
