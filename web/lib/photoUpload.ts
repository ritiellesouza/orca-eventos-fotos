import type { generatePreview } from './imagePipeline'
import type { uploadObject } from './storage'
import type { embedImage } from './faceService'

export type PhotoUploadDeps = {
  generatePreview: typeof generatePreview
  uploadObject: typeof uploadObject
  embedImage: typeof embedImage
  insertPhoto: (row: {
    eventId: string
    storageKeyPreview: string
    storageKeyOriginal: string
    hasFace: boolean
  }) => Promise<{ id: string }>
  insertFaces: (photoId: string, faces: { bbox: number[]; embedding: number[] }[]) => Promise<void>
}

export type PhotoRecord = { id: string; hasFace: boolean }

export async function processPhotoUpload(
  deps: PhotoUploadDeps,
  eventId: string,
  filename: string,
  original: Buffer
): Promise<PhotoRecord> {
  const previewKey = `previews/${eventId}/${filename}`
  const originalKey = `originais/${eventId}/${filename}`

  const preview = await deps.generatePreview(original, 'Orca Mídias')
  // The watermarked preview goes to the public bucket; the original must land
  // in the private one or it would be downloadable without paying.
  await deps.uploadObject('previews', previewKey, preview, 'image/jpeg')
  await deps.uploadObject('originals', originalKey, original, 'image/jpeg')

  const faces = await deps.embedImage(original)
  const hasFace = faces.length > 0

  const photo = await deps.insertPhoto({
    eventId,
    storageKeyPreview: previewKey,
    storageKeyOriginal: originalKey,
    hasFace,
  })

  if (hasFace) {
    await deps.insertFaces(photo.id, faces)
  }

  return { id: photo.id, hasFace }
}
