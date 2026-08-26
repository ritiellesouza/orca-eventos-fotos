import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { searchBySelfie, SIMILARITY_THRESHOLD, MAX_RESULTS } from '@/lib/search'
import { embedImage } from '@/lib/faceService'

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const db = supabaseAdmin()

  const { data: event, error: eventError } = await db
    .from('events')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  const formData = await request.formData()
  const selfieFile = formData.get('selfie') as File | null
  if (!selfieFile) {
    return NextResponse.json({ error: 'selfie_required' }, { status: 400 })
  }

  await db.from('consents').insert({
    event_id: event.id,
    ip_address: request.headers.get('x-forwarded-for'),
  })

  const selfieBuffer = Buffer.from(await selfieFile.arrayBuffer())

  try {
    const matches = await searchBySelfie(
      {
        embedImage,
        matchFaces: async (embedding, eventId) => {
          const { data, error } = await db.rpc('match_faces', {
            query_embedding: embedding,
            p_event_id: eventId,
            match_threshold: SIMILARITY_THRESHOLD,
            match_count: MAX_RESULTS,
          })
          if (error) throw new Error(error.message)
          return data.map((row: { photo_id: string; similarity: number }) => ({
            photoId: row.photo_id,
            similarity: row.similarity,
          }))
        },
      },
      event.id,
      selfieBuffer
    )

    const photoIds = matches.map((m) => m.photoId)
    const { data: photos } = await db.from('photos').select('id, storage_key_preview').in('id', photoIds)

    const results = matches.map((m) => ({
      photoId: m.photoId,
      previewUrl: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${photos?.find((p) => p.id === m.photoId)?.storage_key_preview}`,
    }))

    return NextResponse.json({ results })
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_FACE_DETECTED') {
      return NextResponse.json({ error: 'no_face_detected' }, { status: 400 })
    }
    throw err
  }
}
