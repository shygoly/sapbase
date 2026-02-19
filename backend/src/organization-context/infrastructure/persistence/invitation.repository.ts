import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Invitation as InvitationOrm, InvitationStatus as InvitationStatusOrm } from '../../../organizations/invitation.entity'
import { OrganizationRole as OrganizationRoleOrm } from '../../../organizations/organization-member.entity'
import { Invitation, InvitationStatus, OrganizationRole } from '../../domain/entities'
import type { IInvitationRepository } from '../../domain/repositories'

@Injectable()
export class InvitationRepository implements IInvitationRepository {
  constructor(
    @InjectRepository(InvitationOrm)
    private readonly repo: Repository<InvitationOrm>,
  ) {}

  async findById(id: string): Promise<Invitation | null> {
    const row = await this.repo.findOne({ where: { id } })
    if (!row) return null
    return this.toDomain(row)
  }

  async findByToken(token: string): Promise<Invitation | null> {
    const row = await this.repo.findOne({
      where: { token },
      relations: ['organization', 'invitedBy'],
    })
    if (!row) return null
    return this.toDomain(row)
  }

  async findByOrganizationAndEmail(
    organizationId: string,
    email: string,
    status?: InvitationStatus,
  ): Promise<Invitation | null> {
    const where: any = { organizationId, email }
    if (status) {
      where.status = this.mapStatus(status)
    }
    const row = await this.repo.findOne({ where })
    if (!row) return null
    return this.toDomain(row)
  }

  async findByOrganization(organizationId: string): Promise<Invitation[]> {
    const rows = await this.repo.find({
      where: { organizationId },
      relations: ['invitedBy'],
      order: { createdAt: 'DESC' },
    })
    return rows.map((row) => this.toDomain(row))
  }

  async save(invitation: Invitation): Promise<void> {
    const existing = await this.repo.findOne({
      where: { id: invitation.id },
    })

    if (existing) {
      existing.status = this.mapStatus(invitation.status)
      ;(existing as any).expiresAt = invitation.expiresAt ?? undefined
      await this.repo.save(existing)
    } else {
      const toSave: any = {
        organizationId: invitation.organizationId,
        email: invitation.email,
        role: this.mapRole(invitation.role),
        invitedById: invitation.invitedById,
        status: this.mapStatus(invitation.status),
        token: invitation.token,
        invitedAt: invitation.invitedAt,
        expiresAt: invitation.expiresAt ?? undefined,
      }
      if (invitation.id) toSave.id = invitation.id
      await this.repo.save(toSave)
    }
  }

  private toDomain(row: InvitationOrm): Invitation {
    return Invitation.fromPersistence(
      row.id,
      row.organizationId,
      row.email,
      this.mapRoleFromOrm(row.role),
      row.invitedById,
      this.mapStatusFromOrm(row.status),
      row.token,
      row.expiresAt ?? null,
      row.invitedAt,
    )
  }

  private mapStatus(status: InvitationStatus): InvitationStatusOrm {
    const map: Record<InvitationStatus, InvitationStatusOrm> = {
      [InvitationStatus.PENDING]: InvitationStatusOrm.PENDING,
      [InvitationStatus.ACCEPTED]: InvitationStatusOrm.ACCEPTED,
      [InvitationStatus.EXPIRED]: InvitationStatusOrm.EXPIRED,
      [InvitationStatus.CANCELLED]: InvitationStatusOrm.CANCELLED,
    }
    return map[status]
  }

  private mapStatusFromOrm(status: InvitationStatusOrm): InvitationStatus {
    const map: Record<InvitationStatusOrm, InvitationStatus> = {
      [InvitationStatusOrm.PENDING]: InvitationStatus.PENDING,
      [InvitationStatusOrm.ACCEPTED]: InvitationStatus.ACCEPTED,
      [InvitationStatusOrm.EXPIRED]: InvitationStatus.EXPIRED,
      [InvitationStatusOrm.CANCELLED]: InvitationStatus.CANCELLED,
    }
    return map[status]
  }

  private mapRole(role: OrganizationRole): OrganizationRoleOrm {
    return role === OrganizationRole.OWNER ? OrganizationRoleOrm.OWNER : OrganizationRoleOrm.MEMBER
  }

  private mapRoleFromOrm(role: OrganizationRoleOrm): OrganizationRole {
    return role === OrganizationRoleOrm.OWNER ? OrganizationRole.OWNER : OrganizationRole.MEMBER
  }
}
