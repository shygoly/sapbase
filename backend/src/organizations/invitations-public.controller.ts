import { Controller, Get, Param, BadRequestException } from '@nestjs/common'
import { InvitationsService } from './invitations.service'
import { Invitation } from './invitation.entity'
import { GetInvitationByTokenService } from '../organization-context/application/services/get-invitation-by-token.service'
import { BusinessRuleViolation } from '../organization-context/domain/errors'

@Controller('invitations')
export class InvitationsPublicController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly getInvitationByTokenService: GetInvitationByTokenService,
  ) {}

  @Get('token/:token')
  async getInvitationByToken(@Param('token') token: string): Promise<Invitation> {
    try {
      const invitation = await this.getInvitationByTokenService.getByToken(token)
      // Use old service to get relations
      return await this.invitationsService.getInvitationByToken(token)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }
}
