import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { AIModulesService } from './ai-modules.service'
import { AIModule, AIModuleStatus } from './ai-module.entity'
import { AIModuleTest } from './ai-module-test.entity'
import { AIModuleReview, ReviewDecision } from './ai-module-review.entity'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { User } from '../users/user.entity'
import { CreateModuleService } from '../ai-module-context/application/services/create-module.service'
import { PublishModuleService } from '../ai-module-context/application/services/publish-module.service'
import { GeneratePatchService } from '../ai-module-context/application/services/generate-patch.service'
import { SubmitReviewService } from '../ai-module-context/application/services/submit-review.service'
import { GetModuleService } from '../ai-module-context/application/services/get-module.service'
import { BusinessRuleViolation } from '../ai-module-context/domain/errors'

@Controller('ai-modules')
export class AIModulesController {
  constructor(
    private readonly aiModulesService: AIModulesService,
    private readonly createModuleService: CreateModuleService,
    private readonly publishModuleService: PublishModuleService,
    private readonly generatePatchService: GeneratePatchService,
    private readonly submitReviewService: SubmitReviewService,
    private readonly getModuleService: GetModuleService,
  ) {}

  @Get()
  @Auth()
  async findAll(
    @Query('status') status?: AIModuleStatus,
    @OrganizationId() organizationId?: string,
  ): Promise<AIModule[]> {
    if (!organizationId) {
      throw new NotFoundException('Organization ID is required')
    }
    return this.aiModulesService.findAll(organizationId, status)
  }

  @Get(':id')
  @Auth()
  async findOne(@Param('id') id: string, @OrganizationId() organizationId: string): Promise<AIModule> {
    try {
      await this.getModuleService.get(id, organizationId)
      // Return TypeORM entity for API compatibility
      return this.aiModulesService.findOne(id, organizationId)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new NotFoundException(err.message)
      }
      throw err
    }
  }

  @Post()
  @Auth()
  async create(
    @Body() createDto: Partial<AIModule>,
    @CurrentUser() user: User,
    @OrganizationId() organizationId: string,
  ): Promise<AIModule> {
    try {
      const module = await this.createModuleService.execute({
        name: createDto.name || '',
        description: createDto.description,
        organizationId,
        createdById: user.id,
      })
      // Return TypeORM entity for API compatibility
      return this.aiModulesService.findOne(module.id, organizationId)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Patch(':id')
  @Auth()
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<AIModule>,
    @OrganizationId() organizationId: string,
  ): Promise<AIModule> {
    return this.aiModulesService.update(id, updateDto, organizationId)
  }

  @Delete(':id')
  @Auth('system:manage')
  async remove(@Param('id') id: string, @OrganizationId() organizationId: string): Promise<void> {
    return this.aiModulesService.delete(id, organizationId)
  }

  @Post(':id/generate')
  @Auth('system:manage')
  async generatePatch(
    @Param('id') id: string,
    @Body() body: { prompt: string; entityType?: string; entityId?: string },
    @OrganizationId() organizationId: string,
  ): Promise<AIModule> {
    try {
      await this.generatePatchService.execute({
        moduleId: id,
        naturalLanguagePrompt: body.prompt,
        organizationId,
        entityType: body.entityType,
        entityId: body.entityId,
      })
      // Return TypeORM entity for API compatibility
      return this.aiModulesService.findOne(id, organizationId)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  /** Full system code generation (frontend + backend). Requires highest permission system:generate. */

  /**
   * Generate Model DSL from 6-step definition and save definition to database.
   * Note: Generates Model DSL (not Patch DSL). Patch DSL is only for modifying existing modules.
   */
  @Post(':id/generate-from-definition')
  @Auth('system:manage')
  async generateFromDefinition(
    @Param('id') id: string,
    @Body() body: { definition: Record<string, any> },
    @OrganizationId() organizationId: string,
  ): Promise<AIModule> {
    return this.aiModulesService.generateFromDefinition(id, body.definition ?? {}, organizationId)
  }

  @Get(':id/definition')
  @Auth('system:manage')
  async getDefinition(@Param('id') id: string, @OrganizationId() organizationId: string) {
    // Verify module belongs to organization
    await this.aiModulesService.findOne(id, organizationId)
    const definition = await this.aiModulesService.getDefinition(id)
    if (!definition) {
      throw new NotFoundException('Definition not found for this module')
    }
    return definition
  }

  @Post('modify')
  @Auth('system:manage')
  async modifyExistingModule(
    @Body() body: { moduleRegistryId: string; prompt: string },
    @CurrentUser() user: User,
    @OrganizationId() organizationId: string,
  ): Promise<AIModule> {
    return this.aiModulesService.modifyExistingModule(body.moduleRegistryId, body.prompt, organizationId, user?.id)
  }

  @Post('definition-step')
  @Auth('system:manage')
  async generateDefinitionStep(
    @Body() body: { stepId: string; userInput: string; context?: string },
  ): Promise<Record<string, any>> {
    return this.aiModulesService.generateDefinitionStep(
      body.stepId,
      body.userInput ?? '',
      body.context,
    )
  }

  @Post('generate-all-steps')
  @Auth('system:manage')
  async generateAllDefinitionSteps(
    @Body() body: { userInput: string; moduleId?: string },
  ): Promise<Record<string, any>> {
    if (!body?.userInput?.trim()) {
      throw new BadRequestException('userInput is required')
    }
    return this.aiModulesService.generateAllDefinitionSteps(
      body.userInput.trim(),
      body.moduleId,
    )
  }

  @Post(':id/test')
  @Auth('system:manage')
  async runTests(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ): Promise<AIModuleTest[]> {
    return this.aiModulesService.runTests(id, organizationId)
  }

  @Post(':id/submit-review')
  @Auth('system:manage')
  async submitForReview(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ): Promise<AIModule> {
    return this.aiModulesService.submitForReview(id, organizationId)
  }

  @Post(':id/review')
  @Auth('system:manage')
  async review(
    @Param('id') id: string,
    @Body() body: { decision: ReviewDecision; comments?: string; rejectionReason?: string },
    @CurrentUser() user: User,
    @OrganizationId() organizationId: string,
  ): Promise<AIModuleReview> {
    try {
      await this.submitReviewService.execute({
        moduleId: id,
        reviewerId: user.id,
        decision: body.decision === ReviewDecision.APPROVED ? 'approved' : 'rejected',
        comments: body.comments,
        rejectionReason: body.rejectionReason,
        organizationId,
      })
      // Return TypeORM entity for API compatibility
      return this.aiModulesService.review(
        id,
        user.id,
        body.decision,
        organizationId,
        body.comments,
        body.rejectionReason,
      )
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Post(':id/publish')
  @Auth('system:manage')
  async publish(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ): Promise<AIModule> {
    try {
      await this.publishModuleService.execute({
        moduleId: id,
        organizationId,
      })
      // Return TypeORM entity for API compatibility
      return this.aiModulesService.findOne(id, organizationId)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Post(':id/unpublish')
  @Auth('system:manage')
  async unpublish(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ): Promise<AIModule> {
    return this.aiModulesService.unpublish(id, organizationId)
  }
}
