import { requireEnv } from './env'

export type Face = { bbox: number[]; embedding: number[] }

export const EMBEDDING_DIMENSIONS = 512

// These embeddings go straight into a vector(512) column, and a malformed
// bbox/embedding would surface as an opaque Postgres error at insert time (or,
// worse, as a silently wrong search). Validate the shape at the boundary.
export function parseFaces(payload: unknown): Face[] {
  const faces = (payload as { faces?: unknown } | null)?.faces

  if (!Array.isArray(faces)) {
    throw new Error('FACE_SERVICE_INVALID_RESPONSE: expected `faces` to be an array')
  }

  return faces.map((face, index) => {
    const candidate = face as { bbox?: unknown; embedding?: unknown } | null

    if (!Array.isArray(candidate?.bbox)) {
      throw new Error(`FACE_SERVICE_INVALID_RESPONSE: face ${index} has no bbox array`)
    }

    if (!Array.isArray(candidate?.embedding) || candidate.embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `FACE_SERVICE_INVALID_RESPONSE: face ${index} embedding must have ${EMBEDDING_DIMENSIONS} dimensions`
      )
    }

    return { bbox: candidate.bbox as number[], embedding: candidate.embedding as number[] }
  })
}

export async function embedImage(imageBuffer: Buffer): Promise<Face[]> {
  const form = new FormData()
  form.append('image', new Blob([new Uint8Array(imageBuffer)]), 'image.jpg')

  const response = await fetch(`${requireEnv('FACE_SERVICE_URL')}/embed`, {
    method: 'POST',
    headers: { 'X-Face-Service-Token': requireEnv('FACE_SERVICE_TOKEN') },
    body: form,
  })

  if (!response.ok) {
    throw new Error(`face-service returned ${response.status}`)
  }

  return parseFaces(await response.json())
}
