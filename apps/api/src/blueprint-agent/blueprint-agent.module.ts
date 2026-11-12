import { Module } from '@nestjs/common'
import { AIModelsModule } from '../ai-models/ai-models.module'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { BlueprintAgentController } from './blueprint-agent.controller'
import { BlueprintAgentService } from './blueprint-agent.service'

@Module({
  imports: [BlueprintModule, AIModelsModule],
  controllers: [BlueprintAgentController],
  providers: [BlueprintAgentService],
  exports: [BlueprintAgentService],
})
export class BlueprintAgentModule {}
