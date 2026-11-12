import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { createHash, randomUUID } from 'node:crypto'
import { AssetUploadSession } from './asset-upload-session.entity'
import { AssetsService } from './assets.service'
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage'
import {
  resolveAssetPolicy,
  validateAssetMetadata,
} from './asset-policy'
import { assertAssetFile, AssetMimeError } from './asset-mime'
import { JobsService } from '../jobs/jobs.service'

export interface InitUploadInput {
  originalName: string
  mimeType: string
  size: number
  checksum?: string | null
  kind?: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'
  metadata?: Record<string, unknown> | null
  multipart?: boolean
}

export interface UploadPartInput {
  partNumber: number
  etag: string
  size: number
}

const DEFAULT_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000

/**
 * 分片上传会话：初始化 → 记录分片 → complete 校验大小 → 资产注册。
 * complete 幂等：同一 objectKey 已有资产时直接返回，不重复建资产。
 */
@Injectable()
export class AssetUploadService {
  constructor(
    @InjectRepository(AssetUploadSession)
    private readonly sessions: Repository<AssetUploadSession>,
    private readonly assets: AssetsService,
    @Optional()
    @Inject(OBJECT_STORAGE)
    private readonly storage?: ObjectStorage,
    @Optional()
    private readonly jobs?: JobsService,
  ) {}

