import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DataSource } from 'typeorm'
import { BlueprintRecordRetentionService } from './blueprint-record-retention.service'

@Injectable()
export class BlueprintRecordRetentionJobService {
  private readonly logger = new Logger(BlueprintRecordRetentionJobService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly retention: BlueprintRecordRetentionService,
  ) {}

  @Cron('30 4 * * *', { name: 'blueprint_records.retention_scan' })
  async pruneAll(): Promise<{ organizations: number; deleted: number }> {
    const organizations = (await this.dataSource.query(
      `SELECT id FROM public.organizations ORDER BY id`,
    )) as Array<{ id: string }>
    let deleted = 0
    for (const organization of organizations) {
      try {
        const result = await this.retention.prune(organization.id, {
          actor: 'system:cron',
        })
        deleted += result.deleted
      } catch (error) {
        this.logger.error(
          `blueprint_records retention org=${organization.id}: ${(error as Error).message}`,
        )
      }
    }
    return { organizations: organizations.length, deleted }
  }
}
