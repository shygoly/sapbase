/**
 * 演示数据初始化脚本（可重复执行，upsert 语义，不清库）。
 *
 * 运行：npm run seed --workspace @sap/api
 * 说明：早期版本用 TRUNCATE + 固定连接参数，在新环境连不上库、
 * 且会连带清空发布/激活等演示数据，已改为按唯一键 upsert。
 */
import 'dotenv/config'
import { DataSource } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { User } from '../users/user.entity'
import { Role } from '../roles/role.entity'
import { MenuItem } from '../menu/menu.entity'
import { Permission } from '../permissions/permission.entity'
import { Organization } from '../organizations/organization.entity'
import {
  OrganizationMember,
  OrganizationRole,
} from '../organizations/organization-member.entity'
import { UserStatus, EntityStatus } from '@speckit/shared-schemas'

const ORG_SLUG = 'speckit-demo'

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'sapbasic',
  entities: [User, Role, MenuItem, Permission, Organization, OrganizationMember],
  synchronize: false,
  logging: false,
})

/** 与后端 @Auth() 实际声明的权限点对齐的权限目录 */
const PERMISSION_CATALOG: Array<{ name: string; description: string; category: string }> = [
  { name: 'users:read', description: '查看用户', category: 'users' },
  { name: 'users:create', description: '创建用户', category: 'users' },
  { name: 'users:update', description: '编辑用户', category: 'users' },
  { name: 'users:delete', description: '删除用户', category: 'users' },
  { name: 'roles:read', description: '查看角色', category: 'roles' },
  { name: 'roles:create', description: '创建角色', category: 'roles' },
  { name: 'roles:update', description: '编辑角色', category: 'roles' },
  { name: 'roles:delete', description: '删除角色', category: 'roles' },
  { name: 'departments:read', description: '查看部门', category: 'departments' },
  { name: 'departments:create', description: '创建部门', category: 'departments' },
  { name: 'departments:update', description: '编辑部门', category: 'departments' },
  { name: 'departments:delete', description: '删除部门', category: 'departments' },
  { name: 'menu:read', description: '查看菜单', category: 'menu' },
  { name: 'menu:create', description: '创建菜单', category: 'menu' },
  { name: 'menu:update', description: '编辑菜单', category: 'menu' },
  { name: 'menu:delete', description: '删除菜单', category: 'menu' },
  { name: 'plugins:read', description: '查看插件', category: 'plugins' },
  { name: 'resource:read', description: '查看资源', category: 'resource' },
  { name: 'resource:create', description: '创建资源', category: 'resource' },
  { name: 'resource:update', description: '编辑资源', category: 'resource' },
  { name: 'settings:read', description: '查看设置', category: 'settings' },
  { name: 'settings:update', description: '编辑设置', category: 'settings' },
  { name: 'audit-logs:read', description: '查看审计日志', category: 'audit' },
  { name: 'dashboard:read', description: '查看工作台', category: 'dashboard' },
  { name: 'system:admin', description: '系统管理员', category: 'system' },
  { name: 'system:manage', description: '系统配置管理', category: 'system' },
  { name: 'system:generate', description: '系统生成', category: 'system' },
  { name: 'app:release:read', description: '查看发布', category: 'app-release' },
  { name: 'app:release:propose', description: '起草发布提议', category: 'app-release' },
  { name: 'app:release:validate', description: '校验发布提议', category: 'app-release' },
  { name: 'app:release:approve', description: '批准发布提议', category: 'app-release' },
  { name: 'app:release:approve:security', description: '高危变更安全审批', category: 'app-release' },
  { name: 'announcements:read', description: '查看公告', category: 'announcements' },
  { name: 'announcements:manage', description: '创建/编辑公告', category: 'announcements' },
  { name: 'announcements:publish', description: '发布/撤回公告', category: 'announcements' },
  { name: 'app:release:publish', description: '发布版本', category: 'app-release' },
  { name: 'app:release:activate', description: '激活版本', category: 'app-release' },
  { name: 'app:release:rollback', description: '回滚版本', category: 'app-release' },
]

/** 各角色的权限集（与真实权限点对齐，不再是旧枚举） */
const ROLE_DEFS: Array<{ name: string; description: string; permissions: string[] }> = [
  {
    name: 'Admin',
    description: '系统管理员，拥有全部权限',
    permissions: PERMISSION_CATALOG.map((p) => p.name),
  },
  {
    name: 'Manager',
    description: '部门负责人，可审批变更提议',
    permissions: [
      'users:read',
      'roles:read',
      'dashboard:read',
      'app:release:read',
      'app:release:validate',
      'app:release:approve',
    ],
  },
  {
    name: 'Sales',
    description: '业务人员，基础读取',
    permissions: ['users:read', 'dashboard:read', 'app:release:read'],
  },
  {
    name: 'Accountant',
    description: '财务人员，基础读取',
    permissions: ['users:read', 'roles:read', 'dashboard:read', 'app:release:read'],
  },
]

const USER_DEFS: Array<{ name: string; email: string; role: string }> = [
  { name: '系统管理员', email: 'admin@example.com', role: 'Admin' },
  { name: '业务经理', email: 'manager@example.com', role: 'Manager' },
  { name: '业务专员', email: 'sales@example.com', role: 'Sales' },
  { name: '财务专员', email: 'accountant@example.com', role: 'Accountant' },
]

async function upsertOrg(ds: DataSource) {
  const repo = ds.getRepository(Organization)
  let org = await repo.findOne({ where: { slug: ORG_SLUG } })
  if (!org) {
    org = await repo.save(repo.create({ name: 'Speckit Demo', slug: ORG_SLUG }))
    console.log('已创建组织:', org.name)
  }
  return org
}

