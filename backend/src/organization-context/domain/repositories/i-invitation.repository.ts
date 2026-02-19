import type { Invitation, InvitationStatus } from '../entities'

/**
 * Port for invitation persistence (implemented in infrastructure).
 */
export interface IInvitationRepository {
  save(invitation: Invitation): Promise<void>
  findById(id: string): Promise<Invitation | null>
  findByToken(token: string): Promise<Invitation | null>
  findByOrganizationAndEmail(
    organizationId: string,
    email: string,
    status?: InvitationStatus,
  ): Promise<Invitation | null>
  findByOrganization(organizationId: string): Promise<Invitation[]>
}
