import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { processPhotoUpload, type PhotoUploadDeps } from '@/lib/photoUpload'
import { generatePreview } from '@/lib/imagePipeline'
import { uploadObject } from '@/lib/storage'
import { embedImage } from '@/lib/faceService'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const eventId = params.id
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

  const uploaded = []
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await processPhotoUpload(deps, eventId, file.name, buffer)
    uploaded.push(result)
  }

  return NextResponse.json({ uploaded })
}
