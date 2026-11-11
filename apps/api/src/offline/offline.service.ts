import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'
import { createHash, createHmac, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto'
import { In, LessThan, Repository } from 'typeorm'
import { OBJECT_STORAGE, type ObjectStorage } from '@sap/platform-core/assets/object-storage'
import { Asset } from '@sap/platform-core/assets/asset.entity'
import { AssetVariant } from '@sap/platform-core/assets/asset-variant.entity'
import { stableStringify } from '@sap/platform-core/audit-logs/audit-chain'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { OfflineDevice, OfflineEntitlement, OfflinePackage } from './offline.entities'

export interface OfflineActor {
  id: string
}

export interface OfflineAssetInput {
  assetId: string
  variant?: string | null
}

interface ManifestItem {
  assetId: string
  objectKey: string
  variant: string | null
  mimeType: string
  size: string
  checksum: string | null
  label: { explicit: string | null; implicit: string | null; required: boolean }
}

const fallbackKeys = generateKeyPairSync('ed25519')
const TOKEN_TTL_SECONDS = 300

@Injectable()
export class OfflineService {
  constructor(
    @InjectRepository(OfflinePackage)
    private readonly packages: Repository<OfflinePackage>,
    @InjectRepository(OfflineEntitlement)
    private readonly entitlements: Repository<OfflineEntitlement>,
    @InjectRepository(OfflineDevice)
    private readonly devices: Repository<OfflineDevice>,
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    @InjectRepository(AssetVariant)
    private readonly variants: Repository<AssetVariant>,
    @InjectDataSource() private readonly dataSource: import('typeorm').DataSource,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async createPackage(
    organizationId: string,
    actor: OfflineActor,
    input: {
      key: string
      title: string
      expiresAt?: string | null
      assets: OfflineAssetInput[]
      publish?: boolean
    },
  ): Promise<OfflinePackage> {
    if (!input.key || !/^[a-z][a-z0-9_.-]{1,127}$/.test(input.key)) {
      throw new BadRequestException('key 只允许小写字母开头、含 a-z0-9_.-')
    }
    if (!input.assets?.length) throw new BadRequestException('assets 不能为空')
    const latest = await this.packages.find({
      where: { organizationId, key: input.key },
      order: { version: 'DESC' },
      take: 1,
    })
    const version = (latest[0]?.version ?? 0) + 1
    const items: ManifestItem[] = []
    for (const item of input.assets) {
      const asset = await this.assets.findOne({
        where: { id: item.assetId, organizationId, deletedAt: null as never },
      })
      if (!asset) throw new NotFoundException(`资产不存在：${item.assetId}`)
      if (asset.status !== 'ready') {
        throw new ConflictException(`资产未就绪：${asset.id} (${asset.status})`)
      }
      const variant = item.variant
        ? await this.variants.findOne({
            where: { organizationId, assetId: asset.id, kind: item.variant },
          })
        : null
      if (item.variant && !variant) {
        throw new ConflictException(`资产没有离线变体 ${item.variant}：${asset.id}`)
      }
      const labels = await this.resolveLabels(organizationId, asset.id)
      items.push({
        assetId: asset.id,
        objectKey: variant?.objectKey ?? asset.objectKey,
        variant: item.variant ?? null,
        mimeType: variant?.mimeType ?? asset.mimeType,
        size: String(variant?.size ?? asset.size),
        checksum: asset.checksum,
        label: labels,
      })
    }
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('expiresAt 非法')
    }
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('expiresAt 必须晚于当前时间')
    }
    const manifest: Record<string, unknown> = {
      offlinePackage: 'v1',
      organizationId,
      key: input.key,
      version,
      title: input.title,
      expiresAt: expiresAt?.toISOString() ?? null,
      items,
    }
    const contentHash = createHash('sha256').update(stableStringify(manifest)).digest('hex')
    manifest.contentHash = contentHash
    const signature = this.signManifest(manifest)
    manifest.publicKey = this.publicKeyBase64()
    const saved = await this.packages.save(
      this.packages.create({
        organizationId,
        key: input.key,
        version,
        title: input.title,
        status: input.publish ? 'published' : 'draft',
        manifest,
        signature,
        expiresAt,
        createdBy: actor.id,
      }),
    )
    await this.audit(organizationId, actor.id, 'offline.package.create', {
      packageId: saved.id,
      key: saved.key,
      version,
      items: items.length,
    })
    return saved
  }

  async publish(organizationId: string, actor: OfflineActor, id: string): Promise<OfflinePackage> {
    const row = await this.getPackage(organizationId, id)
    if (row.status === 'revoked') throw new ConflictException('已撤销的包不能发布')
    row.status = 'published'
    const saved = await this.packages.save(row)
    await this.audit(organizationId, actor.id, 'offline.package.publish', { packageId: id })
    return saved
  }

  async revokePackage(organizationId: string, actor: OfflineActor, id: string) {
    const row = await this.getPackage(organizationId, id)
    row.status = 'revoked'
    await this.packages.save(row)
    const result = await this.entitlements.update(
      { organizationId, packageId: id, status: 'active' },
      { status: 'revoked', revokedAt: new Date() },
    )
    await this.audit(organizationId, actor.id, 'offline.package.revoke', {
      packageId: id,
      revokedEntitlements: result.affected ?? 0,
    })
    return { revoked: true, entitlements: result.affected ?? 0 }
  }

  async listPackages(organizationId: string): Promise<OfflinePackage[]> {
    return this.packages.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  async registerDevice(
    organizationId: string,
    userId: string,
    input: { deviceId: string; name?: string },
  ): Promise<OfflineDevice> {
    if (!input.deviceId) throw new BadRequestException('deviceId 必填')
    const max = Number(process.env.OFFLINE_MAX_DEVICES ?? 3)
    const active = await this.devices.find({
      where: { organizationId, userId, status: 'active' },
    })
    const existing = active.find((row) => row.deviceId === input.deviceId)
    if (!existing && active.length >= max) {
      throw new ConflictException({
        code: 'device-limit',
        message: `设备数已达上限 ${max}，请先撤销旧设备`,
      })
    }
    const row =
      existing ??
      (await this.devices.findOne({
        where: { organizationId, userId, deviceId: input.deviceId },
      })) ??
      this.devices.create({ organizationId, userId, deviceId: input.deviceId })
    row.name = input.name ?? row.name
    row.status = 'active'
    row.lastSeenAt = new Date()
    return this.devices.save(row)
  }

  async listDevices(organizationId: string, userId: string): Promise<OfflineDevice[]> {
    return this.devices.find({
      where: { organizationId, userId },
      order: { createdAt: 'DESC' },
    })
  }

  async revokeDevice(organizationId: string, actor: OfflineActor, userId: string, deviceId: string) {
    const row = await this.devices.findOne({
      where: { organizationId, userId, deviceId },
    })
    if (!row) throw new NotFoundException('设备不存在')
    row.status = 'revoked'
    await this.devices.save(row)
    const result = await this.entitlements.update(
      { organizationId, userId, deviceId, status: 'active' },
      { status: 'revoked', revokedAt: new Date() },
    )
    await this.audit(organizationId, actor.id, 'offline.device.revoke', {
      userId,
      deviceId,
      revokedEntitlements: result.affected ?? 0,
    })
    return { revoked: true, entitlements: result.affected ?? 0 }
  }

  async grantEntitlement(
    organizationId: string,
    actor: OfflineActor,
    packageId: string,
    input: { userId: string; deviceId: string; expiresAt?: string },
  ): Promise<OfflineEntitlement> {
    const pkg = await this.getPackage(organizationId, packageId)
    if (pkg.status !== 'published') throw new ConflictException('包未发布')
    if (pkg.expiresAt && pkg.expiresAt <= new Date()) throw new ConflictException('包已过期')
    const device = await this.devices.findOne({
      where: {
        organizationId,
        userId: input.userId,
        deviceId: input.deviceId,
        status: 'active',
      },
    })
    if (!device) throw new ConflictException('设备未注册或已撤销')
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : pkg.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException('授权有效期非法')
    }
    const existing = await this.entitlements.findOne({
      where: {
        organizationId,
        packageId,
        userId: input.userId,
        deviceId: input.deviceId,
      },
    })
    const row =
      existing ??
      this.entitlements.create({
        organizationId,
        packageId,
        userId: input.userId,
        deviceId: input.deviceId,
      })
    row.status = 'active'
    row.expiresAt = expiresAt
    row.grantedBy = actor.id
    row.revokedAt = null
    const saved = await this.entitlements.save(row)
    await this.audit(organizationId, actor.id, 'offline.entitlement.grant', {
      packageId,
      userId: input.userId,
      deviceId: input.deviceId,
      expiresAt: expiresAt.toISOString(),
    })
    return saved
  }

  async listEntitlements(organizationId: string, userId?: string) {
    return this.entitlements.find({
      where: userId ? { organizationId, userId } : { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  async revokeEntitlement(organizationId: string, actor: OfflineActor, id: string) {
    const row = await this.entitlements.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('授权不存在')
    row.status = 'revoked'
    row.revokedAt = new Date()
    await this.entitlements.save(row)
    await this.audit(organizationId, actor.id, 'offline.entitlement.revoke', { id })
    return { revoked: true }
  }

  async revokeEntitlementsBy(
    organizationId: string,
    actor: OfflineActor,
    filter: { userId?: string; deviceId?: string; packageId?: string },
  ) {
    const where: Record<string, unknown> = { organizationId, status: 'active' }
    if (filter.userId) where.userId = filter.userId
    if (filter.deviceId) where.deviceId = filter.deviceId
    if (filter.packageId) where.packageId = filter.packageId
    if (!filter.userId && !filter.deviceId && !filter.packageId) {
      throw new BadRequestException('至少指定 userId/deviceId/packageId')
    }
    const result = await this.entitlements.update(where, {
      status: 'revoked',
      revokedAt: new Date(),
    })
    await this.audit(organizationId, actor.id, 'offline.entitlement.revoke', {
      filter,
      count: result.affected ?? 0,
    })
    return { revoked: result.affected ?? 0 }
  }

  async manifestForUser(
    organizationId: string,
    userId: string,
    packageId: string,
    deviceId: string,
  ) {
    const pkg = await this.getPackage(organizationId, packageId)
    if (pkg.status !== 'published') throw new ForbiddenException('包未发布或已撤销')
    if (pkg.expiresAt && pkg.expiresAt <= new Date()) throw new ForbiddenException('包已过期')
    const entitlement = await this.entitlements.findOne({
      where: { organizationId, packageId, userId, deviceId, status: 'active' },
    })
    if (!entitlement) throw new ForbiddenException('没有有效离线授权')
    if (entitlement.expiresAt <= new Date()) {
      entitlement.status = 'expired'
      await this.entitlements.save(entitlement)
      throw new ForbiddenException('离线授权已过期')
    }
    const manifest = pkg.manifest as { items?: ManifestItem[] } & Record<string, unknown>
    const items = (manifest.items ?? []).map((item) => ({
      ...item,
      downloadToken: this.makeDownloadToken({
        organizationId,
        userId,
        deviceId,
        packageId,
        assetId: item.assetId,
        objectKey: item.objectKey,
      }),
      downloadUrl: `/api/offline/download/${this.makeDownloadToken({
        organizationId,
        userId,
        deviceId,
        packageId,
        assetId: item.assetId,
        objectKey: item.objectKey,
      })}`,
    }))
    return {
      manifest: { ...manifest, items },
      signature: pkg.signature,
      expiresAt: entitlement.expiresAt.toISOString(),
    }
  }

  async readDownload(
    organizationId: string,
    userId: string,
    token: string,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const payload = this.verifyDownloadToken(token)
    if (payload.organizationId !== organizationId) throw new ForbiddenException('租户不匹配')
    if (payload.userId !== userId) throw new ForbiddenException('用户不匹配')
    const pkg = await this.getPackage(organizationId, payload.packageId)
    if (pkg.status !== 'published') throw new ForbiddenException('包已撤销')
    const entitlement = await this.entitlements.findOne({
      where: {
        organizationId,
        packageId: payload.packageId,
        userId,
        deviceId: payload.deviceId,
        status: 'active',
      },
    })
    if (!entitlement || entitlement.expiresAt <= new Date()) {
      throw new ForbiddenException('离线授权无效')
    }
    const buffer = await this.storage.get(payload.objectKey)
    const item = ((pkg.manifest as { items?: ManifestItem[] }).items ?? []).find(
      (entry) => entry.assetId === payload.assetId,
    )
    return {
      buffer,
      mimeType: item?.mimeType ?? 'application/octet-stream',
      filename: `${payload.assetId}`,
    }
  }

  async cleanupExpired(organizationId: string, actor: OfflineActor) {
    const result = await this.entitlements.update(
      { organizationId, status: 'active', expiresAt: LessThan(new Date()) },
      { status: 'expired' },
    )
    const revoked = await this.entitlements.update(
      {
        organizationId,
        status: 'active',
        packageId: In(
          (
            await this.packages.find({
              where: { organizationId, status: 'revoked' },
              select: ['id'],
            })
          ).map((item) => item.id),
        ),
      },
      { status: 'revoked', revokedAt: new Date() },
    )
    await this.audit(organizationId, actor.id, 'offline.cleanup', {
      expired: result.affected ?? 0,
      revoked: revoked.affected ?? 0,
    })
    return { expired: result.affected ?? 0, revoked: revoked.affected ?? 0 }
  }

  verifyManifest(manifest: Record<string, unknown>, signature: string): boolean {
    const publicKey = String(manifest.publicKey ?? '')
    if (!publicKey) return false
    const payload = { ...manifest }
    delete payload.publicKey
    delete payload.signature
    return verify(
      null,
      Buffer.from(stableStringify(payload)),
      createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' }),
      Buffer.from(signature, 'base64'),
    )
  }

  private signManifest(manifest: Record<string, unknown>): string {
    const payload = { ...manifest }
    delete payload.publicKey
    delete payload.signature
    return sign(
      null,
      Buffer.from(stableStringify(payload)),
      this.privateKey(),
    ).toString('base64')
  }

  private privateKey() {
    const pem = process.env.OFFLINE_SIGNING_PRIVATE_KEY
    return pem ? createPrivateKey(pem) : fallbackKeys.privateKey
  }

  private publicKeyBase64(): string {
    const pem = process.env.OFFLINE_SIGNING_PUBLIC_KEY
    const key = pem ? createPublicKey(pem) : fallbackKeys.publicKey
    return key.export({ format: 'der', type: 'spki' }).toString('base64')
  }

  private makeDownloadToken(input: {
    organizationId: string
    userId: string
    deviceId: string
    packageId: string
    assetId: string
    objectKey: string
  }): string {
    const payload = {
      ...input,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    }
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = createHmac('sha256', this.downloadSecret()).update(body).digest('base64url')
    return `${body}.${signature}`
  }

  private verifyDownloadToken(token: string) {
    const [body, signature] = String(token ?? '').split('.')
    if (!body || !signature) throw new ForbiddenException('下载令牌非法')
    const expected = createHmac('sha256', this.downloadSecret())
      .update(body)
      .digest('base64url')
    if (expected !== signature) throw new ForbiddenException('下载令牌签名不匹配')
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      organizationId: string
      userId: string
      deviceId: string
      packageId: string
      assetId: string
      objectKey: string
      exp: number
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('下载令牌已过期')
    }
    return payload
  }

  private downloadSecret(): string {
    return (
      process.env.OFFLINE_DOWNLOAD_SECRET ??
      process.env.OFFLINE_SIGNING_SECRET ??
      'offline-dev-secret'
    )
  }

  private async resolveLabels(organizationId: string, assetId: string) {
    const provenance = (await this.dataSource.query(
      `SELECT 1 FROM public.ai_content_provenance WHERE "organizationId"=$1 AND "contentId"=$2 LIMIT 1`,
      [organizationId, assetId],
    )) as unknown[]
    const labels = (await this.dataSource.query(
      `SELECT DISTINCT ON ("labelType") "labelType", text, status
         FROM public.ai_content_labels
        WHERE "organizationId"=$1 AND "contentId"=$2
        ORDER BY "labelType", version DESC`,
      [organizationId, assetId],
    )) as Array<{ labelType: string; text: string; status: string }>
    const explicit = labels.find((item) => item.labelType === 'explicit' && item.status === 'applied')
    const implicit = labels.find((item) => item.labelType === 'implicit' && item.status === 'applied')
    if (provenance.length > 0 && (!explicit || !implicit)) {
      throw new ConflictException(`AI 内容缺少离线标识：${assetId}`)
    }
    return {
      explicit: explicit?.text ?? null,
      implicit: implicit?.text ?? null,
      required: provenance.length > 0,
    }
  }

  private async getPackage(organizationId: string, id: string): Promise<OfflinePackage> {
    const row = await this.packages.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('离线包不存在')
    return row
  }

  private async audit(
    organizationId: string,
    actor: string,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditLogs.create({
      organizationId,
      action,
      resource: 'offline_package',
      actor,
      status: 'success',
      metadata,
      source: 'offline',
    })
  }
}
