import { TransitionValidator } from './transition-validator.service'
import type { WorkflowTransitionVO } from '../value-objects'

describe('TransitionValidator (Domain Service)', () => {
  const validator = new TransitionValidator()

  describe('validateTransition', () => {
    it('should return valid when transition has no guard', () => {
      const transition: WorkflowTransitionVO = { from: 'draft', to: 'approved' }
      const result = validator.validateTransition(transition)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return invalid when transition is null', () => {
      const result = validator.validateTransition(null)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('No transition found')
    })

    it('should return valid when expression guard passes', () => {
      const transition: WorkflowTransitionVO = {
        from: 'draft',
        to: 'approved',
        guard: 'entity.status === "ready"',
      }
      const result = validator.validateTransition(transition, {
        status: 'ready',
      })
      expect(result.valid).toBe(true)
    })

    it('should return invalid when expression guard fails', () => {
      const transition: WorkflowTransitionVO = {
        from: 'draft',
        to: 'approved',
        guard: 'entity.status === "ready"',
      }
      const result = validator.validateTransition(transition, {
        status: 'pending',
      })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should return valid for ai_guard without evaluating', () => {
      const transition: WorkflowTransitionVO = {
        from: 'draft',
        to: 'approved',
        guard: 'ai_guard',
      }
      const result = validator.validateTransition(transition)
      expect(result.valid).toBe(true)
    })
  })
})