  async init(
    organizationId: string,
    userId: string,
    input: InitUploadInput,
  ): Promise<{ session: AssetUploadSession; uploadUrl: string | null }> {
    const limits = resolveAssetPolicy()
    const maxBytes = input.multipart
      ? Number(process.env.ASSET_MAX_MULTIPART_BYTES ?? 5 * 1024 * 1024 * 1024)
      : limits.maxFileBytes
    const policyError = validateAssetMetadata(input, {
      ...limits,
      maxFileBytes: maxBytes,
    })
    if (policyError) throw new BadRequestException(policyError)

    const active = await this.sessions.count({
      where: { organizationId, status: 'uploading' },
    })
    if (active >= limits.maxConcurrentUploads) {
      throw new BadRequestException(
        `并发上传会话超过上限 ${limits.maxConcurrentUploads}`,
      )
    }
    const pending = await this.sessions.find({
      where: { organizationId, status: 'uploading' },
      select: ['expectedSize'],
    })
    const pendingBytes = pending.reduce(
      (sum, session) => sum + Number(session.expectedSize ?? 0),
      0,
    )
    const usedBytes = await this.assets.totalSize(organizationId)
    if (usedBytes + pendingBytes + input.size > limits.maxOrgBytes) {
      throw new BadRequestException(`组织存储配额超限（上限 ${limits.maxOrgBytes} bytes）`)
    }

    await this.assets.assertUploadAllowed(organizationId, input.size)
    const id = randomUUID()
    const safeName = input.originalName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200)
    const objectKey = `org/${organizationId}/uploads/${id}/${safeName}`
    const ttlMs = Number(process.env.ASSET_UPLOAD_TTL_MS ?? DEFAULT_UPLOAD_TTL_MS)
    const session = await this.sessions.save(
      this.sessions.create({
        organizationId,
        userId,
        objectKey,
        originalName: input.originalName,
        mimeType: input.mimeType,
        expectedSize: String(input.size),
        checksum: input.checksum ?? null,
        status: 'uploading',
        parts: null,
        metadata: { ...(input.metadata ?? {}), multipart: input.multipart === true },
        expiresAt: new Date(Date.now() + ttlMs),
        completedAt: null,
      }),
    )
    const uploadUrl = this.storage
      ? await this.storage.signedUrl(objectKey, 'write', 3600)
      : null
    return { session, uploadUrl }
  }

  async get(organizationId: string, id: string): Promise<AssetUploadSession> {
    const session = await this.sessions.findOne({ where: { id, organizationId } })
    if (!session) throw new NotFoundException('Upload session not found')
    return session
  }

  async recordPart(
    organizationId: string,
    id: string,
    part: UploadPartInput,
  ): Promise<AssetUploadSession> {
    const session = await this.get(organizationId, id)
    if (session.status !== 'uploading') {
      throw new ConflictException(`上传会话状态 ${session.status} 不允许写分片`)
    }
    if (part.partNumber < 1 || part.partNumber > 10_000 || part.size < 0) {
      throw new BadRequestException('分片参数非法')
    }
    if (part.size > Number(session.expectedSize)) {
      throw new BadRequestException('分片大小超过文件总大小')
    }
    const parts = (session.parts ?? []).filter(
      (item) => item.partNumber !== part.partNumber,
    )
    parts.push({ partNumber: part.partNumber, etag: part.etag, size: part.size })
    parts.sort((a, b) => a.partNumber - b.partNumber)
    session.parts = parts
    return this.sessions.save(session)
  }

  async complete(
    organizationId: string,
    id: string,
  ): Promise<{ session: AssetUploadSession; assetId: string; deduplicated: boolean }> {
    const session = await this.get(organizationId, id)
    const existing = await this.assets.findByObjectKey(organizationId, session.objectKey)
    if (existing) {
      if (session.status !== 'completed') {
        session.status = 'completed'
        session.completedAt = new Date()
        await this.sessions.save(session)
      }
      return { session, assetId: existing.id, deduplicated: true }
    }
    if (session.status !== 'uploading') {
      throw new ConflictException(`上传会话状态 ${session.status} 不能 complete`)
    }
    if (!this.storage) {
      throw new BadRequestException('未配置对象存储，无法校验上传对象')
    }
    const object = await this.storage.head(session.objectKey)
    if (!object) throw new BadRequestException('上传对象不存在')
    if (object.size !== Number(session.expectedSize)) {
      throw new BadRequestException(
        `对象大小不符：期望 ${session.expectedSize}，实际 ${object.size}`,
      )
    }
    const parts = (session.parts ?? []).slice().sort((a, b) => a.partNumber - b.partNumber)
    if (parts.length > 0) {
      const contiguous = parts.every((part, index) => part.partNumber === index + 1)
      const total = parts.reduce((sum, part) => sum + part.size, 0)
      if (!contiguous || total !== Number(session.expectedSize)) {
        throw new BadRequestException('分片不连续或总大小不符')
      }
    }
    let header: Buffer
    if (this.storage.getRange) {
      header = await this.storage.getRange(session.objectKey, 0, 4096)
    } else {
      header = (await this.storage.get(session.objectKey)).subarray(0, 4096)
    }
    let sniffed: ReturnType<typeof assertAssetFile>
    try {
      sniffed = assertAssetFile({
        buffer: header,
        filename: session.originalName,
        declaredMime: session.mimeType,
        size: object.size,
        maxBytes: session.metadata?.multipart
          ? Number(process.env.ASSET_MAX_MULTIPART_BYTES ?? 5 * 1024 * 1024 * 1024)
          : undefined,
      })
    } catch (error) {
      if (error instanceof AssetMimeError) throw new BadRequestException(error.message)
      throw error
    }
    if (session.checksum) {
      const full = await this.storage.get(session.objectKey)
      const actual = `sha256:${createHash('sha256').update(full).digest('hex')}`
      const expected = session.checksum.includes(':')
        ? session.checksum
        : `sha256:${session.checksum}`
      if (actual.toLowerCase() !== expected.toLowerCase()) {
        throw new BadRequestException('上传校验和不符')
      }
    }
    const asset = await this.assets.create(organizationId, {
      objectKey: session.objectKey,
      originalName: session.originalName,
      mimeType: sniffed.mimeType,
      size: object.size,
      checksum: session.checksum ?? object.checksum ?? null,
      kind: sniffed.kind,
      status: 'scanning',
      scanStatus: 'pending',
      metadata: session.metadata ?? null,
      provider: process.env.ASSET_STORAGE_PROVIDER ?? 'local',
      createdBy: session.userId,
    })
    session.status = 'completed'
    session.completedAt = new Date()
    await this.sessions.save(session)
    if (this.jobs) {
      await this.jobs
        .create(
          organizationId,
          { userId: session.userId, permissions: ['jobs:manage'] },
          {
            type: 'asset.process',
            payload: { assetId: asset.id },
            idempotencyKey: `asset.process:${asset.id}`,
          },
        )
        .catch(() => undefined)
    }
    return { session, assetId: asset.id, deduplicated: false }
  }

  async cleanupExpired(organizationId: string): Promise<number> {
    const expired = await this.sessions.find({
      where: { organizationId, status: 'uploading' },
    })
    let cleaned = 0
    for (const session of expired) {
      if (session.expiresAt.getTime() > Date.now()) continue
      if (this.storage) await this.storage.delete(session.objectKey).catch(() => undefined)
      session.status = 'expired'
      await this.sessions.save(session)
      cleaned += 1
    }
    return cleaned
  }

  async abort(organizationId: string, id: string): Promise<AssetUploadSession> {
    const session = await this.get(organizationId, id)
    if (session.status === 'completed') {
      throw new ConflictException('已完成的会话不能中止')
    }
    session.status = 'aborted'
    return this.sessions.save(session)
  }
}
