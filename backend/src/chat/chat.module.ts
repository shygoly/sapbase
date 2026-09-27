import { Module } from '@nestjs/common'
import { AgentToolsModule } from '../agent-tools/agent-tools.module'
import { ChatController } from './chat.controller'
import { ChatOrchestrator } from './chat-orchestrator'
import { INTENT_PARSER } from './chat.types'
import { RuleBasedIntentParser } from './rule-based-intent-parser'

@Module({
  imports: [AgentToolsModule],
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
