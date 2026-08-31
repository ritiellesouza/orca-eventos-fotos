'use client'

import { useRef, useState, type DragEvent } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { BrandHeader } from '@/components/BrandHeader'
import { Button } from '@/components/Button'

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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      // Clear the batch: `photos` has no unique constraint on the storage key,
      // so a second click on the same selection would create duplicate photo
      // rows (and duplicate face embeddings) for the same file.
      setFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch {
      setError('Erro ao subir fotos.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <BrandHeader />
      <main className="max-w-3xl mx-auto p-4">
        <Link href="/admin/events" className="text-orca-verde-agua underline">
          ← Eventos
        </Link>
        <h1 className="text-2xl font-extrabold text-orca-azul-escuro mb-4 mt-2">Subir fotos</h1>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-orca-dourado rounded-[15px] p-8 text-center mb-4 text-orca-preto-marca/70"
        >
          {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : 'Arraste as fotos aqui'}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="mb-4 block"
        />
        <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
          {uploading ? 'Enviando...' : `Subir ${files.length} foto(s)`}
        </Button>
        {error && (
          <p role="alert" className="text-red-700 mt-3">
            {error}
          </p>
        )}
        {result && (
          <div className="mt-4">
            <p>
              {result.uploaded.length} enviada(s) com sucesso, {result.failed.length} falharam.
            </p>
            {result.failed.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-red-700">
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
    </>
  )
}
