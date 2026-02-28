import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LabAuditLog } from './lab-audit-log.entity'
import { AuditContextController } from './audit-context.controller'
import { AuditContextService } from './audit-context.service'

@Module({
  imports: [TypeOrmModule.forFeature([LabAuditLog])],
  providers: [AuditContextService],
  controllers: [AuditContextController],
  exports: [AuditContextService, TypeOrmModule],
})
export class AuditContextModule {}
