import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { BusinessAppInstallation } from './business-app-installation.entity'
import { BusinessAppInstallationRevision } from './business-app-installation-revision.entity'
import { BusinessAppsController } from './business-apps.controller'
import { BusinessAppsService } from './business-apps.service'
import { AppContextGuard } from './app-context.guard'
import { OptionalAppContextGuard } from './optional-app-context.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessAppInstallation, BusinessAppInstallationRevision]),
    BlueprintModule,
    AuditLogsModule,
  ],
  controllers: [BusinessAppsController],
  providers: [BusinessAppsService, AppContextGuard, OptionalAppContextGuard],
  exports: [BusinessAppsService, AppContextGuard, OptionalAppContextGuard],
})
export class BusinessAppsModule {}
