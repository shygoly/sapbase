/**
 * Value object: JWT payload structure.
 */
export interface JwtPayload {
  sub: string // user id
  email: string
  role: string
  permissions: string[]
  organizationId?: string
  sid?: string
  /** 权限版本；角色/直授变更后旧 token 拒绝。 */
  pv?: number
}
