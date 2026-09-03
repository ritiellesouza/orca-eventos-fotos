import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CaptureModal } from './CaptureModal'

function galleryInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement
}

function cameraInput(): HTMLInputElement {
  return document.querySelector('input[type="file"][capture]') as HTMLInputElement
}

describe('CaptureModal', () => {
  it('renders both capture buttons', () => {
    render(<CaptureModal onCapture={() => {}} onCancel={() => {}} />)

    expect(screen.getByRole('button', { name: /carregar foto/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /tirar foto/i })).toBeTruthy()
  })

  it('mounts a plain file input and a capture="user" file input', () => {
    render(<CaptureModal onCapture={() => {}} onCancel={() => {}} />)

    expect(galleryInput()).toBeTruthy()
    expect(cameraInput().getAttribute('capture')).toBe('user')
  })

  it('calls onCapture with the file chosen via the gallery input', () => {
    const onCapture = vi.fn()
    render(<CaptureModal onCapture={onCapture} onCancel={() => {}} />)

    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(galleryInput(), { target: { files: [file] } })

    expect(onCapture).toHaveBeenCalledWith(file)
  })

  it('calls onCapture with the file chosen via the camera input', () => {
    const onCapture = vi.fn()
    render(<CaptureModal onCapture={onCapture} onCancel={() => {}} />)

    const file = new File(['bytes'], 'selfie.jpg', { type: 'image/jpeg' })
    fireEvent.change(cameraInput(), { target: { files: [file] } })

    expect(onCapture).toHaveBeenCalledWith(file)
  })

  it('calls onCancel when "Cancelar" is clicked', () => {
    const onCancel = vi.fn()
    render(<CaptureModal onCapture={() => {}} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
