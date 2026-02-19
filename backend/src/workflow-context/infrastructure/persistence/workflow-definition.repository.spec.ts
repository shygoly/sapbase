import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WorkflowDefinitionRepository } from './workflow-definition.repository'
import { WorkflowDefinition as WorkflowDefinitionOrm } from '../../../workflows/workflow-definition.entity'
import { WorkflowDefinition } from '../../domain/entities/workflow-definition.entity'

describe('WorkflowDefinitionRepository (Infrastructure)', () => {
  let repository: WorkflowDefinitionRepository
  let repo: jest.Mocked<Repository<WorkflowDefinitionOrm>>

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowDefinitionRepository,
        {
          provide: getRepositoryToken(WorkflowDefinitionOrm),
          useValue: mockRepo,
        },
      ],
    }).compile()

    repository = module.get<WorkflowDefinitionRepository>(
      WorkflowDefinitionRepository,
    )
    repo = module.get(getRepositoryToken(WorkflowDefinitionOrm))
  })

  describe('findById', () => {
    it('should find workflow definition by id', async () => {
      const workflowOrm = {
        id: 'wf-1',
        organizationId: 'org-1',
        name: 'Test Workflow',
        entityType: 'order',
        states: [{ name: 'draft', initial: true, final: false }],
        transitions: [],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      repo.findOne.mockResolvedValue(workflowOrm as any)

      const result = await repository.findById('wf-1', 'org-1')

      expect(result).toBeDefined()
      expect(result?.id).toBe('wf-1')
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'wf-1', organizationId: 'org-1' },
      })
    })

    it('should return null if not found', async () => {
      repo.findOne.mockResolvedValue(null)

      const result = await repository.findById('wf-999', 'org-1')

      expect(result).toBeNull()
    })
  })

  describe('save', () => {
    it('should save workflow definition', async () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test Workflow',
        'order',
        [{ name: 'draft', initial: true, final: false }],
        [],
      )

      repo.save.mockResolvedValue({
        id: 'wf-1',
        organizationId: 'org-1',
        name: 'Test Workflow',
        entityType: 'order',
        states: [],
        transitions: [],
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      await repository.save(workflow)

      expect(repo.save).toHaveBeenCalled()
    })
  })
})
