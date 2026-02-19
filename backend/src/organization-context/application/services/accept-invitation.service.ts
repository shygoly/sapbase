import { Inject, Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { BusinessRuleViolation } from '../../domain/errors'
import { OrganizationMember } from '../../domain/entities'
import type { IInvitationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import type { IOrganizationRepository } from '../../domain/repositories'
import {
  INVITATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
  ORGANIZATION_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { InvitationAcceptedEvent, MemberAddedEvent } from '../../domain/events'

export interface AcceptInvitationCommand {
  token: string
  userId: string
  userEmail: string
}

@Injectable()
export class AcceptInvitationService {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepository: IInvitationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: AcceptInvitationCommand): Promise<OrganizationMember> {
    const invitation = await this.invitationRepository.findByToken(command.token)
    if (!invitation) {
      throw new BusinessRuleViolation('Invitation not found')
    }

    // Check if already a member
    const existingMember = await this.memberRepository.findByOrganizationAndUser(
      invitation.organizationId,
      command.userId,
    )

    if (existingMember) {
      // Mark invitation as accepted even if already a member
      invitation.accept(command.userId, command.userEmail)
      await this.invitationRepository.save(invitation)
      return existingMember
    }

    // Accept invitation (validates email match, expiration, etc.)
    invitation.accept(command.userId, command.userEmail)
    await this.invitationRepository.save(invitation)

    // Create membership
    const organization = await this.organizationRepository.findById(invitation.organizationId)
    if (!organization) {
      throw new BusinessRuleViolation('Organization not found')
    }

    const memberId = uuidv4()
    const member = OrganizationMember.create(
      invitation.organizationId,
      command.userId,
      invitation.role,
      invitation.invitedById,
    )
    ;(member as any).id = memberId

    organization.addMemberToCollection(member)
    await this.memberRepository.save(member)
    await this.organizationRepository.save(organization)

    await this.eventPublisher.publish(
      new InvitationAcceptedEvent(
        invitation.id,
        invitation.organizationId,
        command.userId,
        invitation.email,
        invitation.role,
        new Date(),
      ),
    )

    await this.eventPublisher.publish(
      new MemberAddedEvent(
        invitation.organizationId,
        command.userId,
        invitation.role,
        invitation.invitedById,
        new Date(),
      ),
    )

    return member
  }
}
