export function SiteFooter() {
  return (
    <footer className="bg-orca-azul-escuro text-white mt-12 py-8">
      <div className="max-w-4xl mx-auto px-4 text-center space-y-2">
        <p className="font-extrabold">Orca Mídias</p>
        <p className="text-sm text-white/80">CNPJ 53.731.640/0001-38 · Mairiporã - SP</p>
        <p className="text-sm">
          <a href="mailto:contato@orcamidias.com" className="underline hover:text-orca-verde-agua">
            contato@orcamidias.com
          </a>
          {' · '}
          <a
            href="https://instagram.com/orcamidias"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-orca-verde-agua"
          >
            @orcamidias
          </a>
        </p>
      </div>
    </footer>
  )
}
