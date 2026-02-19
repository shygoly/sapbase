/**
 * Value object: JWT payload structure.
 */
export interface JwtPayload {
  sub: string // user id
  email: string
  role: string
  permissions: string[]
  organizationId?: string
}
