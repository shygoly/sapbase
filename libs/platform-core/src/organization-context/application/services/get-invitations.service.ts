import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import type { Invitation } from '../../domain/entities'
import type { IInvitationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import {
  INVITATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
} from '../../domain/repositories'

@Injectable()
export class GetInvitationsService {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepository: IInvitationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
  ) {}

  async getInvitations(organizationId: string, userId: string): Promise<Invitation[]> {
    // Verify user has access
    const membership = await this.memberRepository.findByOrganizationAndUser(
      organizationId,
      userId,
    )
    if (!membership) {
      throw new BusinessRuleViolation('Organization not found or access denied')
    }

    return this.invitationRepository.findByOrganization(organizationId)
  }
}
