import Image from 'next/image'
import Link from 'next/link'

export function BrandHeader() {
  return (
    <header className="border-b border-orca-dourado/30 bg-white">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <Link href="/">
          <Image
            src="/logo-orca-preto-horizontal.png"
            alt="Orca Mídias"
            width={180}
            height={71}
            priority
          />
        </Link>
      </div>
    </header>
  )
}
