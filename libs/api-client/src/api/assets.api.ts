import { httpClient } from './client'

export type AssetKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'
export type AssetStatus =
  | 'uploading'
  | 'scanning'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'quarantined'
  | 'deleted'

export interface AssetRecord {
  id: string
  organizationId: string
  kind: AssetKind
  status: AssetStatus
  scanStatus: string
  provider: string
  objectKey: string
  originalName: string
  mimeType: string
  size: string
  checksum: string | null
  width: number | null
  height: number | null
  durationMs: number | null
  pageCount: number | null
  metadata: Record<string, unknown> | null
  tags: string[]
  isPublic: boolean
  retentionUntil: string | null
  createdAt: string
}

export interface AssetVariantRecord {
  id: string
  assetId: string
  kind: string
  objectKey: string
  mimeType: string
  size: string
  width: number | null
  height: number | null
  bitrate: number | null
  metadata: Record<string, unknown> | null
}

export interface UploadSession {
  id: string
  organizationId: string
  userId: string
  objectKey: string
  originalName: string
  mimeType: string
  expectedSize: string
  checksum: string | null
  status: 'uploading' | 'completed' | 'aborted' | 'expired'
  parts: Array<{ partNumber: number; etag: string; size: number }> | null
  metadata: Record<string, unknown> | null
  expiresAt: string
  completedAt: string | null
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const assetsApi = {
  async list(params: { status?: string; kind?: string; page?: number; pageSize?: number } = {}) {
    return unwrap<{ items: AssetRecord[]; total: number; page: number; pageSize: number }>(
      await httpClient.get('/api/assets', { params }),
    )
  },
  async get(id: string): Promise<AssetRecord> {
    return unwrap(await httpClient.get(`/api/assets/${id}`))
  },
  async usage(): Promise<{
    usedBytes: number
    limitBytes: number
    remainingBytes: number
    activeUploads: number
    maxConcurrentUploads: number
  }> {
    return unwrap(await httpClient.get('/api/assets/usage'))
  },
  async variants(id: string): Promise<AssetVariantRecord[]> {
    return unwrap(await httpClient.get(`/api/assets/${id}/variants`))
  },
  async variantUrls(id: string, ttl = 300): Promise<Array<{ kind: string; url: string }>> {
    return unwrap(await httpClient.get(`/api/assets/${id}/variants/urls`, { params: { ttl } }))
  },
  async downloadUrl(id: string, ttl = 300): Promise<{ asset: AssetRecord; url: string }> {
    return unwrap(await httpClient.get(`/api/assets/${id}/download`, { params: { ttl } }))
  },
  async content(id: string): Promise<Blob> {
    const response = await httpClient.get(`/api/assets/${id}/content`, { responseType: 'blob' })
    return response.data as Blob
  },
  async process(id: string): Promise<{ assetId: string; jobId: string }> {
    return unwrap(await httpClient.post(`/api/assets/${id}/process`, {}))
  },
  async remove(id: string): Promise<void> {
    await httpClient.delete(`/api/assets/${id}`)
  },
  async cleanup(): Promise<{ deleted: number; deferred: number }> {
    return unwrap(await httpClient.post('/api/assets/cleanup', {}))
  },
  async initUpload(input: {
    originalName: string
    mimeType: string
    size: number
    checksum?: string
    metadata?: Record<string, unknown>
    multipart?: boolean
  }): Promise<{ session: UploadSession; uploadUrl: string | null }> {
    return unwrap(await httpClient.post('/api/asset-uploads', input))
  },
  async uploadSession(id: string): Promise<UploadSession> {
    return unwrap(await httpClient.get(`/api/asset-uploads/${id}`))
  },
  async recordPart(
    id: string,
    part: { partNumber: number; etag: string; size: number },
  ): Promise<UploadSession> {
    return unwrap(await httpClient.post(`/api/asset-uploads/${id}/parts`, part))
  },
  async completeUpload(id: string): Promise<{
    session: UploadSession
    assetId: string
    deduplicated: boolean
  }> {
    return unwrap(await httpClient.post(`/api/asset-uploads/${id}/complete`, {}))
  },
  async abortUpload(id: string): Promise<UploadSession> {
    return unwrap(await httpClient.delete(`/api/asset-uploads/${id}`))
  },
  /** 小文件便捷上传：init → signed PUT → complete。 */
  async uploadFile(
    file: File,
    metadata?: Record<string, unknown>,
  ): Promise<{ assetId: string; session: UploadSession }> {
    const init = await this.initUpload({
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      metadata,
    })
    if (!init.uploadUrl) throw new Error('未返回上传 URL')
    const response = await fetch(init.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!response.ok) throw new Error(`上传失败：${response.status}`)
    const completed = await this.completeUpload(init.session.id)
    return { assetId: completed.assetId, session: completed.session }
  },
}
