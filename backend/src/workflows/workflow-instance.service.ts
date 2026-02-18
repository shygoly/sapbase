import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WorkflowInstance, WorkflowInstanceStatus } from './workflow-instance.entity'
import { WorkflowDefinition } from './workflow-definition.entity'
import { WorkflowDefinitionService } from './workflow-definition.service'

export interface CreateWorkflowInstanceDto {
  workflowDefinitionId: string
  entityType: string
  entityId: string
  context?: Record<string, any>
}

@Injectable()
export class WorkflowInstanceService {
  constructor(
    @InjectRepository(WorkflowInstance)
    private workflowInstanceRepository: Repository<WorkflowInstance>,
    private workflowDefinitionService: WorkflowDefinitionService,
  ) {}

  async create(dto: CreateWorkflowInstanceDto, organizationId: string, userId: string): Promise<WorkflowInstance> {
    // Get workflow definition
    const workflow = await this.workflowDefinitionService.findOne(dto.workflowDefinitionId, organizationId)

    if (workflow.status !== 'active') {
      throw new BadRequestException('Cannot start workflow: workflow is not active')
    }

    // Check if instance already exists
    const existing = await this.workflowInstanceRepository.findOne({
      where: {
        organizationId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        workflowDefinitionId: dto.workflowDefinitionId,
        status: WorkflowInstanceStatus.RUNNING,
      },
    })

    if (existing) {
      throw new BadRequestException('Workflow instance already exists for this entity')
    }

    // Find initial state
    const initialState = workflow.states.find((s) => s.initial)
    if (!initialState) {
      throw new BadRequestException('Workflow definition has no initial state')
    }

    const instance = this.workflowInstanceRepository.create({
      ...dto,
      organizationId,
      currentState: initialState.name,
      status: WorkflowInstanceStatus.RUNNING,
      startedById: userId,
      context: dto.context || {},
    })

    return this.workflowInstanceRepository.save(instance)
  }

  async findAll(
    organizationId: string,
    workflowDefinitionId?: string,
    entityType?: string,
    entityId?: string,
  ): Promise<WorkflowInstance[]> {
    const where: any = { organizationId }

    if (workflowDefinitionId) {
      where.workflowDefinitionId = workflowDefinitionId
    }
    if (entityType) {
      where.entityType = entityType
    }
    if (entityId) {
      where.entityId = entityId
    }

    return this.workflowInstanceRepository.find({
      where,
      relations: ['workflowDefinition', 'startedBy'],
      order: { startedAt: 'DESC' },
    })
  }

  async findOne(id: string, organizationId: string): Promise<WorkflowInstance> {
    const instance = await this.workflowInstanceRepository.findOne({
      where: { id, organizationId },
      relations: ['workflowDefinition', 'startedBy'],
    })

    if (!instance) {
      throw new NotFoundException(`Workflow instance with ID ${id} not found`)
    }

    return instance
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    organizationId: string,
  ): Promise<WorkflowInstance | null> {
    const instance = await this.workflowInstanceRepository.findOne({
      where: {
        entityType,
        entityId,
        organizationId,
        status: WorkflowInstanceStatus.RUNNING,
      },
      relations: ['workflowDefinition'],
      order: { startedAt: 'DESC' },
    })

    return instance
  }

  async updateState(
    id: string,
    newState: string,
    organizationId: string,
  ): Promise<WorkflowInstance> {
    const instance = await this.findOne(id, organizationId)

    if (instance.status !== WorkflowInstanceStatus.RUNNING) {
      throw new BadRequestException('Cannot update state: workflow instance is not running')
    }

    instance.currentState = newState

    // Check if final state
    const workflow = instance.workflowDefinition
    const finalState = workflow.states.find((s) => s.name === newState && s.final)
    if (finalState) {
      instance.status = WorkflowInstanceStatus.COMPLETED
      instance.completedAt = new Date()
    }

    return this.workflowInstanceRepository.save(instance)
  }

  async cancel(id: string, organizationId: string): Promise<WorkflowInstance> {
    const instance = await this.findOne(id, organizationId)

    if (instance.status !== WorkflowInstanceStatus.RUNNING) {
      throw new BadRequestException('Cannot cancel: workflow instance is not running')
    }

    instance.status = WorkflowInstanceStatus.CANCELLED
    instance.completedAt = new Date()

    return this.workflowInstanceRepository.save(instance)
  }
}
