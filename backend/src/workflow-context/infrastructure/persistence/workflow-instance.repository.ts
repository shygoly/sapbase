import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  WorkflowInstance as WorkflowInstanceOrm,
  WorkflowInstanceStatus as WorkflowInstanceStatusOrm,
} from '../../../workflows/workflow-instance.entity'
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '../../domain/entities/workflow-instance.entity'
import type { IWorkflowInstanceRepository } from '../../domain/repositories'

@Injectable()
export class WorkflowInstanceRepository implements IWorkflowInstanceRepository {
  constructor(
    @InjectRepository(WorkflowInstanceOrm)
    private readonly repo: Repository<WorkflowInstanceOrm>,
  ) {}

  async save(instance: WorkflowInstance): Promise<void> {
    const existing = await this.repo.findOne({
      where: { id: instance.id, organizationId: instance.organizationId },
    })
    const status = this.toOrmStatus(instance.status)
    if (existing) {
      existing.currentState = instance.currentState
      existing.status = status
      ;(existing as any).completedAt = instance.completedAt ?? undefined
      existing.context = instance.context as any
      await this.repo.save(existing)
    } else {
      await this.repo.save({
        id: instance.id,
        organizationId: instance.organizationId,
        workflowDefinitionId: instance.workflowDefinitionId,
        entityType: instance.entityType,
        entityId: instance.entityId,
        currentState: instance.currentState,
        context: instance.context,
        status,
        startedById: instance.startedById ?? undefined,
        startedAt: instance.startedAt,
        completedAt: instance.completedAt ?? undefined,
      } as any)
    }
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<WorkflowInstance | null> {
    const row = await this.repo.findOne({
      where: { id, organizationId },
      relations: ['workflowDefinition'],
    })
    if (!row) return null
    return this.toDomain(row)
  }

  async findRunningInstance(
    entityType: string,
    entityId: string,
    workflowDefinitionId: string,
    organizationId: string,
  ): Promise<WorkflowInstance | null> {
    const row = await this.repo.findOne({
      where: {
        organizationId,
        entityType,
        entityId,
        workflowDefinitionId,
        status: WorkflowInstanceStatusOrm.RUNNING,
      },
    })
    if (!row) return null
    return this.toDomain(row)
  }

  async findAll(
    organizationId: string,
    workflowDefinitionId?: string,
    entityType?: string,
    entityId?: string,
  ): Promise<WorkflowInstance[]> {
    const where: any = { organizationId }
    if (workflowDefinitionId) where.workflowDefinitionId = workflowDefinitionId
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    const rows = await this.repo.find({
      where,
      relations: ['workflowDefinition'],
      order: { startedAt: 'DESC' },
    })
    return rows.map((r) => this.toDomain(r))
  }

  async updateState(
    id: string,
    toState: string,
    organizationId: string,
    completedAt?: Date | null,
  ): Promise<void> {
    await this.repo.update(
      { id, organizationId },
      { currentState: toState, completedAt: completedAt ?? undefined },
    )
  }

  private toDomain(row: WorkflowInstanceOrm): WorkflowInstance {
    return WorkflowInstance.fromPersistence(
      row.id,
      row.organizationId,
      row.workflowDefinitionId,
      row.entityType,
      row.entityId,
      row.currentState,
      (row.context as Record<string, unknown>) ?? {},
      this.toDomainStatus(row.status),
      row.startedById ?? null,
      row.startedAt,
      row.completedAt ?? null,
    )
  }

  private toOrmStatus(
    s: WorkflowInstanceStatus,
  ): WorkflowInstanceStatusOrm {
    switch (s) {
      case WorkflowInstanceStatus.RUNNING:
        return WorkflowInstanceStatusOrm.RUNNING
      case WorkflowInstanceStatus.COMPLETED:
        return WorkflowInstanceStatusOrm.COMPLETED
      case WorkflowInstanceStatus.FAILED:
        return WorkflowInstanceStatusOrm.FAILED
      case WorkflowInstanceStatus.CANCELLED:
        return WorkflowInstanceStatusOrm.CANCELLED
      default:
        return WorkflowInstanceStatusOrm.RUNNING
    }
  }

  private toDomainStatus(
    s: WorkflowInstanceStatusOrm,
  ): WorkflowInstanceStatus {
    switch (s) {
      case WorkflowInstanceStatusOrm.RUNNING:
        return WorkflowInstanceStatus.RUNNING
      case WorkflowInstanceStatusOrm.COMPLETED:
        return WorkflowInstanceStatus.COMPLETED
      case WorkflowInstanceStatusOrm.FAILED:
        return WorkflowInstanceStatus.FAILED
      case WorkflowInstanceStatusOrm.CANCELLED:
        return WorkflowInstanceStatus.CANCELLED
      default:
        return WorkflowInstanceStatus.RUNNING
    }
  }
}
