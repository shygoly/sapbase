import { applyDecorators, UseGuards } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { RolesGuard } from '../../auth/roles.guard'
import { Roles } from '../../auth/roles.decorator'

/**
 * Combines JWT authentication with role-based authorization
 *
 * @param roles - Optional roles required to access the endpoint
 *
 * @example
 * // Require authentication only
 * @Auth()
 *
 * @example
 * // Require authentication and Admin role
 * @Auth('Admin')
 *
 * @example
 * // Require authentication and Admin or Manager role
 * @Auth('Admin', 'Manager')
 */
export function Auth(...roles: string[]) {
  if (roles.length > 0) {
    return applyDecorators(
      UseGuards(JwtAuthGuard, RolesGuard),
      Roles(...roles),
      ApiBearerAuth(),
    )
  }
  return applyDecorators(UseGuards(JwtAuthGuard), ApiBearerAuth())
}

/**
 * Mark endpoint as public (no authentication required)
 * This is a placeholder decorator for clarity
 */
export function Public() {
  return applyDecorators()
}
