import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireEnv } from './env'

// R2 grants public read at the bucket level, never per prefix. Previews and
// unwatermarked originals therefore cannot share a bucket: the moment public
// access is enabled so previews render, `https://<public-domain>/originais/...`
// would hand out the paid original for free. Two buckets:
//   - previews  -> public, bound to NEXT_PUBLIC_R2_PUBLIC_URL
//   - originals -> private, reachable only through presigned URLs
export type R2Bucket = 'previews' | 'originals'

const BUCKET_ENV_VAR: Record<R2Bucket, string> = {
  previews: 'R2_BUCKET_PREVIEWS',
  originals: 'R2_BUCKET_ORIGINALS',
}

function bucketName(bucket: R2Bucket): string {
  return requireEnv(BUCKET_ENV_VAR[bucket])
}

function client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
}

export async function uploadObject(
  bucket: R2Bucket,
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucketName(bucket),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
}

export async function getSignedDownloadUrl(
  bucket: R2Bucket,
  key: string,
  expirySeconds: number
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucketName(bucket), Key: key })
  return getSignedUrl(client(), command, { expiresIn: expirySeconds })
}
