import { SlugGenerator } from './slug-generator.service'
import { OrganizationSlug } from '../value-objects/organization-slug.vo'

describe('SlugGenerator (Domain Service)', () => {
  describe('generate', () => {
    it('should generate slug from name', () => {
      const slug = SlugGenerator.generate('Test Organization')

      expect(slug).toBeInstanceOf(OrganizationSlug)
      expect(slug.value).toBe('test-organization')
    })

    it('should handle special characters', () => {
      const slug = SlugGenerator.generate('Test & Organization')

      expect(slug.value).toBe('test-organization')
    })

    it('should handle multiple spaces', () => {
      const slug = SlugGenerator.generate('Test   Organization')

      expect(slug.value).toBe('test-organization')
    })

    it('should handle uppercase', () => {
      const slug = SlugGenerator.generate('TEST ORGANIZATION')

      expect(slug.value).toBe('test-organization')
    })
  })
})
