import type { Organization } from '../entities'

/**
 * Port for organization persistence (implemented in infrastructure).
 */
export interface IOrganizationRepository {
  save(organization: Organization): Promise<void>
  findById(id: string): Promise<Organization | null>
  findBySlug(slug: string): Promise<Organization | null>
  findAll(userId: string): Promise<Organization[]>
}
