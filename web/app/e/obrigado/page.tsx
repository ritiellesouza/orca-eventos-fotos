import { BrandHeader } from '@/components/BrandHeader'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getSignedDownloadUrl } from '@/lib/storage'

export default async function ObrigadoPage({ searchParams }: { searchParams: { session_id?: string } }) {
  const sessionId = searchParams.session_id
  if (!sessionId) {
    return (
      <>
        <BrandHeader />
        <p className="max-w-2xl mx-auto p-4">Sessão inválida.</p>
      </>
    )
  }

  const db = supabaseAdmin()
  const { data: purchase } = await db
    .from('purchases')
    .select('id, status')
    .eq('stripe_session_id', sessionId)
    .single()

  if (!purchase || purchase.status !== 'paid') {
    return (
      <>
        <BrandHeader />
        <p className="max-w-2xl mx-auto p-4">Pagamento ainda não confirmado. Atualize a página em instantes.</p>
      </>
    )
  }

  const { data: purchasedPhotos } = await db
    .from('purchase_photos')
    .select('photos(storage_key_original)')
    .eq('purchase_id', purchase.id)

  const links = await Promise.all(
    (purchasedPhotos ?? []).map(async (row: { photos: { storage_key_original: string } | { storage_key_original: string }[] }) => {
      const photo = Array.isArray(row.photos) ? row.photos[0] : row.photos
      return getSignedDownloadUrl('originals', photo.storage_key_original, 3600 * 6)
    })
  )

  return (
    <>
      <BrandHeader />
      <main className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-extrabold text-orca-azul-escuro mb-4">Pagamento confirmado!</h1>
        <ul className="space-y-2">
          {links.map((url, i) => (
            <li key={i}>
              <a href={url} className="text-orca-verde-agua underline font-semibold">
                Baixar foto {i + 1}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-orca-preto-marca/70 mt-4">Os links expiram em algumas horas.</p>
      </main>
    </>
  )
}
