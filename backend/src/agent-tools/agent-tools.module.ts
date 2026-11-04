import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AtomicRegistryModule } from '../atomic-registry/atomic-registry.module'
import { AtomicRuntimeModule } from '../atomic-runtime/atomic-runtime.module'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { ModuleRegistryModule } from '../module-registry/module-registry.module'
import { AgentToolRegistry } from './agent-tool.registry'
import { AgentToolMcpBridge } from './mcp/agent-tool-mcp.bridge'
import { AgentToolsController } from './agent-tools.controller'
import { AgentConfirmationToken } from './confirmation-token.entity'
import { ConfirmationTokenService } from './confirmation-token.service'
import { BusinessAppsModule } from '../business-apps/business-apps.module'
import { AgentFeedbackModule } from '../agent-feedback/agent-feedback.module'
import { ReleasesModule } from '../releases/releases.module'
import { ModuleRegistryService } from '../module-registry/module-registry.service'
import { AgentFeedbackService } from '../agent-feedback/agent-feedback.service'
import { AtomicExecutor } from '../atomic-runtime/atomic-executor.service'
import { RevocationListService } from '../atomic-runtime/revocation-list.service'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { BlueprintService } from '../blueprint/blueprint.service'
import { ReleasesService } from '../releases/releases.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentConfirmationToken]),
    BlueprintModule,
    ModuleRegistryModule,
    AtomicRuntimeModule,
    AtomicRegistryModule,
    AuditLogsModule,
    BusinessAppsModule,
    AgentFeedbackModule,
    ReleasesModule,
  ],
  controllers: [AgentToolsController],
  providers: [
    ConfirmationTokenService,
    AgentToolMcpBridge,
    {
      // platform-agent 只声明端口；模块注册表与 Builder 反馈由应用层实现。
      provide: AgentToolRegistry,
      useFactory: (
        blueprints: BlueprintService,
        modules: ModuleRegistryService,
        executor: AtomicExecutor,
        revocations: RevocationListService,
        atomics: AtomicRegistryService,
        auditLogs: AuditLogsService,
        tokens: ConfirmationTokenService,
        feedback: AgentFeedbackService,
        releases: ReleasesService,
      ) =>
        new AgentToolRegistry(
          blueprints,
          modules,
          executor,
          revocations,
          atomics,
          auditLogs,
          tokens,
          feedback,
          releases,
        ),
      inject: [
        BlueprintService,
        ModuleRegistryService,
        AtomicExecutor,
        RevocationListService,
        AtomicRegistryService,
        AuditLogsService,
        ConfirmationTokenService,
        AgentFeedbackService,
        ReleasesService,
      ],
    },
  ],
  exports: [AgentToolRegistry, ConfirmationTokenService, AgentToolMcpBridge],
})
export class AgentToolsModule {}
