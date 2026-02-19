import { OrganizationSlug } from './organization-slug.vo'
import { BusinessRuleViolation } from '../errors'

describe('OrganizationSlug (Value Object)', () => {
  describe('create', () => {
    it('should create a valid slug', () => {
      const slug = OrganizationSlug.create('test-org')

      expect(slug.value).toBe('test-org')
    })

    it('should normalize slug to lowercase', () => {
      const slug = OrganizationSlug.create('TEST-ORG')

      expect(slug.value).toBe('test-org')
    })

    it('should replace spaces with hyphens', () => {
      const slug = OrganizationSlug.create('test org')

      expect(slug.value).toBe('test-org')
    })

    it('should throw error if slug is empty', () => {
      expect(() => {
        OrganizationSlug.create('')
      }).toThrow(BusinessRuleViolation)
    })

    it('should throw error if slug is too short', () => {
      expect(() => {
        OrganizationSlug.create('ab')
      }).toThrow(BusinessRuleViolation)
    })

    it('should throw error if slug contains invalid characters', () => {
      expect(() => {
        OrganizationSlug.create('test@org')
      }).toThrow(BusinessRuleViolation)
    })

    it('should throw error if slug starts with hyphen', () => {
      expect(() => {
        OrganizationSlug.create('-test-org')
      }).toThrow(BusinessRuleViolation)
    })

    it('should throw error if slug ends with hyphen', () => {
      expect(() => {
        OrganizationSlug.create('test-org-')
      }).toThrow(BusinessRuleViolation)
    })
  })

  describe('equals', () => {
    it('should return true for equal slugs', () => {
      const slug1 = OrganizationSlug.create('test-org')
      const slug2 = OrganizationSlug.create('test-org')

      expect(slug1.equals(slug2)).toBe(true)
    })

    it('should return false for different slugs', () => {
      const slug1 = OrganizationSlug.create('test-org')
      const slug2 = OrganizationSlug.create('other-org')

      expect(slug1.equals(slug2)).toBe(false)
    })

    it('should be case-insensitive', () => {
      const slug1 = OrganizationSlug.create('test-org')
      const slug2 = OrganizationSlug.create('TEST-ORG')

      expect(slug1.equals(slug2)).toBe(true)
    })
  })
})
