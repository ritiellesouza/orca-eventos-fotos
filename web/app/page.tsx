import { BrandHeader } from '@/components/BrandHeader'

export default function HomePage() {
  return (
    <>
      <BrandHeader />
      <main className="max-w-2xl mx-auto p-4 text-center py-16">
        <h1 className="text-3xl font-extrabold text-orca-azul-escuro mb-4">
          Encontre suas fotos de evento
        </h1>
        <p className="text-lg mb-2">
          A Orca Mídias fotografa seu evento e usa reconhecimento facial para
          você achar suas fotos em segundos — sem precisar procurar.
        </p>
        <p className="font-caveat text-2xl text-orca-dourado mb-8">
          Você recebeu o link do seu evento? É só abrir e tirar uma selfie.
        </p>
        <p>
          <a
            href="https://instagram.com/orcamidias"
            className="text-orca-royal underline"
            target="_blank"
            rel="noreferrer"
          >
            Siga a Orca Mídias no Instagram
          </a>
        </p>
      </main>
    </>
  )
}
