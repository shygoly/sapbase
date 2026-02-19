import { Injectable } from '@nestjs/common'
import { JwtService as NestJwtService } from '@nestjs/jwt'
import type { IJwtService } from '../../domain/services'
import type { JwtPayload } from '../../domain/value-objects'

@Injectable()
export class JwtService implements IJwtService {
  constructor(private readonly nestJwtService: NestJwtService) {}

  async sign(payload: JwtPayload): Promise<string> {
    return this.nestJwtService.sign(payload)
  }

  async verify(token: string): Promise<JwtPayload | null> {
    try {
      return this.nestJwtService.verify<JwtPayload>(token)
    } catch {
      return null
    }
  }
}
