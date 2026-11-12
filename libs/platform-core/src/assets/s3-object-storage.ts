import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  assertSafeObjectKey,
  ObjectStorageError,
  type ObjectStorage,
  type PutObjectOptions,
  type SignedOperation,
  type StoredObject,
} from './object-storage'

export interface S3StorageOptions {
  bucket: string
  region: string
  endpoint?: string
  forcePathStyle?: boolean
  accessKeyId?: string
  secretAccessKey?: string
}

function streamToBuffer(stream: unknown): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const readable = stream as NodeJS.ReadableStream
    readable.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    readable.on('end', () => resolve(Buffer.concat(chunks)))
    readable.on('error', reject)
  })
}

/**
 * S3 兼容存储（AWS S3 / MinIO / OSS / COS）。
 * 凭证由 secretRef 解析后传入，不落数据库、不回显。
 */
export class S3ObjectStorage implements ObjectStorage {
  readonly provider = 's3'
  private readonly client: S3Client
  private readonly bucket: string

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            }
          : undefined,
    })
  }

  async put(key: string, body: Buffer, options: PutObjectOptions = {}): Promise<StoredObject> {
    assertSafeObjectKey(key)
    try {
      const result = await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType,
          Metadata: options.metadata,
        }),
      )
      return {
        key,
        size: body.length,
        contentType: options.contentType,
        checksum: result.ETag?.replace(/"/g, ''),
        lastModified: new Date(),
      }
    } catch (error) {
      throw new ObjectStorageError(`S3 写入失败：${(error as Error).message}`, 'io-error')
    }
  }

  async get(key: string): Promise<Buffer> {
    assertSafeObjectKey(key)
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      )
      if (!result.Body) throw new Error('empty body')
      return streamToBuffer(result.Body)
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey') {
        throw new ObjectStorageError(`对象不存在：${key}`, 'not-found')
      }
      throw new ObjectStorageError(`S3 读取失败：${(error as Error).message}`, 'io-error')
    }
  }

  async getRange(key: string, start: number, end: number): Promise<Buffer> {
    assertSafeObjectKey(key)
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=${Math.max(0, start)}-${Math.max(0, end)}`,
        }),
      )
      if (!result.Body) return Buffer.alloc(0)
      return streamToBuffer(result.Body)
    } catch (error) {
      throw new ObjectStorageError(`S3 Range 读取失败：${(error as Error).message}`, 'io-error')
    }
  }

  async head(key: string): Promise<StoredObject | null> {
    assertSafeObjectKey(key)
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      )
      return {
        key,
        size: Number(result.ContentLength ?? 0),
        contentType: result.ContentType,
        checksum: result.ETag?.replace(/"/g, ''),
        lastModified: result.LastModified,
      }
    } catch (error) {
      if (['NotFound', 'NoSuchKey'].includes((error as { name?: string }).name ?? '')) {
        return null
      }
      throw new ObjectStorageError(`S3 head 失败：${(error as Error).message}`, 'io-error')
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeObjectKey(key)
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      )
    } catch (error) {
      throw new ObjectStorageError(`S3 删除失败：${(error as Error).message}`, 'io-error')
    }
  }

  async signedUrl(
    key: string,
    operation: SignedOperation,
    ttlSeconds: number,
  ): Promise<string> {
    assertSafeObjectKey(key)
    const command =
      operation === 'write'
        ? new PutObjectCommand({ Bucket: this.bucket, Key: key })
        : new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, {
      expiresIn: Math.max(1, Math.min(604800, Math.floor(ttlSeconds))),
    })
  }

  async createMultipartUpload(
    key: string,
    contentType?: string,
  ): Promise<{ uploadId: string }> {
    assertSafeObjectKey(key)
    const result = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
    )
    if (!result.UploadId) throw new ObjectStorageError('S3 multipart 未返回 uploadId', 'io-error')
    return { uploadId: result.UploadId }
  }

  async signedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    ttlSeconds: number,
  ): Promise<string> {
    assertSafeObjectKey(key)
    return getSignedUrl(
      this.client,
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: Math.max(1, Math.min(604800, Math.floor(ttlSeconds))) },
    )
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<StoredObject> {
    assertSafeObjectKey(key)
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        },
      }),
    )
    const head = await this.head(key)
    if (!head) throw new ObjectStorageError('S3 multipart 完成后 head 失败', 'io-error')
    return head
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    assertSafeObjectKey(key)
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    )
  }
}
