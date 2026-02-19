import { Test, TestingModule } from '@nestjs/testing'
import * as bcrypt from 'bcrypt'
import { PasswordServiceImpl } from './password.service'
import type { IPasswordService } from '../../domain/services'

jest.mock('bcrypt')

describe('PasswordServiceImpl (Infrastructure)', () => {
  let service: IPasswordService
  const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordServiceImpl],
    }).compile()

    service = module.get<IPasswordService>(PasswordServiceImpl)
  })

  describe('hash', () => {
    it('should hash password', async () => {
      const password = 'password123'
      const hashedPassword = 'hashed-password'

      mockBcrypt.hash.mockResolvedValue(hashedPassword as never)

      const result = await service.hash(password)

      expect(result).toBe(hashedPassword)
      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 10)
    })
  })

  describe('compare', () => {
    it('should return true for matching passwords', async () => {
      const password = 'password123'
      const hash = 'hashed-password'

      mockBcrypt.compare.mockResolvedValue(true as never)

      const result = await service.compare(password, hash)

      expect(result).toBe(true)
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash)
    })

    it('should return false for non-matching passwords', async () => {
      const password = 'password123'
      const hash = 'hashed-password'

      mockBcrypt.compare.mockResolvedValue(false as never)

      const result = await service.compare(password, hash)

      expect(result).toBe(false)
    })
  })
})
