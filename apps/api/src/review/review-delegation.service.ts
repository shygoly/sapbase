import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, MoreThan, Repository } from 'typeorm'
import { ReviewDelegation } from './review-delegation.entity'

/**
 * 审批委托：代决定必须显式授权、有有效期、可撤销，并写审计。
 * 委托只转移“当前步骤的操作权”，不改变审批链的所有者与轮次。
 */
@Injectable()
export class ReviewDelegationService {
  constructor(
    @InjectRepository(ReviewDelegation)
    private readonly repository: Repository<ReviewDelegation>,
  ) {}

  async create(
    organizationId: string,
    approvalId: string,
    fromUserId: string,
    toUserId: string,
    input: { reason?: string; validFrom?: Date | null; validTo?: Date | null } = {},
  ): Promise<ReviewDelegation> {
    if (!approvalId || !fromUserId || !toUserId) {
      throw new BadRequestException('approvalId/fromUserId/toUserId 必填')
    }
    if (fromUserId === toUserId) {
      throw new BadRequestException('不能委托给自己')
    }
    if (input.validFrom && input.validTo && input.validFrom >= input.validTo) {
      throw new BadRequestException('validFrom 必须早于 validTo')
    }
    const existing = await this.repository.findOne({
      where: { organizationId, approvalId, toUserId, status: 'active' },
    })
    if (existing) {
      throw new BadRequestException('该审批已委托给此用户')
    }
    return this.repository.save(
      this.repository.create({
        organizationId,
        approvalId,
        fromUserId,
        toUserId,
        reason: input.reason ?? null,
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
        status: 'active',
      }),
    )
  }

  async revoke(organizationId: string, id: string): Promise<ReviewDelegation> {
    const row = await this.repository.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('委托不存在')
    row.status = 'revoked'
    return this.repository.save(row)
  }

  async findActive(
    organizationId: string,
    approvalId: string,
    toUserId: string,
    now: Date = new Date(),
  ): Promise<ReviewDelegation | null> {
    const row = await this.repository.findOne({
      where: { organizationId, approvalId, toUserId, status: 'active' },
    })
    if (!row) return null
    if (row.validFrom && row.validFrom.getTime() > now.getTime()) return null
    if (row.validTo && row.validTo.getTime() <= now.getTime()) return null
    return row
  }

  async list(organizationId: string, approvalId?: string): Promise<ReviewDelegation[]> {
    return this.repository.find({
      where: { organizationId, ...(approvalId ? { approvalId } : {}) },
      order: { createdAt: 'DESC' },
    })
  }
}
