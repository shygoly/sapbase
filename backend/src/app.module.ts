import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UsersModule } from './users/users.module'
import { AuthModule } from './auth/auth.module'
import { DepartmentsModule } from './departments/departments.module'
import { RolesModule } from './roles/roles.module'
import { AuditLogsModule } from './audit-logs/audit-logs.module'
import { SettingsModule } from './settings/settings.module'
import { PermissionsModule } from './permissions/permissions.module'
import { User } from './users/user.entity'
import { Department } from './departments/department.entity'
import { Role } from './roles/role.entity'
import { AuditLog } from './audit-logs/audit-log.entity'
import { Setting } from './settings/setting.entity'
import { Permission } from './permissions/permission.entity'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'mac',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sapbasic',
      entities: [User, Department, Role, AuditLog, Setting, Permission],
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
