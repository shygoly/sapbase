import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LabWorkflowExecution } from './lab-workflow-execution.entity'
import { LabWorkflowContextController } from './lab-workflow-context.controller'
import { LabWorkflowContextService } from './lab-workflow-context.service'

@Module({
  imports: [TypeOrmModule.forFeature([LabWorkflowExecution])],
  controllers: [LabWorkflowContextController],
  providers: [LabWorkflowContextService],
  exports: [LabWorkflowContextService, TypeOrmModule],
})
export class LabWorkflowContextModule {}
