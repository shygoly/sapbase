import { Test, TestingModule } from '@nestjs/testing'
import * as bcrypt from 'bcrypt'
import { PasswordService } from './password.service'
import type { IPasswordService } from '../../domain/services'

// 位置修正（change: restore-green-backend-tests）：实现一直在 infrastructure/external/，
// 而 spec 写在 infrastructure/services/ 且引用不存在的 './password.service'；
// 类名也不是 PasswordServiceImpl。按仓库惯例「spec 与实现同目录」归位。
jest.mock('bcrypt')

describe('PasswordService (Infrastructure)', () => {
  let service: IPasswordService
  const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile()

    service = module.get<IPasswordService>(PasswordService)
  })

  it('should hash password with bcrypt(10)', async () => {
    mockBcrypt.hash.mockResolvedValue('hashed-password' as never)

    await expect(service.hash('password123')).resolves.toBe('hashed-password')
    expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10)
  })

  it('should compare matching passwords', async () => {
    mockBcrypt.compare.mockResolvedValue(true as never)

    await expect(service.compare('password123', 'hashed-password')).resolves.toBe(true)
    expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password')
  })

  it('should compare non-matching passwords', async () => {
    mockBcrypt.compare.mockResolvedValue(false as never)

    await expect(service.compare('password123', 'other')).resolves.toBe(false)
  })
})
