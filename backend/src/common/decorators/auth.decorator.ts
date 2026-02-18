import { applyDecorators, UseGuards } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { RolesGuard } from '../../auth/roles.guard'
import { Roles } from '../../auth/roles.decorator'
import { PermissionsGuard } from '../../auth/permissions.guard'
import { Permissions } from '../../auth/permissions.decorator'

/**
 * Combines JWT authentication with role-based or permission-based authorization
 *
 * @param rolesOrPermissions - Optional roles or permissions required to access the endpoint
 *                              If starts with 'system:', 'users:', etc., treated as permission
 *                              Otherwise treated as role name
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
 * // Require authentication and system:manage permission
 * @Auth('system:manage')
 */
export function Auth(...rolesOrPermissions: string[]) {
  if (rolesOrPermissions.length > 0) {
    // Check if it's a permission (contains ':') or a role
    const isPermission = rolesOrPermissions.some((r) => r.includes(':'))
    
    if (isPermission) {
      // Use permission-based guard
      return applyDecorators(
        UseGuards(JwtAuthGuard, PermissionsGuard),
        Permissions(...rolesOrPermissions),
        ApiBearerAuth(),
      )
    } else {
      // Use role-based guard
      return applyDecorators(
        UseGuards(JwtAuthGuard, RolesGuard),
        Roles(...rolesOrPermissions),
        ApiBearerAuth(),
      )
    }
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
