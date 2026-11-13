import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AIModel } from './ai-model.entity'
import { AIModelCall } from './ai-model-call.entity'
import { AIModelsService } from './ai-models.service'
import { ModelGatewayService } from './model-gateway.service'
import { ModelProfileService } from './model-profile.service'
import { AIModelsController } from './ai-models.controller'

@Module({
  imports: [TypeOrmModule.forFeature([AIModel, AIModelCall])],
  providers: [AIModelsService, ModelGatewayService, ModelProfileService],
  controllers: [AIModelsController],
  exports: [AIModelsService, ModelGatewayService, ModelProfileService],
})
export class AIModelsModule {}
