import { notFound } from 'next/navigation'
import { SelfieUploader } from '@/components/SelfieUploader'
import { BrandHeader } from '@/components/BrandHeader'
import { EventBanner } from '@/components/EventBanner'
import { SiteFooter } from '@/components/SiteFooter'
import { supabaseAdmin } from '@/lib/supabaseClient'

// Without this, Next.js treats this route as static-if-possible (it only
// auto-detects dynamism from native fetch(), not from the Supabase client
// library) and caches the rendered page indefinitely — a deleted or
// recreated event would keep serving a stale eventId to the checkout flow.
export const dynamic = 'force-dynamic'

export default async function EventPage({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin()
  const { data: event } = await db.from('events').select('id, name').eq('slug', params.slug).single()

  if (!event) {
    notFound()
  }

  return (
    <>
      <BrandHeader />
      <EventBanner eventName={event.name} />
      <main className="py-8">
        <SelfieUploader slug={params.slug} eventId={event.id} />
      </main>
      <SiteFooter />
    </>
  )
}
