import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { searchBySelfie, SIMILARITY_THRESHOLD, MAX_RESULTS } from '@/lib/search'
import { embedImage } from '@/lib/faceService'
import { requireEnv } from '@/lib/env'
import { createRateLimiter } from '@/lib/rateLimit'

// Bump this whenever the consent copy shown in SelfieUploader changes, so a
// stored consent can be traced back to the exact text the person agreed to.
// Not exported: Next.js only allows a fixed set of named exports from a route.
const CONSENT_TEXT_VERSION = 'v1'

const MAX_SELFIE_BYTES = 10 * 1024 * 1024

// Anonymous route that triggers face inference on the shared VM.
const limiter = createRateLimiter(10, 60_000)

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const ip = clientIp(request)

  if (!limiter.allow(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  // Cheap rejection before the body is buffered into memory.
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_SELFIE_BYTES) {
    return NextResponse.json({ error: 'selfie_too_large' }, { status: 400 })
  }

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

  // LGPD: consent has to be asserted by the caller on every request. The React
  // gate in SelfieUploader is a UI affordance, not a control -- anyone can POST
  // here directly, and logging a consent row unconditionally would record that
  // a search happened, not that anyone agreed to anything.
  if (formData.get('consent') !== 'true') {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 })
  }

  const selfieFile = formData.get('selfie') as File | null
  if (!selfieFile) {
    return NextResponse.json({ error: 'selfie_required' }, { status: 400 })
  }

  if (selfieFile.size > MAX_SELFIE_BYTES) {
    return NextResponse.json({ error: 'selfie_too_large' }, { status: 400 })
  }

  const { error: consentError } = await db.from('consents').insert({
    event_id: event.id,
    ip_address: ip === 'unknown' ? null : ip,
    consent_text_version: CONSENT_TEXT_VERSION,
    user_agent: request.headers.get('user-agent'),
  })

  if (consentError) {
    return NextResponse.json({ error: 'consent_logging_failed' }, { status: 500 })
  }

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

    if (matches.length === 0) {
      return NextResponse.json({ results: [] })
    }

    const photoIds = matches.map((m) => m.photoId)
    const { data: photos, error: photosError } = await db
      .from('photos')
      .select('id, storage_key_preview')
      .in('id', photoIds)

    if (photosError) {
      return NextResponse.json({ error: 'photo_lookup_failed' }, { status: 500 })
    }

    const publicBase = requireEnv('NEXT_PUBLIC_R2_PUBLIC_URL')

    const results = matches.map((m) => ({
      photoId: m.photoId,
      previewUrl: `${publicBase}/${photos?.find((p) => p.id === m.photoId)?.storage_key_preview}`,
    }))

    return NextResponse.json({ results })
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_FACE_DETECTED') {
      return NextResponse.json({ error: 'no_face_detected' }, { status: 400 })
    }
    throw err
  }
}
