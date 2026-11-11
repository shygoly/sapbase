import { Injectable, Logger, Optional } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { OrganizationMemberRole } from '../identity/organization-member-role.entity'
import { ScopeBinding } from '@sap/platform-core/data-scope/entities/scope-binding.entity'
import { ScopeMembership } from '@sap/platform-core/data-scope/entities/scope-membership.entity'
import type { AssigneeSelector, RecordAnchorContext } from './assignee-selector'
import { NotificationService } from '../websocket/services/notification.service'

export interface AssigneeResolution {
  assignees: string[]
  /** 解析失败/为空时的告警；调用方必须阻塞，不得自动跳过。 */
  warning: string | null
}

/**
 * 审批人解析：role / user / position / creator。
 *
 * position + anchor=record：
 *   1. 按资源键找 `scope_bindings` 的字段绑定（dimension 可选收窄）；
 *   2. 从记录对应字段取 scope 节点 id；
 *   3. 查该节点上 `positionKey` 的活跃成员。
 *
 * 解析为空必须告警并阻塞（fail-closed），不自动跳过步骤。
 */
@Injectable()
export class ReviewAssigneeService {
  private readonly logger = new Logger(ReviewAssigneeService.name)

  constructor(
    @InjectRepository(OrganizationMemberRole)
    private readonly memberRoles: Repository<OrganizationMemberRole>,
    @InjectRepository(ScopeMembership)
    private readonly memberships: Repository<ScopeMembership>,
    @InjectRepository(ScopeBinding)
    private readonly bindings?: Repository<ScopeBinding>,
    @Optional()
    private readonly notifications?: NotificationService,
  ) {}

  async resolve(
    organizationId: string,
    selector: AssigneeSelector,
    record?: RecordAnchorContext,
  ): Promise<string[]> {
    return (await this.resolveWithAlert(organizationId, selector, record)).assignees
  }

  async resolveWithAlert(
    organizationId: string,
    selector: AssigneeSelector,
    record?: RecordAnchorContext,
  ): Promise<AssigneeResolution> {
    const assignees = await this.resolveRaw(organizationId, selector, record)
    const unique = [...new Set(assignees.filter(Boolean))]
    if (unique.length > 0) return { assignees: unique, warning: null }
    const warning = `审批人解析为空：selector=${JSON.stringify(selector)}`
    this.logger.warn(`${warning} org=${organizationId}`)
    await this.alertNoAssignee(organizationId, warning)
    return { assignees: [], warning }
  }

  private async resolveRaw(
    organizationId: string,
    selector: AssigneeSelector,
    record?: RecordAnchorContext,
  ): Promise<string[]> {
    switch (selector.kind) {
      case 'user':
        return [selector.userId]
      case 'creator':
        return record?.creatorId ? [record.creatorId] : []
      case 'role': {
        const rows = await this.memberRoles.find({
          where: { organizationId, roleName: selector.role, status: 'active' },
        })
        return rows.map((row) => row.userId)
      }
      case 'position': {
        if (selector.anchor === 'record') {
          return this.resolvePositionOnRecord(organizationId, selector, record)
        }
        const rows = await this.memberships.find({
          where: {
            organizationId,
            positionKey: selector.positionKey,
            subjectType: 'user',
          },
        })
        return rows.map((row) => row.subjectId)
      }
      default:
        return []
    }
  }

  /** 无审批人必须告警管理员；步骤保持阻塞，不静默跳过。 */
  private async alertNoAssignee(organizationId: string, warning: string): Promise<void> {
    if (!this.notifications) return
    const admins = await this.memberRoles.find({
      where: { organizationId, roleName: 'Admin', status: 'active' },
    })
    for (const admin of admins) {
      await this.notifications.sendToUser(
        admin.userId,
        {
          organizationId,
          type: 'error',
          title: '审批步骤缺少审批人',
          message: warning,
          category: 'approval',
          priority: 'high',
          actionUrl: '/admin/review',
        },
        randomUUID(),
      )
    }
  }

  private async resolvePositionOnRecord(
    organizationId: string,
    selector: Extract<AssigneeSelector, { kind: 'position' }>,
    record?: RecordAnchorContext,
  ): Promise<string[]> {
    if (!record?.resourceKey || !this.bindings) return []
    const binding = await this.bindings.findOne({
      where: {
        organizationId,
        resourceKey: record.resourceKey,
        ...(selector.dimension ? { dimensionKey: selector.dimension } : {}),
      },
    })
    if (!binding?.field) return []
    const raw = record.data?.[binding.field]
    const nodeIds = (Array.isArray(raw) ? raw : [raw])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
    if (nodeIds.length === 0) return []
    const now = new Date()
    const rows = await this.memberships.find({
      where: {
        organizationId,
        positionKey: selector.positionKey,
        subjectType: 'user',
        nodeId: In(nodeIds),
      },
    })
    return rows
      .filter((row) => !row.validFrom || row.validFrom.getTime() <= now.getTime())
      .filter((row) => !row.validTo || row.validTo.getTime() > now.getTime())
      .map((row) => row.subjectId)
  }
}
