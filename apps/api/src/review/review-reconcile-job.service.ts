import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import type { JobContext } from '@sap/platform-core/jobs/job-types'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { BlueprintRecord } from '../semantic-runtime/blueprint-record.entity'
import { normalizeSelector } from './assignee-selector'
import { ReviewAssigneeService } from './review-assignee.service'
import { WorkItem } from './work-item.entity'
import { WorkItemsService } from './work-items.service'

export interface ReconcileResult {
  scanned: number
  reassigned: number
  blocked: number
  projected: number
  closed: number
}

/**
 * 待办/审批人对账任务：
 * - 未决步骤重新解析 selector（成员/岗位变化、离职后生效）；
 * - 重新投影 work_items，并关闭已完成/已撤销步骤的待办。
 *
 * 源表仍是 blueprint_approvals 与 blueprint_records；本任务可重复执行。
 */
@Injectable()
export class ReviewReconcileJobService implements OnModuleInit {
  private readonly logger = new Logger(ReviewReconcileJobService.name)

  constructor(
    private readonly registry: JobTypeRegistry,
    @InjectRepository(BlueprintApproval)
    private readonly approvals: Repository<BlueprintApproval>,
    @InjectRepository(BlueprintRecord)
    private readonly records: Repository<BlueprintRecord>,
    private readonly assignees: ReviewAssigneeService,
    private readonly workItems: WorkItemsService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('review.reconcile')) return
    this.registry.register({
      type: 'review.reconcile',
      typeVersion: 1,
      timeoutMs: 5 * 60_000,
      maxAttempts: 2,
      backoff: { kind: 'exponential', baseMs: 5_000, maxMs: 60_000 },
      concurrency: 1,
      payloadSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async (ctx) => ({ result: await this.run(ctx.organizationId) }),
    })
  }

  async run(organizationId: string): Promise<ReconcileResult> {
    const pending = await this.approvals.find({
      where: { organizationId, status: 'pending' },
      order: { dueAt: 'ASC', createdAt: 'ASC' },
    })
    let reassigned = 0
    let blocked = 0
    let projected = 0

    for (const approval of pending) {
      const selector = normalizeSelector(approval.selector)
      let assigneeId: string | null = readAssignee(approval.assignee)
      if (selector) {
        const record = await this.records.findOne({
          where: { id: approval.recordId, organizationId },
        })
        const resolution = await this.assignees.resolveWithAlert(organizationId, selector, {
          creatorId: null,
          resourceKey: approval.entity,
          data: record?.data ?? {},
        })
        if (resolution.assignees.length === 0) {
          blocked += 1
          assigneeId = null
        } else {
          const next = {
            userId: resolution.assignees[0],
            userIds: resolution.assignees,
          }
          const changed = readAssignee(approval.assignee) !== next.userId
          approval.assignee = next
          await this.approvals.save(approval)
          if (changed) reassigned += 1
          assigneeId = next.userId
        }
      }

      await this.workItems.project({
        organizationId,
        sourceType: 'approval',
        sourceId: approval.id,
        title: `审批 ${approval.entity}:${approval.recordId}`,
        assigneeId,
        priority:
          approval.dueAt && approval.dueAt.getTime() < Date.now() ? 'urgent' : 'normal',
        dueAt: approval.dueAt,
        metadata: {
          entity: approval.entity,
          recordId: approval.recordId,
          ruleId: approval.ruleId,
          round: approval.round,
          stepIndex: approval.stepIndex,
          kind: approval.kind,
          blocked: blocked > 0 && assigneeId === null,
        },
      })
      projected += 1
    }

    const stale = await this.dataSource.getRepository(WorkItem).find({
      where: { organizationId, sourceType: 'approval', status: 'open' },
    })
    const pendingIds = new Set(pending.map((row) => row.id))
    let closed = 0
    for (const item of stale) {
      if (pendingIds.has(item.sourceId)) continue
      await this.workItems.close(organizationId, 'approval', item.sourceId)
      closed += 1
    }

    const result = { scanned: pending.length, reassigned, blocked, projected, closed }
    this.logger.log(`review.reconcile ${organizationId}: ${JSON.stringify(result)}`)
    return result
  }
}

function readAssignee(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const userId = (value as { userId?: unknown }).userId
    if (typeof userId === 'string' && userId.length > 0) return userId
  }
  return null
}
