import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Organization } from '../organizations/organization.entity'
import { AppEntitlement } from './app-entitlement.entity'
import { AppUsageRecord } from './app-usage-record.entity'
import { EntitlementsController } from './entitlements.controller'
import { EntitlementsService } from './entitlements.service'
import { UsageMeteringService } from './usage-metering.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([AppEntitlement, AppUsageRecord, Organization]),
  ],
  controllers: [EntitlementsController],
  providers: [EntitlementsService, UsageMeteringService],
  exports: [EntitlementsService, UsageMeteringService, TypeOrmModule],
})
export class EntitlementsModule {}
