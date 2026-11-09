import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationMemberRole, type RoleBindingSource } from './organization-member-role.entity'

export interface GrantRoleInput {
  roleName: string
  roleId?: string | null
  source?: RoleBindingSource
  validFrom?: Date | null
  validTo?: Date | null
  createdBy?: string | null
}

/**
 * 组织内多角色绑定服务。
 *
 * 有效角色只看 active + 当前时间窗；`users.roleId` 仍是兼容回退，
 * 但新授权/回收都走本表，避免把多角色塞回单列。
 */
@Injectable()
export class OrganizationMemberRolesService {
  constructor(
    @InjectRepository(OrganizationMemberRole)
    private readonly repository: Repository<OrganizationMemberRole>,
  ) {}

  async grant(
    organizationId: string,
    userId: string,
    input: GrantRoleInput,
  ): Promise<OrganizationMemberRole> {
    const existing = await this.repository.findOne({
      where: { organizationId, userId, roleName: input.roleName },
    })
    if (existing) {
      existing.roleId = input.roleId ?? existing.roleId
      existing.source = input.source ?? existing.source
      existing.status = 'active'
      existing.validFrom = input.validFrom ?? existing.validFrom
      existing.validTo = input.validTo ?? existing.validTo
      existing.createdBy = input.createdBy ?? existing.createdBy
      return this.repository.save(existing)
    }
    const row = this.repository.create({
      organizationId,
      userId,
      roleId: input.roleId ?? null,
      roleName: input.roleName,
      source: input.source ?? 'manual',
      status: 'active',
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      createdBy: input.createdBy ?? null,
    })
    return this.repository.save(row)
  }

  async revoke(
    organizationId: string,
    userId: string,
    roleName: string,
  ): Promise<boolean> {
    const result = await this.repository.update(
      { organizationId, userId, roleName, status: 'active' },
      { status: 'inactive' },
    )
    return (result.affected ?? 0) > 0
  }

  async list(organizationId: string, userId?: string): Promise<OrganizationMemberRole[]> {
    return this.repository.find({
      where: userId ? { organizationId, userId } : { organizationId },
      order: { createdAt: 'ASC' },
    })
  }

  async activeRoleNames(
    organizationId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<string[]> {
    const rows = await this.repository.find({
      where: { organizationId, userId, status: 'active' },
      order: { createdAt: 'ASC' },
    })
    return [
      ...new Set(
        rows
          .filter((row) => isActive(row, now))
          .map((row) => row.roleName)
          .filter(Boolean),
      ),
    ]
  }
}

function isActive(row: OrganizationMemberRole, now: Date): boolean {
  if (row.status !== 'active') return false
  if (row.validFrom) {
    const from = new Date(row.validFrom).getTime()
    if (Number.isFinite(from) && from > now.getTime()) return false
  }
  if (row.validTo) {
    const to = new Date(row.validTo).getTime()
    if (Number.isFinite(to) && to < now.getTime()) return false
  }
  return true
}
