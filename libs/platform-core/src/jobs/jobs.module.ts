import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { Job } from './job.entity'
import { JobAttempt } from './job-attempt.entity'
import { JobEvent } from './job-event.entity'
import { JobCallbackService } from './job-callback'
import { JobQueue } from './job-queue'
import { JobTypeRegistry } from './job-types'
import { JobWorkerService } from './job-worker'
import { JobWakeupService } from './job-wakeup'
import { JobsController } from './jobs.controller'
import { JobsService } from './jobs.service'

@Module({
  imports: [TypeOrmModule.forFeature([Job, JobAttempt, JobEvent]), AuditLogsModule],
  controllers: [JobsController],
  providers: [
    JobQueue,
    JobTypeRegistry,
    JobCallbackService,
    JobWakeupService,
    JobWorkerService,
    JobsService,
  ],
  exports: [
    TypeOrmModule,
    JobQueue,
    JobTypeRegistry,
    JobCallbackService,
    JobWakeupService,
    JobWorkerService,
    JobsService,
  ],
})
export class JobsModule {}
