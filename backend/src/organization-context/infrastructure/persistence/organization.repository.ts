import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Organization as OrganizationOrm, SubscriptionStatus as SubscriptionStatusOrm } from '../../../organizations/organization.entity'
import { OrganizationMember as OrganizationMemberOrm } from '../../../organizations/organization-member.entity'
import { Organization, SubscriptionStatus } from '../../domain/entities'
import type { IOrganizationRepository } from '../../domain/repositories'

@Injectable()
export class OrganizationRepository implements IOrganizationRepository {
  constructor(
    @InjectRepository(OrganizationOrm)
    private readonly repo: Repository<OrganizationOrm>,
    @InjectRepository(OrganizationMemberOrm)
    private readonly memberRepo: Repository<OrganizationMemberOrm>,
  ) {}

  async findById(id: string): Promise<Organization | null> {
    const row = await this.repo.findOne({ where: { id } })
    if (!row) return null

    // Load members
    const members = await this.memberRepo.find({ where: { organizationId: id } })
    return this.toDomain(row, members)
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const row = await this.repo.findOne({ where: { slug } })
    if (!row) return null

    // Load members
    const members = await this.memberRepo.find({ where: { organizationId: row.id } })
    return this.toDomain(row, members)
  }

  async findAll(userId: string): Promise<Organization[]> {
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ['organization'],
    })
    const orgIds = memberships.map((m) => m.organizationId)
    if (orgIds.length === 0) return []

    const rows = await this.repo.find({ where: { id: orgIds as any } })
    const result: Organization[] = []
    for (const row of rows) {
      const members = await this.memberRepo.find({ where: { organizationId: row.id } })
      result.push(this.toDomain(row, members))
    }
    return result
  }

  async save(organization: Organization): Promise<void> {
    const existing = await this.repo.findOne({ where: { id: organization.id } })
    const status = this.mapSubscriptionStatus(organization.subscriptionStatus)

    if (existing) {
      existing.name = organization.name
      existing.slug = organization.slug
      existing.subscriptionStatus = status
      ;(existing as any).stripeCustomerId = organization.stripeCustomerId ?? undefined
      ;(existing as any).stripeSubscriptionId = organization.stripeSubscriptionId ?? undefined
      ;(existing as any).stripeProductId = organization.stripeProductId ?? undefined
      ;(existing as any).planName = organization.planName ?? undefined
      await this.repo.save(existing)
    } else {
      const toSave: any = {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subscriptionStatus: status,
        stripeCustomerId: organization.stripeCustomerId ?? undefined,
        stripeSubscriptionId: organization.stripeSubscriptionId ?? undefined,
        stripeProductId: organization.stripeProductId ?? undefined,
        planName: organization.planName ?? undefined,
      }
      await this.repo.save(toSave)
    }
  }

  private toDomain(row: OrganizationOrm, members: OrganizationMemberOrm[]): Organization {
    return Organization.fromPersistence(
      row.id,
      row.name,
      row.slug,
      members.map((m) => this.memberToDomain(m)),
      this.mapSubscriptionStatusFromOrm(row.subscriptionStatus),
      row.stripeCustomerId ?? null,
      row.stripeSubscriptionId ?? null,
      row.stripeProductId ?? null,
      row.planName ?? null,
    )
  }

  private memberToDomain(member: OrganizationMemberOrm): any {
    return {
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      invitedById: member.invitedById ?? null,
      joinedAt: member.joinedAt,
    }
  }

  private mapSubscriptionStatus(status: SubscriptionStatus): SubscriptionStatusOrm {
    const map: Record<SubscriptionStatus, SubscriptionStatusOrm> = {
      [SubscriptionStatus.ACTIVE]: SubscriptionStatusOrm.ACTIVE,
      [SubscriptionStatus.CANCELLED]: SubscriptionStatusOrm.CANCELLED,
      [SubscriptionStatus.PAST_DUE]: SubscriptionStatusOrm.PAST_DUE,
      [SubscriptionStatus.UNPAID]: SubscriptionStatusOrm.UNPAID,
      [SubscriptionStatus.TRIALING]: SubscriptionStatusOrm.TRIALING,
      [SubscriptionStatus.INCOMPLETE]: SubscriptionStatusOrm.INCOMPLETE,
      [SubscriptionStatus.INCOMPLETE_EXPIRED]: SubscriptionStatusOrm.INCOMPLETE_EXPIRED,
    }
    return map[status]
  }

  private mapSubscriptionStatusFromOrm(status: SubscriptionStatusOrm): SubscriptionStatus {
    const map: Record<SubscriptionStatusOrm, SubscriptionStatus> = {
      [SubscriptionStatusOrm.ACTIVE]: SubscriptionStatus.ACTIVE,
      [SubscriptionStatusOrm.CANCELLED]: SubscriptionStatus.CANCELLED,
      [SubscriptionStatusOrm.PAST_DUE]: SubscriptionStatus.PAST_DUE,
      [SubscriptionStatusOrm.UNPAID]: SubscriptionStatus.UNPAID,
      [SubscriptionStatusOrm.TRIALING]: SubscriptionStatus.TRIALING,
      [SubscriptionStatusOrm.INCOMPLETE]: SubscriptionStatus.INCOMPLETE,
      [SubscriptionStatusOrm.INCOMPLETE_EXPIRED]: SubscriptionStatus.INCOMPLETE_EXPIRED,
    }
    return map[status]
  }
}
