import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ReleasesModule } from '../releases/releases.module'
import { ReleaseAutomationController } from './release-automation.controller'
import { ReleaseAutomationService } from './release-automation.service'
import { ReleaseAutomationJobsService } from './release-automation-jobs.service'
import { ReleaseAutomationPolicy } from './entities/release-automation-policy.entity'
import { ReleaseAutomationRun } from './entities/release-automation-run.entity'
import { AppReleaseActivation } from '../releases/entities/app-release-activation.entity'

@Module({
  imports: [TypeOrmModule.forFeature([ReleaseAutomationPolicy, ReleaseAutomationRun, AppReleaseActivation]), ReleasesModule],
  controllers: [ReleaseAutomationController],
  providers: [ReleaseAutomationService, ReleaseAutomationJobsService],
  exports: [ReleaseAutomationService],
})
export class ReleaseAutomationModule {}
