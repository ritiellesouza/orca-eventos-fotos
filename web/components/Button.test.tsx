import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders the primary variant with the brand background by default', () => {
    render(<Button>Entrar</Button>)
    const button = screen.getByRole('button', { name: 'Entrar' })
    expect(button.className).toContain('bg-orca-verde-agua')
  })

  it('renders the secondary variant with an outline style', () => {
    render(<Button variant="secondary">Cancelar</Button>)
    const button = screen.getByRole('button', { name: 'Cancelar' })
    expect(button.className).toContain('border-orca-verde-agua')
    expect(button.className).not.toContain('bg-orca-verde-agua')
  })

  it('renders the destructive variant with a plain red background', () => {
    render(<Button variant="destructive">Apagar</Button>)
    const button = screen.getByRole('button', { name: 'Apagar' })
    expect(button.className).toContain('bg-red-700')
    expect(button.className).not.toContain('bg-orca-verde-agua')
  })

  it('forwards standard button props (type, disabled)', () => {
    render(
      <Button type="submit" disabled>
        Enviar
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement
    expect(button.type).toBe('submit')
    expect(button.disabled).toBe(true)
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Clique</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Clique' }))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('merges a caller-provided className instead of overwriting the base styles', () => {
    render(<Button className="w-full">Largo</Button>)
    const button = screen.getByRole('button', { name: 'Largo' })
    expect(button.className).toContain('w-full')
    expect(button.className).toContain('bg-orca-verde-agua')
  })
})
