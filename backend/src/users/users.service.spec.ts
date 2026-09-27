import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UsersService } from './users.service'
import { User } from './user.entity'

describe('UsersService credential boundary', () => {
  let service: UsersService
  let findOne: jest.Mock
  let createQueryBuilder: jest.Mock
  let qb: {
    addSelect: jest.Mock
    where: jest.Mock
    orderBy: jest.Mock
    skip: jest.Mock
    take: jest.Mock
    getCount: jest.Mock
    getMany: jest.Mock
    getOne: jest.Mock
  }

  const publicUser = {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    role: 'user',
  }

  const credentialUser = {
    ...publicUser,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
  }

  beforeEach(async () => {
    qb = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getMany: jest.fn().mockResolvedValue([publicUser]),
      getOne: jest.fn().mockResolvedValue(credentialUser),
    }
    findOne = jest.fn().mockResolvedValue(publicUser)
    createQueryBuilder = jest.fn().mockReturnValue(qb)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne,
            createQueryBuilder,
          },
        },
      ],
    }).compile()

    service = module.get(UsersService)
  })

  it('findOne 不带口令摘要', async () => {
    const user = await service.findOne('user-1')
    expect(user.passwordHash).toBeUndefined()
    expect(findOne).toHaveBeenCalled()
    expect(qb.addSelect).not.toHaveBeenCalled()
  })

  it('findAll 不带口令摘要', async () => {
    const result = await service.findAll(1, 10)
    expect(result.data[0].passwordHash).toBeUndefined()
    expect(qb.addSelect).not.toHaveBeenCalled()
  })

  it('findByEmail 带口令摘要（凭据读取路径）', async () => {
    const user = await service.findByEmail('ada@example.com')
    expect(user?.passwordHash).toBe(credentialUser.passwordHash)
    expect(createQueryBuilder).toHaveBeenCalledWith('user')
    expect(qb.addSelect).toHaveBeenCalledWith('user.passwordHash')
    expect(qb.where).toHaveBeenCalledWith('user.email = :email', {
      email: 'ada@example.com',
    })
  })
})
