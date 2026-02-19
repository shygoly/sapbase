import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { Plugin as PluginOrm } from './infrastructure/persistence/plugin.entity'
import {
  PLUGIN_REPOSITORY,
  PLUGIN_LOADER,
  DEPENDENCY_RESOLVER,
  PERMISSION_CHECKER,
  PLUGIN_EVENT_EMITTER,
} from './domain'
import { PluginRepository } from './infrastructure/persistence/plugin.repository'
import { PluginLoaderService } from './infrastructure/services/plugin-loader.service'
import { DependencyResolverService } from './infrastructure/services/dependency-resolver.service'
import { PermissionCheckerService } from './infrastructure/services/permission-checker.service'
import { PluginLifecycleService } from './application/services/plugin-lifecycle.service'
import { GetPluginsService } from './application/services/get-plugins.service'
import { PluginRegistryService } from './application/services/plugin-registry.service'
import { PluginRuntimeService } from './infrastructure/runtime/plugin-runtime.service'
import { PluginApiRouterService } from './infrastructure/runtime/plugin-api-router.service'
import { PluginContextProvider } from './infrastructure/runtime/plugin-context-provider.service'
import { PluginDatabaseAccessService } from './infrastructure/database/plugin-database-access.service'
import { PluginModuleIntegrationService } from './application/services/plugin-module-integration.service'
import { PluginEventEmitterService } from './infrastructure/events/plugin-event-emitter.service'
import { PluginAuditLoggerService } from './infrastructure/audit/plugin-audit-logger.service'
import { PluginSecurityValidatorService } from './infrastructure/security/plugin-security-validator.service'
import { PluginsController } from './plugins.controller'
import { AIModuleContextModule } from '../ai-module-context/ai-module-context.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([PluginOrm]),
    ConfigModule,
    AIModuleContextModule,
  ],
  providers: [
    {
      provide: PLUGIN_REPOSITORY,
      useClass: PluginRepository,
    },
    {
      provide: PLUGIN_LOADER,
      useClass: PluginLoaderService,
    },
    {
      provide: DEPENDENCY_RESOLVER,
      useClass: DependencyResolverService,
    },
    {
      provide: PERMISSION_CHECKER,
      useClass: PermissionCheckerService,
    },
    {
      provide: PLUGIN_EVENT_EMITTER,
      useClass: PluginEventEmitterService,
    },
    PluginRepository,
    PluginLoaderService,
    DependencyResolverService,
    PermissionCheckerService,
    PluginLifecycleService,
    GetPluginsService,
    PluginRegistryService,
    PluginRuntimeService,
    PluginApiRouterService,
    PluginContextProvider,
    PluginDatabaseAccessService,
    PluginModuleIntegrationService,
    PluginEventEmitterService,
    PluginAuditLoggerService,
    PluginSecurityValidatorService,
  ],
  controllers: [PluginsController],
  exports: [
    PluginLifecycleService,
    GetPluginsService,
    PluginRuntimeService,
    PluginApiRouterService,
    PluginDatabaseAccessService,
    PluginModuleIntegrationService,
    PLUGIN_REPOSITORY,
    PLUGIN_LOADER,
    DEPENDENCY_RESOLVER,
    PERMISSION_CHECKER,
  ],
})
export class PluginsModule {}
