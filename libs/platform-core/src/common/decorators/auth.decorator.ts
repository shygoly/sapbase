import { applyDecorators, UseGuards } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { PermissionsGuard } from '../../auth/permissions.guard'
import { Permissions } from '../../auth/permissions.decorator'

/**
 * Combines JWT authentication with permission-based authorization
 * Pass one or more permission strings (e.g. users:read, roles:create)
 *
 * @example
 * // Require authentication only
 * @Auth()
 *
 * @example
 * // Require specific permissions
 * @Auth('users:read', 'roles:create')
 */
export function Auth(...permissions: string[]) {
  if (permissions.length > 0) {
    return applyDecorators(
      UseGuards(JwtAuthGuard, PermissionsGuard),
      Permissions(...permissions),
      ApiBearerAuth(),
    )
  }

  return applyDecorators(UseGuards(JwtAuthGuard), ApiBearerAuth())
}

/**
 * Mark endpoint as public (no authentication required)
 */
export function Public() {
  return applyDecorators()
}

