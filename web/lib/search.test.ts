import { describe, it, expect, vi } from 'vitest'
import { searchBySelfie, type SearchDeps } from './search'

describe('searchBySelfie', () => {
  it('embeds the selfie and returns matches from matchFaces', async () => {
    const embedding = new Array(512).fill(0.2)
    const deps: SearchDeps = {
      embedImage: vi.fn().mockResolvedValue([{ bbox: [0, 0, 1, 1], embedding }]),
      matchFaces: vi.fn().mockResolvedValue([{ photoId: 'p1', similarity: 0.91 }]),
    }

    const results = await searchBySelfie(deps, 'event-1', Buffer.from('selfie'))

    expect(deps.matchFaces).toHaveBeenCalledWith(embedding, 'event-1')
    expect(results).toEqual([{ photoId: 'p1', similarity: 0.91 }])
  })

  it('throws NO_FACE_DETECTED when the selfie has no face', async () => {
    const deps: SearchDeps = {
      embedImage: vi.fn().mockResolvedValue([]),
      matchFaces: vi.fn(),
    }

    await expect(searchBySelfie(deps, 'event-1', Buffer.from('selfie'))).rejects.toThrow('NO_FACE_DETECTED')
    expect(deps.matchFaces).not.toHaveBeenCalled()
  })
})
