import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { BadRequestException } from '@nestjs/common'
import axios from 'axios'
import { AIModulesService } from './ai-modules.service'
// 服务后来加了「AI 模块定义」仓储依赖（spec 没跟上就 DI 报错）
import { AIModuleDefinition } from './ai-module-definition.entity'
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
  const mockDefinitionRepo = {
    findOne: jest.fn(),
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIModulesService,
        { provide: getRepositoryToken(AIModuleDefinition), useValue: mockDefinitionRepo },
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

    it('rejects a step output that does not match the step schema', async () => {
      jest.spyOn(aiModelsService, 'findDefault').mockResolvedValue({
        id: 'model-1',
        name: 'Kimi',
        model: 'kimi-for-coding',
        baseUrl: 'https://api.kimi.com/coding/',
        apiKey: 'test-key',
      } as any)
      mockedAxios.post.mockResolvedValue({
        data: {
          content: [
            {
              text: JSON.stringify({
                entities: [{ identifier: 'Lead', fields: [{ name: 'name', type: 'sql' }] }],
              }),
            },
          ],
        },
      })

      await expect(service.generateDefinitionStep('object-model', 'CRM')).rejects.toThrow(
        BadRequestException,
      )
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

  describe('generateFromDefinition', () => {
    it('converts a flat wizard definition deterministically into Blueprint layers', async () => {
      const moduleRow = {
        id: 'module-1',
        name: 'Ticket App',
        organizationId: 'org-1',
        patchContent: {},
      }
      mockRepo.findOne.mockResolvedValue(moduleRow)
      mockRepo.save.mockImplementation(async (row: unknown) => row)
      mockDefinitionRepo.findOne.mockResolvedValue(null)

      const definition = {
        entities: [
          {
            identifier: 'Ticket',
            fields: [{ name: 'title', type: 'string', required: true }],
          },
        ],
        relationships: [],
        states: [
          { name: 'draft', initial: true },
          { name: 'closed', final: true },
        ],
        transitions: [{ from: 'draft', to: 'closed' }],
      }

      const result = await service.generateFromDefinition('module-1', definition, 'org-1')

      expect(result.patchContent.scope).toBe('blueprint')
      expect(Object.keys(result.patchContent.objects)).toEqual(['Ticket'])
      expect(result.patchContent.semantic.entities[0].name).toBe('Ticket')
      expect(result.patchContent.flows.flows).toEqual([])
      expect(mockDefinitionRepo.save).toHaveBeenCalled()
    })

    it('rejects an invalid definition before overwriting patchContent', async () => {
      const moduleRow = {
        id: 'module-1',
        name: 'Ticket App',
        organizationId: 'org-1',
        patchContent: { keep: true },
      }
      mockRepo.findOne.mockResolvedValue(moduleRow)

      await expect(
        service.generateFromDefinition(
          'module-1',
          {
            entities: [{ identifier: 'bad-name!', fields: [{ name: 'title', type: 'string' }] }],
            relationships: [],
            states: [{ name: 'draft', initial: true }, { name: 'closed', final: true }],
            transitions: [{ from: 'draft', to: 'closed' }],
          },
          'org-1',
        ),
      ).rejects.toThrow(BadRequestException)
      expect(moduleRow.patchContent).toEqual({ keep: true })
      expect(mockRepo.save).not.toHaveBeenCalled()
    })
  })
})
