import { Module } from '@nestjs/common'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { AuditJobsService } from './audit-jobs.service'

@Module({
  imports: [AuditLogsModule],
  providers: [AuditJobsService],
})
export class AuditJobsModule {}
