import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AgentKnowledgeController } from './agent-knowledge.controller'
import { AgentKnowledgeService } from './agent-knowledge.service'
import { AgentKnowledgeEntry } from './entities/agent-knowledge-entry.entity'
import { AgentSkillVersion } from './entities/agent-skill-version.entity'

@Module({
  imports: [TypeOrmModule.forFeature([AgentKnowledgeEntry, AgentSkillVersion])],
  controllers: [AgentKnowledgeController],
  providers: [AgentKnowledgeService],
  exports: [AgentKnowledgeService],
})
export class AgentKnowledgeModule {}
