import { DataSource } from 'typeorm'
import { User } from '../users/user.entity'
import { Role } from '../roles/role.entity'
import { Department } from '../departments/department.entity'
import { AuditLog } from '../audit-logs/audit-log.entity'
import { Setting } from '../settings/setting.entity'
import { Permission } from '../permissions/permission.entity'
import { MenuItem } from '../menu/menu.entity'
import { UserStatus } from '@speckit/shared-schemas'
import * as bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'mac',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sapbasic',
  entities: [User, Role, Department, AuditLog, Setting, Permission, MenuItem],
  synchronize: false,
  logging: false,
})

async function seedDatabase() {
  try {
    await AppDataSource.initialize()
    console.log('Database connection established')

    // Clear existing data (match explicit @Entity table names)
    await AppDataSource.query('TRUNCATE TABLE "users" CASCADE')
    await AppDataSource.query('TRUNCATE TABLE "roles" CASCADE')
    await AppDataSource.query('TRUNCATE TABLE "departments" CASCADE')
    await AppDataSource.query('TRUNCATE TABLE "audit_logs" CASCADE')
    await AppDataSource.query('TRUNCATE TABLE "settings" CASCADE')
    await AppDataSource.query('TRUNCATE TABLE "permissions" CASCADE')
    await AppDataSource.query('TRUNCATE TABLE "menu_items" CASCADE')

    console.log('Cleared existing data')

    // Seed Roles (5 roles)
    const roleRepository = AppDataSource.getRepository(Role)
    const roles = await roleRepository.save([
      { name: 'Admin', description: 'Administrator with full access' },
      { name: 'Manager', description: 'Manager with limited access' },
      { name: 'User', description: 'Regular user' },
      { name: 'Viewer', description: 'Read-only access' },
      { name: 'Guest', description: 'Guest user' },
    ])
    console.log(`Created ${roles.length} roles`)

    // Seed Departments (10 departments)
    const departmentRepository = AppDataSource.getRepository(Department)
    const departments = await departmentRepository.save([
      { name: 'Engineering', description: 'Engineering department' },
      { name: 'Sales', description: 'Sales department' },
      { name: 'Marketing', description: 'Marketing department' },
      { name: 'HR', description: 'Human Resources' },
      { name: 'Finance', description: 'Finance department' },
      { name: 'Operations', description: 'Operations department' },
      { name: 'Support', description: 'Customer Support' },
      { name: 'Product', description: 'Product Management' },
      { name: 'Design', description: 'Design department' },
      { name: 'Legal', description: 'Legal department' },
    ])
    console.log(`Created ${departments.length} departments`)

    // Seed Users (50 users)
    const userRepository = AppDataSource.getRepository(User)
    const users = []
    for (let i = 1; i <= 50; i++) {
      const hashedPassword = await bcrypt.hash('password123', 10)
      const user = userRepository.create({
        email: `user${i}@example.com`,
        passwordHash: hashedPassword,
        name: `User ${i}`,
        role: roles[i % roles.length].name,
        department: departments[i % departments.length].name,
        status: i % 10 !== 0 ? UserStatus.ACTIVE : UserStatus.INACTIVE,
      })
      users.push(user)
    }
    await userRepository.save(users)
    console.log(`Created ${users.length} users`)

    // Create admin user
    const adminHashedPassword = await bcrypt.hash('password123', 10)
    const adminUser = userRepository.create({
      email: 'admin@example.com',
      passwordHash: adminHashedPassword,
      name: 'Admin User',
      role: roles[0].name, // Admin role
      department: departments[0].name,
      status: UserStatus.ACTIVE,
    })
    await userRepository.save(adminUser)
    console.log('Created admin user: admin@example.com')

    // Seed Permissions (50 permissions)
    const permissionRepository = AppDataSource.getRepository(Permission)
    const permissionNames = [
      'users:create',
      'users:read',
      'users:update',
      'users:delete',
      'roles:create',
      'roles:read',
      'roles:update',
      'roles:delete',
      'departments:create',
      'departments:read',
      'departments:update',
      'departments:delete',
      'audit-logs:read',
      'audit-logs:export',
      'settings:read',
      'settings:update',
      'permissions:create',
      'permissions:read',
      'permissions:update',
      'permissions:delete',
      'menu:read',
      'menu:create',
      'menu:update',
      'menu:delete',
      'reports:create',
      'reports:read',
      'reports:update',
      'reports:delete',
      'dashboard:read',
      'analytics:read',
      'system:admin',
      'system:manage',
      'batch:operations',
      'export:data',
      'import:data',
      'notifications:send',
      'notifications:read',
      'notifications:delete',
      'profile:read',
      'profile:update',
      'password:change',
      'mfa:setup',
      'api:access',
      'api:admin',
      'logs:read',
      'logs:delete',
      'backup:create',
      'backup:restore',
      'config:read',
      'config:update',
    ]

    const permissions = await permissionRepository.save(
      permissionNames.map((name) =>
        permissionRepository.create({
          name,
          description: `Permission for ${name}`,
        }),
      ),
    )
    console.log(`Created ${permissions.length} permissions`)

    // Assign permissions to roles
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i]
      const permissionCount = Math.floor((permissions.length / roles.length) * (i + 1))
      role.permissions = permissions.slice(0, permissionCount).map(p => p.name)
      await roleRepository.save(role)
    }
    console.log('Assigned permissions to roles')

    // Seed Settings (50 settings, one per user)
    const settingRepository = AppDataSource.getRepository(Setting)
    const settings = users.map((user) =>
      settingRepository.create({
        userId: user.id,
        theme: Math.random() > 0.5 ? 'light' : 'dark',
        language: ['en', 'zh', 'es', 'fr'][Math.floor(Math.random() * 4)],
        timezone: ['UTC', 'EST', 'PST', 'CST'][Math.floor(Math.random() * 4)],
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm:ss',
        pageSize: [10, 20, 50][Math.floor(Math.random() * 3)],
        fontSize: [12, 14, 16][Math.floor(Math.random() * 3)],
        enableNotifications: Math.random() > 0.3,
      }),
    )
    await settingRepository.save(settings)
    console.log(`Created ${settings.length} settings`)

    // Seed Audit Logs (500 logs)
    const auditLogRepository = AppDataSource.getRepository(AuditLog)
    const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT']
    const resources = ['User', 'Role', 'Department', 'Permission', 'AuditLog', 'Setting', 'Menu']
    const statuses = ['success', 'failure', 'pending']

    const auditLogs = []
    for (let i = 0; i < 500; i++) {
      const actor = users[Math.floor(Math.random() * users.length)]
      const action = actions[Math.floor(Math.random() * actions.length)]
      const resource = resources[Math.floor(Math.random() * resources.length)]
      const status = statuses[Math.floor(Math.random() * statuses.length)] as 'success' | 'failure' | 'pending'
      const resourceId = uuidv4()

      const auditLog = auditLogRepository.create({
        action,
        resource,
        actor: actor.email,
        status,
        resourceId,
        changes: {
          before: { field: 'old_value' },
          after: { field: 'new_value' },
        },
        metadata: {
          ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          userAgent: 'Mozilla/5.0',
          duration: Math.floor(Math.random() * 5000),
        },
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      })
      auditLogs.push(auditLog)
    }
    await auditLogRepository.save(auditLogs)
    console.log(`Created ${auditLogs.length} audit logs`)

    // Seed Menu Items with hierarchical structure
    const menuItemRepository = AppDataSource.getRepository(MenuItem)
    
    // Create parent menu items first
    const systemManagement = await menuItemRepository.save({
      label: 'System Management',
      icon: 'settings',
      order: 1,
      visible: true,
      permissions: ['system:manage'],
    })

    // Create child items for System Management
    const systemChildren = await menuItemRepository.save([
      {
        label: 'User Management',
        path: '/admin/users',
        icon: 'users',
        order: 1,
        visible: true,
        permissions: ['users:read'],
        parent: systemManagement,
      },
      {
        label: 'Menu Management',
        path: '/admin/menu',
        icon: 'menu',
        order: 2,
        visible: true,
        permissions: ['menu:read'],
        parent: systemManagement,
      },
      {
        label: 'Department Management',
        path: '/admin/departments',
        icon: 'building',
        order: 3,
        visible: true,
        permissions: ['departments:read'],
        parent: systemManagement,
      },
      {
        label: 'Role Management',
        path: '/admin/roles',
        icon: 'shield',
        order: 4,
        visible: true,
        permissions: ['roles:read'],
        parent: systemManagement,
      },
      {
        label: 'Audit Logs',
        path: '/admin/audit-logs',
        icon: 'history',
        order: 5,
        visible: true,
        permissions: ['audit-logs:read'],
        parent: systemManagement,
      },
    ])

    // Create standalone menu items
    const standaloneItems = await menuItemRepository.save([
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: 'dashboard',
        order: 2,
        visible: true,
        permissions: ['dashboard:read'],
      },
      {
        label: 'Settings',
        path: '/admin/settings',
        icon: 'settings',
        order: 3,
        visible: true,
        permissions: ['settings:read'],
      },
      {
        label: 'Reports',
        path: '/admin/reports',
        icon: 'chart',
        order: 4,
        visible: true,
        permissions: ['reports:read'],
      },
      {
        label: 'Analytics',
        path: '/admin/analytics',
        icon: 'analytics',
        order: 5,
        visible: true,
        permissions: ['analytics:read'],
      },
      {
        label: 'Profile',
        path: '/profile',
        icon: 'user',
        order: 6,
        visible: true,
      },
    ])

    const menuItems = [systemManagement, ...systemChildren, ...standaloneItems]
    console.log(`Created ${menuItems.length} menu items with hierarchical structure`)

    console.log('✅ Database seeding completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }
}

seedDatabase()
