import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
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
    if (existing) {
      if (input.inApp !== undefined) existing.inApp = input.inApp
      if (input.email !== undefined) existing.email = input.email
      if (input.push !== undefined) existing.push = input.push
      if (input.mutedUntil !== undefined) existing.mutedUntil = input.mutedUntil
      return this.repository.save(existing)
    }
    return this.repository.save(
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
    const row = specific ?? fallback
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
