import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Department } from './department.entity'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'

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

  async findAll(): Promise<Department[]> {
    return this.departmentsRepository.find({
      relations: ['manager'],
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string): Promise<Department> {
    const department = await this.departmentsRepository.findOne({
      where: { id },
      relations: ['manager'],
    })

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`)
    }

    return department
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto): Promise<Department> {
    await this.findOne(id)
    await this.departmentsRepository.update(id, updateDepartmentDto)
    return this.findOne(id)
  }

  async remove(id: string): Promise<void> {
    const department = await this.findOne(id)
    await this.departmentsRepository.remove(department)
  }
}
