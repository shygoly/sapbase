import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from '@sap/platform-core/audit-logs/audit-log.entity'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { EntitlementsModule } from '@sap/platform-core/entitlements/entitlements.module'
import { BusinessAppsModule } from '../business-apps/business-apps.module'
import { AppCatalogController } from './app-catalog.controller'
import { AppCatalogService } from './app-catalog.service'
import { AppBrandConfig } from './entities/app-brand-config.entity'
import { AppRoleBinding } from './entities/app-role-binding.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([AppRoleBinding, AppBrandConfig, AuditLog]),
    BusinessAppsModule,
    EntitlementsModule,
    AuditLogsModule,
  ],
  controllers: [AppCatalogController],
  providers: [AppCatalogService],
  exports: [AppCatalogService],
})
export class AppCatalogModule {}