async function upsertPermissions(ds: DataSource, organizationId: string) {
  const repo = ds.getRepository(Permission)
  for (const p of PERMISSION_CATALOG) {
    const existing = await repo.findOne({ where: { organizationId, name: p.name } })
    if (!existing) {
      await repo.save(repo.create({ ...p, status: EntityStatus.ACTIVE, organizationId }))
    }
  }
  console.log(`权限点目录就绪（${PERMISSION_CATALOG.length} 项）`)
}

async function upsertRoles(ds: DataSource, organizationId: string) {
  const repo = ds.getRepository(Role)
  for (const def of ROLE_DEFS) {
    let role = await repo.findOne({ where: { organizationId, name: def.name } })
    if (!role) {
      role = repo.create({ organizationId, name: def.name, status: 'active' as const })
    }
    role.description = def.description
    role.permissions = def.permissions
    await repo.save(role)
  }
  console.log(`角色就绪（${ROLE_DEFS.length} 个，权限点已对齐后端 @Auth 声明）`)
}

async function upsertUsers(ds: DataSource, organizationId: string) {
  const users = ds.getRepository(User)
  const members = ds.getRepository(OrganizationMember)
  const passwordHash = await bcrypt.hash('123456', 10)

  for (const def of USER_DEFS) {
    let user = await users.findOne({ where: { email: def.email } })
    if (!user) {
      user = users.create({ email: def.email })
    }
    user.name = def.name
    user.role = def.role
    user.passwordHash = passwordHash
    user.status = UserStatus.ACTIVE
    user = await users.save(user)

    const member = await members.findOne({ where: { organizationId, userId: user.id } })
    if (!member) {
      await members.save(
        members.create({
          organizationId,
          userId: user.id,
          role: def.role === 'Admin' ? OrganizationRole.OWNER : OrganizationRole.MEMBER,
        }),
      )
    }
  }
  console.log(`用户就绪（${USER_DEFS.length} 个，密码统一 123456，均已加入组织）`)
}

async function upsertMenus(ds: DataSource, organizationId: string) {
  const repo = ds.getRepository(MenuItem)

  async function upsertItem(input: {
    label: string
    path?: string
    icon?: string
    order: number
    permissions: string[]
    parentId?: string
  }) {
    const where = input.path ? { organizationId, path: input.path } : { organizationId, label: input.label }
    let item = await repo.findOne({ where })
    if (!item) {
      item = repo.create({ organizationId })
    }
    item.label = input.label
    item.path = (input.path ?? '') as string
    item.icon = (input.icon ?? '') as string
    item.order = input.order
    item.permissions = input.permissions
    item.visible = true
    if (input.parentId) item.parent = { id: input.parentId } as MenuItem
    return repo.save(item)
  }

  const dashboardPerms = ['dashboard:read']
  const releasePerms = ['app:release:read']

  await upsertItem({
    label: '工作台',
    path: '/dashboard/overview',
    icon: 'home',
    order: 1,
    permissions: dashboardPerms,
  })
  const system = await upsertItem({
    label: '系统管理',
    icon: 'settings',
    order: 10,
    permissions: ['users:read', 'roles:read', 'departments:read'],
  })

  const children: Array<{
    label: string
    path: string
    icon: string
    order: number
    permissions: string[]
  }> = [
    { label: '用户管理', path: '/admin/users', icon: 'users', order: 1, permissions: ['users:read'] },
    { label: '角色管理', path: '/admin/roles', icon: 'shield', order: 2, permissions: ['roles:read'] },
    { label: '部门管理', path: '/admin/departments', icon: 'building', order: 3, permissions: ['departments:read'] },
    { label: '菜单管理', path: '/admin/menu', icon: 'menu', order: 4, permissions: ['menu:read'] },
    { label: '发布管理', path: '/admin/releases', icon: 'rocket', order: 5, permissions: releasePerms },
    { label: '变更提议', path: '/admin/proposals', icon: 'git-pull-request', order: 6, permissions: releasePerms },
    { label: '发布自动化', path: '/admin/release-automation', icon: 'zap', order: 7, permissions: releasePerms },
    { label: '知识库', path: '/admin/knowledge', icon: 'book', order: 8, permissions: releasePerms },
    { label: 'Agent 治理', path: '/admin/agent-governance', icon: 'eye', order: 9, permissions: releasePerms },
    { label: '审计日志', path: '/admin/audit-logs', icon: 'history', order: 10, permissions: ['audit-logs:read'] },
    { label: '系统设置', path: '/admin/settings', icon: 'cog', order: 11, permissions: ['settings:read'] },
  ]
  for (const child of children) {
    await upsertItem({ ...child, parentId: system.id })
  }
  console.log(`菜单就绪（${children.length + 1} 项，含发布/提议/自动化/知识/治理入口）`)
}

async function seed() {
  const ds = AppDataSource
  await ds.initialize()
  console.log('数据库连接成功:', ds.options.database as string)

  const org = await upsertOrg(ds)
  await upsertPermissions(ds, org.id)
  await upsertRoles(ds, org.id)
  await upsertUsers(ds, org.id)
  await upsertMenus(ds, org.id)

  console.log('✅ 演示数据初始化完成（可重复执行）')
  console.log('   登录账号: admin@example.com / 123456（另含 manager / sales / accountant）')
  await ds.destroy()
}

seed().catch((error) => {
  console.error('seed 失败:', error)
  process.exit(1)
})
