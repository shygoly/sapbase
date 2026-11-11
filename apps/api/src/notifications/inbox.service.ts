import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { WorkItem } from '../review/work-item.entity'

export type InboxItem = {
  approvalId: string
  blueprintId: string
  entity: string
  recordId: string
  ruleId: string
  stepIndex: number
  role: string
  since: string
}

type InboxCaller = {
  role?: string
  organizationId?: string
}

/**
 * 待办是对 `blueprint_approvals` 的查询，不是另存一份。
 * 批准在同一事务把该行 status 改成 approved ⇒ 待办自然消失。
 */
@Injectable()
export class InboxService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 双读兼容：新待办中心读 work_items；旧 /inbox 继续读 blueprint_approvals。
   * 两个来源都只读，真源仍是各自业务表。
   */
  async listWorkItemsForCaller(
    user?: InboxCaller & { userId?: string },
  ): Promise<WorkItem[]> {
    const organizationId = user?.organizationId
    if (!organizationId) return []
    const qb = this.dataSource
      .getRepository(WorkItem)
      .createQueryBuilder('item')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('item.status = :status', { status: 'open' })
      .orderBy('item.priority', 'DESC')
      .addOrderBy('item.dueAt', 'ASC')
      .take(100)
    if (user?.userId) qb.andWhere('item.assigneeId = :userId', { userId: user.userId })
    return qb.getMany()
  }

  async listForCaller(user?: InboxCaller): Promise<InboxItem[]> {
    const role = typeof user?.role === 'string' ? user.role.trim() : ''
    const organizationId = user?.organizationId
    if (!role || !organizationId) return []
    const rows = await this.dataSource.getRepository(BlueprintApproval).find({
      where: { organizationId, status: 'pending', role },
      order: { createdAt: 'ASC', id: 'ASC' },
    })
    return rows.map((row) => ({
      approvalId: row.id,
      blueprintId: row.blueprintId,
      entity: row.entity,
      recordId: row.recordId,
      ruleId: row.ruleId,
      stepIndex: row.stepIndex,
      role: row.role,
      since: row.createdAt.toISOString(),
    }))
  }
}
