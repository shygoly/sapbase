import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WorkflowDefinition } from './workflow-definition.entity'
import { WorkflowInstance } from './workflow-instance.entity'
import { WorkflowHistory } from './workflow-history.entity'
import { WorkflowDefinitionService } from './workflow-definition.service'
import { WorkflowInstanceService } from './workflow-instance.service'
import { TransitionEngineService } from './transition-engine.service'
import { WorkflowHistoryService } from './workflow-history.service'
import { WorkflowConverterService } from './workflow-converter.service'
import { WorkflowsController, WorkflowInstancesController } from './workflows.controller'
import { CacheModule } from '../cache/cache.module'
import { User } from '../users/user.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowDefinition, WorkflowInstance, WorkflowHistory, User]),
    CacheModule,
  ],
  controllers: [WorkflowsController, WorkflowInstancesController],
  providers: [
    WorkflowDefinitionService,
    WorkflowInstanceService,
    TransitionEngineService,
    WorkflowHistoryService,
    WorkflowConverterService,
  ],
  exports: [
    WorkflowDefinitionService,
    WorkflowInstanceService,
    TransitionEngineService,
    WorkflowHistoryService,
    WorkflowConverterService,
  ],
})
export class WorkflowsModule {}
