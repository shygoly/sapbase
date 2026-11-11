import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Permission } from './permission.entity'

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  async create(name: string, organizationId: string, description?: string): Promise<Permission> {
    const permission = this.permissionsRepository.create({ name, organizationId, description })
    const saved = await this.permissionsRepository.save(permission)
    await this.auditLogs?.create({
      organizationId,
      action: 'permission.changed',
      resource: 'permission',
      resourceId: saved.id,
      actor: 'system:permission',
      status: 'success',
      metadata: { name, change: 'create' },
      source: 'permission',
    })
    return saved
  }

  async findAll(organizationId: string): Promise<Permission[]> {
    return this.permissionsRepository.find({
      where: { organizationId, status: 'active' },
    })
  }

  async findOne(id: string, organizationId: string): Promise<Permission> {
    const permission = await this.permissionsRepository.findOne({
      where: { id, organizationId },
    })

    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`)
    }

    return permission
  }

  async findByName(name: string, organizationId: string): Promise<Permission | null> {
    return this.permissionsRepository.findOne({
      where: { name, organizationId },
    })
  }

  async update(id: string, organizationId: string, name?: string, description?: string): Promise<Permission> {
    await this.findOne(id, organizationId)
    await this.permissionsRepository.update({ id, organizationId }, { name, description })
    await this.auditLogs?.create({
      organizationId,
      action: 'permission.changed',
      resource: 'permission',
      resourceId: id,
      actor: 'system:permission',
      status: 'success',
      metadata: { name, change: 'update' },
      source: 'permission',
    })
    return this.findOne(id, organizationId)
  }
}
