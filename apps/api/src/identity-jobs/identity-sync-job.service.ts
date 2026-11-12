import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DataSource } from 'typeorm'
import { IdentitySyncService } from '@sap/platform-core/identity/identity-sync.service'

/**
 * 身份源定时同步：每小时扫描 active providers，按组织 fan-out。
 * 单 provider 失败只记录 run failed，不影响其他组织/provider。
 */
@Injectable()
export class IdentitySyncJobService {
  private readonly logger = new Logger(IdentitySyncJobService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly sync: IdentitySyncService,
  ) {}

  @Cron('0 * * * *', { name: 'identity.sync_scan' })
  async runAll(): Promise<{ providers: number }> {
    const providers = (await this.dataSource.query(
      `SELECT "organizationId", key FROM public.identity_providers
        WHERE status = 'active'
          AND (config ? 'users' OR config->>'syncEnabled' = 'true')
        ORDER BY "organizationId", key`,
    )) as Array<{ organizationId: string; key: string }>
    for (const provider of providers) {
      try {
        await this.sync.run(provider.organizationId, provider.key)
      } catch (error) {
        this.logger.error(
          `identity sync org=${provider.organizationId} provider=${provider.key}: ${(error as Error).message}`,
        )
      }
    }
    return { providers: providers.length }
  }
}
