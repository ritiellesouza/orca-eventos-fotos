import sharp from 'sharp'

const MAX_DIMENSION = 800

export async function generatePreview(original: Buffer, watermarkText: string): Promise<Buffer> {
  const originalMeta = await sharp(original).metadata()
  const originalWidth = originalMeta.width ?? MAX_DIMENSION
  const originalHeight = originalMeta.height ?? MAX_DIMENSION

  // Calculate resize dimensions maintaining aspect ratio
  let width: number
  let height: number

  if (originalWidth > originalHeight) {
    width = Math.min(originalWidth, MAX_DIMENSION)
    height = Math.round((width * originalHeight) / originalWidth)
  } else {
    height = Math.min(originalHeight, MAX_DIMENSION)
    width = Math.round((height * originalWidth) / originalHeight)
  }

  const watermarkSvg = Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .wm { fill: rgba(255,255,255,0.35); font-size: 22px; font-family: sans-serif; }
      </style>
      ${Array.from({ length: 6 }).map((_, row) =>
        Array.from({ length: 4 }).map((_, col) =>
          `<text class="wm" x="${col * (width / 3)}" y="${row * (height / 5) + 20}" transform="rotate(-30 ${col * (width / 3)},${row * (height / 5) + 20})">${watermarkText}</text>`
        ).join('')
      ).join('')}
    </svg>
  `)

  return sharp(original)
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .composite([{ input: watermarkSvg, blend: 'over' }])
    .jpeg({ quality: 70 })
    .toBuffer()
}
