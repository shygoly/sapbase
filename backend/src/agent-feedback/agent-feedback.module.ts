import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AgentFeedbackController } from './agent-feedback.controller'
import { AgentFeedbackService } from './agent-feedback.service'
import { AgentFeedback } from './entities/agent-feedback.entity'
import { AgentFeedbackTopic } from './entities/agent-feedback-topic.entity'

@Module({
  imports: [TypeOrmModule.forFeature([AgentFeedback, AgentFeedbackTopic])],
  controllers: [AgentFeedbackController],
  providers: [AgentFeedbackService],
  exports: [AgentFeedbackService],
})
export class AgentFeedbackModule {}
