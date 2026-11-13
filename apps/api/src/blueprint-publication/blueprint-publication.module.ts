import { Module } from '@nestjs/common'
import { AgentEvalModule } from '../agent-eval/agent-eval.module'
import { BlueprintPublicationController } from './blueprint-publication.controller'
import { BlueprintPublicationGateService } from './blueprint-publication-gate.service'

@Module({
  imports: [AgentEvalModule],
  controllers: [BlueprintPublicationController],
  providers: [BlueprintPublicationGateService],
  exports: [BlueprintPublicationGateService],
})
export class BlueprintPublicationModule {}
