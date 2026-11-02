import { Module } from '@nestjs/common'
import { AgentToolsModule } from '../agent-tools/agent-tools.module'
import { ChatController } from './chat.controller'
import { ChatOrchestrator } from './chat-orchestrator'
import { INTENT_PARSER } from './chat.types'
import { RuleBasedIntentParser } from './rule-based-intent-parser'
import { BusinessAppsModule } from '../business-apps/business-apps.module'
import { AIModelsModule } from '../ai-models/ai-models.module'
import { AIModelsService } from '../ai-models/ai-models.service'
import { LlmIntentPlanner } from './llm-intent-planner'
import { HybridIntentParser } from './hybrid-intent-parser'

@Module({
  imports: [AgentToolsModule, BusinessAppsModule, AIModelsModule],
  controllers: [ChatController],
  providers: [
    {
      provide: INTENT_PARSER,
      useFactory: () => new RuleBasedIntentParser(),
    },
    ChatOrchestrator,
  ],
  exports: [ChatOrchestrator],
})
export class ChatModule {}
