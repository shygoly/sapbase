import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Asset, type AssetKind, type AssetScanStatus, type AssetStatus } from './asset.entity'
import { AssetVariant } from './asset-variant.entity'
import { AssetUploadSession } from './asset-upload-session.entity'
import { Organization } from '../organizations/organization.entity'
import { OBJECT_STORAGE, ObjectStorage } from './object-storage'
import { isAssetDownloadable } from './asset-state'

export interface CreateAssetInput {
  objectKey: string
  originalName: string
  mimeType: string
  size: number
  kind?: AssetKind
  checksum?: string | null
  metadata?: Record<string, unknown> | null
  isPublic?: boolean
  appInstallationId?: string | null
  createdBy?: string | null
  ownerId?: string | null
  status?: AssetStatus
  scanStatus?: AssetScanStatus
  provider?: string
  tags?: string[]
  retentionUntil?: Date | null
}

export interface ListAssetsInput {
  status?: AssetStatus
  kind?: AssetKind
  page?: number
  pageSize?: number
}

/**
 * 资产注册表服务：业务写入/读取只认 assetId。
 * 对象存储只通过 ObjectStorage 访问；资产状态不是 ready 时拒绝签发下载 URL。
 */
@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    @InjectRepository(AssetVariant)
    private readonly variants: Repository<AssetVariant>,
    @InjectRepository(AssetUploadSession)
    private readonly uploadSessions: Repository<AssetUploadSession>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @Optional()
    @Inject(OBJECT_STORAGE)
    private readonly storage?: ObjectStorage,
  ) {}

  async create(organizationId: string, input: CreateAssetInput): Promise<Asset> {
    if (input.size < 0) throw new ForbiddenException('资产大小非法')
    const row = this.assets.create({
      organizationId,
      appInstallationId: input.appInstallationId ?? null,
      ownerId: input.ownerId ?? null,
      kind: input.kind ?? 'other',
      status: input.status ?? 'ready',
      scanStatus: input.scanStatus ?? 'pending',
      provider: input.provider ?? process.env.ASSET_STORAGE_PROVIDER ?? 'local',
      objectKey: input.objectKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: String(input.size),
      checksum: input.checksum ?? null,
      metadata: input.metadata ?? null,
      tags: input.tags ?? [],
      isPublic: input.isPublic ?? false,
      retentionUntil: input.retentionUntil ?? null,
      createdBy: input.createdBy ?? null,
    })
    return this.assets.save(row)
  }

  async get(organizationId: string, id: string): Promise<Asset> {
    const row = await this.assets.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('Asset not found')
    return row
  }

  async findByObjectKey(organizationId: string, objectKey: string): Promise<Asset | null> {
    return this.assets.findOne({ where: { organizationId, objectKey } })
  }

  async totalSize(organizationId: string): Promise<number> {
    const raw = await this.assets
      .createQueryBuilder('asset')
      .select('COALESCE(SUM(CAST(asset.size AS BIGINT)), 0)', 'total')
      .where('asset.organizationId = :organizationId', { organizationId })
      .andWhere("asset.status <> 'deleted'")
      .getRawOne<{ total: string | number }>()
    return Number(raw?.total ?? 0)
  }

  async list(organizationId: string, input: ListAssetsInput = {}) {
    const page = Math.max(1, Math.floor(input.page ?? 1))
    const pageSize = Math.max(1, Math.min(100, Math.floor(input.pageSize ?? 20)))
    const where: Record<string, unknown> = {
      organizationId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
    }
    const [items, total] = await this.assets.findAndCount({
      where: where as never,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return { items, total, page, pageSize }
  }

  /** 同组织 checksum + size 命中即可复用对象；业务引用仍各自独立。 */
  async findDuplicate(
    organizationId: string,
    checksum: string,
    size: number,
  ): Promise<Asset | null> {
    return this.assets.findOne({
      where: { organizationId, checksum, size: String(size), status: 'ready' },
      order: { createdAt: 'ASC' },
    })
  }

  async listVariants(organizationId: string, assetId: string): Promise<AssetVariant[]> {
    await this.get(organizationId, assetId)
    return this.variants.find({
      where: { organizationId, assetId },
      order: { kind: 'ASC' },
    })
  }

  async addVariant(
    organizationId: string,
    assetId: string,
    input: {
      kind: string
      objectKey: string
      mimeType: string
      size: number
      width?: number | null
      height?: number | null
      bitrate?: number | null
      provider?: string
      status?: string
      metadata?: Record<string, unknown> | null
    },
  ): Promise<AssetVariant> {
    await this.get(organizationId, assetId)
    const existing = await this.variants.findOne({
      where: { organizationId, assetId, kind: input.kind },
    })
    if (existing) {
      existing.objectKey = input.objectKey
      existing.mimeType = input.mimeType
      existing.size = String(input.size)
      existing.width = input.width ?? null
      existing.height = input.height ?? null
      existing.bitrate = input.bitrate ?? null
      existing.provider = input.provider ?? process.env.ASSET_STORAGE_PROVIDER ?? 'local'
      existing.status = input.status ?? 'ready'
      existing.metadata = input.metadata ?? null
      return this.variants.save(existing)
    }
    return this.variants.save(
      this.variants.create({
        organizationId,
        assetId,
        kind: input.kind,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        size: String(input.size),
        width: input.width ?? null,
        height: input.height ?? null,
        bitrate: input.bitrate ?? null,
        provider: input.provider ?? process.env.ASSET_STORAGE_PROVIDER ?? 'local',
        status: input.status ?? 'ready',
        metadata: input.metadata ?? null,
      }),
    )
  }

  async softDelete(organizationId: string, id: string): Promise<Asset> {
    const row = await this.get(organizationId, id)
    row.status = 'deleted'
    row.deletedAt = new Date()
    return this.assets.save(row)
  }

  async downloadUrl(
    organizationId: string,
    id: string,
    ttlSeconds = 300,
  ): Promise<{ asset: Asset; url: string }> {
    const asset = await this.get(organizationId, id)
    if (!isAssetDownloadable(asset.status)) {
      throw new ForbiddenException(`资产状态 ${asset.status} 不可下载`)
    }
    if (!this.storage) {
      throw new ForbiddenException('未配置对象存储，无法签发下载 URL')
    }
    const url = await this.storage.signedUrl(asset.objectKey, 'read', ttlSeconds)
    return { asset, url }
  }

  /** 组织用量：已用字节、上限、活跃上传会话。 */
  async usage(organizationId: string) {
    const used = await this.assets
      .createQueryBuilder('asset')
      .select('COALESCE(SUM(asset.size), 0)', 'bytes')
      .where('asset."organizationId" = :organizationId', { organizationId })
      .andWhere('asset.status <> :deleted', { deleted: 'deleted' })
      .getRawOne<{ bytes: string }>()
    const activeUploads = await this.uploadSessions.count({
      where: { organizationId, status: 'uploading' },
    })
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    })
    const limitBytes = Number(
      organization?.assetQuotaBytes ??
        process.env.ASSET_QUOTA_BYTES ??
        5 * 1024 * 1024 * 1024,
    )
    return {
      usedBytes: Number(used?.bytes ?? 0),
      limitBytes,
      remainingBytes: Math.max(0, limitBytes - Number(used?.bytes ?? 0)),
      activeUploads,
      maxConcurrentUploads: Number(process.env.ASSET_MAX_CONCURRENT_UPLOADS ?? 5),
    }
  }

  async setQuota(organizationId: string, limitBytes: number): Promise<{ limitBytes: number }> {
    if (!Number.isFinite(limitBytes) || limitBytes <= 0) {
      throw new ForbiddenException('配额必须是正数')
    }
    await this.organizations.update(
      { id: organizationId },
      { assetQuotaBytes: String(Math.floor(limitBytes)) },
    )
    return { limitBytes: Math.floor(limitBytes) }
  }

  async assertUploadAllowed(organizationId: string, incomingBytes: number): Promise<void> {
    const usage = await this.usage(organizationId)
    if (usage.activeUploads >= usage.maxConcurrentUploads) {
      throw new ForbiddenException(
        `并发上传会话已达上限 ${usage.maxConcurrentUploads}`,
      )
    }
    if (usage.usedBytes + incomingBytes > usage.limitBytes) {
      throw new ForbiddenException(
        `组织存储配额不足：已用 ${usage.usedBytes} / 上限 ${usage.limitBytes} bytes`,
      )
    }
  }

  /** Range 串流：调用方必须先通过业务/资产权限检查。 */
  async readRange(
    organizationId: string,
    id: string,
    start: number,
    end: number,
  ): Promise<{ asset: Asset; body: Buffer; total: number }> {
    const asset = await this.get(organizationId, id)
    if (!isAssetDownloadable(asset.status)) {
      throw new ForbiddenException(`资产状态 ${asset.status} 不可下载`)
    }
    if (!this.storage) throw new ForbiddenException('未配置对象存储')
    const full = await this.storage.get(asset.objectKey)
    const from = Math.max(0, Math.min(start, full.length))
    const to = Math.max(from, Math.min(end, full.length))
    return { asset, body: full.subarray(from, to), total: full.length }
  }

  /** 公开资产：显式 isPublic 才允许跨租户读取，仍要求 ready。 */
  async getPublic(id: string): Promise<Asset> {
    const asset = await this.assets.findOne({ where: { id, isPublic: true, status: 'ready' } })
    if (!asset) throw new NotFoundException('Asset not found')
    return asset
  }

  async readPublic(id: string): Promise<{ asset: Asset; body: Buffer }> {
    const asset = await this.getPublic(id)
    if (!this.storage) throw new ForbiddenException('未配置对象存储')
    return { asset, body: await this.storage.get(asset.objectKey) }
  }

  async signedVariantUrls(
    organizationId: string,
    assetId: string,
    ttlSeconds = 300,
  ): Promise<Array<{ kind: string; url: string; mimeType: string; size: string }>> {
    await this.get(organizationId, assetId)
    if (!this.storage) return []
    const variants = await this.listVariants(organizationId, assetId)
    return Promise.all(
      variants.map(async (variant) => ({
        kind: variant.kind,
        url: await this.storage!.signedUrl(variant.objectKey, 'read', ttlSeconds),
        mimeType: variant.mimeType,
        size: variant.size,
      })),
    )
  }

  /** 保留期清理：仍被 blueprint_records 引用的资产不删除，只顺延。 */
  async cleanupExpired(organizationId: string): Promise<{ deleted: number; deferred: number }> {
    const expired = await this.assets
      .createQueryBuilder('asset')
      .where('asset."organizationId" = :organizationId', { organizationId })
      .andWhere('asset."retentionUntil" IS NOT NULL AND asset."retentionUntil" < now()')
      .andWhere('asset.status <> :deleted', { deleted: 'deleted' })
      .getMany()
    let deleted = 0
    let deferred = 0
    for (const asset of expired) {
      const referenced = await this.assets.manager.query(
        `SELECT 1 FROM public.blueprint_records WHERE "organizationId" = $1 AND data::text LIKE $2 LIMIT 1`,
        [organizationId, `%${asset.id}%`],
      )
      if (Array.isArray(referenced) && referenced.length > 0) {
        asset.retentionUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        await this.assets.save(asset)
        deferred += 1
        continue
      }
      if (this.storage) await this.storage.delete(asset.objectKey).catch(() => undefined)
      asset.status = 'deleted'
      asset.deletedAt = new Date()
      await this.assets.save(asset)
      deleted += 1
    }
    return { deleted, deferred }
  }
}
