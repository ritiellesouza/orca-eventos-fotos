import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SiteFooter } from './SiteFooter'

describe('SiteFooter', () => {
  it('renders the brand name, CNPJ, and city', () => {
    render(<SiteFooter />)

    expect(screen.getByText('Orca Mídias')).toBeTruthy()
    expect(screen.getByText(/53\.731\.640\/0001-38/)).toBeTruthy()
    expect(screen.getByText(/Mairiporã - SP/)).toBeTruthy()
  })

  it('links to the contact email', () => {
    render(<SiteFooter />)

    const link = screen.getByRole('link', { name: /contato@orcamidias\.com/i })
    expect(link.getAttribute('href')).toBe('mailto:contato@orcamidias.com')
  })

  it('links to the Instagram profile', () => {
    render(<SiteFooter />)

    const link = screen.getByRole('link', { name: /^@orcamidias$/i })
    expect(link.getAttribute('href')).toBe('https://instagram.com/orcamidias')
  })
})
