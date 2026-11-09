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
    options: { status?: WorkItem['status']; assigneeId?: string } = {},
  ): Promise<WorkItem[]> {
    return this.repository.find({
      where: {
        organizationId,
        ...(options.status ? { status: options.status } : {}),
        ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
      },
      order: { priority: 'DESC', dueAt: 'ASC', createdAt: 'ASC' },
    })
  }
}
