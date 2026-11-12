import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt'
import { DataSource, EntityManager, ILike, Repository } from 'typeorm'
import { User } from '../users/user.entity'
import { Role } from '../roles/role.entity'
import {
  OrganizationMember,
  OrganizationRole,
} from '../organizations/organization-member.entity'
import { Department } from '../departments/department.entity'
import { BatchImportCancelledError } from '../semantic-runtime/semantic-runtime.service'
import type {
  AdapterContext,
  ExportAdapter,
  ExportPage,
  ExportQuery,
  ImportAdapter,
  ImportWriteOptions,
  ImportWriteResult,
  ResourceDescriptor,
} from './bulk.types'

const PREFIX = 'platform'
const USER_STATUSES = ['active', 'inactive', 'suspended']
const DEPARTMENT_STATUSES = ['active', 'inactive']

function userDescriptor(): ResourceDescriptor {
  return {
    resourceKey: `${PREFIX}:users`,
    label: '用户',
    description: '平台用户与组织成员（创建时生成组织成员关系）',
    canImport: true,
    canExport: true,
    fields: [
      { key: 'email', label: '邮箱', type: 'string', required: true, pii: true, example: 'user@example.com' },
      { key: 'name', label: '姓名', type: 'string', required: true, pii: true, example: '张三' },
      {
        key: 'password',
        label: '初始密码',
        type: 'string',
        required: true,
        exportable: false,
        description: '仅导入使用，永不出现在导出/模板示例中，落库前 bcrypt 哈希',
        example: 'ChangeMe123!',
      },
      {
        key: 'status',
        label: '状态',
        type: 'enum',
        enumValues: USER_STATUSES,
        default: 'active',
        example: 'active',
      },
      {
        key: 'departmentId',
        label: '部门',
        type: 'reference',
        referenceResource: `${PREFIX}:departments`,
        example: '部门 UUID（可选）',
      },
      { key: 'id', label: 'id', type: 'string', exportable: true, importable: false },
      {
        key: 'roleName',
        label: '角色',
        type: 'string',
        exportable: true,
        importable: false,
      },
      {
        key: 'createdAt',
        label: 'createdAt',
        type: 'datetime',
        exportable: true,
        importable: false,
      },
    ],
    importFormats: ['csv', 'json', 'xlsx'],
    exportFormats: ['csv', 'json', 'xlsx', 'md', 'pdf'],
  }
}

function departmentDescriptor(): ResourceDescriptor {
  return {
    resourceKey: `${PREFIX}:departments`,
    label: '部门',
    description: '组织部门（名称在本组织内唯一）',
    canImport: true,
    canExport: true,
    fields: [
      { key: 'name', label: '名称', type: 'string', required: true, example: '教学部' },
      { key: 'description', label: '描述', type: 'string', example: '负责教学管理' },
      {
        key: 'status',
        label: '状态',
        type: 'enum',
        enumValues: DEPARTMENT_STATUSES,
        default: 'active',
        example: 'active',
      },
      {
        key: 'managerId',
        label: '负责人',
        type: 'reference',
        referenceResource: `${PREFIX}:users`,
        example: '用户 UUID（可选）',
      },
      { key: 'id', label: 'id', type: 'string', exportable: true, importable: false },
      {
        key: 'createdAt',
        label: 'createdAt',
        type: 'datetime',
        exportable: true,
        importable: false,
      },
    ],
    importFormats: ['csv', 'json', 'xlsx'],
    exportFormats: ['csv', 'json', 'xlsx', 'md', 'pdf'],
  }
}

class RowFailure extends Error {
  constructor(
    message: string,
    readonly reason = 'write-failed',
    readonly field?: string,
  ) {
    super(message)
  }
}

