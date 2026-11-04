import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Permission } from './permission.entity'

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
  ) {}

  async create(name: string, organizationId: string, description?: string): Promise<Permission> {
    const permission = this.permissionsRepository.create({ name, organizationId, description })
    return this.permissionsRepository.save(permission)
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
    return this.findOne(id, organizationId)
  }
}
