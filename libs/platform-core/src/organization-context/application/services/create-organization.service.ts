import { Inject, Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { BusinessRuleViolation } from '../../domain/errors'
import { Organization, OrganizationMember, OrganizationRole } from '../../domain/entities'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import {
  ORGANIZATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { OrganizationCreatedEvent, MemberAddedEvent } from '../../domain/events'

export interface CreateOrganizationCommand {
  name: string
  creatorUserId: string
}

@Injectable()
export class CreateOrganizationService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CreateOrganizationCommand): Promise<Organization> {
    const organization = Organization.create(uuidv4(), command.name)

    // Check if slug already exists
    const existing = await this.organizationRepository.findBySlug(organization.slug)
    if (existing) {
      throw new BusinessRuleViolation(
        `Organization with slug "${organization.slug}" already exists`,
      )
    }

    await this.organizationRepository.save(organization)

    // Add creator as owner
    const memberId = uuidv4()
    const member = OrganizationMember.create(
      organization.id,
      command.creatorUserId,
      OrganizationRole.OWNER,
      command.creatorUserId,
    )
    ;(member as any).id = memberId
    organization.addMemberToCollection(member)
    await this.memberRepository.save(member)

    await this.eventPublisher.publish(
      new OrganizationCreatedEvent(
        organization.id,
        organization.name,
        organization.slug,
        command.creatorUserId,
        new Date(),
      ),
    )

    await this.eventPublisher.publish(
      new MemberAddedEvent(
        organization.id,
        command.creatorUserId,
        OrganizationRole.OWNER,
        command.creatorUserId,
        new Date(),
      ),
    )

    return organization
  }
}
