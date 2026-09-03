import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { isUuid } from '@/lib/validation'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'invalid_event_id' }, { status: 400 })
  }

  // A malformed/empty body must fail cleanly (400) rather than crash to a
  // generic 500 — same defensive pattern as the login route's request.json()
  // guard. Treated the same as "nothing to update".
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  const parsed = body as { name?: unknown; eventDate?: unknown } | null | undefined
  const update: { name?: string; event_date?: string } = {}
  if (typeof parsed?.name === 'string' && parsed.name.length > 0) {
    update.name = parsed.name
  }
  if (typeof parsed?.eventDate === 'string' && parsed.eventDate.length > 0) {
    update.event_date = parsed.eventDate
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  // maybeSingle (not single, unlike sibling routes) because "no row matched
  // this id" must be distinguishable from a query error, to return 404
  // rather than 500.
  const { data, error } = await supabaseAdmin()
    .from('events')
    .update(update)
    .eq('id', params.id)
    .select('id, name, slug, event_date')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  return NextResponse.json({ id: data.id, name: data.name, slug: data.slug, eventDate: data.event_date })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'invalid_event_id' }, { status: 400 })
  }

  // The events -> photos/faces/purchases foreign keys are all `on delete
  // cascade` (supabase/migrations/0001_orca_eventos_schema.sql), so this
  // single delete is sufficient at the database level. R2 objects for this
  // event's photos are NOT removed — orphaned storage cleanup is out of
  // scope for this plan (see the design doc's "itens em aberto").
  const { data, error } = await supabaseAdmin()
    .from('events')
    .delete()
    .eq('id', params.id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
