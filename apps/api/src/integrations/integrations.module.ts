import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { IdentityModule } from '@sap/platform-core/identity/identity.module'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { OutboxModule } from '../outbox/outbox.module'
import { BulkModule } from '../bulk/bulk.module'
import { SemanticRuntimeModule } from '../semantic-runtime/semantic-runtime.module'
import {
  DataSource,
  DataSyncJob,
  DataSyncRun,
  IntegrationConnector,
  OutboundMessage,
  WebhookEndpoint,
  WebhookEvent,
} from './integrations.entities'
import { IntegrationConnectorService } from './integration-connector.service'
import { IntegrationOutboundService } from './integration-outbound.service'
import { IntegrationWebhookService } from './integration-webhook.service'
import { IntegrationDataSourceService } from './integration-data-source.service'
import { IntegrationJobService } from './integration-job.service'
import { IntegrationMetricsService } from './integration-metrics.service'
import {
  IntegrationWebhookController,
  IntegrationsController,
} from './integrations.controller'

@Module({
  imports: [
    AuditLogsModule,
    JobsModule,
    IdentityModule,
    OutboxModule,
    BulkModule,
    SemanticRuntimeModule,
    TypeOrmModule.forFeature([
      IntegrationConnector,
      OutboundMessage,
      WebhookEndpoint,
      WebhookEvent,
      DataSource,
      DataSyncJob,
      DataSyncRun,
    ]),
  ],
  controllers: [IntegrationsController, IntegrationWebhookController],
  providers: [
    IntegrationConnectorService,
    IntegrationOutboundService,
    IntegrationWebhookService,
    IntegrationDataSourceService,
    IntegrationJobService,
    IntegrationMetricsService,
  ],
  exports: [
    IntegrationConnectorService,
    IntegrationOutboundService,
    IntegrationWebhookService,
    IntegrationDataSourceService,
  ],
})
export class IntegrationsModule {}
