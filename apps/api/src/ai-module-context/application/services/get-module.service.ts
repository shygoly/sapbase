import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import type { AIModule } from '../../domain/entities'
import type { IAIModuleRepository } from '../../domain/repositories'
import { AI_MODULE_REPOSITORY } from '../../domain/repositories'

@Injectable()
export class GetModuleService {
  constructor(
    @Inject(AI_MODULE_REPOSITORY)
    private readonly moduleRepository: IAIModuleRepository,
  ) {}

  async get(moduleId: string, organizationId: string): Promise<AIModule> {
    const module = await this.moduleRepository.findById(moduleId, organizationId)
    if (!module) {
      throw new BusinessRuleViolation('Module not found')
    }
    return module
  }
}
