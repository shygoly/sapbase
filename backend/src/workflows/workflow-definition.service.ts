import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WorkflowDefinition, WorkflowStatus, WorkflowState, WorkflowTransition } from './workflow-definition.entity'
import { CacheService } from '../cache/cache.service'

export interface CreateWorkflowDefinitionDto {
  name: string
  description?: string
  entityType: string
  states: WorkflowState[]
  transitions: WorkflowTransition[]
  metadata?: Record<string, any>
}

export interface UpdateWorkflowDefinitionDto {
  name?: string
  description?: string
  states?: WorkflowState[]
  transitions?: WorkflowTransition[]
  status?: WorkflowStatus
  metadata?: Record<string, any>
}

@Injectable()
export class WorkflowDefinitionService {
  constructor(
    @InjectRepository(WorkflowDefinition)
    private workflowDefinitionRepository: Repository<WorkflowDefinition>,
    private cacheService: CacheService,
  ) {}

  async create(dto: CreateWorkflowDefinitionDto, organizationId: string): Promise<WorkflowDefinition> {
    // Validate states
    this.validateStates(dto.states)

    // Validate transitions
    this.validateTransitions(dto.transitions, dto.states)

    const workflow = this.workflowDefinitionRepository.create({
      ...dto,
      organizationId,
      status: WorkflowStatus.DRAFT,
    })

    const saved = await this.workflowDefinitionRepository.save(workflow)

    // Invalidate cache
    await this.invalidateCache(organizationId, saved.id)

    return saved
  }

  async findAll(organizationId: string, entityType?: string): Promise<WorkflowDefinition[]> {
    const cacheKey = this.cacheService.orgKey(organizationId, 'workflows', entityType || 'all')

    // Try cache
    const cached = await this.cacheService.get<WorkflowDefinition[]>(cacheKey)
    if (cached) {
      return cached
    }

    const where: any = { organizationId }
    if (entityType) {
      where.entityType = entityType
    }

    const workflows = await this.workflowDefinitionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    })

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, workflows, 300)

    return workflows
  }

  async findOne(id: string, organizationId: string): Promise<WorkflowDefinition> {
    const cacheKey = this.cacheService.orgKey(organizationId, 'workflow', id)

    // Try cache
    const cached = await this.cacheService.get<WorkflowDefinition>(cacheKey)
    if (cached) {
      return cached
    }

    const workflow = await this.workflowDefinitionRepository.findOne({
      where: { id, organizationId },
    })

    if (!workflow) {
      throw new NotFoundException(`Workflow definition with ID ${id} not found`)
    }

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, workflow, 300)

    return workflow
  }

  async findByEntityType(entityType: string, organizationId: string): Promise<WorkflowDefinition | null> {
    const workflow = await this.workflowDefinitionRepository.findOne({
      where: { entityType, organizationId, status: WorkflowStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    })

    return workflow
  }

  async update(
    id: string,
    dto: UpdateWorkflowDefinitionDto,
    organizationId: string,
  ): Promise<WorkflowDefinition> {
    const workflow = await this.findOne(id, organizationId)

    // Validate states if provided
    if (dto.states) {
      this.validateStates(dto.states)
    }

    // Validate transitions if provided
    if (dto.transitions && dto.states) {
      this.validateTransitions(dto.transitions, dto.states)
    } else if (dto.transitions) {
      this.validateTransitions(dto.transitions, workflow.states)
    }

    Object.assign(workflow, dto)
    const updated = await this.workflowDefinitionRepository.save(workflow)

    // Invalidate cache
    await this.invalidateCache(organizationId, id)

    return updated
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const workflow = await this.findOne(id, organizationId)
    await this.workflowDefinitionRepository.remove(workflow)

    // Invalidate cache
    await this.invalidateCache(organizationId, id)
  }

  private validateStates(states: WorkflowState[]): void {
    if (!states || states.length === 0) {
      throw new BadRequestException('Workflow must have at least one state')
    }

    const stateNames = states.map((s) => s.name)
    const uniqueNames = new Set(stateNames)
    if (stateNames.length !== uniqueNames.size) {
      throw new BadRequestException('State names must be unique')
    }

    const initialStates = states.filter((s) => s.initial)
    if (initialStates.length !== 1) {
      throw new BadRequestException('Workflow must have exactly one initial state')
    }
  }

  private validateTransitions(transitions: WorkflowTransition[], states: WorkflowState[]): void {
    const stateNames = new Set(states.map((s) => s.name))

    for (const transition of transitions) {
      if (!stateNames.has(transition.from)) {
        throw new BadRequestException(`Transition references unknown state: ${transition.from}`)
      }
      if (!stateNames.has(transition.to)) {
        throw new BadRequestException(`Transition references unknown state: ${transition.to}`)
      }
    }
  }

  private async invalidateCache(organizationId: string, workflowId?: string): Promise<void> {
    const keys = [
      this.cacheService.orgKey(organizationId, 'workflows', 'all'),
      this.cacheService.orgKey(organizationId, 'workflow', workflowId || '*'),
    ]

    for (const key of keys) {
      if (workflowId) {
        await this.cacheService.del(key)
      }
    }
  }
}
