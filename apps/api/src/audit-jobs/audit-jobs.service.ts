import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DataSource } from 'typeorm'
import { AuditCheckpointService } from '@sap/platform-core/audit-logs/audit-checkpoint.service'
import { AuditRetentionService } from '@sap/platform-core/audit-logs/audit-retention.service'
import { AuditVerificationService } from '@sap/platform-core/audit-logs/audit-verification.service'
import { AuditChainService } from '@sap/platform-core/audit-logs/audit-chain.service'

/**
 * 审计定时任务：checkpoint / 全量验证 / 保留期清理。
 * 三类都按组织 fan-out；单组织失败不影响其他组织。
 */
@Injectable()
export class AuditJobsService {
  private readonly logger = new Logger(AuditJobsService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly checkpoints: AuditCheckpointService,
    private readonly verification: AuditVerificationService,
    private readonly retention: AuditRetentionService,
    private readonly chain: AuditChainService,
  ) {}

  @Cron('0 2 * * *', { name: 'audit.checkpoint_scan' })
  async checkpointAll(): Promise<{ organizations: number }> {
    return this.fanOut('audit.checkpoint', (org) => this.checkpoints.create(org, 'system:cron'))
  }

  @Cron('30 2 * * *', { name: 'audit.verify_scan' })
  async verifyAll(): Promise<{ organizations: number }> {
    return this.fanOut('audit.verify', (org) => this.verifyOrganization(org))
  }

  @Cron('0 3 * * *', { name: 'audit.retention_scan' })
  async retentionAll(): Promise<{ organizations: number }> {
    return this.fanOut('audit.retention', (org) =>
      this.retention.cleanup(org, new Date(), {
        actor: 'system:cron',
        reason: 'scheduled-retention',
      }),
    )
  }

  private async verifyOrganization(organizationId: string) {
    const result = await this.verification.verify(organizationId)
    await this.chain.record({
      organizationId,
      action: 'audit.verify',
      resource: 'audit_log',
      actor: 'system:cron',
      status: result.valid ? 'success' : 'failure',
      metadata: {
        checked: result.checked,
        brokenAt: result.brokenAt ?? null,
        reason: result.reason ?? null,
        checkpointSeq: result.checkpointSeq ?? null,
      },
      source: 'cron',
    })
    return result
  }

  private async fanOut(
    type: string,
    work: (organizationId: string) => Promise<unknown>,
  ): Promise<{ organizations: number }> {
    const organizations = (await this.dataSource.query(
      `SELECT id FROM public.organizations ORDER BY id`,
    )) as Array<{ id: string }>
    for (const organization of organizations) {
      try {
        await work(organization.id)
      } catch (error) {
        this.logger.error(
          `${type} org=${organization.id} failed: ${(error as Error).message}`,
        )
      }
    }
    return { organizations: organizations.length }
  }
}
