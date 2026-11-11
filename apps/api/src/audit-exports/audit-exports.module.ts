import { Module } from '@nestjs/common'
import { AssetsModule } from '@sap/platform-core/assets/assets.module'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { AuditExportJobService } from './audit-export-job.service'
import { AuditExportsController } from './audit-exports.controller'

@Module({
  imports: [JobsModule, AuditLogsModule, AssetsModule],
  controllers: [AuditExportsController],
  providers: [AuditExportJobService],
})
export class AuditExportsModule {}
