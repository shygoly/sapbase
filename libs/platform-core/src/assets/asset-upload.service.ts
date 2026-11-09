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
import { randomUUID } from 'node:crypto'
import { AssetUploadSession } from './asset-upload-session.entity'
import { AssetsService } from './assets.service'
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage'

export interface InitUploadInput {
  originalName: string
  mimeType: string
  size: number
  checksum?: string | null
  kind?: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'
  metadata?: Record<string, unknown> | null
}

export interface UploadPartInput {
  partNumber: number
  etag: string
  size: number
}

const DEFAULT_MAX_FILE_BYTES = 200 * 1024 * 1024
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
  ) {}

  async init(
    organizationId: string,
    userId: string,
    input: InitUploadInput,
  ): Promise<{ session: AssetUploadSession; uploadUrl: string | null }> {
    const max = Number(process.env.ASSET_MAX_FILE_BYTES ?? DEFAULT_MAX_FILE_BYTES)
    if (!Number.isFinite(input.size) || input.size <= 0 || input.size > max) {
      throw new BadRequestException(`文件大小非法（上限 ${max} bytes）`)
    }
    if (!input.mimeType || !input.originalName) {
      throw new BadRequestException('originalName/mimeType 必填')
    }
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
    if (part.partNumber < 1 || part.size < 0) {
      throw new BadRequestException('分片参数非法')
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
    const asset = await this.assets.create(organizationId, {
      objectKey: session.objectKey,
      originalName: session.originalName,
      mimeType: session.mimeType,
      size: object.size,
      checksum: session.checksum ?? object.checksum ?? null,
      kind: kindFromMime(session.mimeType),
      createdBy: session.userId,
    })
    session.status = 'completed'
    session.completedAt = new Date()
    await this.sessions.save(session)
    return { session, assetId: asset.id, deduplicated: false }
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

function kindFromMime(mimeType: string): 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return 'document'
  if (/zip|tar|gzip|rar|7z/.test(mimeType)) return 'archive'
  return 'other'
}
