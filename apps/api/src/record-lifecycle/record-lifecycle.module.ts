import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { SemanticRuntimeModule } from '../semantic-runtime/semantic-runtime.module'
import { RecordOperation } from './record-operation.entity'
import { RecordSnapshot } from './record-snapshot.entity'
import { RecordLifecycleController } from './record-lifecycle.controller'
import { RecordLifecycleService } from './record-lifecycle.service'
import { RecordLifecycleJobService } from './record-lifecycle-job.service'

@Module({
  imports: [
    SemanticRuntimeModule,
    AuditLogsModule,
    JobsModule,
    TypeOrmModule.forFeature([RecordSnapshot, RecordOperation]),
  ],
  controllers: [RecordLifecycleController],
  providers: [RecordLifecycleService, RecordLifecycleJobService],
  exports: [RecordLifecycleService],
})
export class RecordLifecycleModule {}
