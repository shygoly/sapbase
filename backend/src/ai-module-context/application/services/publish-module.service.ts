import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import type { IAIModuleRepository } from '../../domain/repositories'
import type { IModuleRegistryService } from '../../domain/services'
import {
  AI_MODULE_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import { MODULE_REGISTRY_SERVICE } from '../../domain/services'
import type { IEventPublisher } from '../../domain/events'
import { ModulePublishedEvent, ModuleRegisteredEvent } from '../../domain/events'

export interface PublishModuleCommand {
  moduleId: string
  organizationId: string
}

@Injectable()
export class PublishModuleService {
  constructor(
    @Inject(AI_MODULE_REPOSITORY)
    private readonly moduleRepository: IAIModuleRepository,
    @Inject(MODULE_REGISTRY_SERVICE)
    private readonly moduleRegistryService: IModuleRegistryService,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: PublishModuleCommand): Promise<void> {
    const module = await this.moduleRepository.findById(command.moduleId, command.organizationId)
    if (!module) {
      throw new BusinessRuleViolation('Module not found')
    }

    if (!module.canBePublished()) {
      throw new BusinessRuleViolation('Only approved modules can be published')
    }

    module.publish()
    await this.moduleRepository.save(module)

    // Register in module registry
    const registryModuleId = await this.moduleRegistryService.registerModule(module.id, {
      name: module.name,
      description: module.description,
      version: module.version,
      patchContent: module.patchContent,
      organizationId: command.organizationId,
    })

    await this.eventPublisher.publish(
      new ModulePublishedEvent(module.id, command.organizationId, module.version, new Date()),
    )

    await this.eventPublisher.publish(
      new ModuleRegisteredEvent(module.id, command.organizationId, registryModuleId, new Date()),
    )
  }
}
