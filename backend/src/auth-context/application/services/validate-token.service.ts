import { Inject, Injectable } from '@nestjs/common'
import type { IJwtService } from '../../domain/services'
import type { JwtPayload } from '../../domain/value-objects'
import { JWT_SERVICE } from '../../domain/services'

@Injectable()
export class ValidateTokenService {
  constructor(
    @Inject(JWT_SERVICE)
    private readonly jwtService: IJwtService,
  ) {}

  async validate(token: string): Promise<JwtPayload | null> {
    return this.jwtService.verify(token)
  }
}
