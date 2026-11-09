import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Asset, type AssetKind, type AssetStatus } from './asset.entity'
import { AssetVariant } from './asset-variant.entity'
import { ObjectStorage } from './object-storage'
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
    @Optional() private readonly storage?: ObjectStorage,
  ) {}

  async create(organizationId: string, input: CreateAssetInput): Promise<Asset> {
    if (input.size < 0) throw new ForbiddenException('资产大小非法')
    const row = this.assets.create({
      organizationId,
      appInstallationId: input.appInstallationId ?? null,
      ownerId: input.ownerId ?? null,
      kind: input.kind ?? 'other',
      status: 'ready',
      objectKey: input.objectKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: String(input.size),
      checksum: input.checksum ?? null,
      metadata: input.metadata ?? null,
      isPublic: input.isPublic ?? false,
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
}
