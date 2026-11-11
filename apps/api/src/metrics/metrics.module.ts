import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { AssetsModule } from '@sap/platform-core/assets/assets.module'
import {
  Dashboard,
  DashboardWidget,
  MetricAlert,
  MetricAlertEvent,
  MetricDefinition,
  MetricValue,
} from './metrics.entities'
import { MetricSourceService } from './metric-source.service'
import { MetricsService } from './metrics.service'
import { MetricsJobService } from './metrics-job.service'
import { MetricsController } from './metrics.controller'
import { MetricsExportController } from './metrics-export.controller'
import { MetricsExportService } from './metrics-export.service'

@Module({
  imports: [
    JobsModule,
    AssetsModule,
    TypeOrmModule.forFeature([
      MetricDefinition,
      MetricValue,
      Dashboard,
      DashboardWidget,
      MetricAlert,
      MetricAlertEvent,
    ]),
  ],
  controllers: [MetricsController, MetricsExportController],
  providers: [MetricSourceService, MetricsService, MetricsJobService, MetricsExportService],
  exports: [MetricsService, MetricSourceService],
})
export class MetricsModule {}
