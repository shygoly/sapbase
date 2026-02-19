import { Test, TestingModule } from '@nestjs/testing'
import { CreateModuleService } from './create-module.service'
import {
  AI_MODULE_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type { IAIModuleRepository } from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { AIModule } from '../../domain/entities/ai-module.entity'
import { createMockEventPublisher, createMockRepository } from '../../../test/utils/test-helpers'

describe('CreateModuleService', () => {
  let service: CreateModuleService
  let moduleRepository: jest.Mocked<IAIModuleRepository>
  let eventPublisher: jest.Mocked<IEventPublisher>

  beforeEach(async () => {
    const mockModuleRepository = createMockRepository<IAIModuleRepository>()
    const mockEventPublisher = createMockEventPublisher()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateModuleService,
        {
          provide: AI_MODULE_REPOSITORY,
          useValue: mockModuleRepository,
        },
        {
          provide: EVENT_PUBLISHER,
          useValue: mockEventPublisher,
        },
      ],
    }).compile()

    service = module.get<CreateModuleService>(CreateModuleService)
    moduleRepository = module.get(AI_MODULE_REPOSITORY)
    eventPublisher = module.get(EVENT_PUBLISHER)
  })

  describe('execute', () => {
    it('should create an AI module successfully', async () => {
      const command = {
        organizationId: 'org-1',
        name: 'Test Module',
        description: 'Test description',
      }

      moduleRepository.save.mockResolvedValue(undefined)

      const result = await service.execute(command)

      expect(result).toBeDefined()
      expect(result.name).toBe('Test Module')
      expect(result.organizationId).toBe('org-1')
      expect(moduleRepository.save).toHaveBeenCalled()
      expect(eventPublisher.publish).toHaveBeenCalled()
    })

    it('should create module with default description if not provided', async () => {
      const command = {
        organizationId: 'org-1',
        name: 'Test Module',
      }

      moduleRepository.save.mockResolvedValue(undefined)

      const result = await service.execute(command)

      expect(result).toBeDefined()
      expect(result.description).toBeDefined()
    })
  })
})
