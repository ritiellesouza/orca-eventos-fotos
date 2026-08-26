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
  process.env.R2_BUCKET = 'test-bucket'
})

describe('uploadObject', () => {
  it('sends a PutObjectCommand with the given key, body and content type', async () => {
    s3Mock.on(PutObjectCommand).resolves({})

    await uploadObject('previews/evt1/photo1.jpg', Buffer.from('data'), 'image/jpeg')

    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input.Key).toBe('previews/evt1/photo1.jpg')
    expect(calls[0].args[0].input.ContentType).toBe('image/jpeg')
  })
})

describe('getSignedDownloadUrl', () => {
  it('returns a URL string for the given key', async () => {
    s3Mock.on(GetObjectCommand).resolves({})

    const url = await getSignedDownloadUrl('originais/evt1/photo1.jpg', 3600)
    expect(url).toContain('originais/evt1/photo1.jpg')
  })
})
