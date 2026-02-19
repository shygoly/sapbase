import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationMember as OrganizationMemberOrm, OrganizationRole as OrganizationRoleOrm } from '../../../organizations/organization-member.entity'
import { OrganizationMember, OrganizationRole } from '../../domain/entities'
import type { IOrganizationMemberRepository } from '../../domain/repositories'

@Injectable()
export class OrganizationMemberRepository implements IOrganizationMemberRepository {
  constructor(
    @InjectRepository(OrganizationMemberOrm)
    private readonly repo: Repository<OrganizationMemberOrm>,
  ) {}

  async findById(id: string): Promise<OrganizationMember | null> {
    const row = await this.repo.findOne({ where: { id } })
    if (!row) return null
    return this.toDomain(row)
  }

  async findByOrganizationAndUser(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember | null> {
    const row = await this.repo.findOne({
      where: { organizationId, userId },
    })
    if (!row) return null
    return this.toDomain(row)
  }

  async findByOrganization(organizationId: string): Promise<OrganizationMember[]> {
    const rows = await this.repo.find({
      where: { organizationId },
    })
    return rows.map((row) => this.toDomain(row))
  }

  async countByOrganizationAndRole(
    organizationId: string,
    role: OrganizationRole,
  ): Promise<number> {
    return this.repo.count({
      where: { organizationId, role: this.mapRole(role) },
    })
  }

  async save(member: OrganizationMember): Promise<void> {
    const existing = await this.repo.findOne({
      where: { organizationId: member.organizationId, userId: member.userId },
    })

    if (existing) {
      existing.role = this.mapRole(member.role)
      ;(existing as any).invitedById = member.invitedById ?? undefined
      await this.repo.save(existing)
    } else {
      const toSave: any = {
        organizationId: member.organizationId,
        userId: member.userId,
        role: this.mapRole(member.role),
        joinedAt: member.joinedAt,
        invitedById: member.invitedById ?? undefined,
      }
      if (member.id) toSave.id = member.id
      await this.repo.save(toSave)
    }
  }

  async delete(organizationId: string, userId: string): Promise<void> {
    await this.repo.delete({ organizationId, userId })
  }

  private toDomain(row: OrganizationMemberOrm): OrganizationMember {
    return OrganizationMember.fromPersistence(
      row.id,
      row.organizationId,
      row.userId,
      this.mapRoleFromOrm(row.role),
      row.invitedById ?? null,
      row.joinedAt,
    )
  }

  private mapRole(role: OrganizationRole): OrganizationRoleOrm {
    return role === OrganizationRole.OWNER ? OrganizationRoleOrm.OWNER : OrganizationRoleOrm.MEMBER
  }

  private mapRoleFromOrm(role: OrganizationRoleOrm): OrganizationRole {
    return role === OrganizationRoleOrm.OWNER ? OrganizationRole.OWNER : OrganizationRole.MEMBER
  }
}
