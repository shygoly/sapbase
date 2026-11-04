import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UsersModule } from './users/users.module'
import { AuthModule } from './auth/auth.module'
import { DepartmentsModule } from './departments/departments.module'
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
import { OutboxDelivery } from './outbox/outbox-delivery.entity'
import { OutboxEvent } from './outbox/outbox-event.entity'
import { NotificationsModule } from './notifications/notifications.module'
import { NotificationRecord } from './notifications/notification.entity'
import { AgentToolsModule } from './agent-tools/agent-tools.module'
import { ChatModule } from './chat/chat.module'
import { BusinessAppsModule } from './business-apps/business-apps.module'
import { ReleasesModule } from './releases/releases.module'
import { AgentSessionsModule } from './agent-sessions/agent-sessions.module'
import { AgentKnowledgeModule } from './agent-knowledge/agent-knowledge.module'
import { AgentEvalModule } from './agent-eval/agent-eval.module'
import { AgentFeedbackModule } from './agent-feedback/agent-feedback.module'
import { ReleaseAutomationModule } from './release-automation/release-automation.module'
import { ReleaseAutomationPolicy } from './release-automation/entities/release-automation-policy.entity'
import { ReleaseAutomationRun } from './release-automation/entities/release-automation-run.entity'
import { AgentFeedback } from './agent-feedback/entities/agent-feedback.entity'
import { AgentFeedbackTopic } from './agent-feedback/entities/agent-feedback-topic.entity'
import { AgentKnowledgeEntry } from './agent-knowledge/entities/agent-knowledge-entry.entity'
import { AgentSkillVersion } from './agent-knowledge/entities/agent-skill-version.entity'
import { AgentEvalCase } from './agent-eval/entities/agent-eval-case.entity'
import { AgentEvalRun } from './agent-eval/entities/agent-eval-run.entity'
import { AgentConversation } from './agent-sessions/entities/agent-conversation.entity'
import { AgentTurn } from './agent-sessions/entities/agent-turn.entity'
import { AgentToolCall } from './agent-sessions/entities/agent-tool-call.entity'
import {
  AppChangeProposal,
  AppDraft,
  AppRelease,
  AppReleaseActivation,
  AppReleaseApproval,
  AppReleaseEvent,
  AppReleaseItem,
  AppUserReleaseView,
} from './releases/entities'
import { BusinessAppInstallation } from './business-apps/business-app-installation.entity'
import { BusinessAppInstallationRevision } from './business-apps/business-app-installation-revision.entity'
import { AgentConfirmationToken } from './agent-tools/confirmation-token.entity'
import { SemanticRuntimeModule } from './semantic-runtime/semantic-runtime.module'
import { BlueprintApproval } from './semantic-runtime/blueprint-approval.entity'
import { BlueprintDocCounter } from './semantic-runtime/blueprint-doc-counter.entity'
import { BlueprintJournalEntry } from './semantic-runtime/blueprint-journal-entry.entity'
import { BlueprintRecord } from './semantic-runtime/blueprint-record.entity'
import { BlueprintSuggestionLog } from './semantic-runtime/suggestion-log.entity'
import { User } from './users/user.entity'
import { Organization } from './organizations/organization.entity'
import { OrganizationMember } from './organizations/organization-member.entity'
import { Invitation } from './organizations/invitation.entity'
import { BrandConfig } from './organizations/brand-config.entity'
import { OrganizationActivity } from './organizations/organization-activity.entity'
import { Department } from './departments/department.entity'
import { Role } from './roles/role.entity'
import { AuditLog } from './audit-logs/audit-log.entity'
import { Setting } from './settings/setting.entity'
import { Permission } from './permissions/permission.entity'
import { MenuItem } from './menu/menu.entity'
import { AIModel } from './ai-models/ai-model.entity'
import { AIModule } from './ai-modules/ai-module.entity'
import { AIModuleTest } from './ai-modules/ai-module-test.entity'
import { AIModuleReview } from './ai-modules/ai-module-review.entity'
import { AIModuleDefinition } from './ai-modules/ai-module-definition.entity'
import { ModuleRegistry } from './module-registry/module-registry.entity'
import { ModuleRelationship } from './module-registry/module-relationship.entity'
import { ModuleCapability } from './module-registry/module-capability.entity'
import { ModuleStatistics } from './module-registry/module-statistics.entity'
import { ModuleConfiguration } from './module-registry/module-configuration.entity'
import { WorkflowDefinition } from './workflow-archive/workflow-definition.entity'
import { WorkflowInstance } from './workflow-archive/workflow-instance.entity'
import { WorkflowHistory } from './workflow-archive/workflow-history.entity'
import { WorkflowAutoSuggestionLog } from './workflow-archive/workflow-auto-suggestion-log.entity'
import { Plugin as PluginOrm } from './plugins/infrastructure/persistence/plugin.entity'
import { LoggerMiddleware } from './common/middleware/logger.middleware'
import { EventBusModule } from './common/events/event-bus.module'
import { DataSource, DataSourceOptions } from 'typeorm'
import {
  addTransactionalDataSource,
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional'
import { TenantTransactionModule } from './common/transaction/tenant-transaction.module'
import { RlsPolicyModule } from './common/rls/rls-policy.module'

initializeTransactionalContext({ storageDriver: StorageDriver.ASYNC_LOCAL_STORAGE })
// WebSocketModule - conditionally imported to avoid dependency issues during doc generation
let WebSocketModule: any
try {
  WebSocketModule = require('./websocket/websocket.module').WebSocketModule
} catch (error) {
  // WebSocket module not available (dependencies not installed)
  console.warn('WebSocket module not available, skipping...')
}

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
        entities: [
        User,
        Organization,
        OrganizationMember,
        Invitation,
        BrandConfig,
        OrganizationActivity,
        Department,
        Role,
        AuditLog,
        Setting,
        Permission,
        MenuItem,
        AIModel,
        AIModule,
        AIModuleTest,
        AIModuleReview,
        AIModuleDefinition,
        ModuleRegistry,
        ModuleRelationship,
        ModuleCapability,
        ModuleStatistics,
        ModuleConfiguration,
        WorkflowDefinition,
        WorkflowInstance,
        WorkflowHistory,
        WorkflowAutoSuggestionLog,
        PluginOrm,
        BlueprintRecord,
        BlueprintSuggestionLog,
        BlueprintDocCounter,
        BlueprintApproval,
        BlueprintJournalEntry,
        OutboxEvent,
        OutboxDelivery,
        NotificationRecord,
        AgentConfirmationToken,
        BusinessAppInstallation,
        BusinessAppInstallationRevision,
        AppDraft,
        AppChangeProposal,
        AppRelease,
        AppReleaseItem,
        AppReleaseActivation,
        AppReleaseApproval,
        AppReleaseEvent,
        AppUserReleaseView,
        AgentConversation,
        AgentTurn,
        AgentToolCall,
        AgentKnowledgeEntry,
        AgentSkillVersion,
        AgentEvalCase,
        AgentEvalRun,
        AgentFeedback,
        AgentFeedbackTopic,
        ReleaseAutomationPolicy,
        ReleaseAutomationRun,
        ],
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
    OutboxModule,
    NotificationsModule,
    AgentToolsModule,
    ChatModule,
    BusinessAppsModule,
    ReleasesModule,
    AgentSessionsModule,
    AgentKnowledgeModule,
    AgentEvalModule,
    AgentFeedbackModule,
    ReleaseAutomationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*')
  }
}
