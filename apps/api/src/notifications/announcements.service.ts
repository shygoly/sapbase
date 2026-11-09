import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { OrganizationMember } from '../organizations/organization-member.entity'
import { OrganizationMemberRole } from '../identity/organization-member-role.entity'
import { NotificationService } from '../websocket/services/notification.service'
import { Announcement, type AnnouncementStatus } from './announcement.entity'
import { AnnouncementAudience } from './announcement-audience.entity'
import { AnnouncementDelivery } from './announcement-delivery.entity'

export interface AnnouncementAudienceInput {
  type: 'role' | 'user' | 'scope_node' | 'scope_subtree'
  value: string
}

export interface CreateAnnouncementInput {
  title: string
  body: string
  audienceType?: Announcement['audienceType']
  audiences?: AnnouncementAudienceInput[]
  publishAt?: Date | null
  expiresAt?: Date | null
}

export interface UpdateAnnouncementInput {
  title?: string
  body?: string
  audienceType?: Announcement['audienceType']
  audiences?: AnnouncementAudienceInput[]
  publishAt?: Date | null
  expiresAt?: Date | null
}

/**
 * 公告：草稿 → 发布（解析 audience → 逐用户投递 + 通知）→ 撤回。
 * audience 解析失败按空集合处理（fail-closed），不向全组织兜底。
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcements: Repository<Announcement>,
    @InjectRepository(AnnouncementAudience)
    private readonly audiences: Repository<AnnouncementAudience>,
    @InjectRepository(AnnouncementDelivery)
    private readonly deliveries: Repository<AnnouncementDelivery>,
    @InjectRepository(OrganizationMember)
    private readonly members: Repository<OrganizationMember>,
    @InjectRepository(OrganizationMemberRole)
    private readonly memberRoles: Repository<OrganizationMemberRole>,
    private readonly notifications: NotificationService,
  ) {}

  async list(organizationId: string, status?: AnnouncementStatus): Promise<Announcement[]> {
    return this.announcements.find({
      where: status ? { organizationId, status } : { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  async get(organizationId: string, id: string): Promise<Announcement> {
    const row = await this.announcements.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('Announcement not found')
    return row
  }

  async create(
    organizationId: string,
    createdBy: string,
    input: CreateAnnouncementInput,
  ): Promise<Announcement> {
    if (!input.title?.trim() || !input.body?.trim()) {
      throw new BadRequestException('公告标题/正文必填')
    }
    const row = await this.announcements.save(
      this.announcements.create({
        organizationId,
        title: input.title.trim(),
        body: input.body,
        status: 'draft',
        audienceType: input.audienceType ?? 'all',
        publishAt: input.publishAt ?? null,
        expiresAt: input.expiresAt ?? null,
        publishedAt: null,
        withdrawnAt: null,
        createdBy,
      }),
    )
    await this.replaceAudiences(organizationId, row.id, input.audiences ?? [])
    return row
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateAnnouncementInput,
  ): Promise<Announcement> {
    const row = await this.get(organizationId, id)
    if (row.status !== 'draft' && row.status !== 'scheduled') {
      throw new ConflictException(`公告状态 ${row.status} 不允许编辑`)
    }
    if (input.title !== undefined) row.title = input.title.trim()
    if (input.body !== undefined) row.body = input.body
    if (input.audienceType !== undefined) row.audienceType = input.audienceType
    if (input.publishAt !== undefined) row.publishAt = input.publishAt
    if (input.expiresAt !== undefined) row.expiresAt = input.expiresAt
    const saved = await this.announcements.save(row)
    if (input.audiences !== undefined) {
      await this.replaceAudiences(organizationId, id, input.audiences)
    }
    return saved
  }

  async publish(organizationId: string, id: string): Promise<{ announcement: Announcement; delivered: number }> {
    const row = await this.get(organizationId, id)
    if (row.status === 'published') {
      const count = await this.deliveries.count({ where: { organizationId, announcementId: id } })
      return { announcement: row, delivered: count }
    }
    if (row.status !== 'draft' && row.status !== 'scheduled') {
      throw new ConflictException(`公告状态 ${row.status} 不能发布`)
    }
    const userIds = await this.resolveAudience(organizationId, row)
    let delivered = 0
    for (const userId of userIds) {
      await this.notifications.sendToUser(
        userId,
        {
          organizationId,
          type: 'info',
          title: row.title,
          message: row.body,
          category: 'announcement',
          priority: 'normal',
          mandatory: true,
          actionUrl: `/announcements/${row.id}`,
          data: { announcementId: row.id },
        },
        `announcement:${row.id}`,
      )
      const existing = await this.deliveries.findOne({
        where: { organizationId, announcementId: row.id, userId },
      })
      if (!existing) {
        await this.deliveries.save(
          this.deliveries.create({
            organizationId,
            announcementId: row.id,
            userId,
            status: 'delivered',
            deliveredAt: new Date(),
            readAt: null,
            error: null,
          }),
        )
      } else if (existing.status === 'pending' || existing.status === 'failed') {
        existing.status = 'delivered'
        existing.deliveredAt = new Date()
        existing.error = null
        await this.deliveries.save(existing)
      }
      delivered += 1
    }
    row.status = 'published'
    row.publishedAt = new Date()
    await this.announcements.save(row)
    return { announcement: row, delivered }
  }

  async withdraw(organizationId: string, id: string): Promise<Announcement> {
    const row = await this.get(organizationId, id)
    if (row.status !== 'published' && row.status !== 'scheduled') {
      throw new ConflictException(`公告状态 ${row.status} 不能撤回`)
    }
    row.status = 'withdrawn'
    row.withdrawnAt = new Date()
    return this.announcements.save(row)
  }

  async markRead(organizationId: string, id: string, userId: string): Promise<boolean> {
    const delivery = await this.deliveries.findOne({
      where: { organizationId, announcementId: id, userId },
    })
    if (!delivery) return false
    delivery.status = 'read'
    delivery.readAt = new Date()
    await this.deliveries.save(delivery)
    return true
  }

  async stats(organizationId: string, id: string) {
    await this.get(organizationId, id)
    const rows = await this.deliveries.find({ where: { organizationId, announcementId: id } })
    const stats = { total: rows.length, delivered: 0, read: 0, failed: 0 }
    for (const row of rows) {
      if (row.status === 'read') {
        stats.read += 1
        stats.delivered += 1
      } else if (row.status === 'delivered') {
        stats.delivered += 1
      } else if (row.status === 'failed') {
        stats.failed += 1
      }
    }
    return stats
  }

  private async replaceAudiences(
    organizationId: string,
    announcementId: string,
    audiences: AnnouncementAudienceInput[],
  ): Promise<void> {
    await this.audiences.delete({ organizationId, announcementId })
    for (const audience of audiences) {
      if (
        audience.type === 'scope_node' ||
        audience.type === 'scope_subtree'
      ) {
        throw new BadRequestException(
          `audience ${audience.type} 尚未启用（等待数据范围 audience 适配）`,
        )
      }
      await this.audiences.save(
        this.audiences.create({
          organizationId,
          announcementId,
          audienceType: audience.type,
          audienceValue: audience.value,
        }),
      )
    }
  }

  private async resolveAudience(
    organizationId: string,
    announcement: Announcement,
  ): Promise<string[]> {
    const rows = await this.audiences.find({
      where: { organizationId, announcementId: announcement.id },
    })
    if (rows.length === 0) {
      if (announcement.audienceType === 'all') {
        const members = await this.members.find({ where: { organizationId } })
        return [...new Set(members.map((member) => member.userId))]
      }
      return []
    }
    const users = new Set<string>()
    for (const row of rows) {
      if (row.audienceType === 'user') {
        users.add(row.audienceValue)
        continue
      }
      if (row.audienceType === 'role') {
        const bindings = await this.memberRoles.find({
          where: {
            organizationId,
            roleName: In(rows.filter((item) => item.audienceType === 'role').map((item) => item.audienceValue)),
            status: 'active',
          },
        })
        for (const binding of bindings) users.add(binding.userId)
        continue
      }
      // scope audience 未启用：fail-closed，不兜底全组织
    }
    return [...users]
  }
}
