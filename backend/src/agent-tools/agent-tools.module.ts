import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AtomicRegistryModule } from '../atomic-registry/atomic-registry.module'
import { AtomicRuntimeModule } from '../atomic-runtime/atomic-runtime.module'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { ModuleRegistryModule } from '../module-registry/module-registry.module'
import { AgentToolRegistry } from './agent-tool.registry'
import { AgentToolsController } from './agent-tools.controller'
import { AgentConfirmationToken } from './confirmation-token.entity'
import { ConfirmationTokenService } from './confirmation-token.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentConfirmationToken]),
    BlueprintModule,
    ModuleRegistryModule,
    AtomicRuntimeModule,
    AtomicRegistryModule,
    AuditLogsModule,
  ],
  controllers: [AgentToolsController],
  providers: [AgentToolRegistry, ConfirmationTokenService],
  exports: [AgentToolRegistry, ConfirmationTokenService],
})
export class AgentToolsModule {}
