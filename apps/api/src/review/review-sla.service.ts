import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { IsNull, Not, Repository } from 'typeorm'
import { OrganizationMemberRole } from '../identity/organization-member-role.entity'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { NotificationService } from '../websocket/services/notification.service'
import { WorkItemsService } from './work-items.service'

const REMIND_BEFORE_MS = 24 * 60 * 60 * 1000

/**
 * 审批 SLA 扫描：到期前提醒 + 超时升级。
 * 幂等由 `reminderSentAt` / `escalatedAt` 保证；无审批人时告警管理员，不静默通过。
 */
@Injectable()
export class ReviewSlaService {
  private readonly logger = new Logger(ReviewSlaService.name)

  constructor(
    @InjectRepository(BlueprintApproval)
    private readonly approvals: Repository<BlueprintApproval>,
    @InjectRepository(OrganizationMemberRole)
    private readonly memberRoles: Repository<OrganizationMemberRole>,
    private readonly notifications: NotificationService,
    private readonly workItems: WorkItemsService,
  ) {}

  @Cron('*/10 * * * *', { name: 'review.sla_scan' })
  async scan(now: Date = new Date()): Promise<{ reminded: number; escalated: number }> {
    const rows = await this.approvals.find({
      where: { status: 'pending', dueAt: Not(IsNull()) },
    })
    let reminded = 0
    let escalated = 0
    for (const approval of rows) {
      if (!approval.dueAt) continue
      const due = approval.dueAt.getTime()
      if (due > now.getTime() + REMIND_BEFORE_MS) continue
      const recipients = await this.resolveRecipients(approval)
      if (due > now.getTime() && !approval.reminderSentAt) {
        await this.notify(
          approval,
          recipients,
          'warning',
          '审批即将到期',
          `审批 ${approval.entity}:${approval.recordId} 将在 ${approval.dueAt.toISOString()} 到期`,
        )
        approval.reminderSentAt = now
        await this.approvals.save(approval)
        reminded += 1
      }
      if (due <= now.getTime() && !approval.escalatedAt) {
        await this.notify(
          approval,
          recipients,
          'error',
          '审批已超时，升级处理',
          `审批 ${approval.entity}:${approval.recordId} 已超时，需管理员或上级处理`,
        )
        approval.escalatedAt = now
        await this.approvals.save(approval)
        await this.workItems.project({
          organizationId: approval.organizationId,
          sourceType: 'approval',
          sourceId: approval.id,
          title: `超时审批 ${approval.entity}:${approval.recordId}`,
          priority: 'urgent',
          dueAt: approval.dueAt,
          metadata: { ruleId: approval.ruleId, round: approval.round, escalated: true },
        })
        escalated += 1
      }
    }
    return { reminded, escalated }
  }

  private async resolveRecipients(approval: BlueprintApproval): Promise<string[]> {
    const escalationRole = process.env.REVIEW_ESCALATION_ROLE || 'Admin'
    const roles = [approval.role, escalationRole].filter(Boolean)
    const rows = await this.memberRoles.find({
      where: {
        organizationId: approval.organizationId,
        roleName: Not(IsNull()),
        status: 'active',
      },
    })
    const users = [
      ...new Set(
        rows
          .filter((row) => roles.includes(row.roleName))
          .map((row) => row.userId),
      ),
    ]
    if (users.length === 0) {
      this.logger.warn(
        `审批无审批人：approval=${approval.id} role=${approval.role} org=${approval.organizationId}`,
      )
    }
    return users
  }

  private async notify(
    approval: BlueprintApproval,
    recipients: string[],
    type: 'warning' | 'error',
    title: string,
    message: string,
  ): Promise<void> {
    for (const userId of recipients) {
      await this.notifications.sendToUser(
        userId,
        {
          organizationId: approval.organizationId,
          type,
          title,
          message,
          category: 'approval',
          priority: 'high',
          actionUrl: '/dashboard/work-items',
          data: { approvalId: approval.id, ruleId: approval.ruleId, round: approval.round },
        },
        randomUUID(),
      )
    }
  }
}
