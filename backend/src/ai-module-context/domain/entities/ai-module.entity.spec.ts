import { AIModule } from './ai-module.entity'
import { AIModuleStatus } from './ai-module.entity'
import { BusinessRuleViolation } from '../errors'

describe('AIModule (Domain Entity)', () => {
  describe('create', () => {
    it('should create an AI module with valid data', () => {
      const module = AIModule.create(
        'module-1',
        'org-1',
        'Test Module',
        'Test description',
      )

      expect(module.id).toBe('module-1')
      expect(module.organizationId).toBe('org-1')
      expect(module.name).toBe('Test Module')
      expect(module.description).toBe('Test description')
      expect(module.status).toBe(AIModuleStatus.DRAFT)
    })

    it('should throw error if name is empty', () => {
      expect(() => {
        AIModule.create('module-1', 'org-1', '', 'Description')
      }).toThrow(BusinessRuleViolation)
    })
  })

  describe('publish', () => {
    it('should publish a draft module', () => {
      const module = AIModule.create(
        'module-1',
        'org-1',
        'Test Module',
        'Description',
      )

      module.publish()

      expect(module.status).toBe(AIModuleStatus.PUBLISHED)
    })

    it('should throw error if module is already published', () => {
      const module = AIModule.create(
        'module-1',
        'org-1',
        'Test Module',
        'Description',
      )

      module.publish()

      expect(() => {
        module.publish()
      }).toThrow(BusinessRuleViolation)
    })
  })

  describe('submitReview', () => {
    it('should submit a review', () => {
      const module = AIModule.create(
        'module-1',
        'org-1',
        'Test Module',
        'Description',
      )

      const review = {
        id: 'review-1',
        moduleId: 'module-1',
        reviewerId: 'user-1',
        rating: 5,
        comment: 'Great module',
        createdAt: new Date(),
      }

      module.submitReview(review)

      expect(module.reviews).toContain(review)
    })

    it('should throw error if reviewer already reviewed', () => {
      const module = AIModule.create(
        'module-1',
        'org-1',
        'Test Module',
        'Description',
      )

      const review1 = {
        id: 'review-1',
        moduleId: 'module-1',
        reviewerId: 'user-1',
        rating: 5,
        comment: 'First review',
        createdAt: new Date(),
      }

      const review2 = {
        id: 'review-2',
        moduleId: 'module-1',
        reviewerId: 'user-1',
        rating: 4,
        comment: 'Second review',
        createdAt: new Date(),
      }

      module.submitReview(review1)

      expect(() => {
        module.submitReview(review2)
      }).toThrow(BusinessRuleViolation)
    })
  })

  describe('updatePatchContent', () => {
    it('should update patch content', () => {
      const module = AIModule.create(
        'module-1',
        'org-1',
        'Test Module',
        'Description',
      )

      const patchContent = {
        entities: [{ name: 'Order', fields: [] }],
      }

      module.updatePatchContent(patchContent)

      expect(module.patchContent).toEqual(patchContent)
    })
  })
})
