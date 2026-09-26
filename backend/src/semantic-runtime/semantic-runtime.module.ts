import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AtomicRegistryModule } from '../atomic-registry/atomic-registry.module'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { BlueprintRecord } from './blueprint-record.entity'
import { SemanticRuntimeController } from './semantic-runtime.controller'
import { SemanticRuntimeService } from './semantic-runtime.service'

@Module({
  imports: [
    BlueprintModule,
    AtomicRegistryModule,
    TypeOrmModule.forFeature([BlueprintRecord]),
  ],
  controllers: [SemanticRuntimeController],
  providers: [SemanticRuntimeService],
  exports: [SemanticRuntimeService],
})
export class SemanticRuntimeModule {}
