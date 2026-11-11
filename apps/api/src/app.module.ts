import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource, type DataSourceOptions } from 'typeorm'
import {
  addTransactionalDataSource,
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional'
import { UsersModule } from './users/users.module'
import { AuthModule } from './auth/auth.module'
import { DepartmentsModule } from './departments/departments.module'
import { DataScopeModule } from './data-scope/data-scope.module'
import { JobsModule } from './jobs/jobs.module'
import { AssetsModule } from './assets/assets.module'
import { RolesModule } from './roles/roles.module'
import { AuditLogsModule } from './audit-logs/audit-logs.module'
import { SettingsModule } from './settings/settings.module'
import { PermissionsModule } from './permissions/permissions.module'
import { MenuModule } from './menu/menu.module'
import { HealthModule } from './health/health.module'
import { AIModelsModule } from './ai-models/ai-models.module'
import { AIModulesModule } from './ai-modules/ai-modules.module'
import { ModuleRegistryModule } from './module-registry/module-registry.module'
import { SystemModule } from './system/system.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { CacheModule } from './cache/cache.module'
import { LegacyWorkflowGoneModule } from './legacy-workflow-gone/legacy-workflow-gone.module'
import { PluginsModule } from './plugins/plugins.module'
import { AtomicRuntimeModule } from './atomic-runtime/atomic-runtime.module'
import { BlueprintModule } from './blueprint/blueprint.module'
import { OutboxModule } from './outbox/outbox.module'
import { NotificationsModule } from './notifications/notifications.module'
import { SearchModule } from './search/search.module'
import { AgentToolsModule } from './agent-tools/agent-tools.module'
import { AgentHostModule } from './agent-host/agent-host.module'
import { AsyncConsumersModule } from './async-consumers/async-consumers.module'
import { ChatModule } from './chat/chat.module'
import { BusinessAppsModule } from './business-apps/business-apps.module'
import { ReleasesModule } from './releases/releases.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { AgentSessionsModule } from './agent-sessions/agent-sessions.module'
import { AgentKnowledgeModule } from './agent-knowledge/agent-knowledge.module'
import { AgentEvalModule } from './agent-eval/agent-eval.module'
import { AgentFeedbackModule } from './agent-feedback/agent-feedback.module'
import { ReleaseAutomationModule } from './release-automation/release-automation.module'
import { SemanticRuntimeModule } from './semantic-runtime/semantic-runtime.module'
import { ReviewModule } from './review/review.module'
import { LoggerMiddleware } from './common/middleware/logger.middleware'
import { EventBusModule } from './common/events/event-bus.module'
import { TenantTransactionModule } from './common/transaction/tenant-transaction.module'
import { RlsPolicyModule } from './common/rls/rls-policy.module'
import { APP_ENTITIES } from './app.entities'
import { PlatformEntityRegistrationCheck } from './platform-entity-registration.check'

initializeTransactionalContext({ storageDriver: StorageDriver.ASYNC_LOCAL_STORAGE })

// WebSocketModule - conditionally imported to avoid dependency issues during doc generation
let WebSocketModule: any
try {
  WebSocketModule = require('./websocket/websocket.module').WebSocketModule
} catch (error) {
  // WebSocket module not available (dependencies not installed)
  console.warn('WebSocket module not available, skipping...')
}

/**
 * 组合根：只做 import + 基础设施装配，不含任何业务 service。
 *
 * 依赖方向：apps/api → libs/platform-* / libs/agent-tools / 应用模块。
 * 反向依赖由 `@nx/enforce-module-boundaries`（error）与
 * `scripts/meta/check-boundaries.mjs`（CI fail-closed）双重拦截。
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    EventBusModule,
    ...(WebSocketModule ? [WebSocketModule] : []),
    CacheModule,
    TypeOrmModule.forRootAsync({
      useFactory: (): DataSourceOptions => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'mac',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sapbasic',
        entities: APP_ENTITIES,
        synchronize:
          process.env.DB_SYNCHRONIZE === 'true' ||
          (process.env.NODE_ENV !== 'production' &&
            process.env.DB_SYNCHRONIZE !== 'false'),
        logging: process.env.NODE_ENV === 'development',
      }),
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('TypeORM DataSource options missing')
        return addTransactionalDataSource(new DataSource(options))
      },
    }),
    TenantTransactionModule,
    RlsPolicyModule,
    UsersModule,
    AuthModule,
    DepartmentsModule,
    DataScopeModule,
    JobsModule,
    AssetsModule,
    RolesModule,
    AuditLogsModule,
    SettingsModule,
    PermissionsModule,
    MenuModule,
    HealthModule,
    AIModelsModule,
    AIModulesModule,
    ModuleRegistryModule,
    SystemModule,
    OrganizationsModule,
    LegacyWorkflowGoneModule,
    PluginsModule,
    AtomicRuntimeModule,
    BlueprintModule,
    SemanticRuntimeModule,
    ReviewModule,
    OutboxModule,
    NotificationsModule,
    SearchModule,
    AgentToolsModule,
    AgentHostModule,
    AsyncConsumersModule,
    ChatModule,
    BusinessAppsModule,
    ReleasesModule,
    AgentSessionsModule,
    AgentKnowledgeModule,
    AgentEvalModule,
    AgentFeedbackModule,
    ReleaseAutomationModule,
    DashboardModule,
  ],
  controllers: [],
  providers: [PlatformEntityRegistrationCheck],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*')
  }
}
