/**
 * Port for organization lookup (implemented in infrastructure).
 * Organization entity stays in organizations/ module, this is just a lookup port.
 */
export interface Organization {
  id: string
  name: string
  slug: string
}

/**
 * Port for organization lookup (implemented in infrastructure).
 */
export interface IOrganizationRepository {
  findById(id: string, userId: string): Promise<Organization | null>
  findAll(userId: string): Promise<Organization[]>
}
