import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AIModule } from './ai-module.entity'
import { AIModuleTest } from './ai-module-test.entity'
import { AIModuleReview } from './ai-module-review.entity'
import { AIModuleDefinition } from './ai-module-definition.entity'
import { AIModuleVersion } from './ai-module-version.entity'
import { AIModulesService } from './ai-modules.service'
import { AIModulesController } from './ai-modules.controller'
import { AIModelsModule } from '../ai-models/ai-models.module'
import { ModuleRegistryModule } from '../module-registry/module-registry.module'
import { SystemModule } from '../system/system.module'
import { AIModuleContextModule } from '../ai-module-context/ai-module-context.module'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { AiGovernanceModule } from '../ai-governance/ai-governance.module'
import { AIModuleBlueprintService } from './ai-module-blueprint.service'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [
    AIModuleContextModule,
    TypeOrmModule.forFeature([
      AIModule,
      AIModuleTest,
      AIModuleReview,
      AIModuleDefinition,
      AIModuleVersion,
    ]),
    AuditLogsModule,
    NotificationsModule,
    AIModelsModule,
    ModuleRegistryModule,
    SystemModule,
    BlueprintModule,
    AiGovernanceModule,
  ],
  providers: [AIModulesService, AIModuleBlueprintService],
  controllers: [AIModulesController],
  exports: [AIModulesService],
})
export class AIModulesModule {}
