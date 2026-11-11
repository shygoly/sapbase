import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, Like, Repository } from 'typeorm'
import { ScopeMembership } from '@sap/platform-core/data-scope/entities/scope-membership.entity'
import { ScopeNode } from '@sap/platform-core/data-scope/entities/scope-node.entity'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import { OrganizationMember } from '../organizations/organization-member.entity'
import { OrganizationMemberRole } from '../identity/organization-member-role.entity'
import { EventBusService } from '../common/events/event-bus.service'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { NotificationService } from '../websocket/services/notification.service'
import { Announcement, type AnnouncementStatus } from './announcement.entity'
import { AnnouncementAudience } from './announcement-audience.entity'
import { AnnouncementDelivery } from './announcement-delivery.entity'

export interface AnnouncementAudienceInput {
  type: 'role' | 'user' | 'scope_node' | 'scope_subtree'
  value: string
}

export interface AnnouncementAttachment {
  name: string
  url: string
}

export interface CreateAnnouncementInput {
  title: string
  body: string
  audienceType?: Announcement['audienceType']
  audiences?: AnnouncementAudienceInput[]
  publishAt?: Date | null
  expiresAt?: Date | null
  retentionDays?: number
  attachments?: AnnouncementAttachment[]
}

export interface UpdateAnnouncementInput {
  title?: string
  body?: string
  audienceType?: Announcement['audienceType']
  audiences?: AnnouncementAudienceInput[]
  publishAt?: Date | null
  expiresAt?: Date | null
  retentionDays?: number
  attachments?: AnnouncementAttachment[]
}

export interface PublishOptions {
  /** 忽略 publishAt，立即扇出（cron 到期发布与手动“立即发布”）。 */
  force?: boolean
  /** 任务 handler 调用时传入，禁止再次入队。 */
  fromJob?: boolean
}

export interface AnnouncementFanoutContext {
  progress(progress: number, payload?: Record<string, unknown>): Promise<void>
  isCancelled?(): Promise<boolean>
}

