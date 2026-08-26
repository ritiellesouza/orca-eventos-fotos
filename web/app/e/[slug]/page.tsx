import { SelfieUploader } from '@/components/SelfieUploader'

export default function EventPage({ params }: { params: { slug: string } }) {
  return (
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Encontre suas fotos</h1>
      <SelfieUploader slug={params.slug} />
    </main>
  )
}
