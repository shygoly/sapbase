import { Injectable, Logger, Inject } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import { WorkflowInstance } from '../../../workflows/workflow-instance.entity'
import { WorkflowDefinition } from '../../../workflows/workflow-definition.entity'
import { WorkflowAutoSuggestionLog } from '../../../workflows/workflow-auto-suggestion-log.entity'
import { GetSuggestedTransitionsService } from '../../application/services/get-suggested-transitions.service'

@Injectable()
export class WorkflowAutoTransitionJob {
  private readonly logger = new Logger(WorkflowAutoTransitionJob.name)

  constructor(
    @InjectRepository(WorkflowInstance)
    private instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowDefinition)
    private definitionRepo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowAutoSuggestionLog)
    private suggestionLogRepo: Repository<WorkflowAutoSuggestionLog>,
    private getSuggestedTransitionsService: GetSuggestedTransitionsService,
  ) {}

  /**
   * Runs daily at 02:00. Finds running instances with workflow metadata.autoTransition.enabled,
   * calls AI for suggested next transition, and writes audit log (strategy: audit).
   */
  @Cron('0 2 * * *')
  async run() {
    this.logger.log('Workflow auto-transition job started')
    try {
      const definitions = await this.definitionRepo.find({
        where: { status: 'active' as any },
        select: ['id', 'metadata'],
      })
      const withAuto = definitions.filter(
        (d) => (d.metadata as any)?.autoTransition?.enabled === true,
      )
      if (withAuto.length === 0) {
        this.logger.log('No workflows with autoTransition.enabled')
        return
      }

      const ids = withAuto.map((d) => d.id)
      const instances = await this.instanceRepo.find({
        where: {
          status: 'running' as any,
          workflowDefinitionId: In(ids),
        },
        relations: ['workflowDefinition'],
      })

      for (const instance of instances) {
        try {
          const meta = (instance.workflowDefinition?.metadata as any)?.autoTransition
          const strategy = meta?.strategy ?? 'audit'

          const suggestions =
            await this.getSuggestedTransitionsService.getSuggestedTransitions(
              instance.id,
              instance.organizationId,
              instance.context as Record<string, unknown>,
            )
          if (suggestions.length === 0) continue

          const top = suggestions[0]
          if (strategy === 'audit') {
            await this.suggestionLogRepo.save({
              workflowInstanceId: instance.id,
              organizationId: instance.organizationId,
              suggestedToState: top.toState,
              reason: top.reason ?? null,
            })
            this.logger.debug(
              `Audit: instance ${instance.id} suggested -> ${top.toState}`,
            )
          }
          // strategy === 'execute' could call ExecuteTransitionService with system user (not implemented here)
        } catch (err) {
          this.logger.warn(
            `Auto-suggestion failed for instance ${instance.id}: ${(err as Error).message}`,
          )
        }
      }
      this.logger.log('Workflow auto-transition job finished')
    } catch (err) {
      this.logger.error(
        `Workflow auto-transition job error: ${(err as Error).message}`,
      )
    }
  }
}
