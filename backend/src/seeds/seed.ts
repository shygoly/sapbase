import { DataSource } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { User } from '../users/user.entity'
import { Role } from '../roles/role.entity'
import { Department } from '../departments/department.entity'
import { MenuItem } from '../menu/menu.entity'
import { Permission } from '../permissions/permission.entity'
import { UserStatus, EntityStatus } from '@speckit/shared-schemas'

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'mac',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sapbasic',
  entities: [User, Department, Role, MenuItem, Permission],
  synchronize: false,
  logging: true,
})

async function seed() {
  try {
    await AppDataSource.initialize()
    console.log('Database connection established')

    // Clear existing data
    await AppDataSource.query('TRUNCATE TABLE users CASCADE')
    await AppDataSource.query('TRUNCATE TABLE departments CASCADE')
    await AppDataSource.query('TRUNCATE TABLE roles CASCADE')
    await AppDataSource.query('TRUNCATE TABLE menu_items CASCADE')
    await AppDataSource.query('TRUNCATE TABLE permissions CASCADE')
    console.log('Cleared existing data')

    // Create Roles
    const roleRepository = AppDataSource.getRepository(Role)
    const roles = await roleRepository.save([
      {
        name: 'Admin',
        description: 'Administrator with full permissions',
        permissions: ['read', 'write', 'delete', 'manage_users', 'manage_roles'],
        status: EntityStatus.ACTIVE,
      },
      {
        name: 'Manager',
        description: 'Department manager with management permissions',
        permissions: ['read', 'write', 'manage_team'],
        status: EntityStatus.ACTIVE,
      },
      {
        name: 'User',
        description: 'Regular user with basic permissions',
        permissions: ['read', 'write'],
        status: EntityStatus.ACTIVE,
      },
      {
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['read'],
        status: EntityStatus.ACTIVE,
      },
      {
        name: 'Editor',
        description: 'Content editor with editing permissions',
        permissions: ['read', 'write', 'edit_content'],
        status: EntityStatus.ACTIVE,
      },
    ])
    console.log(`Created ${roles.length} roles`)

    // Create Users (managers first)
    const userRepository = AppDataSource.getRepository(User)
    const managers = await userRepository.save([
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: 'Manager',
        department: 'Engineering',
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: 'Manager',
        department: 'Sales',
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        role: 'Manager',
        department: 'HR',
        status: UserStatus.ACTIVE,
      },
    ])
    console.log(`Created ${managers.length} manager users`)

    // Create Departments
    const departmentRepository = AppDataSource.getRepository(Department)
    const departments = await departmentRepository.save([
      {
        name: 'Engineering',
        description: 'Software development and engineering team',
        managerId: managers[0].id,
        status: EntityStatus.ACTIVE,
      },
      {
        name: 'Sales',
        description: 'Sales and business development team',
        managerId: managers[1].id,
        status: EntityStatus.ACTIVE,
      },
      {
        name: 'HR',
        description: 'Human resources and recruitment team',
        managerId: managers[2].id,
        status: EntityStatus.ACTIVE,
      },
    ])
    console.log(`Created ${departments.length} departments`)

    // Create additional users
    const additionalUsers = await userRepository.save([
      {
        name: 'Alice Chen',
        email: 'alice.chen@example.com',
        role: 'User',
        department: 'Engineering',
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Charlie Brown',
        email: 'charlie.brown@example.com',
        role: 'User',
        department: 'Engineering',
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Diana Prince',
        email: 'diana.prince@example.com',
        role: 'User',
        department: 'Sales',
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Eve Wilson',
        email: 'eve.wilson@example.com',
        role: 'User',
        department: 'Sales',
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Frank Miller',
        email: 'frank.miller@example.com',
        role: 'Viewer',
        department: 'HR',
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Grace Lee',
        email: 'grace.lee@example.com',
        role: 'Viewer',
        department: 'Engineering',
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Henry Davis',
        email: 'henry.davis@example.com',
        role: 'Editor',
        department: 'Sales',
        status: UserStatus.ACTIVE,
      },
      {
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'Admin',
        department: 'HR',
        status: UserStatus.ACTIVE,
      },
    ])
    console.log(`Created ${additionalUsers.length} additional users`)

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
    const permissions = await permissionRepository.save([
      { name: 'users:read', description: 'View users', category: 'users', status: EntityStatus.ACTIVE },
      { name: 'users:create', description: 'Create users', category: 'users', status: EntityStatus.ACTIVE },
      { name: 'users:update', description: 'Update users', category: 'users', status: EntityStatus.ACTIVE },
      { name: 'users:delete', description: 'Delete users', category: 'users', status: EntityStatus.ACTIVE },
      { name: 'roles:read', description: 'View roles', category: 'roles', status: EntityStatus.ACTIVE },
      { name: 'roles:create', description: 'Create roles', category: 'roles', status: EntityStatus.ACTIVE },
      { name: 'roles:update', description: 'Update roles', category: 'roles', status: EntityStatus.ACTIVE },
      { name: 'roles:delete', description: 'Delete roles', category: 'roles', status: EntityStatus.ACTIVE },
      { name: 'departments:read', description: 'View departments', category: 'departments', status: EntityStatus.ACTIVE },
      { name: 'departments:create', description: 'Create departments', category: 'departments', status: EntityStatus.ACTIVE },
      { name: 'departments:update', description: 'Update departments', category: 'departments', status: EntityStatus.ACTIVE },
      { name: 'departments:delete', description: 'Delete departments', category: 'departments', status: EntityStatus.ACTIVE },
      { name: 'menu:read', description: 'View menu', category: 'menu', status: EntityStatus.ACTIVE },
      { name: 'menu:create', description: 'Create menu', category: 'menu', status: EntityStatus.ACTIVE },
      { name: 'menu:update', description: 'Update menu', category: 'menu', status: EntityStatus.ACTIVE },
      { name: 'menu:delete', description: 'Delete menu', category: 'menu', status: EntityStatus.ACTIVE },
      { name: 'dashboard:read', description: 'View dashboard', category: 'dashboard', status: EntityStatus.ACTIVE },
      { name: 'settings:read', description: 'View settings', category: 'settings', status: EntityStatus.ACTIVE },
      { name: 'settings:update', description: 'Update settings', category: 'settings', status: EntityStatus.ACTIVE },
      { name: 'audit:read', description: 'View audit logs', category: 'audit', status: EntityStatus.ACTIVE },
    ])
    console.log(`Created ${permissions.length} permissions`)

    // Create Menu Items
    const menuItemRepository = AppDataSource.getRepository(MenuItem)
    
    const dashboardItem = await menuItemRepository.save({
      label: 'Dashboard',
      path: '/admin/dashboard',
      icon: 'dashboard',
      order: 1,
      visible: true,
      permissions: ['dashboard:read'],
    })

    const systemManagement = await menuItemRepository.save({
      label: 'System Management',
      icon: 'settings',
      order: 2,
      visible: true,
      permissions: ['users:read', 'roles:read', 'departments:read'],
    })

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
    ])

    const menuItems = [dashboardItem, systemManagement, ...systemChildren]
    console.log(`Created ${menuItems.length} menu items`)

    console.log('✅ Seed data successfully created!')
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
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  } finally {
    await AppDataSource.destroy()
  }
}

seed()
