/**
 * Domain service: Select organization from user's list (pure function).
 */
export class OrganizationSelector {
  static select(
    organizations: Array<{ id: string }>,
    requestedOrganizationId?: string,
  ): string | undefined {
    if (requestedOrganizationId) {
      const org = organizations.find((o) => o.id === requestedOrganizationId)
      return org ? org.id : undefined
    }

    // Auto-select if only one organization
    if (organizations.length === 1) {
      return organizations[0].id
    }

    return undefined
  }
}
