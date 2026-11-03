import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThan, Repository } from 'typeorm'
import { ReleaseAutomationPolicy } from './entities/release-automation-policy.entity'
import { ReleaseAutomationRun } from './entities/release-automation-run.entity'

@Injectable()
export class ReleaseAutomationJobsService {
  private readonly logger = new Logger(ReleaseAutomationJobsService.name)

  constructor(
    @InjectRepository(ReleaseAutomationPolicy)
    private readonly policies: Repository<ReleaseAutomationPolicy>,
    @InjectRepository(ReleaseAutomationRun)
    private readonly runs: Repository<ReleaseAutomationRun>,
  ) {}

  @Cron('30 * * * *', { name: 'release.guardrail_check' })
  async guardrailCheck(): Promise<void> {
    const enabled = await this.policies.find({ where: { autonomy: 'A2', enabled: true } })
    this.logger.log(`A2 guardrail check scanned ${enabled.length} policies`)
    for (const policy of enabled) {
      // 指标源未接入时只记录检查；不自动回退（自动回退必须显式阈值 + 指标）
      await this.runs.save(
        this.runs.create({
          policyId: policy.id,
          action: 'review',
          status: 'success',
          actorId: null,
          actorAgent: null,
          details: { check: 'guardrail', guardrails: policy.guardrails },
        }),
      )
    }
  }

  @Cron('0 9 * * *', { name: 'release.review_due' })
  async reviewDue(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const stale = await this.policies.find({
      where: { autonomy: 'A2', enabled: true, lastReviewedAt: LessThan(cutoff) },
    })
    for (const policy of stale) {
      policy.enabled = false
      await this.policies.save(policy)
      await this.runs.save(
        this.runs.create({
          policyId: policy.id,
          action: 'disable',
          status: 'success',
          actorId: null,
          actorAgent: null,
          details: { reason: '24h review overdue; downgraded to A1' },
        }),
      )
    }
    if (stale.length > 0) this.logger.warn(`A2 disabled for ${stale.length} overdue policies`)
  }
}
