import { Module } from '@nestjs/common'
import { OperationsDashboardController } from './operations-dashboard.controller'
import { OperationsDashboardService } from './operations-dashboard.service'

@Module({
  controllers: [OperationsDashboardController],
  providers: [OperationsDashboardService],
  exports: [OperationsDashboardService],
})
export class OperationsDashboardModule {}
