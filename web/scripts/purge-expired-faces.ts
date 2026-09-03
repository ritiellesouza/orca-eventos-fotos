export type PurgeDeps = {
  deleteFacesOlderThan: (cutoff: Date) => Promise<number>
  deleteConsentsOlderThan: (cutoff: Date) => Promise<number>
}

export async function purgeExpiredFaces(
  deps: PurgeDeps,
  now: Date,
  retentionDays: number
): Promise<{ purgedFaces: number; purgedConsents: number }> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)

  const purgedFaces = await deps.deleteFacesOlderThan(cutoff)
  const purgedConsents = await deps.deleteConsentsOlderThan(cutoff)

  return { purgedFaces, purgedConsents }
}

if (require.main === module) {
  const { supabaseAdmin } = require('../lib/supabaseClient')
  const db = supabaseAdmin()

  purgeExpiredFaces(
    {
      deleteFacesOlderThan: async (cutoff) => {
        const { data, error } = await db.from('faces').delete().lt('created_at', cutoff.toISOString()).select('id')
        if (error) throw new Error(error.message)
        return data?.length ?? 0
      },
      deleteConsentsOlderThan: async (cutoff) => {
        const { data, error } = await db.from('consents').delete().lt('consented_at', cutoff.toISOString()).select('id')
        if (error) throw new Error(error.message)
        return data?.length ?? 0
      },
    },
    new Date(),
    Number(process.env.FACE_RETENTION_DAYS ?? 120)
  ).then((result: { purgedFaces: number; purgedConsents: number }) =>
    console.log(`Purged ${result.purgedFaces} faces, ${result.purgedConsents} consents`)
  )
}
