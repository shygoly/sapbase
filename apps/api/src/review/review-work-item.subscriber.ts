import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import type { IEventHandler } from '../common/events/i-event-handler'
import { EventBusService } from '../common/events/event-bus.service'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { WorkItem } from './work-item.entity'
import { WorkItemsService } from './work-items.service'

interface ApprovalEvent {
  topic: string
  organizationId?: string
  payload?: Record<string, unknown>
}

/**
 * 审批事件 → work item 投影。
 *
 * outbox 事件是触发器，`blueprint_approvals` 仍是唯一真源：
 * 事件到达时按 (recordId, ruleId) 重新读链，关闭已完成步骤、投影仍 pending 的步骤。
 */
@Injectable()
export class ReviewWorkItemSubscriber
  implements IEventHandler<ApprovalEvent>, OnModuleInit
{
  private readonly logger = new Logger(ReviewWorkItemSubscriber.name)
  private static readonly TOPICS = [
    'blueprint.record.approval.pending',
    'blueprint.record.approval.decided',
  ]

  constructor(
    private readonly eventBus: EventBusService,
    private readonly dataSource: DataSource,
    private readonly workItems: WorkItemsService,
    @InjectRepository(BlueprintApproval)
    private readonly approvals: Repository<BlueprintApproval>,
  ) {}

  onModuleInit(): void {
    for (const topic of ReviewWorkItemSubscriber.TOPICS) {
      this.eventBus.subscribe(topic, this)
    }
  }

  async handle(event: ApprovalEvent): Promise<void> {
    const organizationId = event.organizationId
    const recordId = String(event.payload?.recordId ?? '')
    const ruleId = String(event.payload?.ruleId ?? '')
    if (!organizationId || !recordId || !ruleId) {
      this.logger.warn(`审批事件缺少必要字段：topic=${event.topic}`)
      return
    }
    await this.syncChain(organizationId, recordId, ruleId)
  }

  /** 事务/事件后的对账：源表是 pending 的才保留待办。 */
  async syncChain(
    organizationId: string,
    recordId: string,
    ruleId: string,
  ): Promise<{ open: number; closed: number }> {
    const rows = await this.approvals.find({
      where: { organizationId, recordId, ruleId },
      order: { round: 'DESC', stepIndex: 'ASC' },
    })
    const latestRound = rows[0]?.round ?? 1
    const latest = rows.filter((row) => row.round === latestRound)
    const pending = latest.filter((row) => row.status === 'pending')

    let open = 0
    for (const row of pending) {
      await this.workItems.project({
        organizationId,
        sourceType: 'approval',
        sourceId: row.id,
        title: `审批 ${row.entity}:${row.recordId}`,
        assigneeId: readAssignee(row.assignee),
        priority: row.dueAt && row.dueAt.getTime() < Date.now() ? 'urgent' : 'normal',
        dueAt: row.dueAt,
        metadata: {
          entity: row.entity,
          recordId: row.recordId,
          ruleId: row.ruleId,
          round: row.round,
          stepIndex: row.stepIndex,
          kind: row.kind,
        },
      })
      open += 1
    }

    const stale = await this.dataSource.getRepository(WorkItem).find({
      where: { organizationId, sourceType: 'approval', status: 'open' },
    })
    const pendingIds = new Set(pending.map((row) => row.id))
    const staleIds = stale
      .filter((item) => !pendingIds.has(item.sourceId))
      .filter((item) => rows.some((row) => row.id === item.sourceId))
      .map((item) => item.id)
    let closed = 0
    for (const id of staleIds) {
      const item = stale.find((row) => row.id === id)
      if (!item) continue
      await this.workItems.close(organizationId, 'approval', item.sourceId)
      closed += 1
    }
    return { open, closed }
  }
}

function readAssignee(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const userId = (value as { userId?: unknown }).userId
    if (typeof userId === 'string' && userId.length > 0) return userId
  }
  return null
}
