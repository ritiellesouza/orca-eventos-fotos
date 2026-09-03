import { BrandHeader } from '@/components/BrandHeader'
import { SiteFooter } from '@/components/SiteFooter'

const STEPS = [
  {
    title: '1. O fotógrafo sobe as fotos',
    text: 'A Orca Mídias fotografa o evento e organiza tudo na plataforma.',
  },
  {
    title: '2. Você recebe o link do seu evento',
    text: 'O organizador ou fotógrafo compartilha o link exclusivo do evento com você.',
  },
  {
    title: '3. Envie uma selfie e localize suas fotos',
    text: 'Reconhecimento facial identifica automaticamente todas as fotos com você.',
  },
]

export default function HomePage() {
  return (
    <>
      <BrandHeader />
      <main>
        <div className="max-w-2xl mx-auto p-4 text-center py-16">
          <h1 className="text-3xl font-extrabold text-orca-azul-escuro mb-4">
            Encontre suas fotos de evento
          </h1>
          <p className="text-lg mb-2">
            A Orca Mídias fotografa seu evento e usa reconhecimento facial para
            você achar suas fotos em segundos — sem precisar procurar.
          </p>
          <p className="font-caveat text-2xl text-orca-preto-marca mb-8">
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
        </div>

        <div className="bg-orca-azul-escuro/5 py-12 px-4">
          <h2 className="text-2xl font-extrabold text-orca-azul-escuro text-center mb-8">
            Como funciona
          </h2>
          <div className="max-w-4xl mx-auto grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="bg-white rounded-[15px] p-6 shadow-[3px_3px_15px_rgba(33,33,33,0.66)]"
              >
                <h3 className="font-extrabold text-orca-azul-escuro mb-2">{step.title}</h3>
                <p className="text-sm">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
