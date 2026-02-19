import { Controller, Get, Post, Delete, Body, Param, BadRequestException } from '@nestjs/common'
import { InvitationsService } from './invitations.service'
import { OrganizationsService } from './organizations.service'
import { Invitation } from './invitation.entity'
import { OrganizationMember, OrganizationRole } from './organization-member.entity'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../users/user.entity'
import { InviteMemberService } from '../organization-context/application/services/invite-member.service'
import { AcceptInvitationService } from '../organization-context/application/services/accept-invitation.service'
import { CancelInvitationService } from '../organization-context/application/services/cancel-invitation.service'
import { GetInvitationsService } from '../organization-context/application/services/get-invitations.service'
import { BusinessRuleViolation } from '../organization-context/domain/errors'

@Controller('organizations/:organizationId/invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly organizationsService: OrganizationsService,
    private readonly inviteMemberService: InviteMemberService,
    private readonly acceptInvitationService: AcceptInvitationService,
    private readonly cancelInvitationService: CancelInvitationService,
    private readonly getInvitationsService: GetInvitationsService,
  ) {}

  @Post()
  @Auth()
  async createInvitation(
    @Param('organizationId') organizationId: string,
    @Body() body: { email: string; role: OrganizationRole },
    @CurrentUser() user: User,
  ): Promise<Invitation> {
    try {
      const invitation = await this.inviteMemberService.execute({
        organizationId,
        email: body.email,
        role: body.role,
        invitedById: user.id,
      })
      // Load relations for API response
      const invitations = await this.invitationsService.getInvitations(organizationId, user.id)
      const found = invitations.find((i: Invitation) => i.id === invitation.id)
      return found || this.mapDomainInvitationToResponse(invitation)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Get()
  @Auth()
  async getInvitations(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: User,
  ): Promise<Invitation[]> {
    try {
      // Use old service to get relations
      return await this.invitationsService.getInvitations(organizationId, user.id)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Post('accept/:token')
  @Auth()
  async acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: User,
  ): Promise<OrganizationMember> {
    try {
      const member = await this.acceptInvitationService.execute({
        token,
        userId: user.id,
        userEmail: user.email,
      })
      // Load relations for API response - need organizationId from invitation
      const invitation = await this.invitationsService.getInvitationByToken(token)
      const members = await this.organizationsService.getMembers(invitation.organizationId, user.id)
      const found = members.find((m) => m.userId === user.id)
      return found || this.mapDomainMemberToResponse(member)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Delete(':id')
  @Auth()
  async cancelInvitation(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    try {
      return await this.cancelInvitationService.execute({
        invitationId: id,
        organizationId,
        cancellerId: user.id,
      })
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  private mapDomainInvitationToResponse(invitation: any): Invitation {
    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      invitedById: invitation.invitedById,
      status: invitation.status,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      invitedAt: invitation.invitedAt,
      createdAt: (invitation as any).createdAt || new Date(),
      updatedAt: (invitation as any).updatedAt || new Date(),
    } as any as Invitation
  }

  private mapDomainMemberToResponse(member: any): OrganizationMember {
    return {
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      invitedById: member.invitedById,
      joinedAt: member.joinedAt,
      createdAt: (member as any).createdAt || new Date(),
      updatedAt: (member as any).updatedAt || new Date(),
    } as any as OrganizationMember
  }
}
