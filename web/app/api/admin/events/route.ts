import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

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
