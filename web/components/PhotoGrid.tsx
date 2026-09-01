'use client'

import { useScreenshotGuard } from './useScreenshotGuard'

type PhotoResult = { photoId: string; previewUrl: string }

export function PhotoGrid({
  photos,
  selected,
  onToggle,
}: {
  photos: PhotoResult[]
  selected: Set<string>
  onToggle: (photoId: string) => void
}) {
  // Blurs every .foto-protegida image on window blur -- see the CSS rule in
  // globals.css. This toggles a class on document.body directly from the
  // browser's own event listener, not through this component's render, so
  // there's no React re-render standing between the blur event and the
  // pixels actually changing.
  useScreenshotGuard()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {photos.map((photo, index) => {
        const isSelected = selected.has(photo.photoId)
        return (
          <button
            key={photo.photoId}
            onClick={() => onToggle(photo.photoId)}
            aria-pressed={isSelected}
            className={`relative border-2 rounded ${isSelected ? 'border-orca-dourado' : 'border-transparent'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.previewUrl}
              alt={`Foto ${index + 1}${isSelected ? ' (selecionada)' : ''}`}
              className="foto-protegida w-full h-full object-cover rounded"
            />
            {/* Decorative only -- aria-pressed on the button above already
                communicates selection state to assistive tech. */}
            <span
              aria-hidden="true"
              data-testid="photo-checkbox"
              className={`absolute top-2 right-2 w-5 h-5 rounded border-2 ${
                isSelected ? 'bg-orca-verde-agua border-orca-verde-agua' : 'bg-white/80 border-orca-preto-marca/20'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
