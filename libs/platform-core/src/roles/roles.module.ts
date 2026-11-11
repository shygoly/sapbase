import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Role } from './role.entity'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { RolesService } from './roles.service'
import { RolesController } from './roles.controller'
import { EffectivePermissionsService } from './effective-permissions.service'

@Module({
  imports: [TypeOrmModule.forFeature([Role]), AuditLogsModule],
  controllers: [RolesController],
  providers: [RolesService, EffectivePermissionsService],
  exports: [RolesService, EffectivePermissionsService],
})
export class RolesModule {}
