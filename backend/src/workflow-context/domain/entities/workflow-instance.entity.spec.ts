import { WorkflowInstance, WorkflowInstanceStatus } from './workflow-instance.entity'
import { WorkflowDefinition, WorkflowStatus } from './workflow-definition.entity'
import { DomainError } from '../errors'

describe('WorkflowInstance (Domain Entity)', () => {
  let workflow: WorkflowDefinition

  beforeEach(() => {
    workflow = WorkflowDefinition.create(
      'wf-1',
      'org-1',
      'Test Workflow',
      'order',
      [
        { name: 'draft', initial: true, final: false },
        { name: 'approved', initial: false, final: false },
        { name: 'completed', initial: false, final: true },
      ],
      [
        { from: 'draft', to: 'approved' },
        { from: 'approved', to: 'completed' },
      ],
    )
    workflow.activate()
  })

  describe('create', () => {
    it('should create a new workflow instance', () => {
      const instance = WorkflowInstance.create(
        'inst-1',
        'org-1',
        workflow,
        'order',
        'order-123',
        'user-1',
        { customField: 'value' },
      )

      expect(instance.id).toBe('inst-1')
      expect(instance.organizationId).toBe('org-1')
      expect(instance.workflowDefinitionId).toBe('wf-1')
      expect(instance.entityType).toBe('order')
      expect(instance.entityId).toBe('order-123')
      expect(instance.currentState).toBe('draft')
      expect(instance.status).toBe(WorkflowInstanceStatus.RUNNING)
      expect(instance.startedById).toBe('user-1')
      expect(instance.context).toEqual({ customField: 'value' })
    })

    it('should throw error if workflow is not active', () => {
      const inactiveWorkflow = WorkflowDefinition.create(
        'wf-2',
        'org-1',
        'Test',
        'order',
        [{ name: 'draft', initial: true, final: false }],
        [],
      )

      expect(() =>
        WorkflowInstance.create(
          'inst-1',
          'org-1',
          inactiveWorkflow,
          'order',
          'order-123',
          'user-1',
        ),
      ).toThrow(DomainError)
    })
  })

  describe('transitionTo', () => {
    it('should transition to next state', () => {
      const instance = WorkflowInstance.create(
        'inst-1',
        'org-1',
        workflow,
        'order',
        'order-123',
        'user-1',
      )

      instance.transitionTo('approved', workflow)

      expect(instance.currentState).toBe('approved')
      expect(instance.status).toBe(WorkflowInstanceStatus.RUNNING)
    })

    it('should complete instance when transitioning to final state', () => {
      const instance = WorkflowInstance.create(
        'inst-1',
        'org-1',
        workflow,
        'order',
        'order-123',
        'user-1',
      )
      instance.transitionTo('approved', workflow)

      instance.transitionTo('completed', workflow)

      expect(instance.currentState).toBe('completed')
      expect(instance.status).toBe(WorkflowInstanceStatus.COMPLETED)
      expect(instance.completedAt).toBeInstanceOf(Date)
    })

    it('should throw error if transition does not exist', () => {
      const instance = WorkflowInstance.create(
        'inst-1',
        'org-1',
        workflow,
        'order',
        'order-123',
        'user-1',
      )

      expect(() => instance.transitionTo('completed', workflow)).toThrow(
        DomainError,
      )
    })

    it('should throw error if instance is not running', () => {
      const instance = WorkflowInstance.create(
        'inst-1',
        'org-1',
        workflow,
        'order',
        'order-123',
        'user-1',
      )
      instance.cancel()

      expect(() => instance.transitionTo('approved', workflow)).toThrow(
        DomainError,
      )
    })
  })

  describe('cancel', () => {
    it('should cancel a running instance', () => {
      const instance = WorkflowInstance.create(
        'inst-1',
        'org-1',
        workflow,
        'order',
        'order-123',
        'user-1',
      )

      instance.cancel()

      expect(instance.status).toBe(WorkflowInstanceStatus.CANCELLED)
      expect(instance.completedAt).toBeInstanceOf(Date)
    })

    it('should throw error if instance is not running', () => {
      const instance = WorkflowInstance.create(
        'inst-1',
        'org-1',
        workflow,
        'order',
        'order-123',
        'user-1',
      )
      instance.cancel()

      expect(() => instance.cancel()).toThrow(DomainError)
    })
  })

  describe('complete', () => {
    it('should complete a running instance', () => {
      const instance = WorkflowInstance.create(
        'inst-1',
        'org-1',
        workflow,
        'order',
        'order-123',
        'user-1',
      )

      instance.complete('completed')

      expect(instance.currentState).toBe('completed')
      expect(instance.status).toBe(WorkflowInstanceStatus.COMPLETED)
      expect(instance.completedAt).toBeInstanceOf(Date)
    })

    it('should throw error if instance is not running', () => {
      const instance = WorkflowInstance.create(
        'inst-1',
        'org-1',
        workflow,
        'order',
        'order-123',
        'user-1',
      )
      instance.cancel()

      expect(() => instance.complete('completed')).toThrow(DomainError)
    })
  })
})
