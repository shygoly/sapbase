import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AIModel } from './ai-model.entity'
import { AIModelsService } from './ai-models.service'
import { AIModelsController } from './ai-models.controller'

@Module({
  imports: [TypeOrmModule.forFeature([AIModel])],
  providers: [AIModelsService],
  controllers: [AIModelsController],
  exports: [AIModelsService],
})
export class AIModelsModule {}
