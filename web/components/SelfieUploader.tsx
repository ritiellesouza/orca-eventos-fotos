'use client'

import { useState } from 'react'
import { PhotoGrid } from './PhotoGrid'
import { ConsentModal } from './ConsentModal'
import { CaptureModal } from './CaptureModal'
import { Button } from './Button'

type PhotoResult = { photoId: string; previewUrl: string }
type ModalState = 'none' | 'consent' | 'capture'

export function SelfieUploader({
  slug,
  selected,
  onToggle,
  onSelectMany,
  onDeselectMany,
}: {
  slug: string
  selected: Set<string>
  onToggle: (photoId: string) => void
  onSelectMany: (photoIds: string[]) => void
  onDeselectMany: (photoIds: string[]) => void
}) {
  const [consented, setConsented] = useState(false)
  const [modalOpen, setModalOpen] = useState<ModalState>('none')
  const [results, setResults] = useState<PhotoResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    setSearching(true)
    const formData = new FormData()
    formData.append('selfie', file)
    // The API rejects the request without this; the consent modal is a UI
    // affordance, this field is what the server records the agreement from.
    formData.append('consent', 'true')

    try {
      const response = await fetch(`/api/events/${slug}/search`, { method: 'POST', body: formData })

      let data: { error?: string; results?: PhotoResult[] } | null = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {
        setError(data?.error === 'no_face_detected' ? 'Não achamos um rosto nessa foto. Tente outra, com boa iluminação.' : 'Erro ao buscar fotos.')
        setSearching(false)
        return
      }

      // A new search replaces the visible grid entirely. Any photo ids
      // selected from the PREVIOUS search results would otherwise ride
      // along in the shared selection with no visible tile to deselect them
      // from -- the buyer would be billed for a photo they can no longer
      // see. Only the previous search's own ids are removed: a selection
      // made in the full gallery lives in the same shared set and must
      // survive a fresh selfie search.
      if (results) {
        onDeselectMany(results.map((r) => r.photoId))
      }
      setResults(data?.results ?? [])
      setSearching(false)
    } catch {
      setError('Erro ao buscar fotos.')
      setSearching(false)
    }
  }

  // Consent is asked once per component lifetime -- a search that already
  // happened (or a retry after one) skips straight to the capture modal.
  function openSearchFlow() {
    if (searching) return
    setModalOpen(consented ? 'capture' : 'consent')
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {!results && (
        <div className="max-w-md mx-auto text-center bg-white border border-orca-dourado/30 rounded-[15px] p-8 shadow-[3px_3px_15px_rgba(33,33,33,0.66)]">
          <h2 className="text-xl font-extrabold text-orca-azul-escuro mb-2">Encontre suas fotos agora!</h2>
          <p className="text-orca-preto-marca mb-6">
            Envie uma selfie para localizar todas as suas fotos usando reconhecimento facial
          </p>
          <Button onClick={openSearchFlow} disabled={searching}>
            {searching ? 'Buscando...' : 'Encontrar'}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-red-700 mt-4">
          {error}
        </p>
      )}

      {modalOpen === 'consent' && (
        <ConsentModal
          onAgree={() => {
            setConsented(true)
            setModalOpen('capture')
          }}
          onCancel={() => setModalOpen('none')}
        />
      )}

      {modalOpen === 'capture' && (
        <CaptureModal
          onCapture={(file) => {
            setModalOpen('none')
            handleFile(file)
          }}
          onCancel={() => setModalOpen('none')}
        />
      )}

      {results && (
        <>
          <div className="flex items-center justify-between mt-4 mb-2">
            <Button variant="secondary" onClick={openSearchFlow}>
              Buscar novamente
            </Button>
            {results.length > 0 && (
              <Button variant="secondary" onClick={() => onSelectMany(results.map((r) => r.photoId))}>
                Selecionar todas
              </Button>
            )}
          </div>
          <PhotoGrid photos={results} selected={selected} onToggle={onToggle} />
        </>
      )}
    </div>
  )
}
