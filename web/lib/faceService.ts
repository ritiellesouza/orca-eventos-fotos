export type Face = { bbox: number[]; embedding: number[] }

export async function embedImage(imageBuffer: Buffer): Promise<Face[]> {
  const form = new FormData()
  form.append('image', new Blob([new Uint8Array(imageBuffer)]), 'image.jpg')

  const response = await fetch(`${process.env.FACE_SERVICE_URL}/embed`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error(`face-service returned ${response.status}`)
  }

  const data = await response.json()
  return data.faces
}
