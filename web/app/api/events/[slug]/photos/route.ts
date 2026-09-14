import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { requireEnv } from '@/lib/env'
import { createRateLimiter } from '@/lib/rateLimit'

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
}

// Read-only listing of already-public preview images -- much cheaper than the
// selfie-search route (no face inference), but still anonymous and worth a
// light brake against someone scripting through every page rapidly.
function createLimiter() {
  return createRateLimiter(60, 60_000)
}

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const ip = clientIp(request)
  const limiter = createLimiter()

  if (!limiter.allow(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0)
  const requestedLimit = Number(searchParams.get('limit')) || DEFAULT_LIMIT
  const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT)

  const db = supabaseAdmin()

  const { data: event, error: eventError } = await db
    .from('events')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  // Fetch one extra row to know whether there's a next page without a second
  // count query -- trimmed back to `limit` before it reaches the response.
  const { data: photos, error: photosError } = await db
    .from('photos')
    .select('id, storage_key_preview')
    .eq('event_id', event.id)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit)

  if (photosError) {
    return NextResponse.json({ error: 'photo_lookup_failed' }, { status: 500 })
  }

  const rows = photos ?? []
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows

  const publicBase = requireEnv('NEXT_PUBLIC_R2_PUBLIC_URL')
  const results = pageRows.map((photo: { id: string; storage_key_preview: string }) => ({
    photoId: photo.id,
    previewUrl: `${publicBase}/${photo.storage_key_preview}`,
  }))

  return NextResponse.json({ results, hasMore })
}
