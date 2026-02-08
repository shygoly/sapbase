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

  async create(name: string, description?: string): Promise<Permission> {
    const permission = this.permissionsRepository.create({ name, description })
    return this.permissionsRepository.save(permission)
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionsRepository.find({
      where: { status: 'active' },
    })
  }

  async findOne(id: string): Promise<Permission> {
    const permission = await this.permissionsRepository.findOne({
      where: { id },
    })

    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`)
    }

    return permission
  }

  async findByName(name: string): Promise<Permission | null> {
    return this.permissionsRepository.findOne({
      where: { name },
    })
  }

  async update(id: string, name?: string, description?: string): Promise<Permission> {
    await this.findOne(id)
    await this.permissionsRepository.update(id, { name, description })
    return this.findOne(id)
  }
}
