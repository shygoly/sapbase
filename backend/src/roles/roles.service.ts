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

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const role = this.rolesRepository.create(createRoleDto)
    return this.rolesRepository.save(role)
  }

  async findAll(): Promise<Role[]> {
    return this.rolesRepository.find({
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id },
    })

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`)
    }

    return role
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    await this.findOne(id)
    await this.rolesRepository.update(id, updateRoleDto)
    return this.findOne(id)
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id)
    await this.rolesRepository.remove(role)
  }
}
