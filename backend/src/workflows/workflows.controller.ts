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
} from '@nestjs/common'
import { WorkflowDefinitionService, CreateWorkflowDefinitionDto, UpdateWorkflowDefinitionDto } from './workflow-definition.service'
import { WorkflowInstanceService, CreateWorkflowInstanceDto } from './workflow-instance.service'
import { TransitionEngineService } from './transition-engine.service'
import { WorkflowHistoryService } from './workflow-history.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../users/user.entity'

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(
    private workflowDefinitionService: WorkflowDefinitionService,
    private workflowInstanceService: WorkflowInstanceService,
    private transitionEngineService: TransitionEngineService,
    private workflowHistoryService: WorkflowHistoryService,
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
    return this.workflowInstanceService.create(
      { ...dto, workflowDefinitionId },
      organizationId,
      user.id,
    )
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

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    const instance = await this.workflowInstanceService.findOne(id, organizationId)
    const workflow = instance.workflowDefinition

    // Get available transitions
    const availableTransitions = this.transitionEngineService.getAvailableTransitions(
      workflow,
      instance,
    )

    return {
      ...instance,
      availableTransitions,
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
    const workflow = instance.workflowDefinition

    // Note: entityService injection would require dynamic service resolution
    // For now, we'll update the entity state field directly if entity is provided
    let entityService = null
    if (body.entityService) {
      // In a full implementation, this would resolve the service dynamically
      // For now, we'll handle entity updates in the transition engine
    }

    // Execute transition
    const result = await this.transitionEngineService.executeTransition(
      workflow,
      instance,
      body.toState,
      user.id,
      body.entity,
      entityService || undefined,
    )

    if (!result.success) {
      throw new Error(result.error || 'Transition failed')
    }

    // Update instance state
    const updatedInstance = await this.workflowInstanceService.updateState(
      id,
      body.toState,
      organizationId,
    )

    return {
      ...updatedInstance,
      entityUpdated: !!result.updatedEntity,
    }
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.workflowInstanceService.cancel(id, organizationId)
  }

  @Get(':id/history')
  async getHistory(@Param('id') id: string) {
    return this.workflowHistoryService.findByInstance(id)
  }
}
