import { DataSource } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { config } from 'dotenv'
import { User } from '../users/user.entity'
import { Role } from '../roles/role.entity'
import { Department } from '../departments/department.entity'
import { MenuItem } from '../menu/menu.entity'
import { Permission } from '../permissions/permission.entity'
import { Organization, SubscriptionStatus } from '../organizations/organization.entity'
import { OrganizationMember, OrganizationRole } from '../organizations/organization-member.entity'
import { UserStatus } from '@speckit/shared-schemas'

config()

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'mac',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sapbasic',
  entities: [User, Department, Role, MenuItem, Permission, Organization, OrganizationMember],
  // Enable schema sync so fresh databases get the required tables before truncation
  synchronize: true,
  logging: true,
})

async function seed() {
  try {
    await AppDataSource.initialize()
    console.log('Database connection established')

    // Clear existing data
    await AppDataSource.query('TRUNCATE TABLE organization_members CASCADE')
    await AppDataSource.query('TRUNCATE TABLE organizations CASCADE')
    await AppDataSource.query('TRUNCATE TABLE users CASCADE')
    await AppDataSource.query('TRUNCATE TABLE departments CASCADE')
    await AppDataSource.query('TRUNCATE TABLE roles CASCADE')
    await AppDataSource.query('TRUNCATE TABLE menu_items CASCADE')
    await AppDataSource.query('TRUNCATE TABLE permissions CASCADE')
    console.log('Cleared existing data')

    // Create default organization
    const organizationRepository = AppDataSource.getRepository(Organization)
    const organizationMemberRepository = AppDataSource.getRepository(OrganizationMember)
    const defaultOrganization = await organizationRepository.save({
      name: 'Default Organization',
      slug: 'default',
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    })
    console.log(`Created default organization ${defaultOrganization.id}`)

    // Create Roles
    const roleRepository = AppDataSource.getRepository(Role)
    const roles = await roleRepository.save(
      [
        {
          name: 'Admin',
          description: 'Administrator with full permissions',
          permissions: [
            'users:read',
            'users:create',
            'users:update',
            'users:delete',
            'roles:read',
            'roles:create',
            'roles:update',
            'roles:delete',
            'departments:read',
            'departments:create',
            'departments:update',
            'departments:delete',
            'menu:read',
            'menu:create',
            'menu:update',
            'menu:delete',
            'dashboard:read',
            'settings:read',
            'settings:update',
            'audit:read',
          ],
          status: 'active' as const,
        },
        {
          name: 'Manager',
          description: 'Department manager with management permissions',
          permissions: [
            'dashboard:read',
            'users:read',
            'users:update',
            'departments:read',
            'departments:update',
            'menu:read',
            'settings:read',
          ],
          status: 'active' as const,
        },
        {
          name: 'User',
          description: 'Regular user with basic permissions',
          permissions: ['dashboard:read', 'menu:read'],
          status: 'active' as const,
        },
        {
          name: 'Viewer',
          description: 'Read-only access',
          permissions: ['dashboard:read'],
          status: 'active' as const,
        },
        {
          name: 'Editor',
          description: 'Content editor with editing permissions',
          permissions: ['dashboard:read', 'menu:read', 'menu:create', 'menu:update'],
          status: 'active' as const,
        },
      ].map((role) => ({ ...role, organization: defaultOrganization })),
    )
    console.log(`Created ${roles.length} roles`)
    const roleMap = new Map(roles.map((role) => [role.name, role]))

    // Create Users (managers first)
    const userRepository = AppDataSource.getRepository(User)
    const managers = await userRepository.save([
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        roleId: roleMap.get('Manager')?.id,
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        roleId: roleMap.get('Manager')?.id,
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        roleId: roleMap.get('Manager')?.id,
        status: UserStatus.ACTIVE,
      },
    ])
    console.log(`Created ${managers.length} manager users`)

    // Create Departments
    const departmentRepository = AppDataSource.getRepository(Department)
    const departments = await departmentRepository.save(
      [
        {
          name: 'Engineering',
          description: 'Software development and engineering team',
          managerId: managers[0].id,
          status: 'active' as const,
        },
        {
          name: 'Sales',
          description: 'Sales and business development team',
          managerId: managers[1].id,
          status: 'active' as const,
        },
        {
          name: 'HR',
          description: 'Human resources and recruitment team',
          managerId: managers[2].id,
          status: 'active' as const,
        },
      ].map((department) => ({ ...department, organization: defaultOrganization })),
    )
    console.log(`Created ${departments.length} departments`)

    // Create additional users
    const departmentMap = new Map(departments.map((dept) => [dept.name, dept.id]))

    const additionalUsers = await userRepository.save([
      {
        name: 'Alice Chen',
        email: 'alice.chen@example.com',
        roleId: roleMap.get('User')?.id,
        departmentId: departmentMap.get('Engineering'),
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Charlie Brown',
        email: 'charlie.brown@example.com',
        roleId: roleMap.get('User')?.id,
        departmentId: departmentMap.get('Engineering'),
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Diana Prince',
        email: 'diana.prince@example.com',
        roleId: roleMap.get('User')?.id,
        departmentId: departmentMap.get('Sales'),
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Eve Wilson',
        email: 'eve.wilson@example.com',
        roleId: roleMap.get('User')?.id,
        departmentId: departmentMap.get('Sales'),
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Frank Miller',
        email: 'frank.miller@example.com',
        roleId: roleMap.get('Viewer')?.id,
        departmentId: departmentMap.get('HR'),
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Grace Lee',
        email: 'grace.lee@example.com',
        roleId: roleMap.get('Viewer')?.id,
        departmentId: departmentMap.get('Engineering'),
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Henry Davis',
        email: 'henry.davis@example.com',
        roleId: roleMap.get('Editor')?.id,
        departmentId: departmentMap.get('Sales'),
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Admin User',
        email: 'admin@example.com',
        roleId: roleMap.get('Admin')?.id,
        departmentId: departmentMap.get('HR'),
        status: UserStatus.ACTIVE,
      },
    ])
    console.log(`Created ${additionalUsers.length} additional users`)

    // Link all users to default organization
    const allUsers = [...managers, ...additionalUsers]
    const adminRole = roleMap.get('Admin')
    const adminRoleId = adminRole?.id
    await organizationMemberRepository.save(
      allUsers.map((user) => ({
        organizationId: defaultOrganization.id,
        userId: user.id,
        role:
          user.roleId && adminRoleId && user.roleId === adminRoleId
            ? OrganizationRole.OWNER
            : OrganizationRole.MEMBER,
      })),
    )
    console.log(`Assigned ${allUsers.length} users to the default organization`)

    // Hash password for admin user
    const hashedPassword = await bcrypt.hash('password123', 10)
    
    // Update admin user with hashed password
    const adminUser = await userRepository.findOne({ where: { email: 'admin@example.com' } })
    if (adminUser) {
      // 实体字段名是 passwordHash（不是 password）—— 旧写法是运行时静默失败的类型错误
      await userRepository.update(adminUser.id, { passwordHash: hashedPassword })
      console.log('Updated admin user password')
    }

    // Create Permissions
    const permissionRepository = AppDataSource.getRepository(Permission)
    const permissions = await permissionRepository.save(
      [
        { name: 'users:read', description: 'View users', category: 'users', status: 'active' as const },
        { name: 'users:create', description: 'Create users', category: 'users', status: 'active' as const },
        { name: 'users:update', description: 'Update users', category: 'users', status: 'active' as const },
        { name: 'users:delete', description: 'Delete users', category: 'users', status: 'active' as const },
        { name: 'roles:read', description: 'View roles', category: 'roles', status: 'active' as const },
        { name: 'roles:create', description: 'Create roles', category: 'roles', status: 'active' as const },
        { name: 'roles:update', description: 'Update roles', category: 'roles', status: 'active' as const },
        { name: 'roles:delete', description: 'Delete roles', category: 'roles', status: 'active' as const },
        { name: 'departments:read', description: 'View departments', category: 'departments', status: 'active' as const },
        { name: 'departments:create', description: 'Create departments', category: 'departments', status: 'active' as const },
        { name: 'departments:update', description: 'Update departments', category: 'departments', status: 'active' as const },
        { name: 'departments:delete', description: 'Delete departments', category: 'departments', status: 'active' as const },
        { name: 'menu:read', description: 'View menu', category: 'menu', status: 'active' as const },
        { name: 'menu:create', description: 'Create menu', category: 'menu', status: 'active' as const },
        { name: 'menu:update', description: 'Update menu', category: 'menu', status: 'active' as const },
        { name: 'menu:delete', description: 'Delete menu', category: 'menu', status: 'active' as const },
        { name: 'dashboard:read', description: 'View dashboard', category: 'dashboard', status: 'active' as const },
        { name: 'settings:read', description: 'View settings', category: 'settings', status: 'active' as const },
        { name: 'settings:update', description: 'Update settings', category: 'settings', status: 'active' as const },
        { name: 'audit:read', description: 'View audit logs', category: 'audit', status: 'active' as const },
      ].map((permission) => ({ ...permission, organization: defaultOrganization })),
    )
    console.log(`Created ${permissions.length} permissions`)

    // Ensure the default admin has access to every seeded permission so they can reach admin routes
    if (adminUser) {
      console.log('Admin user ready with full role permissions')
    }

    // Create Menu Items
    const menuItemRepository = AppDataSource.getRepository(MenuItem)
    
    const dashboardItem = await menuItemRepository.save({
      label: 'Dashboard',
      path: '/admin/dashboard',
      icon: 'dashboard',
      order: 1,
      visible: true,
      permissions: ['dashboard:read'],
      organization: defaultOrganization,
    })

    const systemManagement = await menuItemRepository.save({
      label: 'System Management',
      icon: 'settings',
      order: 2,
      visible: true,
      permissions: ['users:read', 'roles:read', 'departments:read'],
      organization: defaultOrganization,
    })

    const systemChildren = await menuItemRepository.save(
      [
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
          label: 'Role Management',
          path: '/admin/roles',
          icon: 'shield',
          order: 2,
          visible: true,
          permissions: ['roles:read'],
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
          label: 'Menu Management',
          path: '/admin/menu',
          icon: 'menu',
          order: 4,
          visible: true,
          permissions: ['menu:read'],
          parent: systemManagement,
        },
        {
          label: 'Settings',
          path: '/admin/settings',
          icon: 'cog',
          order: 5,
          visible: true,
          permissions: ['settings:read'],
          parent: systemManagement,
        },
        {
          label: 'Audit Logs',
          path: '/admin/audit-logs',
          icon: 'history',
          order: 6,
          visible: true,
          permissions: ['audit:read'],
          parent: systemManagement,
        },
      ].map((item) => ({ ...item, organization: defaultOrganization })),
    )

    const menuItems = [dashboardItem, systemManagement, ...systemChildren]
    console.log(`Created ${menuItems.length} menu items`)

    console.log('Seed data successfully created!')
    console.log(`
    Summary:
    - Roles: ${roles.length}
    - Departments: ${departments.length}
    - Users: ${managers.length + additionalUsers.length}
    - Permissions: ${permissions.length}
    - Menu Items: ${menuItems.length}
    
    Login Credentials:
    - Email: admin@example.com
    - Password: password123
    `)
  } catch (error) {
    console.error('Error seeding database:', error)
    process.exit(1)
  } finally {
    await AppDataSource.destroy()
  }
}

seed()
