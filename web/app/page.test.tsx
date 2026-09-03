import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'

describe('HomePage', () => {
  it('renders the brand header', () => {
    render(<HomePage />)
    expect(screen.getByAltText('Orca Mídias')).toBeTruthy()
  })

  it('explains what the product does', () => {
    render(<HomePage />)
    expect(screen.getByText(/sem precisar procurar/i)).toBeTruthy()
  })

  it('links to the Orca Mídias Instagram', () => {
    render(<HomePage />)
    const instagramLink = screen.getByRole('link', { name: /instagram/i })
    expect(instagramLink.getAttribute('href')).toContain('instagram.com')
  })

  it('explains how the platform works in three steps', () => {
    render(<HomePage />)

    expect(screen.getByText(/como funciona/i)).toBeTruthy()
    expect(screen.getByText(/envie uma selfie e encontre suas fotos/i)).toBeTruthy()
  })

  it('renders the site footer with the company CNPJ', () => {
    render(<HomePage />)

    expect(screen.getByText(/53\.731\.640\/0001-38/)).toBeTruthy()
  })
})
