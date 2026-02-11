import { Injectable } from '@nestjs/common'
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

  async create(createDepartmentDto: CreateDepartmentDto): Promise<Department> {
    const department = this.departmentsRepository.create(createDepartmentDto)
    return this.departmentsRepository.save(department)
  }

  async findAll(
    page: number = 1,
    pageSize: number = 10,
  ): Promise<PaginatedResult<Department>> {
    const skip = (page - 1) * pageSize

    const [data, total] = await this.departmentsRepository.findAndCount({
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

  async findOne(id: string): Promise<Department> {
    return BaseCrudHelper.findOneOrFail(this.departmentsRepository, id, 'Department')
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto): Promise<Department> {
    return BaseCrudHelper.updateById(this.departmentsRepository, id, updateDepartmentDto, 'Department')
  }

  async remove(id: string): Promise<void> {
    return BaseCrudHelper.removeById(this.departmentsRepository, id, 'Department')
  }
}
