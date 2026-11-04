import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import type { OrganizationMember } from '../../domain/entities'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import {
  ORGANIZATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
} from '../../domain/repositories'

@Injectable()
export class GetMembersService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
  ) {}

  async getMembers(organizationId: string, userId: string): Promise<OrganizationMember[]> {
    // Verify user has access
    const organization = await this.organizationRepository.findById(organizationId)
    if (!organization) {
      throw new BusinessRuleViolation('Organization not found')
    }

    const membership = await this.memberRepository.findByOrganizationAndUser(
      organizationId,
      userId,
    )
    if (!membership) {
      throw new BusinessRuleViolation('Organization not found or access denied')
    }

    return this.memberRepository.findByOrganization(organizationId)
  }
}
