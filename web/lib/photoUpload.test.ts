import { describe, it, expect, vi } from 'vitest'
import { processPhotoUpload, type PhotoUploadDeps } from './photoUpload'

function makeDeps(overrides: Partial<PhotoUploadDeps> = {}): PhotoUploadDeps {
  return {
    generatePreview: vi.fn(),
    uploadObject: vi.fn(),
    embedImage: vi.fn(),
    insertPhoto: vi.fn(),
    insertFaces: vi.fn(),
    ...overrides,
  } as unknown as PhotoUploadDeps
}

describe('processPhotoUpload', () => {
  it('uploads preview and original, indexes faces, and marks hasFace true when a face is found', async () => {
    const previewBuffer = Buffer.from('preview')
    const deps = makeDeps({
      generatePreview: vi.fn().mockResolvedValue(previewBuffer),
      uploadObject: vi.fn().mockResolvedValue(undefined),
      embedImage: vi.fn().mockResolvedValue([{ bbox: [0, 0, 10, 10], embedding: new Array(512).fill(0.1) }]),
      insertPhoto: vi.fn().mockResolvedValue({ id: 'photo-1' }),
      insertFaces: vi.fn().mockResolvedValue(undefined),
    })
    const original = Buffer.from('original-bytes')

    const result = await processPhotoUpload(deps, 'event-1', 'foto.jpg', original)

    expect(result).toEqual({ id: 'photo-1', hasFace: true })
    expect(deps.generatePreview).toHaveBeenCalledWith(original, 'Orca Mídias')
    expect(deps.uploadObject).toHaveBeenCalledWith('previews/event-1/foto.jpg', previewBuffer, 'image/jpeg')
    expect(deps.uploadObject).toHaveBeenCalledWith('originais/event-1/foto.jpg', original, 'image/jpeg')
    expect(deps.insertPhoto).toHaveBeenCalledWith({
      eventId: 'event-1',
      storageKeyPreview: 'previews/event-1/foto.jpg',
      storageKeyOriginal: 'originais/event-1/foto.jpg',
      hasFace: true,
    })
    expect(deps.insertFaces).toHaveBeenCalledWith('photo-1', [{ bbox: [0, 0, 10, 10], embedding: expect.any(Array) }])
  })

  it('marks hasFace false and skips insertFaces when no face is detected', async () => {
    const deps = makeDeps({
      generatePreview: vi.fn().mockResolvedValue(Buffer.from('preview')),
      uploadObject: vi.fn().mockResolvedValue(undefined),
      embedImage: vi.fn().mockResolvedValue([]),
      insertPhoto: vi.fn().mockResolvedValue({ id: 'photo-2' }),
      insertFaces: vi.fn().mockResolvedValue(undefined),
    })

    const result = await processPhotoUpload(deps, 'event-1', 'sem-rosto.jpg', Buffer.from('x'))

    expect(result).toEqual({ id: 'photo-2', hasFace: false })
    expect(deps.insertFaces).not.toHaveBeenCalled()
  })
})