@Injectable()
export class PlatformBulkAdapter implements ImportAdapter, ExportAdapter {
  readonly namespace = PREFIX

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(OrganizationMember)
    private readonly members: Repository<OrganizationMember>,
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
    private readonly dataSource: DataSource,
  ) {}

  supports(resourceKey: string): boolean {
    return resourceKey === `${PREFIX}:users` || resourceKey === `${PREFIX}:departments`
  }

  async describe(ctx: AdapterContext): Promise<ResourceDescriptor> {
    if (ctx.resourceKey === `${PREFIX}:users`) return userDescriptor()
    if (ctx.resourceKey === `${PREFIX}:departments`) return departmentDescriptor()
    throw new BadRequestException(`未注册的平台资源：${ctx.resourceKey}`)
  }

  async listResources(): Promise<ResourceDescriptor[]> {
    return [userDescriptor(), departmentDescriptor()]
  }

  async write(
    ctx: AdapterContext,
    rows: Array<{ row: number; data: Record<string, unknown> }>,
    options: ImportWriteOptions,
  ): Promise<ImportWriteResult> {
    if (ctx.resourceKey === `${PREFIX}:users`) {
      return this.writeRows(ctx, rows, options, (manager, data) =>
        this.createUser(manager, ctx, data),
      )
    }
    if (ctx.resourceKey === `${PREFIX}:departments`) {
      return this.writeRows(ctx, rows, options, (manager, data) =>
        this.createDepartment(manager, ctx, data),
      )
    }
    throw new BadRequestException(`未注册的平台资源：${ctx.resourceKey}`)
  }

  private async writeRows(
    ctx: AdapterContext,
    rows: Array<{ row: number; data: Record<string, unknown> }>,
    options: ImportWriteOptions,
    create: (manager: EntityManager, data: Record<string, unknown>) => Promise<void>,
  ): Promise<ImportWriteResult> {
    const errors: ImportWriteResult['errors'] = []
    let imported = 0
    let validated = 0
    const runOne = async (manager: EntityManager, data: Record<string, unknown>) => {
      await create(manager, data)
    }
    if (options.mode === 'atomic') {
      try {
        await this.dataSource.transaction(async (manager) => {
          for (const row of rows) {
            if (options.isCancelled && (await options.isCancelled())) {
              throw new BatchImportCancelledError()
            }
            await runOne(manager, row.data)
          }
          if (options.dryRun) throw new RowFailure('__dry_run__', 'dry-run')
        })
        imported = options.dryRun ? 0 : rows.length
        validated = options.dryRun ? rows.length : 0
      } catch (error) {
        if (error instanceof RowFailure && error.reason === 'dry-run') {
          validated = rows.length
        } else {
          errors.push(this.rowError(error, rows[0]?.row ?? 1))
        }
      }
      return { imported, validated, errors }
    }
    for (const [index, row] of rows.entries()) {
      if (options.isCancelled && (await options.isCancelled())) {
        throw new BatchImportCancelledError()
      }
      try {
        await this.dataSource.transaction(async (manager) => {
          await runOne(manager, row.data)
          if (options.dryRun) throw new RowFailure('__dry_run__', 'dry-run')
        })
        if (options.dryRun) validated += 1
        else imported += 1
      } catch (error) {
        if (error instanceof RowFailure && error.reason === 'dry-run') {
          validated += 1
        } else {
          errors.push(this.rowError(error, row.row))
        }
      }
      if (options.onProgress && (index + 1) % 50 === 0) {
        await options.onProgress(index + 1, rows.length)
      }
    }
    return { imported, validated, errors }
  }

  private rowError(error: unknown, row: number) {
    if (error instanceof RowFailure) {
      return { row, reason: error.reason, field: error.field, message: error.message }
    }
    const code = (error as { code?: string } | null)?.code
    if (code === '23505') {
      return { row, reason: 'duplicate', message: '唯一键冲突（重复数据）' }
    }
    return {
      row,
      reason: 'write-failed',
      message: error instanceof Error ? error.message : String(error),
    }
  }

  private async createUser(
    manager: EntityManager,
    ctx: AdapterContext,
    data: Record<string, unknown>,
  ): Promise<void> {
    const email = String(data.email ?? '').trim().toLowerCase()
    const name = String(data.name ?? '').trim()
    const password = String(data.password ?? '')
    if (!email || !name) throw new RowFailure('邮箱/姓名必填', 'required', 'email')
    if (password.length < 6) {
      throw new RowFailure('密码至少 6 位', 'validation-failed', 'password')
    }
    const duplicate = await manager.findOne(User, { where: { email } })
    if (duplicate) throw new RowFailure(`邮箱已存在：${email}`, 'duplicate', 'email')
    if (data.departmentId) {
      const department = await manager.findOne(Department, {
        where: { id: String(data.departmentId), organizationId: ctx.organizationId },
      })
      if (!department) {
        throw new RowFailure('部门不存在或不属于当前组织', 'dangling-reference', 'departmentId')
      }
    }
    const role = await manager.findOne(Role, {
      where: { organizationId: ctx.organizationId },
      order: { name: 'ASC' },
    })
    const passwordHash = await bcrypt.hash(password, 10)
    const user = manager.create(User, {
      email,
      name,
      passwordHash,
      status: (data.status as User['status']) ?? 'active',
      departmentId: data.departmentId ? String(data.departmentId) : undefined,
      roleId: role?.id,
    })
    await manager.save(User, user)
    await manager.save(
      OrganizationMember,
      manager.create(OrganizationMember, {
        userId: user.id,
        organizationId: ctx.organizationId,
        role: OrganizationRole.MEMBER,
        invitedById: ctx.actor.id,
      }),
    )
  }

  private async createDepartment(
    manager: EntityManager,
    ctx: AdapterContext,
    data: Record<string, unknown>,
  ): Promise<void> {
    const name = String(data.name ?? '').trim()
    if (!name) throw new RowFailure('名称必填', 'required', 'name')
    const duplicate = await manager.findOne(Department, {
      where: { organizationId: ctx.organizationId, name },
    })
    if (duplicate) throw new RowFailure(`部门已存在：${name}`, 'duplicate', 'name')
    if (data.managerId) {
      const user = await manager.findOne(User, { where: { id: String(data.managerId) } })
      if (!user) throw new RowFailure('负责人不存在', 'dangling-reference', 'managerId')
    }
    const department = manager.create(Department, {
      organizationId: ctx.organizationId,
      name,
      description: data.description === undefined ? undefined : String(data.description),
      status: (data.status as Department['status']) ?? 'active',
      managerId: data.managerId ? String(data.managerId) : undefined,
    })
    await manager.save(Department, department)
  }

  async exportPage(ctx: AdapterContext, query: ExportQuery): Promise<ExportPage> {
    if (ctx.resourceKey === `${PREFIX}:users`) return this.exportUsers(ctx, query)
    if (ctx.resourceKey === `${PREFIX}:departments`) {
      return this.exportDepartments(ctx, query)
    }
    throw new BadRequestException(`未注册的平台资源：${ctx.resourceKey}`)
  }

  private async exportUsers(ctx: AdapterContext, query: ExportQuery): Promise<ExportPage> {
    const builder = this.users
      .createQueryBuilder('user')
      .innerJoin(
        OrganizationMember,
        'member',
        'member.userId = user.id AND member.organizationId = :organizationId',
        { organizationId: ctx.organizationId },
      )
      .leftJoinAndSelect('user.roleEntity', 'roleEntity')
    if (query.search) {
      builder.andWhere('(user.email ILIKE :search OR user.name ILIKE :search)', {
        search: `%${query.search}%`,
      })
    }
    if (query.filter?.status) {
      builder.andWhere('user.status = :status', { status: String(query.filter.status) })
    }
    const [rows, total] = await builder
      .orderBy(query.sort === 'name' ? 'user.name' : 'user.createdAt', query.order === 'asc' ? 'ASC' : 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount()
    return {
      total,
      rows: rows.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        departmentId: user.departmentId ?? null,
        roleName: user.roleEntity?.name ?? null,
        createdAt: user.createdAt,
      })),
    }
  }

  private async exportDepartments(
    ctx: AdapterContext,
    query: ExportQuery,
  ): Promise<ExportPage> {
    const where: Record<string, unknown> = { organizationId: ctx.organizationId }
    if (query.filter?.status) where.status = String(query.filter.status)
    if (query.search) where.name = ILike(`%${query.search}%`)
    const [rows, total] = await this.departments.findAndCount({
      where: where as never,
      order: { createdAt: query.order === 'asc' ? 'ASC' : 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    })
    return {
      total,
      rows: rows.map((department) => ({
        id: department.id,
        name: department.name,
        description: department.description ?? '',
        status: department.status,
        managerId: department.managerId ?? null,
        createdAt: department.createdAt,
      })),
    }
  }
}
