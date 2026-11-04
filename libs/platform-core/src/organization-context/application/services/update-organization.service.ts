import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import { Organization } from '../../domain/entities'
import { SlugGenerator } from '../../domain/domain-services'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import {
  ORGANIZATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
} from '../../domain/repositories'

export interface UpdateOrganizationCommand {
  organizationId: string
  name?: string
  userId: string
}

@Injectable()
export class UpdateOrganizationService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
  ) {}

  async execute(command: UpdateOrganizationCommand): Promise<Organization> {
    const organization = await this.organizationRepository.findById(command.organizationId)
    if (!organization) {
      throw new BusinessRuleViolation('Organization not found')
    }

    // Load members for domain logic
    const members = await this.memberRepository.findByOrganization(command.organizationId)
    members.forEach((m) => organization.addMemberToCollection(m))

    if (!organization.canBeUpdatedBy(command.userId)) {
      throw new BusinessRuleViolation('Only organization owners can update organization settings')
    }

    if (command.name && command.name !== organization.name) {
      organization.updateName(command.name)
      // Check if new slug is available
      const newSlug = SlugGenerator.generate(command.name)
      const existing = await this.organizationRepository.findBySlug(newSlug.toString())
      if (existing && existing.id !== organization.id) {
        throw new BusinessRuleViolation(
          `Organization with slug "${newSlug.toString()}" already exists`,
        )
      }
      // Update slug (would need a method on Organization, but for now handled in repository)
    }

    await this.organizationRepository.save(organization)
    return organization
  }
}
