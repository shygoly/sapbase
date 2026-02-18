import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { BadRequestException } from '@nestjs/common'
import axios from 'axios'
import { AIModulesService } from './ai-modules.service'
import { AIModule } from './ai-module.entity'
import { AIModuleTest } from './ai-module-test.entity'
import { AIModuleReview } from './ai-module-review.entity'
import { AIModelsService } from '../ai-models/ai-models.service'
import { ModuleRegistryService } from '../module-registry/module-registry.service'
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('AIModulesService', () => {
  let service: AIModulesService
  let aiModelsService: AIModelsService

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIModulesService,
        { provide: getRepositoryToken(AIModule), useValue: mockRepo },
        { provide: getRepositoryToken(AIModuleTest), useValue: mockRepo },
        { provide: getRepositoryToken(AIModuleReview), useValue: mockRepo },
        {
          provide: AIModelsService,
          useValue: {
            findDefault: jest.fn(),
          },
        },
        {
          provide: ModuleRegistryService,
          useValue: {},
        },
      ],
    }).compile()

    service = module.get<AIModulesService>(AIModulesService)
    aiModelsService = module.get<AIModelsService>(AIModelsService)
  })

  describe('generateDefinitionStep', () => {
    it('should return valid JSON with entities and fields for object-model step (CRM-style narrative)', async () => {
      const crmNarrative = 'CRM with Lead (name, email, company) and Account (name, industry).'
      const aiResponseJson = {
        entities: [
          {
            identifier: 'Lead',
            label: 'Lead',
            fields: [
              { name: 'name', label: 'Name', type: 'string', required: true },
              { name: 'email', label: 'Email', type: 'string', required: true },
              { name: 'company', label: 'Company', type: 'string', required: false },
            ],
          },
          {
            identifier: 'Account',
            label: 'Account',
            fields: [
              { name: 'name', label: 'Name', type: 'string', required: true },
              { name: 'industry', label: 'Industry', type: 'string', required: false },
            ],
          },
        ],
      }

      jest.spyOn(aiModelsService, 'findDefault').mockResolvedValue({
        id: 'model-1',
        name: 'Kimi',
        model: 'kimi-for-coding',
        baseUrl: 'https://api.kimi.com/coding/',
        apiKey: 'test-key',
      } as any)
      mockedAxios.post.mockResolvedValue({
        data: {
          content: [{ text: JSON.stringify(aiResponseJson) }],
        },
      })

      const result = await service.generateDefinitionStep('object-model', crmNarrative)

      expect(result).toEqual(aiResponseJson)
      expect(Array.isArray(result.entities)).toBe(true)
      expect(result.entities!.length).toBeGreaterThanOrEqual(1)
      expect(result.entities![0]).toHaveProperty('identifier')
      expect(result.entities![0]).toHaveProperty('fields')
      expect(Array.isArray(result.entities![0].fields)).toBe(true)
    })

    it('should throw BadRequestException when stepId is empty', async () => {
      await expect(service.generateDefinitionStep('', 'some input')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should throw BadRequestException when userInput is empty', async () => {
      await expect(service.generateDefinitionStep('object-model', '')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should throw when stepId is unknown', async () => {
      jest.spyOn(aiModelsService, 'findDefault').mockResolvedValue({} as any)
      await expect(
        service.generateDefinitionStep('unknown-step', 'input'),
      ).rejects.toThrow(BadRequestException)
    })
  })
})
