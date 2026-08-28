import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

type EventRow = {
  id: string
  name: string
  slug: string
  event_date: string
  photos: { count: number }[]
}

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from('events')
    .select('id, name, slug, event_date, photos(count)')
    .order('event_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const events = ((data ?? []) as EventRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    eventDate: row.event_date,
    photoCount: row.photos?.[0]?.count ?? 0,
  }))

  return NextResponse.json({ events })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, slug, eventDate } = body

  if (!name || !slug || !eventDate) {
    return NextResponse.json({ error: 'name, slug and eventDate are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('events')
    .insert({ name, slug, event_date: eventDate })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(
    { id: data.id, name: data.name, slug: data.slug, eventDate: data.event_date },
    { status: 201 }
  )
}
