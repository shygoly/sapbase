import type { JwtPayload } from '../value-objects'

/**
 * Port for JWT service (implemented in infrastructure).
 */
export interface IJwtService {
  sign(payload: JwtPayload): Promise<string>
  verify(token: string): Promise<JwtPayload | null>
}
