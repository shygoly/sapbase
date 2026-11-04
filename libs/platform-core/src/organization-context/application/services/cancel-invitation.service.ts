import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import type { IInvitationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import {
  INVITATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { InvitationCancelledEvent } from '../../domain/events'
import { OrganizationRole } from '../../domain/entities'

export interface CancelInvitationCommand {
  invitationId: string
  organizationId: string
  cancellerId: string
}

@Injectable()
export class CancelInvitationService {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepository: IInvitationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CancelInvitationCommand): Promise<void> {
    const invitation = await this.invitationRepository.findById(command.invitationId)
    if (!invitation || invitation.organizationId !== command.organizationId) {
      throw new BusinessRuleViolation('Invitation not found')
    }

    // Check if canceller is owner or the inviter
    const membership = await this.memberRepository.findByOrganizationAndUser(
      command.organizationId,
      command.cancellerId,
    )
    const isOwner = membership?.role === OrganizationRole.OWNER

    invitation.cancel(command.cancellerId, isOwner)
    await this.invitationRepository.save(invitation)

    await this.eventPublisher.publish(
      new InvitationCancelledEvent(
        invitation.id,
        invitation.organizationId,
        invitation.email,
        command.cancellerId,
        new Date(),
      ),
    )
  }
}
