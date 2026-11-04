import { DataSource } from 'typeorm'
import { config } from 'dotenv'
import { migrateToSaaS } from './migrate-to-saas.seed'
import { User } from '../users/user.entity'
import { Organization } from '../organizations/organization.entity'
import { OrganizationMember } from '../organizations/organization-member.entity'
import { Invitation } from '../organizations/invitation.entity'
import { OrganizationActivity } from '../organizations/organization-activity.entity'
import { Department } from '../departments/department.entity'
import { Role } from '../roles/role.entity'
import { Setting } from '../settings/setting.entity'
import { Permission } from '../permissions/permission.entity'
import { MenuItem } from '../menu/menu.entity'
import { AIModule } from '../ai-modules/ai-module.entity'
import { ModuleRegistry } from '../module-registry/module-registry.entity'
import { AuditLog } from '../audit-logs/audit-log.entity'

config()

const AppDataSource = new DataSource({
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
    Setting,
    Permission,
    MenuItem,
    AIModule,
    ModuleRegistry,
    AuditLog,
  ],
  synchronize: false,
  logging: true,
})

async function run() {
  try {
    await AppDataSource.initialize()
    console.log('Database connected')
    await migrateToSaaS(AppDataSource)
    await AppDataSource.destroy()
    console.log('Migration completed')
    process.exit(0)
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  }
}

run()
