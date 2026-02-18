import { DataSource } from 'typeorm'
import { User } from '../users/user.entity'
import { Role } from '../roles/role.entity'
import { Department } from '../departments/department.entity'
import { AuditLog } from '../audit-logs/audit-log.entity'
import { Setting } from '../settings/setting.entity'
import { Permission } from '../permissions/permission.entity'
import { MenuItem } from '../menu/menu.entity'
import { AIModel, AIModelProvider, AIModelStatus } from '../ai-models/ai-model.entity'
import { AIModule } from '../ai-modules/ai-module.entity'
import { ModuleRegistry, ModuleType, ModuleStatus } from '../module-registry/module-registry.entity'
import { ModuleCapability, CapabilityType } from '../module-registry/module-capability.entity'
import { ModuleStatistics, HealthStatus } from '../module-registry/module-statistics.entity'
import { ModuleRelationship } from '../module-registry/module-relationship.entity'
import { ModuleConfiguration } from '../module-registry/module-configuration.entity'
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
  entities: [
    User,
    Role,
    Department,
    AuditLog,
    Setting,
    Permission,
    MenuItem,
    AIModel,
    AIModule,
    ModuleRegistry,
    ModuleRelationship,
    ModuleCapability,
    ModuleStatistics,
    ModuleConfiguration,
  ],
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
    await AppDataSource.query('TRUNCATE TABLE "ai_models" CASCADE')
    await AppDataSource.query('TRUNCATE TABLE "module_registry" CASCADE')
    await AppDataSource.query('TRUNCATE TABLE "module_capabilities" CASCADE')
    await AppDataSource.query('TRUNCATE TABLE "module_statistics" CASCADE')

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
      const hashedPassword = await bcrypt.hash('123456', 10)
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
      'system:generate', // Full system code generation and deploy (highest privilege; admin has it for testing)
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
      // CRM permissions
      'customers:create',
      'customers:read',
      'customers:update',
      'customers:delete',
      'orders:create',
      'orders:read',
      'orders:update',
      'orders:delete',
      'transactions:create',
      'transactions:read',
      'transactions:update',
      'transactions:delete',
      'crm:*',
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
      let permissionCount
      
      // Admin role gets all permissions
      if (role.name === 'Admin') {
        permissionCount = permissions.length
      } else {
        permissionCount = Math.floor((permissions.length / roles.length) * (i + 1))
      }
      
      role.permissions = permissions.slice(0, permissionCount).map(p => p.name)
      await roleRepository.save(role)
    }
    console.log('Assigned permissions to roles')

    // Create admin user with all permissions from Admin role
    const adminRole = roles.find(r => r.name === 'Admin')
    if (adminRole) {
      const adminHashedPassword = await bcrypt.hash('123456', 10)
      const adminUser = userRepository.create({
        email: 'admin@example.com',
        passwordHash: adminHashedPassword,
        name: 'Admin User',
        role: adminRole.name,
        department: departments[0].name,
        status: UserStatus.ACTIVE,
        permissions: adminRole.permissions, // Copy all permissions from Admin role
      })
      await userRepository.save(adminUser)
      console.log('Created admin user: admin@example.com with all permissions')
    }

    // Create additional test users with specific roles
    const salesRole = roles.find(r => r.name === 'User')
    const managerRole = roles.find(r => r.name === 'Manager')
    const accountantRole = roles.find(r => r.name === 'Viewer')

    // Sales user with CRM permissions
    if (salesRole) {
      const salesHashedPassword = await bcrypt.hash('123456', 10)
      const salesPermissions = permissions
        .filter(p => p.name.startsWith('customers:') || p.name.startsWith('orders:') || p.name === 'dashboard:read')
        .map(p => p.name)
      const salesUser = userRepository.create({
        email: 'sales@example.com',
        passwordHash: salesHashedPassword,
        name: 'Sales User',
        role: salesRole.name,
        department: departments.find(d => d.name === 'Sales')?.name || departments[1].name,
        status: UserStatus.ACTIVE,
        permissions: salesPermissions,
      })
      await userRepository.save(salesUser)
      console.log('Created sales user: sales@example.com')
    }

    // Manager user with CRM and management permissions
    if (managerRole) {
      const managerHashedPassword = await bcrypt.hash('123456', 10)
      const managerPermissions = permissions
        .filter(p => 
          p.name.startsWith('customers:') || 
          p.name.startsWith('orders:') || 
          p.name.startsWith('transactions:') ||
          p.name.startsWith('users:read') ||
          p.name.startsWith('dashboard:') ||
          p.name.startsWith('reports:')
        )
        .map(p => p.name)
      const managerUser = userRepository.create({
        email: 'manager@example.com',
        passwordHash: managerHashedPassword,
        name: 'Manager User',
        role: managerRole.name,
        department: departments.find(d => d.name === 'Sales')?.name || departments[1].name,
        status: UserStatus.ACTIVE,
        permissions: managerPermissions,
      })
      await userRepository.save(managerUser)
      console.log('Created manager user: manager@example.com')
    }

    // Accountant user with transaction permissions
    if (accountantRole) {
      const accountantHashedPassword = await bcrypt.hash('123456', 10)
      const accountantPermissions = permissions
        .filter(p => 
          p.name.startsWith('transactions:') || 
          p.name.startsWith('orders:read') ||
          p.name.startsWith('reports:read') ||
          p.name === 'dashboard:read'
        )
        .map(p => p.name)
      const accountantUser = userRepository.create({
        email: 'accountant@example.com',
        passwordHash: accountantHashedPassword,
        name: 'Accountant User',
        role: accountantRole.name,
        department: departments.find(d => d.name === 'Finance')?.name || departments[4].name,
        status: UserStatus.ACTIVE,
        permissions: accountantPermissions,
      })
      await userRepository.save(accountantUser)
      console.log('Created accountant user: accountant@example.com')
    }

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

    // Seed AI Models
    const aiModelRepository = AppDataSource.getRepository(AIModel)
    const kimiModel = aiModelRepository.create({
      name: 'Kimi API',
      provider: AIModelProvider.KIMI,
      apiKey: 'sk-kimi-NFr9OldbRTRzzyFCJbNTozG1LPP9yb90Uas7AomC4Lz57OomFPk7115ZhDSBHmlJ',
      baseUrl: 'https://api.kimi.com/coding/',
      model: 'kimi-for-coding',
      status: AIModelStatus.ACTIVE,
      description: 'Kimi API for AI-powered patch generation',
      isDefault: true,
    })
    await aiModelRepository.save(kimiModel)
    console.log('Created Kimi AI model configuration')

    // Seed Menu Items with hierarchical structure
    const menuItemRepository = AppDataSource.getRepository(MenuItem)
    
    // Create Dashboard menu item first
    const dashboardItem = await menuItemRepository.save({
      label: 'Dashboard',
      path: '/dashboard/overview',
      icon: 'dashboard',
      order: 1,
      visible: true,
      disabled: false,
      permissions: ['dashboard:read'],
    })

    // Create CRM Management parent menu item
    const crmManagement = await menuItemRepository.save({
      label: 'CRM Management',
      icon: 'users',
      order: 2,
      visible: true,
      disabled: false,
      permissions: ['customers:read', 'orders:read', 'transactions:read'],
    })

    // Create child items for CRM Management
    const crmChildren = await menuItemRepository.save([
      {
        label: 'Customer Management',
        path: '/crm/customers',
        icon: 'users',
        order: 1,
        visible: true,
        disabled: false,
        permissions: ['customers:read'],
        parent: crmManagement,
      },
      {
        label: 'Order Management',
        path: '/crm/orders',
        icon: 'shopping',
        order: 2,
        visible: true,
        disabled: false,
        permissions: ['orders:read'],
        parent: crmManagement,
      },
      {
        label: 'Financial Transactions',
        path: '/crm/transactions',
        icon: 'dollar',
        order: 3,
        visible: true,
        disabled: false,
        permissions: ['transactions:read'],
        parent: crmManagement,
      },
    ])

    // Create parent menu items for System Management
    const systemManagement = await menuItemRepository.save({
      label: 'System Management',
      icon: 'settings',
      order: 3,
      visible: true,
      disabled: false,
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
        disabled: false,
        permissions: ['users:read'],
        parent: systemManagement,
      },
      {
        label: 'Menu Management',
        path: '/admin/menu',
        icon: 'menu',
        order: 2,
        visible: true,
        disabled: false,
        permissions: ['menu:read'],
        parent: systemManagement,
      },
      {
        label: 'Department Management',
        path: '/admin/departments',
        icon: 'building',
        order: 3,
        visible: true,
        disabled: false,
        permissions: ['departments:read'],
        parent: systemManagement,
      },
      {
        label: 'Role Management',
        path: '/admin/roles',
        icon: 'shield',
        order: 4,
        visible: true,
        disabled: false,
        permissions: ['roles:read'],
        parent: systemManagement,
      },
      {
        label: 'Audit Logs',
        path: '/admin/audit-logs',
        icon: 'history',
        order: 5,
        visible: true,
        disabled: false,
        permissions: ['audit-logs:read'],
        parent: systemManagement,
      },
    ])

    // Create AI Management parent menu item
    const aiManagement = await menuItemRepository.save({
      label: 'AI Management',
      icon: 'brain',
      order: 4,
      visible: true,
      disabled: false,
      permissions: ['system:manage'],
    })

    // Create child items for AI Management
    const aiChildren = await menuItemRepository.save([
      {
        label: 'AI Model Configuration',
        path: '/admin/ai-models',
        icon: 'brain',
        order: 1,
        visible: true,
        disabled: false,
        permissions: ['system:manage'],
        parent: aiManagement,
      },
      {
        label: 'AI Module Development',
        path: '/admin/ai-modules/develop',
        icon: 'code',
        order: 2,
        visible: true,
        disabled: false,
        permissions: ['system:manage'],
        parent: aiManagement,
      },
      {
        label: 'AI Module Testing',
        path: '/admin/ai-modules/test',
        icon: 'test-tube',
        order: 3,
        visible: true,
        disabled: false,
        permissions: ['system:manage'],
        parent: aiManagement,
      },
      {
        label: 'AI Module Review',
        path: '/admin/ai-modules/review',
        icon: 'eye',
        order: 4,
        visible: true,
        disabled: false,
        permissions: ['system:manage'],
        parent: aiManagement,
      },
      {
        label: 'AI Module Publishing',
        path: '/admin/ai-modules/publish',
        icon: 'upload',
        order: 5,
        visible: true,
        disabled: false,
        permissions: ['system:manage'],
        parent: aiManagement,
      },
      {
        label: 'Module Registry',
        path: '/admin/module-registry',
        icon: 'package',
        order: 6,
        visible: true,
        disabled: false,
        permissions: ['system:manage'],
        parent: aiManagement,
      },
    ])

    // Create standalone menu items
    // Note: Only Profile is kept, Settings/Reports/Analytics removed per requirement
    const standaloneItems = await menuItemRepository.save([
      {
        label: 'Profile',
        path: '/profile',
        icon: 'user',
        order: 5,
        visible: true,
        disabled: false,
      },
    ])

    const menuItems = [dashboardItem, crmManagement, ...crmChildren, systemManagement, ...systemChildren, aiManagement, ...aiChildren, ...standaloneItems]
    
    // Delete any existing menu items with order > Profile's order (order 5)
    // This ensures we remove Settings, Reports, Analytics if they exist
    // Note: AI Management is now order 4, Profile is order 5
    const existingItems = await menuItemRepository.find()
    const itemsToDelete = existingItems.filter(item => {
      // Delete standalone items (no parent) with order > 5, but keep Profile
      if (!item.parent && item.order > 5 && item.label !== 'Profile') {
        return true
      }
      return false
    })
    if (itemsToDelete.length > 0) {
      for (const item of itemsToDelete) {
        // Set parent to null for children first
        await menuItemRepository.update({ parent: { id: item.id } }, { parent: null } as any)
        await menuItemRepository.delete(item.id)
      }
      console.log(`Deleted ${itemsToDelete.length} menu items that were after Profile`)
    }
    console.log(`Created ${menuItems.length} menu items with hierarchical structure`)

    // Register CRM Module in Module Registry
    const moduleRegistryRepository = AppDataSource.getRepository(ModuleRegistry)
    const moduleCapabilityRepository = AppDataSource.getRepository(ModuleCapability)
    const moduleStatisticsRepository = AppDataSource.getRepository(ModuleStatistics)

    const adminUser = await AppDataSource.getRepository(User).findOne({ where: { email: 'admin@example.com' } })
    const defaultAiModel = await AppDataSource.getRepository(AIModel).findOne({ where: { isDefault: true } })

    const crmModule = await moduleRegistryRepository.save({
      name: 'CRM Module',
      description: 'Customer Relationship Management module with Customer, Order, OrderTracking, and FinancialTransaction entities',
      moduleType: ModuleType.CRUD,
      aiModelId: defaultAiModel?.id,
      createdById: adminUser?.id,
      version: '1.0.0',
      status: ModuleStatus.ACTIVE,
      metadata: {
        schemaPath: '/public/specs/modules/crm',
        apiBasePath: '/crm',
        entities: ['Customer', 'Order', 'OrderTracking', 'FinancialTransaction'],
      },
    })

    console.log('✅ Registered CRM Module in Module Registry')

    // Register CRM Module Capabilities
    const crmCapabilities = [
      {
        moduleId: crmModule.id,
        capabilityType: CapabilityType.CRUD,
        entity: 'Customer',
        operations: ['create', 'read', 'update', 'delete', 'list'],
        apiEndpoints: ['/crm/customers'],
        description: 'CRUD operations for Customer entity',
      },
      {
        moduleId: crmModule.id,
        capabilityType: CapabilityType.CRUD,
        entity: 'Order',
        operations: ['create', 'read', 'update', 'delete', 'list'],
        apiEndpoints: ['/crm/orders'],
        description: 'CRUD operations for Order entity',
      },
      {
        moduleId: crmModule.id,
        capabilityType: CapabilityType.CRUD,
        entity: 'OrderTracking',
        operations: ['create', 'read', 'update', 'delete', 'list'],
        apiEndpoints: ['/crm/order-tracking'],
        description: 'CRUD operations for OrderTracking entity',
      },
      {
        moduleId: crmModule.id,
        capabilityType: CapabilityType.CRUD,
        entity: 'FinancialTransaction',
        operations: ['create', 'read', 'update', 'delete', 'list'],
        apiEndpoints: ['/crm/transactions'],
        description: 'CRUD operations for FinancialTransaction entity',
      },
    ]

    await moduleCapabilityRepository.save(crmCapabilities)
    console.log(`✅ Registered ${crmCapabilities.length} CRM module capabilities`)

    // Initialize CRM Module Statistics
    const crmStatistics = [
      {
        moduleId: crmModule.id,
        entity: 'Customer',
        recordCount: 2,
        lastUpdate: new Date(),
        errorCount: 0,
        healthStatus: HealthStatus.HEALTHY,
        collectedAt: new Date(),
      },
      {
        moduleId: crmModule.id,
        entity: 'Order',
        recordCount: 0,
        errorCount: 0,
        healthStatus: HealthStatus.HEALTHY,
        collectedAt: new Date(),
      },
      {
        moduleId: crmModule.id,
        entity: 'OrderTracking',
        recordCount: 0,
        errorCount: 0,
        healthStatus: HealthStatus.HEALTHY,
        collectedAt: new Date(),
      },
      {
        moduleId: crmModule.id,
        entity: 'FinancialTransaction',
        recordCount: 0,
        errorCount: 0,
        healthStatus: HealthStatus.HEALTHY,
        collectedAt: new Date(),
      },
    ]

    await moduleStatisticsRepository.save(crmStatistics)
    console.log(`✅ Initialized ${crmStatistics.length} CRM module statistics`)

    console.log('✅ Database seeding completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }
}

seedDatabase()
