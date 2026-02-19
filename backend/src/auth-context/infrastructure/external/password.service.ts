import { Injectable } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import type { IPasswordService } from '../../domain/services'

@Injectable()
export class PasswordService implements IPasswordService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }
}