export type AnnouncementPublishResult = {
  announcement: Announcement
  delivered: number
  scheduled?: boolean
  queued?: boolean
  jobId?: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FANOUT_CHUNK_SIZE = 100
/** 超过该人数走 async-job 扇出，避免 HTTP 请求内长时间占用。 */
const DEFAULT_FANOUT_JOB_THRESHOLD = 200

/**
 * 公告：草稿 → 发布（解析 audience → 逐用户投递 + 通知）→ 撤回。
 * audience 解析失败按空集合处理（fail-closed），不向全组织兜底。
 *
 * 大组织发布走 `notification.announcement_fanout` 任务（进度/取消/重试），
 * delivery 按 (announcementId,userId) 幂等，重复发布不会重复投递。
 */
@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name)
  private readonly publishWindows = new Map<string, number[]>()

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
    @InjectRepository(ScopeNode)
    private readonly scopeNodes: Repository<ScopeNode>,
    @InjectRepository(ScopeMembership)
    private readonly scopeMemberships: Repository<ScopeMembership>,
    private readonly notifications: NotificationService,
    @Optional() private readonly jobs?: JobsService,
    @Optional() private readonly eventBus?: EventBusService,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  async list(organizationId: string, status?: AnnouncementStatus): Promise<Announcement[]> {
    return this.announcements.find({
      where: {
        organizationId,
        deletedAt: IsNull(),
        ...(status ? { status } : {}),
      },
      order: { createdAt: 'DESC' },
    })
  }

  async get(organizationId: string, id: string): Promise<Announcement> {
    const row = await this.announcements.findOne({
      where: { id, organizationId, deletedAt: IsNull() },
    })
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
        retentionDays: this.normalizeRetentionDays(input.retentionDays),
        attachments: this.normalizeAttachments(input.attachments),
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
    if (input.retentionDays !== undefined) {
      row.retentionDays = this.normalizeRetentionDays(input.retentionDays)
    }
    if (input.attachments !== undefined) {
      row.attachments = this.normalizeAttachments(input.attachments)
    }
    const saved = await this.announcements.save(row)
    if (input.audiences !== undefined) {
      await this.replaceAudiences(organizationId, id, input.audiences)
    }
    return saved
  }

  /** 复制为草稿：正文/受众/附件/保留期复用，发布时间清空。 */
  async copy(
    organizationId: string,
    id: string,
    createdBy: string,
  ): Promise<Announcement> {
    const source = await this.get(organizationId, id)
    const audienceRows = await this.audiences.find({
      where: { organizationId, announcementId: id },
    })
    return this.create(organizationId, createdBy, {
      title: `副本 - ${source.title}`.slice(0, 255),
      body: source.body,
      audienceType: source.audienceType,
      audiences: audienceRows.map((row) => ({
        type: row.audienceType,
        value: row.audienceValue,
      })),
      retentionDays: source.retentionDays,
      attachments: source.attachments ?? [],
    })
  }

  /**
   * 软删除：已发布公告必须先撤回；delivery 一起软删除，统计与审计仍可追溯。
   */
  async remove(organizationId: string, id: string): Promise<{ id: string; deleted: true }> {
    const row = await this.get(organizationId, id)
    if (row.status === 'published') {
      throw new ConflictException('已发布公告请先撤回再删除')
    }
    const now = new Date()
    row.deletedAt = now
    await this.announcements.save(row)
    await this.deliveries.update({ organizationId, announcementId: id }, { deletedAt: now })
    return { id, deleted: true }
  }

  async publish(
    organizationId: string,
    id: string,
    options: PublishOptions = {},
  ): Promise<AnnouncementPublishResult> {
    const row = await this.get(organizationId, id)
    if (!options.fromJob) this.assertPublishRate(organizationId)
    if (row.status === 'published') {
      const count = await this.deliveries.count({
        where: { organizationId, announcementId: id, deletedAt: IsNull() },
      })
      return { announcement: row, delivered: count }
    }
    if (row.status !== 'draft' && row.status !== 'scheduled') {
      throw new ConflictException(`公告状态 ${row.status} 不能发布`)
    }

    if (!options.force && row.publishAt && row.publishAt.getTime() > Date.now()) {
      if (row.status !== 'scheduled') {
        row.status = 'scheduled'
        await this.announcements.save(row)
      }
      return { announcement: row, delivered: 0, scheduled: true }
    }

    const userIds = await this.resolveAudience(organizationId, row)
    const useJob =
      !options.fromJob &&
      this.jobs &&
      process.env.JOBS_WORKER_ENABLED === 'true' &&
      userIds.length > this.fanoutJobThreshold()

    if (useJob && this.jobs) {
      row.status = 'published'
      row.publishedAt = new Date()
      await this.announcements.save(row)
      await this.dispatchPublished(organizationId, row.id)
      const { job } = await this.jobs.create(
        organizationId,
        { userId: row.createdBy ?? 'system', permissions: ['announcements:publish'] },
        {
          type: 'notification.announcement_fanout',
          payload: { announcementId: row.id },
          idempotencyKey: `announcement-fanout:${row.id}`,
        },
      )
      this.logger.log(
        `公告 ${row.id} 扇出入队：${userIds.length} 人，job=${job.id}`,
      )
      return { announcement: row, delivered: 0, queued: true, jobId: job.id }
    }

    // 同步扇出成功后才置 published；中途失败可重试，已投递用户按幂等键跳过。
    const delivered = await this.fanout(organizationId, row, userIds)
    row.status = 'published'
    row.publishedAt = new Date()
    await this.announcements.save(row)
    await this.dispatchPublished(organizationId, row.id)
    await this.auditLogs?.create({
      organizationId,
      action: 'announcement.publish',
      resource: 'announcement',
      resourceId: row.id,
      actor: row.createdBy ?? 'system',
      status: 'success',
      metadata: { audienceType: row.audienceType, delivered },
      source: 'announcement',
    })
    return { announcement: row, delivered }
  }

  /**
   * 逐批写通知 + delivery。任务 handler 复用；重复执行按幂等键/唯一键安全。
   */
  async fanout(
    organizationId: string,
    announcement: Announcement,
    userIds?: string[],
    ctx?: AnnouncementFanoutContext,
  ): Promise<number> {
    const recipients = userIds ?? (await this.resolveAudience(organizationId, announcement))
    if (recipients.length === 0) {
      await ctx?.progress(100, { delivered: 0 })
      return 0
    }
    let delivered = 0
    const total = recipients.length
    for (let index = 0; index < total; index += FANOUT_CHUNK_SIZE) {
      if (ctx?.isCancelled && (await ctx.isCancelled())) {
        this.logger.warn(`公告 ${announcement.id} 扇出已取消：${delivered}/${total}`)
        break
      }
      const chunk = recipients.slice(index, index + FANOUT_CHUNK_SIZE)
      await this.notifications.sendToUsers(
        chunk,
        {
          organizationId,
          type: 'info',
          title: announcement.title,
          message: announcement.body,
          category: 'announcement',
          priority: 'normal',
          mandatory: true,
          actionUrl: `/announcements/${announcement.id}`,
          data: { announcementId: announcement.id },
        },
        announcement.id,
      )
      await this.recordDeliveries(organizationId, announcement.id, chunk)
      delivered += chunk.length
      await ctx?.progress(Math.min(99, Math.round((delivered / total) * 100)), {
        delivered,
        total,
      })
    }
    await ctx?.progress(100, { delivered, total })
    return delivered
  }

  /**
   * cron 到期发布：只处理 publishAt <= now 的 scheduled 公告。
   */
  async publishDue(now: Date = new Date(), limit = 20): Promise<number> {
    const rows = await this.announcements.find({
      where: { status: 'scheduled', deletedAt: IsNull() },
      order: { publishAt: 'ASC' },
      take: limit,
    })
    let published = 0
    for (const row of rows) {
      if (!row.publishAt || row.publishAt.getTime() > now.getTime()) continue
      try {
        await this.publish(row.organizationId, row.id, { force: true })
        published += 1
      } catch (error) {
        this.logger.error(
          `定时发布失败 announcement=${row.id}: ${(error as Error).message}`,
        )
      }
    }
    return published
  }

  async withdraw(organizationId: string, id: string): Promise<Announcement> {
    const row = await this.get(organizationId, id)
    if (row.status !== 'published' && row.status !== 'scheduled') {
      throw new ConflictException(`公告状态 ${row.status} 不能撤回`)
    }
    row.status = 'withdrawn'
    row.withdrawnAt = new Date()
    const saved = await this.announcements.save(row)
    await this.auditLogs?.create({
      organizationId,
      action: 'announcement.withdraw',
      resource: 'announcement',
      resourceId: saved.id,
      actor: saved.createdBy ?? 'system',
      status: 'success',
      source: 'announcement',
    })
    return saved
  }

  async markRead(organizationId: string, id: string, userId: string): Promise<boolean> {
    const delivery = await this.deliveries.findOne({
      where: { organizationId, announcementId: id, userId, deletedAt: IsNull() },
    })
    if (!delivery) return false
    delivery.status = 'read'
    delivery.readAt = new Date()
    await this.deliveries.save(delivery)
    return true
  }

  async stats(organizationId: string, id: string) {
    await this.get(organizationId, id)
    const rows = await this.deliveries.find({
      where: { organizationId, announcementId: id, deletedAt: IsNull() },
    })
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

  async deliveriesPage(
    organizationId: string,
    id: string,
    input: { page?: number; pageSize?: number; status?: string } = {},
  ) {
    await this.get(organizationId, id)
    const page = Math.max(1, Number(input.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 20))
    const where: Record<string, unknown> = {
      organizationId,
      announcementId: id,
      deletedAt: IsNull(),
    }
    if (input.status) where.status = input.status
    const [items, total] = await this.deliveries.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return { items, total, page, pageSize }
  }

  private async recordDeliveries(
    organizationId: string,
    announcementId: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) return
    const existing = await this.deliveries.find({
      where: { organizationId, announcementId, userId: In(userIds) },
    })
    const byUser = new Map(existing.map((row) => [row.userId, row]))
    const now = new Date()
    const toCreate: AnnouncementDelivery[] = []
    for (const userId of userIds) {
      const row = byUser.get(userId)
      if (!row) {
        toCreate.push(
          this.deliveries.create({
            organizationId,
            announcementId,
            userId,
            status: 'delivered',
            deliveredAt: now,
            readAt: null,
            error: null,
            deletedAt: null,
          }),
        )
      } else if (row.status === 'pending' || row.status === 'failed') {
        row.status = 'delivered'
        row.deliveredAt = now
        row.error = null
        row.deletedAt = null
        await this.deliveries.save(row)
      }
    }
    if (toCreate.length > 0) {
      await this.deliveries.save(toCreate)
    }
  }

  private async replaceAudiences(
    organizationId: string,
    announcementId: string,
    audiences: AnnouncementAudienceInput[],
  ): Promise<void> {
    await this.audiences.delete({ organizationId, announcementId })
    for (const audience of audiences) {
      const value = audience.value?.trim()
      if (!value) {
        throw new BadRequestException(`audience ${audience.type} 的 value 不能为空`)
      }
      if (audience.type === 'scope_node' || audience.type === 'scope_subtree') {
        await this.assertScopeNode(organizationId, value)
      }
      await this.audiences.save(
        this.audiences.create({
          organizationId,
          announcementId,
          audienceType: audience.type,
          audienceValue: value,
        }),
      )
    }
  }

  private async assertScopeNode(organizationId: string, nodeId: string): Promise<ScopeNode> {
    if (!UUID_PATTERN.test(nodeId)) {
      throw new BadRequestException(`scope 节点 id 非法：${nodeId}`)
    }
    const node = await this.scopeNodes.findOne({ where: { id: nodeId, organizationId } })
    if (!node) {
      // 跨租户与不存在统一 404，避免泄露其他组织节点是否存在
      throw new NotFoundException('Scope node not found')
    }
    return node
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
    const roles = new Set<string>()
    const nodeIds = new Set<string>()

    for (const row of rows) {
      if (row.audienceType === 'user') {
        users.add(row.audienceValue)
      } else if (row.audienceType === 'role') {
        roles.add(row.audienceValue)
      } else if (row.audienceType === 'scope_node') {
        nodeIds.add(row.audienceValue)
      } else if (row.audienceType === 'scope_subtree') {
        const node = await this.scopeNodes.findOne({
          where: { id: row.audienceValue, organizationId },
        })
        if (!node) continue
        const descendants = await this.scopeNodes.find({
          where: {
            organizationId,
            dimensionId: node.dimensionId,
            path: Like(`${node.path}/%`),
          },
        })
        nodeIds.add(node.id)
        for (const child of descendants) nodeIds.add(child.id)
      }
    }

    if (nodeIds.size > 0) {
      const memberships = await this.scopeMemberships.find({
        where: { organizationId, nodeId: In([...nodeIds]) },
      })
      const now = Date.now()
      for (const membership of memberships) {
        if (membership.validFrom && membership.validFrom.getTime() > now) continue
        if (membership.validTo && membership.validTo.getTime() <= now) continue
        if (membership.subjectType === 'user') {
          users.add(membership.subjectId)
        } else if (membership.subjectType === 'role') {
          roles.add(membership.subjectId)
        }
      }
    }

    if (roles.size > 0) {
      const bindings = await this.memberRoles.find({
        where: {
          organizationId,
          roleName: In([...roles]),
          status: 'active',
        },
      })
      for (const binding of bindings) users.add(binding.userId)
    }

    return [...users]
  }

  private async dispatchPublished(organizationId: string, announcementId: string): Promise<void> {
    await this.eventBus?.dispatchToSubscribers('announcement.published', {
      organizationId,
      announcementId,
    })
  }

  private normalizeRetentionDays(value: number | undefined): number {
    if (value === undefined) return 30
    if (!Number.isFinite(value) || value < 1 || value > 3650) {
      throw new BadRequestException('保留期必须是 1–3650 天')
    }
    return Math.round(value)
  }

  private normalizeAttachments(
    attachments: AnnouncementAttachment[] | undefined,
  ): AnnouncementAttachment[] | null {
    if (!attachments || attachments.length === 0) return null
    if (attachments.length > 20) {
      throw new BadRequestException('附件最多 20 个')
    }
    return attachments.map((attachment) => {
      const name = attachment.name?.trim()
      if (!name || name.length > 120) {
        throw new BadRequestException('附件名称必填且不超过 120 字')
      }
      let url: URL
      try {
        url = new URL(attachment.url)
      } catch {
        throw new BadRequestException(`附件链接非法：${attachment.url}`)
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new BadRequestException('附件链接只允许 http/https')
      }
      return { name, url: url.toString() }
    })
  }

  /** 单组织每分钟最多 30 次发布尝试；防止脚本反复触发扇出。 */
  private assertPublishRate(organizationId: string): void {
    const now = Date.now()
    const window = (this.publishWindows.get(organizationId) ?? []).filter(
      (timestamp) => now - timestamp < 60_000,
    )
    if (window.length >= 30) {
      throw new HttpException('公告发布过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS)
    }
    window.push(now)
    this.publishWindows.set(organizationId, window)
  }

  private fanoutJobThreshold(): number {
    const value = Number(process.env.ANNOUNCEMENT_FANOUT_JOB_THRESHOLD)
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_FANOUT_JOB_THRESHOLD
  }
}
