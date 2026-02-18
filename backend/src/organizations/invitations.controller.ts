import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common'
import { InvitationsService } from './invitations.service'
import { Invitation } from './invitation.entity'
import { OrganizationMember, OrganizationRole } from './organization-member.entity'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../users/user.entity'

@Controller('organizations/:organizationId/invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @Auth()
  async createInvitation(
    @Param('organizationId') organizationId: string,
    @Body() body: { email: string; role: OrganizationRole },
    @CurrentUser() user: User,
  ): Promise<Invitation> {
    return this.invitationsService.createInvitation(organizationId, body.email, body.role, user.id)
  }

  @Get()
  @Auth()
  async getInvitations(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: User,
  ): Promise<Invitation[]> {
    return this.invitationsService.getInvitations(organizationId, user.id)
  }

  @Post('accept/:token')
  @Auth()
  async acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: User,
  ): Promise<OrganizationMember> {
    return this.invitationsService.acceptInvitation(token, user.id)
  }

  @Delete(':id')
  @Auth()
  async cancelInvitation(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.invitationsService.cancelInvitation(id, organizationId, user.id)
  }
}
