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
import { AIModuleVersion } from './ai-module-version.entity'
import { AIModelsService } from '../ai-models/ai-models.service'
import { ModuleRegistryService } from '../module-registry/module-registry.service'
import { AIModuleBlueprintService } from './ai-module-blueprint.service'
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
  const mockVersionRepo = {
    find: jest.fn(async () => []),
    findOne: jest.fn(),
    findAndCount: jest.fn(async () => [[], 0]),
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
    delete: jest.fn(async () => ({ affected: 0 })),
  }
  const mockDefinitionRepo = {
    findOne: jest.fn(),
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
  }
  const mockModuleRegistry = {
    getAiGenerationContext: jest.fn(async () => [] as any[]),
  }
  const mockBlueprintService = {
    materialize: jest.fn(async () => ({
      packageId: 'ticket-app-1.0.0',
      packagePath: '/tmp/ticket-app-1.0.0.erpkg',
      manifest: {},
      irDigest: 'sha256:' + 'a'.repeat(64),
      compiledAt: '2026-01-01T00:00:00.000Z',
    })),
    deliver: jest.fn(async () => ({ id: 'ticket-app-1.0.0', manifest: {} })),
    load: jest.fn(async () => ({
      plan: { irDigest: 'sha256:' + 'c'.repeat(64) },
      license: { grantedTo: ['org-1'], resell: false, expiresAt: undefined, issuer: 'test' },
    })),
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
        { provide: getRepositoryToken(AIModuleVersion), useValue: mockVersionRepo },
        {
          provide: AIModelsService,
          useValue: {
            findDefault: jest.fn(),
          },
        },
        {
          provide: ModuleRegistryService,
          useValue: mockModuleRegistry,
        },
        { provide: AIModuleBlueprintService, useValue: mockBlueprintService },
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

    it('injects registered module context into the generation prompt', async () => {
      jest.spyOn(aiModelsService, 'findDefault').mockResolvedValue({
        id: 'model-1',
        name: 'Kimi',
        model: 'kimi-for-coding',
        baseUrl: 'https://api.kimi.com/coding/',
        apiKey: 'test-key',
      } as any)
      mockModuleRegistry.getAiGenerationContext.mockResolvedValueOnce([
        {
          id: 'module-1',
          name: 'CRM Module',
          entities: ['Customer'],
          capabilities: [
            {
              entity: 'Customer',
              operations: ['read'],
              apiEndpoints: ['/api/customers'],
            },
          ],
        },
      ])
      mockedAxios.post.mockResolvedValue({
        data: {
          content: [
            {
              text: JSON.stringify({
                entities: [
                  {
                    identifier: 'Ticket',
                    fields: [{ name: 'title', type: 'string', required: true }],
                  },
                ],
              }),
            },
          ],
        },
      })

      await service.generateDefinitionStep('object-model', 'create ticket', undefined, 'org-1')
      const payload = mockedAxios.post.mock.calls[0][1] as any
      expect(mockModuleRegistry.getAiGenerationContext).toHaveBeenCalledWith('org-1')
      expect(payload.messages[0].content).toContain('CRM Module')
      expect(payload.messages[0].content).toContain('/api/customers')
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
      expect(result.patchContent.blueprint.packageId).toBe('ticket-app-1.0.0')
      expect(result.metadata.blueprint.irDigest).toMatch(/^sha256:/)
      expect(mockBlueprintService.materialize).toHaveBeenCalled()
      expect(mockDefinitionRepo.save).toHaveBeenCalled()
    })

    it('applies an object patch, bumps the version, and recompiles', async () => {
      const moduleRow = {
        id: 'module-1',
        name: 'Ticket App',
        organizationId: 'org-1',
        version: '1.0.0',
        patchContent: {},
        metadata: {},
      }
      const definitionRow = {
        aiModuleId: 'module-1',
        mergedDefinition: {
          objectModel: {
            entities: [
              { identifier: 'Ticket', fields: [{ name: 'title', type: 'string' }] },
            ],
          },
          relationships: { relationships: [] },
          stateFlow: {
            states: [
              { name: 'draft', initial: true },
              { name: 'closed', final: true },
            ],
            transitions: [{ from: 'draft', to: 'closed' }],
          },
        },
      }
      mockRepo.findOne.mockResolvedValue(moduleRow)
      mockRepo.save.mockImplementation(async (row: unknown) => row)
      mockDefinitionRepo.findOne.mockResolvedValue(definitionRow)
      mockDefinitionRepo.save.mockImplementation(async (row: unknown) => row)
      mockBlueprintService.materialize.mockResolvedValue({
        packageId: 'ticket-app-1.0.1',
        packagePath: '/tmp/ticket-app-1.0.1.erpkg',
        manifest: {},
        irDigest: `sha256:${'b'.repeat(64)}`,
        compiledAt: '2026-01-01T00:00:00.000Z',
      })

      const result = await service.applyDefinitionPatchToModule(
        'module-1',
        {
          scope: 'object',
          operation: 'add',
          target: { identifier: 'Ticket' },
          payload: { field: { name: 'priority', type: 'number' } },
        },
        'org-1',
      )

      expect(result.version).toBe('1.0.1')
      expect(mockBlueprintService.materialize).toHaveBeenCalledWith(
        expect.objectContaining({ version: '1.0.1' }),
      )
      expect(result.metadata.patches).toHaveLength(1)
      expect(result.patchContent.blueprint.packageId).toBe('ticket-app-1.0.1')
    })

    it('delivers and loads the package, recording signed/loaded timestamps', async () => {
      const moduleRow = {
        id: 'module-1',
        name: 'Ticket App',
        organizationId: 'org-1',
        version: '1.0.0',
        patchContent: {},
        metadata: { blueprint: { packageId: 'ticket-app-1.0.0' } },
      }
      mockRepo.findOne.mockResolvedValue(moduleRow)
      mockRepo.save.mockImplementation(async (row: unknown) => row)

      const result = await service.deliverBlueprint('module-1', 'org-1', {
        grantedTo: ['org-1'],
        expiresAt: '2030-01-01T00:00:00.000Z',
      })

      expect(mockBlueprintService.deliver).toHaveBeenCalledWith(
        'ticket-app-1.0.0',
        expect.objectContaining({ grantedTo: ['org-1'] }),
      )
      expect(mockBlueprintService.load).toHaveBeenCalledWith('ticket-app-1.0.0', 'org-1')
      expect(result.packageId).toBe('ticket-app-1.0.0')
      expect(result.signedAt).toBeDefined()
      expect(result.loadedAt).toBeDefined()
      expect((moduleRow.metadata.blueprint as any).loadedAt).toBeDefined()
      expect(mockRepo.save).toHaveBeenCalled()
    })

    it('does not record loadedAt when load verification fails', async () => {
      const moduleRow = {
        id: 'module-1',
        name: 'Ticket App',
        organizationId: 'org-1',
        version: '1.0.0',
        patchContent: {},
        metadata: { blueprint: { packageId: 'ticket-app-1.0.0' } },
      }
      mockRepo.findOne.mockResolvedValue(moduleRow)
      mockBlueprintService.load.mockRejectedValueOnce(new Error('unauthorized'))

      await expect(
        service.deliverBlueprint('module-1', 'org-1', { grantedTo: ['org-2'] }),
      ).rejects.toThrow('unauthorized')
      expect((moduleRow.metadata.blueprint as any).loadedAt).toBeUndefined()
      expect(mockRepo.save).not.toHaveBeenCalled()
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
