import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { createHash, randomBytes } from 'node:crypto'
import { ServiceClient } from './service-client.entity'

export interface CreateServiceClientInput {
  key: string
  name: string
  scopes?: string[]
  expiresAt?: Date | null
  ipAllowlist?: string[] | null
  appInstallationId?: string | null
}

export interface UpdateServiceClientInput {
  name?: string
  scopes?: string[]
  status?: 'active' | 'inactive'
  expiresAt?: Date | null
  ipAllowlist?: string[] | null
  appInstallationId?: string | null
}

const KEY_PATTERN = /^[a-z][a-z0-9_-]*$/

export function hashClientSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/**
 * 服务客户端：客户端凭证只返回一次明文 secret，数据库只存哈希。
 * 代用户调用（on_behalf_of）仍由平台重新解析权限/数据范围，不信任客户端声明。
 */
@Injectable()
export class ServiceClientsService {
  constructor(
    @InjectRepository(ServiceClient)
    private readonly repository: Repository<ServiceClient>,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  async list(organizationId: string): Promise<ServiceClient[]> {
    return this.repository.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    })
  }

  async findOne(organizationId: string, id: string): Promise<ServiceClient> {
    const row = await this.repository.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('Service client not found')
    return row
  }

  async create(
    organizationId: string,
    input: CreateServiceClientInput,
  ): Promise<{ client: ServiceClient; secret: string }> {
    if (!KEY_PATTERN.test(input.key)) {
      throw new BadRequestException('service client key 只允许小写字母开头、含 a-z0-9_-')
    }
    const existing = await this.repository.findOne({
      where: { organizationId, key: input.key },
    })
    if (existing) throw new BadRequestException(`service client key 已存在：${input.key}`)
    const secret = randomBytes(32).toString('hex')
    const row = this.repository.create({
      organizationId,
      key: input.key,
      name: input.name,
      appInstallationId: input.appInstallationId ?? null,
      secretHash: hashClientSecret(secret),
      scopes: input.scopes ?? null,
      status: 'active',
      expiresAt: input.expiresAt ?? null,
      lastUsedAt: null,
      ipAllowlist: input.ipAllowlist ?? null,
    })
    const saved = await this.repository.save(row)
    await this.auditLogs?.create({
      organizationId,
      action: 'auth.service_token.issued',
      resource: 'service_client',
      resourceId: saved.id,
      actor: 'system:service-client',
      status: 'success',
      metadata: { key: saved.key, change: 'create' },
      source: 'identity',
    })
    return { client: saved, secret }
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateServiceClientInput,
  ): Promise<ServiceClient> {
    const row = await this.findOne(organizationId, id)
    if (input.name !== undefined) row.name = input.name
    if (input.scopes !== undefined) row.scopes = input.scopes
    if (input.status !== undefined) row.status = input.status
    if (input.expiresAt !== undefined) row.expiresAt = input.expiresAt
    if (input.ipAllowlist !== undefined) row.ipAllowlist = input.ipAllowlist
    if (input.appInstallationId !== undefined) row.appInstallationId = input.appInstallationId
    return this.repository.save(row)
  }

  async rotate(
    organizationId: string,
    id: string,
  ): Promise<{ client: ServiceClient; secret: string }> {
    const row = await this.findOne(organizationId, id)
    const secret = randomBytes(32).toString('hex')
    row.secretHash = hashClientSecret(secret)
    row.status = 'active'
    const saved = await this.repository.save(row)
    await this.auditLogs?.create({
      organizationId,
      action: 'auth.service_token.issued',
      resource: 'service_client',
      resourceId: saved.id,
      actor: 'system:service-client',
      status: 'success',
      metadata: { key: saved.key, change: 'rotate' },
      source: 'identity',
    })
    return { client: saved, secret }
  }

  async authenticate(
    organizationId: string,
    key: string,
    secret: string,
  ): Promise<ServiceClient | null> {
    const row = await this.repository
      .createQueryBuilder('client')
      .addSelect('client.secretHash')
      .where('client.organizationId = :organizationId', { organizationId })
      .andWhere('client.key = :key', { key })
      .andWhere('client.status = :status', { status: 'active' })
      .getOne()
    if (!row) return null
    if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null
    if (row.secretHash !== hashClientSecret(secret)) return null
    await this.repository.update({ id: row.id }, { lastUsedAt: new Date() })
    return row
  }
}
