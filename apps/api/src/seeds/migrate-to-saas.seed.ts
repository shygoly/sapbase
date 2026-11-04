import { DataSource } from 'typeorm'
import { User } from '../users/user.entity'
import { Organization, SubscriptionStatus } from '../organizations/organization.entity'
import { OrganizationMember, OrganizationRole } from '../organizations/organization-member.entity'
import { Department } from '../departments/department.entity'
import { Role } from '../roles/role.entity'
import { Setting } from '../settings/setting.entity'
import { Permission } from '../permissions/permission.entity'
import { MenuItem } from '../menu/menu.entity'
import { AIModule } from '../ai-modules/ai-module.entity'
import { ModuleRegistry } from '../module-registry/module-registry.entity'
import { AuditLog } from '../audit-logs/audit-log.entity'

/**
 * Migration script to convert single-tenant system to multi-tenant SaaS
 * Creates a default organization and migrates all existing data to it
 */
export async function migrateToSaaS(dataSource: DataSource) {
  console.log('Starting SaaS migration...')

  const queryRunner = dataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    // 1. Create default organization
    console.log('Creating default organization...')
    const defaultOrg = queryRunner.manager.create(Organization, {
      name: 'Default Organization',
      slug: 'default',
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      planName: 'enterprise',
    })
    const savedOrg = await queryRunner.manager.save(Organization, defaultOrg)
    console.log(`Created organization: ${savedOrg.id}`)

    // 2. Migrate users to organization members
    console.log('Migrating users to organization members...')
    const users = await queryRunner.manager.find(User)
    for (const user of users) {
      const member = queryRunner.manager.create(OrganizationMember, {
        organizationId: savedOrg.id,
        userId: user.id,
        role: OrganizationRole.OWNER, // Make all existing users owners
        joinedAt: user.createdAt || new Date(),
      })
      await queryRunner.manager.save(OrganizationMember, member)
    }
    console.log(`Migrated ${users.length} users`)

    // 3. Migrate Departments
    console.log('Migrating departments...')
    const departments = await queryRunner.manager.find(Department)
    for (const dept of departments) {
      await queryRunner.manager.update(Department, { id: dept.id }, { organizationId: savedOrg.id })
    }
    console.log(`Migrated ${departments.length} departments`)

    // 4. Migrate Roles
    console.log('Migrating roles...')
    const roles = await queryRunner.manager.find(Role)
    for (const role of roles) {
      await queryRunner.manager.update(Role, { id: role.id }, { organizationId: savedOrg.id })
    }
    console.log(`Migrated ${roles.length} roles`)

    // 5. Migrate Settings
    console.log('Migrating settings...')
    const settings = await queryRunner.manager.find(Setting)
    for (const setting of settings) {
      await queryRunner.manager.update(Setting, { id: setting.id }, { organizationId: savedOrg.id })
    }
    console.log(`Migrated ${settings.length} settings`)

    // 6. Migrate Permissions
    console.log('Migrating permissions...')
    const permissions = await queryRunner.manager.find(Permission)
    for (const permission of permissions) {
      await queryRunner.manager.update(Permission, { id: permission.id }, { organizationId: savedOrg.id })
    }
    console.log(`Migrated ${permissions.length} permissions`)

    // 7. Migrate Menu Items
    console.log('Migrating menu items...')
    const menuItems = await queryRunner.manager.find(MenuItem)
    for (const item of menuItems) {
      await queryRunner.manager.update(MenuItem, { id: item.id }, { organizationId: savedOrg.id })
    }
    console.log(`Migrated ${menuItems.length} menu items`)

    // 8. Migrate AI Modules
    console.log('Migrating AI modules...')
    const aiModules = await queryRunner.manager.find(AIModule)
    for (const module of aiModules) {
      await queryRunner.manager.update(AIModule, { id: module.id }, { organizationId: savedOrg.id })
    }
    console.log(`Migrated ${aiModules.length} AI modules`)

    // 9. Migrate Module Registry
    console.log('Migrating module registry...')
    const modules = await queryRunner.manager.find(ModuleRegistry)
    for (const module of modules) {
      await queryRunner.manager.update(ModuleRegistry, { id: module.id }, { organizationId: savedOrg.id })
    }
    console.log(`Migrated ${modules.length} modules`)

    // 10. Migrate Audit Logs
    console.log('Migrating audit logs...')
    const auditLogs = await queryRunner.manager.find(AuditLog)
    for (const log of auditLogs) {
      await queryRunner.manager.update(AuditLog, { id: log.id }, { organizationId: savedOrg.id })
    }
    console.log(`Migrated ${auditLogs.length} audit logs`)

    await queryRunner.commitTransaction()
    console.log('SaaS migration completed successfully!')
    console.log(`Default organization ID: ${savedOrg.id}`)
  } catch (error) {
    await queryRunner.rollbackTransaction()
    console.error('Migration failed:', error)
    throw error
  } finally {
    await queryRunner.release()
  }
}
