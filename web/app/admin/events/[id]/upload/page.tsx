'use client'

import { useState, type DragEvent } from 'react'
import { useParams } from 'next/navigation'

type UploadResult = {
  uploaded: { filename: string; id: string; hasFace: boolean }[]
  failed: { filename: string; error: string }[]
}

export default function AdminUploadPage() {
  const params = useParams<{ id: string }>()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setFiles(Array.from(e.dataTransfer.files))
  }

  async function handleUpload() {
    setUploading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    files.forEach((file) => formData.append('photos', file))

    try {
      const response = await fetch(`/api/admin/events/${params.id}/photos`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        setError('Erro ao subir fotos.')
        return
      }

      const data: UploadResult = await response.json()
      setResult(data)
    } catch {
      setError('Erro ao subir fotos.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Subir fotos</h1>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{ border: '2px dashed #ccc', padding: '2rem', textAlign: 'center' }}
      >
        {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : 'Arraste as fotos aqui'}
      </div>
      <input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      <button onClick={handleUpload} disabled={files.length === 0 || uploading}>
        {uploading ? 'Enviando...' : `Subir ${files.length} foto(s)`}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div>
          <p>
            {result.uploaded.length} enviada(s) com sucesso, {result.failed.length} falharam.
          </p>
          {result.failed.length > 0 && (
            <ul>
              {result.failed.map((f) => (
                <li key={f.filename}>
                  {f.filename}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  )
}
