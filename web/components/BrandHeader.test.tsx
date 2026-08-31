import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrandHeader } from './BrandHeader'

describe('BrandHeader', () => {
  it('renders the Orca Mídias logo', () => {
    render(<BrandHeader />)
    const logo = screen.getByAltText('Orca Mídias')
    expect(logo).toBeTruthy()
    expect(logo.tagName).toBe('IMG')
  })

  it('links the logo back to the home page', () => {
    render(<BrandHeader />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/')
  })
})
