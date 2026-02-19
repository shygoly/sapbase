import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  WorkflowDefinition as WorkflowDefinitionOrm,
  WorkflowStatus as WorkflowStatusOrm,
} from '../../../workflows/workflow-definition.entity'
import {
  WorkflowDefinition,
  WorkflowStatus,
} from '../../domain/entities/workflow-definition.entity'
import type { IWorkflowDefinitionRepository } from '../../domain/repositories'

@Injectable()
export class WorkflowDefinitionRepository implements IWorkflowDefinitionRepository {
  constructor(
    @InjectRepository(WorkflowDefinitionOrm)
    private readonly repo: Repository<WorkflowDefinitionOrm>,
  ) {}

  async findById(
    id: string,
    organizationId: string,
  ): Promise<WorkflowDefinition | null> {
    const row = await this.repo.findOne({
      where: { id, organizationId },
    })
    if (!row) return null
    return this.toDomain(row)
  }

  async save(definition: WorkflowDefinition): Promise<void> {
    const existing = await this.repo.findOne({
      where: { id: definition.id, organizationId: definition.organizationId },
    })
    const status =
      definition.status === WorkflowStatus.ACTIVE
        ? WorkflowStatusOrm.ACTIVE
        : definition.status === WorkflowStatus.INACTIVE
          ? WorkflowStatusOrm.INACTIVE
          : WorkflowStatusOrm.DRAFT
    if (existing) {
      existing.name = definition.name
      ;(existing as any).description = definition.description ?? undefined
      existing.entityType = definition.entityType
      existing.states = definition.states as any
      existing.transitions = definition.transitions as any
      existing.status = status
      existing.version = definition.version
      existing.metadata = definition.metadata as any
      await this.repo.save(existing)
    } else {
      await this.repo.save({
        id: definition.id,
        organizationId: definition.organizationId,
        name: definition.name,
        description: definition.description ?? undefined,
        entityType: definition.entityType,
        states: definition.states,
        transitions: definition.transitions,
        status,
        version: definition.version,
        metadata: definition.metadata ?? undefined,
      } as any)
    }
  }

  async findAll(
    organizationId: string,
    entityType?: string,
  ): Promise<WorkflowDefinition[]> {
    const where: any = { organizationId }
    if (entityType) where.entityType = entityType
    const rows = await this.repo.find({ where, order: { createdAt: 'DESC' } })
    return rows.map((row) => this.toDomain(row))
  }

  private toDomain(row: WorkflowDefinitionOrm): WorkflowDefinition {
    return WorkflowDefinition.fromPersistence(
      row.id,
      row.organizationId,
      row.name,
      row.entityType,
      row.states as any,
      row.transitions as any,
      row.status as WorkflowStatus,
      row.description ?? null,
      row.version,
      row.metadata ?? null,
    )
  }
}
