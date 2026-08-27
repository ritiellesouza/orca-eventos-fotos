import { notFound } from 'next/navigation'
import { SelfieUploader } from '@/components/SelfieUploader'
import { supabaseAdmin } from '@/lib/supabaseClient'

// Without this, Next.js treats this route as static-if-possible (it only
// auto-detects dynamism from native fetch(), not from the Supabase client
// library) and caches the rendered page indefinitely — a deleted or
// recreated event would keep serving a stale eventId to the checkout flow.
export const dynamic = 'force-dynamic'

export default async function EventPage({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin()
  const { data: event } = await db.from('events').select('id').eq('slug', params.slug).single()

  if (!event) {
    notFound()
  }

  return (
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Encontre suas fotos</h1>
      <SelfieUploader slug={params.slug} eventId={event.id} />
    </main>
  )
}
