import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common'
import { WorkflowDefinitionService, CreateWorkflowDefinitionDto, UpdateWorkflowDefinitionDto } from './workflow-definition.service'
import { WorkflowInstanceService, CreateWorkflowInstanceDto } from './workflow-instance.service'
import { TransitionEngineService } from './transition-engine.service'
import { WorkflowHistoryService } from './workflow-history.service'
import { WorkflowSuggestionService } from './workflow-suggestion.service'
import { EntityStateUpdaterRegistry } from './entity-state-updater.registry'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../users/user.entity'
import { StartWorkflowInstanceService } from '../workflow-context/application/services/start-workflow-instance.service'
import { GetWorkflowInstanceService } from '../workflow-context/application/services/get-workflow-instance.service'
import { ExecuteTransitionService } from '../workflow-context/application/services/execute-transition.service'
import { GetSuggestedTransitionsService } from '../workflow-context/application/services/get-suggested-transitions.service'
import { GetAvailableTransitionsService } from '../workflow-context/application/services/get-available-transitions.service'
import { CancelWorkflowInstanceService } from '../workflow-context/application/services/cancel-workflow-instance.service'
import { BusinessRuleViolation } from '../workflow-context/domain/errors'

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(
    private workflowDefinitionService: WorkflowDefinitionService,
    private workflowInstanceService: WorkflowInstanceService,
    private transitionEngineService: TransitionEngineService,
    private workflowHistoryService: WorkflowHistoryService,
    private startWorkflowInstanceService: StartWorkflowInstanceService,
    private getWorkflowInstanceService: GetWorkflowInstanceService,
  ) {}

  // Workflow Definition endpoints

  @Post()
  async create(
    @Body() dto: CreateWorkflowDefinitionDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.workflowDefinitionService.create(dto, organizationId)
  }

  @Get()
  async findAll(
    @OrganizationId() organizationId: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.workflowDefinitionService.findAll(organizationId, entityType)
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.workflowDefinitionService.findOne(id, organizationId)
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.workflowDefinitionService.update(id, dto, organizationId)
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    await this.workflowDefinitionService.delete(id, organizationId)
    return { message: 'Workflow definition deleted successfully' }
  }

  // Workflow Instance endpoints

  @Post(':id/start')
  async startWorkflow(
    @Param('id') workflowDefinitionId: string,
    @Body() dto: Omit<CreateWorkflowInstanceDto, 'workflowDefinitionId'>,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: User,
  ) {
    try {
      const instance = await this.startWorkflowInstanceService.execute({
        workflowDefinitionId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        context: dto.context,
        organizationId,
        userId: user.id,
      })
      const view = await this.getWorkflowInstanceService.get(
        instance.id,
        organizationId,
      )
      return this.mapInstanceViewToResponse(view)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  private mapInstanceViewToResponse(view: {
    instance: { id: string; organizationId: string; workflowDefinitionId: string; entityType: string; entityId: string; currentState: string; context: Record<string, unknown>; status: string; startedById: string | null; startedAt: Date; completedAt: Date | null }
    workflowDefinition: { id: string; name: string; description: string | null; entityType: string; states: unknown[]; transitions: unknown[]; status: string; version: string; metadata: Record<string, unknown> | null } | null
  }) {
    const { instance, workflowDefinition } = view
    return {
      id: instance.id,
      organizationId: instance.organizationId,
      workflowDefinitionId: instance.workflowDefinitionId,
      entityType: instance.entityType,
      entityId: instance.entityId,
      currentState: instance.currentState,
      context: instance.context,
      status: instance.status,
      startedById: instance.startedById,
      startedAt: instance.startedAt,
      completedAt: instance.completedAt,
      workflowDefinition: workflowDefinition
        ? {
            id: workflowDefinition.id,
            name: workflowDefinition.name,
            description: workflowDefinition.description,
            entityType: workflowDefinition.entityType,
            states: workflowDefinition.states,
            transitions: workflowDefinition.transitions,
            status: workflowDefinition.status,
            version: workflowDefinition.version,
            metadata: workflowDefinition.metadata,
          }
        : undefined,
    }
  }

  @Get(':id/instances')
  async getInstances(
    @Param('id') workflowDefinitionId: string,
    @OrganizationId() organizationId: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.workflowInstanceService.findAll(
      organizationId,
      workflowDefinitionId,
      entityType,
      entityId,
    )
  }
}

@Controller('workflow-instances')
@UseGuards(JwtAuthGuard)
export class WorkflowInstancesController {
  constructor(
    private workflowInstanceService: WorkflowInstanceService,
    private transitionEngineService: TransitionEngineService,
    private workflowHistoryService: WorkflowHistoryService,
    private workflowSuggestionService: WorkflowSuggestionService,
    private entityStateUpdaterRegistry: EntityStateUpdaterRegistry,
    private getWorkflowInstanceService: GetWorkflowInstanceService,
    private getAvailableTransitionsService: GetAvailableTransitionsService,
    private getSuggestedTransitionsService: GetSuggestedTransitionsService,
    private executeTransitionService: ExecuteTransitionService,
    private cancelWorkflowInstanceService: CancelWorkflowInstanceService,
  ) {}

  @Get()
  async findAll(
    @OrganizationId() organizationId: string,
    @Query('workflowDefinitionId') workflowDefinitionId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.workflowInstanceService.findAll(
      organizationId,
      workflowDefinitionId,
      entityType,
      entityId,
    )
  }

  @Get(':id/suggested-transitions')
  async getSuggestedTransitions(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @Query('entity') entityJson?: string,
  ) {
    let entitySnapshot: Record<string, any> | undefined
    if (entityJson) {
      try {
        entitySnapshot = JSON.parse(entityJson) as Record<string, any>
      } catch {
        entitySnapshot = undefined
      }
    }
    return this.getSuggestedTransitionsService.getSuggestedTransitions(
      id,
      organizationId,
      entitySnapshot,
    )
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    const view = await this.getWorkflowInstanceService.get(id, organizationId)
    const availableTransitions =
      await this.getAvailableTransitionsService.getAvailableTransitions(
        id,
        organizationId,
      )

    return {
      ...this.mapInstanceViewToResponse(view),
      availableTransitions,
    }
  }

  private mapInstanceViewToResponse(view: {
    instance: {
      id: string
      organizationId: string
      workflowDefinitionId: string
      entityType: string
      entityId: string
      currentState: string
      context: Record<string, unknown>
      status: string
      startedById: string | null
      startedAt: Date
      completedAt: Date | null
    }
    workflowDefinition: {
      id: string
      name: string
      description: string | null
      entityType: string
      states: unknown[]
      transitions: unknown[]
      status: string
      version: string
      metadata: Record<string, unknown> | null
    } | null
  }) {
    const { instance, workflowDefinition } = view
    return {
      id: instance.id,
      organizationId: instance.organizationId,
      workflowDefinitionId: instance.workflowDefinitionId,
      entityType: instance.entityType,
      entityId: instance.entityId,
      currentState: instance.currentState,
      context: instance.context,
      status: instance.status,
      startedById: instance.startedById,
      startedAt: instance.startedAt,
      completedAt: instance.completedAt,
      workflowDefinition: workflowDefinition
        ? {
            id: workflowDefinition.id,
            name: workflowDefinition.name,
            description: workflowDefinition.description,
            entityType: workflowDefinition.entityType,
            states: workflowDefinition.states,
            transitions: workflowDefinition.transitions,
            status: workflowDefinition.status,
            version: workflowDefinition.version,
            metadata: workflowDefinition.metadata,
          }
        : undefined,
    }
  }

  @Post(':id/transition')
  async executeTransition(
    @Param('id') id: string,
    @Body() body: { toState: string; entity?: Record<string, any>; entityService?: string },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: User,
  ) {
    const instance = await this.workflowInstanceService.findOne(id, organizationId)

    // Resolve entity state updater by entityType so transition can write back entity state
    const updater = this.entityStateUpdaterRegistry.get(instance.entityType)
    const entityUpdater = updater
      ? {
          update: (entityId: string, updates: Record<string, any>, orgId: string) =>
            updater.update(entityId, updates, orgId),
        }
      : undefined

    const result = await this.executeTransitionService.execute({
      instanceId: id,
      toState: body.toState,
      userId: user.id,
      organizationId,
      entity: body.entity,
      entityUpdater,
    })

    if (!result.success) {
      throw new BadRequestException(result.error || 'Transition failed')
    }

    const updatedView = await this.getWorkflowInstanceService.get(
      id,
      organizationId,
    )

    return {
      ...this.mapInstanceViewToResponse(updatedView),
      entityUpdated: !!result.updatedEntity,
    }
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    try {
      return await this.cancelWorkflowInstanceService.cancel(id, organizationId)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Get(':id/history')
  async getHistory(@Param('id') id: string) {
    return this.workflowHistoryService.findByInstance(id)
  }
}
