import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MenuItem } from './menu.entity'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { MenuService } from './menu.service'
import { MenuController } from './menu.controller'

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem]), AuditLogsModule],
  providers: [MenuService],
  controllers: [MenuController],
  exports: [MenuService],
})
export class MenuModule {}
