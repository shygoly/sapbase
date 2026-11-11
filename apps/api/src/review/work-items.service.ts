import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WorkItem } from './work-item.entity'

export interface ProjectWorkItemInput {
  organizationId: string
  sourceType: string
  sourceId: string
  title: string
  assigneeId?: string | null
  priority?: WorkItem['priority']
  dueAt?: Date | null
  metadata?: Record<string, unknown> | null
}

/**
 * 通用工作项投影：源表仍是真源，work_items 只做待办索引/红点。
 * 重复投影按 (org, sourceType, sourceId) 幂等更新。
 */
@Injectable()
export class WorkItemsService {
  constructor(
    @InjectRepository(WorkItem)
    private readonly repository: Repository<WorkItem>,
  ) {}

  async project(input: ProjectWorkItemInput): Promise<WorkItem> {
    const existing = await this.repository.findOne({
      where: {
        organizationId: input.organizationId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    })
    if (existing) {
      existing.title = input.title
      existing.assigneeId = input.assigneeId ?? existing.assigneeId
      existing.priority = input.priority ?? existing.priority
      existing.dueAt = input.dueAt ?? existing.dueAt
      existing.metadata = input.metadata ?? existing.metadata
      if (existing.status === 'done' || existing.status === 'dismissed') {
        existing.status = 'open'
        existing.readAt = null
      }
      return this.repository.save(existing)
    }
    return this.repository.save(
      this.repository.create({
        organizationId: input.organizationId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        title: input.title,
        status: 'open',
        assigneeId: input.assigneeId ?? null,
        priority: input.priority ?? 'normal',
        dueAt: input.dueAt ?? null,
        metadata: input.metadata ?? null,
      }),
    )
  }

  async close(
    organizationId: string,
    sourceType: string,
    sourceId: string,
  ): Promise<boolean> {
    const result = await this.repository.update(
      { organizationId, sourceType, sourceId, status: 'open' },
      { status: 'done' },
    )
    return (result.affected ?? 0) > 0
  }

  async list(
    organizationId: string,
    options: {
      status?: WorkItem['status']
      assigneeId?: string
      sourceType?: string
      unreadOnly?: boolean
      limit?: number
    } = {},
  ): Promise<WorkItem[]> {
    const qb = this.repository
      .createQueryBuilder('item')
      .where('item.organizationId = :organizationId', { organizationId })
      .orderBy('item.priority', 'DESC')
      .addOrderBy('item.dueAt', 'ASC')
      .addOrderBy('item.createdAt', 'ASC')
    if (options.status) qb.andWhere('item.status = :status', { status: options.status })
    if (options.assigneeId) {
      qb.andWhere('item.assigneeId = :assigneeId', { assigneeId: options.assigneeId })
    }
    if (options.sourceType) {
      qb.andWhere('item.sourceType = :sourceType', { sourceType: options.sourceType })
    }
    if (options.unreadOnly) qb.andWhere('item.readAt IS NULL')
    qb.take(Math.min(200, Math.max(1, options.limit ?? 50)))
    return qb.getMany()
  }

  async markRead(
    organizationId: string,
    id: string,
    assigneeId?: string,
  ): Promise<boolean> {
    const result = await this.repository.update(
      {
        id,
        organizationId,
        ...(assigneeId ? { assigneeId } : {}),
      },
      { readAt: new Date() },
    )
    return (result.affected ?? 0) > 0
  }

  async markAllRead(organizationId: string, assigneeId?: string): Promise<number> {
    const qb = this.repository
      .createQueryBuilder()
      .update(WorkItem)
      .set({ readAt: new Date() })
      .where('"organizationId" = :organizationId', { organizationId })
      .andWhere('"readAt" IS NULL')
      .andWhere('"status" = :status', { status: 'open' })
    if (assigneeId) qb.andWhere('"assigneeId" = :assigneeId', { assigneeId })
    const result = await qb.execute()
    return result.affected ?? 0
  }

  async unreadCount(organizationId: string, assigneeId?: string): Promise<number> {
    const qb = this.repository
      .createQueryBuilder('item')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('item.status = :status', { status: 'open' })
      .andWhere('item.readAt IS NULL')
    if (assigneeId) qb.andWhere('item.assigneeId = :assigneeId', { assigneeId })
    return qb.getCount()
  }
}
