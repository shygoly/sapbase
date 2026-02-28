import { Module } from '@nestjs/common'
import { LabWorkflowContextModule } from '../lab-workflow-context/lab-workflow-context.module'
import { MethodContextModule } from '../method-context/method-context.module'
import { QaContextModule } from '../qa-context/qa-context.module'
import { ReportContextModule } from '../report-context/report-context.module'
import { SampleContextModule } from '../sample-context/sample-context.module'
import { AuditContextModule } from '../audit-context/audit-context.module'
import { PharmanaCompatController } from './pharmana-compat.controller'

@Module({
  imports: [
    SampleContextModule,
    MethodContextModule,
    LabWorkflowContextModule,
    QaContextModule,
    ReportContextModule,
    AuditContextModule,
  ],
  controllers: [PharmanaCompatController],
})
export class PharmanaCompatModule {}
