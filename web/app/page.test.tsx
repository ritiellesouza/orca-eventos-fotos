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
    expect(screen.getByText(/encontre suas fotos/i)).toBeTruthy()
  })

  it('links to the Orca Mídias Instagram', () => {
    render(<HomePage />)
    const instagramLink = screen.getByRole('link', { name: /instagram/i })
    expect(instagramLink.getAttribute('href')).toContain('instagram.com')
  })
})
