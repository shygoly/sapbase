import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Role } from './role.entity'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { BaseCrudHelper } from '../common'

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
    return BaseCrudHelper.findOneOrFail(this.rolesRepository, id, 'Role')
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    return BaseCrudHelper.updateById(this.rolesRepository, id, updateRoleDto, 'Role')
  }

  async remove(id: string): Promise<void> {
    return BaseCrudHelper.removeById(this.rolesRepository, id, 'Role')
  }
}
