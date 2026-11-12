import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomBytes } from 'node:crypto'
import { UserStatus } from '@speckit/shared-schemas'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { UsersService } from '../users/users.service'
import { RolesService } from '../roles/roles.service'
import { AuthSessionsService } from './auth-sessions.service'
import { IdentityLink } from './identity-link.entity'
import { IdentityProvider } from './identity-provider.entity'
import { IdentitySyncRun } from './identity-sync-run.entity'
import { OrganizationMemberRolesService } from './organization-member-roles.service'
import {
  IdentitySourceAdapterRegistry,
  IdentitySourceError,
  type ExternalIdentity,
} from './identity-source'

export interface IdentitySyncStats {
  external: number
  created: number
  updated: number
  deactivated: number
  failed: number
  pendingDeactivations: number
}

export interface PendingDeactivation {
  linkId: string
  userId: string
  externalId: string
}

export interface IdentitySyncDiff {
  created: string[]
  updated: string[]
  deactivated: string[]
  pendingDeactivations: PendingDeactivation[]
  failed: Array<{ externalId: string; reason: string }>
}

export interface IdentitySyncResult {
  runId: string
  status: 'succeeded' | 'failed' | 'partial'
  stats: IdentitySyncStats
  confirmationStatus: 'none' | 'pending' | 'confirmed'
  diff: IdentitySyncDiff
}

/**
 * 身份源同步：外部列表 → identity_links → 用户。
 *
 * - 新增：无 link 时按 email 命中或 JIT 建号（默认角色校验）
 * - 更新：已有 link 的属性刷新
 * - 离职：外部列表缺失 → 停用用户、吊销会话、回收角色
 * - 源不可用 → run failed，**不**做任何降级删除
 * - 高风险离职可配置为待人工确认（provider.config.confirmDeactivations=true）
 * - 单条失败按 3 次重试；失败只影响该条
 */
