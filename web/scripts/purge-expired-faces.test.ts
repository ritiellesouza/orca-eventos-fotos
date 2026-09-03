import { describe, it, expect, vi } from 'vitest'
import { purgeExpiredFaces, type PurgeDeps } from './purge-expired-faces'

describe('purgeExpiredFaces', () => {
  it('computes the cutoff date from retentionDays and returns counts', async () => {
    const deps: PurgeDeps = {
      deleteFacesOlderThan: vi.fn().mockResolvedValue(12),
      deleteConsentsOlderThan: vi.fn().mockResolvedValue(3),
    }
    const now = new Date('2026-08-26T00:00:00Z')

    const result = await purgeExpiredFaces(deps, now, 120)

    const expectedCutoff = new Date('2026-04-28T00:00:00Z')
    expect(deps.deleteFacesOlderThan).toHaveBeenCalledWith(expectedCutoff)
    expect(deps.deleteConsentsOlderThan).toHaveBeenCalledWith(expectedCutoff)
    expect(result).toEqual({ purgedFaces: 12, purgedConsents: 3 })
  })
})
