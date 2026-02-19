import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import type { IAIModuleRepository } from '../../domain/repositories'
import type { IAIModelService } from '../../domain/services'
import type { IWorkflowService } from '../../domain/services'
import { AI_MODULE_REPOSITORY, EVENT_PUBLISHER } from '../../domain/repositories'
import { AI_MODEL_SERVICE, WORKFLOW_SERVICE } from '../../domain/services'
import type { IEventPublisher } from '../../domain/events'
import { PatchGeneratedEvent } from '../../domain/events'

export interface GeneratePatchCommand {
  moduleId: string
  naturalLanguagePrompt: string
  organizationId: string
  entityType?: string
  entityId?: string
}

@Injectable()
export class GeneratePatchService {
  constructor(
    @Inject(AI_MODULE_REPOSITORY)
    private readonly moduleRepository: IAIModuleRepository,
    @Inject(AI_MODEL_SERVICE)
    private readonly aiModelService: IAIModelService,
    @Inject(WORKFLOW_SERVICE)
    private readonly workflowService: IWorkflowService,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: GeneratePatchCommand): Promise<void> {
    const module = await this.moduleRepository.findById(command.moduleId, command.organizationId)
    if (!module) {
      throw new BusinessRuleViolation('Module not found')
    }

    let context: string | undefined
    if (command.entityType && command.entityId) {
      const workflowContext = await this.workflowService.getWorkflowContext(
        command.entityType,
        command.entityId,
        command.organizationId,
      )
      if (workflowContext) {
        context = workflowContext
      }
    }

    const patchContent = await this.aiModelService.generatePatch(command.naturalLanguagePrompt, context)

    module.updatePatch(patchContent, command.naturalLanguagePrompt)
    await this.moduleRepository.save(module)

    await this.eventPublisher.publish(
      new PatchGeneratedEvent(module.id, command.organizationId, command.naturalLanguagePrompt, new Date()),
    )
  }
}
