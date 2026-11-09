import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from './audit-log.entity'
import { AuditLogsService } from './audit-logs.service'
import { AuditLogsController } from './audit-logs.controller'
import { AuditChainService } from './audit-chain.service'

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogsService, AuditChainService],
  controllers: [AuditLogsController],
  exports: [AuditLogsService, AuditChainService],
})
export class AuditLogsModule {}
