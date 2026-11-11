import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DataSource } from 'typeorm'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { MetricsService } from './metrics.service'

@Injectable()
export class MetricsJobService implements OnModuleInit {
  private readonly logger = new Logger(MetricsJobService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: JobTypeRegistry,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    this.register('metrics.snapshot', async (ctx) =>
      this.metrics.snapshotAll(ctx.organizationId),
    )
    this.register('metrics.backfill', async (ctx, payload) =>
      this.metrics.backfill(ctx.organizationId, {
        metricKey: payload.metricKey ? String(payload.metricKey) : undefined,
        days: Number(payload.days ?? 30),
      }),
    )
    this.register('metrics.alerts', async (ctx) =>
      this.metrics.evaluateAlerts(ctx.organizationId),
    )
  }

  @Cron('30 1 * * *', { name: 'metrics.snapshot_scan' })
  async snapshotAll(): Promise<{ organizations: number }> {
    return this.fanOut((org) => this.metrics.snapshotAll(org))
  }

  @Cron('*/30 * * * *', { name: 'metrics.alert_scan' })
  async evaluateAll(): Promise<{ organizations: number }> {
    return this.fanOut((org) => this.metrics.evaluateAlerts(org))
  }

  private async fanOut(work: (organizationId: string) => Promise<unknown>) {
    const organizations = (await this.dataSource.query(
      `SELECT id FROM public.organizations ORDER BY id`,
    )) as Array<{ id: string }>
    for (const organization of organizations) {
      try {
        await work(organization.id)
      } catch (error) {
        this.logger.error(`metrics job org=${organization.id}: ${(error as Error).message}`)
      }
    }
    return { organizations: organizations.length }
  }

  private register(
    type: string,
    run: (ctx: { organizationId: string; jobId: string }, payload: Record<string, unknown>) => Promise<unknown>,
  ) {
    if (this.registry.has(type)) return
    this.registry.register({
      type,
      typeVersion: 1,
      timeoutMs: 10 * 60_000,
      maxAttempts: 2,
      backoff: { kind: 'exponential', baseMs: 5_000, maxMs: 60_000 },
      concurrency: 1,
      payloadSchema: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 365 },
          metricKey: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => ({ result: await run(ctx, payload) }),
    })
  }
}
