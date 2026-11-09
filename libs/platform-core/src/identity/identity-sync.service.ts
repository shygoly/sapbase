import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomBytes } from 'node:crypto'
import { UserStatus } from '@speckit/shared-schemas'
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
}

export interface IdentitySyncResult {
  runId: string
  status: 'succeeded' | 'failed' | 'partial'
  stats: IdentitySyncStats
}

/**
 * 身份源同步：外部列表 → identity_links → 用户。
 *
 * - 新增：无 link 时按 email 命中或 JIT 建号（默认角色校验）
 * - 更新：已有 link 的属性刷新
 * - 离职：外部列表缺失 → 停用用户、吊销会话、回收角色
 * - 源不可用 → run failed，**不**做任何降级删除
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
    }
    try {
      const adapter = this.adapters.get(provider.type)
      const external = await adapter.listUsers()
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
            link.attributes = record.attributes ?? link.attributes
            link.lastLoginAt = new Date()
            await this.links.save(link)
            if (!record.active) {
              await this.deactivate(organizationId, link.userId)
              stats.deactivated += 1
            } else {
              stats.updated += 1
            }
            continue
          }
          if (!record.active) continue
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
          stats.created += 1
        } catch {
          stats.failed += 1
        }
      }

      for (const link of existing) {
        if (seen.has(link.externalId)) continue
        try {
          await this.deactivate(organizationId, link.userId)
          stats.deactivated += 1
        } catch {
          stats.failed += 1
        }
      }

      run.status = stats.failed > 0 ? 'partial' : 'succeeded'
      run.stats = stats as unknown as Record<string, unknown>
      run.finishedAt = new Date()
      await this.runs.save(run)
      return { runId: run.id, status: run.status, stats }
    } catch (error) {
      run.status = 'failed'
      run.error = { message: error instanceof Error ? error.message : String(error) }
      run.stats = stats as unknown as Record<string, unknown>
      run.finishedAt = new Date()
      await this.runs.save(run)
      return { runId: run.id, status: 'failed', stats }
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
}
