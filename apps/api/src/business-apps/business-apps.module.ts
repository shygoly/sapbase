import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { RecordLifecycleModule } from '../record-lifecycle/record-lifecycle.module'
import { EntitlementsModule } from '@sap/platform-core/entitlements/entitlements.module'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { BusinessAppInstallation } from './business-app-installation.entity'
import { AppRoleBinding } from '../app-catalog/entities/app-role-binding.entity'
import { BusinessAppInstallationRevision } from './business-app-installation-revision.entity'
import { BusinessAppsController } from './business-apps.controller'
import { BusinessAppsService } from './business-apps.service'
import { BusinessAppsJobService } from './business-apps-job.service'
import { BusinessAppsRunsService } from './business-apps-runs.service'
import { AppContextGuard } from './app-context.guard'
import { OptionalAppContextGuard } from './optional-app-context.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessAppInstallation,
      BusinessAppInstallationRevision,
      AppRoleBinding,
    ]),
    BlueprintModule,
    AuditLogsModule,
    RecordLifecycleModule,
    EntitlementsModule,
    JobsModule,
  ],
  controllers: [BusinessAppsController],
  providers: [
    BusinessAppsService,
    BusinessAppsJobService,
    BusinessAppsRunsService,
    AppContextGuard,
    OptionalAppContextGuard,
  ],
  exports: [
    BusinessAppsService,
    BusinessAppsRunsService,
    AppContextGuard,
    OptionalAppContextGuard,
  ],
})
export class BusinessAppsModule {}
