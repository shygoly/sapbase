import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import {
  ORGANIZATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { MemberRemovedEvent } from '../../domain/events'

export interface RemoveMemberCommand {
  organizationId: string
  userId: string
  removerId: string
}

@Injectable()
export class RemoveMemberService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: RemoveMemberCommand): Promise<void> {
    const organization = await this.organizationRepository.findById(command.organizationId)
    if (!organization) {
      throw new BusinessRuleViolation('Organization not found')
    }

    // Load members for domain logic
    const members = await this.memberRepository.findByOrganization(command.organizationId)
    members.forEach((m) => organization.addMemberToCollection(m))

    organization.removeMember(command.userId, command.removerId)

    await this.memberRepository.delete(command.organizationId, command.userId)
    await this.organizationRepository.save(organization)

    await this.eventPublisher.publish(
      new MemberRemovedEvent(
        command.organizationId,
        command.userId,
        command.removerId,
        new Date(),
      ),
    )
  }
}
