import { Test, TestingModule } from '@nestjs/testing'
import { StartWorkflowInstanceService } from './start-workflow-instance.service'
import { BusinessRuleViolation } from '../../domain/errors'
import {
  WORKFLOW_DEFINITION_REPOSITORY,
  WORKFLOW_INSTANCE_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type {
  IWorkflowDefinitionRepository,
  IWorkflowInstanceRepository,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { WorkflowDefinition, WorkflowStatus } from '../../domain/entities'
import { WorkflowInstanceStartedEvent } from '../../domain/events'

describe('StartWorkflowInstanceService (Application Service)', () => {
  let service: StartWorkflowInstanceService
  let workflowDefinitionRepo: jest.Mocked<IWorkflowDefinitionRepository>
  let workflowInstanceRepo: jest.Mocked<IWorkflowInstanceRepository>
  let eventPublisher: jest.Mocked<IEventPublisher>

  beforeEach(async () => {
    const mockWorkflowDefinitionRepo = {
      findById: jest.fn(),
      save: jest.fn(),
    }

    const mockWorkflowInstanceRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findRunningInstance: jest.fn(),
      findAll: jest.fn(),
      updateState: jest.fn(),
    }

    const mockEventPublisher = {
      publish: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartWorkflowInstanceService,
        {
          provide: WORKFLOW_DEFINITION_REPOSITORY,
          useValue: mockWorkflowDefinitionRepo,
        },
        {
          provide: WORKFLOW_INSTANCE_REPOSITORY,
          useValue: mockWorkflowInstanceRepo,
        },
        {
          provide: EVENT_PUBLISHER,
          useValue: mockEventPublisher,
        },
      ],
    }).compile()

    service = module.get<StartWorkflowInstanceService>(
      StartWorkflowInstanceService,
    )
    workflowDefinitionRepo = module.get(WORKFLOW_DEFINITION_REPOSITORY)
    workflowInstanceRepo = module.get(WORKFLOW_INSTANCE_REPOSITORY)
    eventPublisher = module.get(EVENT_PUBLISHER)
  })

  describe('execute', () => {
    it('should start a workflow instance successfully', async () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test Workflow',
        'order',
        [{ name: 'draft', initial: true, final: false }],
        [],
      )
      workflow.activate()

      workflowDefinitionRepo.findById.mockResolvedValue(workflow)
      workflowInstanceRepo.findRunningInstance.mockResolvedValue(null)
      workflowInstanceRepo.save.mockResolvedValue(undefined)

      const result = await service.execute({
        workflowDefinitionId: 'wf-1',
        entityType: 'order',
        entityId: 'order-123',
        organizationId: 'org-1',
        userId: 'user-1',
        context: { customField: 'value' },
      })

      expect(result.id).toBeDefined()
      expect(result.currentState).toBe('draft')
      expect(result.status).toBe('running')
      expect(workflowDefinitionRepo.findById).toHaveBeenCalledWith(
        'wf-1',
        'org-1',
      )
      expect(workflowInstanceRepo.save).toHaveBeenCalled()
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.any(WorkflowInstanceStartedEvent),
      )
    })

    it('should throw error if workflow definition not found', async () => {
      workflowDefinitionRepo.findById.mockResolvedValue(null)

      await expect(
        service.execute({
          workflowDefinitionId: 'wf-999',
          entityType: 'order',
          entityId: 'order-123',
          organizationId: 'org-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow()
    })

    it('should throw error if workflow is not active', async () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test',
        'order',
        [{ name: 'draft', initial: true, final: false }],
        [],
      )

      workflowDefinitionRepo.findById.mockResolvedValue(workflow)

      workflowInstanceRepo.findRunningInstance.mockResolvedValue(null)

      await expect(
        service.execute({
          workflowDefinitionId: 'wf-1',
          entityType: 'order',
          entityId: 'order-123',
          organizationId: 'org-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow()
    })
  })
})
