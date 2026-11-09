export interface StoredObject {
  key: string
  size: number
  contentType?: string
  checksum?: string
  lastModified?: Date
}

export interface PutObjectOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export type SignedOperation = 'read' | 'write'

/**
 * 对象存储抽象：本地开发 / S3 兼容 / OSS / MinIO 实现同一接口。
 * key 由调用方按 `org/<organizationId>/...` 组织；实现必须拒绝路径穿越。
 */
export interface ObjectStorage {
  put(key: string, body: Buffer, options?: PutObjectOptions): Promise<StoredObject>
  get(key: string): Promise<Buffer>
  head(key: string): Promise<StoredObject | null>
  delete(key: string): Promise<void>
  signedUrl(key: string, operation: SignedOperation, ttlSeconds: number): Promise<string>
}

export class ObjectStorageError extends Error {
  constructor(
    message: string,
    readonly reason: 'invalid-key' | 'not-found' | 'io-error',
  ) {
    super(message)
    this.name = 'ObjectStorageError'
  }
}

export function assertSafeObjectKey(key: string): string {
  if (!key || key.startsWith('/') || key.includes('\\')) {
    throw new ObjectStorageError(`非法对象 key：${key}`, 'invalid-key')
  }
  const segments = key.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new ObjectStorageError(`非法对象 key：${key}`, 'invalid-key')
  }
  return key
}
