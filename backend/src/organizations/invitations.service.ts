import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Invitation, InvitationStatus } from './invitation.entity'
import { OrganizationMember, OrganizationRole } from './organization-member.entity'
import { Organization } from './organization.entity'
import { User } from '../users/user.entity'
import * as crypto from 'crypto'

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private invitationRepository: Repository<Invitation>,
    @InjectRepository(OrganizationMember)
    private memberRepository: Repository<OrganizationMember>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createInvitation(
    organizationId: string,
    email: string,
    role: OrganizationRole,
    invitedById: string,
  ): Promise<Invitation> {
    // Check if user is already a member
    const user = await this.userRepository.findOne({ where: { email } })
    if (user) {
      const existingMember = await this.memberRepository.findOne({
        where: { organizationId, userId: user.id },
      })
      if (existingMember) {
        throw new BadRequestException('User is already a member of this organization')
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await this.invitationRepository.findOne({
      where: { organizationId, email, status: InvitationStatus.PENDING },
    })

    if (existingInvitation) {
      // Update expiration
      existingInvitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      return this.invitationRepository.save(existingInvitation)
    }

    const token = crypto.randomBytes(32).toString('hex')
    const invitation = this.invitationRepository.create({
      organizationId,
      email,
      role,
      invitedById,
      token,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    })

    return this.invitationRepository.save(invitation)
  }

  async getInvitationByToken(token: string): Promise<Invitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { token },
      relations: ['organization', 'invitedBy'],
    })

    if (!invitation) {
      throw new NotFoundException('Invitation not found')
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation has already been used or cancelled')
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = InvitationStatus.EXPIRED
      await this.invitationRepository.save(invitation)
      throw new BadRequestException('Invitation has expired')
    }

    return invitation
  }

  async acceptInvitation(token: string, userId: string): Promise<OrganizationMember> {
    const invitation = await this.getInvitationByToken(token)

    // Verify email matches user
    const user = await this.userRepository.findOne({ where: { id: userId } })
    if (!user || user.email !== invitation.email) {
      throw new BadRequestException('Invitation email does not match user email')
    }

    // Check if already a member
    const existingMember = await this.memberRepository.findOne({
      where: { organizationId: invitation.organizationId, userId },
    })

    if (existingMember) {
      // Mark invitation as accepted even if already a member
      invitation.status = InvitationStatus.ACCEPTED
      await this.invitationRepository.save(invitation)
      return existingMember
    }

    // Create membership
    const member = this.memberRepository.create({
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
      invitedById: invitation.invitedById,
    })

    const savedMember = await this.memberRepository.save(member)

    // Mark invitation as accepted
    invitation.status = InvitationStatus.ACCEPTED
    await this.invitationRepository.save(invitation)

    return savedMember
  }

  async cancelInvitation(invitationId: string, organizationId: string, userId: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, organizationId },
    })

    if (!invitation) {
      throw new NotFoundException('Invitation not found')
    }

    // Verify user has permission (owner or the inviter)
    const membership = await this.memberRepository.findOne({
      where: { organizationId, userId },
    })

    if (!membership || (membership.role !== OrganizationRole.OWNER && invitation.invitedById !== userId)) {
      throw new BadRequestException('You do not have permission to cancel this invitation')
    }

    invitation.status = InvitationStatus.CANCELLED
    await this.invitationRepository.save(invitation)
  }

  async getInvitations(organizationId: string, userId: string): Promise<Invitation[]> {
    // Verify user has access
    const membership = await this.memberRepository.findOne({
      where: { organizationId, userId },
    })

    if (!membership) {
      throw new NotFoundException('Organization not found or access denied')
    }

    return this.invitationRepository.find({
      where: { organizationId },
      relations: ['invitedBy'],
      order: { createdAt: 'DESC' },
    })
  }
}
