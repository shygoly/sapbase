import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SampleContextModule } from '../sample-context/sample-context.module'
import { LabQaSubmission } from './lab-qa-submission.entity'
import { LabQaReview } from './lab-qa-review.entity'
import { QaContextController } from './qa-context.controller'
import { QaContextService } from './qa-context.service'

@Module({
  imports: [TypeOrmModule.forFeature([LabQaSubmission, LabQaReview]), SampleContextModule],
  controllers: [QaContextController],
  providers: [QaContextService],
  exports: [QaContextService, TypeOrmModule],
})
export class QaContextModule {}
