import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Department } from './department.entity'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'
import { BaseCrudHelper, PaginatedResult } from '../common'

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private departmentsRepository: Repository<Department>,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto, organizationId: string): Promise<Department> {
    const department = this.departmentsRepository.create({
      ...createDepartmentDto,
      organizationId,
    })
    return this.departmentsRepository.save(department)
  }

  async findAll(
    organizationId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<PaginatedResult<Department>> {
    const skip = (page - 1) * pageSize

    const [data, total] = await this.departmentsRepository.findAndCount({
      where: { organizationId },
      relations: ['manager'],
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    })

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async findOne(id: string, organizationId: string): Promise<Department> {
    const department = await this.departmentsRepository.findOne({
      where: { id, organizationId },
    })
    if (!department) {
      throw new NotFoundException('Department not found')
    }
    return department
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto, organizationId: string): Promise<Department> {
    const department = await this.findOne(id, organizationId)
    Object.assign(department, updateDepartmentDto)
    return this.departmentsRepository.save(department)
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const department = await this.findOne(id, organizationId)
    await this.departmentsRepository.remove(department)
  }
}
