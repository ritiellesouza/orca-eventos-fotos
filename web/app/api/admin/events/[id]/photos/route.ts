import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { processPhotoUpload, type PhotoUploadDeps } from '@/lib/photoUpload'
import { generatePreview } from '@/lib/imagePipeline'
import { uploadObject } from '@/lib/storage'
import { embedImage } from '@/lib/faceService'
import { isUuid } from '@/lib/validation'

// Strip any client-controlled path segments and characters outside a safe
// allowlist before the filename is used to build R2 storage keys
// (`previews/${eventId}/${filename}`, `originais/${eventId}/${filename}`).
// Without this, a filename like `../../secret.jpg` could escape the
// intended key prefix.
function sanitizeFilename(name: string): string {
  const basename = name.split(/[\\/]/).pop() ?? name
  const cleaned = basename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '')
  return cleaned || 'file'
}

type UploadSuccess = { filename: string; id: string; hasFace: boolean }
type UploadFailure = { filename: string; error: string }

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const eventId = params.id

  // eventId is interpolated straight into R2 storage keys by processPhotoUpload.
  if (!isUuid(eventId)) {
    return NextResponse.json({ error: 'invalid_event_id' }, { status: 400 })
  }

  const formData = await request.formData()
  const files = formData.getAll('photos') as File[]

  const db = supabaseAdmin()
  const deps: PhotoUploadDeps = {
    generatePreview,
    uploadObject,
    embedImage,
    insertPhoto: async (row) => {
      const { data, error } = await db
        .from('photos')
        .insert({
          event_id: row.eventId,
          storage_key_preview: row.storageKeyPreview,
          storage_key_original: row.storageKeyOriginal,
          has_face: row.hasFace,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { id: data.id }
    },
    insertFaces: async (photoId, faces) => {
      const { error } = await db.from('faces').insert(
        faces.map((f) => ({ photo_id: photoId, embedding: f.embedding, bbox: f.bbox }))
      )
      if (error) throw new Error(error.message)
    },
  }

  const uploaded: UploadSuccess[] = []
  const failed: UploadFailure[] = []

  for (const file of files) {
    const safeFilename = sanitizeFilename(file.name)
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await processPhotoUpload(deps, eventId, safeFilename, buffer)
      uploaded.push({ filename: safeFilename, id: result.id, hasFace: result.hasFace })
    } catch (err) {
      failed.push({
        filename: safeFilename,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ uploaded, failed })
}
