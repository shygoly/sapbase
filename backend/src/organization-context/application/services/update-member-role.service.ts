import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import { OrganizationRole } from '../../domain/entities'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import {
  ORGANIZATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { MemberRoleUpdatedEvent } from '../../domain/events'

export interface UpdateMemberRoleCommand {
  organizationId: string
  userId: string
  newRole: OrganizationRole
  updaterId: string
}

@Injectable()
export class UpdateMemberRoleService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: UpdateMemberRoleCommand): Promise<void> {
    const organization = await this.organizationRepository.findById(command.organizationId)
    if (!organization) {
      throw new BusinessRuleViolation('Organization not found')
    }

    const member = await this.memberRepository.findByOrganizationAndUser(
      command.organizationId,
      command.userId,
    )
    if (!member) {
      throw new BusinessRuleViolation('Member not found')
    }

    // Load members for domain logic
    const members = await this.memberRepository.findByOrganization(command.organizationId)
    members.forEach((m) => organization.addMemberToCollection(m))

    const oldRole = member.role
    organization.updateMemberRole(command.userId, command.newRole, command.updaterId)

    await this.memberRepository.save(member)
    await this.organizationRepository.save(organization)

    await this.eventPublisher.publish(
      new MemberRoleUpdatedEvent(
        command.organizationId,
        command.userId,
        oldRole,
        command.newRole,
        command.updaterId,
        new Date(),
      ),
    )
  }
}
