import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhotoGrid } from './PhotoGrid'

describe('PhotoGrid checkbox indicator', () => {
  const photos = [{ photoId: 'photo-1', previewUrl: 'https://example.com/p1.jpg' }]

  it('shows an unchecked indicator when the photo is not selected', () => {
    render(<PhotoGrid photos={photos} selected={new Set()} onToggle={() => {}} />)

    const button = screen.getByAltText(/foto 1/i).closest('button')!
    const indicator = button.querySelector('[data-testid="photo-checkbox"]')!

    expect(indicator.className).not.toContain('bg-orca-verde-agua')
  })

  it('shows a checked indicator when the photo is selected', () => {
    render(<PhotoGrid photos={photos} selected={new Set(['photo-1'])} onToggle={() => {}} />)

    const button = screen.getByAltText(/foto 1 \(selecionada\)/i).closest('button')!
    const indicator = button.querySelector('[data-testid="photo-checkbox"]')!

    expect(indicator.className).toContain('bg-orca-verde-agua')
  })
})
