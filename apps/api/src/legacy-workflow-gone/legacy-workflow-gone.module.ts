import { Module } from '@nestjs/common'
import {
  LegacyWorkflowInstancesGoneController,
  LegacyWorkflowsGoneController,
} from './legacy-workflow-gone.controller'

/** 旧工作流路由墓碑；替代被摘掉的 WorkflowsModule，不导入旧树。 */
@Module({
  controllers: [LegacyWorkflowsGoneController, LegacyWorkflowInstancesGoneController],
})
export class LegacyWorkflowGoneModule {}
