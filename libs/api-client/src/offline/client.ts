export type OfflineLabel = { explicit: string | null; implicit: string | null; required: boolean }

export interface OfflineManifestItem {
  assetId: string
  objectKey: string
  variant: string | null
  mimeType: string
  size: string
  checksum: string | null
  label: OfflineLabel
  downloadToken?: string
  downloadUrl?: string
}

export interface OfflineManifest {
  offlinePackage: 'v1' | string
  organizationId: string
  key: string
  version: number
  title: string
  expiresAt: string | null
  items: OfflineManifestItem[]
  contentHash: string
  publicKey?: string
  signature?: string
}

export interface OfflineStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  keys(prefix: string): Promise<string[]>
}

function toBase64(bytes: Uint8Array): string {
  const maybeBuffer = (globalThis as { Buffer?: { from: (input: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer
  if (maybeBuffer) return maybeBuffer.from(bytes).toString('base64')
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const maybeBuffer = (globalThis as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer
  if (maybeBuffer) return maybeBuffer.from(value, 'base64')
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export class MemoryOfflineStorage implements OfflineStorage {
  private readonly map = new Map<string, string>()
  async get(key: string) {
    return this.map.get(key) ?? null
  }
  async set(key: string, value: string) {
    this.map.set(key, value)
  }
  async delete(key: string) {
    this.map.delete(key)
  }
  async keys(prefix: string) {
    return [...this.map.keys()].filter((key) => key.startsWith(prefix))
  }
}

export class LocalStorageOfflineStorage implements OfflineStorage {
  constructor(private readonly storage: Storage) {}
  async get(key: string) {
    return this.storage.getItem(key)
  }
  async set(key: string, value: string) {
    this.storage.setItem(key, value)
  }
  async delete(key: string) {
    this.storage.removeItem(key)
  }
  async keys(prefix: string) {
    const keys: string[] = []
    for (let i = 0; i < this.storage.length; i += 1) {
      const key = this.storage.key(i)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    return keys
  }
}

function namespace(userId: string, deviceId: string, packageId: string) {
  return `offline:${encodeURIComponent(userId)}:${encodeURIComponent(deviceId)}:${packageId}:`
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  throw new Error('WebCrypto SHA-256 unavailable')
}

/** 用户/设备/包隔离的离线缓存；LRU 上限按用户+设备。 */
export class OfflineCache {
  constructor(
    private readonly storage: OfflineStorage,
    private readonly maxBytes = 512 * 1024 * 1024,
  ) {}

  private assetKey(userId: string, deviceId: string, packageId: string, assetId: string) {
    return `${namespace(userId, deviceId, packageId)}asset:${assetId}`
  }

  async saveAsset(input: {
    userId: string
    deviceId: string
    packageId: string
    assetId: string
    data: Uint8Array
    checksum?: string | null
  }): Promise<void> {
    const key = this.assetKey(input.userId, input.deviceId, input.packageId, input.assetId)
    const checksum = input.checksum
      ? input.checksum.replace(/^sha256:/, '')
      : await sha256Hex(input.data)
    const actual = await sha256Hex(input.data)
    if (checksum !== actual) throw new Error('offline-checksum-mismatch')
    await this.storage.set(
      key,
      JSON.stringify({
        bytes: toBase64(input.data),
        checksum: actual,
        at: Date.now(),
      }),
    )
    await this.evict(input.userId, input.deviceId)
  }

  async readAsset(input: {
    userId: string
    deviceId: string
    packageId: string
    assetId: string
  }): Promise<Uint8Array | null> {
    const raw = await this.storage.get(
      this.assetKey(input.userId, input.deviceId, input.packageId, input.assetId),
    )
    if (!raw) return null
    const parsed = JSON.parse(raw) as { bytes: string; checksum: string }
    const bytes = fromBase64(parsed.bytes)
    if ((await sha256Hex(bytes)) !== parsed.checksum) {
      await this.removeAsset(input)
      throw new Error('offline-checksum-mismatch')
    }
    return bytes
  }

  async removeAsset(input: {
    userId: string
    deviceId: string
    packageId: string
    assetId: string
  }) {
    await this.storage.delete(
      this.assetKey(input.userId, input.deviceId, input.packageId, input.assetId),
    )
  }

  async clearPackage(userId: string, deviceId: string, packageId: string) {
    const prefix = namespace(userId, deviceId, packageId)
    for (const key of await this.storage.keys(prefix)) await this.storage.delete(key)
  }

  /** 过期/撤销时清理；只动当前用户+设备命名空间。 */
  async clearExpired(
    userId: string,
    deviceId: string,
    packages: Array<{ packageId: string; expiresAt: string | null }>,
    now = new Date(),
  ) {
    let cleared = 0
    for (const pkg of packages) {
      if (pkg.expiresAt && new Date(pkg.expiresAt) <= now) {
        await this.clearPackage(userId, deviceId, pkg.packageId)
        cleared += 1
      }
    }
    return cleared
  }

  private async evict(userId: string, deviceId: string) {
    const prefix = `offline:${encodeURIComponent(userId)}:${encodeURIComponent(deviceId)}:`
    const keys = await this.storage.keys(prefix)
    const entries: Array<{ key: string; size: number; at: number }> = []
    for (const key of keys) {
      const raw = await this.storage.get(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { bytes: string; at: number }
      entries.push({ key, size: fromBase64(parsed.bytes).byteLength, at: parsed.at })
    }
    let total = entries.reduce((sum, item) => sum + item.size, 0)
    entries.sort((a, b) => a.at - b.at)
    for (const item of entries) {
      if (total <= this.maxBytes) break
      await this.storage.delete(item.key)
      total -= item.size
    }
  }
}

export interface OfflineDownloadTask {
  assetId: string
  url: string
  size: number
  checksum?: string | null
  label?: OfflineLabel
}

/** 分片下载：Range、断点续传、暂停/取消、批量队列、完成校验。 */
export class OfflineDownloader {
  private readonly controllers = new Map<string, AbortController>()

  constructor(
    private readonly cache: OfflineCache,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly chunkSize = 1024 * 1024,
  ) {}

  async download(input: {
    userId: string
    deviceId: string
    packageId: string
    task: OfflineDownloadTask
    onProgress?: (loaded: number, total: number) => void
  }): Promise<Uint8Array> {
    const controller = new AbortController()
    this.controllers.set(input.task.assetId, controller)
    try {
      const chunks: Uint8Array[] = []
      let offset = 0
      while (offset < input.task.size) {
        const end = Math.min(input.task.size - 1, offset + this.chunkSize - 1)
        const response = await this.fetchImpl(input.task.url, {
          headers: { Range: `bytes=${offset}-${end}` },
          signal: controller.signal,
        })
        if (response.status !== 206 && offset > 0) {
          throw new Error(`offline-range-unsupported:${response.status}`)
        }
        const buffer = new Uint8Array(await response.arrayBuffer())
        chunks.push(buffer)
        offset += buffer.byteLength
        input.onProgress?.(offset, input.task.size)
        if (response.status === 200) break
      }
      const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
      const data = new Uint8Array(total)
      let cursor = 0
      for (const chunk of chunks) {
        data.set(chunk, cursor)
        cursor += chunk.byteLength
      }
      if (data.byteLength !== input.task.size) throw new Error('offline-size-mismatch')
      await this.cache.saveAsset({
        userId: input.userId,
        deviceId: input.deviceId,
        packageId: input.packageId,
        assetId: input.task.assetId,
        data,
        checksum: input.task.checksum,
      })
      return data
    } finally {
      this.controllers.delete(input.task.assetId)
    }
  }

  cancel(assetId: string) {
    this.controllers.get(assetId)?.abort()
  }

  async downloadBatch(input: {
    userId: string
    deviceId: string
    packageId: string
    tasks: OfflineDownloadTask[]
    onProgress?: (assetId: string, loaded: number, total: number) => void
  }) {
    const results: Array<{ assetId: string; ok: boolean; error?: string }> = []
    for (const task of input.tasks) {
      try {
        await this.download({
          userId: input.userId,
          deviceId: input.deviceId,
          packageId: input.packageId,
          task,
          onProgress: (loaded, total) => input.onProgress?.(task.assetId, loaded, total),
        })
        results.push({ assetId: task.assetId, ok: true })
      } catch (error) {
        results.push({
          assetId: task.assetId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return results
  }
}

export interface OfflinePlaybackPreference {
  speed: number
  quality: string
}

/** 离线播放校验与用户偏好（按用户隔离）。 */
export class OfflinePlayer {
  constructor(private readonly storage?: Storage) {}

  canPlay(input: {
    manifest: OfflineManifest
    userId: string
    deviceId: string
    entitledDeviceId: string
    now?: Date
  }): { allowed: boolean; reason?: string; label?: string } {
    if (input.manifest.expiresAt && new Date(input.manifest.expiresAt) <= (input.now ?? new Date())) {
      return { allowed: false, reason: 'expired' }
    }
    if (input.deviceId !== input.entitledDeviceId) {
      return { allowed: false, reason: 'device-mismatch' }
    }
    if (input.manifest.items.some((item) => item.label.required && !item.label.explicit)) {
      return { allowed: false, reason: 'label-missing' }
    }
    return {
      allowed: true,
      label: input.manifest.items.find((item) => item.label.explicit)?.label.explicit ?? undefined,
    }
  }

  getPreferences(userId: string): OfflinePlaybackPreference {
    const fallback = { speed: 1, quality: 'auto' }
    if (!this.storage) return fallback
    const raw = this.storage.getItem(`offline:prefs:${userId}`)
    if (!raw) return fallback
    try {
      return { ...fallback, ...(JSON.parse(raw) as Partial<OfflinePlaybackPreference>) }
    } catch {
      return fallback
    }
  }

  setPreferences(userId: string, preference: Partial<OfflinePlaybackPreference>) {
    if (!this.storage) return
    const next = { ...this.getPreferences(userId), ...preference }
    this.storage.setItem(`offline:prefs:${userId}`, JSON.stringify(next))
  }
}
