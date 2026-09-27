import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource, EntityManager } from 'typeorm'
import { OutboxEvent, type OutboxEventStatus } from './outbox-event.entity'

export interface OutboxEventInput {
  topic: string
  payload: Record<string, unknown>
  organizationId: string
  idempotencyKey: string
  aggregateType?: string | null
  aggregateId?: string | null
  occurredAt?: Date
}

export function transitionIdempotencyKey(
  recordId: string,
  from: string,
  to: string,
  version: number,
): string {
  return `transition:${recordId}:${from}->${to}:v${version}`
}

export function approvalPendingIdempotencyKey(
  recordId: string,
  ruleId: string,
  stepIndex: number,
): string {
  return `approval-pending:${recordId}:${ruleId}:${stepIndex}`
}

export function approvalDecidedIdempotencyKey(
  recordId: string,
  ruleId: string,
  stepIndex: number,
): string {
  return `approval-decided:${recordId}:${ruleId}:${stepIndex}`
}

export function importIdempotencyKey(entity: string, batchId: string): string {
  return `import:${entity}:${batchId}`
}

/**
 * 跨进程事件发布。publish 必须吃调用方事务的 manager，自己不开事务。
 */
@Injectable()
export class OutboxService {
  constructor(private readonly dataSource: DataSource) {}

  async publish(manager: EntityManager, event: OutboxEventInput): Promise<OutboxEvent> {
    const repo = manager.getRepository(OutboxEvent)
    const now = event.occurredAt ?? new Date()
    const row = repo.create({
      topic: event.topic,
      payload: event.payload,
      occurredAt: now,
      deliveredAt: null,
      attempts: 0,
      lastError: null,
      idempotencyKey: event.idempotencyKey,
      status: 'pending',
      nextAttemptAt: now,
      organizationId: event.organizationId,
      aggregateType: event.aggregateType ?? null,
      aggregateId: event.aggregateId ?? null,
    })
    return repo.save(row)
  }

  async listEvents(filter: {
    organizationId: string
    status?: OutboxEventStatus
  }): Promise<OutboxEvent[]> {
    if (!filter.organizationId) {
      throw new BadRequestException('缺少 organizationId')
    }
    return this.dataSource.getRepository(OutboxEvent).find({
      where: {
        organizationId: filter.organizationId,
        ...(filter.status ? { status: filter.status } : {}),
      },
      order: { occurredAt: 'ASC' },
    })
  }

  async redeliver(id: string, organizationId: string): Promise<OutboxEvent> {
    if (!organizationId) {
      throw new BadRequestException('缺少 organizationId')
    }
    const repo = this.dataSource.getRepository(OutboxEvent)
    const row = await repo.findOne({ where: { id } })
    if (!row) {
      throw new NotFoundException(`outbox 事件 ${id} 不存在`)
    }
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('租户不匹配')
    }
    row.status = 'pending'
    row.nextAttemptAt = new Date()
    return repo.save(row)
  }
}
