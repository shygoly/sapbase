import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'

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
