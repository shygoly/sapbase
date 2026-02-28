import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LabReport } from './lab-report.entity'
import { ReportContextController } from './report-context.controller'
import { ReportContextService } from './report-context.service'

@Module({
  imports: [TypeOrmModule.forFeature([LabReport])],
  providers: [ReportContextService],
  controllers: [ReportContextController],
  exports: [ReportContextService, TypeOrmModule],
})
export class ReportContextModule {}
