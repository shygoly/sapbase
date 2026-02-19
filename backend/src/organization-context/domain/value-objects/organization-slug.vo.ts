import { DomainError } from '../errors'

/**
 * Value object: Organization slug (immutable, validated).
 */
export class OrganizationSlug {
  private constructor(private readonly value: string) {}

  static create(name: string): OrganizationSlug {
    const slug = OrganizationSlug.generateFromName(name)
    return new OrganizationSlug(slug)
  }

  static fromString(slug: string): OrganizationSlug {
    if (!slug || slug.trim().length === 0) {
      throw new DomainError('Slug cannot be empty')
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new DomainError('Slug can only contain lowercase letters, numbers, and hyphens')
    }
    return new OrganizationSlug(slug)
  }

  static generateFromName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  toString(): string {
    return this.value
  }

  equals(other: OrganizationSlug): boolean {
    return this.value === other.value
  }
}
