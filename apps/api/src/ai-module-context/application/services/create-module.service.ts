import { Inject, Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { AIModule } from '../../domain/entities'
import type { IAIModuleRepository } from '../../domain/repositories'
import { AI_MODULE_REPOSITORY, EVENT_PUBLISHER } from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { ModuleCreatedEvent } from '../../domain/events'

export interface CreateModuleCommand {
  name: string
  description?: string
  organizationId: string
  createdById?: string
}

@Injectable()
export class CreateModuleService {
  constructor(
    @Inject(AI_MODULE_REPOSITORY)
    private readonly moduleRepository: IAIModuleRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CreateModuleCommand): Promise<AIModule> {
    const moduleId = uuidv4()
    const module = AIModule.create(
      moduleId,
      command.organizationId,
      command.name,
      command.createdById || null,
    )

    if (command.description) {
      module.updateDescription(command.description)
    }

    await this.moduleRepository.save(module)

    await this.eventPublisher.publish(
      new ModuleCreatedEvent(
        module.id,
        command.organizationId,
        module.name,
        command.createdById || null,
        new Date(),
      ),
    )

    return module
  }
}
