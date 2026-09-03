import type { embedImage } from './faceService'

export type SearchDeps = {
  embedImage: typeof embedImage
  matchFaces: (embedding: number[], eventId: string) => Promise<{ photoId: string; similarity: number }[]>
}

export const SIMILARITY_THRESHOLD = 0.55
export const MAX_RESULTS = 200

export async function searchBySelfie(
  deps: SearchDeps,
  eventId: string,
  selfie: Buffer
): Promise<{ photoId: string; similarity: number }[]> {
  const faces = await deps.embedImage(selfie)

  if (faces.length === 0) {
    throw new Error('NO_FACE_DETECTED')
  }

  return deps.matchFaces(faces[0].embedding, eventId)
}
