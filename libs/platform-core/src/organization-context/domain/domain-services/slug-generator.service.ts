import { OrganizationSlug } from '../value-objects'

/**
 * Domain service: Generate organization slug from name (pure function).
 */
export class SlugGenerator {
  static generate(name: string): OrganizationSlug {
    return OrganizationSlug.create(name)
  }
}
