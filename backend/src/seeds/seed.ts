import { DataSource } from 'typeorm'
import { User } from '../users/user.entity'
import { Role } from '../roles/role.entity'
import { Department } from '../departments/department.entity'

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'mac',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sapbasic',
  entities: [User, Department, Role],
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
    console.log('Cleared existing data')

    // Create Roles
    const roleRepository = AppDataSource.getRepository(Role)
    const roles = await roleRepository.save([
      {
        name: 'Admin',
        description: 'Administrator with full permissions',
        permissions: ['read', 'write', 'delete', 'manage_users', 'manage_roles'],
        status: 'active',
      },
      {
        name: 'Manager',
        description: 'Department manager with management permissions',
        permissions: ['read', 'write', 'manage_team'],
        status: 'active',
      },
      {
        name: 'User',
        description: 'Regular user with basic permissions',
        permissions: ['read', 'write'],
        status: 'active',
      },
      {
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['read'],
        status: 'active',
      },
      {
        name: 'Editor',
        description: 'Content editor with editing permissions',
        permissions: ['read', 'write', 'edit_content'],
        status: 'active',
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
        status: 'active',
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: 'Manager',
        department: 'Sales',
        status: 'active',
      },
      {
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        role: 'Manager',
        department: 'HR',
        status: 'active',
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
        status: 'active',
      },
      {
        name: 'Sales',
        description: 'Sales and business development team',
        managerId: managers[1].id,
        status: 'active',
      },
      {
        name: 'HR',
        description: 'Human resources and recruitment team',
        managerId: managers[2].id,
        status: 'active',
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
        status: 'active',
      },
      {
        name: 'Charlie Brown',
        email: 'charlie.brown@example.com',
        role: 'User',
        department: 'Engineering',
        status: 'active',
      },
      {
        name: 'Diana Prince',
        email: 'diana.prince@example.com',
        role: 'User',
        department: 'Sales',
        status: 'active',
      },
      {
        name: 'Eve Wilson',
        email: 'eve.wilson@example.com',
        role: 'User',
        department: 'Sales',
        status: 'active',
      },
      {
        name: 'Frank Miller',
        email: 'frank.miller@example.com',
        role: 'Viewer',
        department: 'HR',
        status: 'active',
      },
      {
        name: 'Grace Lee',
        email: 'grace.lee@example.com',
        role: 'Viewer',
        department: 'Engineering',
        status: 'active',
      },
      {
        name: 'Henry Davis',
        email: 'henry.davis@example.com',
        role: 'Editor',
        department: 'Sales',
        status: 'active',
      },
      {
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'Admin',
        department: 'HR',
        status: 'active',
      },
    ])
    console.log(`Created ${additionalUsers.length} additional users`)

    console.log('✅ Seed data successfully created!')
    console.log(`
    Summary:
    - Roles: ${roles.length}
    - Departments: ${departments.length}
    - Users: ${managers.length + additionalUsers.length}
    `)
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  } finally {
    await AppDataSource.destroy()
  }
}

seed()
