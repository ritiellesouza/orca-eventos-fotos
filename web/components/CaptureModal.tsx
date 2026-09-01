'use client'

import { useRef } from 'react'
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onCapture(file)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[15px] max-w-md w-full p-6 text-center">
        <h2 className="text-xl font-extrabold text-orca-azul-escuro mb-2">Reconhecimento facial</h2>
        <p className="text-orca-preto-marca mb-6">Tire uma foto ou carregue uma foto do seu rosto.</p>
        <div className="flex gap-3 justify-center mb-4">
          <Button variant="secondary" onClick={() => galleryInputRef.current?.click()}>
            Carregar foto
          </Button>
          <Button onClick={() => cameraInputRef.current?.click()}>Tirar foto</Button>
        </div>
        <button onClick={onCancel} className="text-orca-royal underline text-sm">
          Cancelar
        </button>
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
