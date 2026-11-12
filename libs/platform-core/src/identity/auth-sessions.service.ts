import { Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import type { Cache } from 'cache-manager'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { InjectRepository } from '@nestjs/typeorm'
import { MoreThan, Repository } from 'typeorm'
import { createHash, randomUUID } from 'node:crypto'
import { AuthSession } from './auth-session.entity'
import {
  SESSION_REVOCATION_BUS,
  type SessionRevocationBus,
} from './session-revocation.bus'

export interface CreateSessionInput {
  organizationId: string
  userId: string
  sid?: string
  ip?: string | null
  userAgent?: string | null
  ttlMs?: number
  refreshTokenHash?: string | null
  /** 同组织同用户活跃会话上限；0/缺省表示不限制。 */
  maxSessionsPerUser?: number
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * 持久会话：JWT 只携带 sid，吊销/过期以本表为准。
 * 旧 token 没有 sid 时保持兼容（无状态 JWT），新登录必须带 sid。
 */
@Injectable()
export class AuthSessionsService {
  constructor(
    @InjectRepository(AuthSession)
    private readonly repository: Repository<AuthSession>,
    @Optional() private readonly auditLogs?: AuditLogsService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cache?: Cache,
    @Optional()
    @Inject(SESSION_REVOCATION_BUS)
    private readonly revocationBus?: SessionRevocationBus,
  ) {}

  async create(input: CreateSessionInput): Promise<AuthSession> {
    const maxSessions =
      input.maxSessionsPerUser ??
      Number(process.env.AUTH_MAX_SESSIONS_PER_USER ?? 0)
    if (Number.isFinite(maxSessions) && maxSessions > 0) {
      const active = await this.repository.find({
        where: { organizationId: input.organizationId, userId: input.userId, status: 'active' },
        order: { createdAt: 'ASC' },
      })
      const overflow = active.length - maxSessions + 1
      for (const session of active.slice(0, Math.max(0, overflow))) {
        await this.repository.update(
          { id: session.id },
          { status: 'revoked', revokedAt: new Date(), revokedReason: 'session-limit' },
        )
      }
    }
    const row = this.repository.create({
      organizationId: input.organizationId,
      userId: input.userId,
      sid: input.sid ?? randomUUID(),
      refreshTokenHash: input.refreshTokenHash ?? null,
      status: 'active',
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      expiresAt: new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS)),
      lastSeenAt: new Date(),
      revokedAt: null,
      revokedReason: null,
    })
    return this.repository.save(row)
  }

  async findActive(sid: string): Promise<AuthSession | null> {
    const cacheKey = this.cacheKey(sid)
    const cached = await this.cache?.get<AuthSession>(cacheKey)
    if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
      return cached
    }
    const row = await this.repository.findOne({
      where: { sid, status: 'active', expiresAt: MoreThan(new Date()) },
    })
    if (row) {
      const ttl = Math.max(
        1000,
        Math.min(30_000, new Date(row.expiresAt).getTime() - Date.now()),
      )
      await this.cache?.set(cacheKey, row, ttl)
    }
    return row
  }

  async assertActive(sid: string): Promise<AuthSession> {
    const session = await this.findActive(sid)
    if (!session) {
      throw new UnauthorizedException('会话已失效，请重新登录')
    }
    await this.repository.update({ id: session.id }, { lastSeenAt: new Date() })
    return session
  }

  async rotateRefresh(sid: string, refreshTokenHash: string): Promise<AuthSession> {
    const session = await this.assertActive(sid)
    session.refreshTokenHash = refreshTokenHash
    return this.repository.save(session)
  }

  async revoke(sid: string, reason = 'logout'): Promise<boolean> {
    const row = await this.repository.findOne({ where: { sid, status: 'active' } })
    const result = await this.repository.update(
      { sid, status: 'active' },
      { status: 'revoked', revokedAt: new Date(), revokedReason: reason },
    )
    await this.cache?.del(this.cacheKey(sid))
    if (row) {
      this.revocationBus?.publish({
        sid,
        userId: row.userId,
        organizationId: row.organizationId,
        reason,
      })
      await this.auditLogs?.create({
        organizationId: row.organizationId,
        action: 'auth.session.revoked',
        resource: 'session',
        resourceId: row.userId,
        actor: 'system:session',
        status: 'success',
        metadata: { sid, reason },
        source: 'auth',
      })
    }
    return (result.affected ?? 0) > 0
  }

  async revokeScoped(
    organizationId: string,
    sid: string,
    reason = 'forced-offline',
  ): Promise<boolean> {
    const row = await this.repository.findOne({
      where: { organizationId, sid, status: 'active' },
    })
    const result = await this.repository.update(
      { organizationId, sid, status: 'active' },
      { status: 'revoked', revokedAt: new Date(), revokedReason: reason },
    )
    await this.cache?.del(this.cacheKey(sid))
    if ((result.affected ?? 0) > 0) {
      this.revocationBus?.publish({
        sid,
        userId: row?.userId,
        organizationId,
        reason,
      })
      await this.auditLogs?.create({
        organizationId,
        action: 'auth.session.revoked',
        resource: 'session',
        resourceId: sid,
        actor: 'system:session',
        status: 'success',
        metadata: { reason, scope: 'sid' },
        source: 'auth',
      })
    }
    return (result.affected ?? 0) > 0
  }

  async revokeAll(
    organizationId: string,
    userId: string,
    reason = 'forced-offline',
  ): Promise<number> {
    const active = await this.repository.find({
      where: { organizationId, userId, status: 'active' },
    })
    const result = await this.repository.update(
      { organizationId, userId, status: 'active' },
      { status: 'revoked', revokedAt: new Date(), revokedReason: reason },
    )
    await this.clearCache(active)
    if ((result.affected ?? 0) > 0) {
      this.revocationBus?.publish({ userId, organizationId, reason })
      await this.auditLogs?.create({
        organizationId,
        action: 'auth.session.revoked',
        resource: 'session',
        resourceId: userId,
        actor: 'system:session',
        status: 'success',
        metadata: { reason, scope: 'all', revoked: result.affected },
        source: 'auth',
      })
    }
    return result.affected ?? 0
  }

  /** 密码/角色/账号状态变化：跨组织吊销该用户全部会话。 */
  async revokeAllForUser(userId: string, reason = 'security-change'): Promise<number> {
    const active = await this.repository.find({
      where: { userId, status: 'active' },
    })
    const result = await this.repository.update(
      { userId, status: 'active' },
      { status: 'revoked', revokedAt: new Date(), revokedReason: reason },
    )
    await this.clearCache(active)
    if ((result.affected ?? 0) > 0) {
      this.revocationBus?.publish({ userId, reason })
      const organizations = [...new Set(active.map((row) => row.organizationId))]
      for (const organizationId of organizations) {
        await this.auditLogs?.create({
          organizationId,
          action: 'auth.session.revoked',
          resource: 'session',
          resourceId: userId,
          actor: 'system:security',
          status: 'success',
          metadata: { reason, scope: 'user-all', revoked: active.length },
          source: 'auth',
        })
      }
    }
    return result.affected ?? 0
  }

  private cacheKey(sid: string): string {
    return `auth:session:${sid}`
  }

  private async clearCache(rows: AuthSession[]): Promise<void> {
    for (const row of rows) {
      await this.cache?.del(this.cacheKey(row.sid))
    }
  }

  async list(organizationId: string, userId: string): Promise<AuthSession[]> {
    return this.repository.find({
      where: { organizationId, userId },
      order: { createdAt: 'DESC' },
    })
  }
}
