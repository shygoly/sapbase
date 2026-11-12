import { createHash } from 'node:crypto'
import { mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import {
  assertSafeObjectKey,
  ObjectStorageError,
  type ObjectStorage,
  type PutObjectOptions,
  type SignedOperation,
  type StoredObject,
} from './object-storage'

/**
 * 本地对象存储（开发/测试/小规模部署）。
 *
 * key 解析到 rootDir 后必须仍在 rootDir 内；任何 `..`/绝对路径/反斜杠都拒绝。
 * 生产用 S3/OSS 实现同一接口，不改变资产管道。
 */
export class LocalObjectStorage implements ObjectStorage {
  private readonly rootDir: string
  private readonly baseUrl: string

  constructor(options: { rootDir: string; baseUrl?: string }) {
    this.rootDir = resolve(options.rootDir)
    this.baseUrl = options.baseUrl ?? '/api/local-storage'
  }

  async put(key: string, body: Buffer, options: PutObjectOptions = {}): Promise<StoredObject> {
    const path = this.pathOf(key)
    try {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, body)
    } catch (error) {
      throw new ObjectStorageError(
        `本地存储写入失败：${(error as Error).message}`,
        'io-error',
      )
    }
    return {
      key,
      size: body.length,
      contentType: options.contentType,
      checksum: createHash('sha256').update(body).digest('hex'),
      lastModified: new Date(),
    }
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.pathOf(key))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ObjectStorageError(`对象不存在：${key}`, 'not-found')
      }
      throw new ObjectStorageError(
        `本地存储读取失败：${(error as Error).message}`,
        'io-error',
      )
    }
  }

  async getRange(key: string, start: number, end: number): Promise<Buffer> {
    const path = this.pathOf(key)
    const info = await stat(path).catch(() => null)
    if (!info) throw new ObjectStorageError(`对象不存在：${key}`, 'not-found')
    const from = Math.max(0, Math.min(start, info.size))
    const to = Math.max(from, Math.min(end, info.size))
    const length = Math.max(0, to - from)
    const handle = await open(path, 'r')
    try {
      const buffer = Buffer.alloc(length)
      await handle.read(buffer, 0, length, from)
      return buffer
    } finally {
      await handle.close()
    }
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const info = await stat(this.pathOf(key))
      if (!info.isFile()) return null
      return { key, size: info.size, lastModified: info.mtime }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw new ObjectStorageError(
        `本地存储 stat 失败：${(error as Error).message}`,
        'io-error',
      )
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathOf(key))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw new ObjectStorageError(
        `本地存储删除失败：${(error as Error).message}`,
        'io-error',
      )
    }
  }

  async signedUrl(key: string, operation: SignedOperation, ttlSeconds: number): Promise<string> {
    assertSafeObjectKey(key)
    const expires = Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(ttlSeconds))
    return `${this.baseUrl}/${encodeURIComponent(key)}?op=${operation}&expires=${expires}`
  }

  private pathOf(key: string): string {
    assertSafeObjectKey(key)
    const path = resolve(this.rootDir, key)
    if (path !== this.rootDir && !path.startsWith(`${this.rootDir}${sep}`)) {
      throw new ObjectStorageError(`对象 key 越界：${key}`, 'invalid-key')
    }
    return path
  }
}
