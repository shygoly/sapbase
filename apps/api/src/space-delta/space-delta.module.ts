import { Module } from '@nestjs/common'
import { SpaceDeltaController } from './space-delta.controller'

@Module({
  controllers: [SpaceDeltaController],
})
export class SpaceDeltaModule {}
