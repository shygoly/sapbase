import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AgentEvalController } from './agent-eval.controller'
import { AgentEvalService } from './agent-eval.service'
import { AgentEvalCase } from './entities/agent-eval-case.entity'
import { AgentEvalRun } from './entities/agent-eval-run.entity'

@Module({
  imports: [TypeOrmModule.forFeature([AgentEvalCase, AgentEvalRun])],
  controllers: [AgentEvalController],
  providers: [AgentEvalService],
  exports: [AgentEvalService],
})
export class AgentEvalModule {}