@Injectable()
export class IdentitySyncService {
  constructor(
    @InjectRepository(IdentityProvider)
    private readonly providers: Repository<IdentityProvider>,
    @InjectRepository(IdentityLink)
    private readonly links: Repository<IdentityLink>,
    @InjectRepository(IdentitySyncRun)
    private readonly runs: Repository<IdentitySyncRun>,
    private readonly adapters: IdentitySourceAdapterRegistry,
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly sessions: AuthSessionsService,
    private readonly memberRoles: OrganizationMemberRolesService,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  async run(organizationId: string, providerKey: string): Promise<IdentitySyncResult> {
    const provider = await this.providers.findOne({
      where: { organizationId, key: providerKey, status: 'active' },
    })
    if (!provider) {
      throw new IdentitySourceError(`身份提供方不存在或已停用：${providerKey}`, 'unknown-adapter')
    }
    const run = await this.runs.save(
      this.runs.create({
        organizationId,
        providerId: provider.id,
        status: 'running',
        stats: null,
        error: null,
        diff: null,
        confirmationStatus: 'none',
        confirmedBy: null,
        confirmedAt: null,
        startedAt: new Date(),
        finishedAt: null,
      }),
    )
    const stats: IdentitySyncStats = {
      external: 0,
      created: 0,
      updated: 0,
      deactivated: 0,
      failed: 0,
      pendingDeactivations: 0,
    }
    const diff: IdentitySyncDiff = {
      created: [],
      updated: [],
      deactivated: [],
      pendingDeactivations: [],
      failed: [],
    }
    const requireConfirmation = provider.config?.confirmDeactivations === true
    try {
      const adapter = this.adapters.get(provider.type)
      const external = await adapter.listUsers(provider)
      stats.external = external.length
      const existing = await this.links.find({
        where: { organizationId, providerId: provider.id },
      })
      const byExternal = new Map(existing.map((link) => [link.externalId, link]))
      const seen = new Set<string>()

      for (const record of external) {
        seen.add(record.externalId)
        try {
          const link = byExternal.get(record.externalId)
          if (link) {
            await this.withRetry(async () => {
              link.attributes = record.attributes ?? link.attributes
              link.lastLoginAt = new Date()
              await this.links.save(link)
            })
            if (!record.active) {
              if (requireConfirmation) {
                diff.pendingDeactivations.push({
                  linkId: link.id,
                  userId: link.userId,
                  externalId: link.externalId,
                })
              } else {
                await this.withRetry(() => this.deactivate(organizationId, link.userId))
                stats.deactivated += 1
                diff.deactivated.push(link.externalId)
              }
            } else {
              stats.updated += 1
              diff.updated.push(link.externalId)
            }
            continue
          }
          if (!record.active) continue
          await this.withRetry(async () => {
            const user = await this.resolveUser(organizationId, provider, record)
            await this.links.save(
              this.links.create({
                organizationId,
                providerId: provider.id,
                externalId: record.externalId,
                userId: user.id,
                attributes: record.attributes ?? null,
                lastLoginAt: new Date(),
              }),
            )
          })
          stats.created += 1
          diff.created.push(record.externalId)
        } catch (error) {
          stats.failed += 1
          diff.failed.push({
            externalId: record.externalId,
            reason: error instanceof Error ? error.message : String(error),
          })
        }
      }

      for (const link of existing) {
        if (seen.has(link.externalId)) continue
        if (requireConfirmation) {
          diff.pendingDeactivations.push({
            linkId: link.id,
            userId: link.userId,
            externalId: link.externalId,
          })
          continue
        }
        try {
          await this.withRetry(() => this.deactivate(organizationId, link.userId))
          stats.deactivated += 1
          diff.deactivated.push(link.externalId)
        } catch (error) {
          stats.failed += 1
          diff.failed.push({
            externalId: link.externalId,
            reason: error instanceof Error ? error.message : String(error),
          })
        }
      }

      stats.pendingDeactivations = diff.pendingDeactivations.length
      run.status = stats.failed > 0 ? 'partial' : 'succeeded'
      run.stats = stats as unknown as Record<string, unknown>
      run.diff = diff as unknown as Record<string, unknown>
      run.confirmationStatus = diff.pendingDeactivations.length > 0 ? 'pending' : 'none'
      run.finishedAt = new Date()
      await this.runs.save(run)
      await this.audit(organizationId, 'identity.sync', provider.id, {
        phase: 'sync',
        runId: run.id,
        stats,
        confirmationStatus: run.confirmationStatus,
      })
      return {
        runId: run.id,
        status: run.status,
        stats,
        confirmationStatus: run.confirmationStatus,
        diff,
      }
    } catch (error) {
      run.status = 'failed'
      run.error = { message: error instanceof Error ? error.message : String(error) }
      run.stats = stats as unknown as Record<string, unknown>
      run.diff = diff as unknown as Record<string, unknown>
      run.confirmationStatus = 'none'
      run.finishedAt = new Date()
      await this.runs.save(run)
      await this.audit(organizationId, 'identity.sync', provider.id, {
        phase: 'sync-failed',
        runId: run.id,
        error: run.error,
      })
      return {
        runId: run.id,
        status: 'failed',
        stats,
        confirmationStatus: 'none',
        diff,
      }
    }
  }

  /** 人工确认高风险离职差异；只有 pending 批次可确认。 */
  async confirm(
    organizationId: string,
    runId: string,
    actorId: string,
  ): Promise<IdentitySyncResult> {
    const run = await this.runs.findOne({ where: { id: runId, organizationId } })
    if (!run) throw new NotFoundException('同步批次不存在')
    if (run.confirmationStatus !== 'pending' || run.status === 'running') {
      throw new BadRequestException('同步批次没有待确认的高风险差异')
    }
    const diff = (run.diff ?? {}) as unknown as IdentitySyncDiff
    const stats = (run.stats ?? {}) as unknown as IdentitySyncStats
    const pending = diff.pendingDeactivations ?? []
    for (const item of pending) {
      await this.withRetry(() => this.deactivate(organizationId, item.userId))
      diff.deactivated = [...(diff.deactivated ?? []), item.externalId]
      stats.deactivated = (stats.deactivated ?? 0) + 1
    }
    diff.pendingDeactivations = []
    stats.pendingDeactivations = 0
    run.diff = diff as unknown as Record<string, unknown>
    run.stats = stats as unknown as Record<string, unknown>
    run.confirmationStatus = 'confirmed'
    run.confirmedBy = actorId
    run.confirmedAt = new Date()
    await this.runs.save(run)
    await this.audit(organizationId, 'identity.sync.confirmed', run.providerId, {
      runId,
      actorId,
      confirmed: pending.length,
    })
    return {
      runId,
      status: run.status,
      stats,
      confirmationStatus: 'confirmed',
      diff,
    }
  }

  async listRuns(organizationId: string, providerId?: string) {
    return this.runs.find({
      where: providerId ? { organizationId, providerId } : { organizationId },
      order: { createdAt: 'DESC' },
      take: 50,
    })
  }

  private async resolveUser(
    organizationId: string,
    provider: IdentityProvider,
    record: ExternalIdentity,
  ): Promise<{ id: string }> {
    const existing = await this.users.findByEmail(record.email)
    if (existing) return existing
    const roleId = await this.resolveDefaultRole(organizationId, provider)
    return this.users.create(
      {
        name: record.name ?? record.email.split('@')[0],
        email: record.email,
        password: randomBytes(32).toString('hex'),
        roleId,
      },
      organizationId,
    )
  }

  private async resolveDefaultRole(
    organizationId: string,
    provider: IdentityProvider,
  ): Promise<string | undefined> {
    if (!provider.defaultRoleName) return undefined
    const role = await this.roles.findByName(provider.defaultRoleName, organizationId)
    if (!role) {
      throw new IdentitySourceError(
        `provider ${provider.key} 的默认角色不存在：${provider.defaultRoleName}`,
        'source-failed',
      )
    }
    return role.id
  }

  private async deactivate(organizationId: string, userId: string): Promise<void> {
    await this.users.update(userId, { status: UserStatus.INACTIVE })
    await this.sessions.revokeAll(organizationId, userId, 'identity-sync')
    const bindings = await this.memberRoles.list(organizationId, userId)
    for (const binding of bindings) {
      if (binding.status === 'active') {
        await this.memberRoles.revoke(organizationId, userId, binding.roleName)
      }
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 25 * attempt))
        }
      }
    }
    throw lastError
  }

  private async audit(
    organizationId: string,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLogs?.create({
      organizationId,
      action,
      resource: 'identity_provider',
      resourceId,
      actor: 'system:identity-sync',
      status: metadata.error ? 'failure' : 'success',
      metadata,
      source: 'identity',
    })
  }
}
