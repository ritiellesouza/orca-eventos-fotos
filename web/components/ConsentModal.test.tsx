import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConsentModal } from './ConsentModal'

describe('ConsentModal', () => {
  it('explains what happens to the selfie', () => {
    render(<ConsentModal onAgree={() => {}} onCancel={() => {}} />)

    expect(
      screen.getByText(
        /processar uma selfie sua apenas para comparação facial neste evento/i
      )
    ).toBeTruthy()
  })

  it('calls onAgree when "Estou de acordo" is clicked', () => {
    const onAgree = vi.fn()
    render(<ConsentModal onAgree={onAgree} onCancel={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /estou de acordo/i }))

    expect(onAgree).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when "Cancelar" is clicked', () => {
    const onCancel = vi.fn()
    render(<ConsentModal onAgree={() => {}} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
