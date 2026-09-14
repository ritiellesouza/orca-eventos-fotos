import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckoutBar } from './CheckoutBar'

function renderBar(overrides: Partial<React.ComponentProps<typeof CheckoutBar>> = {}) {
  const props = {
    selectedCount: 1,
    unitPriceCents: null as number | null,
    email: '',
    onEmailChange: vi.fn(),
    onCheckout: vi.fn(),
    checkoutInFlight: false,
    checkoutError: null as string | null,
    ...overrides,
  }
  render(<CheckoutBar {...props} />)
  return props
}

describe('CheckoutBar', () => {
  it('renders nothing when nothing is selected', () => {
    const { container } = render(
      <CheckoutBar
        selectedCount={0}
        unitPriceCents={null}
        email=""
        onEmailChange={() => {}}
        onCheckout={() => {}}
        checkoutInFlight={false}
        checkoutError={null}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the count and total when a price is set', () => {
    renderBar({ selectedCount: 1, unitPriceCents: 1500 })
    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()
    expect(screen.getByText(/R\$\s*15,00/)).toBeTruthy()
  })

  it('pluralizes for more than one photo', () => {
    renderBar({ selectedCount: 2, unitPriceCents: 1500 })
    expect(screen.getByText(/2 fotos selecionadas/i)).toBeTruthy()
    expect(screen.getByText(/R\$\s*30,00/)).toBeTruthy()
  })

  it('shows the count without a total when the price is null', () => {
    renderBar({ selectedCount: 1, unitPriceCents: null })
    expect(screen.getByText(/1 foto selecionada/i)).toBeTruthy()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('disables the buy button until the email looks valid', () => {
    renderBar({ selectedCount: 1, email: 'nao-e-email' })
    const buyButton = screen.getByRole('button', { name: /comprar/i }) as HTMLButtonElement
    expect(buyButton.disabled).toBe(true)
  })

  it('enables the buy button with a valid email and calls onCheckout when clicked', () => {
    const onCheckout = vi.fn()
    renderBar({ selectedCount: 1, email: 'comprador@example.com', onCheckout })

    const buyButton = screen.getByRole('button', { name: /comprar/i }) as HTMLButtonElement
    expect(buyButton.disabled).toBe(false)

    fireEvent.click(buyButton)
    expect(onCheckout).toHaveBeenCalledTimes(1)
  })

  it('disables the buy button while checkout is in flight', () => {
    renderBar({ selectedCount: 1, email: 'comprador@example.com', checkoutInFlight: true })
    const buyButton = screen.getByRole('button', { name: /comprar/i }) as HTMLButtonElement
    expect(buyButton.disabled).toBe(true)
  })

  it('calls onEmailChange when the email input changes', () => {
    const onEmailChange = vi.fn()
    renderBar({ onEmailChange })

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'x@y.com' } })
    expect(onEmailChange).toHaveBeenCalledWith('x@y.com')
  })

  it('shows the checkout error message next to the buy button', () => {
    renderBar({
      selectedCount: 1,
      email: 'comprador@example.com',
      checkoutError: 'Erro ao iniciar pagamento. Tente novamente.',
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/erro ao iniciar pagamento/i)
    const buyButton = screen.getByRole('button', { name: /comprar/i })
    expect(alert.parentElement).toBe(buyButton.parentElement)
  })
})
