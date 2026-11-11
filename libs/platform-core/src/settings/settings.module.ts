import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Setting } from './setting.entity'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { SettingsService } from './settings.service'
import { SettingsController } from './settings.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Setting]), AuditLogsModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
