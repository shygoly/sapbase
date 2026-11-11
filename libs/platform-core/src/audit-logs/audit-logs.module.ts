import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from './audit-log.entity'
import { AuditLogsService } from './audit-logs.service'
import { AuditLogsController } from './audit-logs.controller'
import { AuditChainService } from './audit-chain.service'
import { AuditVerificationService } from './audit-verification.service'
import { AuditCheckpointService } from './audit-checkpoint.service'
import { AuditRetentionService } from './audit-retention.service'
import { AuditCheckpoint } from './audit-checkpoint.entity'
import { AuditArchive } from './audit-archive.entity'
import { AuditAlertService } from './audit-alert.service'

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, AuditCheckpoint, AuditArchive])],
  providers: [
    AuditLogsService,
    AuditChainService,
    AuditVerificationService,
    AuditCheckpointService,
    AuditRetentionService,
    AuditAlertService,
  ],
  controllers: [AuditLogsController],
  exports: [
    AuditLogsService,
    AuditChainService,
    AuditVerificationService,
    AuditCheckpointService,
    AuditRetentionService,
    AuditAlertService,
  ],
})
export class AuditLogsModule {}
