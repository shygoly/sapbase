import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { BusinessAppsModule } from '../business-apps/business-apps.module'
import { AppCapabilitiesController } from './app-capabilities.controller'
import { AppCapabilitiesService } from './app-capabilities.service'
import { AppCapability } from './entities/app-capability.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([AppCapability]),
    BusinessAppsModule,
    AuditLogsModule,
  ],
  controllers: [AppCapabilitiesController],
  providers: [AppCapabilitiesService],
  exports: [AppCapabilitiesService],
})
export class AppCapabilitiesModule {}
