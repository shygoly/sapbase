import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Job } from './job.entity'
import { JobAttempt } from './job-attempt.entity'
import { JobEvent } from './job-event.entity'

/** v1 先提供实体/表；worker、任务类型注册与外部 API 在后续任务接入。 */
@Module({
  imports: [TypeOrmModule.forFeature([Job, JobAttempt, JobEvent])],
  exports: [TypeOrmModule],
})
export class JobsModule {}
