'use client'

import { Button } from './Button'
import { formatTotalBRL } from '@/lib/pricing'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CheckoutBar({
  selectedCount,
  unitPriceCents,
  email,
  onEmailChange,
  onCheckout,
  checkoutInFlight,
  checkoutError,
}: {
  selectedCount: number
  unitPriceCents: number | null
  email: string
  onEmailChange: (email: string) => void
  onCheckout: () => void
  checkoutInFlight: boolean
  checkoutError: string | null
}) {
  if (selectedCount === 0) {
    return null
  }

  const emailIsValid = EMAIL_PATTERN.test(email)

  return (
    <div className="sticky bottom-0 bg-white border-t border-orca-dourado/30 mt-4 p-4">
      <p className="mb-2">
        {selectedCount} {selectedCount === 1 ? 'foto selecionada' : 'fotos selecionadas'}
        {unitPriceCents !== null && <> · {formatTotalBRL(unitPriceCents, selectedCount)}</>}
      </p>
      <label htmlFor="buyer-email" className="block mb-1">
        Seu e-mail
      </label>
      <input
        id="buyer-email"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="voce@exemplo.com"
        className="border rounded px-3 py-2 mb-3 w-full max-w-sm"
      />
      <Button onClick={onCheckout} disabled={!emailIsValid || checkoutInFlight}>
        Comprar
      </Button>
      {checkoutError && (
        <p role="alert" className="text-red-700 mt-2">
          {checkoutError}
        </p>
      )}
    </div>
  )
}
