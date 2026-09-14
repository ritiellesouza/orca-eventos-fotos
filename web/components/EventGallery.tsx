'use client'

import { useEffect, useState } from 'react'
import { PhotoGrid } from './PhotoGrid'
import { Button } from './Button'

type PhotoResult = { photoId: string; previewUrl: string }

const PAGE_SIZE = 40

export function EventGallery({
  slug,
  selected,
  onToggle,
  onSelectMany,
}: {
  slug: string
  selected: Set<string>
  onToggle: (photoId: string) => void
  onSelectMany: (photoIds: string[]) => void
}) {
  const [photos, setPhotos] = useState<PhotoResult[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPage(offset: number) {
    try {
      const response = await fetch(`/api/events/${slug}/photos?offset=${offset}&limit=${PAGE_SIZE}`)

      if (!response.ok) {
        setError('Erro ao carregar as fotos do evento.')
        return
      }

      const data: { results: PhotoResult[]; hasMore: boolean } = await response.json()
      setPhotos((prev) => (offset === 0 ? data.results : [...prev, ...data.results]))
      setHasMore(data.hasMore)
      setError(null)
    } catch {
      setError('Erro ao carregar as fotos do evento.')
    }
  }

  useEffect(() => {
    setLoading(true)
    loadPage(0).finally(() => setLoading(false))
    // slug is fixed for the lifetime of this page -- no other dependency to
    // re-fetch on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  async function handleLoadMore() {
    setLoadingMore(true)
    await loadPage(photos.length)
    setLoadingMore(false)
  }

  if (loading) {
    return <p className="max-w-4xl mx-auto p-4">Carregando fotos...</p>
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-extrabold text-orca-azul-escuro">Todas as fotos do evento</h2>
        {photos.length > 0 && (
          <Button variant="secondary" onClick={() => onSelectMany(photos.map((p) => p.photoId))}>
            Selecionar todas
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-red-700 mb-3">
          {error}
        </p>
      )}

      {photos.length > 0 && <PhotoGrid photos={photos} selected={selected} onToggle={onToggle} />}

      {error && photos.length === 0 && (
        <Button variant="secondary" onClick={() => loadPage(0)}>
          Tentar novamente
        </Button>
      )}

      {hasMore && (
        <div className="text-center mt-4">
          <Button variant="secondary" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  )
}
