import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { NotificationPreference } from './notification-preference.entity'
import type { NotificationCategory } from './notification.entity'

export interface UpdatePreferenceInput {
  inApp?: boolean
  email?: boolean
  push?: boolean
  mutedUntil?: Date | null
}

export interface ResolvedPreference {
  inApp: boolean
  email: boolean
  push: boolean
  muted: boolean
}

/**
 * 通知偏好：站内持久化不受偏好影响（mandatory 尤其如此）；
 * 偏好只决定“是否额外投递到 email/push/站内提示”。
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly repository: Repository<NotificationPreference>,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  async list(organizationId: string, userId: string): Promise<NotificationPreference[]> {
    return this.repository.find({
      where: { organizationId, userId },
      order: { category: 'ASC' },
    })
  }

  async upsert(
    organizationId: string,
    userId: string,
    category: NotificationCategory | 'all',
    input: UpdatePreferenceInput,
  ): Promise<NotificationPreference> {
    const existing = await this.repository.findOne({
      where: { organizationId, userId, category },
    })
    let saved: NotificationPreference
    if (existing) {
      if (input.inApp !== undefined) existing.inApp = input.inApp
      if (input.email !== undefined) existing.email = input.email
      if (input.push !== undefined) existing.push = input.push
      if (input.mutedUntil !== undefined) existing.mutedUntil = input.mutedUntil
      saved = await this.repository.save(existing)
    } else {
      saved = await this.repository.save(
        this.repository.create({
          organizationId,
          userId,
          category,
          inApp: input.inApp ?? true,
          email: input.email ?? true,
          push: input.push ?? false,
          mutedUntil: input.mutedUntil ?? null,
        }),
      )
    }
    await this.auditLogs?.create({
      organizationId,
      action: 'notification.preference.update',
      resource: 'notification_preferences',
      resourceId: saved.id,
      actor: userId,
      actorType: 'user',
      status: 'success',
      changes: { ...input },
      metadata: { category },
    })
    return saved
  }

  /**
   * 批量解析：公告扇出时一次取回所有用户的偏好，避免逐用户查询。
   * 返回 Map<userId, ResolvedPreference>；没有行的用户按默认值处理。
   */
  async resolveForUsers(
    organizationId: string,
    userIds: string[],
    category: NotificationCategory,
    mandatory = false,
    now: Date = new Date(),
  ): Promise<Map<string, ResolvedPreference>> {
    const result = new Map<string, ResolvedPreference>()
    if (userIds.length === 0) return result
    const rows = await this.repository.find({
      where: { organizationId, userId: In([...new Set(userIds)]) },
    })
    const byUser = new Map<string, NotificationPreference[]>()
    for (const row of rows) {
      const list = byUser.get(row.userId) ?? []
      list.push(row)
      byUser.set(row.userId, list)
    }
    for (const userId of userIds) {
      if (result.has(userId)) continue
      const userRows = byUser.get(userId) ?? []
      const row =
        userRows.find((item) => item.category === category) ??
        userRows.find((item) => item.category === 'all')
      result.set(userId, {
        ...this.computePreference(row, mandatory, now),
      })
    }
    return result
  }

  /** 分类偏好优先；没有分类行时回退到 all；mandatory 绕过 mute。 */
  async resolve(
    organizationId: string,
    userId: string,
    category: NotificationCategory,
    mandatory = false,
    now: Date = new Date(),
  ): Promise<ResolvedPreference> {
    const rows = await this.repository.find({
      where: { organizationId, userId },
    })
    const specific = rows.find((row) => row.category === category)
    const fallback = rows.find((row) => row.category === 'all')
    return this.computePreference(specific ?? fallback, mandatory, now)
  }

  private computePreference(
    row: NotificationPreference | undefined,
    mandatory: boolean,
    now: Date,
  ): ResolvedPreference {
    const muted =
      !mandatory &&
      Boolean(row?.mutedUntil && new Date(row.mutedUntil).getTime() > now.getTime())
    return {
      inApp: row?.inApp ?? true,
      email: row?.email ?? true,
      push: row?.push ?? false,
      muted,
    }
  }
}
