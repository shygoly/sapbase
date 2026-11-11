import { Module } from '@nestjs/common'
import { AgentToolsModule } from '../agent-tools/agent-tools.module'
import { AgentHostController } from './agent-host.controller'
import { AgentHostService } from './agent-host.service'

@Module({
  imports: [AgentToolsModule],
  controllers: [AgentHostController],
  providers: [AgentHostService],
  exports: [AgentHostService],
})
export class AgentHostModule {}
