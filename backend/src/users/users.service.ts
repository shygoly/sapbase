import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, ILike } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { User } from './user.entity'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { BaseCrudHelper, PaginatedResult } from '../common'
import { Role } from '../roles/role.entity'
import { Department } from '../departments/department.entity'
import { OrganizationMember, OrganizationRole } from '../organizations/organization-member.entity'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(Department)
    private departmentsRepository: Repository<Department>,
    @InjectRepository(OrganizationMember)
    private organizationMembersRepository: Repository<OrganizationMember>,
  ) {}

  async create(createUserDto: CreateUserDto, organizationId?: string, createdBy?: string): Promise<User> {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required to create a user')
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10)
    let role = await this.resolveRoleAssignment(createUserDto.roleId)
    if (!role) {
      role = await this.getDefaultRole()
    }
    if (!role) {
      throw new NotFoundException('Role not found')
    }

    await this.ensureDepartmentExists(createUserDto.departmentId)

    const user = this.usersRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      departmentId: createUserDto.departmentId,
      status: createUserDto.status,
      roleId: role.id,
      passwordHash: hashedPassword,
    })
    const savedUser = await this.usersRepository.save(user)

    // Add user to organization
    const organizationMember = this.organizationMembersRepository.create({
      userId: savedUser.id,
      organizationId: organizationId,
      role: OrganizationRole.MEMBER,
      invitedById: createdBy,
    })
    await this.organizationMembersRepository.save(organizationMember)

    return (await this.ensureRoleAssociation(savedUser))!
  }

  async findAll(
    page: number = 1,
    pageSize: number = 10,
    search?: string,
  ): Promise<PaginatedResult<User>> {
    const skip = (page - 1) * pageSize

    let query = this.usersRepository.createQueryBuilder('user')

    if (search) {
      query = query.where(
        'user.email ILIKE :search OR user.name ILIKE :search',
        { search: `%${search}%` },
      )
    }

    const total = await query.getCount()

    const data = await query
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getMany()

    const hydratedData = await Promise.all(
      data.map(async (user) => (await this.ensureRoleAssociation(user))!),
    )

    return {
      data: hydratedData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async findOne(id: string): Promise<User> {
    const user = await BaseCrudHelper.findOneOrFail(this.usersRepository, id, 'User')
    return (await this.ensureRoleAssociation(user))!
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { email },
    })
    return this.ensureRoleAssociation(user)
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const { roleId, password, departmentId, ...rest } = updateUserDto
    const updateData: Partial<User> = {
      ...rest,
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      updateData.passwordHash = hashedPassword
    }

    if (roleId) {
      const resolvedRole = await this.resolveRoleAssignment(roleId)
      if (!resolvedRole) {
        throw new NotFoundException('Role not found')
      }
      updateData.roleId = resolvedRole.id
    }

    if (departmentId !== undefined) {
      await this.ensureDepartmentExists(departmentId)
      updateData.departmentId = departmentId
    }

    const updatedUser = await BaseCrudHelper.updateById(
      this.usersRepository,
      id,
      updateData,
      'User',
    )
    return (await this.ensureRoleAssociation(updatedUser))!
  }

  async remove(id: string): Promise<void> {
    return BaseCrudHelper.removeById(this.usersRepository, id, 'User')
  }

  private async ensureDepartmentExists(departmentId?: string | null): Promise<void> {
    if (!departmentId) {
      return
    }

    const exists = await this.departmentsRepository.findOne({ where: { id: departmentId } })
    if (!exists) {
      throw new NotFoundException('Department not found')
    }
  }

  private async resolveRoleAssignment(roleId?: string): Promise<Role | null> {
    if (!roleId) {
      return null
    }

    const role = await this.rolesRepository.findOne({ where: { id: roleId } })
    if (!role) {
      throw new NotFoundException('Role not found')
    }

    return role
  }

  private async getDefaultRole(): Promise<Role | null> {
    return this.rolesRepository.findOne({ where: { name: ILike('user') } })
  }

  private async ensureRoleAssociation(user: User | null): Promise<User | null> {
    if (!user) {
      return null
    }

    if (!user.roleEntity && user.roleId) {
      const role = await this.rolesRepository.findOne({ where: { id: user.roleId } })
      if (role) {
        user.roleEntity = role
      }
    }

    if (!user.roleEntity) {
      const defaultRole = await this.getDefaultRole()
      if (defaultRole) {
        user.roleEntity = defaultRole
        user.roleId = defaultRole.id
        await this.usersRepository.update(user.id, { roleId: defaultRole.id })
      }
    }

    if (user.roleEntity) {
      user.role = user.roleEntity.name
      ;(user as any).roleName = user.roleEntity.name
      ;(user as any).rolePermissions = user.roleEntity.permissions || []
    } else {
      const fallbackRole = user.role || 'user'
      user.role = fallbackRole
      ;(user as any).roleName = fallbackRole
      ;(user as any).rolePermissions = []
    }

    ;(user as any).departmentName = user.departmentEntity?.name ?? null
    if ('departmentEntity' in user) {
      delete (user as any).departmentEntity
    }

    // Keep roleEntity for downstream consumers (auth contexts) if needed

    return user
  }
}
