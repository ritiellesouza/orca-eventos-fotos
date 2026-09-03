import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseFaces, embedImage, EMBEDDING_DIMENSIONS } from './faceService'

function validFace() {
  return { bbox: [0, 0, 10, 10], embedding: new Array(EMBEDDING_DIMENSIONS).fill(0.1) }
}

describe('parseFaces', () => {
  it('returns the faces when the payload is well formed', () => {
    expect(parseFaces({ faces: [validFace()] })).toEqual([validFace()])
  })

  it('accepts an empty faces array', () => {
    expect(parseFaces({ faces: [] })).toEqual([])
  })

  it('throws when faces is missing or not an array', () => {
    expect(() => parseFaces({})).toThrow('expected `faces` to be an array')
    expect(() => parseFaces(null)).toThrow('expected `faces` to be an array')
    expect(() => parseFaces({ faces: 'nope' })).toThrow('expected `faces` to be an array')
  })

  it('throws when a face has no bbox array', () => {
    expect(() => parseFaces({ faces: [{ embedding: new Array(512).fill(0) }] })).toThrow(
      'face 0 has no bbox array'
    )
  })

  it('throws when an embedding is the wrong length', () => {
    expect(() => parseFaces({ faces: [{ bbox: [0, 0, 1, 1], embedding: [0.1, 0.2] }] })).toThrow(
      'face 0 embedding must have 512 dimensions'
    )
  })

  it('names the offending face when a later entry is malformed', () => {
    expect(() => parseFaces({ faces: [validFace(), { bbox: [0, 0, 1, 1] }] })).toThrow(
      'face 1 embedding must have 512 dimensions'
    )
  })
})

describe('embedImage', () => {
  beforeEach(() => {
    process.env.FACE_SERVICE_URL = 'http://face-service.internal:8000'
    process.env.FACE_SERVICE_TOKEN = 'face-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the shared-secret header and returns the validated faces', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ faces: [validFace()] }), { status: 200 }))

    const faces = await embedImage(Buffer.from('image-bytes'))

    expect(faces).toHaveLength(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://face-service.internal:8000/embed')
    expect((init?.headers as Record<string, string>)['X-Face-Service-Token']).toBe('face-secret')
  })

  it('throws when the service rejects the request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }))

    await expect(embedImage(Buffer.from('x'))).rejects.toThrow('face-service returned 401')
  })

  it('throws when FACE_SERVICE_TOKEN is not configured', async () => {
    delete process.env.FACE_SERVICE_TOKEN

    await expect(embedImage(Buffer.from('x'))).rejects.toThrow(
      'Missing required environment variable: FACE_SERVICE_TOKEN'
    )
  })
})
