import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Permission } from './permission.entity'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { PermissionsService } from './permissions.service'
import { PermissionsController } from './permissions.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Permission]), AuditLogsModule],
  providers: [PermissionsService],
  controllers: [PermissionsController],
  exports: [PermissionsService],
})
export class PermissionsModule {}
