import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AgentToolsModule } from '../agent-tools/agent-tools.module'
import { ChatModule } from '../chat/chat.module'
import { ReleasesModule } from '../releases/releases.module'
import { AgentKnowledgeModule } from '../agent-knowledge/agent-knowledge.module'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { AgentSessionsController } from './agent-sessions.controller'
import { AgentSessionsService } from './agent-sessions.service'
import { AgentSessionCacheService } from './agent-session-cache.service'
import { AgentRunsService } from './agent-runs.service'
import { AgentRuntimeService } from './agent-runtime.service'
import { AgentDefinition } from './entities/agent-definition.entity'
import { AgentInstance } from './entities/agent-instance.entity'
import { AgentRun } from './entities/agent-run.entity'
import { AgentStep } from './entities/agent-step.entity'
import { AgentWait } from './entities/agent-wait.entity'
import { AgentConversation } from './entities/agent-conversation.entity'
import { AgentToolCall } from './entities/agent-tool-call.entity'
import { AgentTurn } from './entities/agent-turn.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentConversation,
      AgentTurn,
      AgentToolCall,
      AgentDefinition,
      AgentInstance,
      AgentRun,
      AgentStep,
      AgentWait,
    ]),
    AgentToolsModule,
    ChatModule,
    ReleasesModule,
    AgentKnowledgeModule,
    JobsModule,
  ],
  controllers: [AgentSessionsController],
  providers: [
    AgentSessionsService,
    AgentSessionCacheService,
    AgentRunsService,
    AgentRuntimeService,
  ],
  exports: [AgentSessionsService, AgentRunsService, AgentRuntimeService],
})
export class AgentSessionsModule {}
