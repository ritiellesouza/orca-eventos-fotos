import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { generatePreview } from './imagePipeline'

describe('generatePreview', () => {
  it('resizes to max 800px on the longest side', async () => {
    const original = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 100, g: 150, b: 200 } },
    }).jpeg().toBuffer()

    const preview = await generatePreview(original, 'Orca Mídias')
    const meta = await sharp(preview).metadata()

    expect(meta.width).toBe(800)
    expect(meta.height).toBe(400)
    expect(meta.format).toBe('jpeg')
  })

  it('produces a different image than a plain resize (watermark applied)', async () => {
    const original = await sharp({
      create: { width: 800, height: 800, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).jpeg().toBuffer()

    const preview = await generatePreview(original, 'Orca Mídias')
    const plainResize = await sharp(original).resize(800, 800).jpeg().toBuffer()

    expect(Buffer.compare(preview, plainResize)).not.toBe(0)
  })
})
