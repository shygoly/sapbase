import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { BlueprintSuggestionLog } from './suggestion-log.entity'
import { SemanticRuntimeService } from './semantic-runtime.service'
import { withTenantContext } from '../common/transaction/with-tenant-context'

/**
 * 每天 02:00 写建议日志。口径与 GET suggested-transitions 相同，不改状态。
 * `@Cron('0 2 * * *')` 全仓只允许这一处（见 suggestion-cron.spec.ts）。
 */
@Injectable()
export class SuggestionCronJob {
  private readonly logger = new Logger(SuggestionCronJob.name)

  constructor(
    private readonly runtime: SemanticRuntimeService,
    @InjectRepository(BlueprintSuggestionLog)
    private readonly logs: Repository<BlueprintSuggestionLog>,
    private readonly dataSource: DataSource,
  ) {}

  @Cron('0 2 * * *', { name: 'semantic.suggest_transitions' })
  async run(): Promise<void> {
    this.logger.log('blueprint suggestion cron started')
    try {
      const organizations: Array<{ id: string }> = await this.dataSource.query(
        `SELECT id FROM public.organizations ORDER BY id`,
      )
      for (const organization of organizations) {
        try {
          await withTenantContext(
            this.dataSource,
            { organizationId: organization.id },
            () => this.runOrganization(organization.id),
          )
        } catch (error) {
          this.logger.warn(
            `suggestion organization failed org=${organization.id}: ${(error as Error).message}`,
          )
        }
      }
      this.logger.log('blueprint suggestion cron finished')
    } catch (error) {
      this.logger.error(`blueprint suggestion cron error: ${(error as Error).message}`)
    }
  }

  private async runOrganization(organizationId: string): Promise<void> {
    const targets = await this.runtime.listAutoSuggestTargets(organizationId)
    for (const target of targets) {
      try {
        const suggestions = await this.runtime.listSuggestedTransitions(
          target.packageId,
          target.entity,
          target.recordId,
          target.organizationId,
        )
        if (suggestions.length === 0) continue
        await this.logs.save({
          blueprintId: target.blueprintId,
          entity: target.entity,
          recordId: target.recordId,
          organizationId: target.organizationId,
          suggestedToState: suggestions[0].to,
          reason: null,
        })
      } catch (error) {
        this.logger.warn(
          `suggestion failed for ${target.entity}/${target.recordId}: ${(error as Error).message}`,
        )
      }
    }
  }
}
