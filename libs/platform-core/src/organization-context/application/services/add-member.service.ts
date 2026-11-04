import { Inject, Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { BusinessRuleViolation } from '../../domain/errors'
import { OrganizationMember, OrganizationRole } from '../../domain/entities'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import {
  ORGANIZATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { MemberAddedEvent } from '../../domain/events'

export interface AddMemberCommand {
  organizationId: string
  userId: string
  role: OrganizationRole
  addedById: string
}

@Injectable()
export class AddMemberService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: AddMemberCommand): Promise<OrganizationMember> {
    const organization = await this.organizationRepository.findById(command.organizationId)
    if (!organization) {
      throw new BusinessRuleViolation('Organization not found')
    }

    organization.validateCanAddMember(command.userId)

    const memberId = uuidv4()
    const member = OrganizationMember.create(
      command.organizationId,
      command.userId,
      command.role,
      command.addedById,
    )
    ;(member as any).id = memberId

    organization.addMemberToCollection(member)
    await this.memberRepository.save(member)
    await this.organizationRepository.save(organization)

    await this.eventPublisher.publish(
      new MemberAddedEvent(
        command.organizationId,
        command.userId,
        command.role,
        command.addedById,
        new Date(),
      ),
    )

    return member
  }
}
