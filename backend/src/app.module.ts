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
import { WorkflowsModule } from './workflows/workflows.module'
import { PluginsModule } from './plugins/plugins.module'
import { User } from './users/user.entity'
import { Organization } from './organizations/organization.entity'
import { OrganizationMember } from './organizations/organization-member.entity'
import { Invitation } from './organizations/invitation.entity'
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
import { WorkflowDefinition } from './workflows/workflow-definition.entity'
import { WorkflowInstance } from './workflows/workflow-instance.entity'
import { WorkflowHistory } from './workflows/workflow-history.entity'
import { WorkflowAutoSuggestionLog } from './workflows/workflow-auto-suggestion-log.entity'
import { Plugin as PluginOrm } from './plugins/infrastructure/persistence/plugin.entity'
import { LoggerMiddleware } from './common/middleware/logger.middleware'
import { EventBusModule } from './common/events/event-bus.module'
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
    TypeOrmModule.forRoot({
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
      ],
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),
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
    WorkflowsModule,
    PluginsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*')
  }
}
