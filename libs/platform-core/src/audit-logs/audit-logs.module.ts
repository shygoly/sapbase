import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from './audit-log.entity'
import { AuditLogsService } from './audit-logs.service'
import { AuditLogsController } from './audit-logs.controller'
import { AuditChainService } from './audit-chain.service'
import { AuditVerificationService } from './audit-verification.service'

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogsService, AuditChainService, AuditVerificationService],
  controllers: [AuditLogsController],
  exports: [AuditLogsService, AuditChainService, AuditVerificationService],
})
export class AuditLogsModule {}
