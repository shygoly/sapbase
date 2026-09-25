import { AIModule, AIModuleStatus } from './ai-module.entity'
import { BusinessRuleViolation, DomainError } from '../errors'

describe('AIModule (Domain Entity)', () => {
  describe('create', () => {
    it('should create an AI module with valid data', () => {
      const module = AIModule.create(
        'module-1',
        'org-1',
        'Test Module',
        null,
      )

      expect(module.id).toBe('module-1')
      expect(module.organizationId).toBe('org-1')
      expect(module.name).toBe('Test Module')
      // 描述不是构造参数（create 的第四个参数是 createdById），创建后为 null
      expect(module.description).toBeNull()
      expect(module.status).toBe(AIModuleStatus.DRAFT)
    })

    it('should throw error if name is empty', () => {
      expect(() => {
        AIModule.create('module-1', 'org-1', '', null)
      }).toThrow(DomainError)
    })
  })

  describe('publish', () => {
    // 发布的前置是「已批准」：draft 不能直接发布（旧断言假设能，与实现相反）
    const approved = () => {
      const module = AIModule.create('module-1', 'org-1', 'Test Module', null)
      module.submitForReview()
      module.submitReview('approved', 'user-1')
      return module
    }

    it('should publish an approved module', () => {
      const module = approved()

      module.publish()

      expect(module.status).toBe(AIModuleStatus.PUBLISHED)
      expect(module.publishedAt).toBeInstanceOf(Date)
    })

    it('should refuse publishing a draft module', () => {
      const module = AIModule.create('module-1', 'org-1', 'Test Module', null)

      expect(() => module.publish()).toThrow(BusinessRuleViolation)
    })

    it('should refuse publishing twice', () => {
      const module = approved()
      module.publish()

      expect(() => module.publish()).toThrow(BusinessRuleViolation)
    })
  })
})
