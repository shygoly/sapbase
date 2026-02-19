import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Role } from './role.entity'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {}

  async create(createRoleDto: CreateRoleDto, organizationId: string): Promise<Role> {
    const role = this.rolesRepository.create({
      ...createRoleDto,
      organizationId,
    })
    return this.rolesRepository.save(role)
  }

  async findAll(organizationId: string): Promise<Role[]> {
    return this.rolesRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
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
    return this.rolesRepository.save(role)
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const role = await this.findOne(id, organizationId)
    await this.rolesRepository.remove(role)
  }
}
