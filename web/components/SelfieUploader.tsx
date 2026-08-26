'use client'

import { useState } from 'react'
import { PhotoGrid } from './PhotoGrid'

type PhotoResult = { photoId: string; previewUrl: string }

export function SelfieUploader({ slug }: { slug: string }) {
  const [consented, setConsented] = useState(false)
  const [results, setResults] = useState<PhotoResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function handleFile(file: File) {
    setError(null)
    const formData = new FormData()
    formData.append('selfie', file)

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
        return
      }

      setResults(data?.results ?? [])
    } catch {
      setError('Erro ao buscar fotos.')
    }
  }

  function toggle(photoId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) {
        next.delete(photoId)
      } else {
        next.add(photoId)
      }
      return next
    })
  }

  if (!consented) {
    return (
      <div>
        <p>Para achar suas fotos, vamos processar uma selfie sua apenas para comparação facial neste evento. Os dados são processados em servidor próprio da Orca Mídias e removidos após 120 dias.</p>
        <button onClick={() => setConsented(true)}>Concordo, continuar</button>
      </div>
    )
  }

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="user"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {error && <p role="alert">{error}</p>}
      {results && <PhotoGrid photos={results} selected={selected} onToggle={toggle} />}
    </div>
  )
}
