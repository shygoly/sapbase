import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationMemberRole } from '../identity/organization-member-role.entity'
import { ScopeMembership } from '@sap/platform-core/data-scope/entities/scope-membership.entity'
import type { AssigneeSelector, RecordAnchorContext } from './assignee-selector'

/**
 * 审批人解析：role / user / position / creator。
 *
 * position 先按组织 + positionKey 查 scope_memberships；anchor=record + dimension
 * 的节点过滤留给后续数据范围适配（当前不按记录节点收窄，避免错误放行）。
 */
@Injectable()
export class ReviewAssigneeService {
  constructor(
    @InjectRepository(OrganizationMemberRole)
    private readonly memberRoles: Repository<OrganizationMemberRole>,
    @InjectRepository(ScopeMembership)
    private readonly memberships: Repository<ScopeMembership>,
  ) {}

  async resolve(
    organizationId: string,
    selector: AssigneeSelector,
    record?: RecordAnchorContext,
  ): Promise<string[]> {
    switch (selector.kind) {
      case 'user':
        return [selector.userId]
      case 'creator':
        return record?.creatorId ? [record.creatorId] : []
      case 'role': {
        const rows = await this.memberRoles.find({
          where: { organizationId, roleName: selector.role, status: 'active' },
        })
        return [...new Set(rows.map((row) => row.userId))]
      }
      case 'position': {
        const rows = await this.memberships.find({
          where: {
            organizationId,
            positionKey: selector.positionKey,
            subjectType: 'user',
          },
        })
        return [...new Set(rows.map((row) => row.subjectId))]
      }
      default:
        return []
    }
  }
}
