import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AgentToolsModule } from '../agent-tools/agent-tools.module'
import { ChatModule } from '../chat/chat.module'
import { ReleasesModule } from '../releases/releases.module'
import { AgentSessionsController } from './agent-sessions.controller'
import { AgentSessionsService } from './agent-sessions.service'
import { AgentConversation } from './entities/agent-conversation.entity'
import { AgentToolCall } from './entities/agent-tool-call.entity'
import { AgentTurn } from './entities/agent-turn.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentConversation, AgentTurn, AgentToolCall]),
    AgentToolsModule,
    ChatModule,
    ReleasesModule,
  ],
  controllers: [AgentSessionsController],
  providers: [AgentSessionsService],
  exports: [AgentSessionsService],
})
export class AgentSessionsModule {}
