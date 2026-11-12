import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { User } from '../users/user.entity'
import { Role } from './role.entity'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @Optional()
    @InjectRepository(User)
    private readonly usersRepository?: Repository<User>,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  async create(createRoleDto: CreateRoleDto, organizationId: string): Promise<Role> {
    const role = this.rolesRepository.create({
      ...createRoleDto,
      organizationId,
    })
    const saved = await this.rolesRepository.save(role)
    await this.auditLogs?.create({
      organizationId,
      action: 'role.created',
      resource: 'role',
      resourceId: saved.id,
      actor: 'system:role',
      status: 'success',
      metadata: { name: saved.name },
      source: 'role',
    })
    return saved
  }

  async findAll(organizationId: string): Promise<Role[]> {
    return this.rolesRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  async findByName(name: string, organizationId: string): Promise<Role | null> {
    return this.rolesRepository.findOne({
      where: { name, organizationId, status: 'active' },
    })
  }

  async findOne(id: string, organizationId: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id, organizationId },
    })
    if (!role) {
      throw new NotFoundException('Role not found')
    }
    return role
  }

  async update(id: string, updateRoleDto: UpdateRoleDto, organizationId: string): Promise<Role> {
    const role = await this.findOne(id, organizationId)
    Object.assign(role, updateRoleDto)
    const saved = await this.rolesRepository.save(role)
    await this.auditLogs?.create({
      organizationId,
      action: 'role.updated',
      resource: 'role',
      resourceId: saved.id,
      actor: 'system:role',
      status: 'success',
      metadata: { name: saved.name },
      source: 'role',
    })
    await this.bumpUsersWithRole(saved.id)
    return saved
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const role = await this.findOne(id, organizationId)
    await this.rolesRepository.remove(role)
    await this.auditLogs?.create({
      organizationId,
      action: 'role.deleted',
      resource: 'role',
      resourceId: id,
      actor: 'system:role',
      status: 'success',
      metadata: { name: role.name },
      source: 'role',
    })
    await this.bumpUsersWithRole(id)
  }

  private async bumpUsersWithRole(roleId: string): Promise<void> {
    if (!this.usersRepository) return
    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({ permissionVersion: () => '"permissionVersion" + 1' })
      .where('"roleId" = :roleId', { roleId })
      .execute()
  }
}
