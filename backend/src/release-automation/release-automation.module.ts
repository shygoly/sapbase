import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ReleasesModule } from '../releases/releases.module'
import { ReleaseAutomationController } from './release-automation.controller'
import { ReleaseAutomationService } from './release-automation.service'
import { ReleaseAutomationPolicy } from './entities/release-automation-policy.entity'
import { ReleaseAutomationRun } from './entities/release-automation-run.entity'

@Module({
  imports: [TypeOrmModule.forFeature([ReleaseAutomationPolicy, ReleaseAutomationRun]), ReleasesModule],
  controllers: [ReleaseAutomationController],
  providers: [ReleaseAutomationService],
  exports: [ReleaseAutomationService],
})
export class ReleaseAutomationModule {}
