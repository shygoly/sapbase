import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import type { Invitation } from '../../domain/entities'
import type { IInvitationRepository } from '../../domain/repositories'
import { INVITATION_REPOSITORY } from '../../domain/repositories'

@Injectable()
export class GetInvitationByTokenService {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepository: IInvitationRepository,
  ) {}

  async getByToken(token: string): Promise<Invitation> {
    const invitation = await this.invitationRepository.findByToken(token)
    if (!invitation) {
      throw new BusinessRuleViolation('Invitation not found')
    }

    if (invitation.status !== 'pending') {
      throw new BusinessRuleViolation('Invitation has already been used or cancelled')
    }

    if (invitation.isExpired()) {
      invitation.expire()
      await this.invitationRepository.save(invitation)
      throw new BusinessRuleViolation('Invitation has expired')
    }

    return invitation
  }
}
