import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AgentFeedbackController } from './agent-feedback.controller'
import { AgentFeedbackService } from './agent-feedback.service'
import { AgentFeedback } from './entities/agent-feedback.entity'

@Module({
  imports: [TypeOrmModule.forFeature([AgentFeedback])],
  controllers: [AgentFeedbackController],
  providers: [AgentFeedbackService],
  exports: [AgentFeedbackService],
})
export class AgentFeedbackModule {}
