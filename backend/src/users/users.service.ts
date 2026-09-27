import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { User } from './user.entity'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { BaseCrudHelper, PaginatedResult } from '../common'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10)
    const user = this.usersRepository.create({
      ...createUserDto,
      passwordHash: hashedPassword,
    })
    const saved = await this.usersRepository.save(user)
    // save() 把刚写入的摘要留在内存对象上；按通用读取返回，让 select: false 生效
    return this.findOne(saved.id)
  }

  async findAll(
    page: number = 1,
    pageSize: number = 10,
    search?: string,
  ): Promise<PaginatedResult<User>> {
    const skip = (page - 1) * pageSize

    let query = this.usersRepository.createQueryBuilder('user')

    if (search) {
      query = query.where(
        'user.email ILIKE :search OR user.name ILIKE :search',
        { search: `%${search}%` },
      )
    }

    const total = await query.getCount()

    const data = await query
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getMany()

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async findOne(id: string): Promise<User> {
    return BaseCrudHelper.findOneOrFail(this.usersRepository, id, 'User')
  }

  async findByEmail(email: string): Promise<User | null> {
    // 这是凭据读取路径，全仓唯一允许取摘要的地方
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne()
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    return BaseCrudHelper.updateById(this.usersRepository, id, updateUserDto, 'User')
  }

  async remove(id: string): Promise<void> {
    return BaseCrudHelper.removeById(this.usersRepository, id, 'User')
  }
}
