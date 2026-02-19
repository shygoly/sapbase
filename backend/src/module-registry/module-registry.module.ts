import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ModuleRegistry } from './module-registry.entity'
import { ModuleRelationship } from './module-relationship.entity'
import { ModuleCapability } from './module-capability.entity'
import { ModuleStatistics } from './module-statistics.entity'
import { ModuleConfiguration } from './module-configuration.entity'
import { ModuleRegistryService } from './module-registry.service'
import { ModuleRegistryController } from './module-registry.controller'
import { AIContextController } from './ai-context.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModuleRegistry,
      ModuleRelationship,
      ModuleCapability,
      ModuleStatistics,
      ModuleConfiguration,
    ]),
  ],
  providers: [ModuleRegistryService],
  controllers: [ModuleRegistryController, AIContextController],
  exports: [ModuleRegistryService],
})
export class ModuleRegistryModule {}
