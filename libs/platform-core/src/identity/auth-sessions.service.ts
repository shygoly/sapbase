import { Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { MoreThan, Repository } from 'typeorm'
import { createHash, randomUUID } from 'node:crypto'
import { AuthSession } from './auth-session.entity'

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
    return this.repository.findOne({
      where: { sid, status: 'active', expiresAt: MoreThan(new Date()) },
    })
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
    const result = await this.repository.update(
      { sid, status: 'active' },
      { status: 'revoked', revokedAt: new Date(), revokedReason: reason },
    )
    return (result.affected ?? 0) > 0
  }

  async revokeScoped(
    organizationId: string,
    sid: string,
    reason = 'forced-offline',
  ): Promise<boolean> {
    const result = await this.repository.update(
      { organizationId, sid, status: 'active' },
      { status: 'revoked', revokedAt: new Date(), revokedReason: reason },
    )
    return (result.affected ?? 0) > 0
  }

  async revokeAll(
    organizationId: string,
    userId: string,
    reason = 'forced-offline',
  ): Promise<number> {
    const result = await this.repository.update(
      { organizationId, userId, status: 'active' },
      { status: 'revoked', revokedAt: new Date(), revokedReason: reason },
    )
    return result.affected ?? 0
  }

  async list(organizationId: string, userId: string): Promise<AuthSession[]> {
    return this.repository.find({
      where: { organizationId, userId },
      order: { createdAt: 'DESC' },
    })
  }
}
