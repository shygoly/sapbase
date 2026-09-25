import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AtomicContract } from './atomic-contract.entity'
import { AtomicImplementation } from './atomic-implementation.entity'
import { AtomicModuleManifest } from './atomic-module-manifest.entity'
import { AtomicRegistryService } from './atomic-registry.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AtomicContract,
      AtomicImplementation,
      AtomicModuleManifest,
    ]),
  ],
  providers: [AtomicRegistryService],
  exports: [AtomicRegistryService],
})
export class AtomicRegistryModule {}
