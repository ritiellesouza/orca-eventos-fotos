import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { uploadObject, getSignedDownloadUrl } from './storage'

const s3Mock = mockClient(S3Client)

beforeEach(() => {
  s3Mock.reset()
  // Set environment variables for testing
  process.env.R2_ACCOUNT_ID = 'test-account'
  process.env.R2_ACCESS_KEY_ID = 'test-key'
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
  process.env.R2_BUCKET_PREVIEWS = 'test-previews'
  process.env.R2_BUCKET_ORIGINALS = 'test-originals'
})

describe('uploadObject', () => {
  it('sends a PutObjectCommand with the given key, body and content type', async () => {
    s3Mock.on(PutObjectCommand).resolves({})

    await uploadObject('previews', 'previews/evt1/photo1.jpg', Buffer.from('data'), 'image/jpeg')

    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input.Key).toBe('previews/evt1/photo1.jpg')
    expect(calls[0].args[0].input.ContentType).toBe('image/jpeg')
  })

  it('writes previews to the public bucket and originals to the private one', async () => {
    s3Mock.on(PutObjectCommand).resolves({})

    await uploadObject('previews', 'previews/evt1/photo1.jpg', Buffer.from('preview'), 'image/jpeg')
    await uploadObject('originals', 'originais/evt1/photo1.jpg', Buffer.from('original'), 'image/jpeg')

    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls[0].args[0].input.Bucket).toBe('test-previews')
    expect(calls[1].args[0].input.Bucket).toBe('test-originals')
  })

  it('throws naming the variable when a bucket env var is missing', async () => {
    delete process.env.R2_BUCKET_ORIGINALS
    s3Mock.on(PutObjectCommand).resolves({})

    await expect(
      uploadObject('originals', 'originais/evt1/photo1.jpg', Buffer.from('x'), 'image/jpeg')
    ).rejects.toThrow('Missing required environment variable: R2_BUCKET_ORIGINALS')
  })
})

describe('getSignedDownloadUrl', () => {
  it('returns a URL string for the given key', async () => {
    s3Mock.on(GetObjectCommand).resolves({})

    const url = await getSignedDownloadUrl('originals', 'originais/evt1/photo1.jpg', 3600)
    expect(url).toContain('originais/evt1/photo1.jpg')
  })

  it('signs against the originals bucket', async () => {
    s3Mock.on(GetObjectCommand).resolves({})

    const url = await getSignedDownloadUrl('originals', 'originais/evt1/photo1.jpg', 3600)
    expect(url).toContain('test-originals')
  })

  it('honors the expirySeconds parameter in the signed URL', async () => {
    s3Mock.on(GetObjectCommand).resolves({})

    const url = await getSignedDownloadUrl('originals', 'originais/evt1/photo1.jpg', 3600)
    expect(url).toContain('X-Amz-Expires=3600')
  })

  it('generates different signed URLs for different expiry times', async () => {
    s3Mock.on(GetObjectCommand).resolves({})

    const url1h = await getSignedDownloadUrl('originals', 'originais/evt1/photo1.jpg', 3600)
    const url24h = await getSignedDownloadUrl('originals', 'originais/evt1/photo1.jpg', 86400)

    expect(url1h).toContain('X-Amz-Expires=3600')
    expect(url24h).toContain('X-Amz-Expires=86400')
  })

  it('throws naming the variable when R2_ACCOUNT_ID is missing', async () => {
    delete process.env.R2_ACCOUNT_ID
    s3Mock.on(GetObjectCommand).resolves({})

    await expect(
      getSignedDownloadUrl('originals', 'originais/evt1/photo1.jpg', 3600)
    ).rejects.toThrow('Missing required environment variable: R2_ACCOUNT_ID')
  })
})
