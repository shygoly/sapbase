import { Controller, Get, Param } from '@nestjs/common'
import { InvitationsService } from './invitations.service'
import { Invitation } from './invitation.entity'

@Controller('invitations')
export class InvitationsPublicController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get('token/:token')
  async getInvitationByToken(@Param('token') token: string): Promise<Invitation> {
    return this.invitationsService.getInvitationByToken(token)
  }
}
