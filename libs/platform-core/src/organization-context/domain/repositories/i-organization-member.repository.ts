import type { OrganizationMember, OrganizationRole } from '../entities'

/**
 * Port for organization member persistence (implemented in infrastructure).
 */
export interface IOrganizationMemberRepository {
  save(member: OrganizationMember): Promise<void>
  findById(id: string): Promise<OrganizationMember | null>
  findByOrganizationAndUser(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember | null>
  findByOrganization(organizationId: string): Promise<OrganizationMember[]>
  countByOrganizationAndRole(
    organizationId: string,
    role: OrganizationRole,
  ): Promise<number>
  delete(organizationId: string, userId: string): Promise<void>
}
