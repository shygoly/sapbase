import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Asset } from '@sap/platform-core/assets/asset.entity'
import { AssetVariant } from '@sap/platform-core/assets/asset-variant.entity'
import { AssetsModule } from '@sap/platform-core/assets/assets.module'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { OfflineDevice, OfflineEntitlement, OfflinePackage } from './offline.entities'
import { OfflineController } from './offline.controller'
import { OfflineService } from './offline.service'

@Module({
  imports: [
    AssetsModule,
    AuditLogsModule,
    TypeOrmModule.forFeature([OfflinePackage, OfflineEntitlement, OfflineDevice, Asset, AssetVariant]),
  ],
  controllers: [OfflineController],
  providers: [OfflineService],
  exports: [OfflineService],
})
export class OfflineModule {}
