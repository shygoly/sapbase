import { Inject, Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import * as crypto from 'crypto'
import { BusinessRuleViolation } from '../../domain/errors'
import { Invitation, InvitationStatus, OrganizationRole } from '../../domain/entities'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IInvitationRepository } from '../../domain/repositories'
import type { IOrganizationMemberRepository } from '../../domain/repositories'
import {
  ORGANIZATION_REPOSITORY,
  INVITATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { InvitationCreatedEvent } from '../../domain/events'

export interface InviteMemberCommand {
  organizationId: string
  email: string
  role: OrganizationRole
  invitedById: string
}

@Injectable()
export class InviteMemberService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepository: IInvitationRepository,
    @Inject(ORGANIZATION_MEMBER_REPOSITORY)
    private readonly memberRepository: IOrganizationMemberRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: InviteMemberCommand): Promise<Invitation> {
    const organization = await this.organizationRepository.findById(command.organizationId)
    if (!organization) {
      throw new BusinessRuleViolation('Organization not found')
    }

    // Check if user is already a member (would need IUserRepository port, but for now skip)
    // Application service can check via member repository

    // Check for existing pending invitation
    const existingInvitation = await this.invitationRepository.findByOrganizationAndEmail(
      command.organizationId,
      command.email,
      InvitationStatus.PENDING,
    )

    if (existingInvitation && existingInvitation.isPending()) {
      // Update expiration
      existingInvitation.expire()
      if (!existingInvitation.isExpired()) {
        const newExpiresAt = new Date()
        newExpiresAt.setDate(newExpiresAt.getDate() + 7)
        ;(existingInvitation as any).expiresAt = newExpiresAt
        await this.invitationRepository.save(existingInvitation)
        return existingInvitation
      }
    }

    const token = crypto.randomBytes(32).toString('hex')
    const invitationId = uuidv4()
    const invitation = Invitation.create(
      command.organizationId,
      command.email,
      command.role,
      command.invitedById,
      token,
      7, // 7 days
    )
    ;(invitation as any).id = invitationId

    await this.invitationRepository.save(invitation)

    await this.eventPublisher.publish(
      new InvitationCreatedEvent(
        invitation.id,
        command.organizationId,
        command.email,
        command.role,
        command.invitedById,
        invitation.expiresAt,
        invitation.invitedAt,
      ),
    )

    return invitation
  }
}
