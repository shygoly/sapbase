import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import type { Organization } from '../../domain/entities'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import {
  ORGANIZATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
} from '../../domain/repositories'

@Injectable()
export class GetOrganizationService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
  ) {}

  async get(organizationId: string, userId: string): Promise<Organization> {
    // Verify user has access
    const membership = await this.memberRepository.findByOrganizationAndUser(
      organizationId,
      userId,
    )

    if (!membership) {
      throw new BusinessRuleViolation('Organization not found or access denied')
    }

    const organization = await this.organizationRepository.findById(organizationId)
    if (!organization) {
      throw new BusinessRuleViolation('Organization not found')
    }

    // Load members
    const members = await this.memberRepository.findByOrganization(organizationId)
    members.forEach((m) => organization.addMemberToCollection(m))

    return organization
  }
}
