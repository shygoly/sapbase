import { WorkflowDefinition, WorkflowStatus } from './workflow-definition.entity'
import { DomainError } from '../errors'

describe('WorkflowDefinition (Domain Entity)', () => {
  describe('create', () => {
    it('should create a valid workflow definition', () => {
      const workflow = WorkflowDefinition.create(
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

      expect(workflow.id).toBe('wf-1')
      expect(workflow.name).toBe('Test Workflow')
      expect(workflow.entityType).toBe('order')
      expect(workflow.status).toBe(WorkflowStatus.DRAFT)
      expect(workflow.states).toHaveLength(3)
      expect(workflow.transitions).toHaveLength(2)
    })

    it('should throw error if no initial state', () => {
      expect(() =>
        WorkflowDefinition.create(
          'wf-1',
          'org-1',
          'Test',
          'order',
          [
            { name: 'draft', initial: false, final: false },
            { name: 'approved', initial: false, final: false },
          ],
          [],
        ),
      ).toThrow(DomainError)
    })

    it('should throw error if multiple initial states', () => {
      expect(() =>
        WorkflowDefinition.create(
          'wf-1',
          'org-1',
          'Test',
          'order',
          [
            { name: 'draft', initial: true, final: false },
            { name: 'start', initial: true, final: false },
          ],
          [],
        ),
      ).toThrow(DomainError)
    })

    it('should throw error if transition references unknown state', () => {
      expect(() =>
        WorkflowDefinition.create(
          'wf-1',
          'org-1',
          'Test',
          'order',
          [{ name: 'draft', initial: true, final: false }],
          [{ from: 'draft', to: 'unknown' }],
        ),
      ).toThrow(DomainError)
    })
  })

  describe('activate', () => {
    it('should activate a draft workflow', () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test',
        'order',
        [{ name: 'draft', initial: true, final: false }],
        [],
      )

      workflow.activate()

      expect(workflow.status).toBe(WorkflowStatus.ACTIVE)
    })

    it('should allow reactivating an active workflow', () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test',
        'order',
        [{ name: 'draft', initial: true, final: false }],
        [],
      )
      workflow.activate()

      // Current implementation allows reactivation
      expect(() => workflow.activate()).not.toThrow()
      expect(workflow.status).toBe(WorkflowStatus.ACTIVE)
    })
  })

  describe('findTransition', () => {
    it('should find existing transition', () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test',
        'order',
        [
          { name: 'draft', initial: true, final: false },
          { name: 'approved', initial: false, final: false },
        ],
        [{ from: 'draft', to: 'approved' }],
      )

      const transition = workflow.findTransition('draft', 'approved')

      expect(transition).toBeDefined()
      expect(transition?.from).toBe('draft')
      expect(transition?.to).toBe('approved')
    })

    it('should return null for non-existent transition', () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test',
        'order',
        [
          { name: 'draft', initial: true, final: false },
          { name: 'approved', initial: false, final: false },
        ],
        [{ from: 'draft', to: 'approved' }],
      )

      const transition = workflow.findTransition('draft', 'completed')

      expect(transition).toBeNull()
    })
  })

  describe('getInitialState', () => {
    it('should return initial state', () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test',
        'order',
        [
          { name: 'draft', initial: true, final: false },
          { name: 'approved', initial: false, final: false },
        ],
        [],
      )

      const initialState = workflow.getInitialState()

      expect(initialState.name).toBe('draft')
      expect(initialState.initial).toBe(true)
    })
  })

  describe('getFinalStates', () => {
    it('should return final states', () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test',
        'order',
        [
          { name: 'draft', initial: true, final: false },
          { name: 'completed', initial: false, final: true },
          { name: 'cancelled', initial: false, final: true },
        ],
        [],
      )

      const finalStates = workflow.getFinalStates()

      expect(finalStates).toHaveLength(2)
      expect(finalStates.map((s) => s.name)).toContain('completed')
      expect(finalStates.map((s) => s.name)).toContain('cancelled')
    })
  })

  describe('isFinalState', () => {
    it('should return true for final state', () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test',
        'order',
        [
          { name: 'draft', initial: true, final: false },
          { name: 'completed', initial: false, final: true },
        ],
        [],
      )

      expect(workflow.isFinalState('completed')).toBe(true)
      expect(workflow.isFinalState('draft')).toBe(false)
    })
  })

  describe('ensureCanStart', () => {
    it('should allow starting active workflow', () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test',
        'order',
        [{ name: 'draft', initial: true, final: false }],
        [],
      )
      workflow.activate()

      expect(() => workflow.ensureCanStart()).not.toThrow()
    })

    it('should throw error for inactive workflow', () => {
      const workflow = WorkflowDefinition.create(
        'wf-1',
        'org-1',
        'Test',
        'order',
        [{ name: 'draft', initial: true, final: false }],
        [],
      )

      expect(() => workflow.ensureCanStart()).toThrow(DomainError)
    })
  })
})
