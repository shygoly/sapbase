import { Test, TestingModule } from '@nestjs/testing'
import { ExecuteTransitionService } from './execute-transition.service'
import {
  WORKFLOW_DEFINITION_REPOSITORY,
  WORKFLOW_INSTANCE_REPOSITORY,
  WORKFLOW_HISTORY_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type {
  IWorkflowDefinitionRepository,
  IWorkflowInstanceRepository,
  IWorkflowHistoryRepository,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { AI_GUARD_EVALUATOR } from '../../domain/services'
import type { IAiGuardEvaluator } from '../../domain/services'
import { createMockEventPublisher, createMockRepository } from '../../../../test/utils/test-helpers'
import { WorkflowDefinition } from '../../domain/entities/workflow-definition.entity'
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '../../domain/entities/workflow-instance.entity'

describe('ExecuteTransitionService', () => {
  let service: ExecuteTransitionService
  let workflowDefinitionRepo: jest.Mocked<IWorkflowDefinitionRepository>
  let workflowInstanceRepo: jest.Mocked<IWorkflowInstanceRepository>
  let historyRepo: jest.Mocked<IWorkflowHistoryRepository>
  let eventPublisher: jest.Mocked<IEventPublisher>

  const orgId = 'org-1'

  beforeEach(async () => {
    const mockWorkflowDefinitionRepo = createMockRepository<IWorkflowDefinitionRepository>()
    const mockWorkflowInstanceRepo = createMockRepository<IWorkflowInstanceRepository>()
    const mockHistoryRepo = {
      create: jest.fn().mockResolvedValue({ id: 'hist-1' }),
      findByInstanceId: jest.fn().mockResolvedValue([]),
    }
    const mockEventPublisher = createMockEventPublisher()
    const mockAiGuardEvaluator: jest.Mocked<IAiGuardEvaluator> = {
      evaluateGuard: jest.fn().mockResolvedValue({ allowed: true, reason: null, model: null, error: null }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecuteTransitionService,
        {
          provide: WORKFLOW_DEFINITION_REPOSITORY,
          useValue: mockWorkflowDefinitionRepo,
        },
        {
          provide: WORKFLOW_INSTANCE_REPOSITORY,
          useValue: mockWorkflowInstanceRepo,
        },
        {
          provide: WORKFLOW_HISTORY_REPOSITORY,
          useValue: mockHistoryRepo,
        },
        {
          provide: EVENT_PUBLISHER,
          useValue: mockEventPublisher,
        },
        {
          provide: AI_GUARD_EVALUATOR,
          useValue: mockAiGuardEvaluator,
        },
      ],
    }).compile()

    service = module.get<ExecuteTransitionService>(ExecuteTransitionService)
    workflowDefinitionRepo = module.get(WORKFLOW_DEFINITION_REPOSITORY)
    workflowInstanceRepo = module.get(WORKFLOW_INSTANCE_REPOSITORY)
    historyRepo = module.get(WORKFLOW_HISTORY_REPOSITORY)
    eventPublisher = module.get(EVENT_PUBLISHER)
  })

  describe('execute', () => {
    it('should execute transition successfully', async () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        orgId,
        'Test',
        'order',
        [
          { name: 'draft', initial: true, final: false },
          { name: 'approved', initial: false, final: false },
        ],
        [{ from: 'draft', to: 'approved' }],
      )
      workflow.activate()

      const instance = WorkflowInstance.fromPersistence(
        'instance-1',
        orgId,
        'wf-1',
        'order',
        'entity-1',
        'draft',
        {},
        WorkflowInstanceStatus.RUNNING,
        'user-0',
        new Date(),
        null,
      )

      const command = {
        instanceId: 'instance-1',
        toState: 'approved',
        userId: 'user-1',
        organizationId: orgId,
      }

      workflowInstanceRepo.findById.mockResolvedValue(instance)
      workflowDefinitionRepo.findById.mockResolvedValue(workflow)
      workflowInstanceRepo.save.mockResolvedValue(undefined)

      const result = await service.execute(command)

      expect(result.success).toBe(true)
      expect(workflowInstanceRepo.save).toHaveBeenCalled()
      expect(eventPublisher.publish).toHaveBeenCalled()
    })

    it('should return success false when instance not found', async () => {
      const command = {
        instanceId: 'instance-999',
        toState: 'approved',
        userId: 'user-1',
        organizationId: orgId,
      }

      workflowInstanceRepo.findById.mockResolvedValue(null)

      const result = await service.execute(command)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should return success false when transition is invalid', async () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        orgId,
        'Test',
        'order',
        [
          { name: 'draft', initial: true, final: false },
          { name: 'approved', initial: false, final: false },
        ],
        [{ from: 'draft', to: 'approved' }],
      )
      workflow.activate()

      const instance = WorkflowInstance.fromPersistence(
        'instance-1',
        orgId,
        'wf-1',
        'order',
        'entity-1',
        'draft',
        {},
        WorkflowInstanceStatus.RUNNING,
        'user-0',
        new Date(),
        null,
      )

      const command = {
        instanceId: 'instance-1',
        toState: 'invalid-state',
        userId: 'user-1',
        organizationId: orgId,
      }

      workflowInstanceRepo.findById.mockResolvedValue(instance)
      workflowDefinitionRepo.findById.mockResolvedValue(workflow)

      const result = await service.execute(command)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No transition exists')
    })
  })
})
