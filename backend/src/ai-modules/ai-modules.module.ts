import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AIModule } from './ai-module.entity'
import { AIModuleTest } from './ai-module-test.entity'
import { AIModuleReview } from './ai-module-review.entity'
import { AIModuleDefinition } from './ai-module-definition.entity'
import { AIModulesService } from './ai-modules.service'
import { AIModulesController } from './ai-modules.controller'
import { AIModelsModule } from '../ai-models/ai-models.module'
import { ModuleRegistryModule } from '../module-registry/module-registry.module'
import { SystemModule } from '../system/system.module'
import { WorkflowsModule } from '../workflows/workflows.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([AIModule, AIModuleTest, AIModuleReview, AIModuleDefinition]),
    AIModelsModule,
    ModuleRegistryModule,
    SystemModule,
    WorkflowsModule,
  ],
  providers: [AIModulesService],
  controllers: [AIModulesController],
  exports: [AIModulesService],
})
export class AIModulesModule {}
