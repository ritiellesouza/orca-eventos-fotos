'use client'

import { useBlurOnFocusLoss } from './useBlurOnFocusLoss'

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
  const isBlurred = useBlurOnFocusLoss()

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
              className={`w-full h-full object-cover rounded transition-all ${isBlurred ? 'blur-lg' : ''}`}
            />
          </button>
        )
      })}
    </div>
  )
}
