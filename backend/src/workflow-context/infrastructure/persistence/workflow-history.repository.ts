import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WorkflowHistory } from '../../../workflows/workflow-history.entity'
import type { IWorkflowHistoryRepository } from '../../domain/repositories'
import type { WorkflowHistoryEntry } from '../../domain/entities'

@Injectable()
export class WorkflowHistoryRepository implements IWorkflowHistoryRepository {
  constructor(
    @InjectRepository(WorkflowHistory)
    private readonly repo: Repository<WorkflowHistory>,
  ) {}

  async create(entry: {
    workflowInstanceId: string
    fromState: string
    toState: string
    triggeredById: string | null
    guardResult?: Record<string, unknown>
    actionResult?: Record<string, unknown>
  }): Promise<WorkflowHistoryEntry> {
    const row = this.repo.create({
      workflowInstanceId: entry.workflowInstanceId,
      fromState: entry.fromState,
      toState: entry.toState,
      triggeredById: entry.triggeredById ?? undefined,
      guardResult: entry.guardResult as any,
      actionResult: entry.actionResult as any,
      timestamp: new Date(),
    })
    const saved = await this.repo.save(row)
    return this.toEntry(saved)
  }

  async findByInstanceId(
    workflowInstanceId: string,
  ): Promise<WorkflowHistoryEntry[]> {
    const rows = await this.repo.find({
      where: { workflowInstanceId },
      order: { timestamp: 'ASC' },
    })
    return rows.map((r) => this.toEntry(r))
  }

  private toEntry(row: WorkflowHistory): WorkflowHistoryEntry {
    return {
      id: row.id,
      workflowInstanceId: row.workflowInstanceId,
      fromState: row.fromState,
      toState: row.toState,
      triggeredById: row.triggeredById,
      timestamp: row.timestamp,
      guardResult: row.guardResult as any,
      actionResult: row.actionResult as any,
      metadata: row.metadata as any,
    }
  }
}
