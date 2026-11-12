import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { IntegrationConnector, type ConnectorType } from './integrations.entities'
import {
  assertSafeOutboundUrl,
  assertResolvedHostSafe,
  redact,
  resolveSecret,
  IntegrationSecurityError,
} from './integrations.security'

export interface IntegrationActor {
  id: string
  permissions: string[]
}

export interface ConnectorInput {
  key?: string
  name?: string
  type?: ConnectorType
  appInstallationId?: string | null
  config?: Record<string, unknown>
  secretRef?: string | null
  status?: 'active' | 'disabled'
}

function sanitizeConnector(row: IntegrationConnector) {
  return {
    ...row,
    secretRef: row.secretRef ? `secret:${row.secretRef}` : null,
    config: redact(row.config),
  }
}

@Injectable()
export class IntegrationConnectorService {
  private readonly tokenCache = new Map<string, { token: string; expiresAt: number }>()

  constructor(
    @InjectRepository(IntegrationConnector)
    private readonly connectors: Repository<IntegrationConnector>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(organizationId: string) {
    const rows = await this.connectors.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
    return rows.map(sanitizeConnector)
  }

  async get(organizationId: string, id: string): Promise<IntegrationConnector> {
    const row = await this.connectors.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('连接器不存在')
    return row
  }

  async create(
    organizationId: string,
    actor: IntegrationActor,
    input: ConnectorInput,
  ) {
    if (!input.key || !input.name || !input.type) {
      throw new BadRequestException('key/name/type 必填')
    }
    if (!['rest', 'webhook', 'database'].includes(input.type)) {
      throw new BadRequestException(`连接器类型非法：${input.type}`)
    }
    const config = input.config ?? {}
    if (input.type === 'rest') {
      const endpoint = String(config.endpoint ?? '')
      if (!endpoint) throw new BadRequestException('REST 连接器缺少 config.endpoint')
      try {
        assertSafeOutboundUrl(endpoint, (config.allowlist as string[]) ?? [])
      } catch (error) {
        if (error instanceof IntegrationSecurityError) {
          throw new BadRequestException(error.message)
        }
        throw error
      }
    }
    if (input.secretRef) resolveSecret(input.secretRef)
    const existing = await this.connectors.findOne({
      where: { organizationId, key: input.key },
    })
    if (existing) throw new ConflictException(`连接器 key 已存在：${input.key}`)
    const row = await this.connectors.save(
      this.connectors.create({
        organizationId,
        appInstallationId: input.appInstallationId ?? null,
        key: input.key,
        name: input.name,
        type: input.type,
        config,
        secretRef: input.secretRef ?? null,
        status: input.status ?? 'active',
        version: 1,
        metadata: null,
        createdBy: actor.id,
      }),
    )
    await this.audit(organizationId, actor, 'connector.changed', row.id, {
      phase: 'created',
      key: row.key,
      type: row.type,
    })
    return sanitizeConnector(row)
  }

  async update(
    organizationId: string,
    actor: IntegrationActor,
    id: string,
    input: ConnectorInput,
  ) {
    const row = await this.get(organizationId, id)
    if (input.name !== undefined) row.name = input.name
    if (input.config !== undefined) {
      row.config = input.config
      row.version += 1
    }
    if (input.secretRef !== undefined) {
      if (input.secretRef) resolveSecret(input.secretRef)
      row.secretRef = input.secretRef
      row.version += 1
    }
    if (input.status !== undefined) row.status = input.status
    if (input.type !== undefined) row.type = input.type
    await this.connectors.save(row)
    await this.audit(organizationId, actor, 'connector.changed', row.id, {
      phase: 'updated',
      key: row.key,
      version: row.version,
    })
    return sanitizeConnector(row)
  }

  async remove(organizationId: string, actor: IntegrationActor, id: string) {
    const row = await this.get(organizationId, id)
    row.status = 'disabled'
    await this.connectors.save(row)
    await this.audit(organizationId, actor, 'connector.changed', row.id, {
      phase: 'disabled',
      key: row.key,
    })
    return sanitizeConnector(row)
  }

  async test(organizationId: string, actor: IntegrationActor, id: string) {
    const row = await this.get(organizationId, id)
    if (row.status !== 'active') {
      throw new ForbiddenException(`连接器状态 ${row.status} 不可调用`)
    }
    let result: { ok: boolean; status?: number; detail?: string }
    if (row.type === 'rest') {
      const endpoint = String(row.config.endpoint ?? '')
      const allowlist = (row.config.allowlist as string[]) ?? []
      let url: URL
      try {
        url = assertSafeOutboundUrl(endpoint, allowlist)
        await assertResolvedHostSafe(url, allowlist)
      } catch (error) {
        throw new BadRequestException((error as Error).message)
      }
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(),
        Number(row.config.timeoutMs ?? 10_000),
      )
      try {
        const response = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: await this.headersForAsync(row),
        })
        result = { ok: response.status < 400, status: response.status }
      } catch (error) {
        result = { ok: false, detail: (error as Error).message }
      } finally {
        clearTimeout(timeout)
      }
    } else {
      result = { ok: true, detail: 'no-op test' }
    }
    row.lastTestedAt = new Date()
    row.lastTestStatus = result.ok ? 'ok' : 'failed'
    await this.connectors.save(row)
    await this.audit(organizationId, actor, 'connector.changed', row.id, {
      phase: 'tested',
      ok: result.ok,
      status: result.status,
    })
    return { ...result, connector: sanitizeConnector(row) }
  }

  async headersForAsync(row: IntegrationConnector): Promise<Record<string, string>> {
    const authType = String(row.config.authType ?? 'none')
    if (authType !== 'oauth2') return this.headersFor(row)
    const cached = this.tokenCache.get(`${row.id}:${row.version}`)
    if (cached && cached.expiresAt > Date.now() + 10_000) {
      return { ...this.headersFor({ ...row, config: { ...row.config, authType: 'none' } }), Authorization: `Bearer ${cached.token}` }
    }
    const secret = row.secretRef ? resolveSecret(row.secretRef) : ''
    let clientId = String(row.config.clientId ?? '')
    let clientSecret = secret
    try {
      const parsed = JSON.parse(secret) as { clientId?: string; clientSecret?: string }
      clientId = parsed.clientId ?? clientId
      clientSecret = parsed.clientSecret ?? clientSecret
    } catch {
      // secret 可以是 "id:secret" 或纯 clientSecret
      if (secret.includes(':')) {
        const [id, value] = secret.split(':')
        clientId = clientId || (id ?? '')
        clientSecret = value ?? clientSecret
      }
    }
    const tokenUrl = String(row.config.tokenUrl ?? '')
    if (!tokenUrl) throw new IntegrationSecurityError('OAuth2 缺少 tokenUrl', 'secret')
    const response = await fetch(assertSafeOutboundUrl(tokenUrl, (row.config.allowlist as string[]) ?? []), {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        ...(row.config.scope ? { scope: String(row.config.scope) } : {}),
      }),
    })
    if (!response.ok) throw new IntegrationSecurityError(`OAuth2 token 获取失败：${response.status}`, 'secret')
    const body = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!body.access_token) throw new IntegrationSecurityError('OAuth2 未返回 access_token', 'secret')
    this.tokenCache.set(`${row.id}:${row.version}`, {
      token: body.access_token,
      expiresAt: Date.now() + Math.max(30, Number(body.expires_in ?? 3600)) * 1000,
    })
    return { ...this.headersFor({ ...row, config: { ...row.config, authType: 'none' } }), Authorization: `Bearer ${body.access_token}` }
  }

  headersFor(row: IntegrationConnector, body?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((row.config.headers as Record<string, string>) ?? {}),
    }
    const authType = String(row.config.authType ?? 'none')
    if (authType === 'none') return headers
    const secret = row.secretRef ? resolveSecret(row.secretRef) : ''
    if (authType === 'bearer') {
      headers.Authorization = `Bearer ${secret}`
    } else if (authType === 'api-key') {
      headers[String(row.config.apiKeyHeader ?? 'X-API-Key')] = secret
    } else if (authType === 'basic') {
      const [user, pass] = secret.split(':')
      headers.Authorization = `Basic ${Buffer.from(`${user ?? ''}:${pass ?? ''}`).toString('base64')}`
    } else if (authType === 'oauth2') {
      throw new IntegrationSecurityError('OAuth2 token 需先获取', 'secret')
    }
    return headers
  }

  private async audit(
    organizationId: string,
    actor: IntegrationActor,
    action: 'connector.changed',
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditLogs.create({
      organizationId,
      action,
      resource: 'connector',
      resourceId,
      actor: actor.id,
      status: 'success',
      metadata,
      source: 'integration',
    })
  }
}
