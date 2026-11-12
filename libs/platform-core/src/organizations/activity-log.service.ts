import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  ActivityType,
  OrganizationActivity,
} from './organization-activity.entity'

export interface RecordActivityInput {
  organizationId: string
  userId?: string | null
  action: ActivityType
  description?: string | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
}

/** 组织/团队活动：只写声明式事件，不替代审计日志。 */
@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(OrganizationActivity)
    private readonly repository: Repository<OrganizationActivity>,
  ) {}

  async record(input: RecordActivityInput): Promise<OrganizationActivity> {
    const row = new OrganizationActivity()
    row.organizationId = input.organizationId
    row.userId = input.userId ?? null
    row.action = input.action
    row.description = input.description ?? null
    row.metadata = input.metadata ?? null
    row.ipAddress = input.ipAddress ?? null
    row.timestamp = new Date()
    return this.repository.save(row)
  }

  async list(organizationId: string, limit = 50): Promise<OrganizationActivity[]> {
    return this.repository.find({
      where: { organizationId },
      order: { timestamp: 'DESC' },
      take: Math.max(1, Math.min(200, limit)),
    })
  }
}
