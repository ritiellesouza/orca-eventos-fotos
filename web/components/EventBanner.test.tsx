import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventBanner } from './EventBanner'

describe('EventBanner', () => {
  it('renders the event name it receives', () => {
    render(<EventBanner eventName="Festa Junina 2026" />)

    expect(screen.getByRole('heading', { name: 'Festa Junina 2026' })).toBeTruthy()
  })
})
